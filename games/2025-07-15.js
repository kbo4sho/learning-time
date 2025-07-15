const stage = document.getElementById('game-of-the-day-stage');
stage.innerHTML = '';
const canvas = document.createElement('canvas');
canvas.width = 720;
canvas.height = 480;
stage.appendChild(canvas);
const ctx = canvas.getContext('2d');

const TILE_SIZE = 48;
const MAP_COLS = 15;
const MAP_ROWS = 10;

ctx.imageSmoothingEnabled = false;

// Load assets
const assets = {};
let assetsLoaded = 0;
const totalAssets = 4;

function loadImage(name, src) {
    const img = new Image();
    img.onload = () => {
        assets[name] = img;
        assetsLoaded++;
    };
    img.src = src;
}
  
// Simple pixel art tiles / characters drawn as imgs for fun visuals
// Placeholder simple base64 icons and sprites

loadImage('grass', 'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}" viewBox="0 0 48 48">
  <rect fill="#4CAF50" width="48" height="48"/>
  <circle fill="#388E3C" cx="24" cy="24" r="18"/></svg>`));

loadImage('player', 'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <circle fill="#FFEB3B" cx="24" cy="16" r="8"/>
  <rect fill="#03A9F4" x="16" y="24" width="16" height="20" rx="4" ry="6"/>
  </svg>`));

loadImage('npc', 'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <circle fill="#E91E63" cx="24" cy="16" r="8"/>
  <rect fill="#9C27B0" x="16" y="24" width="16" height="20" rx="4" ry="6"/>
  </svg>`));

loadImage('star', 'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <polygon fill="#FFC107" points="16,2 20,12 31,12 22,19 25,29 16,23 7,29 10,19 1,12 12,12 "/>
  </svg>'));

function ready() {
    return assetsLoaded === totalAssets;
}

// Simple map with grass tiles (flat)
const map = [];
for(let r=0; r<MAP_ROWS; r++) {
  const row = [];
  for(let c=0; c<MAP_COLS; c++) {
    row.push('grass');
  }
  map.push(row);
}

// Player
const player = {
  x: 7,
  y: 5,
  px: 7 * TILE_SIZE,
  py: 5 * TILE_SIZE,
  speed: 6, // pixels per frame
  moving: false,
  targetX: 7,
  targetY: 5,
};

// Some NPCs scattered on map that give math questions
const npcs = [
  {x: 4, y: 3, name: "Mila", question: null, answered: false},
  {x: 11, y: 7, name: "Ravi", question: null, answered: false},
  {x: 2, y: 8, name: "Tia", question: null, answered: false},
];

// Generate a simple math question
function generateMathQuestion() {
  const ops = ['+', '-', '*'];
  const a = Math.floor(Math.random()*10) + 1;
  const b = Math.floor(Math.random()*10) + 1;
  const op = ops[Math.floor(Math.random()*ops.length)];
  let answer;
  switch(op) {
    case '+': answer = a + b; break;
    case '-': answer = a - b; break;
    case '*': answer = a * b; break;
  }
  return {
    text: `${a} ${op} ${b} = ?`,
    answer,
  };
}

// Game state
let dialogActive = false;
let currentDialogNPC = null;
let currentQuestion = null;
let userAnswer = '';
let message = "Use arrow keys or WASD to explore. Talk to characters to solve math quests!";

// Stars to collect for rewards placed randomly in map
const stars = [];
for(let i=0;i<7;i++) {
  let sx, sy;
  do {
    sx = Math.floor(Math.random()*MAP_COLS);
    sy = Math.floor(Math.random()*MAP_ROWS);
  } while((sx === player.x && sy === player.y) || npcs.some(n=>n.x===sx && n.y===sy));
  stars.push({x: sx, y: sy, collected: false});
}

let collectedStars = 0;

// Input handling
const keysDown = {};

window.addEventListener('keydown', e=>{
  if(dialogActive){
    // Number keys, Backspace, Enter in dialog input
    if(e.key >= '0' && e.key <= '9') {
      if(userAnswer.length < 5) userAnswer += e.key;
    } else if(e.key === 'Backspace') {
      userAnswer = userAnswer.slice(0, -1);
    } else if(e.key === 'Enter') {
      if(currentQuestion){
        const userAnsNum = parseInt(userAnswer);
        if(userAnsNum === currentQuestion.answer){
          message = `Correct! You helped ${currentDialogNPC.name}. You earned a star!`;
          currentDialogNPC.answered = true;
          // Spawn a star near NPC location:
          stars.push({x: currentDialogNPC.x, y: currentDialogNPC.y, collected: false});
        } else {
          message = `Oops! That's not right. Try again later.`;
        }
        dialogActive = false;
        currentDialogNPC = null;
        currentQuestion = null;
        userAnswer = '';
      }
    }
    e.preventDefault();
  } else {
    // Movement keys
    if(e.key === 'ArrowUp' || e.key === 'w') keysDown['up'] = true;
    if(e.key === 'ArrowDown' || e.key === 's') keysDown['down'] = true;
    if(e.key === 'ArrowLeft' || e.key === 'a') keysDown['left'] = true;
    if(e.key === 'ArrowRight' || e.key === 'd') keysDown['right'] = true;
    if(e.key === ' ' || e.key === 'Enter') {
      // Try interaction
      interactWithNPC();
    }
  }
});

