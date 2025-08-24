(function () {
  // Enhanced visuals & audio for "Sparky's Power-Up"
  // NOTE: Game mechanics and math logic unchanged. Only visuals and audio improved.
  // Renders inside #game-of-the-day-stage in a 720x480 canvas. All audio generated with Web Audio API.

  // --- Constants ---
  const WIDTH = 720;
  const HEIGHT = 480;
  const CANVAS_BG = '#e8f6ff';
  const SPARK_COLORS = ['#ffd94d', '#ffc7a8', '#ff9aa2', '#9ee6b8', '#cceeff'];
  const BULB_COLOR = '#fff8d6';
  const MAX_SPARKS = 6;
  const LEVELS = [
    { bulbs: [5, 7, 6] },
    { bulbs: [8, 9, 5] },
    { bulbs: [10, 7, 8] }
  ];

  // --- DOM setup ---
  const container = document.getElementById('game-of-the-day-stage');
  if (!container) {
    console.error('Game container with id "game-of-the-day-stage" not found.');
    return;
  }

  // prepare container
  container.innerHTML = '';
  container.style.width = `${WIDTH}px`;
  container.style.height = `${HEIGHT}px`;
  container.style.position = 'relative';
  container.style.outline = 'none';
  container.setAttribute('role', 'application');
  container.setAttribute(
    'aria-label',
    "Sparky power-up math game. Use mouse or keyboard to play."
  );
  container.tabIndex = 0;

  // Accessible instructions region
  const srInstructions = document.createElement('div');
  srInstructions.style.position = 'absolute';
  srInstructions.style.left = '-9999px';
  srInstructions.style.width = '1px';
  srInstructions.style.height = '1px';
  srInstructions.style.overflow = 'hidden';
  srInstructions.setAttribute('aria-live', 'polite');
  srInstructions.id = 'sparky-aria';
  srInstructions.textContent =
    "Welcome to Sparky's Power-Up! Combine numbered sparks to match bulb energy. Use mouse or touch to drag sparks into bulbs. Keyboard: Tab to focus, arrow keys to move, space to pick up/drop, Q/E to cycle sparks.";
  container.appendChild(srInstructions);

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.display = 'block';
  canvas.style.background = CANVAS_BG;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Interactive game area. Visuals are decorative; use the game controls described in the instructions.'
  );
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  // --- Audio setup & utilities ---
  let audioCtx = null;
  let audioEnabled = false;
  let backgroundNodes = null;

  function createAudioContext() {
    if (audioCtx) return audioCtx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AC();
      return audioCtx;
    } catch (err) {
      audioCtx = null;
      console.warn('Audio context unavailable:', err);
      return null;
    }
  }

  // Generic safe oscillator with envelope
  function safePlay({ freq = 440, duration = 0.25, type = 'sine', volume = 0.12, detune = 0, filter = null, pan = 0 }) {
    const ctx = createAudioContext();
    if (!ctx || !audioEnabled) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;

      gain.gain.value = 0.0001;
      osc.connect(gain);

      let output = gain;
      if (filter) {
        const f = ctx.createBiquadFilter();
        f.type = filter.type || 'lowpass';
        if (filter.freq) f.frequency.value = filter.freq;
        if (filter.Q) f.Q.value = filter.Q;
        gain.connect(f);
        output = f;
      }

      if (panner) {
        panner.pan.value = pan;
        output.connect(panner);
        panner.connect(ctx.destination);
      } else {
        output.connect(ctx.destination);
      }

      // Envelope
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      osc.start(now);
      osc.stop(now + duration + 0.05);
      // cleanup
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
          if (panner) panner.disconnect();
        } catch (e) {}
      };
    } catch (e) {
      console.warn('Audio playback error:', e);
    }
  }

  // Specialized sounds
  function soundPickup() {
    safePlay({ freq: 720, duration: 0.12, type: 'sine', volume: 0.07, pan: -0.15 });
    safePlay({ freq: 1280, duration: 0.06, type: 'triangle', volume: 0.04, pan: 0.1, detune: 6 });
  }

  function soundPartial() {
    safePlay({ freq: 560, duration: 0.16, type: 'sine', volume: 0.09 });
    safePlay({ freq: 920, duration: 0.12, type: 'triangle', volume: 0.06, pan: 0.08 });
  }

  function soundExact() {
    // pleasant 3-note arpeggio
    const ctx = createAudioContext();
    if (!ctx || !audioEnabled) return;
    try {
      const now = ctx.currentTime;
      const freqs = [660, 880, 1100];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = i === 1 ? 'triangle' : 'sine';
        osc.frequency.value = f;
        g.gain.value = 0.0001;
        osc.connect(g);
        g.connect(ctx.destination);
        const start = now + i * 0.06;
        g.gain.exponentialRampToValueAtTime(0.14, start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, start + 0.22 + i * 0.03);
        osc.start(start);
        osc.stop(start + 0.28 + i * 0.03);
        osc.onended = () => {
          try {
            osc.disconnect();
            g.disconnect();
          } catch (e) {}
        };
      });
    } catch (e) {
      console.warn('Exact sound error:', e);
    }
  }

  function soundError() {
    safePlay({ freq: 240, duration: 0.24, type: 'sawtooth', volume: 0.08, filter: { type: 'lowpass', freq: 900 } });
    safePlay({ freq: 120, duration: 0.28, type: 'sine', volume: 0.06, pan: -0.2 });
  }

  // Background ambience: gentle hum + slow LFO on filter
  function startBackgroundAmbience() {
    if (!audioEnabled) return;
    const ctx = createAudioContext();
    if (!ctx) return;
    if (backgroundNodes) return; // already running
    try {
      const master = ctx.createGain();
      master.gain.value = 0.03;
      master.connect(ctx.destination);

      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 60;

      const band = ctx.createBiquadFilter();
      band.type = 'lowpass';
      band.frequency.value = 1200;
      band.Q.value = 0.6;

      // subtle vibrato via Gain -> Oscillator frequency modulation
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.12;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 18; // frequency deviation
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      osc.connect(band);
      band.connect(master);
      osc.start();
      lfo.start();

      backgroundNodes = { osc, lfo, lfoGain, band, master };
    } catch (e) {
      console.warn('Background ambience failed:', e);
      backgroundNodes = null;
    }
  }

  function stopBackgroundAmbience() {
    if (!backgroundNodes) return;
    try {
      backgroundNodes.osc.stop();
      backgroundNodes.lfo.stop();
      backgroundNodes.osc.disconnect();
      backgroundNodes.lfo.disconnect();
      backgroundNodes.band.disconnect();
      backgroundNodes.master.disconnect();
    } catch (e) {}
    backgroundNodes = null;
  }

  // --- Visual elements & helpers ---
  class Trail {
    constructor(max = 14) {
      this.max = max;
      this.points = [];
    }

    push(x, y, life = 1) {
      this.points.push({ x, y, life });
      if (this.points.length > this.max) this.points.shift();
    }

    draw(ctx, color = '#fff') {
      if (this.points.length < 2) return;
      ctx.save();
      for (let i = 0; i < this.points.length - 1; i++) {
        const a = this.points[i];
        const b = this.points[i + 1];
        const t = i / this.points.length;
        ctx.beginPath();
        ctx.strokeStyle = hexToRgba(color, 0.12 + (1 - t) * 0.25);
        ctx.lineWidth = 6 * (1 - t) + 1;
        ctx.lineCap = 'round';
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // convert hex to rgba with alpha
  function hexToRgba(hex, alpha = 1) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r},${g},${b},${alpha})`;
  }

  class Spark {
    constructor(id, x, y, value, color) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 0.6;
      this.vy = (Math.random() - 0.5) * 0.6;
      this.radius = 24;
      this.value = value;
      this.color = color;
      this.dragging = false;
      this.picked = false;
      this.visible = true;
      this.bounce = Math.random() * Math.PI * 2;
      this.trail = new Trail(16);
      this.glowPhase = Math.random() * Math.PI * 2;
    }

    draw(ctx) {
      if (!this.visible) return;

      // trail when moving or picked
      this.trail.draw(ctx, this.color);

      // glow halo
      ctx.save();
      const glowR = this.radius * 1.6 + Math.sin(this.glowPhase) * 3;
      const g = ctx.createRadialGradient(this.x, this.y, this.radius * 0.3, this.x, this.y, glowR);
      g.addColorStop(0, hexToRgba(this.color, 0.9));
      g.addColorStop(0.5, hexToRgba(this.color, 0.28));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // spark bolt shape
      ctx.save();
      ctx.translate(this.x, this.y);
      const tilt = Math.sin(this.bounce) * 0.12;
      ctx.rotate(tilt);
      // bolt path (stylized)
      ctx.beginPath();
      ctx.moveTo(-8, -18);
      ctx.lineTo(4, -6);
      ctx.lineTo(-2, -6);
      ctx.lineTo(8, 18);
      ctx.lineTo(-4, 6);
      ctx.lineTo(2, 6);
      ctx.closePath();
      // fill with gradient
      const boltGrad = ctx.createLinearGradient(0, -18, 0, 18);
      boltGrad.addColorStop(0, '#ffffff');
      boltGrad.addColorStop(0.2, this.color);
      boltGrad.addColorStop(0.8, this.color);
      boltGrad.addColorStop(1, '#ffe9b3');
      ctx.fillStyle = boltGrad;
      ctx.fill();
      // inner stroke
      ctx.strokeStyle = '#fff9ea';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // number
      ctx.fillStyle = '#1b2330';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.value.toString(), 0, 0);

      // selection ring
      if (this.picked) {
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 6, 0, Math.PI * 2);
        ctx.strokeStyle = hexToRgba('#3b82f6', 0.9);
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      ctx.restore();
    }

    update(dt) {
      if (!this.visible) return;
      // subtle animation
      this.glowPhase += dt * 0.006;
      if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;

      // when picked - slight floating near pointer handled externally
      if (!this.dragging && !this.picked) {
        this.x += this.vx * dt * 0.06;
        this.y += this.vy * dt * 0.06;
        // bounds
        if (this.x < this.radius) {
          this.x = this.radius;
          this.vx *= -0.8;
        }
        if (this.x > WIDTH - this.radius) {
          this.x = WIDTH - this.radius;
          this.vx *= -0.8;
        }
        if (this.y < this.radius + 80) {
          this.y = this.radius + 80;
          this.vy *= -0.8;
        }
        if (this.y > HEIGHT - this.radius) {
          this.y = HEIGHT - this.radius;
          this.vy *= -0.8;
        }
        this.vx *= 0.995;
        this.vy *= 0.995;
        this.bounce += 0.01;
      } else {
        // when dragging or picked, add a small bob
        this.bounce += dt * 0.008;
      }
      // store trail
      if (this.visible) this.trail.push(this.x, this.y);
    }

    containsPoint(px, py) {
      const dx = px - this.x;
      const dy = py - this.y;
      return dx * dx + dy * dy <= (this.radius * this.radius) * 1.1;
    }
  }

  class Bulb {
    constructor(id, x, y, target) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.radius = 48;
      this.target = target;
      this.current = 0;
      this.lit = false;
      this.pulse = 0;
      this.shimmer = Math.random() * Math.PI * 2;
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // ambient halo if lit (soft)
      if (this.lit) {
        const glow = ctx.createRadialGradient(0, -6, 6, 0, -6, 120);
        glow.addColorStop(0, 'rgba(255,250,200,0.95)');
        glow.addColorStop(0.6, 'rgba(255,250,200,0.25)');
        glow.addColorStop(1, 'rgba(255,250,200,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(0, 0, 92 + Math.sin(this.pulse) * 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // bulb glass body - gradient & reflections
      const grad = ctx.createLinearGradient(0, -this.radius, 0, this.radius + 10);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.18, BULB_COLOR);
      grad.addColorStop(0.6, '#fff1c6');
      grad.addColorStop(1, '#f3e6b8');
      ctx.beginPath();
      ctx.ellipse(0, -6, this.radius * 0.9, this.radius * 1.1, 0, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // subtle inner sheen
      ctx.beginPath();
      ctx.ellipse(-10, -18, this.radius * 0.38, this.radius * 0.6, -0.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fill();

      // rim stroke
      ctx.strokeStyle = '#d9c57a';
      ctx.lineWidth = 3;
      ctx.stroke();

      // filament: different when lit
      ctx.save();
      ctx.translate(0, -4);
      if (this.lit) {
        // glowing filament
        ctx.beginPath();
        ctx.moveTo(-8, -2);
        ctx.quadraticCurveTo(0, -10 + Math.sin(this.shimmer) * 3, 8, -2);
        ctx.strokeStyle = '#ffefb0';
        ctx.lineWidth = 3.5;
        ctx.stroke();

        // inner glow
        const fg = ctx.createRadialGradient(0, -6, 1, 0, -6, 40);
        fg.addColorStop(0, 'rgba(255,240,180,0.95)');
        fg.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(0, -6, 28 + Math.sin(this.pulse) * 4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // dark filament
        ctx.beginPath();
        ctx.moveTo(-6, -2);
        ctx.quadraticCurveTo(0, -10, 6, -2);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2.0;
        ctx.stroke();
      }
      ctx.restore();

      // screw base
      ctx.fillStyle = '#b0b0b0';
      ctx.fillRect(-18, 28, 36, 18);
      ctx.strokeStyle = '#8f8f8f';
      ctx.strokeRect(-18, 28, 36, 18);

      // friendly face
      ctx.fillStyle = '#2b2b2b';
      ctx.beginPath();
      ctx.arc(-12, -6, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(8, -6, 4, 0, Math.PI * 2);
      ctx.fill();
      if (this.lit) {
        ctx.beginPath();
        ctx.arc(-6, 6, 6, 0, Math.PI);
        ctx.fillStyle = '#222';
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(-6, 6);
        ctx.lineTo(6, 6);
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // progress text
      ctx.fillStyle = '#333';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${this.current} / ${this.target}`, 0, 54);

      // hint text
      if (!this.lit) {
        ctx.fillStyle = '#666';
        ctx.font = '12px sans-serif';
        ctx.fillText('Need exact match!', 0, 70);
      } else {
        ctx.fillStyle = '#1f8a3d';
        ctx.font = '12px sans-serif';
        ctx.fillText('Powered!', 0, 70);
      }

      ctx.restore();
    }

    containsPoint(px, py) {
      const dx = px - this.x;
      const dy = py - this.y;
      return (dx * dx) / ((this.radius * 0.9) ** 2) + (dy * dy) / ((this.radius * 1.1) ** 2) <= 1;
    }

    addSparkValue(val) {
      if (this.lit) return { success: false, reason: 'already lit' };
      this.current += val;
      if (this.current === this.target) {
        this.lit = true;
        this.pulse = 0;
        return { success: true, exact: true };
      } else if (this.current > this.target) {
        return { success: false, reason: 'too much' };
      } else {
        return { success: true, exact: false };
      }
    }

    update(dt) {
      if (this.lit) {
        this.pulse += dt * 0.01;
      }
      this.shimmer += dt * 0.008;
    }
  }

  // --- Particles and background motion ---
  let particles = [];
  function createParticles() {
    const arr = [];
    for (let i = 0; i < 28; i++) {
      arr.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        r: 4 + Math.random() * 14,
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
        hue: 190 + Math.random() * 80,
        depth: Math.random() * 1.6 + 0.6
      });
    }
    return arr;
  }

  function drawBackground(ctx, t) {
    // soft gradient sky
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, '#f6fbff');
    g.addColorStop(1, '#e6f6ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // animated conductive patterns (soft lines)
    ctx.save();
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const y = 110 + i * 52;
      ctx.moveTo(0, y);
      for (let x = 0; x <= WIDTH; x += 22) {
        const wob = Math.sin(x * 0.018 + i * 0.9 + t * 0.0009) * 14;
        ctx.lineTo(x, y + wob);
      }
      ctx.strokeStyle = `hsla(${200 + i * 8},60%,60%,0.07)`;
      ctx.lineWidth = 12 - i * 1.6;
      ctx.stroke();
    }
    ctx.restore();

    // floating particles (slower, parallax)
    ctx.save();
    for (const p of particles) {
      p.x += p.vx * p.depth;
      p.y += p.vy * p.depth;
      if (p.x < -80) p.x = WIDTH + 80;
      if (p.x > WIDTH + 80) p.x = -80;
      if (p.y < -80) p.y = HEIGHT + 80;
      if (p.y > HEIGHT + 80) p.y = -80;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue},70%,60%,${0.06 * (1 / p.depth)})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // --- Game state ---
  let sparks = [];
  let bulbs = [];
  let selectedIndex = 0;
  let heldSpark = null;
  let levelIndex = 0;
  let score = 0;
  let lastTime = performance.now();
  let mouseDown = false;
  let hoverSpark = null;
  let tooltip = '';
  let showStartOverlay = true;
  let animTime = 0;

  // --- Initialize level (game logic unchanged) ---
  function initLevel(index) {
    sparks = [];
    bulbs = [];
    selectedIndex = 0;
    heldSpark = null;
    tooltip = '';
    const level = LEVELS[index % LEVELS.length];

    const bulbPositions = [
      { x: 140, y: 170 },
      { x: 360, y: 170 },
      { x: 580, y: 170 }
    ];
    for (let i = 0; i < level.bulbs.length; i++) {
      bulbs.push(new Bulb(i, bulbPositions[i].x, bulbPositions[i].y, level.bulbs[i]));
    }

    let created = 0;
    for (let i = 0; i < bulbs.length; i++) {
      const t = bulbs[i].target;
      const a = Math.max(1, Math.floor(Math.random() * (t - 1) + 1));
      const b = t - a;
      sparks.push(new Spark(created++, 140 + i * 160, 320 + Math.random() * 80, a, SPARK_COLORS[created % SPARK_COLORS.length]));
      sparks.push(new Spark(created++, 140 + i * 160 + 30, 320 + Math.random() * 80, b, SPARK_COLORS[created % SPARK_COLORS.length]));
    }
    while (created < MAX_SPARKS) {
      const val = 1 + Math.floor(Math.random() * 9);
      sparks.push(new Spark(created++, 120 + Math.random() * 480, 320 + Math.random() * 120, val, SPARK_COLORS[created % SPARK_COLORS.length]));
    }
    selectedIndex = 0;
    score = 0;
    particles = createParticles();
    updateAria('New level loaded. Combine sparks to match bulb energy numbers.');
  }

  // --- HUD and top bar drawing ---
  function drawTopBar(ctx, t) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(0, 0, WIDTH, 64);
    ctx.strokeStyle = '#d6efff';
    ctx.strokeRect(0, 0, WIDTH, 64);

    ctx.fillStyle = '#08203a';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText("Sparky's Power-Up: Addition Adventure", 16, 30);

    // Dr. Current plaque with subtle animation (blinking eyes)
    const gx = WIDTH - 170;
    ctx.save();
    ctx.translate(gx, 6);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 4, 156, 52);
    ctx.strokeStyle = '#dff0ff';
    ctx.strokeRect(0, 4, 156, 52);

    // head
    const blink = Math.floor(t / 700 % 11) === 0 ? 0.2 : 1;
    ctx.beginPath();
    ctx.arc(30, 30, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#ffdca8';
    ctx.fill();
    ctx.strokeStyle = '#d6b08a';
    ctx.stroke();

    // glasses
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(22, 30, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(38, 30, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(28, 30);
    ctx.lineTo(32, 30);
    ctx.stroke();

    // eyes (blink)
    ctx.fillStyle = '#222';
    if (blink > 0.9) {
      ctx.beginPath();
      ctx.arc(22, 30, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(38, 30, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // closed - thin line
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18, 30);
      ctx.lineTo(26, 30);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(34, 30);
      ctx.lineTo(42, 30);
      ctx.stroke();
    }

    // name
    ctx.fillStyle = '#333';
    ctx.font = '12px sans-serif';
    ctx.fillText('Dr. Current', 56, 26);
    ctx.fillStyle = '#666';
    ctx.font = '11px sans-serif';
    ctx.fillText('Guide & Spark Expert', 56, 42);
    ctx.restore();

    // sound indicator (visual only)
    ctx.fillStyle = audioEnabled ? '#2e9b45' : '#c24a4a';
    ctx.beginPath();
    ctx.arc(WIDTH - 40, 22, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(audioEnabled ? 'On' : 'Off', WIDTH - 80, 23);

    ctx.restore();
  }

  function drawInstructions(ctx) {
    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#234';
    ctx.textAlign = 'left';
    ctx.fillText("Drag numbered sparks into bulbs so the sum equals the bulb's number.", 16, 46);
    ctx.fillText('Keyboard: Tab to focus -> Arrow keys move, Space pick up/drop, Q/E cycle, Enter drop into bulb.', 16, 62);
    ctx.restore();
  }

  // --- Render loop ---
  function render(now) {
    const dt = now - lastTime;
    lastTime = now;
    animTime = now;

    // update
    for (const s of sparks) s.update(dt);
    for (const b of bulbs) b.update(dt);

    // clear & draw bg
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    drawBackground(ctx, now);

    // top UI
    drawTopBar(ctx, now);
    drawInstructions(ctx);

    // bulbs
    for (const b of bulbs) b.draw(ctx);

    // decorative wires with subtle animation
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.strokeStyle = 'rgba(184,214,255,0.24)';
    ctx.lineWidth = 5;
    bulbs.forEach((b, i) => {
      ctx.beginPath();
      ctx.moveTo(b.x - 12, b.y + 34);
      const t = Math.sin(now * 0.001 + i) * 8;
      ctx.bezierCurveTo(b.x - 30 + t, b.y + 88, b.x - 200 + t * 0.4, HEIGHT - 40, 40 + i * 8, HEIGHT - 22);
      ctx.stroke();
    });
    ctx.restore();

    // sparks
    for (const s of sparks) s.draw(ctx);

    // HUD bottom-left info
    ctx.save();
    ctx.fillStyle = '#092138';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    const sel = sparks[selectedIndex];
    if (sel && sel.visible) {
      ctx.fillText(`Selected spark: ${sel.value} (Q/E to cycle)`, 16, HEIGHT - 54);
    } else {
      ctx.fillText('No spark selected', 16, HEIGHT - 54);
    }
    ctx.fillText(`Score: ${score}`, WIDTH - 120, HEIGHT - 54);
    ctx.restore();

    // start overlay
    if (showStartOverlay) {
      ctx.save();
      // subtle blurred panel (simulated)
      ctx.fillStyle = 'rgba(6,30,55,0.88)';
      roundRect(ctx, 60, 96, WIDTH - 120, HEIGHT - 192, 12, true, false);
      // animated sparkles within overlay
      for (let i = 0; i < 8; i++) {
        const sx = 120 + i * 60 + Math.sin(now * 0.002 + i) * 6;
        const sy = 180 + Math.cos(now * 0.002 + i * 1.1) * 8;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,255,220,${0.08 + Math.abs(Math.sin(now * 0.002 + i)) * 0.24})`;
        ctx.arc(sx, sy, 16 + Math.sin(now * 0.003 + i) * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText("Sparky's Power-Up!", WIDTH / 2, 160);
      ctx.font = '16px sans-serif';
      ctx.fillText('Combine sparks to match bulb energy numbers.', WIDTH / 2, 200);
      ctx.fillText('Click or press Enter to begin. Sound is optional.', WIDTH / 2, 236);
      ctx.font = '12px sans-serif';
      ctx.fillText('Mouse/touch: drag and drop. Keyboard: Tab -> arrow keys, space, Q/E, Enter', WIDTH / 2, 270);
      ctx.restore();
    }

    // tooltip
    if (tooltip) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      roundRect(ctx, 16, HEIGHT - 114, 260, 40, 6, true, true);
      ctx.fillStyle = '#012';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(tooltip, 26, HEIGHT - 86);
      ctx.restore();
    }

    requestAnimationFrame(render);
  }

  // small helper to draw rounded rect
  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (r === undefined) r = 5;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // start render
  requestAnimationFrame(render);

  // --- Interaction helpers ---
  function screenToCanvas(evt) {
    try {
      const rect = canvas.getBoundingClientRect();
      const clientX = evt.clientX !== undefined ? evt.clientX : (evt.touches && evt.touches[0] && evt.touches[0].clientX);
      const clientY = evt.clientY !== undefined ? evt.clientY : (evt.touches && evt.touches[0] && evt.touches[0].clientY);
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      return { x, y };
    } catch (e) {
      return { x: 0, y: 0 };
    }
  }

  canvas.addEventListener('mousedown', (evt) => {
    container.focus();
    mouseDown = true;
    const p = screenToCanvas(evt);

    // attempt to create/resume audio context on first gesture
    if (!audioCtx) createAudioContext();

    if (showStartOverlay) {
      showStartOverlay = false;
      audioEnabled = true;
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
          startBackgroundAmbience();
        }).catch(() => {});
      } else {
        startBackgroundAmbience();
      }
      updateAria('Game started. Use mouse or keyboard to play.');
      initLevel(levelIndex);
      return;
    }

    // pick topmost spark under pointer
    for (let i = sparks.length - 1; i >= 0; i--) {
      if (sparks[i].visible && sparks[i].containsPoint(p.x, p.y)) {
        heldSpark = sparks[i];
        heldSpark.dragging = true;
        heldSpark.picked = true;
        tooltip = 'Drag to a bulb and release to add energy.';
        updateAria(`Picked spark ${heldSpark.value}. Drag into a bulb.`);
        // audio feedback
        soundPickup();
        break;
      }
    }
  });

  canvas.addEventListener('mousemove', (evt) => {
    const p = screenToCanvas(evt);
    hoverSpark = null;
    for (let i = sparks.length - 1; i >= 0; i--) {
      if (sparks[i].visible && sparks[i].containsPoint(p.x, p.y)) {
        hoverSpark = sparks[i];
        break;
      }
    }
    if (heldSpark && heldSpark.dragging) {
      heldSpark.x = p.x;
      heldSpark.y = p.y;
    }
  });

  canvas.addEventListener('mouseup', (evt) => {
    mouseDown = false;
    if (heldSpark) {
      heldSpark.dragging = false;
      const p = screenToCanvas(evt);
      let droppedOnBulb = null;
      for (const b of bulbs) {
        if (b.containsPoint(p.x, p.y)) {
          droppedOnBulb = b;
          break;
        }
      }
      if (droppedOnBulb) {
        const result = droppedOnBulb.addSparkValue(heldSpark.value);
        if (result.success && result.exact) {
          heldSpark.visible = false;
          score += 10;
          soundExact();
          updateAria(`Great! Bulb ${droppedOnBulb.id + 1} is powered. Score ${score}.`);
          checkLevelComplete();
        } else if (result.success && !result.exact) {
          heldSpark.visible = false;
          score += 2;
          soundPartial();
          updateAria(`Added ${heldSpark.value} to bulb ${droppedOnBulb.id + 1}. Current ${droppedOnBulb.current} of ${droppedOnBulb.target}.`);
        } else {
          soundError();
          // revert addition to keep fair (game logic unchanged)
          droppedOnBulb.current -= heldSpark.value;
          if (droppedOnBulb.current < 0) droppedOnBulb.current = 0;
          updateAria('Oops! Too much energy. Try a smaller spark.');
          // push spark to a neutral position
          heldSpark.x = 360 + (Math.random() - 0.5) * 40;
          heldSpark.y = 360 + (Math.random() - 0.5) * 40;
        }
      } else {
        // dropped elsewhere -> small scattering
        heldSpark.x += Math.random() * 26 - 13;
        heldSpark.y += Math.random() * 26 - 13;
        updateAria('Spark dropped. Try again.');
      }
      heldSpark.picked = false;
      heldSpark = null;
      tooltip = '';
    } else {
      // click empty space selects nearest spark
      if (!showStartOverlay) {
        const p = screenToCanvas(evt);
        for (let i = 0; i < sparks.length; i++) {
          if (sparks[i].visible && sparks[i].containsPoint(p.x, p.y)) {
            selectedIndex = i;
            updateAria(`Selected spark ${sparks[selectedIndex].value}.`);
            break;
          }
        }
      }
    }
  });

  // Touch forwarding
  canvas.addEventListener('touchstart', (evt) => {
    evt.preventDefault();
    const t = evt.touches[0];
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY }));
  }, { passive: false });

  canvas.addEventListener('touchmove', (evt) => {
    evt.preventDefault();
    const t = evt.touches[0];
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY }));
  }, { passive: false });

  canvas.addEventListener('touchend', (evt) => {
    evt.preventDefault();
    canvas.dispatchEvent(new MouseEvent('mouseup', {}));
  }, { passive: false });

  // Keyboard controls (mechanics preserved)
  container.addEventListener('keydown', (evt) => {
    if (showStartOverlay && (evt.key === 'Enter' || evt.key === ' ')) {
      showStartOverlay = false;
      audioEnabled = true;
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => startBackgroundAmbience()).catch(() => {});
      } else {
        startBackgroundAmbience();
      }
      initLevel(levelIndex);
      return;
    }
    if (showStartOverlay) return;

    const key = evt.key.toLowerCase();
    const sel = sparks[selectedIndex];

    if (key === 'q') {
      for (let i = 1; i <= sparks.length; i++) {
        const idx = (selectedIndex - i + sparks.length) % sparks.length;
        if (sparks[idx].visible) {
          selectedIndex = idx;
          break;
        }
      }
      updateAria(`Selected spark ${sparks[selectedIndex].value}.`);
      evt.preventDefault();
    } else if (key === 'e') {
      for (let i = 1; i <= sparks.length; i++) {
        const idx = (selectedIndex + i) % sparks.length;
        if (sparks[idx].visible) {
          selectedIndex = idx;
          break;
        }
      }
      updateAria(`Selected spark ${sparks[selectedIndex].value}.`);
      evt.preventDefault();
    } else if (key === ' ' || key === 'enter') {
      if (heldSpark) {
        // drop logic (unchanged)
        let droppedOnBulb = null;
        for (const b of bulbs) {
          if (b.containsPoint(heldSpark.x, heldSpark.y)) {
            droppedOnBulb = b;
            break;
          }
        }
        if (droppedOnBulb) {
          const result = droppedOnBulb.addSparkValue(heldSpark.value);
          if (result.success && result.exact) {
            heldSpark.visible = false;
            score += 10;
            soundExact();
            updateAria(`Bulb ${droppedOnBulb.id + 1} powered!`);
            checkLevelComplete();
          } else if (result.success && !result.exact) {
            heldSpark.visible = false;
            score += 2;
            soundPartial();
            updateAria('Added spark. Keep going.');
          } else {
            droppedOnBulb.current -= heldSpark.value;
            if (droppedOnBulb.current < 0) droppedOnBulb.current = 0;
            soundError();
            updateAria('Too much energy! Try a different spark.');
            heldSpark.x = 360;
            heldSpark.y = 360;
          }
        }
        heldSpark.picked = false;
        heldSpark.dragging = false;
        heldSpark = null;
      } else {
        if (sel && sel.visible) {
          heldSpark = sel;
          heldSpark.picked = true;
          updateAria(`Picked spark ${heldSpark.value}. Use arrow keys to move.`);
          soundPickup();
        } else {
          updateAria('No spark to pick. Select another.');
        }
      }
      evt.preventDefault();
      return;
    } else if (['arrowleft', 'a'].includes(evt.key.toLowerCase())) {
      if (heldSpark) {
        heldSpark.x = Math.max(12, heldSpark.x - 12);
      } else {
        for (let i = 1; i <= sparks.length; i++) {
          const idx = (selectedIndex - i + sparks.length) % sparks.length;
          if (sparks[idx].visible) {
            selectedIndex = idx;
            break;
          }
        }
      }
      evt.preventDefault();
    } else if (['arrowright', 'd'].includes(evt.key.toLowerCase())) {
      if (heldSpark) {
        heldSpark.x = Math.min(WIDTH - 12, heldSpark.x + 12);
      } else {
        for (let i = 1; i <= sparks.length; i++) {
          const idx = (selectedIndex + i) % sparks.length;
          if (sparks[idx].visible) {
            selectedIndex = idx;
            break;
          }
        }
      }
      evt.preventDefault();
    } else if (['arrowup', 'w'].includes(evt.key.toLowerCase())) {
      if (heldSpark) {
        heldSpark.y = Math.max(80, heldSpark.y - 12);
      }
      evt.preventDefault();
    } else if (['arrowdown', 's'].includes(evt.key.toLowerCase())) {
      if (heldSpark) {
        heldSpark.y = Math.min(HEIGHT - 12, heldSpark.y + 12);
      }
      evt.preventDefault();
    } else if (key === 'tab') {
      // cycle selection
      for (let i = 1; i <= sparks.length; i++) {
        const idx = (selectedIndex + i) % sparks.length;
        if (sparks[idx].visible) {
          selectedIndex = idx;
          break;
        }
      }
      updateAria(`Selected spark ${sparks[selectedIndex].value}.`);
      evt.preventDefault();
    }
  });

  // double-click toggles audio
  canvas.addEventListener('dblclick', (evt) => {
    if (!audioCtx) createAudioContext();
    audioEnabled = !audioEnabled;
    if (audioEnabled) {
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => startBackgroundAmbience()).catch(() => {});
      } else {
        startBackgroundAmbience();
      }
      updateAria('Sound enabled.');
    } else {
      stopBackgroundAmbience();
      updateAria('Sound disabled.');
    }
  });

  // Announce focus
  container.addEventListener('focus', () => {
    updateAria('Game focused. Press Enter to start. After starting, drag sparks into bulbs or use keyboard controls.');
  });

  // --- Level completion check (logic unchanged) ---
  function checkLevelComplete() {
    if (bulbs.every(b => b.lit)) {
      soundExact();
      updateAria('Level complete! Moving to next level.');
      levelIndex++;
      // celebration then next level
      setTimeout(() => {
        initLevel(levelIndex);
      }, 1200);
    }
  }

  // ARIA updater
  function updateAria(text) {
    try {
      srInstructions.textContent = text;
    } catch (e) {
      console.warn('ARIA update failed', e);
    }
  }

  // Error handling
  window.addEventListener('error', (e) => {
    console.error('Game error caught:', e.message, e.error);
    updateAria('An unexpected error occurred. Please refresh the page.');
  });

  // --- Initial state & helpers ---
  showStartOverlay = true;
  particles = createParticles();
  initLevel(0);

  // Expose debug API non-intrusive
  container.gameDebug = {
    toggleSound: () => {
      audioEnabled = !audioEnabled;
      if (audioEnabled) startBackgroundAmbience();
      else stopBackgroundAmbience();
      return audioEnabled;
    },
    getState: () => ({ sparks, bulbs, levelIndex, score })
  };
})();