const stage = document.getElementById('game-of-the-day-stage');
stage.innerHTML = '';
const canvas = document.createElement('canvas');
canvas.width = 720;
canvas.height = 480;
stage.appendChild(canvas);
const ctx = canvas.getContext('2d');

let keys = {};
window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

class Character {
  constructor(x, y, color, name) {
    this.x = x;
    this.y = y;
    this.w = 40;
    this.h = 60;
    this.color = color;
    this.name = name;
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.fillText(this.name, this.x, this.y - 5);
  }
  intersects(other) {
    return !(this.x + this.w < other.x || this.x > other.x + other.w ||
             this.y + this.h < other.y || this.y > other.y + other.h);
  }
}

class SignPost {
  constructor(x, y, question, answer) {
    this.x = x;
    this.y = y;
    this.w = 50;
    this.h = 70;
    this.question = question;
    this.answer = answer;
    this.completed = false;
  }
  draw() {
    ctx.fillStyle = this.completed ? 'gray' : '#8B4513';
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = 'black';
    ctx.fillRect(this.x + 18, this.y - 30, 15, 35);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x, this.y, this.w, this.h);
  }
  isNear(character) {
    return (Math.abs(character.x - this.x) < 60 && Math.abs(character.y - this.y) < 60);
  }
}

function randomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// World boundaries
const worldWidth = 1440;
const worldHeight = 960;

const player = new Character(100, 100, '#3174ad', 'Explorer Zee');

// Unique characters (helpers)
const helper1 = new Character(700, 200, '#f28c00', 'Fizz');
const helper2 = new Character(1000, 800, '#43a047', 'Pip');

const signPosts = [
// Addition signposts
  new SignPost(400, 150, 'What is 8 + 6?', 14),
  new SignPost(850, 300, 'Add 17 + 5', 22),
// Subtraction signposts
  new SignPost(1000, 600, 'What is 20 - 7?', 13),
  new SignPost(1200, 250, 'Subtract 10 from 18', 8),
// Number pattern signposts
  new SignPost(600, 700, 'Find the next: 2, 4, 6, ?', 8),
  new SignPost(1300, 700, 'Fill in ? 5, 10, 15, ?', 20),
];

const messages = [];
let questionActive = false;
let currentSignPost = null;
let inputAnswer = '';
let showHelperMsg = '';
let showHelperTimer = 0;

