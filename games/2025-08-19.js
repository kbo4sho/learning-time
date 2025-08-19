(function () {
  // Spark Squad: Power-Up Puzzle (Visual & Audio Enhancements)
  // Renders into existing element with id "game-of-the-day-stage"
  // Game logic preserved; visuals and audio improved (canvas + Web Audio API only)

  // Configuration
  const STAGE_ID = 'game-of-the-day-stage';
  const WIDTH = 720;
  const HEIGHT = 480;
  const BATTERY_COUNT = 6;
  const MIN_TARGET = 10;
  const MAX_TARGET = 30;
  const LEVEL_TIME = 45; // seconds per round optional
  const ELECTRON_COLOR = '#ffee66';

  // Get container
  const container = document.getElementById(STAGE_ID);
  if (!container) {
    console.error('Game container not found: #' + STAGE_ID);
    return;
  }

  // Prepare container
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = WIDTH + 'px';
  container.style.height = HEIGHT + 'px';
  container.style.userSelect = 'none';
  container.tabIndex = 0; // make it focusable

  // Accessibility text for screen readers
  const srText = document.createElement('div');
  srText.setAttribute('aria-hidden', 'false');
  srText.style.position = 'absolute';
  srText.style.left = '-9999px';
  srText.style.top = 'auto';
  srText.style.width = '1px';
  srText.style.height = '1px';
  srText.style.overflow = 'hidden';
  srText.id = 'spark-squad-instructions';
  srText.innerText =
    'Spark Squad: Power-Up Puzzle. Use arrow keys to move between batteries. Press Space or Enter to select a battery to add to the circuit. Press Backspace or C to clear selection. Press M to toggle sound. Choose batteries to add up to the target number shown. When you hit the correct number, the bulb lights!';
  container.appendChild(srText);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.style.width = WIDTH + 'px';
  canvas.style.height = HEIGHT + 'px';
  canvas.style.display = 'block';
  canvas.style.background = '#071722';
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', 'Spark Squad electricity math game canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Web Audio setup with robust error handling
  let audioCtx = null;
  let audioAllowed = true;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  } catch (err) {
    console.warn('Web Audio API not supported or failed to create context:', err);
    audioAllowed = false;
    audioCtx = null;
  }

  // Master nodes
  let masterGain = null;
  let masterComp = null;
  if (audioCtx) {
    try {
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.9;
      // Light compressor to keep peaks friendly
      masterComp = audioCtx.createDynamicsCompressor();
      masterComp.threshold.setValueAtTime(-12, audioCtx.currentTime);
      masterComp.knee.setValueAtTime(6, audioCtx.currentTime);
      masterComp.ratio.setValueAtTime(6, audioCtx.currentTime);
      masterComp.attack.setValueAtTime(0.01, audioCtx.currentTime);
      masterComp.release.setValueAtTime(0.3, audioCtx.currentTime);
      masterGain.connect(masterComp);
      masterComp.connect(audioCtx.destination);
    } catch (err) {
      console.warn('Failed to create audio nodes:', err);
      audioAllowed = false;
      masterGain = null;
      masterComp = null;
    }
  }

  // Helper to resume audio context after gesture
  async function ensureAudioRunning() {
    if (!audioAllowed || !audioCtx) return false;
    try {
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      return true;
    } catch (err) {
      console.warn('Could not resume audio context:', err);
      return false;
    }
  }

  // Sound generation helpers (using oscillators + filters)
  // Short pluck click (positive selection)
  function playClick() {
    if (!audioAllowed || !audioCtx || !masterGain) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();

      // bright pluck
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(980 + Math.random() * 120, now);
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(600, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.26);
    } catch (err) {
      console.warn('Error playing click sound:', err);
    }
  }

  // Correct sequence: small harmonic arpeggio with gentle bell-like tone
  function playCorrect() {
    if (!audioAllowed || !audioCtx || !masterGain) return;
    try {
      const now = audioCtx.currentTime;
      const base = 440;
      const intervals = [0, 4, 7]; // major triad
      intervals.forEach((interval, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(
          base * Math.pow(2, interval / 12) * (1 + idx * 0.002),
          now + idx * 0.08
        );
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2600 - idx * 400, now + idx * 0.08);
        gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.16 - idx * 0.03, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.6);
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.65);
      });

      // add a soft bell shimmer (higher octave)
      const bell = audioCtx.createOscillator();
      const bellGain = audioCtx.createGain();
      const bellFilter = audioCtx.createBiquadFilter();
      bell.type = 'triangle';
      bell.frequency.setValueAtTime(1320, now + 0.04);
      bellFilter.type = 'bandpass';
      bellFilter.frequency.setValueAtTime(1320, now + 0.04);
      bellGain.gain.setValueAtTime(0.0001, now + 0.04);
      bellGain.gain.linearRampToValueAtTime(0.08, now + 0.06);
      bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      bell.connect(bellFilter);
      bellFilter.connect(bellGain);
      bellGain.connect(masterGain);
      bell.start(now + 0.04);
      bell.stop(now + 0.6);
    } catch (err) {
      console.warn('Error playing correct sound:', err);
    }
  }

  // Incorrect: short low thud then subtle dissonant wobble
  function playIncorrect() {
    if (!audioAllowed || !audioCtx || !masterGain) return;
    try {
      const now = audioCtx.currentTime;
      // thud
      const thud = audioCtx.createOscillator();
      const thudGain = audioCtx.createGain();
      const thudFilter = audioCtx.createBiquadFilter();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(120, now);
      thudFilter.type = 'lowpass';
      thudFilter.frequency.setValueAtTime(600, now);
      thudGain.gain.setValueAtTime(0.0001, now);
      thudGain.gain.linearRampToValueAtTime(0.16, now + 0.01);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      thud.connect(thudFilter);
      thudFilter.connect(thudGain);
      thudGain.connect(masterGain);
      thud.start(now);
      thud.stop(now + 0.45);

      // wobble (slight unpleasantness)
      const wob = audioCtx.createOscillator();
      const wobGain = audioCtx.createGain();
      wob.type = 'sawtooth';
      wob.frequency.setValueAtTime(220, now + 0.06);
      wobGain.gain.setValueAtTime(0.0001, now + 0.06);
      wobGain.gain.linearRampToValueAtTime(0.06, now + 0.08);
      wobGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      wob.connect(wobGain);
      wobGain.connect(masterGain);
      wob.start(now + 0.06);
      wob.stop(now + 0.45);
    } catch (err) {
      console.warn('Error playing incorrect sound:', err);
    }
  }

  // Background ambient pad using two detuned oscillators and slow LFO on filter/gain
  let padNodes = null;
  function startBackgroundPad() {
    if (!audioAllowed || !audioCtx || !masterGain) return;
    try {
      if (padNodes) return; // already running
      const now = audioCtx.currentTime;
      // create nodes
      const oscA = audioCtx.createOscillator();
      const oscB = audioCtx.createOscillator();
      const padGain = audioCtx.createGain();
      const padFilter = audioCtx.createBiquadFilter();
      const lfo = audioCtx.createOscillator();
      const lfoGain = audioCtx.createGain();

      // oscillators - low, pleasant
      oscA.type = 'sine';
      oscB.type = 'sine';
      oscA.frequency.setValueAtTime(55, now);
      oscB.frequency.setValueAtTime(55 * 1.01, now); // slight detune
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(900, now);
      padGain.gain.setValueAtTime(0.02, now);

      // LFO to modulate filter for breathing effect
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.08, now);
      lfoGain.gain.setValueAtTime(350, now); // amount of filter modulation
      lfo.connect(lfoGain);
      lfoGain.connect(padFilter.frequency);

      // connect chain
      oscA.connect(padFilter);
      oscB.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(masterGain);

      // start everything
      oscA.start(now);
      oscB.start(now);
      lfo.start(now);

      // remember nodes to stop later
      padNodes = { oscA, oscB, padGain, padFilter, lfo, lfoGain };
    } catch (err) {
      console.warn('Could not start background pad:', err);
      padNodes = null;
    }
  }

  function stopBackgroundPad() {
    if (!padNodes) return;
    try {
      const now = audioCtx.currentTime;
      // fade out gently
      padNodes.padGain.gain.cancelScheduledValues(now);
      padNodes.padGain.gain.setValueAtTime(padNodes.padGain.gain.value, now);
      padNodes.padGain.gain.linearRampToValueAtTime(0.0001, now + 0.6);
      // stop oscillators after fade
      setTimeout(() => {
        try {
          padNodes.oscA.stop();
        } catch (e) {}
        try {
          padNodes.oscB.stop();
        } catch (e) {}
        try {
          padNodes.lfo.stop();
        } catch (e) {}
        padNodes = null;
      }, 750);
    } catch (err) {
      console.warn('Error stopping background pad:', err);
      padNodes = null;
    }
  }

  // Gentle victory shimmer (extra pad layer) while bulb lit
  let victoryPad = null;
  function startVictoryPad() {
    if (!audioAllowed || !audioCtx || !masterGain) return;
    try {
      if (victoryPad) return;
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const filter = audioCtx.createBiquadFilter();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 1.2);
      victoryPad = { osc, gain, filter };
      setTimeout(() => {
        victoryPad = null;
      }, 1400);
    } catch (err) {
      console.warn('Could not start victory pad:', err);
      victoryPad = null;
    }
  }

  // Game state (unchanged gameplay logic)
  const state = {
    level: 1,
    target: randInt(MIN_TARGET, MAX_TARGET),
    batteries: [],
    selectedIndices: new Set(),
    batteriesSelectedSum: 0,
    selectedIndex: 0,
    solved: false,
    score: 0,
    timeLeft: LEVEL_TIME,
    showMessage: '',
    messageTimer: 0,
    soundOn: audioAllowed,
    electrons: [],
    dust: [], // background floating dust particles for subtle life
    lastTick: performance.now(),
    glowPulse: 0,
  };

  // Initialize batteries for a new round (preserve logic)
  function resetRound() {
    state.target = randInt(MIN_TARGET + state.level - 1, MAX_TARGET + state.level - 1);
    state.batteries = [];
    state.selectedIndices.clear();
    state.batteriesSelectedSum = 0;
    state.selectedIndex = 0;
    state.solved = false;
    state.timeLeft = LEVEL_TIME;
    state.showMessage = '';
    state.messageTimer = 0;
    let remaining = state.target;
    const parts = [];
    const partCount = randInt(2, Math.min(BATTERY_COUNT, Math.max(2, Math.floor(state.target / 4))));
    for (let i = 0; i < partCount - 1; i++) {
      const maxPart = Math.max(1, Math.floor(remaining / (partCount - i)));
      const val = randInt(1, Math.max(1, Math.min(maxPart, 9)));
      parts.push(val);
      remaining -= val;
    }
    parts.push(Math.max(1, remaining));
    while (parts.length < BATTERY_COUNT) {
      parts.push(randInt(1, 9));
    }
    shuffleArray(parts);
    for (let i = 0; i < BATTERY_COUNT; i++) {
      const value = parts[i] || randInt(1, 9);
      state.batteries.push({
        value,
        x: 80 + i * ((WIDTH - 160) / (BATTERY_COUNT - 1)),
        y: HEIGHT - 86,
        width: 72,
        height: 36,
        wobble: Math.random() * 1000,
        glow: 0,
      });
    }
    // electrons cleared
    state.electrons = [];

    // reset dust particles
    state.dust = [];
    for (let i = 0; i < 28; i++) {
      state.dust.push({
        x: Math.random() * WIDTH,
        y: Math.random() * HEIGHT,
        size: 0.6 + Math.random() * 1.8,
        speed: 0.02 + Math.random() * 0.05,
        alpha: 0.06 + Math.random() * 0.14,
      });
    }
  }

  // Utilities
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // Input handling
  let pointer = { x: 0, y: 0, down: false };

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) * (canvas.width / r.width)) || 0;
    pointer.y = ((e.clientY - r.top) * (canvas.height / r.height)) || 0;
  });

  canvas.addEventListener('mousedown', (e) => {
    pointer.down = true;
    handleUserGesture();
    handleClick(pointer.x, pointer.y);
  });

  window.addEventListener('mouseup', () => {
    pointer.down = false;
  });

  canvas.addEventListener(
    'touchstart',
    (e) => {
      handleUserGesture();
      e.preventDefault();
      if (e.touches[0]) {
        const t = e.touches[0];
        const r = canvas.getBoundingClientRect();
        pointer.x = ((t.clientX - r.left) * (canvas.width / r.width)) || 0;
        pointer.y = ((t.clientY - r.top) * (canvas.height / r.height)) || 0;
        handleClick(pointer.x, pointer.y);
      }
    },
    { passive: false }
  );

  canvas.addEventListener(
    'touchmove',
    (e) => {
      e.preventDefault();
      if (e.touches[0]) {
        const t = e.touches[0];
        const r = canvas.getBoundingClientRect();
        pointer.x = ((t.clientX - r.left) * (canvas.width / r.width)) || 0;
        pointer.y = ((t.clientY - r.top) * (canvas.height / r.height)) || 0;
      }
    },
    { passive: false }
  );

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') {
      state.selectedIndex = (state.selectedIndex - 1 + state.batteries.length) % state.batteries.length;
      e.preventDefault();
      handleUserGesture();
    } else if (e.key === 'ArrowRight') {
      state.selectedIndex = (state.selectedIndex + 1) % state.batteries.length;
      e.preventDefault();
      handleUserGesture();
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      toggleBatterySelection(state.selectedIndex);
      handleUserGesture();
    } else if (e.key === 'Backspace' || e.key.toLowerCase() === 'c') {
      e.preventDefault();
      clearSelection();
      handleUserGesture();
    } else if (e.key.toLowerCase() === 'm') {
      e.preventDefault();
      toggleSound();
      handleUserGesture();
    }
  });

  function handleClick(x, y) {
    for (let i = 0; i < state.batteries.length; i++) {
      const b = state.batteries[i];
      if (
        x >= b.x - b.width / 2 &&
        x <= b.x + b.width / 2 &&
        y >= b.y - b.height / 2 &&
        y <= b.y + b.height / 2
      ) {
        state.selectedIndex = i;
        toggleBatterySelection(i);
        return;
      }
    }
    // sound icon region
    if (x >= WIDTH - 48 && x <= WIDTH - 16 && y >= 16 && y <= 48) {
      toggleSound();
    }
  }

  function toggleBatterySelection(index) {
    if (state.solved) return;
    if (state.selectedIndices.has(index)) {
      state.selectedIndices.delete(index);
      state.batteriesSelectedSum -= state.batteries[index].value;
      state.showMessage = 'Removed ' + state.batteries[index].value;
      state.messageTimer = 120;
    } else {
      state.selectedIndices.add(index);
      state.batteriesSelectedSum += state.batteries[index].value;
      state.showMessage = 'Added ' + state.batteries[index].value;
      state.messageTimer = 120;
      spawnElectronsForBattery(index);
      if (state.soundOn) playClick();
    }
    checkSolution();
  }

  function clearSelection() {
    if (state.solved) return;
    state.selectedIndices.clear();
    state.batteriesSelectedSum = 0;
    state.showMessage = 'Cleared';
    state.messageTimer = 120;
    if (state.soundOn) playClick();
  }

  function toggleSound() {
    state.soundOn = !state.soundOn;
    if (state.soundOn) {
      ensureAudioRunning().then((ok) => {
        if (ok) startBackgroundPad();
      });
    } else {
      stopBackgroundPad();
    }
    state.showMessage = state.soundOn ? 'Sound On' : 'Sound Off';
    state.messageTimer = 90;
  }

  // Check whether current selected sum matches target (game logic preserved)
  function checkSolution() {
    if (state.batteriesSelectedSum === state.target) {
      state.solved = true;
      state.score += 1;
      state.showMessage = 'Perfect! Bulb lit!';
      state.messageTimer = 180;
      spawnVictoryElectrons();
      if (state.soundOn) {
        playCorrect();
        startVictoryPad();
      }
      setTimeout(() => {
        state.level += 1;
        resetRound();
      }, 1500);
    } else if (state.batteriesSelectedSum > state.target) {
      state.showMessage = 'Too high!';
      state.messageTimer = 90;
      if (state.soundOn) playIncorrect();
    } else {
      state.showMessage = 'Sum ' + state.batteriesSelectedSum;
      state.messageTimer = 60;
    }
  }

  // Electrons: moving particles along wire from battery to bulb
  function spawnElectronsForBattery(index) {
    const b = state.batteries[index];
    for (let i = 0; i < 7; i++) {
      state.electrons.push({
        fromX: b.x,
        fromY: b.y - 20,
        toX: WIDTH / 2,
        toY: HEIGHT / 2 - 40,
        t: Math.random(),
        speed: 0.006 + Math.random() * 0.02,
        size: 2 + Math.random() * 3,
        hue: 45 + Math.random() * 40,
        wob: Math.random() * 0.8,
      });
    }
    // slight glow on battery
    b.glow = 1.0;
  }

  function spawnVictoryElectrons() {
    for (let i = 0; i < 76; i++) {
      state.electrons.push({
        fromX: WIDTH / 2,
        fromY: HEIGHT / 2 - 40,
        toX: WIDTH / 2 + (Math.random() - 0.5) * 420,
        toY: HEIGHT / 2 - 40 + (Math.random() - 0.5) * 260,
        t: Math.random(),
        speed: 0.004 + Math.random() * 0.04,
        size: 2 + Math.random() * 4,
        hue: 40 + Math.random() * 200,
        wob: Math.random() * 0.8,
      });
    }
  }

  // Main loop
  let rafId = null;
  function startGameLoop() {
    state.lastTick = performance.now();
    if (state.soundOn) startBackgroundPad();
    function tick(now) {
      const dt = Math.min(100, now - state.lastTick);
      update(dt / 1000);
      draw();
      state.lastTick = now;
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
  }

  function stopGameLoop() {
    if (rafId) cancelAnimationFrame(rafId);
  }

  // Update state
  function update(dt) {
    // electrons
    for (let i = state.electrons.length - 1; i >= 0; i--) {
      const e = state.electrons[i];
      e.t += e.speed * dt * 60;
      if (e.t > 1.1) {
        state.electrons.splice(i, 1);
      } else {
        // wiggle
        e.wob = (e.wob || 0) + dt * 6;
      }
    }
    // dust drift
    for (const d of state.dust) {
      d.x += d.speed * dt * 80;
      d.y -= d.speed * dt * 12;
      if (d.x > WIDTH + 10) d.x = -10;
      if (d.y < -10) d.y = HEIGHT + 10;
    }
    // battery glow fade
    for (const b of state.batteries) {
      b.glow = Math.max(0, b.glow - dt * 1.8);
    }
    // message timer
    if (state.messageTimer > 0) state.messageTimer--;
    // subtle pulse used for bulb glow
    state.glowPulse += dt * 2;
  }

  // Drawing helpers
  function drawRoundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
  }

  // Main draw
  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Background gradient with subtle vignette
    const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    bg.addColorStop(0, '#06141a');
    bg.addColorStop(0.6, '#082b33');
    bg.addColorStop(1, '#08323a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // Soft vignette overlay
    ctx.save();
    const vg = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, WIDTH / 4, WIDTH / 2, HEIGHT / 2, WIDTH / 1.2);
    vg.addColorStop(0, 'rgba(255,255,255,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.restore();

    // Floating subtle dust / particles
    drawDust();

    // Soft circuit board traces in background
    drawCircuitPattern();

    // HUD: title & target
    drawHUD();

    // Central circuit: wires + bulb
    drawBulbAndWires();

    // Batteries on bottom with nicer style
    drawBatteries();

    // Electrons traveling
    drawElectrons();

    // Characters (stylized)
    drawCharacters();

    // Message & controls
    drawMessage();
    drawInstructions();
    drawSoundIcon();
  }

  function drawDust() {
    ctx.save();
    for (const d of state.dust) {
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,255,255,${d.alpha * 0.7})`;
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCircuitPattern() {
    ctx.save();
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 14; i++) {
      ctx.beginPath();
      const y = 32 + i * 30 + Math.sin(performance.now() / 900 + i * 0.6) * 6;
      ctx.moveTo(30, y);
      const cp1x = 150 + Math.cos(i) * 10;
      const cp1y = y - 20 - (i % 3) * 8;
      const cp2x = 520 - Math.cos(i) * 10;
      const cp2y = y + 18 + (i % 4) * 8;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, WIDTH - 30, y + (i % 2) * 4);
      ctx.strokeStyle = i % 3 === 0 ? '#0aa' : '#09c';
      ctx.lineWidth = i % 3 === 0 ? 1.2 : 0.8;
      ctx.stroke();
    }
    // small plated pads
    for (let p = 0; p < 12; p++) {
      const px = 40 + p * 56;
      const py = 40 + ((p * 31) % 220);
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.02)';
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHUD() {
    ctx.save();
    // Title
    ctx.fillStyle = '#e8fbff';
    ctx.font = '700 20px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Spark Squad', 20, 28);
    ctx.font = '14px Inter, sans-serif';
    ctx.fillStyle = '#bfe9eb';
    ctx.fillText('Power-Up Puzzle', 20, 48);
    // Level + score
    ctx.font = '13px Inter, sans-serif';
    ctx.fillStyle = '#cfe';
    ctx.fillText('Level ' + state.level + '  •  Score ' + state.score, WIDTH - 160, 36);

    // Target display card (center)
    const boxW = 260;
    const bx = WIDTH / 2 - boxW / 2;
    const by = 42;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = 'rgba(6,40,48,0.85)';
    drawRoundedRect(bx, by, boxW, 56, 12);
    ctx.shadowBlur = 0;

    // Target label & value
    ctx.fillStyle = '#aef';
    ctx.font = '13px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Target Voltage', WIDTH / 2, 64);
    ctx.fillStyle = '#fff9d6';
    ctx.font = 'bold 34px Inter, sans-serif';
    ctx.fillText(state.target + ' V', WIDTH / 2, 92);
    ctx.restore();
  }

  function drawBulbAndWires() {
    const cx = WIDTH / 2;
    const cy = HEIGHT / 2 - 40;

    // Draw wiring from each battery to bulb, smoother, with faint glow for selected
    for (let i = 0; i < state.batteries.length; i++) {
      const b = state.batteries[i];
      const startX = b.x;
      const startY = b.y - 20;
      const cp1x = startX;
      const cp1y = startY - 80 - (i - state.batteries.length / 2) * 6;
      const cp2x = cx - 24 + (i - state.batteries.length / 2) * 12;
      const cp2y = cy + 16;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, cx, cy - 18);
      if (state.selectedIndices.has(i)) {
        const grad = ctx.createLinearGradient(startX, startY, cx, cy - 18);
        grad.addColorStop(0, '#ffd66a');
        grad.addColorStop(1, '#ff8a3d');
        ctx.strokeStyle = grad;
        ctx.lineWidth = 6;
        ctx.shadowBlur = 16;
        ctx.shadowColor = 'rgba(255,200,110,0.7)';
      } else {
        ctx.strokeStyle = '#234e4f';
        ctx.lineWidth = 3;
        ctx.shadowBlur = 0;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Bulb base
    ctx.save();
    ctx.fillStyle = '#2b2b2b';
    ctx.fillRect(cx - 26, cy + 22, 52, 18);
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(cx - 22, cy + 24, 44, 14);

    // Bulb glass with pulsing glow when lit
    const lit = state.solved;
    const pulse = 0.5 + Math.sin(state.glowPulse) * 0.15;
    const glassGrad = ctx.createRadialGradient(cx, cy - 10, 6, cx, cy - 10, 90);
    if (lit) {
      glassGrad.addColorStop(0, `rgba(255,250,200,${0.95 * pulse})`);
      glassGrad.addColorStop(0.4, `rgba(255,220,140,${0.75 * pulse})`);
      glassGrad.addColorStop(1, 'rgba(255,190,80,0.06)');
    } else {
      glassGrad.addColorStop(0, 'rgba(240,250,255,0.16)');
      glassGrad.addColorStop(1, 'rgba(255,255,255,0.02)');
    }
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 18, 54, 68, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.stroke();
    ctx.restore();

    // Filament / sparkle
    ctx.save();
    if (lit) {
      // bright sparks outward
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,230,150,${0.08 + Math.random() * 0.18})`;
        ctx.lineWidth = 1 + Math.random() * 1.5;
        const rx = cx + (Math.random() - 0.5) * 60;
        const ry = cy - 40 + (Math.random() - 0.5) * 38;
        ctx.moveTo(cx, cy - 18);
        ctx.lineTo(rx, ry);
        ctx.stroke();
      }
      // inner glow ring
      ctx.beginPath();
      ctx.fillStyle = `rgba(255,230,140,${0.15 * pulse})`;
      ctx.arc(cx, cy - 18, 36 + Math.sin(state.glowPulse) * 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // subtle filament
      ctx.beginPath();
      ctx.strokeStyle = '#6b3f00';
      ctx.lineWidth = 2.6;
      ctx.moveTo(cx - 14, cy - 10);
      ctx.quadraticCurveTo(cx, cy - 34, cx + 14, cy - 10);
      ctx.stroke();
    }
    ctx.restore();

    // current sum label below bulb
    ctx.save();
    ctx.fillStyle = '#eef8ff';
    ctx.font = '15px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Current: ' + state.batteriesSelectedSum + ' V', cx, cy + 82);
    ctx.restore();
  }

  function drawBatteries() {
    for (let i = 0; i < state.batteries.length; i++) {
      const b = state.batteries[i];
      const wob = Math.sin((performance.now() + b.wobble) / 420) * 3;
      const x = b.x;
      const y = b.y + wob;
      const w = b.width;
      const h = b.height;

      ctx.save();
      ctx.translate(x, y);

      // base shadow
      ctx.beginPath();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.ellipse(0, h / 2 + 8, w / 2 + 8, 8, 0, 0, Math.PI * 2);
      ctx.fill();

      // battery shell with gradient
      const shellGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      shellGrad.addColorStop(0, '#1f3b40');
      shellGrad.addColorStop(0.5, '#27484a');
      shellGrad.addColorStop(1, '#173236');
      ctx.fillStyle = shellGrad;
      drawRoundedRect(-w / 2, -h / 2, w, h, 8);

      // metallic strip and cap
      ctx.fillStyle = '#d6a556';
      ctx.fillRect(w / 2 - 8, -h / 4, 8, h / 2);

      // value plate
      const plateW = w - 20;
      const plateH = h - 14;
      const plateX = -plateW / 2;
      const plateY = -plateH / 2;
      ctx.fillStyle = state.selectedIndices.has(i) ? 'rgba(255,224,120,0.95)' : 'rgba(32,230,220,0.12)';
      drawRoundedRect(plateX, plateY, plateW, plateH, 6);

      // value text
      ctx.fillStyle = state.selectedIndices.has(i) ? '#13241b' : '#dff7f6';
      ctx.font = 'bold 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.value + 'V', 0, 0);

      // selection ring highlight
      if (state.selectedIndex === i) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2.4;
        ctx.setLineDash([6, 6]);
        ctx.strokeRect(-w / 2 - 8, -h / 2 - 8, w + 16, h + 16);
        ctx.setLineDash([]);
      }

      // soft glow when recently selected
      if (b.glow > 0) {
        ctx.beginPath();
        ctx.fillStyle = `rgba(255,200,90,${Math.min(0.7, b.glow)})`;
        ctx.ellipse(0, 2, w, h + 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function drawElectrons() {
    ctx.save();
    for (const e of state.electrons) {
      const t = Math.min(1, e.t);
      const x1 = e.fromX;
      const y1 = e.fromY;
      const x3 = e.toX;
      const y3 = e.toY;
      const x2 = (x1 + x3) / 2 + Math.sin(e.t * Math.PI * 2 + e.wob) * 20;
      const y2 = Math.min(y1, y3) - 80 + Math.cos(e.t * Math.PI * 2 + e.wob) * 12;

      // quadratic bezier point
      const x = (1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * x2 + t * t * x3;
      const y = (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * y2 + t * t * y3;

      // tail
      ctx.beginPath();
      const hue = e.hue;
      ctx.fillStyle = `hsl(${hue}, 92%, 62%)`;
      ctx.shadowBlur = 12;
      ctx.shadowColor = `hsl(${hue}, 95%, 60%)`;
      ctx.arc(x, y, e.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // tiny glow ring at head
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,230,170,${0.07 + (1 - t) * 0.16})`;
      ctx.lineWidth = 1;
      ctx.arc(x, y, e.size + 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCharacters() {
    // Amp the robot (left)
    const ax = 72;
    const ay = HEIGHT / 2 + 28;
    drawAmp(ax, ay);

    // Blinky the helper (right)
    const bx = WIDTH - 120;
    const by = HEIGHT / 2 - 8;
    drawBlinky(bx, by);
  }

  function drawAmp(x, y) {
    ctx.save();
    ctx.translate(x, y);

    // body shadow
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.ellipse(0, 18, 34, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // torso
    ctx.fillStyle = '#cfe8ea';
    drawRoundedRect(-28, -36, 56, 64, 10);

    // head with screen
    ctx.fillStyle = '#1b2b2d';
    drawRoundedRect(-20, -44, 40, 22, 6);
    ctx.fillStyle = '#dff6f6';
    ctx.font = '12px Inter, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Amp', 0, -30);

    // eyes LED
    ctx.beginPath();
    ctx.fillStyle = '#ffd86a';
    ctx.arc(-7, -18, 4.2, 0, Math.PI * 2);
    ctx.arc(7, -18, 4.2, 0, Math.PI * 2);
    ctx.fill();

    // antenna
    ctx.strokeStyle = '#ffd86a';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(12, -44);
    ctx.lineTo(20, -60);
    ctx.stroke();
    ctx.beginPath();
    ctx.fillStyle = '#ffd86a';
    ctx.arc(20, -62, 4, 0, Math.PI * 2);
    ctx.fill();

    // arms
    ctx.fillStyle = '#bfe9ea';
    ctx.fillRect(-56, -8, 20, 8);
    ctx.fillRect(36, -8, 20, 8);

    ctx.restore();
  }

  function drawBlinky(x, y) {
    ctx.save();
    ctx.translate(x, y);

    // body shadow
    ctx.beginPath();
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.ellipse(0, 28, 28, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // bulb body gradient
    ctx.beginPath();
    const grad = ctx.createRadialGradient(0, -18, 6, 0, -18, 48);
    if (state.solved) {
      grad.addColorStop(0, '#fffcef');
      grad.addColorStop(0.5, '#ffe7a8');
      grad.addColorStop(1, 'rgba(255,200,90,0.06)');
    } else {
      grad.addColorStop(0, '#f7feff');
      grad.addColorStop(1, 'rgba(200,230,250,0.04)');
    }
    ctx.fillStyle = grad;
    ctx.ellipse(0, -18, 36, 48, 0, 0, Math.PI * 2);
    ctx.fill();

    // face label
    ctx.fillStyle = '#123132';
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Blinky', 0, -6);

    // cheeks
    ctx.beginPath();
    ctx.fillStyle = state.solved ? '#ffcfa0' : '#fff2c3';
    ctx.arc(-9, -16, 3.2, 0, Math.PI * 2);
    ctx.arc(9, -16, 3.2, 0, Math.PI * 2);
    ctx.fill();

    // sparks if lit
    if (state.solved) {
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255,240,180,${0.12 + Math.random() * 0.3})`;
        ctx.lineWidth = 1.2;
        const rx = (Math.random() - 0.5) * 76;
        const ry = -18 + (Math.random() - 0.5) * 48;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx + (Math.random() - 0.5) * 12, ry + (Math.random() - 0.5) * 12);
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function drawMessage() {
    if (!state.showMessage) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '16px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.globalAlpha = Math.min(1, state.messageTimer / 120);
    ctx.fillText(state.showMessage, WIDTH / 2, HEIGHT - 18);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawInstructions() {
    ctx.save();
    ctx.fillStyle = 'rgba(220,245,250,0.9)';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Controls: ← → move • Space/Enter pick • Backspace/C clear • M toggle sound', 16, HEIGHT - 6);
    ctx.restore();
  }

  function drawSoundIcon() {
    ctx.save();
    ctx.translate(WIDTH - 36, 24);
    // speaker
    ctx.beginPath();
    ctx.fillStyle = state.soundOn ? '#ffd86a' : '#465b5c';
    ctx.moveTo(-12, -8);
    ctx.lineTo(-2, -8);
    ctx.lineTo(6, -16);
    ctx.lineTo(6, 16);
    ctx.lineTo(-2, 8);
    ctx.lineTo(-12, 8);
    ctx.closePath();
    ctx.fill();

    if (state.soundOn) {
      ctx.strokeStyle = '#ffd86a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, 0, 8, -0.6, 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(10, 0, 12, -0.6, 0.6);
      ctx.stroke();
    } else {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-2, -6);
      ctx.lineTo(12, 10);
      ctx.moveTo(12, -6);
      ctx.lineTo(-2, 10);
      ctx.stroke();
    }
    ctx.restore();
  }

  // User gesture to enable audio
  function handleUserGesture() {
    if (audioCtx && audioCtx.state === 'suspended') {
      ensureAudioRunning().then((ok) => {
        if (ok && state.soundOn) startBackgroundPad();
      });
    } else if (state.soundOn && audioCtx) {
      startBackgroundPad();
    }
  }

  // Initialize and start
  resetRound();
  startGameLoop();

  if (audioAllowed && state.soundOn) {
    ensureAudioRunning().then((ok) => {
      if (ok) startBackgroundPad();
    });
  }

  // Clean up on unload
  window.addEventListener('unload', () => {
    stopGameLoop();
    try {
      stopBackgroundPad();
    } catch (e) {}
    try {
      if (audioCtx) audioCtx.close();
    } catch (e) {}
  });

  // Prevent unhandled rejection noise from audio resume attempts
  window.addEventListener('unhandledrejection', (evt) => {
    console.warn('Unhandled promise rejection:', evt.reason);
  });
})();