const canvas = document.createElement('canvas');
canvas.width = 720;
canvas.height = 480;
document.getElementById('game-of-the-day-stage').innerHTML = '';
document.getElementById('game-of-the-day-stage').appendChild(canvas);
const ctx = canvas.getContext('2d');

class Vector2 {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }
  add(v) {
    return new Vector2(this.x + v.x, this.y + v.y);
  }
  sub(v) {
    return new Vector2(this.x - v.x, this.y - v.y);
  }
  mul(s) {
    return new Vector2(this.x * s, this.y * s);
  }
}

class Camera {
  constructor(x, y) {
    this.position = new Vector2(x, y);
  }
  worldToScreen(worldPos) {
    return worldPos.sub(this.position);
  }
  screenToWorld(screenPos) {
    return screenPos.add(this.position);
  }
}

class Player {
  constructor(x, y) {
    this.pos = new Vector2(x, y);
    this.speed = 3;
    this.size = 32;
    this.color = '#2D89EF'; // bright blue
    this.direction = 'down';
    this.frame = 0;
    this.animCounter = 0;
  }
  update(keys, map) {
    let movement = new Vector2(0, 0);
    if (keys['ArrowUp']) {
      movement = movement.add(new Vector2(0, -1));
      this.direction = 'up';
    } else if (keys['ArrowDown']) {
      movement = movement.add(new Vector2(0, 1));
      this.direction = 'down';
    }
    if (keys['ArrowLeft']) {
      movement = movement.add(new Vector2(-1, 0));
      this.direction = 'left';
    } else if (keys['ArrowRight']) {
      movement = movement.add(new Vector2(1, 0));
      this.direction = 'right';
    }
    if (movement.x !== 0 || movement.y !== 0) {
      movement = movement.mul(this.speed / Math.sqrt(movement.x * movement.x + movement.y * movement.y));
      let newPos = this.pos.add(movement);
      // Boundaries of map check
      if (newPos.x >= 0 && newPos.x <= map.width - this.size &&
          newPos.y >= 0 && newPos.y <= map.height - this.size) {
        this.pos = newPos;
      }
      this.animCounter++;
      if (this.animCounter % 10 == 0) {
        this.frame = (this.frame + 1) % 4;
      }
    } else {
      this.frame = 0;
    }
  }
  draw(ctx, screenPos) {
    // Draw player as a little hero with a face and shield
    ctx.save();
    ctx.translate(screenPos.x + this.size / 2, screenPos.y + this.size / 2);
    // Body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Face circle
    ctx.fillStyle = '#FFD8A9';
    ctx.beginPath();
    ctx.ellipse(0, -6, 10, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(-4, -8, 2, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(4, -8, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Shield (changes direction)
    ctx.fillStyle = '#888';
    if (this.direction === 'left') {
      ctx.beginPath();
      ctx.moveTo(-14, 7);
      ctx.lineTo(-20, 0);
      ctx.lineTo(-14, -7);
      ctx.closePath();
      ctx.fill();
    } else if (this.direction === 'right') {
      ctx.beginPath();
      ctx.moveTo(14, 7);
      ctx.lineTo(20, 0);
      ctx.lineTo(14, -7);
      ctx.closePath();
      ctx.fill();
    } else if (this.direction === 'up') {
      ctx.beginPath();
      ctx.moveTo(-7, -14);
      ctx.lineTo(0, -20);
      ctx.lineTo(7, -14);
      ctx.closePath();
      ctx.fill();
    } else if (this.direction === 'down') {
      ctx.beginPath();
      ctx.moveTo(-7, 14);
      ctx.lineTo(0, 20);
      ctx.lineTo(7, 14);
      ctx.closePath();
      ctx.fill();
    }
    // Feet (animate)
    ctx.fillStyle = '#555';
    let footYOffset = (this.frame % 2 === 0) ? 10 : 13;
    ctx.beginPath();
    ctx.ellipse(-7, footYOffset, 4, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(7, footYOffset, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class NPC {
  constructor(x, y, name, color, dialogueFunc) {
    this.pos = new Vector2(x, y);
    this.size = 32;
    this.name = name;
    this.color = color;
    this.dialogueFunc = dialogueFunc;
    this.animCounter = 0;
    this.frame = 0;
    this.direction = 'down';
  }
  update() {
    this.animCounter++;
    if (this.animCounter % 30 === 0) {
      this.frame = (this.frame + 1) % 3;
      // Random direction change to simulate life
      const dirs = ['up', 'down', 'left', 'right'];
      this.direction = dirs[Math.floor(Math.random() * dirs.length)];
    }
  }
  draw(ctx, screenPos) {
    ctx.save();
    ctx.translate(screenPos.x + this.size / 2, screenPos.y + this.size / 2);
    // Body
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    // Face circle
    ctx.fillStyle = '#FFE0BD';
    ctx.beginPath();
    ctx.ellipse(0, -6, 10, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Eyes always looking forward
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(-3, -8, 2, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(3, -8, 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Simple hair shape: circle top for fun characters
    ctx.fillStyle = '#444';
    ctx.beginPath();
    ctx.ellipse(0, -15, 15, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Animate feet in a little hop motion
    ctx.fillStyle = '#666';
    const footYOffset = 10 + (this.frame === 1 ? -2 : this.frame === 2 ? 2 : 0);
    ctx.beginPath();
    ctx.ellipse(-7, footYOffset, 4, 3, 0, 0, Math.PI * 2);
    ctx.ellipse(7, footYOffset, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class MathChallenge {
  constructor(x, y) {
    this.pos = new Vector2(x, y);
    this.size = 40;
    this.active = false;
    this.problem = '';
    this.answer = 0;
    this.userInput = '';
    this.completed = false;
    this.showMessageDuration = 0;
  }
  generateProblem() {
    const operations = ['+', '-', '*'];
    const op = operations[Math.floor(Math.random()*operations.length)];
    let a, b;
    if (op === '*') {
      a = Math.floor(Math.random() * 10) + 1;
      b = Math.floor(Math.random() * 10) + 1;
    } else {
      a = Math.floor(Math.random() * 20) + 1;
      b = Math.floor(Math.random() * 20) + 1;
    }
    if (op === '-' && b > a) [a,b] = [b,a]; // avoid negative results
    this.problem = `${a} ${op} ${b}`;
    this.answer = eval(this.problem);
    this.userInput = '';
  }
  start() {
    if (!this.completed) {
      this.active = true;
      this.generateProblem();
    }
  }
  submitAnswer() {
    if (parseInt(this.userInput) === this.answer) {
      this.completed = true;
      this.active = false;
      this.showMessageDuration = 180; // 3 seconds message
      return true;
    } 
    this.userInput = '';
    return false;
  }
  draw(ctx, screenPos) {
    ctx.save();
    ctx.translate(screenPos.x, screenPos.y);
    ctx.fillStyle = this.completed ? '#78C850' : '#F08030'; // Green if done else orange
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.size/2, this.size/2, this.size/2, 0, Math.PI*2);
    ctx.fill();
    ctx.stroke();

    // Draw question mark or done checkmark
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.completed) {
      ctx.fillText('✓', this.size / 2, this.size / 2);
    } else {
      ctx.fillText('?', this.size / 2, this.size / 2);
    }
    ctx.restore();
  }
}

class World {
  constructor() {
    this.width = 2000;
    this.height = 1200;
    this.tileSize = 60;
    this.cols = Math.floor(this.width / this.tileSize);
    this.rows = Math.floor(this.height / this.tileSize);
    this.grassColor = '#7BC95F';
    this.pathColor = '#C2B280';
    this.mapData = [];
    this.generateMap();
  }
  generateMap() {
    // Simple grass map, add paths in a grid form for easy navigation
    this.mapData = [];
    for(let r=0; r<this.rows; r++) {
      let row = [];
      for(let c=0; c<this.cols; c++) {
        if (r % 5 === 2 || c % 8 === 4) {
          row.push('path');
        } else {
          row.push('grass');
        }
      }
      this.mapData.push(row);
    }
  }
  draw(ctx, cam) {
    const startCol = Math.floor(cam.position.x / this.tileSize);
    const startRow = Math.floor(cam.position.y / this.tileSize);
    const endCol = Math.min(this.cols, startCol + Math.ceil(canvas.width / this.tileSize) + 1);
    const endRow = Math.min(this.rows, startRow + Math.ceil(canvas.height / this.tileSize) + 1);

    for(let r = startRow; r < endRow; r++) {
      for(let c = startCol; c < endCol; c++) {
        let screenX = c * this.tileSize - cam.position.x;
        let screenY = r * this.tileSize - cam.position.y;
        if (this.mapData[r] && this.mapData[r][c] === 'path') {
          ctx.fillStyle = this.pathColor;
        } else {
          ctx.fillStyle = this.grassColor;
        }
        ctx.fillRect(screenX, screenY, this.tileSize, this.tileSize);
        // Draw subtle shading for grass tiles
        if(this.mapData[r][c] === 'grass') {
          ctx.strokeStyle = '#609D3C';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(screenX, screenY);
          ctx.lineTo(screenX+this.tileSize, screenY+this.tileSize);
          ctx.stroke();
        }
      }
    }
  }
}

class DialogueBox {
  constructor() {
    this.visible = false;
    this.text = '';
    this.width = 600;
    this.height = 120;
    this.x = (canvas.width - this.width) / 2;
    this.y = canvas.height - this.height - 20;
  }
  show(text) {
    this.text = text;
    this.visible = true;
  }
  hide() {
    this.visible = false;
  }
  draw(ctx) {
    if (!this.visible) return;
    ctx.save();
    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 2;
    ctx.fillRect(this.x, this.y, this.width, this.height);
    ctx.strokeRect(this.x, this.y, this.width, this.height);
    // Text
    ctx.fillStyle = '#FFF';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Wrap text
    const words = this.text.split(' ');
    let line = '';
    const lineHeight = 22;
    let lines = [];
    for(let i=0; i<words.length; i++){
      let testLine = line + words[i] + ' ';
      let metrics = ctx.measureText(testLine);
      if(metrics.width > this.width - 40 && i > 0){
        lines.push(line);
        line = words[i] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);

    for(let j=0; j<lines.length; j++){
      ctx.fillText(lines[j], this.x+20, this.y+20+j*lineHeight);
    }
    ctx.restore();
  }
}

class Game {
  constructor() {
    this.world = new World();
    this.player = new Player(100, 100);
    this.camera = new Camera(0, 0);
    this.keys = {};
    this.npcs = [];
    this.mathChallenges = [];
    this.dialogueBox = new DialogueBox();
    this.inDialogue = false;
    this.currentDialogueNPC = null;
    this.messageTimer = 0;
    this.messageText = '';

    // Add npcs with math teaching roles
    this.npcs.push(new NPC(400, 500, 'Eli the Explorer', '#D86464', this.npcDialogueEli.bind(this)));
    this.npcs.push(new NPC(1200, 300, 'Mira the Mathematician', '#5882FA', this.npcDialogueMira.bind(this)));
    this.npcs.push(new NPC(700, 900, 'Filo the Farmer', '#B4A654', this.npcDialogueFilo.bind(this)));

    // Place math challenges near npcs and scattered
    this.mathChallenges.push(new MathChallenge(430, 540));
    this.mathChallenges.push(new MathChallenge(1180, 350));
    this.mathChallenges.push(new MathChallenge(720, 930));
    this.mathChallenges.push(new MathChallenge(1600, 1050));
    this.mathChallenges.push(new MathChallenge(1700, 300));

    this.setupInput();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  npcDialogueEli() {
    const dialogue = [
      "Hi traveler! Are you ready to explore?",
      "Let's start with an easy challenge nearby.",
      "Solve the math problem to unlock a secret path!",
      "Good luck!"
    ];
    return dialogue;
  }
  npcDialogueMira() {
    const dialogue = [
      "Hello, I'm Mira! Math is the key to all mysteries.",
      "Try your luck with the math challenges around here.",
      "Solve them and I have a special badge for you!",
      "Keep going!"
    ];
    return dialogue;
  }
  npcDialogueFilo() {
    const dialogue = [
      "Howdy! Farming requires good counting and math.",
      "If you solve the math puzzles, I'll give you some seeds.",
      "Come back after solving some problems.",
      "Happy farming!"
    ];
    return dialogue;
  }

  setupInput() {
    window.addEventListener('keydown', (e) => {
      if(e.repeat) return;
      this.keys[e.key] = true;
      if(this.inDialogue){
        if(e.key === 'Enter' || e.key === ' ') {
          this.dialogueNext();
        }
      } else if(e.key === 'Enter') {
        // Check proximity to npcs first
        let nearNpc = this.getNearbyNPC();
        if(nearNpc) {
          this.startDialogue(nearNpc);
        } else {
          // Check proximity to math challenges
          let nearChallenge = this.getNearbyMathChallenge();
          if(nearChallenge && !nearChallenge.completed) {
            nearChallenge.start();
          }
        }
      } else if(this.mathChallengeActive) {
        // For math input
        if(e.key >= '0' && e.key <= '9') {
          this.mathChallengeActive.userInput += e.key;
        }
        if(e.key === 'Backspace') {
          this.mathChallengeActive.userInput = this.mathChallengeActive.userInput.slice(0, -1);
        }
        if(e.key === 'Enter') {
          if(this.mathChallengeActive.userInput.length > 0) {
            const correct = this.mathChallengeActive.submitAnswer();
            if(correct) {
              this.messageText = "Correct! You unlocked a secret!";
              this.messageTimer = 120;
              this.mathChallengeActive = null;
            } else {
              this.messageText = "Oops, try again!";
              this.messageTimer = 120;
            }
          }
        }
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
    });
  }

  startDialogue(npc) {
    this.inDialogue = true;
    this.currentDialogueNPC = npc;
    this.dialogueLines = npc.dialogueFunc();
    this.dialogueIndex = 0;
    this.dialogueBox.show(this.dialogueLines[this.dialogueIndex]);
  }
  dialogueNext() {
    this.dialogueIndex++;
    if(this.dialogueIndex >= this.dialogueLines.length) {
      this.inDialogue = false;
      this.currentDialogueNPC = null;
      this.dialogueBox.hide();
    } else {
      this.dialogueBox.show(this.dialogueLines[this.dialogueIndex]);
    }
  }

  getNearbyNPC() {
    for(let npc of this.npcs) {
      if(this.distance(this.player.pos, npc.pos) < 50) {
        return npc;
      }
    }
    return null;
  }
  getNearbyMathChallenge() {
    for(let challenge of this.mathChallenges) {
      if(this.distance(this.player.pos, challenge.pos) < 50) {
        return challenge;
      }
    }
    return null;
  }

  distance(a, b) {
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    return Math.sqrt(dx*dx + dy*dy);
  }

  update() {
    if(!this.inDialogue && !this.mathChallengeActive) {
      this.player.update(this.keys, this.world);
    }
    // Update NPC animations
    this.npcs.forEach(npc => npc.update());

    // Camera follows player with smooth easing
    const targetX = this.player.pos.x + this.player.size / 2 - canvas.width / 2;
    const targetY = this.player.pos.y + this.player.size / 2 - canvas.height / 2;
    this.camera.position.x += (targetX - this.camera.position.x) * 0.15;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.15;

    // Clamp camera
    this.camera.position.x = Math.max(0, Math.min(this.camera.position.x, this.world.width - canvas.width));
    this.camera.position.y = Math.max(0, Math.min(this.camera.position.y, this.world.height - canvas.height));

    // Update message timer
    if(this.messageTimer > 0) {
      this.messageTimer--;
      if(this.messageTimer === 0) this.messageText = '';
    }

    // Manage math challenges active state
    if(!this.mathChallengeActive) {
      for(let ch of this.mathChallenges){
        if(ch.active){
          this.mathChallengeActive = ch;
          break;
        }
      }
    }
  }

  drawHUD() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(12, 12, 220, 60);
    ctx.fillStyle = '#FFF';
    ctx.font = '18px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Use arrow keys to move', 20, 35);
    ctx.fillText('Press Enter near NPCs or Challenges', 20, 60);
    ctx.restore();

    if(this.mathChallengeActive) {
      let boxX = (canvas.width - 360)/2;
      let boxY = canvas.height - 160;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.fillRect(boxX, boxY, 360, 120);
      ctx.strokeRect(boxX, boxY, 360, 120);
      ctx.fillStyle = '#FFF';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Solve:', boxX + 180, boxY + 35);
      ctx.font = '30px Arial';
      ctx.fillText(this.mathChallengeActive.problem, boxX + 180, boxY + 75);
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(boxX + 90, boxY + 95);
      ctx.lineTo(boxX + 270, boxY + 95);
      ctx.stroke();
      ctx.fillText(this.mathChallengeActive.userInput || '_', boxX + 180, boxY + 110);
      ctx.restore();
    }

    if(this.messageText) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect((canvas.width-400)/2, 30, 400, 40);
      ctx.fillStyle = '#FFD700';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(this.messageText, canvas.width/2, 58);
      ctx.restore();
    }
  }

  render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.world.draw(ctx, this.camera);

    // Draw math challenges
    this.mathChallenges.forEach(mc => {
      const screenPos = mc.pos.sub(this.camera.position);
      mc.draw(ctx, screenPos);
    });

    // Draw NPCs
    this.npcs.forEach(npc => {
      const screenPos = npc.pos.sub(this.camera.position);
      npc.draw(ctx, screenPos);
    });

    // Draw Player
    this.player.draw(ctx, this.player.pos.sub(this.camera.position));

    // Dialogue
    this.dialogueBox.draw(ctx);

    // HUD
    this.drawHUD();
  }

  loop() {
    this.update();
    this.render();
    requestAnimationFrame(this.loop);
  }
}

const game = new Game();