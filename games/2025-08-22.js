(function () {
  // Enhanced Visuals & Audio for Electric Math Game
  // Renders inside element with id "game-of-the-day-stage"
  // Canvas size: 720x480
  // All visuals drawn with canvas. All sounds generated with Web Audio API.
  // Accessibility: keyboard controls, offscreen text updates (aria-live), visual audio indicator.

  // ----- Configuration -----
  const CANVAS_W = 720;
  const CANVAS_H = 480;
  const ROUNDS = 6; // number of rounds per play
  const MIN_TARGET = 6;
  const MAX_TARGET = 15;
  const MAX_WIRES = 4;
  const MIN_WIRE_VAL = 1;
  const MAX_WIRE_VAL = 8;
  const BG_COLOR = '#071029'; // very deep navy
  const PANEL_COLOR = '#0f2544';
  const WIRES_COLORS = ['#FFB400', '#FF6B6B', '#6BCB77', '#4D96FF'];

  // ----- DOM Setup and Accessibility -----
  const container = document.getElementById('game-of-the-day-stage');
  if (!container) {
    console.error('Game container element with ID "game-of-the-day-stage" not found.');
    return;
  }
  container.innerHTML = '';
  container.style.position = 'relative';
  container.style.width = CANVAS_W + 'px';
  container.style.height = CANVAS_H + 'px';
  container.style.userSelect = 'none';

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute(
    'aria-label',
    'Electric math game. Use left and right arrows to select wires, space or enter to toggle. Press S to toggle sound.'
  );
  canvas.style.outline = 'none';
  canvas.style.display = 'block';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  // Offscreen text for screen readers and live updates
  const sr = document.createElement('div');
  sr.setAttribute('aria-live', 'polite');
  sr.style.position = 'absolute';
  sr.style.left = '-9999px';
  container.appendChild(sr);

  // Visual small button for audio (drawn on canvas too) but textual state for screen readers
  let audioAvailable = false;
  let audioEnabled = true;

  // ----- Audio Setup (Web Audio API) -----
  let audioCtx = null;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
      audioAvailable = true;
    } else {
      audioAvailable = false;
    }
  } catch (e) {
    console.warn('AudioContext creation failed:', e);
    audioAvailable = false;
    audioCtx = null;
  }

  // Master nodes and ambient/hum/backing pad
  let masterGain = null;
  let humOsc = null;
  let humGain = null;
  let padOsc = null;
  let padGain = null;
  let padFilter = null;
  let padLFO = null;
  let startedAudioNodes = false;

  if (audioAvailable) {
    try {
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.6;
      masterGain.connect(audioCtx.destination);

      // low continuous hum (subtle)
      humOsc = audioCtx.createOscillator();
      humOsc.type = 'sine';
      humOsc.frequency.value = 90;
      humGain = audioCtx.createGain();
      humGain.gain.value = 0.02; // gentle by default
      humOsc.connect(humGain);
      humGain.connect(masterGain);

      // warm ambient pad using filter + oscillator, low volume
      padOsc = audioCtx.createOscillator();
      padOsc.type = 'sine';
      padOsc.frequency.value = 220;
      padFilter = audioCtx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 320;
      padGain = audioCtx.createGain();
      padGain.gain.value = 0.01;
      padOsc.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(masterGain);

      // LFO to slowly modulate pad filter cutoff for movement
      padLFO = audioCtx.createOscillator();
      padLFO.type = 'sine';
      padLFO.frequency.value = 0.07; // very slow
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 120; // modulation depth
      padLFO.connect(lfoGain);
      lfoGain.connect(padFilter.frequency);

      // Start nodes; we will manage resume on user gesture
      humOsc.start();
      padOsc.start();
      padLFO.start();
      startedAudioNodes = true;
    } catch (e) {
      console.warn('Audio nodes setup failed:', e);
      audioAvailable = false;
    }
  }

  // Utility to ensure AudioContext resumed on user gesture
  async function ensureAudioOnUserGesture() {
    if (!audioAvailable || !audioCtx) return false;
    try {
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      return true;
    } catch (e) {
      console.warn('Unable to resume audio context:', e);
      return false;
    }
  }

  // Sound effects (all using oscillators and filters)
  function playBeep(freq = 880, duration = 0.12, type = 'sine', volume = 0.12) {
    if (!audioAvailable || !audioEnabled) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + Math.max(duration, 0.04));
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 220;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);
      osc.start();
      osc.stop(audioCtx.currentTime + duration + 0.02);
    } catch (e) {
      console.warn('playBeep failed:', e);
    }
  }

  function playClick() {
    playBeep(1200, 0.06, 'triangle', 0.08);
  }

  function playCorrect() {
    if (!audioAvailable || !audioEnabled) return;
    try {
      // small gentle arpeggio celebratory (short)
      const now = audioCtx.currentTime;
      const freqs = [760, 1020, 1280];
      freqs.forEach((f, i) => {
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        const g = audioCtx.createGain();
        const dur = 0.26;
        g.gain.setValueAtTime(0.10 / (i + 1), now + i * 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + dur);
        const filt = audioCtx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 2000 - i * 400;
        osc.frequency.value = f;
        osc.connect(filt);
        filt.connect(g);
        g.connect(masterGain);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + dur + 0.02);
      });
    } catch (e) {
      console.warn('playCorrect failed:', e);
    }
  }

  function playWrong() {
    if (!audioAvailable || !audioEnabled) return;
    try {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      const filt = audioCtx.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 220;
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.18);
      g.gain.setValueAtTime(0.09, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      osc.connect(filt);
      filt.connect(g);
      g.connect(masterGain);
      osc.start();
      osc.stop(now + 0.22);
    } catch (e) {
      console.warn('playWrong failed:', e);
    }
  }

  // ----- Game State -----
  let round = 1;
  let score = 0;
  let target = 10;
  let wires = []; // array of {value, on, x,y,width,height, animScale, glow}
  let selectedWire = 0;
  let solved = false;
  let sparksAnimation = []; // spark particles
  let ambientOrbs = []; // soft background orbs/energy motes
  let lastTime = 0;
  let animPulse = 0;

  function newRound() {
    solved = false;
    // generate target and wires
    target = randInt(MIN_TARGET, MAX_TARGET);
    wires = [];
    // Create subset summing to target (greedy)
    let remaining = target;
    let subsetVals = [];
    while (remaining > 0 && subsetVals.length < MAX_WIRES) {
      const val = Math.min(remaining, randInt(MIN_WIRE_VAL, Math.min(MAX_WIRE_VAL, remaining)));
      subsetVals.push(val);
      remaining -= val;
    }
    if (remaining > 0) subsetVals.push(remaining);
    while (subsetVals.length < MAX_WIRES) {
      subsetVals.push(randInt(MIN_WIRE_VAL, MAX_WIRE_VAL));
    }
    shuffleArray(subsetVals);
    for (let i = 0; i < MAX_WIRES; i++) {
      wires.push({
        value: subsetVals[i],
        on: false,
        x: 120 + i * 140,
        y: 260,
        width: 100,
        height: 36,
        animScale: 1,
        glow: 0,
        twistPhase: Math.random() * Math.PI * 2
      });
    }
    selectedWire = 0;
    // create some ambient orbs
    ambientOrbs = [];
    for (let i = 0; i < 12; i++) {
      ambientOrbs.push({
        x: Math.random() * CANVAS_W,
        y: Math.random() * CANVAS_H,
        r: 8 + Math.random() * 20,
        vx: (Math.random() - 0.5) * 0.08,
        vy: -0.02 - Math.random() * 0.08,
        hue: 200 + Math.random() * 80,
        alpha: 0.02 + Math.random() * 0.06
      });
    }
    announceForSR(
      `Round ${round}. Target ${target}. Use left and right arrows to select a wire. Press space or enter to toggle a wire.`
    );
    updateBackgroundHum();
  }

  // ----- Utilities -----
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  // Announce updates for screen reader
  function announceForSR(text) {
    try {
      sr.textContent = text;
    } catch (e) {
      // ignore
    }
  }

  // ----- Drawing Helpers -----
  function drawRoundedRect(x, y, w, h, r = 8, fill = true, stroke = false, strokeColor = '#000') {
    ctx.beginPath();
    const radius = Math.min(r, w * 0.5, h * 0.5);
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) {
      ctx.strokeStyle = strokeColor;
      ctx.stroke();
    }
  }

  // Background gradient and subtle grid
  function drawBackground(time) {
    // moving gradient
    const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    const t = Math.sin(time * 0.0004) * 0.12;
    g.addColorStop(0, mixColors('#041427', '#071029', 0.2 + t));
    g.addColorStop(1, mixColors('#071029', '#0b2a3a', 0.6 - t));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // subtle diagonal grid for depth
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.strokeStyle = '#AFCDEB';
    ctx.lineWidth = 1;
    const spacing = 34;
    for (let x = -CANVAS_H; x < CANVAS_W + CANVAS_H; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + CANVAS_H, CANVAS_H);
      ctx.stroke();
    }
    ctx.restore();

    // ambient orbs (soft motes)
    ambientOrbs.forEach((orb) => {
      orb.x += orb.vx;
      orb.y += orb.vy;
      if (orb.y < -orb.r) orb.y = CANVAS_H + orb.r;
      if (orb.x < -orb.r) orb.x = CANVAS_W + orb.r;
      if (orb.x > CANVAS_W + orb.r) orb.x = -orb.r;
      ctx.save();
      const orbGrd = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
      orbGrd.addColorStop(0, `hsla(${orb.hue},80%,60%,${orb.alpha})`);
      orbGrd.addColorStop(1, `hsla(${orb.hue},80%,45%,0)`);
      ctx.fillStyle = orbGrd;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // color mix helper
  function mixColors(a, b, t) {
    // a,b hex strings
    const pa = hexToRgb(a);
    const pb = hexToRgb(b);
    const r = Math.round(pa.r + (pb.r - pa.r) * t);
    const g = Math.round(pa.g + (pb.g - pa.g) * t);
    const bl = Math.round(pa.b + (pb.b - pa.b) * t);
    return `rgb(${r},${g},${bl})`;
  }
  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return {
      r: parseInt(h.substring(0, 2), 16),
      g: parseInt(h.substring(2, 4), 16),
      b: parseInt(h.substring(4, 6), 16)
    };
  }

  // ----- Drawing Scene -----
  function drawScene(timestamp) {
    const dt = timestamp - lastTime;
    lastTime = timestamp;
    animPulse += dt * 0.003;

    // Background with ambient motion
    drawBackground(timestamp);

    // Soft skyline panel
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = PANEL_COLOR;
    drawRoundedRect(20, 20, CANVAS_W - 40, 140, 12);
    ctx.restore();

    // Subtle decorative electric arcs top-left
    drawTopArcs(animPulse);

    // Title and characters
    drawTitle();

    // Control panel where wires live
    drawControlPanel(animPulse, dt);

    // Lamp / target display
    drawTargetLamp(animPulse);

    // Score and round display
    drawScoreboard();

    // Characters and wacky elements
    drawCharacters(animPulse);

    // Sparks animation
    updateAndDrawSparks(dt);

    // Instruction and footer
    drawInstructions();

    // Audio indicator
    drawAudioIcon();

    // If round solved, overlay celebration
    if (solved) drawCelebration();

    window.requestAnimationFrame(drawScene);
  }

  function drawTopArcs(pulse) {
    ctx.save();
    ctx.globalAlpha = 0.08 + Math.abs(Math.sin(pulse)) * 0.04;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,255,200,${0.06 + i * 0.02})`;
      ctx.lineWidth = 2 - i * 0.5;
      ctx.arc(90 + i * 40, 60, 26 + i * 8 + Math.sin(pulse + i) * 3, Math.PI * 0.7, Math.PI * 0.25);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTitle() {
    ctx.save();
    ctx.fillStyle = '#EAF8FF';
    ctx.font = '700 28px "Segoe UI", Arial';
    ctx.fillText('Sparky & the Power Puzzle', 34, 56);
    ctx.font = '400 13px "Segoe UI", Arial';
    ctx.fillStyle = '#CFE9FF';
    ctx.fillText('Connect wires to match the power target. Add the wire numbers!', 34, 82);
    ctx.restore();
  }

  function drawControlPanel(pulse, dt) {
    // Panel base
    ctx.save();
    ctx.fillStyle = 'rgba(6,36,40,0.95)';
    drawRoundedRect(40, 180, CANVAS_W - 80, 260, 10);
    ctx.restore();

    // Draw subtle shadow for wires area
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#000';
    drawRoundedRect(44, 184, CANVAS_W - 88, 252, 8);
    ctx.restore();

    // Wires area: draw wire cords and nodes
    wires.forEach((wire, i) => {
      // animate properties smoothly
      wire.animScale += (wire.on ? 0.08 : 0.02) * (wire.on ? 0.5 : -0.2);
      wire.animScale = Math.max(0.92, Math.min(1.08, wire.animScale));
      wire.glow += wire.on ? 0.06 : -0.06;
      wire.glow = Math.max(0, Math.min(1, wire.glow));
      wire.twistPhase += dt * 0.002 + i * 0.0004;

      const baseX = wire.x + wire.width / 2;
      const baseY = wire.y - 40;

      // braided cord: multi-stroke sinwave path
      for (let lane = 0; lane < 3; lane++) {
        ctx.beginPath();
        const color = WIRES_COLORS[i % WIRES_COLORS.length];
        ctx.strokeStyle = lane === 1 ? shadeColor(color, -10) : color;
        ctx.lineWidth = 6 - lane * 1.6;
        ctx.lineCap = 'round';
        for (let s = -40; s <= 40; s += 6) {
          const x = baseX + s * 1.2;
          const y = baseY + Math.sin(s * 0.18 + wire.twistPhase + lane * 0.6) * (8 + lane * 2) + s * 0.12;
          if (s === -40) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // small glow around node when on
      ctx.save();
      if (wire.glow > 0.02) {
        ctx.globalAlpha = 0.18 * wire.glow;
        const glowGrd = ctx.createRadialGradient(
          baseX,
          wire.y + wire.height / 2 - 6,
          2,
          baseX,
          wire.y + wire.height / 2 - 6,
          34
        );
        glowGrd.addColorStop(0, WIRES_COLORS[i % WIRES_COLORS.length]);
        glowGrd.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glowGrd;
        ctx.beginPath();
        ctx.arc(baseX, wire.y + wire.height / 2 - 6, 34, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // node (button) with slight squash animation
      const nodeW = wire.width * wire.animScale;
      const nodeH = wire.height * wire.animScale;
      const nodeX = wire.x + (wire.width - nodeW) / 2;
      const nodeY = wire.y + (wire.height - nodeH) / 2;

      ctx.save();
      ctx.shadowBlur = wire.glow * 12;
      ctx.shadowColor = wire.on ? WIRES_COLORS[i % WIRES_COLORS.length] : 'transparent';
      ctx.fillStyle = wire.on ? WIRES_COLORS[i % WIRES_COLORS.length] : '#162a38';
      drawRoundedRect(nodeX, nodeY, nodeW, nodeH, 10);
      ctx.restore();

      // Value text inside node
      ctx.fillStyle = wire.on ? '#07241b' : '#CFF1FF';
      ctx.font = '700 20px "Segoe UI", Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(wire.value.toString(), wire.x + wire.width / 2, wire.y + wire.height / 2);

      // selection halo with gentle pulse
      if (i === selectedWire && !solved) {
        ctx.save();
        const pulse = 1 + Math.sin(animPulse * 1.6) * 0.06;
        ctx.globalAlpha = 0.85;
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(255,214,107,${0.9 * (0.7 + Math.sin(animPulse) * 0.3)})`;
        drawRoundedRect(
          wire.x - 6 * pulse,
          wire.y - 6 * pulse,
          wire.width + 12 * pulse,
          wire.height + 12 * pulse,
          12,
          false,
          true
        );
        ctx.restore();
      }

      // small label below
      ctx.font = '11px "Segoe UI", Arial';
      ctx.fillStyle = '#BFEFFF';
      ctx.fillText('wire ' + (i + 1), wire.x + wire.width / 2, wire.y + wire.height + 18);
    });
  }

  // Helper to shade color hex
  function shadeColor(hex, percent) {
    const f = hex.slice(1);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent) / 100;
    const R = parseInt(f.substring(0, 2), 16);
    const G = parseInt(f.substring(2, 4), 16);
    const B = parseInt(f.substring(4, 6), 16);
    const newR = Math.round((t - R) * p) + R;
    const newG = Math.round((t - G) * p) + G;
    const newB = Math.round((t - B) * p) + B;
    return `rgb(${newR},${newG},${newB})`;
  }

  function drawTargetLamp(pulse) {
    const boxX = 480;
    const boxY = 40;
    ctx.save();
    // container
    ctx.fillStyle = '#051423';
    drawRoundedRect(boxX, boxY, 200, 120, 12);
    // header
    ctx.fillStyle = '#E6F7FF';
    ctx.font = '600 16px "Segoe UI", Arial';
    ctx.fillText('Power Target', boxX + 100, boxY + 28);

    // numeric target
    ctx.font = '700 44px "Segoe UI", Arial';
    ctx.fillStyle = '#FFF6C8';
    ctx.fillText(target.toString(), boxX + 100, boxY + 78);

    // lamp graphic with animated filament
    const lampX = boxX + 100;
    const lampY = boxY + 110;
    const glow = solved ? 1.6 : 1 + Math.abs(Math.sin(pulse * 1.2)) * 0.12;
    // glow ring
    ctx.save();
    const grd = ctx.createRadialGradient(lampX, lampY - 10, 6, lampX, lampY - 10, 72);
    grd.addColorStop(0, `rgba(255,235,120,${0.16 * glow})`);
    grd.addColorStop(1, 'rgba(255,235,120,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(lampX, lampY - 10, 72, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // bulb body with subtle noise/flicker
    ctx.save();
    const flicker = (Math.random() * 0.02 + 0.96) * (solved ? 1.06 : 1);
    ctx.fillStyle = solved ? '#FFF4B8' : '#FFFDE8';
    ctx.beginPath();
    ctx.ellipse(lampX, lampY - 10, 32 * flicker, 36 * flicker, 0, 0, Math.PI * 2);
    ctx.fill();

    // filament: when on, draw bright zigzag, otherwise faint
    const sum = currentSum();
    const onRatio = Math.min(1, sum / Math.max(1, target));
    const filamentAlpha = 0.18 + onRatio * 0.82;
    ctx.strokeStyle = `rgba(255,170,60,${filamentAlpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const fx = lampX - 12;
    const fy = lampY - 24;
    ctx.moveTo(fx, fy);
    for (let k = 0; k < 7; k++) {
      ctx.lineTo(fx + k * 4, fy + (k % 2 === 0 ? -2 : 4) - Math.sin(pulse + k) * 1.2);
    }
    ctx.stroke();

    // base
    ctx.fillStyle = '#BCC9D6';
    drawRoundedRect(lampX - 22, lampY + 24, 44, 12, 3);
    ctx.restore();

    // houses that light based on progress
    drawHouses(boxX + 20, boxY + 10, Math.min(1, sum / Math.max(1, target)));
    ctx.restore();
  }

  function drawHouses(x, y, ratio) {
    // draw 4 small houses across
    for (let i = 0; i < 4; i++) {
      const hx = x + i * 44;
      const hy = y + 70;
      const lit = ratio > i / 4;
      // base
      ctx.save();
      ctx.fillStyle = '#0D2A3A';
      drawRoundedRect(hx, hy, 30, 20, 4);
      // roof
      ctx.beginPath();
      ctx.moveTo(hx - 2, hy);
      ctx.lineTo(hx + 15, hy - 12);
      ctx.lineTo(hx + 32, hy);
      ctx.closePath();
      ctx.fillStyle = '#183F55';
      ctx.fill();
      // windows
      ctx.fillStyle = lit ? '#FFF2A6' : '#07303F';
      ctx.fillRect(hx + 6, hy + 6, 6, 6);
      ctx.fillRect(hx + 18, hy + 6, 6, 6);
      ctx.restore();
    }
  }

  function drawScoreboard() {
    ctx.save();
    ctx.fillStyle = '#E9F5FF';
    ctx.font = '600 16px "Segoe UI", Arial';
    ctx.fillText(`Round ${round}/${ROUNDS}`, 40, 160);
    ctx.fillText(`Score ${score}`, 160, 160);
    ctx.restore();
  }

  function drawCharacters(pulse) {
    // Sparky character (friendly spark)
    const sx = 120;
    const sy = 110;
    ctx.save();
    const glow = 0.4 + Math.abs(Math.sin(pulse * 1.2)) * 0.25;
    const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 44);
    g.addColorStop(0, `rgba(255,205,110,${0.9 * glow})`);
    g.addColorStop(1, 'rgba(255,205,110,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, 42, 0, Math.PI * 2);
    ctx.fill();

    // body with soft edges
    ctx.fillStyle = '#FFD66B';
    ctx.beginPath();
    ctx.moveTo(sx, sy - 26);
    ctx.bezierCurveTo(sx + 20, sy - 8, sx + 14, sy + 22, sx, sy + 26);
    ctx.bezierCurveTo(sx - 14, sy + 22, sx - 20, sy - 8, sx, sy - 26);
    ctx.fill();

    // eyes with small blink
    ctx.fillStyle = '#07241b';
    const blink = Math.abs(Math.sin(pulse * 2.2)) > 0.95 ? 0.6 : 1;
    ctx.beginPath();
    ctx.arc(sx - 8, sy - 4, 4 * blink, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx + 8, sy - 4, 4 * blink, 0, Math.PI * 2);
    ctx.fill();

    // smile
    ctx.strokeStyle = '#07241b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy + 2, 8, 0, Math.PI);
    ctx.stroke();

    // speech bubble with abbreviated friendly tip
    ctx.fillStyle = '#E9F5FF';
    drawRoundedRect(sx + 40, sy - 36, 200, 44, 8);
    ctx.fillStyle = '#063046';
    ctx.font = '600 13px "Segoe UI", Arial';
    ctx.fillText("Let's light the houses! Add wires to reach the target power.", sx + 50, sy - 12);

    ctx.restore();

    // Dr. Volt (plug scientist) stylized
    const vx = 560;
    const vy = 180;
    ctx.save();
    // head/monitor
    ctx.fillStyle = '#D6EFFA';
    drawRoundedRect(vx - 30, vy - 22, 60, 66, 10);
    // name plate
    ctx.fillStyle = '#123C5C';
    ctx.font = '700 11px "Segoe UI", Arial';
    ctx.fillText('Dr. Volt', vx, vy - 34);
    // little power symbol
    ctx.fillStyle = '#FFF9D8';
    ctx.beginPath();
    ctx.moveTo(vx - 4, vy - 4);
    ctx.lineTo(vx + 2, vy - 4);
    ctx.lineTo(vx, vy + 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawInstructions() {
    ctx.save();
    ctx.fillStyle = '#BFE7FF';
    ctx.font = '12px "Segoe UI", Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Controls: ← →  select wire   Space/Enter toggle   S sound   R reset', 40, 460);
    ctx.restore();
  }

  function drawAudioIcon() {
    const x = CANVAS_W - 40;
    const y = 24;
    ctx.save();
    ctx.globalAlpha = 0.98;
    ctx.fillStyle = audioAvailable ? (audioEnabled ? '#BFF1C2' : '#FFD6D6') : '#777';
    drawRoundedRect(x - 18, y - 14, 36, 28, 6);
    // speaker
    ctx.fillStyle = '#07241b';
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 6);
    ctx.lineTo(x - 2, y - 6);
    ctx.lineTo(x + 6, y - 12);
    ctx.lineTo(x + 6, y + 12);
    ctx.lineTo(x - 2, y + 6);
    ctx.lineTo(x - 8, y + 6);
    ctx.closePath();
    ctx.fill();

    if (audioAvailable && audioEnabled) {
      ctx.strokeStyle = '#07241b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x + 10, y, 6, -0.6, 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 10, y, 10, -0.6, 0.6);
      ctx.stroke();
    } else if (!audioAvailable) {
      ctx.fillStyle = '#444';
      ctx.font = '600 10px "Segoe UI", Arial';
      ctx.fillText('X', x + 12, y + 4);
    } else {
      ctx.strokeStyle = '#440000';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 6, y - 6);
      ctx.lineTo(x + 12, y + 6);
      ctx.moveTo(x + 12, y - 6);
      ctx.lineTo(x + 6, y + 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCelebration() {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 250, 220, 0.14)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = '#fff';
    ctx.font = '700 34px "Segoe UI", Arial';
    ctx.textAlign = 'center';
    ctx.fillText('You did it!', CANVAS_W / 2, CANVAS_H / 2 - 8);
    ctx.font = '600 16px "Segoe UI", Arial';
    ctx.fillText('Great adding! Press Enter for next round.', CANVAS_W / 2, CANVAS_H / 2 + 30);
    ctx.restore();
  }

  // ----- Sparks (particle) effects -----
  function spawnSparks(x, y, color = '#FFB400') {
    for (let i = 0; i < 12; i++) {
      sparksAnimation.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 3 - 1,
        life: 500 + Math.random() * 600,
        age: 0,
        color: color,
        size: 2 + Math.random() * 4,
        decay: 0.98 + Math.random() * 0.02
      });
    }
  }

  function updateAndDrawSparks(dt) {
    for (let i = sparksAnimation.length - 1; i >= 0; i--) {
      const p = sparksAnimation[i];
      p.age += dt;
      p.x += p.vx;
      p.y += p.vy + 0.02 * dt; // gravity
      p.vx *= p.decay;
      p.vy += 0.02;
      const lifeRatio = 1 - p.age / p.life;
      if (lifeRatio <= 0) {
        sparksAnimation.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = lifeRatio;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ----- Game Logic (unaltered math/behavior) -----
  function toggleWire(index) {
    if (index < 0 || index >= wires.length) return;
    wires[index].on = !wires[index].on;
    const centerX = wires[index].x + wires[index].width / 2;
    const centerY = wires[index].y - 10;
    spawnSparks(centerX, centerY, wires[index].on ? WIRES_COLORS[index] : '#88A');
    // click sound
    ensureAudioOnUserGesture()
      .then(() => {
        playClick();
      })
      .catch(() => {
        // ignore audio errors
      });
    evaluateSum();
    updateBackgroundHum();
    announceForSR(`Wire ${index + 1} ${wires[index].on ? 'on' : 'off'}. Current total ${currentSum()}.`);
  }

  function currentSum() {
    return wires.reduce((acc, w) => acc + (w.on ? w.value : 0), 0);
  }

  function evaluateSum() {
    const sum = currentSum();
    if (!solved && sum === target) {
      solved = true;
      score += 1;
      playCorrect();
      spawnSparks(CANVAS_W / 2, 200, '#B8FFB0');
      announceForSR('Correct! The lamp lit up. Press Enter to continue.');
      if (humGain && audioAvailable) {
        // briefly enhance ambient presence
        humGain.gain.setTargetAtTime(0.08, audioCtx.currentTime, 0.2);
      }
    } else if (sum > target) {
      playWrong();
      spawnSparks(540, 100, '#FF6B6B');
      announceForSR(`Oops! Sum is ${sum}. That's more than ${target}. Try turning some wires off.`);
    } else {
      // gentle hum adjustment relative to progress
      if (humGain && audioAvailable) {
        const ratio = sum / Math.max(1, target);
        humGain.gain.setTargetAtTime(0.02 + 0.08 * ratio, audioCtx.currentTime, 0.1);
      }
    }
  }

  function updateBackgroundHum() {
    if (!audioAvailable || !humGain) return;
    const sum = currentSum();
    const ratio = sum / Math.max(1, target);
    humGain.gain.setTargetAtTime(0.02 + 0.08 * ratio, audioCtx.currentTime, 0.08);
  }

  function nextRoundOrEnd() {
    if (!solved) return;
    if (round < ROUNDS) {
      round++;
      newRound();
    } else {
      announceForSR(`Game complete! Your score ${score} out of ${ROUNDS}. Press R to restart.`);
      if (humGain && audioAvailable) humGain.gain.setTargetAtTime(0.02, audioCtx.currentTime, 0.4);
      solved = true;
    }
  }

  function resetGame() {
    round = 1;
    score = 0;
    newRound();
    announceForSR('Game reset. New round started.');
  }

  // ----- Input Handling -----
  canvas.tabIndex = 0;
  canvas.addEventListener('click', async (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // audio icon area clicks
    const ax = CANVAS_W - 40;
    const ay = 24;
    if (cx >= ax - 18 && cx <= ax + 18 && cy >= ay - 14 && cy <= ay + 14) {
      toggleAudio();
      return;
    }

    if (solved && round >= ROUNDS) {
      // do nothing special
    } else if (solved) {
      nextRoundOrEnd();
      return;
    }

    // check wire button clicks
    for (let i = 0; i < wires.length; i++) {
      const w = wires[i];
      if (cx >= w.x && cx <= w.x + w.width && cy >= w.y && cy <= w.y + w.height) {
        await ensureAudioOnUserGesture();
        selectedWire = i;
        toggleWire(i);
        return;
      }
    }
    canvas.focus();
  });

  canvas.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowRight') {
      selectedWire = (selectedWire + 1) % wires.length;
      await ensureAudioOnUserGesture();
      playBeep(660, 0.06, 'sine', 0.06);
      announceForSR(`Selected wire ${selectedWire + 1}. Value ${wires[selectedWire].value}.`);
      e.preventDefault();
    } else if (e.key === 'ArrowLeft') {
      selectedWire = (selectedWire - 1 + wires.length) % wires.length;
      await ensureAudioOnUserGesture();
      playBeep(660, 0.06, 'sine', 0.06);
      announceForSR(`Selected wire ${selectedWire + 1}. Value ${wires[selectedWire].value}.`);
      e.preventDefault();
    } else if (e.key === ' ' || e.key === 'Enter') {
      await ensureAudioOnUserGesture();
      if (solved) {
        nextRoundOrEnd();
      } else {
        toggleWire(selectedWire);
      }
      e.preventDefault();
    } else if (e.key.toLowerCase() === 's') {
      toggleAudio();
      e.preventDefault();
    } else if (e.key.toLowerCase() === 'r') {
      resetGame();
      e.preventDefault();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    for (let i = 0; i < wires.length; i++) {
      const w = wires[i];
      if (cx >= w.x && cx <= w.x + w.width && cy >= w.y && cy <= w.y + w.height) {
        selectedWire = i;
      }
    }
  });

  container.addEventListener('click', () => {
    canvas.focus();
  });

  // Toggle audio on/off (manages user gesture resume)
  function toggleAudio() {
    if (!audioAvailable) {
      announceForSR('Audio is not available in this browser.');
      return;
    }
    audioEnabled = !audioEnabled;
    if (audioEnabled) {
      ensureAudioOnUserGesture()
        .then(() => {
          playBeep(900, 0.08, 'sine', 0.12);
          announceForSR('Audio enabled.');
        })
        .catch(() => {
          announceForSR('Audio enabled but could not resume audio context.');
        });
    } else {
      announceForSR('Audio muted.');
    }
  }

  // ----- Safety handlers -----
  window.addEventListener('unhandledrejection', (e) => {
    console.warn('Unhandled promise rejection in game:', e.reason);
  });

  // ----- Initialization -----
  function init() {
    canvas.focus();
    resetGame();
    lastTime = performance.now();
    window.requestAnimationFrame(drawScene);

    // Ensure audio nodes connected to master for hum gain handling
    if (audioAvailable) {
      try {
        // create small humGain for controlling hum volume independently (if not already)
        if (!humGain && audioCtx) {
          humGain = audioCtx.createGain();
          humGain.gain.value = 0.02;
          if (humOsc) humOsc.connect(humGain);
          humGain.connect(masterGain);
        }
      } catch (e) {
        console.warn('Hum gain setup error:', e);
      }
    }

    announceForSR(
      'Welcome to Sparky & the Power Puzzle. Use arrow keys to pick a wire. Press space to toggle. Press S to toggle sound. Press R to restart.'
    );
  }

  init();

  if (!audioAvailable) {
    console.warn('Audio not available. Game will continue without sound.');
    announceForSR(
      'Note: Audio is not available in this browser. You can still play using visuals and keyboard.'
    );
  }

  // Expose some state for debugging in console (non-invasive)
  window.__electricMathGame = {
    restart: resetGame,
    state: () => ({ round, score, target, wires, selectedWire, solved })
  };
})();