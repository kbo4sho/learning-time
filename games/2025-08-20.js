(function () {
  // Enhanced Electricity Math Game visuals & audio
  // Renders into element with ID "game-of-the-day-stage"
  // Canvas size: 720x480
  // Visuals: Canvas API only
  // Audio: Web Audio API oscillators and filters only
  // Game mechanics and math logic preserved

  // -----------------------
  // Setup and safety checks
  // -----------------------
  const container = document.getElementById("game-of-the-day-stage");
  if (!container) {
    console.error('Element with ID "game-of-the-day-stage" not found.');
    return;
  }

  // Clear container
  container.innerHTML = "";

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = 720;
  canvas.height = 480;
  canvas.style.width = "720px";
  canvas.style.height = "480px";
  canvas.tabIndex = 0; // make keyboard-focusable
  canvas.setAttribute("role", "application");
  canvas.setAttribute(
    "aria-label",
    "Electric City Math Game. Use keyboard or mouse to place batteries to match lamp power targets. Press M to mute or unmute audio."
  );
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  // Handle high DPI
  function setupHiDPI() {
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = 720 * dpr;
    canvas.height = 480 * dpr;
    canvas.style.width = "720px";
    canvas.style.height = "480px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  setupHiDPI();

  // -----------------------
  // Audio setup with error handling
  // -----------------------
  let audioCtx = null;
  let globalGain = null;
  let isMuted = false;
  let backgroundNodes = null; // store nodes to tweak
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      audioCtx = new AudioCtx();
      globalGain = audioCtx.createGain();
      globalGain.gain.value = 0.22; // gentle overall volume
      globalGain.connect(audioCtx.destination);

      // Gentle ambient pad: two detuned oscillators + slow LFO to filter cutoff
      const padGain = audioCtx.createGain();
      padGain.gain.value = 0.035;
      const oscA = audioCtx.createOscillator();
      const oscB = audioCtx.createOscillator();
      oscA.type = "sine";
      oscB.type = "sine";
      oscA.frequency.value = 55;
      oscB.frequency.value = 57.2; // slightly detuned
      const padFilter = audioCtx.createBiquadFilter();
      padFilter.type = "lowpass";
      padFilter.frequency.value = 220;
      padFilter.Q.value = 0.8;

      // LFO to modulate filter for subtle movement
      const lfo = audioCtx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.05;
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 60; // modulation depth

      lfo.connect(lfoGain);
      lfoGain.connect(padFilter.frequency);

      oscA.connect(padFilter);
      oscB.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(globalGain);

      oscA.start();
      oscB.start();
      lfo.start();

      backgroundNodes = {
        pad: { oscA, oscB, padFilter, padGain, lfo, lfoGain }
      };
    } else {
      console.warn("Web Audio API not supported in this browser.");
    }
  } catch (e) {
    console.error("Audio initialization failed:", e);
    audioCtx = null;
    globalGain = null;
    backgroundNodes = null;
  }

  // Helper: ensure audio context resumed on gesture
  function resumeAudioContext() {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch((err) => {
        console.warn("Audio resume failed:", err);
      });
    }
  }

  // Sound helpers (oscillators with envelope + optional filter)
  function playTone({ freq = 440, duration = 0.18, type = "sine", gain = 0.12, detune = 0, filter = null }) {
    if (!audioCtx || isMuted) return;
    try {
      resumeAudioContext();
      const now = audioCtx.currentTime;
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      g.gain.value = 0;
      o.connect(g);

      let targetNode = g;
      if (filter) {
        const f = audioCtx.createBiquadFilter();
        f.type = filter.type || "lowpass";
        f.frequency.value = filter.frequency || 1200;
        f.Q.value = filter.Q || 0.7;
        g.connect(f);
        f.connect(globalGain);
        targetNode = f;
      } else {
        g.connect(globalGain);
      }

      // fast attack, exponential decay for pleasant click
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);
      o.start(now);
      o.stop(now + duration + 0.04);
    } catch (err) {
      console.warn("playTone failed:", err);
    }
  }

  function playClick() {
    // soft, slightly hollow click
    playTone({
      freq: 880,
      duration: 0.06,
      type: "square",
      gain: 0.06,
      filter: { type: "highpass", frequency: 400 }
    });
  }

  function playError() {
    if (!audioCtx || isMuted) return;
    try {
      resumeAudioContext();
      const now = audioCtx.currentTime;
      // two detuned square oscillators with a highpass -> short buzz
      const o1 = audioCtx.createOscillator();
      const o2 = audioCtx.createOscillator();
      o1.type = "square";
      o2.type = "square";
      o1.frequency.value = 150;
      o2.frequency.value = 190;
      const g = audioCtx.createGain();
      const hp = audioCtx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 100;
      g.gain.value = 0;
      o1.connect(g);
      o2.connect(g);
      g.connect(hp);
      hp.connect(globalGain);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      o1.start(now);
      o2.start(now);
      o1.stop(now + 0.25);
      o2.stop(now + 0.25);
    } catch (err) {
      console.warn("playError failed:", err);
    }
  }

  function playSuccess() {
    if (!audioCtx || isMuted) return;
    try {
      resumeAudioContext();
      const now = audioCtx.currentTime;
      // pleasant arpeggio: three notes with different timbres and simple reverb-ish delay
      const freqs = [520, 660, 880];
      const delays = [];
      const feedbackGain = audioCtx.createGain();
      feedbackGain.gain.value = 0.18;
      const delayNode = audioCtx.createDelay();
      delayNode.delayTime.value = 0.09;
      delayNode.connect(feedbackGain);
      feedbackGain.connect(delayNode);
      delayNode.connect(globalGain);
      // small master wet gain for delay
      const wetGain = audioCtx.createGain();
      wetGain.gain.value = 0.06;
      delayNode.connect(wetGain);
      wetGain.connect(globalGain);

      freqs.forEach((f, i) => {
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = i === 1 ? "triangle" : "sine";
        o.frequency.value = f;
        // slight detune for warmth
        o.detune.value = i * 4;
        g.gain.value = 0;
        o.connect(g);
        g.connect(globalGain);
        // scheduled envelope
        const t = now + i * 0.06;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        // also send a small copy to delay for echo
        g.connect(delayNode);
        o.start(t);
        o.stop(t + 0.44);
      });
    } catch (err) {
      console.warn("playSuccess failed:", err);
    }
  }

  // -----------------------
  // Game data and helpers
  // -----------------------
  const STATE = {
    batteries: [],
    target: 10,
    placed: [],
    round: 1,
    score: 0,
    message: "Welcome! Charge the lamp to the exact power target.",
    focusedIndex: 0,
    dragging: null,
    lastActionTime: 0
  };

  const CHARACTERS = {
    professor: { name: "Professor Volt", color: "#3b6bff" },
    sparky: { name: "Sparky the Squirrel", color: "#ffb86b" },
    bulby: { name: "Bulby the Bulb", color: "#fff58a" }
  };

  // Initialize a round (preserve original logic)
  function newRound(round = 1) {
    STATE.round = round;
    STATE.placed = [];
    STATE.batteries = [];
    STATE.message = `${CHARACTERS.professor.name}: "Let's power the lamp!"`;
    STATE.target = Math.max(5, Math.min(18, 6 + Math.floor(Math.random() * 10) + Math.floor(round / 2)));
    const values = [];
    for (let i = 0; i < 4; i++) {
      values.push(1 + Math.floor(Math.random() * 9));
    }
    let needed = STATE.target - (values.reduce((a, b) => a + b, 0) % (STATE.target + 1));
    if (needed < 1 || needed > 9) {
      needed = 1 + Math.floor(Math.random() * 9);
    }
    values.push(needed);
    // shuffle
    for (let i = values.length - 1; i >= 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [values[i], values[j]] = [values[j], values[i]];
    }
    const startX = 40;
    const startY = 360;
    const gap = 128;
    for (let i = 0; i < values.length; i++) {
      const x = startX + i * gap;
      const y = startY;
      STATE.batteries.push({
        value: values[i],
        x,
        y,
        w: 100,
        h: 60,
        picked: false,
        placed: false,
        id: "b" + Date.now() + "-" + i
      });
    }
    STATE.focusedIndex = 0;
  }

  newRound(1);

  // Utility: check point inside rect
  function pointInRect(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
  }

  // -----------------------
  // Input handling (mouse & touch & keyboard)
  // -----------------------
  canvas.addEventListener("mousedown", (e) => {
    resumeAudioContext();
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    for (let i = STATE.batteries.length - 1; i >= 0; i--) {
      const b = STATE.batteries[i];
      if (!b.placed && pointInRect(mx, my, b)) {
        STATE.dragging = { idx: i, offsetX: mx - b.x, offsetY: my - b.y };
        b.picked = true;
        STATE.focusedIndex = i;
        playClick();
        return;
      }
    }
    if (mx > 640 && my < 48) {
      toggleMute();
      draw();
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!STATE.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const d = STATE.dragging;
    const b = STATE.batteries[d.idx];
    b.x = mx - d.offsetX;
    b.y = my - d.offsetY;
    draw();
  });

  function endDrag(e) {
    if (!STATE.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.changedTouches ? e.changedTouches[0].clientX - rect.left : e.clientX - rect.left);
    const my = (e.changedTouches ? e.changedTouches[0].clientY - rect.top : e.clientY - rect.top);
    const d = STATE.dragging;
    const b = STATE.batteries[d.idx];
    b.picked = false;
    if (isInLampArea(mx, my)) {
      attemptPlaceBattery(d.idx);
    } else {
      snapBatteryBack(d.idx);
    }
    STATE.dragging = null;
    draw();
  }

  canvas.addEventListener("mouseup", endDrag);
  canvas.addEventListener("mouseleave", endDrag);
  canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mx = e.touches[0].clientX - rect.left;
    const my = e.touches[0].clientY - rect.top;
    for (let i = STATE.batteries.length - 1; i >= 0; i--) {
      const b = STATE.batteries[i];
      if (!b.placed && pointInRect(mx, my, b)) {
        STATE.dragging = { idx: i, offsetX: mx - b.x, offsetY: my - b.y };
        b.picked = true;
        STATE.focusedIndex = i;
        playClick();
        return;
      }
    }
    if (mx > 640 && my < 48) {
      toggleMute();
      draw();
    }
  }, { passive: false });

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (!STATE.dragging) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.touches[0].clientX - rect.left;
    const my = e.touches[0].clientY - rect.top;
    const d = STATE.dragging;
    const b = STATE.batteries[d.idx];
    b.x = mx - d.offsetX;
    b.y = my - d.offsetY;
    draw();
  }, { passive: false });

  canvas.addEventListener("touchend", (e) => {
    e.preventDefault();
    endDrag(e);
  });

  // Keyboard controls
  canvas.addEventListener("keydown", (e) => {
    resumeAudioContext();
    const key = e.key;
    if (key === "ArrowRight") {
      focusNextBattery(1);
      e.preventDefault();
      draw();
    } else if (key === "ArrowLeft") {
      focusNextBattery(-1);
      e.preventDefault();
      draw();
    } else if (key === "Enter" || key === " ") {
      const b = STATE.batteries[STATE.focusedIndex];
      if (!b) return;
      if (!b.placed && !b.picked) {
        b.picked = true;
        b.x = 300;
        b.y = 180;
        draw();
      } else if (b.picked) {
        if (isInLampArea(b.x + b.w / 2, b.y + b.h / 2)) {
          attemptPlaceBattery(STATE.focusedIndex);
        } else {
          snapBatteryBack(STATE.focusedIndex);
        }
        b.picked = false;
      }
      e.preventDefault();
    } else if (key === "Backspace") {
      e.preventDefault();
      removeLastPlaced();
      draw();
    } else if (key.toLowerCase() === "m") {
      toggleMute();
      draw();
    } else if (key === "n") {
      newRound(STATE.round + 1);
      playClick();
      draw();
    }
  });

  function focusNextBattery(dir) {
    const len = STATE.batteries.length;
    if (len === 0) return;
    STATE.focusedIndex = (STATE.focusedIndex + dir + len) % len;
    let attempts = 0;
    while (STATE.batteries[STATE.focusedIndex].placed && attempts < len) {
      STATE.focusedIndex = (STATE.focusedIndex + dir + len) % len;
      attempts++;
    }
  }

  // -----------------------
  // Game logic: placement and checks (unchanged)
  // -----------------------
  function isInLampArea(x, y) {
    const lamp = { x: 280, y: 60, w: 160, h: 160 };
    return x >= lamp.x && x <= lamp.x + lamp.w && y >= lamp.y && y <= lamp.y + lamp.h;
  }

  function attemptPlaceBattery(idx) {
    const b = STATE.batteries[idx];
    if (b.placed) return;
    b.placed = true;
    b.picked = false;
    STATE.placed.push(idx);
    playClick();
    evaluateSum();
  }

  function removeLastPlaced() {
    if (STATE.placed.length === 0) {
      STATE.message = `${CHARACTERS.sparky.name}: "No batteries in the lamp yet!"`;
      playError();
      return;
    }
    const idx = STATE.placed.pop();
    const b = STATE.batteries[idx];
    b.placed = false;
    snapBatteryBack(idx);
    STATE.message = `${CHARACTERS.professor.name}: "You removed a battery."`;
    playClick();
  }

  function snapBatteryBack(idx) {
    const baseX = 40 + idx * 128;
    const baseY = 360;
    const b = STATE.batteries[idx];
    b.x = baseX;
    b.y = baseY;
  }

  function currentPlacedSum() {
    return STATE.placed.reduce((s, idx) => s + (STATE.batteries[idx]?.value || 0), 0);
  }

  function evaluateSum() {
    const sum = currentPlacedSum();
    if (sum === STATE.target) {
      STATE.score += 1;
      STATE.message = `${CHARACTERS.bulby.name}: "Bright! You matched the power!"`;
      playSuccess();
      // strong glow animation
      bulbGlow = 1.6;
      setTimeout(() => {
        newRound(STATE.round + 1);
        draw();
      }, 1200);
    } else if (sum > STATE.target) {
      STATE.message = `${CHARACTERS.sparky.name}: "Uh-oh, that's too much power. Remove a battery."`;
      playError();
    } else {
      STATE.message = `${CHARACTERS.professor.name}: "Good! Keep adding. Current power: ${sum}."`;
      playTone({ freq: 660, duration: 0.12, type: "sine", gain: 0.06 });
    }
  }

  // -----------------------
  // Drawing & animation variables
  // -----------------------
  let bulbGlow = 0;
  const particles = [];
  const cloudPaths = [];
  const particleCount = 18;
  const seed = Date.now() % 10000;

  // initialize particles
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * 720,
      y: Math.random() * 120,
      r: 6 + Math.random() * 12,
      speed: 0.02 + Math.random() * 0.12,
      hue: 190 + Math.random() * 60,
      offset: Math.random() * Math.PI * 2
    });
  }

  // create stylized cloud shapes (procedural)
  function createClouds() {
    cloudPaths.length = 0;
    for (let c = 0; c < 4; c++) {
      const cp = [];
      const baseY = 20 + c * 30;
      const baseX = (c % 2 === 0) ? 80 : 220;
      for (let p = 0; p < 5; p++) {
        cp.push({
          x: baseX + p * 140 + (Math.sin((seed + c * 100 + p * 37) / 100) * 30),
          y: baseY + Math.sin((seed + p * 47) / 80) * 12,
          r: 30 + Math.abs(Math.cos(p + c)) * 18
        });
      }
      cloudPaths.push(cp);
    }
  }
  createClouds();

  // -----------------------
  // Drawing functions
  // -----------------------
  function drawBackground() {
    // soft vertical gradient
    const g = ctx.createLinearGradient(0, 0, 0, 480);
    g.addColorStop(0, "#e8f7ff");
    g.addColorStop(0.6, "#f7fbf9");
    g.addColorStop(1, "#fffef9");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 720, 480);

    // horizon subtle grid to evoke circuitry but calm
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = "#8cc6ff";
    ctx.lineWidth = 1;
    for (let y = 220; y < 380; y += 18) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(720, y);
      ctx.stroke();
    }
    ctx.restore();

    // floating soft particles (electrons) with gentle vertical movement
    const t = Date.now() / 1000;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const sway = Math.sin(t * (0.2 + p.speed) + p.offset) * 28;
      const py = (p.y + (t * p.speed * 40)) % 160;
      const px = (p.x + sway + i * 9) % 740 - 10;
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue},60%,85%,${0.06 + (p.r / 48) * 0.08})`;
      ctx.arc(px, py, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // soft stylized clouds
    cloudPaths.forEach((cp, idx) => {
      ctx.save();
      ctx.globalAlpha = 0.25 + idx * 0.03;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      cp.forEach((c, i) => {
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.quadraticCurveTo(c.x - 20, c.y - 18, c.x + 20, c.y);
      });
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });
  }

  function drawLampArea() {
    const lampX = 280;
    const lampY = 60;
    const lampW = 160;
    const lampH = 160;

    // circuit/frame with soft rounded corners
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(84,140,255,0.12)";
    roundRect(ctx, 160, 120, 400, 40, 20, false, true);
    ctx.restore();

    // wires with dashed subtle glow
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#a7d8ff";
    ctx.beginPath();
    ctx.moveTo(160, 140);
    ctx.lineTo(240, 140);
    ctx.lineTo(lampX, lampY + lampH / 2);
    ctx.lineTo(lampX + lampW, lampY + lampH / 2);
    ctx.lineTo(560, 140);
    ctx.stroke();
    ctx.restore();

    // bulb group transform for glow and animation
    ctx.save();
    ctx.translate(lampX + lampW / 2, lampY + lampH / 2);

    // animated glow (pulsing when bulbGlow > 0)
    const glowValue = Math.max(0, Math.min(1.6, bulbGlow));
    for (let i = 0; i < 6; i++) {
      const intensity = 0.06 * (6 - i) * (0.4 + 0.6 * (glowValue));
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,240,160,${intensity})`;
      ctx.arc(0, 0, 44 + i * (8 + glowValue * 4), 0, Math.PI * 2);
      ctx.fill();
    }

    // bulb glass - soft highlight
    ctx.beginPath();
    const bulbGradient = ctx.createRadialGradient(-8, -12, 4, 0, 0, 56);
    bulbGradient.addColorStop(0, "rgba(255,255,255,0.95)");
    bulbGradient.addColorStop(0.4, "rgba(255,250,235,0.85)");
    bulbGradient.addColorStop(1, "rgba(255,244,180,0.6)");
    ctx.fillStyle = bulbGradient;
    ctx.strokeStyle = "rgba(210,150,65,0.9)";
    ctx.lineWidth = 2;
    ctx.ellipse(0, 0, 48, 62, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // filament with subtle animated shimmer
    ctx.beginPath();
    const flick = Math.sin(Date.now() / 150 + seed) * 4 * glowValue;
    ctx.strokeStyle = "rgba(255,170,60,0.95)";
    ctx.lineWidth = 3;
    ctx.moveTo(-18, -6);
    ctx.quadraticCurveTo(0, 6 + flick, 18, -6);
    ctx.stroke();

    // small "electric arcs" when close to target but not over
    const sum = currentPlacedSum();
    if (sum > 0 && sum < STATE.target) {
      const arcCount = Math.min(4, sum);
      for (let a = 0; a < arcCount; a++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,${160 + a * 12},60,${0.12 + 0.08 * a})`;
        ctx.lineWidth = 1 + a * 0.4;
        const sx = -20 + a * 10;
        const sy = -6;
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(sx + 6, sy - 12 - a * 3, sx + 12 + a * 4, sy);
        ctx.stroke();
      }
    }

    ctx.restore();

    // lamp label and target box (stylish)
    ctx.fillStyle = "#0b3a56";
    ctx.font = "600 14px sans-serif";
    ctx.fillText("Power Lamp", lampX + lampW / 2 - 36, lampY - 6);

    // target card with soft shadow
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.08)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#f2ffff";
    roundRect(ctx, lampX + lampW + 12, lampY + lampH / 2 - 30, 150, 60, 10, true, false);
    ctx.restore();

    ctx.fillStyle = "#00617f";
    ctx.font = "600 13px sans-serif";
    ctx.fillText("Target Power", lampX + lampW + 24, lampY + lampH / 2 - 6);
    ctx.fillStyle = "#ff5b6b";
    ctx.font = "700 30px sans-serif";
    ctx.fillText(STATE.target.toString(), lampX + lampW + 82, lampY + lampH / 2 + 28);

    // placed battery small icons inside lamp (arrange in arc)
    const placed = STATE.placed;
    const angleStart = -Math.PI / 2 - 0.5;
    const angleStep = 0.5;
    const radius = 48;
    for (let i = 0; i < placed.length; i++) {
      const idx = placed[i];
      const b = STATE.batteries[idx];
      const ang = angleStart + i * angleStep;
      const tx = lampX + lampW / 2 + Math.cos(ang) * radius - 16;
      const ty = lampY + lampH / 2 + Math.sin(ang) * radius + 8;
      drawSmallBattery(tx, ty, b.value);
    }
  }

  // draw small battery used inside lamp or icons
  function drawSmallBattery(x, y, value) {
    ctx.save();
    ctx.translate(x, y);
    // base
    ctx.fillStyle = "#fff6e6";
    ctx.strokeStyle = "#d0a85a";
    ctx.lineWidth = 1.2;
    roundRect(ctx, 0, 0, 34, 22, 5, true, true);
    // stripe and tip
    ctx.fillStyle = "#ffd88a";
    ctx.fillRect(4, 4, 26, 8);
    ctx.fillStyle = "#ffd76f";
    ctx.fillRect(28, 6, 6, 10);
    // number
    ctx.fillStyle = "#613800";
    ctx.font = "700 12px sans-serif";
    ctx.fillText(value.toString(), 10, 15);
    ctx.restore();
  }

  function drawBatteries() {
    // label
    ctx.font = "700 16px sans-serif";
    ctx.fillStyle = "#014d66";
    ctx.fillText("Battery Pack (drag to lamp)", 40, 340);

    for (let i = 0; i < STATE.batteries.length; i++) {
      const b = STATE.batteries[i];

      // placed ones show as small indicator on the shelf
      if (b.placed) {
        ctx.save();
        ctx.globalAlpha = 0.65;
        drawSmallBattery(560 + (i % 2) * 36, 320 + Math.floor(i / 2) * 28, b.value);
        ctx.restore();
        continue;
      }

      ctx.save();
      // subtle lifted shadow if focused or picked
      if (i === STATE.focusedIndex || b.picked) {
        ctx.shadowColor = "rgba(0,0,0,0.12)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
      } else {
        ctx.shadowBlur = 0;
      }

      // card background with soft gradient
      const grad = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(1, "#fff7ef");
      ctx.fillStyle = grad;
      ctx.strokeStyle = "#f0c77a";
      ctx.lineWidth = 1.8;
      roundRect(ctx, b.x, b.y, b.w, b.h, 12, true, true);

      // top yellow stripe and positive tip
      ctx.fillStyle = "#ffd36a";
      roundRect(ctx, b.x + 8, b.y + 8, b.w - 16, 14, 6, true, false);
      ctx.fillStyle = "#ffdb9f";
      ctx.fillRect(b.x + b.w - 12, b.y + b.h / 2 - 8, 8, 16);

      // numeric value with playful shadow
      ctx.fillStyle = "#5b2f00";
      ctx.font = "700 28px sans-serif";
      ctx.shadowColor = "rgba(255,200,120,0.12)";
      ctx.shadowBlur = 6;
      ctx.fillText(b.value.toString(), b.x + 18, b.y + 40);
      ctx.shadowBlur = 0;

      // focused outline and hint
      if (i === STATE.focusedIndex) {
        ctx.strokeStyle = "#6f9cff";
        ctx.lineWidth = 3;
        roundRect(ctx, b.x - 6, b.y - 6, b.w + 12, b.h + 12, 14, false, true);
        ctx.fillStyle = "#004a6b";
        ctx.font = "12px sans-serif";
        ctx.fillText("Press Enter to place", b.x + 6, b.y - 8);
      }

      // drawn shadow when dragged
      if (b.picked) {
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        roundRect(ctx, b.x + 6, b.y + b.h + 6, b.w - 12, 8, 3, true, false);
      }

      ctx.restore();
    }
  }

  function drawCharactersAndUI() {
    const rightX = 560;

    // Professor — stylized portrait with friendly headset
    ctx.save();
    ctx.fillStyle = CHARACTERS.professor.color;
    roundRect(ctx, rightX, 40, 120, 72, 10, true, false);
    ctx.fillStyle = "#fff";
    ctx.font = "700 13px sans-serif";
    ctx.fillText(CHARACTERS.professor.name, rightX + 10, 66);
    // small avatar circle
    ctx.beginPath();
    ctx.fillStyle = "#fff3d9";
    ctx.arc(rightX + 20, 52, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3b6bff";
    ctx.fillRect(rightX + 6, 68, 30, 6); // glasses hint
    ctx.restore();

    // Speech bubble for messages
    ctx.save();
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, rightX - 40, 120, 200, 64, 12, true, true);
    ctx.fillStyle = "#114b59";
    ctx.font = "12px sans-serif";
    // wrap message if needed
    const msg = STATE.message;
    wrapText(ctx, msg, rightX - 32, 140, 176, 16);
    ctx.restore();

    // Sparky avatar
    ctx.save();
    ctx.translate(rightX + 60, 212);
    // body
    ctx.beginPath();
    ctx.fillStyle = CHARACTERS.sparky.color;
    ctx.ellipse(0, 6, 44, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    // face dot
    ctx.fillStyle = "#452200";
    ctx.beginPath();
    ctx.arc(-10, 2, 3, 0, Math.PI * 2);
    ctx.arc(6, 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#452200";
    ctx.font = "700 12px sans-serif";
    ctx.fillText(CHARACTERS.sparky.name, -30, 32);
    ctx.restore();

    // Bulby avatar
    ctx.save();
    ctx.translate(rightX + 60, 295);
    // glowing orb
    const bg = ctx.createRadialGradient(-6, -6, 4, 0, 0, 36);
    bg.addColorStop(0, "#fffef4");
    bg.addColorStop(1, "#fff68a");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b3e00";
    ctx.font = "700 12px sans-serif";
    ctx.fillText(CHARACTERS.bulby.name, -26, 40);
    ctx.restore();

    // Score box
    ctx.save();
    ctx.fillStyle = "#eefcff";
    roundRect(ctx, rightX, 340, 120, 80, 10, true, true);
    ctx.fillStyle = "#004a6b";
    ctx.font = "700 16px sans-serif";
    ctx.fillText("Score", rightX + 12, 365);
    ctx.font = "700 28px sans-serif";
    ctx.fillText(STATE.score.toString(), rightX + 40, 402);
    ctx.restore();

    // Mute button (top-right) with clearer icon
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = isMuted ? "#ff7b7b" : "#7bd389";
    ctx.arc(690, 28, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 12px sans-serif";
    ctx.fillText(isMuted ? "MUT" : "SND", 678, 32);
    ctx.restore();

    // Accessibility and controls text
    ctx.fillStyle = "#12333f";
    ctx.font = "12px sans-serif";
    ctx.fillText("Controls: Drag with mouse or Arrow keys + Enter.", 40, 430);
    ctx.fillText("Press M to mute/unmute. Backspace removes the last battery.", 40, 448);
  }

  // Utility: draw rounded rectangle
  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (typeof r === "undefined") r = 5;
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

  // Utility: wrap text inside rectangle
  function wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    let iy = y;
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      if (testWidth > maxWidth && n > 0) {
        context.fillText(line, x, iy);
        line = words[n] + " ";
        iy += lineHeight;
      } else {
        line = testLine;
      }
    }
    context.fillText(line, x, iy);
  }

  function draw() {
    // clear canvas
    ctx.clearRect(0, 0, 720, 480);
    drawBackground();
    drawLampArea();
    drawBatteries();
    drawCharactersAndUI();

    // audio unavailable notice
    if (!audioCtx) {
      ctx.fillStyle = "#fff2f2";
      roundRect(ctx, 10, 10, 320, 36, 8, true, false);
      ctx.fillStyle = "#7a1f1f";
      ctx.font = "12px sans-serif";
      ctx.fillText("Audio not available in this browser. Sounds disabled.", 18, 34);
    }

    // bulbGlow decay
    bulbGlow *= 0.94;

    // display current placed sum
    const sum = currentPlacedSum();
    ctx.font = "700 18px sans-serif";
    ctx.fillStyle = sum === STATE.target ? "#0077c8" : "#0a5f73";
    ctx.fillText("Current: " + sum, 300, 240);
  }

  // animate loop
  let rafId = null;
  function loop() {
    // subtle slow cloud movement
    const offset = (Date.now() / 7000);
    cloudPaths.forEach((cp, idx) => {
      for (let p = 0; p < cp.length; p++) {
        cp[p].x += (idx % 2 === 0 ? 0.02 : -0.015) * (1 + idx * 0.2);
        if (cp[p].x > 820) cp[p].x = -80;
        if (cp[p].x < -120) cp[p].x = 800;
      }
    });

    draw();
    rafId = requestAnimationFrame(loop);
  }
  loop();

  // -----------------------
  // Mute toggle & audio safety
  // -----------------------
  function toggleMute() {
    isMuted = !isMuted;
    if (globalGain) {
      globalGain.gain.value = isMuted ? 0 : 0.22;
    }
    // visual cue: small glow pulse
    bulbGlow = isMuted ? 0 : 1.2;
    if (!isMuted) {
      // small pleasant tone on unmute
      playTone({ freq: 880, duration: 0.12, type: "sine", gain: 0.06 });
    } else {
      // subtle low click on mute
      playTone({ freq: 220, duration: 0.08, type: "sine", gain: 0.03 });
    }
  }

  // -----------------------
  // Accessibility: focus handling
  // -----------------------
  canvas.addEventListener("focus", () => {
    canvas.style.outline = "3px solid rgba(102,140,255,0.45)";
  });
  canvas.addEventListener("blur", () => {
    canvas.style.outline = "none";
  });

  // Ensure first click resumes audio
  canvas.addEventListener("pointerdown", resumeAudioContext);

  // -----------------------
  // Resizing & cleanup
  // -----------------------
  window.addEventListener("resize", () => {
    setupHiDPI();
    draw();
  });

  // End of script
})();