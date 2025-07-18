<<<<<<< HEAD
const stage = document.getElementById('game-of-the-day-stage');
stage.innerHTML = '';
const canvas = document.createElement('canvas');
canvas.width = 720;
canvas.height = 480;
stage.appendChild(canvas);
const ctx = canvas.getContext('2d');

class Character {
  constructor(name, x, y, color, size = 40) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = size;
    this.speed = 3;
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, this.x, this.y + this.size/2 + 15);
  }
  move(dx, dy) {
    this.x += dx * this.speed;
    this.y += dy * this.speed;
    // Keep inside bounds
    this.x = Math.min(Math.max(this.size/2, this.x), canvas.width - this.size/2);
    this.y = Math.min(Math.max(this.size/2, this.y), canvas.height - this.size/2);
  }
  intersects(obj) {
    let dist = Math.hypot(this.x - obj.x, this.y - obj.y);
    return dist < (this.size/2 + obj.size/2);
  }
}

class MathChallenge {
  constructor(x, y, question, answer) {
    this.x = x;
    this.y = y;
    this.size = 50;
    this.question = question; // string
    this.answer = answer; // number
    this.visited = false;
    this.color = '#ffba08';
  }
  draw() {
    ctx.fillStyle = this.visited ? '#6ab04c' : this.color;
    ctx.fillRect(this.x - this.size/2, this.y - this.size/2, this.size, this.size);
    ctx.fillStyle = 'black';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', this.x, this.y);
    if(this.visited){
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('✔', this.x, this.y + 20);
    }
  }
}

class FriendlyAnimal {
  constructor(name, x, y, size=40) {
    this.name = name;
    this.x = x;
    this.y = y;
    this.size = size;
    this.color = '#f28ab2';
  }
  draw() {
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, this.size/1.5, this.size/3, 0, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = 'black';
    ctx.font = '14px comic-sans';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, this.x, this.y + this.size/2 + 15);
  }
  interact() {
    alert(this.name + ' the animal says: "Keep exploring and solving math challenges!"');
  }
}

let player = new Character('Eva', 360, 240, '#4a90e2');

const animals = [
  new FriendlyAnimal('Benny', 100, 100),
  new FriendlyAnimal('Mira', 620, 150),
  new FriendlyAnimal('Tiko', 300, 400),
];

const challenges = [];

// Generate math challenges scattered in the world: addition, subtraction, pattern
function generateChallenges() {
  let questions = [
    {question:'5 + 3', answer:8},
    {question:'10 - 4', answer:6},
    {question:'7 + 2', answer:9},
    {question:'12 - 7', answer:5},
    {question:'3 + 6', answer:9},
    {question:'9 - 1', answer:8},
    {question:'2 + 8', answer:10},
    {question:'15 - 5', answer:10},
    {question:'1, 2, 3, ?', answer:4},
    {question:'2, 4, 6, ?', answer:8},
    {question:'10, 8, 6, ?', answer:4},
  ];

  questions.forEach((q, i) => {
    let x = 100 + (i % 4) * 150 + (Math.random() * 40 - 20);
    let y = 120 + Math.floor(i/4) * 120 + (Math.random() * 40 - 20);
    challenges.push(new MathChallenge(x, y, q.question, q.answer));
  });
}

generateChallenges();

let keysDown = {};
let inputActive = false;
let inputAnswer = '';

function drawBackground() {
  ctx.fillStyle = '#d0f0f7';
  ctx.fillRect(0,0,canvas.width, canvas.height);
  // Simple grass and path
  ctx.fillStyle = '#7cc04c';
  ctx.fillRect(0, 360, canvas.width, 120);
  ctx.fillStyle = '#d9c176';
  ctx.fillRect(280, 0, 160, 480);
}

function drawUI() {
  ctx.fillStyle = '#333';
  ctx.font = '18px Verdana';
  ctx.textAlign = 'left';
  ctx.fillText('Use arrow keys to explore. Find math challenges and answer!', 8, 24);
  ctx.fillText('Challenges solved: ' + challenges.filter(ch => ch.visited).length + '/' + challenges.length, 8, 48);
}

