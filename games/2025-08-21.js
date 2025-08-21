(function () {
  // Improved visuals & audio for "Spark's Circuit Quest"
  // Renders into existing HTML element with id "game-of-the-day-stage".
  // Game mechanics and math logic unchanged; visuals and audio improved.
  // All graphics drawn on canvas; all audio generated with Web Audio API.

  // ------------------ Setup and Utilities ------------------
  const CONTAINER_ID = "game-of-the-day-stage";
  const WIDTH = 720;
  const HEIGHT = 480;

  // Find container
  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    console.error(`Container element with id "${CONTAINER_ID}" not found.`);
    return;
  }
  // Clear container
  container.innerHTML = "";

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.width = WIDTH + "px";
  canvas.style.height = HEIGHT + "px";
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "Spark's Circuit Quest. Use arrow keys or WASD to move Spark the electron. Collect numbered orbs to match the target power for each bulb. Press M to toggle sound. Press Enter to start."
  );
  canvas.setAttribute("tabindex", "0"); // make focusable
  canvas.title = "Spark's Circuit Quest - Canvas Game";
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: false });

  // Keyboard state
  const keys = {};
  // Mouse state
  let mouse = { x: 0, y: 0, down: false };

  // Focus canvas for keyboard
  canvas.focus();

  // Helper: clamp
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ----------- Audio Setup (Web Audio API) -------------
  let audioContext = null;
  let audioAvailable = true;
  let audioMuted = false;
  let bgGain = null;
  let ambientNodes = [];
  let noiseBuffer = null;

  // Try to create AudioContext with error handling
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      throw new Error("Web Audio API not supported in this browser.");
    }
    audioContext = new AudioCtx();
  } catch (e) {
    console.warn("AudioContext creation failed:", e);
    audioAvailable = false;
    audioContext = null;
  }

  // Create a short noise buffer used for buzz effect
  function createNoiseBuffer() {
    if (!audioAvailable || !audioContext) return null;
    try {
      const sampleRate = audioContext.sampleRate;
      const length = sampleRate * 1.0; // 1s buffer
      const buf = audioContext.createBuffer(1, length, sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < length; i++) {
        // subtle filtered noise (brown-ish)
        data[i] = (Math.random() * 2 - 1) * 0.6;
      }
      return buf;
    } catch (err) {
      console.warn("createNoiseBuffer failed:", err);
      return null;
    }
  }

  // Ensure audio resumes on first user gesture (browsers require that)
  function tryResumeAudio() {
    if (!audioAvailable || !audioContext) return;
    if (audioContext.state === "suspended") {
      audioContext
        .resume()
        .then(() => {
          // Start ambient if not already
          startAmbient();
        })
        .catch((err) => {
          console.warn("Failed to resume audio context:", err);
        });
    } else {
      startAmbient();
    }
  }

  // Start a gentle layered ambient: two detuned oscillators + subtle LFO
  function startAmbient() {
    if (!audioAvailable || !audioContext) return;
    if (bgGain) return; // already started

    try {
      bgGain = audioContext.createGain();
      bgGain.gain.value = audioMuted ? 0 : 0.03;
      bgGain.connect(audioContext.destination);

      // low drone
      const osc1 = audioContext.createOscillator();
      osc1.type = "sine";
      osc1.frequency.value = 90;
      const g1 = audioContext.createGain();
      g1.gain.value = 0.6;
      osc1.connect(g1);
      g1.connect(bgGain);

      // soft harmonic
      const osc2 = audioContext.createOscillator();
      osc2.type = "triangle";
      osc2.frequency.value = 132; // close harmonic
      const g2 = audioContext.createGain();
      g2.gain.value = 0.4;
      osc2.connect(g2);
      g2.connect(bgGain);

      // subtle slow LFO to modulate overall gain (breathing)
      const lfo = audioContext.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.15;
      const lfoGain = audioContext.createGain();
      lfoGain.gain.value = 0.012;
      lfo.connect(lfoGain);
      lfoGain.connect(bgGain.gain);

      osc1.start();
      osc2.start();
      lfo.start();

      ambientNodes.push({ osc: osc1, gain: g1, type: "osc" });
      ambientNodes.push({ osc: osc2, gain: g2, type: "osc" });
      ambientNodes.push({ osc: lfo, gain: lfoGain, type: "lfo" });

      // prepare noise buffer
      noiseBuffer = createNoiseBuffer();
    } catch (err) {
      console.warn("startAmbient failed:", err);
    }
  }

  function stopAmbient() {
    if (!audioAvailable || !audioContext || ambientNodes.length === 0) return;
    try {
      for (const n of ambientNodes) {
        try {
          if (n.osc && typeof n.osc.stop === "function") n.osc.stop();
          n.osc.disconnect();
        } catch (e) {
          /* ignore */
        }
        try {
          if (n.gain) n.gain.disconnect();
        } catch (e) {}
      }
    } catch (err) {
      console.warn("stopAmbient failed:", err);
    }
    ambientNodes = [];
    bgGain && bgGain.disconnect();
    bgGain = null;
  }

  // Simple tone generator with small harmonic richness
  function playTone({ freq = 440, duration = 0.12, type = "sine", volume = 0.06, harmonics = 1 }) {
    if (!audioAvailable || !audioContext || audioMuted) return;
    try {
      const now = audioContext.currentTime;
      const master = audioContext.createGain();
      master.gain.setValueAtTime(volume, now);
      master.connect(audioContext.destination);

      // main oscillator
      const osc = audioContext.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      const g = audioContext.createGain();
      g.gain.setValueAtTime(1, now);
      osc.connect(g);
      g.connect(master);

      // add a soft harmonic layer for warmth
      const harm = audioContext.createOscillator();
      harm.type = "triangle";
      harm.frequency.setValueAtTime(freq * 2, now);
      const hg = audioContext.createGain();
      hg.gain.setValueAtTime(0.12 * harmonics, now);
      harm.connect(hg);
      hg.connect(master);

      // envelope
      master.gain.setValueAtTime(volume, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + duration + 0.02);

      osc.start(now);
      harm.start(now);
      osc.stop(now + duration + 0.02);
      harm.stop(now + duration + 0.02);
    } catch (err) {
      console.warn("playTone error:", err);
    }
  }

  // Pleasant multi-note chime for correct
  function playCorrectChime() {
    if (!audioAvailable || !audioContext || audioMuted) return;
    try {
      const notes = [880, 660, 990];
      notes.forEach((n, i) => {
        setTimeout(() => {
          playTone({
            freq: n,
            duration: 0.12 + i * 0.02,
            type: "sine",
            volume: 0.05 + i * 0.01,
            harmonics: 1 + i,
          });
        }, i * 110);
      });
    } catch (err) {
      console.warn("playCorrectChime error:", err);
    }
  }

  // Buzz effect using noise buffer + filter for overload
  function playBuzz() {
    if (!audioAvailable || !audioContext || audioMuted) return;
    try {
      if (!noiseBuffer) noiseBuffer = createNoiseBuffer();
      if (!noiseBuffer) return;

      const src = audioContext.createBufferSource();
      src.buffer = noiseBuffer;

      const filter = audioContext.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 280;
      filter.Q.value = 0.8;

      const gain = audioContext.createGain();
      gain.gain.value = 0.12;

      src.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);

      src.start();
      // fade out quickly
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.6);
      src.stop(audioContext.currentTime + 0.65);
    } catch (err) {
      console.warn("playBuzz error:", err);
    }
  }

  // Soft pickup tone with small sparkle
  function playPickup(value) {
    if (!audioAvailable || !audioContext || audioMuted) return;
    try {
      const base = 520 + value * 18 + (Math.random() * 20 - 10);
      playTone({ freq: base, duration: 0.09, type: "sine", volume: 0.06, harmonics: 1 });
      // tiny high sparkle
      setTimeout(() => {
        playTone({ freq: base * 1.9, duration: 0.06, type: "triangle", volume: 0.03, harmonics: 0.8 });
      }, 40);
    } catch (err) {
      console.warn("playPickup error:", err);
    }
  }

  // ------------- Game Variables ----------------
  let lastTime = 0;
  let running = false;

  // Characters and theme
  const characters = {
    spark: {
      name: "Spark",
      color: "#FFD66B",
      x: WIDTH / 2,
      y: HEIGHT - 80,
      radius: 18,
      speed: 180, // pixels per second
      trail: [],
      trailMax: 14,
    },
    professor: {
      name: "Professor Ohm",
      color: "#9FD8FF",
    },
    bulby: {
      name: "Bulby",
      color: "#FFF1C6",
    },
  };

  // Game state
  let level = 1;
  let bulbsToPower = 3;
  let currentBulbIndex = 0;
  let targetValue = 10;
  let orbs = []; // number orbs on screen
  let collectedSum = 0;
  let lives = 3;
  let score = 0;
  let phase = "start"; // start, playing, success, gameover
  let flashTimer = 0;
  let gentleParticles = [];

  // Visual-only transient particles on pickups/overload
  let visualBursts = [];

  // Accessibility state: update canvas aria-label with dynamic info
  function updateAria() {
    const ariaText =
      `Spark's Circuit Quest. Level ${level}, Bulb ${currentBulbIndex + 1} of ${bulbsToPower}. ` +
      `Target power ${targetValue}. Current collected ${collectedSum}. Lives ${lives}. ` +
      `Use arrow keys or WASD to move. Press M to toggle sound. Press Enter to start or continue.`;
    canvas.setAttribute("aria-label", ariaText);
  }

  // ------------- Procedural content ----------------
  function generateOrbs(count = 6) {
    orbs = orbs || [];
    for (let i = 0; i < count; i++) {
      const val = Math.floor(Math.random() * 9) + 1; // 1..9
      const r = 16 + Math.random() * 16;
      const x = 60 + Math.random() * (WIDTH - 120);
      const y = 120 + Math.random() * (HEIGHT - 220);
      const vx = (Math.random() * 2 - 1) * 40;
      const phase = Math.random() * Math.PI * 2;
      orbs.push({
        value: val,
        x,
        y,
        r,
        vx,
        wobble: 12 + Math.random() * 28,
        baseY: y,
        phase,
        floatSpeed: 0.8 + Math.random() * 1.2,
        id: Math.random().toString(36).slice(2, 9),
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() * 2 - 1) * 0.6,
      });
    }
  }

  function nextBulb() {
    currentBulbIndex++;
    collectedSum = 0;
    if (currentBulbIndex >= bulbsToPower) {
      // level completed
      level++;
      bulbsToPower = Math.min(4 + level, 6);
      currentBulbIndex = 0;
      score += 50; // bonus
      phase = "success";
      setTimeout(() => {
        startLevel();
        phase = "playing";
      }, 1600);
    } else {
      // new bulb target
      setUpCurrentBulb();
    }
    updateAria();
  }

  function setUpCurrentBulb() {
    // target increases with level and bulb index (kept unchanged)
    const base = 6 + level * 2 + currentBulbIndex * 1;
    targetValue = base + Math.floor(Math.random() * 8);
    targetValue = Math.max(4, targetValue);
    orbs = [];
    generateOrbs(6 + Math.min(level, 3));
    collectedSum = 0;
    flashTimer = 0;
    updateAria();
  }

  function startLevel() {
    phase = "playing";
    setUpCurrentBulb();
    lives = Math.max(1, 3 - Math.floor(level / 3));
    score = 0;
    characters.spark.x = WIDTH / 2;
    characters.spark.y = HEIGHT - 80;
    characters.spark.trail = [];
  }

  function resetGame() {
    level = 1;
    bulbsToPower = 3;
    currentBulbIndex = 0;
    score = 0;
    lives = 3;
    startLevel();
  }

  // ------------- Input Handlers ----------------
  window.addEventListener("keydown", (e) => {
    keys[e.key.toLowerCase()] = true;
    // allow resume audio on any key press
    tryResumeAudio();

    if (e.key === "m" || e.key === "M") {
      audioMuted = !audioMuted;
      if (bgGain) bgGain.gain.value = audioMuted ? 0 : 0.03;
      updateAria();
      e.preventDefault();
    }

    if (e.key === "Enter") {
      if (phase === "start" || phase === "gameover" || phase === "success") {
        resetGame();
        phase = "playing";
      }
      e.preventDefault();
    }
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key.toLowerCase()] = false;
  });

  canvas.addEventListener("mousedown", (e) => {
    mouse.down = true;
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    // click is considered a user gesture; resume audio
    tryResumeAudio();
    // On click during start screen start the game
    if (phase === "start" || phase === "gameover" || phase === "success") {
      resetGame();
      phase = "playing";
    }
  });

  canvas.addEventListener("mouseup", () => {
    mouse.down = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  // Touch support: translate to mouse
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      mouse.down = true;
      mouse.x = t.clientX - rect.left;
      mouse.y = t.clientY - rect.top;
      tryResumeAudio();
      if (phase === "start" || phase === "gameover" || phase === "success") {
        resetGame();
        phase = "playing";
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const t = e.touches[0];
      mouse.x = t.clientX - rect.left;
      mouse.y = t.clientY - rect.top;
    },
    { passive: false }
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      mouse.down = false;
    },
    { passive: false }
  );

  // ------------- Collision Helpers --------------
  function dist2(ax, ay, bx, by) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  // ------------- Particle gentle background -------------
  function spawnParticles() {
    gentleParticles = [];
    for (let i = 0; i < 48; i++) {
      gentleParticles.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        r: 0.8 + Math.random() * 3.2,
        alpha: 0.05 + Math.random() * 0.18,
        vy: 6 + Math.random() * 20,
        vx: -2 + Math.random() * 4,
        hue: 160 + Math.random() * 30,
      });
    }
  }

  // Visual burst when collecting or overload (purely canvas)
  function spawnBurst(x, y, color = "#FFD66B", count = 18) {
    for (let i = 0; i < count; i++) {
      visualBursts.push({
        x,
        y,
        vx: (Math.random() * 2 - 1) * 140,
        vy: (Math.random() * -1.6) * 120 + Math.random() * -40,
        life: 0.5 + Math.random() * 0.6,
        r: 1 + Math.random() * 3,
        color,
      });
    }
  }

  // ------------- Gameplay Logic ----------------
  function update(dt) {
    if (phase === "start") {
      // slow gentle bob of background particles
      for (const p of gentleParticles) {
        p.x += p.vx * dt * 0.1;
        p.y += p.vy * dt * 0.02;
        if (p.x < -10) p.x = WIDTH + 10;
        if (p.x > WIDTH + 10) p.x = -10;
        if (p.y > HEIGHT + 10) p.y = -10;
      }
      return;
    }

    if (phase === "gameover" || phase === "success") {
      // animate spark gently
      characters.spark.y += Math.sin(Date.now() / 300) * 0.02;
      // update bursts
      for (let i = visualBursts.length - 1; i >= 0; i--) {
        const b = visualBursts[i];
        b.x += b.vx * dt;
        b.y += b.vy * dt + 30 * dt;
        b.life -= dt;
        if (b.life <= 0) visualBursts.splice(i, 1);
      }
      return;
    }

    // Movement: keyboard or mouse control
    const sp = characters.spark;
    let moveX = 0;
    let moveY = 0;
    if (keys["arrowleft"] || keys["a"]) moveX -= 1;
    if (keys["arrowright"] || keys["d"]) moveX += 1;
    if (keys["arrowup"] || keys["w"]) moveY -= 1;
    if (keys["arrowdown"] || keys["s"]) moveY += 1;

    const usingMouse = mouse.down;
    if (usingMouse) {
      // Move toward mouse smoothly
      const dx = mouse.x - sp.x;
      const dy = mouse.y - sp.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 6) {
        moveX = dx / dist;
        moveY = dy / dist;
      } else {
        moveX = 0;
        moveY = 0;
      }
    }

    if (moveX !== 0 || moveY !== 0) {
      // Normalize
      const mag = Math.hypot(moveX, moveY);
      moveX /= mag || 1;
      moveY /= mag || 1;
      sp.x += moveX * sp.speed * dt;
      sp.y += moveY * sp.speed * dt;
      // Keep inside bounds
      sp.x = clamp(sp.x, 24, WIDTH - 24);
      sp.y = clamp(sp.y, 24, HEIGHT - 24);

      // add to trail
      sp.trail.unshift({ x: sp.x, y: sp.y, t: 0.42 });
      if (sp.trail.length > sp.trailMax) sp.trail.pop();
    } else {
      // slowly fade trail
      for (const t of sp.trail) {
        t.t -= dt * 0.3;
      }
      sp.trail = sp.trail.filter((p) => p.t > 0.02);
    }

    // Orbs float and bounce
    for (const o of orbs) {
      o.phase += dt * o.floatSpeed;
      o.y = o.baseY + Math.sin(o.phase) * o.wobble;
      o.x += o.vx * dt;
      o.rot += o.rotSpeed * dt;
      if (o.x < 24) {
        o.x = 24;
        o.vx *= -1;
      }
      if (o.x > WIDTH - 24) {
        o.x = WIDTH - 24;
        o.vx *= -1;
      }
      // gentle vy nudge
      o.baseY += Math.sin(Date.now() / 1000 + o.phase) * 0.02;
    }

    // Check collisions with orbs
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      const rr = (sp.radius + o.r) * (sp.radius + o.r);
      if (dist2(sp.x, sp.y, o.x, o.y) < rr) {
        collectedSum += o.value;
        // small animation: push spark out a bit
        const ang = Math.atan2(sp.y - o.y, sp.x - o.x);
        sp.x += Math.cos(ang) * 8;
        sp.y += Math.sin(ang) * 8;
        // play pickup tone
        playPickup(o.value);
        spawnBurst(o.x, o.y, "#FFF5B1", 10);
        // remove orb
        orbs.splice(i, 1);
        // spawn replacement with some chance
        if (Math.random() < 0.6) {
          setTimeout(() => {
            const val = Math.floor(Math.random() * 9) + 1;
            const r = 16 + Math.random() * 16;
            const x = 60 + Math.random() * (WIDTH - 120);
            const y = 120 + Math.random() * (HEIGHT - 220);
            orbs.push({
              value: val,
              x,
              y,
              r,
              vx: (Math.random() * 2 - 1) * 40,
              wobble: 12 + Math.random() * 28,
              baseY: y,
              phase: Math.random() * Math.PI * 2,
              floatSpeed: 0.8 + Math.random() * 1.2,
              id: Math.random().toString(36).slice(2, 9),
              rot: Math.random() * Math.PI * 2,
              rotSpeed: (Math.random() * 2 - 1) * 0.6,
            });
          }, 480 + Math.random() * 640);
        }
      }
    }

    // Check sums (game logic preserved)
    if (collectedSum === targetValue) {
      // Success for this bulb
      score += 10;
      playCorrectChime();
      spawnBurst(WIDTH - 120, 120, "#FFF1C6", 26);
      nextBulb();
    } else if (collectedSum > targetValue) {
      // Overloaded! Buzz and penalty
      playBuzz();
      flashTimer = 0.8;
      collectedSum = 0;
      spawnBurst(characters.spark.x, characters.spark.y, "#FF9AA2", 28);
      lives--;
      if (lives <= 0) {
        phase = "gameover";
        updateAria();
      }
    }

    // update flash timer
    if (flashTimer > 0) {
      flashTimer -= dt;
      if (flashTimer < 0) flashTimer = 0;
    }

    // Gentle particles drift
    for (const p of gentleParticles) {
      p.x += p.vx * dt * 0.6;
      p.y += p.vy * dt * 0.08;
      if (p.y > HEIGHT + 10) p.y = -10;
      if (p.x > WIDTH + 10) p.x = -10;
      if (p.x < -10) p.x = WIDTH + 10;
    }

    // Update visual bursts
    for (let i = visualBursts.length - 1; i >= 0; i--) {
      const b = visualBursts[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt + 30 * dt;
      b.vy += 180 * dt; // gravity
      b.life -= dt;
      if (b.life <= 0) visualBursts.splice(i, 1);
    }

    // If orbs are empty, generate fresh
    if (orbs.length < 3) {
      generateOrbs(6);
    }

    updateAria();
  }

  // ------------- Drawing Helpers ----------------
  function clear() {
    // gradient background for depth
    const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    g.addColorStop(0, "#071718");
    g.addColorStop(0.5, "#082a28");
    g.addColorStop(1, "#0b3a36");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  function drawBackground() {
    // soft glowing panel behind play area
    ctx.save();
    ctx.globalAlpha = 0.06;
    roundRect(ctx, 28, 36, WIDTH - 56, HEIGHT - 96, 20, true, false);
    ctx.restore();

    // Parallax wavy wires and subtle sparks
    ctx.save();
    for (let i = 0; i < 5; i++) {
      drawWavyWire(40 + i * 30, 80 + i * 28, WIDTH - 40 - i * 30, 80 + i * 28 + i * 12, i * 0.35, i);
    }
    ctx.restore();

    // soft floating panels (bokeh)
    for (const p of gentleParticles) {
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue}, 80%, 65%, ${p.alpha})`;
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWavyWire(x1, y1, x2, y2, wobble, layer = 0) {
    const segments = 18;
    ctx.beginPath();
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t + Math.sin(t * Math.PI * 2 + wobble * Date.now() / 900) * (6 + layer * 2);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = layer % 2 === 0 ? "#2bd3a9" : "#FFD66B";
    ctx.lineWidth = 1.4 + Math.abs(Math.sin(Date.now() / (700 + layer * 120))) * 0.8;
    ctx.globalAlpha = 0.6;
    ctx.stroke();

    // small glow points
    for (let i = 1; i < segments; i += 4) {
      const t = i / segments;
      const x = x1 + (x2 - x1) * t;
      const y = y1 + (y2 - y1) * t + Math.sin(t * Math.PI * 2 + wobble * Date.now() / 900) * (6 + layer * 2);
      ctx.beginPath();
      ctx.fillStyle = "rgba(255,255,220,0.14)";
      ctx.arc(x, y, 3 + Math.abs(Math.cos(Date.now() / 300 + i)) * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (typeof r === "undefined") r = 5;
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
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  function drawCharacters() {
    // Professor Ohm (left): friendly resistor robot
    const profX = 92;
    const profY = HEIGHT - 108;
    ctx.save();
    // body with soft gradient
    const g = ctx.createLinearGradient(profX - 40, profY - 18, profX + 40, profY + 18);
    g.addColorStop(0, "#86e1bb");
    g.addColorStop(1, "#5bb98f");
    ctx.fillStyle = g;
    roundRect(ctx, profX - 36, profY - 18, 72, 36, 18, true, false);

    // eyes
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.arc(profX - 12, profY - 2, 6, 0, Math.PI * 2);
    ctx.arc(profX + 12, profY - 2, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1b2330";
    ctx.beginPath();
    ctx.arc(profX - 13, profY - 2 + Math.sin(Date.now() / 500) * 0.6, 3.2, 0, Math.PI * 2);
    ctx.arc(profX + 11, profY - 2 + Math.cos(Date.now() / 440) * 0.6, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // little antenna with glow
    ctx.strokeStyle = "#ffd66b";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(profX + 36, profY - 8);
    ctx.quadraticCurveTo(profX + 56, profY - 34, profX + 36, profY - 48);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = "#FFE7A1";
    ctx.arc(profX + 36, profY - 48, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Bulb (right): shows current bulb status with richer glow and filament animation
    const bulbX = WIDTH - 120;
    const bulbY = 120;
    ctx.save();
    const percent = clamp(collectedSum / targetValue, 0, 1);
    const glow = 0.06 + percent * 0.8;
    // bloom layers
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255, 230, 120, ${glow * 0.45 / (i + 1)})`;
      ctx.arc(bulbX, bulbY, 48 + percent * 14 + i * 12, 0, Math.PI * 2);
      ctx.fill();
    }
    // glass
    const gg = ctx.createRadialGradient(bulbX - 8, bulbY - 10, 6, bulbX, bulbY, 36);
    gg.addColorStop(0, "rgba(255,255,255,0.95)");
    gg.addColorStop(0.18, "#FFF8D8");
    gg.addColorStop(1, "#FFF0B8");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(bulbX, bulbY, 36, 0, Math.PI * 2);
    ctx.fill();
    // outline and subtle inner shadow
    ctx.strokeStyle = "rgba(220,190,100,0.8)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // animated filament
    ctx.save();
    ctx.translate(bulbX, bulbY);
    ctx.rotate(Math.sin(Date.now() / 420) * 0.03);
    ctx.strokeStyle = `rgba(255,120,50,${0.5 + percent * 0.6})`;
    ctx.lineWidth = 3 + percent * 2;
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.bezierCurveTo(-6, -12 - percent * 10, 6, -12 - percent * 10, 12, 0);
    ctx.stroke();
    ctx.restore();

    // base
    ctx.fillStyle = "#BDBDBD";
    roundRect(ctx, bulbX - 20, bulbY + 28, 40, 14, 3, true, false);
    ctx.restore();
  }

  function drawOrbs() {
    for (const o of orbs) {
      // aura
      const time = Date.now() / 600;
      ctx.beginPath();
      const glowAlpha = 0.12 + Math.abs(Math.sin(time + o.phase)) * 0.08;
      const grad = ctx.createRadialGradient(o.x - 6, o.y - 6, o.r * 0.2, o.x, o.y, o.r + 10);
      grad.addColorStop(0, `rgba(255,250,220,${0.95 * glowAlpha})`);
      grad.addColorStop(0.5, `rgba(255,220,120,${0.65 * glowAlpha})`);
      grad.addColorStop(1, `rgba(255,160,40,${0.02 * glowAlpha})`);
      ctx.fillStyle = grad;
      ctx.arc(o.x, o.y, o.r + 10, 0, Math.PI * 2);
      ctx.fill();

      // orb body with subtle radial highlight to give volume
      const g = ctx.createRadialGradient(o.x - o.r * 0.3, o.y - o.r * 0.3, 4, o.x, o.y, o.r);
      g.addColorStop(0, "#FFFFFF");
      g.addColorStop(0.12, "#FFF5D0");
      g.addColorStop(1, "#FFB84D");
      ctx.beginPath();
      ctx.fillStyle = g;
      ctx.arc(o.x, o.y, o.r, 0, Math.PI * 2);
      ctx.fill();

      // subtle rotation highlight line
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      ctx.beginPath();
      ctx.strokeStyle = "rgba(255,255,255,0.22)";
      ctx.lineWidth = 2;
      ctx.moveTo(-o.r * 0.7, -o.r * 0.2);
      ctx.quadraticCurveTo(-o.r * 0.3, -o.r * 0.8, o.r * 0.6, -o.r * 0.1);
      ctx.stroke();
      ctx.restore();

      // number with shadow
      ctx.fillStyle = "#1b232c";
      ctx.font = `bold ${Math.max(12, Math.floor(o.r))}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.25)";
      ctx.shadowBlur = 6;
      ctx.fillText(String(o.value), o.x, o.y + 1);
      ctx.shadowBlur = 0;
    }
  }

  function drawSpark() {
    const sp = characters.spark;
    // trail
    for (let i = 0; i < sp.trail.length; i++) {
      const t = sp.trail[i];
      const alpha = (t.t / 0.42) * 0.35;
      const size = (sp.radius * 0.7) * (1 - i / sp.trail.length);
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,210,110,${alpha})`;
      ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // glow halo
    const haloG = ctx.createRadialGradient(sp.x - 6, sp.y - 6, sp.radius * 0.2, sp.x, sp.y, sp.radius + 22);
    haloG.addColorStop(0, "rgba(255,230,140,0.65)");
    haloG.addColorStop(1, "rgba(255,230,140,0.02)");
    ctx.beginPath();
    ctx.fillStyle = haloG;
    ctx.arc(sp.x, sp.y, sp.radius + 22, 0, Math.PI * 2);
    ctx.fill();

    // main body with glossy highlight
    const g = ctx.createRadialGradient(sp.x - 6, sp.y - 8, 4, sp.x, sp.y, sp.radius);
    g.addColorStop(0, "#FFFFFF");
    g.addColorStop(0.12, "#FFF1C4");
    g.addColorStop(1, "#FFD66B");
    ctx.beginPath();
    ctx.fillStyle = g;
    ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
    ctx.fill();

    // eyes and smile
    ctx.fillStyle = "#1b232c";
    ctx.beginPath();
    ctx.arc(sp.x - 6, sp.y - 4, 3.2, 0, Math.PI * 2);
    ctx.arc(sp.x + 6, sp.y - 4, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.strokeStyle = "rgba(27,35,44,0.85)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y + 2, 6, 0, Math.PI * 1);
    ctx.stroke();

    // tail spark
    ctx.beginPath();
    ctx.fillStyle = "#FFECA3";
    ctx.ellipse(sp.x - sp.radius - 8, sp.y + 6, 8, 4, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHUD() {
    // Top translucent panel with rounded corners
    ctx.save();
    ctx.fillStyle = "rgba(2, 15, 14, 0.55)";
    roundRect(ctx, 12, 8, WIDTH - 24, 58, 12, true, false);

    // Target (large pill)
    ctx.fillStyle = "#0fffc7";
    roundRect(ctx, 26, 16, 140, 40, 10, true, false);
    ctx.fillStyle = "#05261f";
    ctx.font = "18px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`Target: ${targetValue}`, 26 + 70, 16 + 20);

    // Collected pill
    const collectedColor = collectedSum === targetValue ? "#B6FFCA" : "#FFF1AA";
    roundRect(ctx, 180, 16, 160, 40, 10, true, false);
    ctx.fillStyle = "#07221A";
    ctx.font = "18px sans-serif";
    ctx.fillText(`Collected: ${collectedSum}`, 180 + 80, 16 + 20);

    // Lives and Score small badges
    roundRect(ctx, 352, 16, 108, 40, 10, true, false);
    ctx.fillStyle = "#07221A";
    ctx.fillText(`Lives: ${lives}`, 352 + 54, 16 + 20);

    roundRect(ctx, 468, 16, 108, 40, 10, true, false);
    ctx.fillStyle = "#07221A";
    ctx.fillText(`Score: ${score}`, 468 + 54, 16 + 20);

    // Level indicator
    roundRect(ctx, 584, 16, 108, 40, 10, true, false);
    ctx.fillStyle = "#07221A";
    ctx.fillText(`Level: ${level}`, 584 + 54, 16 + 20);

    // Controls hint smaller
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#CFEFE7";
    ctx.textAlign = "left";
    ctx.fillText(`Move: Arrows / WASD or touch-drag. M toggles sound.`, 26, 40 + 36);

    // Audio icon (interactive visual)
    drawAudioIcon(WIDTH - 54, 34, audioAvailable && !audioMuted);
    ctx.restore();

    // Flash overlay when overload occurs
    if (flashTimer > 0) {
      ctx.save();
      const alpha = Math.min(0.6, flashTimer / 0.8);
      ctx.fillStyle = `rgba(255, 100, 100, ${alpha})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();
    }
  }

  function drawAudioIcon(x, y, on) {
    ctx.save();
    ctx.translate(x, y);
    // speaker block
    ctx.fillStyle = on ? "#b6ffd2" : "#7b8c88";
    ctx.beginPath();
    ctx.moveTo(-12, -10);
    ctx.lineTo(-6, -10);
    ctx.lineTo(0, -16);
    ctx.lineTo(0, 16);
    ctx.lineTo(-6, 10);
    ctx.lineTo(-12, 10);
    ctx.closePath();
    ctx.fill();

    // waves or mute cross
    if (on) {
      ctx.strokeStyle = "#b6ffd2";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, 0, 10, -0.65, 0.65);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(8, 0, 5, -0.4, 0.4);
      ctx.stroke();
    } else {
      ctx.strokeStyle = "#ffb3b3";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(8, -8);
      ctx.lineTo(-12, 12);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawStartScreen() {
    clear();
    drawBackground();

    // Title with subtle neon stroke
    ctx.save();
    ctx.textAlign = "center";
    const titleX = WIDTH / 2;
    ctx.font = "40px 'Segoe UI', Roboto, sans-serif";
    // glow stroke
    ctx.lineWidth = 6;
    ctx.strokeStyle = "rgba(255,220,110,0.14)";
    ctx.strokeText("Spark's Circuit Quest", titleX, 118);
    ctx.fillStyle = "#FFF8D8";
    ctx.fillText("Spark's Circuit Quest", titleX, 118);

    // Subtitle
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#DDEFF3";
    ctx.fillText("Help Spark the electron power wacky bulbs!", titleX, 150);

    // Friendly hero large
    const spX = WIDTH / 2;
    const spY = HEIGHT - 120;
    ctx.beginPath();
    const gg = ctx.createRadialGradient(spX - 8, spY - 8, 6, spX, spY, 40);
    gg.addColorStop(0, "#FFF9E0");
    gg.addColorStop(1, "#FFD66B");
    ctx.fillStyle = gg;
    ctx.arc(spX, spY, 46, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#1b2330";
    ctx.font = "20px sans-serif";
    ctx.fillText("Spark", spX, spY + 8);

    // draw characters for intro
    drawCharacters();

    // Instructions area card
    ctx.fillStyle = "rgba(2, 18, 18, 0.46)";
    roundRect(ctx, 60, 210, WIDTH - 120, 180, 12, true, false);

    ctx.font = "15px sans-serif";
    ctx.fillStyle = "#EAF7F3";
    ctx.textAlign = "left";
    const lines = [
      "How to play:",
      " - Move Spark with arrow keys or WASD, or touch-drag on the screen.",
      " - Collect numbered orbs. Their numbers add up.",
      " - Match the bulb's target power exactly to light it!",
      " - If you go over, the circuit overloads and you lose a life.",
      " - Press M to toggle sound. Press Enter or click to start.",
    ];
    let y = 236;
    for (const line of lines) {
      ctx.fillText(line, 84, y);
      y += 26;
    }

    // tiny hint icon
    ctx.font = "12px sans-serif";
    ctx.fillStyle = "#CFEFE7";
    ctx.fillText("Click or press Enter to begin", WIDTH - 180, HEIGHT - 40);

    ctx.restore();
  }

  function drawGameOver() {
    clear();
    drawBackground();
    drawOrbs();
    drawSpark();
    drawCharacters();
    drawHUD();

    // overlay
    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    roundRect(ctx, WIDTH / 2 - 240, HEIGHT / 2 - 92, 480, 184, 12, true, false);
    ctx.fillStyle = "#FFF8D8";
    ctx.font = "28px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Circuit Overloaded!", WIDTH / 2, HEIGHT / 2 - 10);
    ctx.font = "18px sans-serif";
    ctx.fillStyle = "#EAF7F3";
    ctx.fillText(`Your score: ${score}`, WIDTH / 2, HEIGHT / 2 + 20);
    ctx.fillText("Press Enter or click to play again.", WIDTH / 2, HEIGHT / 2 + 54);
    ctx.restore();
  }

  // ------------- Main Render Loop ----------------
  function render(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(0.06, (timestamp - lastTime) / 1000);
    lastTime = timestamp;

    // Update
    update(dt);

    // Draw
    if (phase === "start") {
      drawStartScreen();
    } else if (phase === "gameover") {
      drawGameOver();
    } else {
      clear();
      drawBackground();
      drawOrbs();
      drawSpark();
      drawCharacters();

      // visual bursts
      for (const b of visualBursts) {
        ctx.beginPath();
        ctx.fillStyle = b.color;
        ctx.globalAlpha = Math.max(0, Math.min(1, b.life));
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      drawHUD();

      // If audio unavailable, show small hint
      if (audioAvailable === false) {
        ctx.save();
        ctx.fillStyle = "#FFCCB3";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "right";
        ctx.fillText("Audio unavailable on this device.", WIDTH - 16, HEIGHT - 14);
        ctx.restore();
      }

      if (phase === "success") {
        ctx.save();
        ctx.fillStyle = "rgba(200,255,200,0.14)";
        roundRect(ctx, WIDTH / 2 - 200, HEIGHT / 2 - 66, 400, 132, 12, true, false);
        ctx.fillStyle = "#F3FFE9";
        ctx.font = "24px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Level complete! Charging next circuit...", WIDTH / 2, HEIGHT / 2);
        ctx.restore();
      }
    }

    // Next frame
    if (running) requestAnimationFrame(render);
  }

  // ------------- Start and Initialization ----------------
  function init() {
    spawnParticles();
    generateOrbs(6);
    updateAria();

    // try resume audio on first user click
    canvas.addEventListener("click", tryResumeAudio, { once: true });
    canvas.addEventListener("keydown", tryResumeAudio, { once: true });

    // Start drawing loop
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(render);
  }

  // Start on initialization
  init();

  // Start screen set
  phase = "start";

  // expose pause/resume for accessibility or debugging via console
  window.sparkCircuit = {
    pause() {
      running = false;
    },
    resume() {
      if (!running) {
        running = true;
        lastTime = performance.now();
        requestAnimationFrame(render);
      }
    },
    toggleAudio() {
      audioMuted = !audioMuted;
      if (bgGain) bgGain.gain.value = audioMuted ? 0 : 0.03;
    },
  };

  // Provide small friendly messages into aria-label periodically
  setInterval(() => {
    updateAria();
  }, 2500);

  // -------------------- End --------------------
})();