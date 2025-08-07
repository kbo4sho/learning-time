(() => {
  // SETUP AND CONSTANTS
  const WIDTH = 720;
  const HEIGHT = 480;

  // GLOBAL VARIABLES
  let canvas, ctx;
  let audioCtx, gainNode;

  const gameState = {
    explorer: { x: WIDTH / 2, y: HEIGHT / 2, size: 40, speed: 4, bobOffset: 0 },
    fruits: [],
    creatures: [],
    currentBond: null,
    score: 0,
    message: "Use arrow keys to move; Space to select fruit",
    selectedFruitIndex: 0,
    soundOn: true,
    keysPressed: {},
    frame: 0,
    particles: [],
    _bgOsc: null,
    _bgGain: null,
  };

  // COLORS for a calming but wacky forest vibe
  const COLORS = {
    background: "#c7f0db", // Light mint green background
    explorerBody: "#1a5276", // Deep ocean blue for explorer
    explorerHat: "#9b59b6", // Soft purple hat
    explorerBackpack: "#f39c12", // Warm golden backpack
    creaturesBody: ["#6e5773", "#a4d4ae", "#f0e6d2"], // Muted purples and pastel mint+cream
    outline: "#2e2e2e",
    text: "#2e2e2e",
    fruits: ["#ff6f61", "#f7d154", "#6bc5a9", "#9d7fed", "#ef8a92", "#ffcc5c"],
    selectedFruitOutline: "#ffd700",
    hudBg: "rgba(255, 255, 255, 0.9)",
    leavesGreen: "#3c763d",
    pupilHappy: "#4CAF50",
    pupilNormal: "#000000",
    shadow: "rgba(0,0,0,0.1)",
  };

  // SOUND UTILS
  function createAudioContext() {
    try {
      const context = new (window.AudioContext || window.webkitAudioContext)();
      return context;
    } catch (e) {
      return null;
    }
  }

  function playTone(freq, duration, type = "sine", volume = 0.25) {
    if (!audioCtx || !gameState.soundOn) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);

      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      // fail silently
    }
  }

  function playCorrectSound() {
    playTone(880, 0.15, "triangle", 0.25);
    setTimeout(() => playTone(1100, 0.12, "triangle", 0.25), 150);
  }

  function playWrongSound() {
    playTone(220, 0.35, "sawtooth", 0.3);
  }

  function playPickupSound() {
    playTone(660, 0.1, "square", 0.22);
  }

  // Background gentle forest ambient hum: soft low sine tone slowly modulated with subtle vibrato
  function playBackgroundHum() {
    if (!audioCtx || !gameState.soundOn) return;
    if (gameState._bgOsc) return; // already playing

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const vibrato = audioCtx.createOscillator();
      const vibratoGain = audioCtx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(220, audioCtx.currentTime);

      // Vibrato setup:
      vibrato.type = "sine";
      vibrato.frequency.setValueAtTime(0.15, audioCtx.currentTime); // very slow vibrato
      vibratoGain.gain.setValueAtTime(4, audioCtx.currentTime); // mod depth (±4Hz)

      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.03, audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      vibrato.start();

      gameState._bgOsc = osc;
      gameState._bgGain = gain;
      gameState._vibrato = vibrato;
      gameState._vibratoGain = vibratoGain;
    } catch {
      // fail silently
    }
  }

  function stopBackgroundHum() {
    if (gameState._bgOsc) {
      try {
        gameState._bgGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);
        setTimeout(() => {
          if (gameState._bgOsc) {
            gameState._bgOsc.stop();
            gameState._bgOsc.disconnect();
            gameState._bgGain.disconnect();
            if (gameState._vibrato) {
              gameState._vibrato.stop();
              gameState._vibrato.disconnect();
              gameState._vibratoGain.disconnect();
            }
            gameState._bgOsc = null;
            gameState._bgGain = null;
            gameState._vibrato = null;
            gameState._vibratoGain = null;
          }
        }, 1100);
      } catch {
        // fail silently
      }
    }
  }

  // GAME DATA GENERATION / INIT (unchanged)
  function generateNumberBond() {
    const total = 7 + Math.floor(Math.random() * 14); // 7..20
    const part1 = 1 + Math.floor(Math.random() * (total - 1));
    const part2 = total - part1;
    return { total, part1, part2 };
  }

  function createFruit(num, x, y, color) {
    return {
      num,
      x,
      y,
      size: 30,
      color,
      isSelected: false,
      collected: false,
      bobPhase: Math.random() * Math.PI * 2, // for subtle bobbing animation
    };
  }

  function createCreature(x, y) {
    return {
      x,
      y,
      size: 60,
      happy: false,
      currentBond: generateNumberBond(),
      deliveredNums: [],
      shakeOffset: 0,
      shakeDir: 1,
    };
  }

  function initializeGameObjects() {
    gameState.fruits = [];
    for (let n = 1; n <= 15; n++) {
      const fx = 60 + Math.random() * (WIDTH - 120);
      const fy = 60 + Math.random() * (HEIGHT - 140);
      const c = COLORS.fruits[n % COLORS.fruits.length];
      const fruit = createFruit(n, fx, fy, c);
      gameState.fruits.push(fruit);
    }

    gameState.creatures = [
      createCreature(120, 120),
      createCreature(WIDTH - 140, 140),
      createCreature(140, HEIGHT - 120),
      createCreature(WIDTH - 160, HEIGHT - 150),
    ];
  }

  // DRAWING UTILITIES

  // Rounded rectangle with optional fill and stroke
  function drawRoundedRect(ctx, x, y, w, h, r, fillColor, strokeColor) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fill();
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // Draw creature with subtle shaking when unhappy or happy glow with animation
  function drawCreature(ctx, creature) {
    const { x, y, size, happy } = creature;
    ctx.save();

    // Shaking effect on wrong or happy delivery (subtle horizontal wobble)
    let shakeX = 0;
    if (!happy && creature.deliveredNums.length === 2) {
      // shake left-right
      creature.shakeOffset += creature.shakeDir * 0.8;
      if (creature.shakeOffset > 6) creature.shakeDir = -1;
      else if (creature.shakeOffset < -6) creature.shakeDir = 1;
      shakeX = creature.shakeOffset;
    } else {
      // reset shakeOffset gradually
      creature.shakeOffset *= 0.8;
      shakeX = creature.shakeOffset;
    }

    ctx.translate(shakeX, 0);

    // Body: blob shape with gentle wobble, using gradient for depth
    const wobble = 4 * Math.sin(gameState.frame / 15);
    const grad = ctx.createRadialGradient(x, y, size * 0.2, x, y, size + wobble);
    grad.addColorStop(0, happy ? "#b7eb8f" : COLORS.creaturesBody[0]);
    grad.addColorStop(1, happy ? "#4caf50" : COLORS.creaturesBody[1]);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, size + wobble, size * 0.75 + wobble / 2, 0, 0, 2 * Math.PI);
    ctx.shadowColor = COLORS.shadow;
    ctx.shadowBlur = happy ? 16 : 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Face: bright white eyes with animated pupils that track subtle movement
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(x - size / 3, y - size / 6, 14, 18, 0, 0, 2 * Math.PI);
    ctx.ellipse(x + size / 3, y - size / 6, 14, 18, 0, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    // Pupils move with oscillation and if happy glow green
    const pupilOffsetX = 3 * Math.sin(gameState.frame / 10);
    const pupilOffsetY = 2 * Math.cos(gameState.frame / 12);

    ctx.fillStyle = happy ? COLORS.pupilHappy : COLORS.pupilNormal;
    ctx.beginPath();
    ctx.ellipse(x - size / 3 + pupilOffsetX / 2, y - size / 6 + pupilOffsetY / 2, 6, 10, 0, 0, 2 * Math.PI);
    ctx.ellipse(x + size / 3 + pupilOffsetX / 2, y - size / 6 + pupilOffsetY, 6, 10, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Mouth - smiling curve if happy else slight frown with subtle lips color
    ctx.beginPath();
    if (happy) {
      ctx.strokeStyle = "#4caf50";
      ctx.lineWidth = 3;
      ctx.shadowColor = "#a6d785";
      ctx.shadowBlur = 6;
      ctx.arc(x, y + size / 6, size / 3, 0, Math.PI, false); // smile arc
    } else if (creature.deliveredNums.length === 2) {
      ctx.strokeStyle = "#a52a2a";
      ctx.lineWidth = 3;
      ctx.shadowColor = "rgba(0,0,0,0.1)";
      ctx.shadowBlur = 2;
      ctx.moveTo(x - size / 3, y + size / 6 + 4);
      ctx.lineTo(x + size / 3, y + size / 6);
    } else {
      ctx.strokeStyle = COLORS.outline;
      ctx.lineWidth = 2;
      ctx.moveTo(x - size / 3, y + size / 6);
      ctx.lineTo(x + size / 3, y + size / 6);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Bond question text above creature, with soft shadow for readability
    const bond = creature.currentBond;
    if (bond) {
      ctx.font = "bold 20px Comic Sans MS, cursive, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#2e2e2e";
      ctx.shadowColor = "rgba(255,255,255,0.8)";
      ctx.shadowBlur = 3;
      const questionText = `Help me: ? + ? = ${bond.total}`;
      ctx.fillText(questionText, x, y - size - 26);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  // Draw fruit as shiny orb with subtle gentle bobbing and highlight glow
  function drawFruit(ctx, fruit, isSelected = false) {
    const { x, y, size, color, num, collected, bobPhase } = fruit;
    if (collected) return;

    ctx.save();

    // Bobbing effect in y-axis
    const bobYOffset = 3 * Math.sin(gameState.frame / 20 + bobPhase);

    // Shadow for subtle depth below fruit
    ctx.shadowColor = "rgba(0,0,0,0.12)";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, y + size / 1.8 + bobYOffset, size * 0.9, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    ctx.fill();
    ctx.shadowBlur = 0;

    // Fruit body - gradient circle with highlight
    const grad = ctx.createRadialGradient(
      x - size / 3,
      y - size / 3 + bobYOffset,
      size / 2,
      x,
      y + bobYOffset,
      size
    );
    grad.addColorStop(0, lightenColor(color, 0.3));
    grad.addColorStop(1, color);

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y + bobYOffset, size, 0, 2 * Math.PI);
    ctx.fill();

    // Outer stroke subtle and precise
    ctx.strokeStyle = darkenColor(color, 0.4);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Leaves - two elegant arcs on top
    ctx.strokeStyle = COLORS.leavesGreen;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - size / 2 + 2, y - size / 2 + bobYOffset);
    ctx.quadraticCurveTo(x - size / 3 + 4, y - size + bobYOffset + 4, x - size / 6, y - size / 2 + bobYOffset);
    ctx.moveTo(x + size / 2 - 2, y - size / 2 + bobYOffset);
    ctx.quadraticCurveTo(x + size / 3 - 4, y - size + bobYOffset + 5, x + size / 6, y - size / 2 + bobYOffset);
    ctx.stroke();

    // Number on fruit, bold and with subtle shadow for contrast
    ctx.font = `bold ${size}px Comic Sans MS, cursive, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 4;
    ctx.fillText(num, x, y + bobYOffset + 2);
    ctx.shadowBlur = 0;

    // Selection halo
    if (isSelected) {
      const pulse = 2 + 2 * Math.sin(gameState.frame / 10);
      ctx.lineWidth = 5;
      ctx.strokeStyle = `rgba(255, 215, 0, ${0.7 + 0.3 * Math.sin(gameState.frame / 7)})`; // gold with glow pulse
      ctx.beginPath();
      ctx.arc(x, y + bobYOffset, size + pulse, 0, 2 * Math.PI);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw explorer character with smooth bobbing animation and subtle shading
  function drawExplorer(ctx, explorer) {
    const { x, y, size } = explorer;
    ctx.save();

    // Bobbing offset for life
    explorer.bobOffset = 3 * Math.sin(gameState.frame / 18);
    const bobY = y + explorer.bobOffset;

    // Torso: rounded rectangle with darker edges for depth
    drawRoundedRect(ctx, x - size / 2, bobY - size / 2 + 10, size, size * 0.6, 10, COLORS.explorerBody, COLORS.outline);

    // Head circle with multi-tone shading for face shading
    const faceGradient = ctx.createRadialGradient(x, bobY - size / 3, size / 4, x, bobY - size / 4, size / 1.5);
    faceGradient.addColorStop(0, "#fce4c6");
    faceGradient.addColorStop(1, "#d9b382");

    ctx.beginPath();
    ctx.fillStyle = faceGradient;
    ctx.arc(x, bobY - size / 3, size / 2.5, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Eyes: bright and shiny
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(x - size / 8, bobY - size / 3, size / 20, 0, 2 * Math.PI);
    ctx.arc(x + size / 8, bobY - size / 3, size / 20, 0, 2 * Math.PI);
    ctx.fill();

    // Mouth: friendly curved arc with warmth color
    ctx.beginPath();
    ctx.strokeStyle = "#6a3d00";
    ctx.lineWidth = 2;
    ctx.arc(x, bobY - size / 4, size / 10, 0, Math.PI, false);
    ctx.stroke();

    // Backpack: rounded rectangle behind torso with gradient shading
    const backpackGradient = ctx.createLinearGradient(x - size / 2 - 8, bobY - size / 2 + 15, x + 10, bobY + size / 2);
    backpackGradient.addColorStop(0, "#f7b733");
    backpackGradient.addColorStop(1, "#ed4a0c");

    drawRoundedRect(ctx, x - size / 2 - 8, bobY - size / 2 + 15, 18, size * 0.7, 5, backpackGradient, COLORS.outline);

    // Hat: smooth filled triangle with soft shadow
    ctx.beginPath();
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 4;
    ctx.fillStyle = COLORS.explorerHat;
    ctx.moveTo(x - size / 2, bobY - size / 2.8);
    ctx.lineTo(x + size / 2, bobY - size / 2.8);
    ctx.lineTo(x, bobY - size);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLORS.outline;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  // HUD Overlay with translucent panel, smooth rounded rect, enhanced text and icons
  function drawHUD(ctx) {
    ctx.save();

    // Panel background with rounded corners on top
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 7;
    drawRoundedRect(ctx, 4, HEIGHT - 64, WIDTH - 8, 60, 10, COLORS.hudBg, COLORS.outline);
    ctx.shadowBlur = 0;

    // Score display
    ctx.fillStyle = COLORS.text;
    ctx.font = "22px Comic Sans MS, cursive, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`Score: ${gameState.score}`, 25, HEIGHT - 34);

    // Message center aligned with subtle shadow for reading ease
    ctx.textAlign = "center";
    ctx.font = "18px Comic Sans MS, cursive, sans-serif";
    ctx.fillStyle = COLORS.text;
    ctx.shadowColor = "rgba(255,255,255,0.9)";
    ctx.shadowBlur = 2;
    ctx.fillText(gameState.message, WIDTH / 2, HEIGHT - 34);
    ctx.shadowBlur = 0;

    // Sound toggle indicator with smooth icon drawing
    ctx.textAlign = "right";
    ctx.font = "22px Comic Sans MS, cursive, sans-serif";
    ctx.fillStyle = COLORS.text;

    // Draw simple speaker icon using canvas for clearer, crisp visuals
    const iconX = WIDTH - 70;
    const iconY = HEIGHT - 42;
    const iconSize = 20;

    // Speaker base
    ctx.lineWidth = 2;
    ctx.strokeStyle = COLORS.text;
    ctx.fillStyle = COLORS.text;
    ctx.beginPath();
    ctx.moveTo(iconX - 6, iconY - 6);
    ctx.lineTo(iconX, iconY - 10);
    ctx.lineTo(iconX, iconY + 10);
    ctx.lineTo(iconX - 6, iconY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw sound waves if soundOn
    if (gameState.soundOn) {
      ctx.beginPath();
      ctx.arc(iconX + 3, iconY, 6, -Math.PI / 4, Math.PI / 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(iconX + 7, iconY, 10, -Math.PI / 6, Math.PI / 6);
      ctx.stroke();
    } else {
      // Draw mute cross over speaker
      ctx.strokeStyle = "red";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(iconX - 10, iconY - 10);
      ctx.lineTo(iconX + 15, iconY + 10);
      ctx.moveTo(iconX - 10, iconY + 10);
      ctx.lineTo(iconX + 15, iconY - 10);
      ctx.stroke();
      ctx.lineWidth = 2;
    }

    // Text label for sound toggle
    ctx.fillStyle = COLORS.text;
    ctx.font = "18px Comic Sans MS, cursive, sans-serif";
    ctx.fillText(gameState.soundOn ? "Sound On (S)" : "Sound Off (S)", WIDTH - 15, HEIGHT - 30);

    ctx.restore();
  }

  // Clear entire canvas with gradient sky and subtle forest floor
  function clearCanvas() {
    const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    gradient.addColorStop(0, "#b7e4c7");
    gradient.addColorStop(0.85, COLORS.background);
    gradient.addColorStop(1, "#5a8c52");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Draw subtle grass texture near bottom
    ctx.save();
    ctx.fillStyle = "#4d7c3c";
    for (let i = 0; i < WIDTH; i += 12) {
      const h = 12 + (Math.sin(i / 10 + gameState.frame / 20) * 3);
      ctx.beginPath();
      ctx.moveTo(i, HEIGHT);
      ctx.lineTo(i + 6, HEIGHT - h);
      ctx.lineTo(i + 12, HEIGHT);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  // Helper to lighten color hex by fraction (0 to 1)
  function lightenColor(color, amount) {
    let col = color.startsWith("#") ? color.slice(1) : color;
    let num = parseInt(col, 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.min(255, r + 255 * amount);
    g = Math.min(255, g + 255 * amount);
    b = Math.min(255, b + 255 * amount);
    return `rgb(${r},${g},${b})`;
  }

  // Helper to darken color hex by fraction (0 to 1)
  function darkenColor(color, amount) {
    let col = color.startsWith("#") ? color.slice(1) : color;
    let num = parseInt(col, 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.max(0, r - 255 * amount);
    g = Math.max(0, g - 255 * amount);
    b = Math.max(0, b - 255 * amount);
    return `rgb(${r},${g},${b})`;
  }

  // LOGIC HELPERS (unchanged)
  function distSq(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return dx * dx + dy * dy;
  }

  function checkExplorerFruitCollision() {
    const ex = gameState.explorer.x;
    const ey = gameState.explorer.y;
    const fruit = gameState.fruits[gameState.selectedFruitIndex];
    if (!fruit || fruit.collected) return null;
    const ds = distSq(ex, ey, fruit.x, fruit.y);
    if (ds < (gameState.explorer.size / 2 + fruit.size) ** 2) {
      return fruit;
    }
    return null;
  }

  function getNearbyCreature() {
    const ex = gameState.explorer.x;
    const ey = gameState.explorer.y;
    for (const creature of gameState.creatures) {
      const ds = distSq(ex, ey, creature.x, creature.y);
      if (ds < (gameState.explorer.size / 2 + creature.size) ** 2) {
        return creature;
      }
    }
    return null;
  }

  function checkDelivery(creature) {
    const nums = creature.deliveredNums;
    const total = creature.currentBond.total;
    if (nums.length < 2) return 0;
    const sum = nums.reduce((a, b) => a + b, 0);
    if (sum === total) return 1;
    return 2;
  }

  function processDelivery(fruit, creature) {
    if (!fruit || !creature) {
      gameState.message = "Move close to a creature to deliver fruit";
      playWrongSound();
      return;
    }

    if (fruit.collected) {
      gameState.message = "That fruit is already used!";
      playWrongSound();
      return;
    }

    creature.deliveredNums.push(fruit.num);
    fruit.collected = true;

    const result = checkDelivery(creature);

    if (result === 0) {
      gameState.message = `Delivered ${fruit.num}. One more fruit to go!`;
      playTone(700, 0.12, "triangle");
      playPickupSound();
    } else if (result === 1) {
      gameState.score += 5;
      creature.happy = true;
      gameState.message = "Yay! The creature is happy and thanks you!";
      playCorrectSound();

      // Flash gentle green glow with particle bursts at creature location
      createHappyParticles(creature.x, creature.y, creature.size);
      setTimeout(() => {
        creature.happy = false;
        creature.currentBond = generateNumberBond();
        creature.deliveredNums = [];
      }, 4000);
    } else {
      gameState.score = Math.max(0, gameState.score - 3);
      gameState.message = `Oops! The sum doesn't match ${creature.currentBond.total}. Try again!`;
      playWrongSound();

      // Create subtle red shake effect on creature
      creature.shakeOffset = 1;
      creature.shakeDir = 1;

      creature.deliveredNums = [];
      // Reset all fruits rejected in delivery
      gameState.fruits.forEach(f => (f.collected = false));
    }
  }

  // PARTICLES EFFECT for successful delivery (gentle floating circles)
  function createHappyParticles(x, y, radius) {
    for (let i = 0; i < 12; i++) {
      gameState.particles.push({
        x: x + (Math.random() - 0.5) * radius,
        y: y + (Math.random() - 0.5) * radius,
        radius: 4 + Math.random() * 3,
        alpha: 1,
        speedX: (Math.random() - 0.5) * 1.5,
        speedY: -1 - Math.random() * 1.5,
        color: "rgba(75, 175, 80, 0.9)",
      });
    }
  }

  // Draw floating particles
  function drawParticles(ctx) {
    if (gameState.particles.length === 0) return;
    ctx.save();
    gameState.particles.forEach((p, i) => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.alpha -= 0.015;
      if (p.alpha <= 0) {
        gameState.particles.splice(i, 1);
        return;
      }
      ctx.beginPath();
      ctx.fillStyle = `rgba(75, 175, 80, ${p.alpha.toFixed(2)})`;
      ctx.shadowColor = "rgba(75, 175, 80, 0.6)";
      ctx.shadowBlur = 6;
      ctx.arc(p.x, p.y, p.radius * p.alpha, 0, 2 * Math.PI);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.restore();
  }

  // PLAYER MOVEMENT AND CONTROLS (unchanged)
  function updateExplorerPosition() {
    const s = gameState.explorer.speed;
    if (gameState.keysPressed["ArrowUp"]) {
      gameState.explorer.y = Math.max(gameState.explorer.size / 2, gameState.explorer.y - s);
    }
    if (gameState.keysPressed["ArrowDown"]) {
      gameState.explorer.y = Math.min(HEIGHT - gameState.explorer.size / 2, gameState.explorer.y + s);
    }
    if (gameState.keysPressed["ArrowLeft"]) {
      gameState.explorer.x = Math.max(gameState.explorer.size / 2, gameState.explorer.x - s);
    }
    if (gameState.keysPressed["ArrowRight"]) {
      gameState.explorer.x = Math.min(WIDTH - gameState.explorer.size / 2, gameState.explorer.x + s);
    }
  }

  function cycleSelectedFruit(forward = true) {
    if (forward) {
      gameState.selectedFruitIndex++;
      if (gameState.selectedFruitIndex >= gameState.fruits.length) {
        gameState.selectedFruitIndex = 0;
      }
    } else {
      gameState.selectedFruitIndex--;
      if (gameState.selectedFruitIndex < 0) {
        gameState.selectedFruitIndex = gameState.fruits.length - 1;
      }
    }
    playTone(440, 0.08, "square");
    gameState.message = `Selected fruit ${gameState.fruits[gameState.selectedFruitIndex].num}`;
  }

  // EVENT HANDLERS
  function onKeyDown(e) {
    if (e.repeat) return;

    switch (e.code) {
      case "ArrowUp":
      case "ArrowDown":
      case "ArrowLeft":
      case "ArrowRight":
        gameState.keysPressed[e.code] = true;
        break;
      case "Space":
      case "Enter":
        e.preventDefault();
        // Play audio context if suspended due to browser autoplay policies
        if (!audioCtx) {
          try {
            audioCtx = createAudioContext();
            if (audioCtx) playBackgroundHum();
          } catch {}
        } else if (audioCtx.state === "suspended") {
          audioCtx.resume();
        }

        const fruit = gameState.fruits[gameState.selectedFruitIndex];
        const explorer = gameState.explorer;

        if (!fruit.collected && distSq(explorer.x, explorer.y, fruit.x, fruit.y) < (explorer.size / 2 + fruit.size) ** 2) {
          const creature = getNearbyCreature();
          if (creature) {
            processDelivery(fruit, creature);
          } else {
            gameState.message = "Move close to a creature to deliver fruit";
            playWrongSound();
          }
        } else {
          gameState.message = "Move closer to the selected fruit first";
          playWrongSound();
        }
        break;
      case "KeyQ":
        cycleSelectedFruit(false);
        break;
      case "KeyE":
        cycleSelectedFruit(true);
        break;
      case "KeyS":
        gameState.soundOn = !gameState.soundOn;
        if (gameState.soundOn) {
          if (audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume();
          }
          playBackgroundHum();
          gameState.message = "Sound turned ON";
        } else {
          stopBackgroundHum();
          gameState.message = "Sound turned OFF";
        }
        break;
    }
  }

  function onKeyUp(e) {
    if (e.repeat) return;
    if (
      e.code === "ArrowUp" ||
      e.code === "ArrowDown" ||
      e.code === "ArrowLeft" ||
      e.code === "ArrowRight"
    ) {
      delete gameState.keysPressed[e.code];
    }
  }

  // GAME LOOP
  function update() {
    updateExplorerPosition();
    // Update particles movement in draw
  }

  // DRAW ALL GAME ELEMENTS
  function draw() {
    clearCanvas();

    // Draw creatures first (in background layer)
    gameState.creatures.forEach((creature) => {
      drawCreature(ctx, creature);
    });

    // Draw fruits, highlight selected
    gameState.fruits.forEach((fruit, i) => {
      drawFruit(ctx, fruit, i === gameState.selectedFruitIndex && !fruit.collected);
    });

    // Draw explorer
    drawExplorer(ctx, gameState.explorer);

    // Draw particle effects on successful delivery
    drawParticles(ctx);

    // HUD overlay
    drawHUD(ctx);
  }

  // MAIN ANIMATION FRAME
  function gameLoop() {
    gameState.frame++;
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }

  // INITIALIZE
  function init() {
    try {
      const container = document.getElementById("game-of-the-day-stage");
      if (!container) {
        console.error("Error: Container element with id 'game-of-the-day-stage' not found.");
        return;
      }
      container.tabIndex = 0; // Make focusable for keyboard controls
      container.style.outline = "none";

      canvas = document.createElement("canvas");
      canvas.width = WIDTH;
      canvas.height = HEIGHT;
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", "Open World Math Exploration Game. Use arrow keys to move, space to interact.");
      container.innerHTML = "";
      container.appendChild(canvas);

      ctx = canvas.getContext("2d");
      ctx.font = "20px Comic Sans MS, cursive, sans-serif";

      audioCtx = createAudioContext();
      if (!audioCtx) {
        gameState.message = "Audio not supported in this browser.";
      } else {
        gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
        playBackgroundHum();
      }

      initializeGameObjects();

      container.focus();

      container.addEventListener("keydown", onKeyDown);
      container.addEventListener("keyup", onKeyUp);
      container.addEventListener("blur", () => {
        gameState.keysPressed = {};
      });

      gameState.message = "Welcome! Use arrow keys to move, Q/E to select fruit, Space to deliver fruit.";
      gameLoop();
    } catch (err) {
      console.error("Initialization error:", err);
      alert("Failed to initialize the game. Your browser might not support required features.");
    }
  }

  window.addEventListener("load", init);
})();