function drawWorld() {
  // Sky blue background
  ctx.fillStyle = '#a1d6ff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Green grass base
  ctx.fillStyle = '#317841';
  const grassHeight = 60;
  ctx.fillRect(0, canvas.height - grassHeight, canvas.width, grassHeight);

  // Draw some trees scattered in world
  ctx.fillStyle = '#3e2723';
  for(let i = 0; i < 15; i++) {
    const treeX = (i * 98 + 150) % worldWidth;
    const treeY = (i * 87 + 190) % (worldHeight - grassHeight - 60) + 50;
    // Trunk
    const screenX = treeX - camera.x;
    const screenY = treeY - camera.y;
    if(screenX >= -60 && screenX < canvas.width && screenY >= -120 && screenY < canvas.height - grassHeight) {
      ctx.fillRect(screenX + 15, screenY + 40, 10, 30);
      // Leaves - simple circle
      ctx.fillStyle = '#0b6623';
      ctx.beginPath();
      ctx.ellipse(screenX + 20, screenY + 40, 30, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3e2723';
    }
  }
}

const camera = {
  x: 0,
  y: 0,
  update() {
    // Keep camera centered on player, but inside world bounds
    this.x = player.x + player.w / 2 - canvas.width / 2;
    this.y = player.y + player.h / 2 - canvas.height / 2;
    this.x = Math.min(Math.max(0, this.x), worldWidth - canvas.width);
    this.y = Math.min(Math.max(0, this.y), worldHeight - canvas.height);
  }
};

function drawTextBox(text) {
  const boxWidth = 680;
  const boxHeight = 80;
  const boxX = 20;
  const boxY = canvas.height - boxHeight - 20;

  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = 'white';
  ctx.font = '22px Comic Sans MS';
  ctx.fillText(text, boxX + 20, boxY + 45);
}

function drawInputBox(promptText, answer) {
  const boxWidth = 680;
  const boxHeight = 110;
  const boxX = 20;
  const boxY = canvas.height - boxHeight - 20;
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
  ctx.strokeStyle = 'yellow';
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

  ctx.fillStyle = 'yellow';
  ctx.font = '24px Arial';
  ctx.fillText(promptText, boxX + 20, boxY + 40);

  ctx.fillStyle = 'white';
  ctx.font = '32px Arial';
  ctx.fillText(inputAnswer || '_', boxX + 20, boxY + 85);
}

function handleAnswer() {
  if (inputAnswer === '') return false;
  if(+inputAnswer === currentSignPost.answer) {
    messages.push('Great job! You answered correctly.');
    currentSignPost.completed = true;
    questionActive = false;
    currentSignPost = null;
    inputAnswer = '';
    return true;
  } else {
    messages.push('Oops! Try again.');
    inputAnswer = '';
    return false;
  }
}

function drawHelpers() {
  [helper1, helper2].forEach(h => {
    const sx = h.x - camera.x;
    const sy = h.y - camera.y;
    if(sx + h.w > 0 && sx < canvas.width && sy + h.h > 0 && sy < canvas.height) {
      h.draw();
    }
  });

  if(showHelperTimer > 0) {
    drawTextBox(showHelperMsg);
    showHelperTimer--;
  }
}

function updateHelpers() {
  // Show helper messages if near player
  const near1 = Math.abs(player.x - helper1.x) < 70 && Math.abs(player.y - helper1.y) < 70;
  const near2 = Math.abs(player.x - helper2.x) < 70 && Math.abs(player.y - helper2.y) < 70;

  if(near1 && showHelperTimer <= 0) {
    showHelperMsg = 'Fizz says: "Add with ease, count the trees!"';
    showHelperTimer = 250;
  }
  if(near2 && showHelperTimer <= 0) {
    showHelperMsg = 'Pip says: "Subtract smart, you\'re off to a great start!"';
    showHelperTimer = 250;
  }
}

function gameLoop() {
  // Movement
  let dx = 0;
  let dy = 0;
  const speed = 3;
  if(keys['arrowleft'] || keys['a']) dx = -speed;
  if(keys['arrowright'] || keys['d']) dx = speed;
  if(keys['arrowup'] || keys['w']) dy = -speed;
  if(keys['arrowdown'] || keys['s']) dy = speed;

  // Move player but clamp inside world
  player.x = Math.min(Math.max(0, player.x + dx), worldWidth - player.w);
  player.y = Math.min(Math.max(0, player.y + dy), worldHeight - player.h);

  camera.update();

  drawWorld();

  // Draw signposts
  signPosts.forEach(sp => {
    const sx = sp.x - camera.x;
    const sy = sp.y - camera.y;
    if(sx + sp.w >= 0 && sx < canvas.width && sy + sp.h >= 0 && sy < canvas.height) {
      sp.draw();
    }
  });

  // Draw helpers
  drawHelpers();

  // Draw player
  ctx.fillStyle = 'gold';
  ctx.beginPath();
  // head
  ctx.ellipse(player.x + player.w/2 - camera.x, player.y + 18 - camera.y, 20, 25, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#3174ad'; // body
  ctx.fillRect(player.x + 8 - camera.x, player.y + 40 - camera.y, 25, 20);
  // eyes
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.ellipse(player.x + 15 - camera.x, player.y + 15 - camera.y, 6, 8, 0, 0, 2 * Math.PI);
  ctx.ellipse(player.x + 30 - camera.x, player.y + 15 - camera.y, 6, 8, 0, 0, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = 'black';
  ctx.beginPath();
  ctx.ellipse(player.x + 15 - camera.x, player.y + 17 - camera.y, 3, 4, 0, 0, 2 * Math.PI);
  ctx.ellipse(player.x + 30 - camera.x, player.y + 17 - camera.y, 3, 4, 0, 0, 2 * Math.PI);
  ctx.fill();

  // Interaction with signposts
  if (!questionActive) {
    for(let sp of signPosts) {
      if(!sp.completed && sp.isNear(player)) {
        drawTextBox('Press SPACE to answer: ' + sp.question);
        if(keys[' ']) {
          questionActive = true;
          currentSignPost = sp;
          inputAnswer = '';
          keys[' '] = false;  // Prevent repeated immediate toggle
          break;
        }
      }
    }
  }

  if(questionActive && currentSignPost) {
    drawInputBox(currentSignPost.question + ' (Type answer & ENTER)', inputAnswer);
  }

  // Show messages
  if(messages.length) {
    drawTextBox(messages[0]);
  }

  // Helper messages auto-hide
  if(showHelperTimer > 0) {
    showHelperTimer--;
  }

  updateHelpers();

  requestAnimationFrame(gameLoop);
}

// Handle input for answer typing and submitting
window.addEventListener('keydown', event => {
  if(questionActive) {
    if(event.key >= '0' && event.key <= '9') {
      if(inputAnswer.length < 3) inputAnswer += event.key;
      event.preventDefault();
    }
    if(event.key === 'Backspace') {
      inputAnswer = inputAnswer.slice(0, -1);
      event.preventDefault();
    }
    if(event.key === 'Enter') {
      handleAnswer();
      event.preventDefault();
    }
    if(event.key === 'Escape') {
      questionActive = false;
      currentSignPost = null;
      inputAnswer = '';
    }
  }
});

gameLoop();
