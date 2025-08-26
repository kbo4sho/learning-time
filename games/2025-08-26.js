(() => {
  // Enhanced visuals & audio for "Game of the Day: Electricity Math Adventure"
  // Renders inside element with id "game-of-the-day-stage"
  // Canvas 720x480, Web Audio API sounds, keyboard accessibility, canvas-only graphics
  "use strict";

  // Configuration
  const WIDTH = 720;
  const HEIGHT = 480;
  const MAX_BUBBLES = 6;
  const TARGET_MIN = 6;
  const TARGET_MAX = 15;

  // Get container element
  const container = document.getElementById("game-of-the-day-stage");
  if (!container) {
    console.error("Cannot find element with id 'game-of-the-day-stage'.");
    return;
  }
  container.setAttribute("tabindex", "0");
  container.setAttribute("role", "application");
  container.setAttribute(
    "aria-label",
    "Electric Sparks math game. Use keyboard or mouse to select number bubbles and sum to the target voltage."
  );
  container.style.position = "relative";
  container.style.outline = "none";

  // Accessible status element (hidden)
  const statusDiv = document.createElement("div");
  statusDiv.setAttribute("role", "status");
  statusDiv.setAttribute("aria-live", "polite");
  statusDiv.style.position = "absolute";
  statusDiv.style.left = "-9999px";
  statusDiv.style.width = "1px";
  statusDiv.style.height = "1px";
  statusDiv.style.overflow = "hidden";
  container.appendChild(statusDiv);

  // Canvas creation and sizing
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.display = "block";
  canvas.style.background = "#071829"; // will be covered by drawing but keep fallback
  container.appendChild(canvas);
  const ctx = canvas.getContext("2d", { alpha: false });

  // Audio setup with robust error handling
  let audioCtx = null;
  let audioEnabled = true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  } catch (err) {
    console.warn("Web Audio API not available:", err);
    audioEnabled = false;
    audioCtx = null;
  }

  // Master audio nodes and ambient music state
  let masterGain = null;
  let ambient = null; // {oscA, oscB, lfo, filter, gain}
  function safeCreateGain() {
    if (!audioEnabled || !audioCtx) return null;
    try {
      return audioCtx.createGain();
    } catch (e) {
      console.warn("Error creating gain:", e);
      audioEnabled = false;
      return null;
    }
  }

  // Build master gain
  if (audioEnabled && audioCtx) {
    try {
      masterGain = safeCreateGain();
      if (masterGain) {
        masterGain.gain.value = 0.8;
        masterGain.connect(audioCtx.destination);
      } else {
        audioEnabled = false;
      }
    } catch (e) {
      console.warn("Failed to setup master gain:", e);
      audioEnabled = false;
    }
  }

  // Utility to schedule a tone with envelope using oscillator + filter
  function playTone({
    freq = 440,
    type = "sine",
    duration = 0.2,
    gain = 0.08,
    detune = 0,
    attack = 0.01,
    release = 0.06,
    filterFreq = 18000,
    pan = 0
  } = {}) {
    if (!audioEnabled || !audioCtx || !masterGain) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      osc.type = type;
      osc.frequency.value = freq;
      osc.detune.value = detune;
      filter.type = "lowpass";
      filter.frequency.value = filterFreq;

      // stereo panner if available
      let panner = null;
      if (typeof audioCtx.createStereoPanner === "function") {
        panner = audioCtx.createStereoPanner();
        panner.pan.value = pan;
      }

      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(gain, now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

      osc.connect(filter);
      filter.connect(g);
      if (panner) {
        g.connect(panner);
        panner.connect(masterGain);
      } else {
        g.connect(masterGain);
      }

      osc.start(now);
      osc.stop(now + duration + release + 0.02);
    } catch (e) {
      console.warn("Error in playTone:", e);
      audioEnabled = false;
    }
  }

  // Ambient background hum: two detuned oscillators with LFO controlling filter
  function startAmbient() {
    if (!audioEnabled || !audioCtx || !masterGain) return;
    stopAmbient();
    try {
      const oscA = audioCtx.createOscillator();
      const oscB = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();

      // gentle pads
      oscA.type = "sine";
      oscB.type = "triangle";
      oscA.frequency.value = 110; // low base
      oscB.frequency.value = 110 * 1.005; // slight detune
      gain.gain.value = 0.02;

      // mellow filter
      filter.type = "lowpass";
      filter.frequency.value = 800;
      filter.Q.value = 0.8;

      // LFO to breathe filter
      lfo.type = "sine";
      lfo.frequency.value = 0.08; // slow breath
      lfoGain.gain.value = 200;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // connect graph
      oscA.connect(filter);
      oscB.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      // start nodes
      const now = audioCtx.currentTime;
      oscA.start(now);
      oscB.start(now);
      lfo.start(now);

      ambient = { oscA, oscB, filter, lfo, gain, lfoGain };

      // fade in gentle
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.02, now + 1.2);
    } catch (e) {
      console.warn("Failed to start ambient audio:", e);
      audioEnabled = false;
    }
  }

  function stopAmbient() {
    if (!ambient || !audioCtx) return;
    try {
      const now = audioCtx.currentTime;
      ambient.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      // stop oscillators after ramp
      ambient.oscA.stop(now + 0.7);
      ambient.oscB.stop(now + 0.7);
      ambient.lfo.stop(now + 0.7);
    } catch (e) {
      // ignore
    } finally {
      ambient = null;
    }
  }

  // Small specialized sounds (using playTone)
  function playPickSound() {
    // soft click + high sparkle
    playTone({
      freq: 420,
      type: "triangle",
      duration: 0.06,
      gain: 0.04,
      attack: 0.005,
      release: 0.04,
      pan: -0.15
    });
    setTimeout(() => {
      playTone({
        freq: 920,
        type: "sine",
        duration: 0.12,
        gain: 0.03,
        attack: 0.005,
        release: 0.05,
        pan: 0.08
      });
    }, 40);
  }

  function playCorrectSound() {
    // pleasant harmonic cluster
    playTone({ freq: 520, type: "sine", duration: 0.12, gain: 0.06 });
    setTimeout(() => playTone({ freq: 700, type: "sine", duration: 0.14, gain: 0.05 }), 90);
    setTimeout(() => playTone({ freq: 880, type: "sine", duration: 0.18, gain: 0.04 }), 210);
  }

  function playWrongSound() {
    // short low thud then soft descending buzzer
    playTone({ freq: 220, type: "sine", duration: 0.14, gain: 0.06 });
    setTimeout(() => playTone({ freq: 170, type: "square", duration: 0.16, gain: 0.04 }), 90);
  }

  // Game state
  let bubbles = [];
  let target = 10;
  let currentSum = 0;
  let score = 0;
  let attemptsLeft = 3;
  let selectedIndex = 0;
  let message = "Welcome! Select bubbles summing to the battery voltage.";
  let level = 1;
  let sparkX = WIDTH * 0.15;
  let sparkY = HEIGHT * 0.5;
  let sparkAnim = 0;
  let muted = false;

  // Visual particles for subtle motion
  const particles = [];
  for (let i = 0; i < 28; i++) {
    particles.push({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      r: 1 + Math.random() * 2,
      speed: 0.1 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      hue: 190 + Math.random() * 60
    });
  }

  // Utility random
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // Level initialization (unchanged logic; preserved semantics)
  function setupLevel(lv = 1) {
    level = lv;
    target = randInt(TARGET_MIN + lv - 1, Math.min(TARGET_MAX + lv - 1, TARGET_MAX + 4));
    bubbles = [];
    const count = Math.min(MAX_BUBBLES, 3 + Math.floor(Math.random() * 4));
    for (let i = 0; i < count; i++) {
      bubbles.push({
        value: randInt(1, Math.max(3, Math.floor(target / 2))),
        x: WIDTH * 0.5 + Math.cos((i / count) * Math.PI * 2) * 160 + randInt(-30, 30),
        y: HEIGHT * 0.35 + Math.sin((i / count) * Math.PI * 2) * 80 + randInt(-20, 20),
        picked: false,
        wobble: Math.random() * Math.PI * 2
      });
    }
    const subsetSize = Math.min(3, bubbles.length);
    let sum = 0;
    for (let i = 0; i < subsetSize - 1; i++) {
      sum += bubbles[i].value;
    }
    const lastNeeded = Math.max(1, target - sum);
    bubbles[subsetSize - 1].value = lastNeeded;
    currentSum = 0;
    attemptsLeft = 3;
    selectedIndex = 0;
    sparkX = WIDTH * 0.15;
    sparkY = HEIGHT * 0.5;
    message = `Level ${level}. Help Sparky reach ${target} volts!`;
    announce(message);
  }

  // Announce via ARIA
  function announce(text) {
    statusDiv.textContent = text;
  }

  // Drawing helpers
  function drawRoundedRect(x, y, w, h, r = 8, fillStyle = "#fff", strokeStyle = "#000") {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw Sparky with more expression and subtle glow
  function drawSparky(x, y, size = 48, awake = true) {
    ctx.save();
    ctx.translate(x, y);

    // soft glow
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 1.6);
    g.addColorStop(0, awake ? "rgba(255,230,130,0.8)" : "rgba(200,220,255,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, size * 1.1, 0, Math.PI * 2);
    ctx.fill();

    // main spark body complex shape (canvas-only)
    ctx.beginPath();
    const spikes = 7;
    for (let i = 0; i < spikes; i++) {
      const a = (i / spikes) * Math.PI * 2;
      const r = size * (i % 2 === 0 ? 0.9 : 0.45);
      const sx = Math.cos(a) * r;
      const sy = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.fillStyle = awake ? "#FFD66B" : "#9FBAD6";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = awake ? "#FFB84D" : "#6C8FA8";
    ctx.stroke();

    // face: eyes and subtle eyelids when sleepy
    ctx.fillStyle = "#2A2A2A";
    ctx.beginPath();
    ctx.arc(-size * 0.22, -size * 0.15, size * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(size * 0.18, -size * 0.18, size * 0.08, 0, Math.PI * 2);
    ctx.fill();

    if (!awake) {
      ctx.strokeStyle = "#2A2A2A";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-size * 0.32, -size * 0.13);
      ctx.lineTo(-size * 0.12, -size * 0.05);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(size * 0.16, -size * 0.2);
      ctx.lineTo(size * 0.34, -size * 0.12);
      ctx.stroke();
    }

    // smile
    ctx.beginPath();
    ctx.strokeStyle = "#4A2F12";
    ctx.lineWidth = 2;
    ctx.arc(0, size * 0.05, size * 0.28, 0.08 * Math.PI, 0.92 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }

  // Draw bulb with glass reflection using gradients
  function drawBulb(x, y, lit = false) {
    ctx.save();
    ctx.translate(x, y);

    // glass gradient
    const bulbRad = 44;
    const grd = ctx.createRadialGradient(-8, -14, 4, 0, 0, bulbRad);
    grd.addColorStop(0, lit ? "rgba(255,245,170,0.98)" : "rgba(245,255,255,0.96)");
    grd.addColorStop(0.5, lit ? "rgba(255,235,120,0.85)" : "rgba(220,245,255,0.9)");
    grd.addColorStop(1, "rgba(170,200,220,0.7)");

    ctx.beginPath();
    ctx.ellipse(0, -12, bulbRad, bulbRad * 1.15, 0, 0, Math.PI * 2);
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = lit ? "#FFB84D" : "#B8DAE6";
    ctx.stroke();

    // glass highlight
    ctx.beginPath();
    ctx.ellipse(-12, -22, bulbRad * 0.35, bulbRad * 0.6, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fill();

    // filament
    ctx.beginPath();
    ctx.moveTo(-10, -8);
    ctx.quadraticCurveTo(0, -28, 10, -8);
    ctx.strokeStyle = lit ? "#FFAA33" : "#9BB2BF";
    ctx.lineWidth = 3;
    ctx.stroke();

    // metallic base
    drawRoundedRect(-26, 18, 52, 14, 3, "#9EA3A7", "#778086");

    // small screw lines
    ctx.strokeStyle = "#7A7E80";
    ctx.lineWidth = 1.2;
    for (let i = -22; i <= 22; i += 8) {
      ctx.beginPath();
      ctx.moveTo(i, 20);
      ctx.lineTo(i, 28);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw wire with soft glow and tiny sparks when on
  function drawWire(x1, y1, x2, y2, on = false) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const midx = (x1 + x2) / 2;
    const midy = (y1 + y2) / 2;
    ctx.quadraticCurveTo(midx, midy - 60, x2, y2);
    ctx.lineWidth = on ? 6 : 4;
    ctx.strokeStyle = on ? "rgba(255,200,100,0.98)" : "rgba(140,185,205,0.9)";
    ctx.lineCap = "round";
    ctx.shadowColor = on ? "rgba(255,200,100,0.35)" : "transparent";
    ctx.shadowBlur = on ? 14 : 0;
    ctx.stroke();

    // tiny animated sparks along wire when on
    if (on) {
      const tNow = Date.now() / 1000;
      for (let i = 0; i < 6; i++) {
        const t = (i / 5) * 1.0 + Math.sin(tNow * 2 + i) * 0.02;
        const px = (1 - t) * x1 + t * x2 + Math.sin(tNow * 8 + i) * 6;
        const py = (1 - t) * y1 + t * y2 + Math.cos(tNow * 6 + i) * 6;
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,245,200,${0.7 - i * 0.08})`;
        ctx.arc(px, py, 3.5 - i * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // Draw bubble with glassy shading, selection glow, and subtle index tag
  function drawBubble(b, index, isSelected) {
    const { x, y, value, picked } = b;
    ctx.save();
    ctx.translate(x, y);
    const wob = Math.sin(b.wobble + Date.now() / 450) * 3;
    ctx.translate(0, wob);

    // shadow
    ctx.beginPath();
    ctx.ellipse(6, 28, 28, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(20,30,40,0.12)";
    ctx.fill();

    // outer rim gradient
    const rad = 34;
    const g = ctx.createRadialGradient(-8, -6, 4, 0, 0, rad);
    g.addColorStop(0, picked ? "rgba(200,255,240,0.98)" : "rgba(230,250,255,0.95)");
    g.addColorStop(0.6, "rgba(200,235,255,0.9)");
    g.addColorStop(1, "rgba(160,200,225,0.6)");
    ctx.beginPath();
    ctx.arc(0, 0, picked ? rad + 4 : rad, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // rim stroke and selection glow
    ctx.lineWidth = 3;
    ctx.strokeStyle = isSelected ? "rgba(255,200,90,0.95)" : "rgba(110,170,200,0.9)";
    ctx.stroke();

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(0, 0, rad + 8 + Math.sin(Date.now() / 300) * 2, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,215,120,0.12)";
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    // inner decorative circuit line
    ctx.beginPath();
    ctx.moveTo(-12, -2);
    ctx.lineTo(0, -10);
    ctx.lineTo(12, -2);
    ctx.moveTo(0, 10);
    ctx.lineTo(0, -10);
    ctx.strokeStyle = "rgba(180,220,245,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // number
    ctx.fillStyle = "#06303A";
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(value), 0, 0);

    // index tag
    ctx.fillStyle = "rgba(10,20,30,0.06)";
    ctx.beginPath();
    ctx.roundRect && ctx.roundRect(-22, -22, 28, 18, 4); // if supported
    ctx.fill();
    ctx.fillStyle = "#3B5964";
    ctx.font = "11px sans-serif";
    ctx.fillText(String(index + 1), -18, -18);

    ctx.restore();
  }

  // Polyfill for roundRect on some contexts
  if (!ctx.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      this.beginPath();
      this.moveTo(x + r, y);
      this.arcTo(x + w, y, x + w, y + h, r);
      this.arcTo(x + w, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + w, y, r);
      this.closePath();
    };
  }

  // Main render loop with richer visuals
  function render() {
    // background gradient sky-like with subtle vignette
    const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bgGrad.addColorStop(0, "#05202A");
    bgGrad.addColorStop(0.35, "#043447");
    bgGrad.addColorStop(1, "#071829");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // soft radial glow behind battery area
    const glow = ctx.createRadialGradient(WIDTH * 0.18, HEIGHT * 0.2, 10, WIDTH * 0.18, HEIGHT * 0.2, 260);
    glow.addColorStop(0, "rgba(255,235,180,0.06)");
    glow.addColorStop(1, "rgba(255,235,180,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // subtle moving particles to create depth - not overstimulating
    particles.forEach((p) => {
      p.phase += 0.01 * p.speed;
      p.x += Math.cos(p.phase) * p.speed * 0.4;
      p.y += Math.sin(p.phase) * p.speed * 0.3;
      if (p.x < -10) p.x = WIDTH + 10;
      if (p.x > WIDTH + 10) p.x = -10;
      if (p.y < -10) p.y = HEIGHT + 10;
      if (p.y > HEIGHT + 10) p.y = -10;
      ctx.beginPath();
      ctx.fillStyle = `rgba(220,245,255,${0.05 + (p.r / 6) * 0.06})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // subtle circuit lines background (soft)
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const y = 90 + i * 60 + Math.sin(Date.now() / 900 + i) * 6;
      ctx.moveTo(20, y);
      ctx.bezierCurveTo(160, y - 30, 320, y + 30, 700, y);
      ctx.strokeStyle = i % 2 === 0 ? "#1E5366" : "#0F3A49";
      ctx.stroke();
    }
    ctx.restore();

    // left power station card
    drawRoundedRect(24, 58, 192, 150, 12, "rgba(255,248,230,0.96)", "rgba(255,200,90,0.9)");
    ctx.fillStyle = "#0B3240";
    ctx.font = "600 18px sans-serif";
    ctx.fillText("Battery Lab", 56, 86);

    ctx.font = "14px sans-serif";
    ctx.fillStyle = "#12363F";
    ctx.fillText(`Target: ${target} V`, 56, 110);
    ctx.fillText(`Sum: ${currentSum} V`, 56, 132);
    ctx.fillText(`Attempts: ${attemptsLeft}`, 56, 154);
    ctx.fillText(`Score: ${score}`, 56, 176);

    // large bulb and wire
    const bulbX = WIDTH - 140;
    const bulbY = HEIGHT * 0.5 - 6;
    const bulbLit = currentSum === target;
    drawWire(220, 130, bulbX - 20, bulbY - 20, bulbLit);
    drawBulb(bulbX, bulbY, bulbLit);

    // animate sparky near battery
    drawSparky(sparkX + Math.sin(sparkAnim) * 3.5, sparkY + Math.cos(sparkAnim * 0.8) * 2.5, 44, attemptsLeft > 0);

    // draw bubbles
    bubbles.forEach((b, i) => drawBubble(b, i, i === selectedIndex));

    // bottom instruction panel (semi translucent)
    drawRoundedRect(40, HEIGHT - 112, WIDTH - 80, 92, 10, "rgba(8,22,28,0.6)", "rgba(80,160,200,0.06)");
    ctx.fillStyle = "rgba(200,240,255,0.92)";
    ctx.font = "15px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("Instructions: Select number bubbles to add up to the battery voltage.", 60, HEIGHT - 84);
    ctx.font = "13px sans-serif";
    ctx.fillText("Click a bubble or press 1-6. Use ← → to move, Space/Enter to pick. R to reset, M to mute.", 60, HEIGHT - 62);

    // message
    ctx.fillStyle = "rgba(220,250,255,0.95)";
    ctx.font = "12px sans-serif";
    ctx.fillText(message, 60, HEIGHT - 40);

    // small audio indicator panel at top-right
    ctx.save();
    const audX = WIDTH - 42;
    const audY = 22;
    ctx.beginPath();
    ctx.roundRect && ctx.roundRect(audX - 36, audY - 14, 72, 28, 6);
    ctx.fillStyle = muted || !audioEnabled ? "rgba(80,80,90,0.28)" : "rgba(255,215,120,0.92)";
    ctx.fill();
    ctx.strokeStyle = "rgba(120,140,150,0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = muted || !audioEnabled ? "#B0B0B8" : "#3B2A05";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(muted || !audioEnabled ? "Muted" : "Audio", audX, audY + 3);
    ctx.restore();

    // audio visual waves (subtle)
    if (!muted && audioEnabled) {
      ctx.save();
      ctx.translate(WIDTH - 108, 22);
      ctx.globalAlpha = 0.9;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-6 + i * 8, 0, 4 + i * 3 + Math.abs(Math.sin(Date.now() / 800 + i)) * 1.6, 0.2 * Math.PI, 1.8 * Math.PI);
        ctx.strokeStyle = `rgba(255,210,120,${0.28 - i * 0.06})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

    // small floating electrons near center to add subtle motion
    for (let e = 0; e < 6; e++) {
      const ex = (e * 110 + Date.now() / 6) % (WIDTH - 160) + 80;
      const ey = 60 + ((e * 73) % 340) + Math.sin(Date.now() / 300 + e) * 6;
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.arc(ex, ey, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(200,230,255,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // Game logic pickBubble preserved (only call sound functions updated)
  function pickBubble(i) {
    if (i < 0 || i >= bubbles.length) return;
    const b = bubbles[i];
    if (b.picked) {
      message = "You already used that charge bubble.";
      announce(message);
      return;
    }
    const newSum = currentSum + b.value;
    b.picked = true;

    if (!muted && audioEnabled) playPickSound();

    currentSum = newSum;
    message = `Added ${b.value} V. Sum is now ${currentSum} V.`;
    announce(message);

    if (currentSum > target) {
      attemptsLeft -= 1;
      message = `Oh no! Overheated: ${currentSum} > ${target}. Attempts left: ${attemptsLeft}.`;
      announce(message);
      if (!muted && audioEnabled) playWrongSound();

      setTimeout(() => {
        bubbles.forEach((bb) => (bb.picked = false));
        currentSum = 0;
        selectedIndex = 0;
        if (attemptsLeft <= 0) {
          message = `Sparky needs a break! Press R to try again.`;
          announce(message);
          if (!muted && audioEnabled) {
            playTone({ freq: 220, type: "sine", duration: 0.25, gain: 0.04 });
          }
        } else {
          message = `Try a different combination to reach ${target} V.`;
          announce(message);
        }
      }, 800);
      score = Math.max(0, score - 1);
      return;
    }

    if (currentSum === target) {
      score += 1;
      message = `Perfect! The bulb lights up at ${target} V! Press R for next level.`;
      announce(message);
      if (!muted && audioEnabled) playCorrectSound();
      sparkX = WIDTH * 0.55;
      sparkY = HEIGHT * 0.4;
      setTimeout(() => {
        setupLevel(level + 1);
        if (!muted && audioEnabled) playTone({ freq: 480, type: "sawtooth", duration: 0.12, gain: 0.06 });
      }, 1600);
      return;
    }

    if (!muted && audioEnabled) playTone({ freq: 660 - currentSum * 8, type: "sine", duration: 0.08, gain: 0.04 });
    sparkX += 30;
    if (sparkX > WIDTH * 0.45) sparkX = WIDTH * 0.45;
  }

  // Mouse handling: picks bubble or toggles audio when clicking indicator
  function onCanvasClick(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    for (let i = 0; i < bubbles.length; i++) {
      const b = bubbles[i];
      const dx = mx - b.x;
      const dy = my - b.y;
      if (dx * dx + dy * dy <= 34 * 34) {
        selectedIndex = i;
        pickBubble(i);
        return;
      }
    }
    if (mx > WIDTH - 120 && mx < WIDTH - 20 && my > 0 && my < 40) {
      toggleMute();
      return;
    }
  }

  // Keyboard handling with ARIA-friendly resume on first user interaction
  function onContainerKeyDown(e) {
    if (audioEnabled && audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    if (e.key === "ArrowRight") {
      selectedIndex = (selectedIndex + 1) % bubbles.length;
      e.preventDefault();
      announce(`Selected bubble ${selectedIndex + 1} with ${bubbles[selectedIndex].value} volts.`);
    } else if (e.key === "ArrowLeft") {
      selectedIndex = (selectedIndex - 1 + bubbles.length) % bubbles.length;
      e.preventDefault();
      announce(`Selected bubble ${selectedIndex + 1} with ${bubbles[selectedIndex].value} volts.`);
    } else if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      pickBubble(selectedIndex);
      e.preventDefault();
    } else if (e.key.toLowerCase() === "r") {
      setupLevel(1);
      announce("Game reset. New level started.");
      e.preventDefault();
    } else if (e.key.toLowerCase() === "m") {
      toggleMute();
      e.preventDefault();
    } else {
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= bubbles.length) {
        selectedIndex = num - 1;
        pickBubble(selectedIndex);
        e.preventDefault();
      }
    }
  }

  // Mute toggle with robust handling of ambient audio
  function toggleMute() {
    muted = !muted;
    if (muted) {
      stopAmbient();
      message = "Audio muted. Press M to unmute.";
      announce("Audio muted.");
    } else {
      if (audioEnabled) {
        startAmbient();
        // gentle confirmation tone
        playTone({ freq: 600, type: "sine", duration: 0.08, gain: 0.05 });
      }
      message = "Audio enabled. Sounds on!";
      announce("Audio enabled.");
    }
  }

  // Main loop animation
  let lastTime = 0;
  function loop(ts) {
    const dt = (ts - lastTime) / 1000 || 0;
    lastTime = ts;
    bubbles.forEach((b) => (b.wobble += dt * 2));
    sparkAnim += dt * 5;
    if (currentSum === target) {
      sparkX += (WIDTH - 200 - sparkX) * dt * 2;
      sparkY += (HEIGHT * 0.42 - sparkY) * dt * 2;
    } else {
      sparkX += Math.sin(Date.now() / 400) * 0.01;
    }
    render();
    requestAnimationFrame(loop);
  }

  // Event listeners
  canvas.addEventListener("click", onCanvasClick);
  container.addEventListener("keydown", onContainerKeyDown);
  container.addEventListener("mousedown", () => container.focus());
  container.addEventListener("touchstart", () => container.focus());

  // Initialize game with careful audio start (respecting autoplay policies)
  function startGame() {
    if (audioEnabled && audioCtx && audioCtx.state === "running") {
      try {
        startAmbient();
      } catch (e) {
        console.warn("Failed to start ambient audio:", e);
        audioEnabled = false;
      }
    }
    setupLevel(1);
    requestAnimationFrame(loop);
  }

  // Wait for user gesture if audio context suspended
  if (audioEnabled && audioCtx && audioCtx.state === "suspended") {
    message = "Tap or press any key to enable sound and start the game.";
    announce(message);
    const resumeHandler = () => {
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {
          audioEnabled = false;
        });
      }
      startGame();
      window.removeEventListener("click", resumeHandler);
      window.removeEventListener("keydown", resumeHandler);
      window.removeEventListener("touchstart", resumeHandler);
    };
    window.addEventListener("click", resumeHandler);
    window.addEventListener("keydown", resumeHandler);
    window.addEventListener("touchstart", resumeHandler);
  } else {
    startGame();
  }

  // Expose API for external control (non-essential)
  container.gameAPI = {
    reset: () => setupLevel(1),
    mute: () => {
      if (!muted) toggleMute();
    },
    unmute: () => {
      if (muted) toggleMute();
    },
    getState: () => ({ target, currentSum, score, level, attemptsLeft })
  };

  // Global error handler to surface to screen reader
  window.addEventListener("error", (ev) => {
    message = "An error occurred. Try reloading the game.";
    announce(message);
    console.error("Game error:", ev.error);
  });
})();