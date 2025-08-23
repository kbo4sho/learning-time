(function () {
  // Enhanced visuals & audio for Electricity Math Game
  // Renders inside element with id "game-of-the-day-stage"
  // Canvas 720x480, all visuals drawn with canvas, sounds generated with Web Audio API
  // Only visuals/audio were improved; game mechanics and math logic remain unchanged.

  const WIDTH = 720;
  const HEIGHT = 480;
  const container = document.getElementById('game-of-the-day-stage');
  if (!container) {
    console.error('Game container #game-of-the-day-stage not found.');
    return;
  }

  // Prepare container
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.userSelect = 'none';

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.setAttribute('role', 'application');
  canvas.setAttribute(
    'aria-label',
    'Electric addition game. Use left and right arrow keys to move Spark and catch the correct falling number to power the bulb. Press S to toggle sound.'
  );
  canvas.style.width = WIDTH + 'px';
  canvas.style.height = HEIGHT + 'px';
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  canvas.style.outline = 'none';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });

  // ---------- AUDIO SETUP ----------
  let audioCtx = null;
  let masterGain = null;
  let bgPad = null; // container for pad oscillators and nodes
  let soundEnabled = false;
  let audioAllowed = false;
  let audioError = null;

  // Store a reference to background nodes so we can gracefully start/stop
  function createBackgroundPad() {
    // returns an object with stop() and start() controls
    try {
      const pad = {};
      const now = audioCtx.currentTime;

      // Create a low volume pad comprised of two detuned oscillators into a mellow lowpass
      const oscA = audioCtx.createOscillator();
      const oscB = audioCtx.createOscillator();
      const padGain = audioCtx.createGain();
      const padFilter = audioCtx.createBiquadFilter();
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();

      oscA.type = 'sine';
      oscB.type = 'triangle';
      oscA.frequency.value = 110; // base tone
      oscB.frequency.value = 110 * 1.01; // slight detune
      padGain.gain.value = 0.02;
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 600;
      padFilter.Q.value = 0.6;

      lfo.type = 'sine';
      lfo.frequency.value = 0.07; // slow
      lfoGain.gain.value = 50; // modulate filter by ~±50Hz

      lfo.connect(lfoGain);
      lfoGain.connect(padFilter.frequency);

      oscA.connect(padFilter);
      oscB.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(masterGain);

      oscA.start();
      oscB.start();
      lfo.start();

      pad.oscA = oscA;
      pad.oscB = oscB;
      pad.padGain = padGain;
      pad.padFilter = padFilter;
      pad.lfo = lfo;
      pad.lfoGain = lfoGain;

      pad.setVolume = (v, ramp = 0.02) => {
        try {
          padGain.gain.cancelScheduledValues(audioCtx.currentTime);
          padGain.gain.linearRampToValueAtTime(v, audioCtx.currentTime + ramp);
        } catch (err) {}
      };

      pad.stop = () => {
        try {
          pad.setVolume(0.0001, 0.12);
          // stop oscillators after fade
          setTimeout(() => {
            try {
              pad.oscA.stop();
              pad.oscB.stop();
              pad.lfo.stop();
            } catch (e) {}
          }, 220);
        } catch (err) {}
      };

      pad.start = (targetVolume = 0.02) => {
        try {
          // If stopped, create new oscillators (recreate nodes) — defensive
          // Here we assume pad nodes are running.
          pad.setVolume(targetVolume, 0.6);
        } catch (err) {}
      };

      return pad;
    } catch (err) {
      console.warn('createBackgroundPad error', err);
      return null;
    }
  }

  function initAudio() {
    if (audioCtx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        throw new Error('Web Audio API not supported.');
      }
      audioCtx = new AC();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.0; // start muted until explicit enable
      masterGain.connect(audioCtx.destination);

      // Create a gentle bell-like ping (not started, used only on demand in functions)
      // Create background pad
      bgPad = createBackgroundPad();
      audioAllowed = true;
      // Do not automatically enable sound until user toggles or interacts
      soundEnabled = false;
      audioError = null;
    } catch (err) {
      console.warn('Audio initialization failed:', err);
      audioError = err;
      audioCtx = null;
      soundEnabled = false;
      audioAllowed = false;
    }
  }

  // Smoothly set master gain depending on soundEnabled flag
  function setMasterGainEnabled(enabled) {
    if (!audioAllowed || !audioCtx || !masterGain) return;
    try {
      const now = audioCtx.currentTime;
      if (enabled) {
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.linearRampToValueAtTime(0.18, now + 0.35);
        if (bgPad) bgPad.start(0.02);
      } else {
        masterGain.gain.cancelScheduledValues(now);
        masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
        if (bgPad) bgPad.stop();
      }
    } catch (err) {
      console.warn('setMasterGainEnabled error', err);
    }
  }

  // Play short bell/pleasant sound for correct answer
  function playCorrect() {
    if (!audioAllowed || !soundEnabled) return;
    try {
      const now = audioCtx.currentTime;
      // Create two partials for a warm bell
      const o1 = audioCtx.createOscillator();
      const o2 = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const bq = audioCtx.createBiquadFilter();

      o1.type = 'sine';
      o2.type = 'triangle';
      // Slight harmonic interval
      o1.frequency.setValueAtTime(720, now);
      o2.frequency.setValueAtTime(960, now);

      bq.type = 'highpass';
      bq.frequency.value = 300;

      g.gain.value = 0.0001;
      // Envelope
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.46);

      // Gentle pitch glide to add character
      o1.frequency.exponentialRampToValueAtTime(1100, now + 0.16);
      o2.frequency.exponentialRampToValueAtTime(1300, now + 0.18);

      o1.connect(bq);
      o2.connect(bq);
      bq.connect(g);
      g.connect(masterGain);

      o1.start(now);
      o2.start(now);
      o1.stop(now + 0.5);
      o2.stop(now + 0.5);
    } catch (err) {
      console.warn('playCorrect error', err);
    }
  }

  // Play a gentle low thud for incorrect
  function playIncorrect() {
    if (!audioAllowed || !soundEnabled) return;
    try {
      const now = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const f = audioCtx.createBiquadFilter();

      o.type = 'sine';
      o.frequency.setValueAtTime(160, now);
      // quick downward sweep
      o.frequency.exponentialRampToValueAtTime(80, now + 0.22);

      f.type = 'lowpass';
      f.frequency.value = 400;

      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

      o.connect(f);
      f.connect(g);
      g.connect(masterGain);

      o.start(now);
      o.stop(now + 0.34);
    } catch (err) {
      console.warn('playIncorrect error', err);
    }
  }

  // Play a quick zap for bulb flash
  function playZap() {
    if (!audioAllowed || !soundEnabled) return;
    try {
      const now = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const hp = audioCtx.createBiquadFilter();

      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1400, now);
      o.frequency.exponentialRampToValueAtTime(420, now + 0.09);

      hp.type = 'highpass';
      hp.frequency.value = 500;

      g.gain.value = 0.001;
      g.gain.exponentialRampToValueAtTime(0.12, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      o.connect(hp);
      hp.connect(g);
      g.connect(masterGain);

      o.start(now);
      o.stop(now + 0.14);
    } catch (err) {
      console.warn('playZap error', err);
    }
  }

  // ---------- GAME STATE (unchanged mechanics) ----------
  const player = {
    x: WIDTH / 2,
    y: HEIGHT - 90,
    w: 60,
    h: 50,
    vx: 0,
    speed: 3.8,
    color: '#FF7BAC',
    bob: 0,
    name: 'Spark the Squirrel'
  };

  let problemsSolved = 0;
  let score = 0;
  let lives = 3;
  let level = 1;
  let timeElapsed = 0;
  let lastSpawn = 0;
  let spawnInterval = 1400; // ms
  let electrons = []; // falling numbers
  let particles = []; // visual sparks

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  let currentProblem = generateProblem(level);

  function generateProblem(lvl) {
    const op = Math.random() < 0.6 ? '+' : '-';
    const max = Math.min(20 + lvl * 3, 40);
    let a = randomInt(1, Math.max(1, Math.floor(max * 0.6)));
    let b = randomInt(1, Math.max(1, Math.floor(max * 0.6)));
    if (op === '-' && a < b) [a, b] = [b, a];
    const solution = op === '+' ? a + b : a - b;
    return { a, b, op, solution };
  }

  function spawnElectron() {
    const variantCount = Math.min(5 + level, 8);
    const correctIndex = randomInt(0, variantCount - 1);
    const startX = 60;
    const endX = WIDTH - 60;
    for (let i = 0; i < variantCount; i++) {
      const x = startX + ((endX - startX) * i) / (variantCount - 1);
      const jitter = randomInt(-30, 30);
      const value =
        i === correctIndex
          ? currentProblem.solution
          : currentProblem.solution + randomInt(-6 - level, 6 + level);
      const radiusBase = 24 + (Math.random() * 8 - 4);
      const e = {
        id: Math.random().toString(36).slice(2),
        x: Math.max(32, Math.min(WIDTH - 32, x + jitter)),
        y: -randomInt(10, 90),
        vy: 1.1 + Math.random() * 0.6 + level * 0.12,
        value,
        radius: radiusBase,
        wobble: Math.random() * Math.PI * 2,
        color: value === currentProblem.solution ? '#6EE7B7' : '#FFD19A',
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.02,
        prevY: null // for subtle trail
      };
      electrons.push(e);
    }
  }

  // ---------- INPUT / CONTROLS ----------
  const keys = {};
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.key] = true;
    if (
      !audioAllowed &&
      (e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === ' ' ||
        e.key.toLowerCase() === 's')
    ) {
      try {
        initAudio();
      } catch (err) {}
    }
    if (e.key.toLowerCase() === 's') {
      if (!audioAllowed) {
        initAudio();
        audioAllowed && (soundEnabled = true);
      } else {
        soundEnabled = !soundEnabled;
      }
      setMasterGainEnabled(soundEnabled);
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
  });

  // Mouse / touch: tap left/right
  canvas.addEventListener('mousedown', (e) => {
    const r = canvas.getBoundingClientRect();
    const cx = e.clientX - r.left;
    if (!audioAllowed) initAudio();
    if (cx < WIDTH / 2) {
      keys.ArrowLeft = true;
      setTimeout(() => (keys.ArrowLeft = false), 180);
    } else {
      keys.ArrowRight = true;
      setTimeout(() => (keys.ArrowRight = false), 180);
    }
  });
  canvas.addEventListener(
    'touchstart',
    (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const r = canvas.getBoundingClientRect();
      const cx = touch.clientX - r.left;
      if (!audioAllowed) initAudio();
      if (cx < WIDTH / 2) {
        keys.ArrowLeft = true;
        setTimeout(() => (keys.ArrowLeft = false), 180);
      } else {
        keys.ArrowRight = true;
        setTimeout(() => (keys.ArrowRight = false), 180);
      }
    },
    { passive: false }
  );

  // ---------- COLLISIONS & PARTICLES (same logic) ----------
  function checkCollisions() {
    for (let i = electrons.length - 1; i >= 0; i--) {
      const e = electrons[i];
      const dx = e.x - player.x;
      const dy = e.y - player.y + 6;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < e.radius + 16) {
        if (e.value === currentProblem.solution) {
          score += 10;
          problemsSolved += 1;
          spawnParticles(e.x, e.y, '#6EE7B7', 12);
          playCorrect();
          flashBulb();
          if (problemsSolved % 3 === 0) {
            level += 1;
            spawnInterval = Math.max(650, spawnInterval - 120);
          }
          setTimeout(() => {
            currentProblem = generateProblem(level);
          }, 220);
        } else {
          lives -= 1;
          spawnParticles(e.x, e.y, '#FF6B6B', 10);
          playIncorrect();
          player.vx = dx > 0 ? -2.5 : 2.5;
          if (lives <= 0) {
            gameOver();
          }
        }
        electrons.splice(i, 1);
      }
    }
  }

  function spawnParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.9) * 3,
        life: 30 + Math.random() * 30,
        color,
        size: Math.random() * 4 + 2,
        glow: Math.random() * 0.8 + 0.2
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.life -= 1;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  let bulbFlash = 0;
  function flashBulb() {
    bulbFlash = 28;
    if (audioAllowed && soundEnabled) playZap();
  }

  let isGameOver = false;
  function gameOver() {
    isGameOver = true;
    if (bgPad && audioAllowed) {
      try {
        bgPad.setVolume(0.0001, 1.2);
      } catch (err) {}
    }
    if (audioAllowed && masterGain) {
      try {
        masterGain.gain.exponentialRampToValueAtTime(0.02, audioCtx.currentTime + 1.0);
      } catch (err) {}
    }
  }

  function restartGame() {
    problemsSolved = 0;
    score = 0;
    lives = 3;
    level = 1;
    timeElapsed = 0;
    lastSpawn = 0;
    spawnInterval = 1400;
    electrons = [];
    particles = [];
    currentProblem = generateProblem(level);
    isGameOver = false;
    if (audioAllowed && masterGain) {
      try {
        masterGain.gain.setValueAtTime(soundEnabled ? 0.18 : 0.0001, audioCtx.currentTime);
      } catch (err) {}
    }
  }

  // ---------- VISUALS (improvements) ----------

  // Background parallax layers for calmer depth
  function drawBackground() {
    // sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    sky.addColorStop(0, '#EAF6FF');
    sky.addColorStop(0.45, '#F6FBFF');
    sky.addColorStop(1, '#FFFDF7');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // soft distant circuitry / faint lines for theme
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#2B6BFF';
    ctx.lineWidth = 1.4;
    for (let i = 0; i < 7; i++) {
      ctx.beginPath();
      const offset = (i / 7) * WIDTH + (Math.sin(timeElapsed * 0.0008 + i) + 1) * 18;
      for (let x = offset - 100; x < offset + WIDTH + 100; x += 30) {
        const y = 40 + i * 22 + Math.sin(x * 0.01 + timeElapsed * 0.001 * (i + 1)) * 10;
        ctx.lineTo((x - offset + WIDTH) % WIDTH, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // rolling hills
    ctx.save();
    const hill1 = ctx.createLinearGradient(0, HEIGHT * 0.6, 0, HEIGHT);
    hill1.addColorStop(0, '#D7FFEE');
    hill1.addColorStop(1, '#CFFFEA');
    ctx.fillStyle = hill1;
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 8) {
      const y = HEIGHT * 0.62 + Math.sin(x * 0.01 + timeElapsed * 0.002) * 22;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();

    // second layer of hills
    ctx.fillStyle = '#EAFDF8';
    ctx.beginPath();
    ctx.moveTo(0, HEIGHT);
    for (let x = 0; x <= WIDTH; x += 12) {
      const y = HEIGHT * 0.68 + Math.cos(x * 0.007 + timeElapsed * 0.0017) * 14;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(WIDTH, HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // soft atmospheric floating orbs (light)
    ctx.save();
    for (let i = 0; i < 5; i++) {
      const cx = 80 + i * 140 + Math.sin(timeElapsed * 0.0012 + i) * 24;
      const cy = 50 + Math.cos(timeElapsed * 0.0009 + i) * 12;
      const r = 36 + (i % 2 ? 10 : 0);
      const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, r);
      g.addColorStop(0, `rgba(255,243,200,${0.08 + i * 0.01})`);
      g.addColorStop(1, 'rgba(255,243,200,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWire() {
    ctx.save();
    // metallic wire with subtle specular
    const y = HEIGHT - 120;
    ctx.lineWidth = 10;
    const grad = ctx.createLinearGradient(0, y - 20, WIDTH, y + 20);
    grad.addColorStop(0, '#333240');
    grad.addColorStop(0.5, '#51506a');
    grad.addColorStop(1, '#333240');
    ctx.strokeStyle = grad;
    ctx.beginPath();
    for (let x = -4; x <= WIDTH + 4; x += 6) {
      const yy = y + Math.sin((x + timeElapsed * 0.24) * 0.03) * 6;
      if (x === -4) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    // thin highlight
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    for (let x = -4; x <= WIDTH + 4; x += 6) {
      const yy = y + Math.sin((x + timeElapsed * 0.26) * 0.03) * 6 - 3;
      if (x === -4) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();

    // tiny pulsing nodes (like LEDs) traveling slowly along the wire
    for (let i = 0; i < 9; i++) {
      const tx = (timeElapsed * 0.03 + i * 80) % WIDTH;
      const ty = y + Math.sin((tx + timeElapsed * 0.3) * 0.03) * 6;
      const pulse = (Math.sin(timeElapsed * 0.02 + i) + 1) / 2;
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,${220 - i * 6},120,${0.15 + pulse * 0.12})`;
      ctx.arc(tx, ty - 6, 4 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPlayer() {
    ctx.save();
    player.bob += 0.08;
    const bobY = Math.sin(player.bob) * 4;
    const x = player.x;
    const y = player.y + bobY;
    // shadow
    ctx.beginPath();
    ctx.ellipse(x, y + 34, 30, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(18,18,20,0.12)';
    ctx.fill();

    // body gradient
    const bodyGrad = ctx.createLinearGradient(x - 20, y - 16, x + 20, y + 20);
    bodyGrad.addColorStop(0, '#FFB7D8');
    bodyGrad.addColorStop(1, player.color);
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, 28, 20, 0, 0, Math.PI * 2);
    ctx.fill();

    // belly with subtle shine
    ctx.fillStyle = '#FFF2F8';
    ctx.beginPath();
    ctx.ellipse(x - 6, y + 4, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ears
    ctx.fillStyle = '#FFB7D8';
    ctx.beginPath();
    ctx.ellipse(x - 14, y - 18, 8, 10, -0.3, 0, Math.PI * 2);
    ctx.ellipse(x + 6, y - 20, 8, 10, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // tail with layered gradient and soft blur for depth
    ctx.save();
    ctx.translate(x + 22, y - 2);
    ctx.rotate(Math.sin(timeElapsed * 0.01) * 0.25);
    const tailGrad = ctx.createLinearGradient(-20, -10, 20, 10);
    tailGrad.addColorStop(0, '#FFB7D8');
    tailGrad.addColorStop(1, '#FF7BAC');
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 26, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // expressive eyes with slight blink
    const blink = (Math.sin(timeElapsed * 0.02) + 1) / 2 > 0.995 ? 0.3 : 1;
    ctx.fillStyle = '#222';
    ctx.beginPath();
    ctx.ellipse(x - 6, y - 2, 3.5, 3.5 * blink, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 6, y - 2, 3.5, 3.5 * blink, 0, 0, Math.PI * 2);
    ctx.fill();

    // friendly smile
    ctx.strokeStyle = '#441';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y + 6, 8, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // small backpack pockets that glow when bulbFlash occurs
    ctx.fillStyle = `rgba(255,${200 + Math.floor((bulbFlash / 28) * 30)},160,${0.9})`;
    ctx.fillRect(x - 26, y + 10, 14, 8);
    ctx.fillRect(x + 12, y + 10, 14, 8);

    // name banner (subtle)
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeStyle = 'rgba(34,34,34,0.12)';
    ctx.lineWidth = 1;
    ctx.fillRect(x - 42, y + 36, 84, 18);
    ctx.strokeRect(x - 42, y + 36, 84, 18);
    ctx.fillStyle = '#555';
    ctx.font = '12px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, x, y + 50);
    ctx.restore();
  }

  function drawElectrons() {
    for (const e of electrons) {
      ctx.save();
      // Prepare wobble & rotation
      e.wobble = (e.wobble || 0) + 0.02;
      e.rotation += e.rotSpeed;
      // store previous Y for trail effect
      if (e.prevY == null) e.prevY = e.y;

      // trail
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = e.value === currentProblem.solution ? '#6EE7B7' : '#FFD19A';
      ctx.lineWidth = Math.max(1, e.radius * 0.4);
      ctx.beginPath();
      ctx.moveTo(e.x, e.prevY - 6);
      ctx.lineTo(e.x, e.y - 2);
      ctx.stroke();

      // glow
      ctx.globalAlpha = 1;
      ctx.shadowColor = e.value === currentProblem.solution ? 'rgba(110,231,183,0.85)' : 'rgba(255,209,154,0.7)';
      ctx.shadowBlur = 14;

      ctx.translate(e.x, e.y);
      const wob = Math.sin(e.wobble + timeElapsed * 0.02) * 6;
      // radial orb
      const orbGrad = ctx.createRadialGradient(-e.radius * 0.3, -e.radius * 0.3 + wob, 2, 0, 0, e.radius);
      orbGrad.addColorStop(0, '#FFFFFF');
      orbGrad.addColorStop(0.3, e.color);
      orbGrad.addColorStop(1, '#C7B6FF');
      ctx.fillStyle = orbGrad;
      ctx.rotate(e.rotation + Math.sin(timeElapsed * 0.001) * 0.05);
      ctx.beginPath();
      ctx.arc(0, wob, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(-e.radius * 0.35, -e.radius * 0.35 + wob, e.radius * 0.5, e.radius * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();

      // number label
      ctx.fillStyle = '#222';
      ctx.font = 'bold 16px Verdana';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(e.value), 0, wob);

      // subtle ring
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.stroke();

      ctx.restore();
      e.prevY = e.y;
    }
    // reset shadow blur after drawing electrons
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }

  function drawPanel() {
    ctx.save();
    // Left: small gadget station with animated lights
    ctx.fillStyle = '#6C8EFF';
    ctx.fillRect(32, HEIGHT - 190, 60, 120);
    ctx.fillStyle = '#EDF0FF';
    ctx.fillRect(44, HEIGHT - 170, 36, 80);

    // gadget lights that pulse
    for (let i = 0; i < 4; i++) {
      const gx = 44 + 8 + (i % 2) * 12;
      const gy = HEIGHT - 170 + 8 + Math.floor(i / 2) * 20;
      const pulse = (Math.sin(timeElapsed * 0.006 + i) + 1) / 2;
      ctx.fillStyle = `rgba(255,${220 - i * 20},100,${0.4 + pulse * 0.45})`;
      ctx.beginPath();
      ctx.arc(gx, gy, 5 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Professor Ohm cartoon badge
    ctx.beginPath();
    ctx.fillStyle = '#F0D68B';
    ctx.arc(120, HEIGHT - 130, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3C2F2F';
    ctx.fillRect(106, HEIGHT - 124, 28, 6);
    ctx.fillStyle = '#E3A1A1';
    ctx.fillRect(100, HEIGHT - 100, 40, 36);
    ctx.fillStyle = '#553';
    ctx.font = '12px Verdana';
    ctx.textAlign = 'center';
    ctx.fillText('Prof. Ohm', 120, HEIGHT - 58);
    ctx.restore();

    // Center problem card with soft drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(30,30,30,0.12)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.strokeStyle = '#E8F0FF';
    ctx.lineWidth = 3;
    const px = WIDTH / 2 - 160;
    const py = 24;
    ctx.fillRect(px, py, 320, 84);
    ctx.strokeRect(px, py, 320, 84);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#123';
    ctx.font = '18px Verdana';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const problemText = `${currentProblem.a} ${currentProblem.op} ${currentProblem.b} = ?`;
    ctx.fillText('Help Spark! Catch the right answer', WIDTH / 2, 36);
    ctx.font = '34px Verdana';
    ctx.fillText(problemText, WIDTH / 2, 36 + 42);
    ctx.restore();

    // Right: glowing bulb character
    ctx.save();
    const bx = WIDTH - 100;
    const by = HEIGHT - 160;
    const bulbGlow = 0.5 + (bulbFlash > 0 ? 0.7 : 0) * (bulbFlash / 28);
    const radial = ctx.createRadialGradient(bx, by - 40, 6, bx, by - 40, 88);
    radial.addColorStop(0, `rgba(255,238,130,${0.95 * bulbGlow})`);
    radial.addColorStop(1, `rgba(255,238,130,${0.02 * bulbGlow})`);
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.ellipse(bx, by - 40, 70, 90, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#fff8d6';
    ctx.beginPath();
    ctx.ellipse(bx, by - 40, 28, 36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#C7B47A';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(bx - 6, by - 48);
    ctx.quadraticCurveTo(bx, by - 36, bx + 6, by - 48);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFAA00';
    ctx.stroke();

    ctx.fillStyle = '#B3B3B3';
    ctx.fillRect(bx - 12, by - 16, 24, 20);
    ctx.strokeRect(bx - 12, by - 16, 24, 20);

    // face for friendly bulb
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(bx - 6, by - 44, 3, 0, Math.PI * 2);
    ctx.arc(bx + 6, by - 44, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#663';
    ctx.beginPath();
    ctx.arc(bx, by - 32, 6, 0.25, Math.PI - 0.25);
    ctx.stroke();

    ctx.restore();

    // HUD box
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillRect(14, 12, 160, 64);
    ctx.strokeStyle = '#E2EAF9';
    ctx.strokeRect(14, 12, 160, 64);

    ctx.fillStyle = '#333';
    ctx.font = '14px Verdana';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 24, 34);
    ctx.fillText(`Level: ${level}`, 24, 54);

    // Lives as lively little battery hearts
    for (let i = 0; i < 3; i++) {
      const hx = 120 + i * 20;
      const hy = 34;
      ctx.beginPath();
      ctx.fillStyle = i < lives ? '#FF5D5D' : '#EEE';
      ctx.moveTo(hx, hy);
      ctx.arc(hx - 4, hy - 2, 5, 0, Math.PI * 2);
      ctx.arc(hx + 4, hy - 2, 5, 0, Math.PI * 2);
      ctx.lineTo(hx, hy + 9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#C84D4D';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();

    // Sound icon
    drawSoundIcon(WIDTH - 36, 36);
  }

  function drawSoundIcon(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(-22, -18, 44, 36);
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#FFDD57';
    // Speaker
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-2, -12);
    ctx.lineTo(-2, 12);
    ctx.lineTo(-6, 8);
    ctx.lineTo(-14, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    if (soundEnabled && audioAllowed) {
      ctx.beginPath();
      ctx.arc(6, 0, 8, -0.6, 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(6, 0, 12, -0.6, 0.6);
      ctx.stroke();
    } else if (!audioAllowed) {
      // disabled icon small dot
      ctx.beginPath();
      ctx.fillStyle = '#EEE';
      ctx.arc(6, 0, 4, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(6, -8);
      ctx.lineTo(14, 8);
      ctx.moveTo(14, -8);
      ctx.lineTo(6, 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life / 60) * p.glow;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      // subtle outer glow
      ctx.globalAlpha *= 0.6;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------- MAIN UPDATE LOOP ----------
  let lastTime = performance.now();
  function update(now) {
    const dt = now - lastTime;
    lastTime = now;
    timeElapsed += dt;

    if (!isGameOver) {
      // Movement
      if (keys.ArrowLeft || keys.a || keys.A) {
        player.vx = -player.speed;
      } else if (keys.ArrowRight || keys.d || keys.D) {
        player.vx = player.speed;
      } else {
        player.vx *= 0.86;
        if (Math.abs(player.vx) < 0.06) player.vx = 0;
      }
      player.x += player.vx;
      player.x = Math.max(44, Math.min(WIDTH - 44, player.x));

      // Spawn electrons
      lastSpawn += dt;
      if (lastSpawn > spawnInterval) {
        spawnElectron();
        lastSpawn = 0;
      }

      // Move electrons
      for (let i = electrons.length - 1; i >= 0; i--) {
        const e = electrons[i];
        e.y += e.vy;
        e.wobble += 0.04;
        e.rotation += e.rotSpeed;
        if (e.y > HEIGHT + 60) {
          if (e.value === currentProblem.solution) {
            lives -= 1;
            spawnParticles(e.x, HEIGHT - 80, '#FFB0B0', 10);
            playIncorrect();
            if (lives <= 0) {
              gameOver();
            }
            currentProblem = generateProblem(level);
          }
          electrons.splice(i, 1);
        }
      }

      updateParticles();
      checkCollisions();

      if (bulbFlash > 0) bulbFlash -= 1;

      // Gentle modulation of pad frequency for calming effect
      if (audioAllowed && bgPad && bgPad.padFilter) {
        try {
          const base = 540;
          const mod = Math.sin(timeElapsed * 0.0019) * 30;
          bgPad.padFilter.frequency.setValueAtTime(base + mod, audioCtx.currentTime);
        } catch (err) {}
      }
    }

    draw();
    requestAnimationFrame(update);
  }

  // ---------- DRAW ----------
  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackground();
    drawWire();
    drawElectrons();
    drawPlayer();
    drawPanel();
    drawParticles();

    // Instructions panel
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(12, HEIGHT - 48, 300, 36);
    ctx.strokeStyle = '#E3E3E3';
    ctx.strokeRect(12, HEIGHT - 48, 300, 36);
    ctx.fillStyle = '#333';
    ctx.font = '13px Verdana';
    ctx.textAlign = 'left';
    ctx.fillText(
      'Use ← → keys or tap sides to move. Press S to toggle sound. Catch the correct number!',
      20,
      HEIGHT - 24
    );
    ctx.restore();

    // Audio error text
    if (audioError) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,200,200,0.95)';
      ctx.fillRect(WIDTH - 300, HEIGHT - 64, 288, 44);
      ctx.fillStyle = '#650000';
      ctx.font = '12px Verdana';
      ctx.textAlign = 'left';
      ctx.fillText('Audio unavailable in this browser. Sound disabled.', WIDTH - 284, HEIGHT - 36);
      ctx.restore();
    }

    // Game over overlay
    if (isGameOver) {
      ctx.save();
      ctx.fillStyle = 'rgba(12, 12, 20, 0.66)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = '36px Verdana';
      ctx.fillText('Game Over', WIDTH / 2, HEIGHT / 2 - 40);
      ctx.font = '20px Verdana';
      ctx.fillText(`Score: ${score}`, WIDTH / 2, HEIGHT / 2 - 8);
      ctx.fillText('Tap or press R to restart', WIDTH / 2, HEIGHT / 2 + 26);
      ctx.restore();
    }
  }

  // ---------- INPUT FOR RESTART ----------
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'r' || e.key === 'R') && isGameOver) {
      restartGame();
    }
    if (e.key === ' ' && !isGameOver) {
      player.vx *= 1.2;
    }
  });

  canvas.addEventListener('click', (e) => {
    if (isGameOver) restartGame();
  });

  // Kick off animation
  requestAnimationFrame(update);

  // Friendly console
  console.info('Electric Math Game loaded. Use arrow keys to move Spark and S to toggle sound.');

  // Attempt to init audio when user interacts with canvas (gesture)
  function gestureInit() {
    if (!audioAllowed) initAudio();
    canvas.removeEventListener('pointerdown', gestureInit);
  }
  canvas.addEventListener('pointerdown', gestureInit);

  // Expose minimal controls for testing
  window.__electricMathGame = {
    restart: restartGame,
    toggleSound: () => {
      if (!audioAllowed) initAudio();
      soundEnabled = !soundEnabled;
      setMasterGainEnabled(soundEnabled);
    },
    status: () => ({ score, lives, level, problemsSolved, soundEnabled, audioAllowed, audioError })
  };

  // Accessibility focus ring
  canvas.tabIndex = 0;
  canvas.addEventListener('focus', () => {
    try {
      ctx.save();
      ctx.strokeStyle = '#6EA6FF';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, WIDTH - 8, HEIGHT - 8);
      ctx.restore();
    } catch (err) {}
  });
})();