function gameLoop() {
  // Movement controls
  if(!inputActive){
    let dx = 0, dy = 0;
    if(keysDown['ArrowLeft']) dx = -1;
    if(keysDown['ArrowRight']) dx = 1;
    if(keysDown['ArrowUp']) dy = -1;
    if(keysDown['ArrowDown']) dy = 1;
    player.move(dx, dy);
  }

  drawBackground();

  // Draw animals
  animals.forEach(a => a.draw());

  // Draw challenges
  challenges.forEach(ch => ch.draw());

  // Draw player
  player.draw();

  // Check collisions
  if(!inputActive){
    challenges.forEach(ch => {
      if(!ch.visited && player.intersects(ch)){
        inputActive = true;
        inputAnswer = '';
        currentChallenge = ch;
      }
    });
    animals.forEach(a => {
      if(player.intersects(a)){
        a.interact();
      }
    });
  }

  if(inputActive){
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(80, 150, 560, 180);
    ctx.fillStyle = 'white';
    ctx.font = '22px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Solve this:', canvas.width/2, 190);
    ctx.font = 'bold 40px Arial';
    ctx.fillText(currentChallenge.question, canvas.width/2, 250);
    ctx.font = '32px Courier New';
    ctx.fillText(inputAnswer || '_', canvas.width/2, 320);
    ctx.font = '16px Arial';
    ctx.fillText('Type your answer and press Enter to submit', canvas.width/2, 360);
  }

  requestAnimationFrame(gameLoop);
}

// Keyboard handling
window.addEventListener('keydown', e => {
  if(inputActive){
    if(e.key >= '0' && e.key <= '9'){
      if(inputAnswer.length < 3) inputAnswer += e.key;
    } else if(e.key === 'Backspace'){
      inputAnswer = inputAnswer.slice(0, -1);
    } else if(e.key === 'Enter'){
      if(inputAnswer.length === 0) return;
      if(Number(inputAnswer) === currentChallenge.answer){
        alert('Great job! That is correct!');
        currentChallenge.visited = true;
      } else {
        alert('Oops, try again!');
      }
      inputActive = false;
      inputAnswer = '';
    } else if(e.key === 'Escape'){
      inputActive = false;
      inputAnswer = '';
    }
    e.preventDefault();
  } else {
    keysDown[e.key] = true;
  }
});
window.addEventListener('keyup', e => {
  keysDown[e.key] = false;
});

let currentChallenge = null;