window.addEventListener('keyup', e=>{
  if(!dialogActive){
    if(e.key === 'ArrowUp' || e.key === 'w') keysDown['up'] = false;
    if(e.key === 'ArrowDown' || e.key === 's') keysDown['down'] = false;
    if(e.key === 'ArrowLeft' || e.key === 'a') keysDown['left'] = false;
    if(e.key === 'ArrowRight' || e.key === 'd') keysDown['right'] = false;
  }
});

function canMoveTo(x,y){
  return x >= 0 && x < MAP_COLS && y >=0 && y < MAP_ROWS;
}

function interactWithNPC(){
  // Check if adjacent player to NPC
  for(const npc of npcs){
    const dx = Math.abs(npc.x - player.x);
    const dy = Math.abs(npc.y - player.y);
    if(dx + dy === 1){
      if(npc.answered){
        message = `${npc.name}: Thanks again! You've solved my question.`;
      } else {
        dialogActive = true;
        currentDialogNPC = npc;
        if(!npc.question) npc.question = generateMathQuestion();
        currentQuestion = npc.question;
        userAnswer = '';
        message = `${npc.name}: Solve this: ${currentQuestion.text}`;
      }
      return;
    }
  }
  message = "Find a character nearby to interact.";
}

// Draw full map and grid
function drawMap(){
  for(let r=0;r<MAP_ROWS;r++){
    for(let c=0;c<MAP_COLS;c++){
      const tile = map[r][c];
      ctx.drawImage(assets[tile], c*TILE_SIZE, r*TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }
}

// Draw NPCs
function drawNPCs(){
  npcs.forEach(npc=>{
    ctx.drawImage(assets.npc, npc.x*TILE_SIZE, npc.y*TILE_SIZE, TILE_SIZE, TILE_SIZE);
    if(npc.answered){
      // Draw star icon over NPC
      ctx.drawImage(assets.star, npc.x*TILE_SIZE+8, npc.y*TILE_SIZE+4, 32, 32);
    }
  });
}

// Draw stars on map
function drawStars(){
  stars.forEach(star=>{
    if(!star.collected){
      ctx.drawImage(assets.star, star.x*TILE_SIZE+8, star.y*TILE_SIZE+8, 32, 32);
    }
  });
}

// Draw player
function drawPlayer(){
  ctx.drawImage(assets.player, player.px, player.py, TILE_SIZE, TILE_SIZE);
}

// Check star collection
function checkStarCollection(){
  stars.forEach(star=>{
    if(!star.collected && star.x === player.x && star.y === player.y){
      star.collected = true;
      collectedStars++;
      message = `You collected a star! Total stars: ${collectedStars}`;
    }
  });
}

// Draw UI/dialog
function drawUI(){
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, canvas.height - 100, canvas.width, 100);
  ctx.fillStyle = 'white';
  ctx.font = '18px monospace';
  ctx.textBaseline = 'top';
  const lines = wrapText(message, 88);
  for(let i=0;i<lines.length;i++){
    ctx.fillText(lines[i], 10, canvas.height-95 + i*22);
  }
  ctx.fillText(`Stars collected: ${collectedStars}`, 10, canvas.height - 20);
  
  if(dialogActive && currentQuestion){
    ctx.fillText("Your answer: " + userAnswer, 10, canvas.height - 60);
  } else {
    ctx.fillText("Move with arrow keys or WASD. Press SPACE or ENTER near characters to chat.", 10, canvas.height - 60);
  }
}

function wrapText(text, maxChars){
  const words = text.split(' ');
  let lines = [];
  let currentLine = '';
  for(const w of words){
    if((currentLine + w).length > maxChars){
      lines.push(currentLine);
      currentLine = w + ' ';
    } else {
      currentLine += w + ' ';
    }
  }
  lines.push(currentLine);
  return lines;
}

// Update game state
function update(){
  if(dialogActive) return;

  if(!player.moving){
    let newX = player.x;
    let newY = player.y;
    if(keysDown.left) newX--;
    else if(keysDown.right) newX++;
    else if(keysDown.up) newY--;
    else if(keysDown.down) newY++;
    
    if((newX !== player.x || newY !== player.y) && canMoveTo(newX, newY)){
      player.targetX = newX;
      player.targetY = newY;
      player.moving = true;
    }
  } else {
    // Move smoothly toward target
    const targetPx = player.targetX * TILE_SIZE;
    const targetPy = player.targetY * TILE_SIZE;

    let dx = targetPx - player.px;
    let dy = targetPy - player.py;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if(dist < player.speed){
      player.px = targetPx;
      player.py = targetPy;
      player.x = player.targetX;
      player.y = player.targetY;
      player.moving = false;

      // Check collection once arrived
      checkStarCollection();

    } else {
      player.px += (dx / dist) * player.speed;
      player.py += (dy / dist) * player.speed;
    }
  }
}

// Main render loop
function render(){
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  drawStars();
  drawNPCs();
  drawPlayer();
  drawUI();
}

function gameLoop(){
  if(ready()){
    update();
    render();
    requestAnimationFrame(gameLoop);
  } else {
    ctx.fillStyle = 'black';
    ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '24px monospace';
    ctx.fillText('Loading assets...', 20, 40);
  }
}

gameLoop();