gameLoop();
=======
const stage=document.getElementById("game-of-the-day-stage");stage.innerHTML="";stage.style.width="720px";stage.style.height="480px";stage.style.position="relative";stage.style.overflow="hidden";stage.style.background="linear-gradient(to bottom, #6dd5fa, #2980b9)";const canvas=document.createElement("canvas");canvas.width=720;canvas.height=480;canvas.style.display="block";canvas.style.margin="0 auto";canvas.style.background="rgba(255,255,255,0.15)";canvas.style.borderRadius="15px";stage.appendChild(canvas);const ctx=canvas.getContext("2d");const audioCtx=new (window.AudioContext||window.webkitAudioContext)();function playTone(frequency,duration,type="triangle",volume=0.15){const osc=audioCtx.createOscillator();const gain=audioCtx.createGain();osc.connect(gain);gain.connect(audioCtx.destination);osc.type=type;osc.frequency.value=frequency;gain.gain.setValueAtTime(volume,audioCtx.currentTime);osc.start();gain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+duration/1000);osc.stop(audioCtx.currentTime+duration/1000);}function playCorrect(){playTone(880,250,"sine",0.2);playTone(1320,150,"triangle",0.15);const hitGain=audioCtx.createGain();hitGain.connect(audioCtx.destination);hitGain.gain.setValueAtTime(0.3,audioCtx.currentTime);hitGain.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+0.2);}function playWrong(){playTone(220,120,"sawtooth",0.18);setTimeout(()=>{playTone(165,280,"sine",0.15);},130);}let bgOsc1,bgOsc2,bgGain,bgInterval,bgPlaying=false;function playBg(){if(bgPlaying)return;bgPlaying=true;bgGain=audioCtx.createGain();bgGain.connect(audioCtx.destination);bgGain.gain.setValueAtTime(0.03,audioCtx.currentTime);bgOsc1=audioCtx.createOscillator();bgOsc2=audioCtx.createOscillator();bgOsc1.connect(bgGain);bgOsc2.connect(bgGain);bgOsc1.type="sine";bgOsc2.type="triangle";bgOsc1.frequency.setValueAtTime(220,audioCtx.currentTime);bgOsc2.frequency.setValueAtTime(440,audioCtx.currentTime);bgOsc1.start();bgOsc2.start();let direction=1;bgInterval=setInterval(()=>{let freq1=bgOsc1.frequency.value+direction*2;let freq2=bgOsc2.frequency.value-direction*1.5;if(freq1>280||freq1<180)direction*=-1;bgOsc1.frequency.setValueAtTime(freq1,audioCtx.currentTime);bgOsc2.frequency.setValueAtTime(freq2,audioCtx.currentTime);},400);}function stopBg(){if(!bgPlaying)return;bgPlaying=false;clearInterval(bgInterval);bgOsc1.stop();bgOsc2.stop();}playBg();const explorer={x:360,y:240,size:50,color:"#ff6f61",dir:"down",step:5,frame:0,bob:0,bobDir:1};const creatures=[{x:100,y:350,size:40,color:"#76c7c0",type:"MathMoose"},{x:600,y:100,size:50,color:"#f4a261",type:"QuizQuokka"},{x:300,y:150,size:30,color:"#e76f51",type:"CountingCrab"}];let currentQuestion=null;let userAnswer="";let showQuestion=false;let feedbackMessage="";let feedbackTimer=0;function drawExplorer(){explorer.bob+=explorer.bobDir*0.15;if(explorer.bob>4||explorer.bob<0)explorer.bobDir*=-1;ctx.save();ctx.translate(explorer.x,explorer.y+explorer.bob);ctx.shadowColor="rgba(0,0,0,0.2)";ctx.shadowBlur=8;ctx.shadowOffsetX=3;ctx.shadowOffsetY=3;ctx.fillStyle=explorer.color;ctx.beginPath();ctx.ellipse(0,0,explorer.size*0.6,explorer.size*0.8,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(-10,-10,8,0,Math.PI*2);ctx.arc(10,-10,8,0,Math.PI*2);ctx.fill();ctx.fillStyle="#000";ctx.beginPath();ctx.arc(-10,-10,4,0,Math.PI*2);ctx.arc(10,-10,4,0,Math.PI*2);ctx.fill();ctx.fillStyle="#6a4c93";ctx.beginPath();ctx.moveTo(-15,10);ctx.lineTo(0,35);ctx.lineTo(15,10);ctx.closePath();ctx.fill();ctx.beginPath();ctx.strokeStyle="#fff";ctx.lineWidth=2;ctx.moveTo(-20,-20);ctx.lineTo(20,-20);ctx.stroke();ctx.restore();}function drawCreature(c){const bobOffset = Math.sin(Date.now()/500 + c.x) * 2;ctx.save();ctx.translate(c.x,c.y+bobOffset);ctx.shadowColor="rgba(0,0,0,0.15)";ctx.shadowBlur=5;ctx.shadowOffsetX=2;ctx.shadowOffsetY=2;const grad=ctx.createRadialGradient(0,0,c.size*0.3,0,0,c.size);grad.addColorStop(0,c.color);grad.addColorStop(1,"#222");ctx.fillStyle=grad;ctx.beginPath();ctx.ellipse(0,0,c.size*0.75,c.size*0.55,0,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fff";ctx.beginPath();ctx.arc(-c.size*0.2,-c.size*0.15,c.size*0.18,0,Math.PI*2);ctx.arc(c.size*0.2,-c.size*0.15,c.size*0.18,0,Math.PI*2);ctx.fill();ctx.fillStyle="#000";ctx.beginPath();ctx.arc(-c.size*0.2,-c.size*0.15,c.size*0.09,0,Math.PI*2);ctx.arc(c.size*0.2,-c.size*0.15,c.size*0.09,0,Math.PI*2);ctx.fill();ctx.fillStyle="#fefefe";ctx.font=`bold ${c.size*0.28}px Comic Sans MS`;ctx.textAlign="center";ctx.shadowColor="rgba(0,0,0,0.3)";ctx.shadowBlur=4;ctx.shadowOffsetX=0;ctx.shadowOffsetY=1;ctx.fillText(c.type,c.size*0,-c.size*0.7);ctx.restore();}function drawQuestionBox(){const boxX=110,boxY=130,boxW=500,boxH=220;const rad=20;const gradient=ctx.createLinearGradient(boxX,boxY,boxX,boxY+boxH);gradient.addColorStop(0,"#f0f9ff");gradient.addColorStop(1,"#a3c9f1");ctx.fillStyle=gradient;ctx.shadowColor="rgba(0,0,0,0.3)";ctx.shadowBlur=15;ctx.shadowOffsetX=1;ctx.shadowOffsetY=4;ctx.beginPath();ctx.moveTo(boxX+rad,boxY);ctx.lineTo(boxX+boxW-rad,boxY);ctx.quadraticCurveTo(boxX+boxW,boxY,boxX+boxW,boxY+rad);ctx.lineTo(boxX+boxW,boxY+boxH-rad);ctx.quadraticCurveTo(boxX+boxW,boxY+boxH,boxX+boxW-rad,boxY+boxH);ctx.lineTo(boxX+rad,boxY+boxH);ctx.quadraticCurveTo(boxX,boxY+boxH,boxX,boxY+boxH-rad);ctx.lineTo(boxX,boxY+rad);ctx.quadraticCurveTo(boxX,boxY,boxX+rad,boxY);ctx.closePath();ctx.fill();ctx.shadowColor="transparent";ctx.strokeStyle="#4a73b8";ctx.lineWidth=5;ctx.stroke();ctx.fillStyle="#2a3d66";ctx.font="26px Comic Sans MS";ctx.textAlign="center";ctx.fillText(`Help your friend solve:`,boxX+boxW/2,boxY+40);ctx.font="bold 54px Comic Sans MS";ctx.fillText(currentQuestion.q,boxX+boxW/2,boxY+100);ctx.font="38px Comic Sans MS";ctx.fillText(userAnswer||"_",boxX+boxW/2,boxY+160);ctx.font="22px Comic Sans MS";ctx.fillStyle="#3d506d";ctx.fillText("Type your answer and press Enter",boxX+boxW/2,boxY+200);if(feedbackMessage){ctx.fillStyle=feedbackMessage==="Correct!"?"#238823":"#d32f2f";ctx.font="32px Comic Sans MS";ctx.shadowColor="rgba(0,0,0,0.2)";ctx.shadowBlur=6;ctx.fillText(feedbackMessage,boxX+boxW/2,boxY+260);ctx.shadowBlur=0;}}function generateQuestion(){const n1=Math.floor(Math.random()*10)+1;const n2=Math.floor(Math.random()*10)+1;const ops=["+","-"];const op=ops[Math.floor(Math.random()*2)];let answer=op==="+"?n1+n2:n1-n2;return{q:`${n1} ${op} ${n2} = ?`,answer:answer};}function checkCollision(a,b){return Math.abs(a.x-b.x)<(a.size+b.size)*0.5&&Math.abs(a.y-b.y)<(a.size+b.size)*0.5;}function drawStars(){const starCount=60;ctx.fillStyle="rgba(255, 255, 255, 0.8)";for(let i=0;i<starCount;i++){const x=(i*37)%720;const y=(i*59)%480;const r=1+Math.sin(Date.now()/300+i)*0.6;ctx.beginPath();ctx.ellipse(x,y,r,r,0,0,Math.PI*2);ctx.fill();}}function drawPlants(){for(let i=0;i<10;i++){const baseX = (i*72)+30;const baseY = 480-15;ctx.strokeStyle="#3a6";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(baseX,baseY);ctx.lineTo(baseX + Math.sin(Date.now()/700 + i)*5, baseY - 45 - Math.cos(Date.now()/500 + i)*10);ctx.stroke();ctx.fillStyle="#2a5";ctx.beginPath();ctx.ellipse(baseX + Math.sin(Date.now()/700 + i)*5, baseY - 45 - Math.cos(Date.now()/500 + i)*10, 8,15,Math.sin(Date.now()/1000 + i)*0.3,0,Math.PI*2);ctx.fill();}}function gameLoop(){ctx.clearRect(0,0,720,480);drawStars();drawPlants();drawExplorer();creatures.forEach(drawCreature);if(showQuestion)drawQuestionBox();ctx.fillStyle="#ebf1fb";ctx.font="18px Comic Sans MS";ctx.textAlign="left";ctx.shadowColor="rgba(0,0,0,0.25)";ctx.shadowBlur=4;ctx.fillText("Use arrow keys to move Explorer. Meet friends & solve sums!",10,30);ctx.shadowBlur=0;if(feedbackTimer>0){feedbackTimer--;if(feedbackTimer===0)feedbackMessage="";}requestAnimationFrame(gameLoop);}document.addEventListener("keydown",e=>{if(showQuestion){if(e.key>="0"&&e.key<="9"){userAnswer+=e.key;if(userAnswer.length>3)userAnswer=userAnswer.slice(0,3);}else if(e.key==="Backspace"){userAnswer=userAnswer.slice(0,-1);}else if(e.key==="Enter"){if(parseInt(userAnswer)===currentQuestion.answer){feedbackMessage="Correct!";playCorrect();}else{feedbackMessage="Try again!";playWrong();}feedbackTimer=90;if(feedbackMessage==="Correct!")setTimeout(()=>{showQuestion=false;userAnswer="";currentQuestion=null;},1500);}return;e.preventDefault();}switch(e.key){case"ArrowUp":if(explorer.y-explorer.step>explorer.size*0.8)explorer.y-=explorer.step;explorer.dir="up";break;case"ArrowDown":if(explorer.y+explorer.step<480-explorer.size*0.8)explorer.y+=explorer.step;explorer.dir="down";break;case"ArrowLeft":if(explorer.x-explorer.step>explorer.size*0.6)explorer.x-=explorer.step;explorer.dir="left";break;case"ArrowRight":if(explorer.x+explorer.step<720-explorer.size*0.6)explorer.x+=explorer.step;explorer.dir="right";break;}for(const c of creatures){if(checkCollision(explorer,c)&&!showQuestion){currentQuestion=generateQuestion();showQuestion=true;userAnswer="";feedbackMessage="";playTone(523,200,"square",0.17);} }e.preventDefault();});gameLoop();
>>>>>>> 277993c (Refactor game structure and enhance visuals; implement new underwater math game mechanics with improved audio feedback and character interactions.)
