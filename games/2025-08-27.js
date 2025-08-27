(function () {
  // Educational Math Game: "Zap the Sum"
  // Visual & Audio upgrades only. Game mechanics unchanged.
  const STAGE_ID = "game-of-the-day-stage";
  const WIDTH = 720;
  const HEIGHT = 480;

  const stageEl = document.getElementById(STAGE_ID);
  if (!stageEl) {
    console.error(`Element with id "${STAGE_ID}" not found.`);
    return;
  }

  // Prepare stage
  stageEl.innerHTML = "";
  stageEl.style.position = "relative";
  stageEl.style.userSelect = "none";
  stageEl.style.width = WIDTH + "px";
  stageEl.style.height = HEIGHT + "px";

  // Create canvas exactly 720x480
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute(
    "aria-label",
    "Zap the Sum math game. Use mouse or keyboard to play."
  );
  canvas.style.outline = "none";
  canvas.style.display = "block";
  canvas.style.margin = "0";
  canvas.style.background = "#071423"; // deep base
  stageEl.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: false });

  // Accessible live region
  const liveRegion = document.createElement("div");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("role", "status");
  liveRegion.style.position = "absolute";
  liveRegion.style.left = "-9999px";
  liveRegion.style.width = "1px";
  liveRegion.style.height = "1px";
  liveRegion.style.overflow = "hidden";
  stageEl.appendChild(liveRegion);

  // Layout constants
  const HUD_HEIGHT = 120;
  const GAME_Y = HUD_HEIGHT;
  const GAME_HEIGHT = HEIGHT - HUD_HEIGHT;

  // Utilities
  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function arraySum(arr) {
    return arr.reduce((s, v) => s + v, 0);
  }
  function announce(text) {
    liveRegion.textContent = text;
  }

  // Rounded rect helper (path)
  function roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }
  function roundRectDraw(ctx, x, y, w, h, r, fillStyle) {
    ctx.save();
    roundRectPath(ctx, x, y, w, h, r);
    ctx.fillStyle = fillStyle;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.stroke();
    ctx.restore();
  }

  // ---------- Audio Manager (Web Audio API only) ----------
  class AudioManager {
    constructor() {
      this.ctx = null;
      this.available = true;
      this.enabled = false;
      this.backgroundGain = null;
      this.backgroundNodes = null;
      this.lfo = null;
      // Check support
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) {
          this.available = false;
        }
      } catch (err) {
        this.available = false;
      }
    }

    async init() {
      if (!this.available) return;
      if (this.ctx) return;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();

        // Create master background chain
        this.backgroundGain = this.ctx.createGain();
        this.backgroundGain.gain.value = 0.0;
        this.backgroundGain.connect(this.ctx.destination);

        // Two oscillators for gentle evolving pad
        const oscA = this.ctx.createOscillator();
        oscA.type = "sine";
        oscA.frequency.value = 55;
        const oscB = this.ctx.createOscillator();
        oscB.type = "sine";
        oscB.frequency.value = 69; // interval for warmth
        // Slight detune
        oscA.detune.value = -6;
        oscB.detune.value = 6;

        // Subtle filter to soften
        const filter = this.ctx.createBiquadFilter();
        filter.type = "lowpass";
        filter.frequency.value = 800;
        filter.Q.value = 0.8;

        // Gain for oscillators
        const padGain = this.ctx.createGain();
        padGain.gain.value = 0.05;

        oscA.connect(padGain);
        oscB.connect(padGain);
        padGain.connect(filter);
        filter.connect(this.backgroundGain);

        // LFO to vary filter frequency gently
        const lfo = this.ctx.createOscillator();
        lfo.type = "sine";
        lfo.frequency.value = 0.08; // slow
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 300;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);

        // start oscillators
        oscA.start();
        oscB.start();
        lfo.start();

        this.backgroundNodes = { oscA, oscB, filter, padGain, lfo, lfoGain };
      } catch (err) {
        console.error("Audio init failed:", err);
        this.available = false;
      }
    }

    // Enable audio (user gesture)
    async enable() {
      if (!this.available) return false;
      try {
        await this.init();
        if (this.ctx.state === "suspended") {
          await this.ctx.resume();
        }
        // fade in background
        this.backgroundGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.backgroundGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
        this.backgroundGain.gain.exponentialRampToValueAtTime(
          0.035,
          this.ctx.currentTime + 1.0
        );
        this.enabled = true;
        return true;
      } catch (err) {
        console.error("Audio enable error:", err);
        this.enabled = false;
        return false;
      }
    }

    disable() {
      if (!this.available || !this.ctx) return;
      try {
        this.backgroundGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.backgroundGain.gain.setValueAtTime(
          this.backgroundGain.gain.value,
          this.ctx.currentTime
        );
        this.backgroundGain.gain.linearRampToValueAtTime(
          0.0001,
          this.ctx.currentTime + 0.6
        );
        this.enabled = false;
      } catch (err) {
        console.warn("Audio disable error:", err);
      }
    }

    // small stereoish click using panner if available
    playClick(xPan = 0) {
      if (!this.available || !this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        let dest = gain;
        // panner is optional
        if (this.ctx.createStereoPanner) {
          const pan = this.ctx.createStereoPanner();
          pan.pan.setValueAtTime(clamp(xPan, -1, 1), now);
          gain.connect(pan);
          pan.connect(this.ctx.destination);
        } else {
          gain.connect(this.ctx.destination);
        }

        const osc = this.ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(720, now + 0.14);
        osc.connect(gain);
        osc.start(now);
        osc.stop(now + 0.16);
      } catch (err) {
        console.warn("playClick error", err);
      }
    }

    // gentle success arpeggio with soft chime
    playSuccess() {
      if (!this.available || !this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [440, 550, 660].map((n) => n * (Math.random() > 0.5 ? 1 : 1));
        const baseGain = this.ctx.createGain();
        baseGain.gain.setValueAtTime(0.0001, now);
        baseGain.connect(this.ctx.destination);
        baseGain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
        baseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);

        notes.forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          o.type = "sine";
          const t0 = now + i * 0.08;
          o.frequency.setValueAtTime(freq, t0);
          // small pitch slide
          o.frequency.linearRampToValueAtTime(freq * 1.06, t0 + 0.18);
          const flt = this.ctx.createBiquadFilter();
          flt.type = "highpass";
          flt.frequency.value = 200;
          const g = this.ctx.createGain();
          g.gain.setValueAtTime(0.001, t0);
          g.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
          o.connect(flt);
          flt.connect(g);
          g.connect(baseGain);
          o.start(t0);
          o.stop(t0 + 0.7);
        });
      } catch (err) {
        console.warn("playSuccess error", err);
      }
    }

    // fail: low rumble then short buzz
    playFail() {
      if (!this.available || !this.enabled || !this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        // low rumble
        const rumble = this.ctx.createOscillator();
        rumble.type = "sawtooth";
        rumble.frequency.value = 90;
        const rumbleGain = this.ctx.createGain();
        rumbleGain.gain.setValueAtTime(0.0001, now);
        rumbleGain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
        rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        const filt = this.ctx.createBiquadFilter();
        filt.type = "lowpass";
        filt.frequency.value = 600;
        rumble.connect(filt);
        filt.connect(rumbleGain);
        rumbleGain.connect(this.ctx.destination);
        rumble.start(now);
        rumble.stop(now + 0.5);

        // sharp buzz
        const buzz = this.ctx.createOscillator();
        buzz.type = "square";
        buzz.frequency.setValueAtTime(220, now + 0.06);
        const bg = this.ctx.createGain();
        bg.gain.setValueAtTime(0.0001, now + 0.06);
        bg.gain.exponentialRampToValueAtTime(0.09, now + 0.07);
        bg.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
        buzz.connect(bg);
        bg.connect(this.ctx.destination);
        buzz.start(now + 0.06);
        buzz.stop(now + 0.26);
      } catch (err) {
        console.warn("playFail error", err);
      }
    }
  }

  const audio = new AudioManager();

  // ---------- Visual Entities ----------
  class Battery {
    constructor(x, y, value, id) {
      this.x = x;
      this.y = y;
      this.w = 120;
      this.h = 64;
      this.value = value;
      this.id = id;
      this.selected = false;
      this.hover = false;
      this.pulse = 0;
      this.floatOffset = Math.random() * 0.6;
    }

    contains(px, py) {
      return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
    }

    toggleSelected() {
      this.selected = !this.selected;
      this.pulse = 1.0;
      // subtle float jitter
      this.floatOffset = Math.random() * 0.6;
    }

    update(dt) {
      if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 2.5);
    }

    draw(ctx, t) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // subtle bob
      const bob = Math.sin((t + this.floatOffset) * 2.2) * 2;
      ctx.translate(0, bob);

      // Battery body gradient
      const g = ctx.createLinearGradient(0, 0, 0, this.h);
      if (this.selected) {
        g.addColorStop(0, "#FFF3D9");
        g.addColorStop(1, "#FFD166");
      } else if (this.hover) {
        g.addColorStop(0, "#E8F7FF");
        g.addColorStop(1, "#BEE8FF");
      } else {
        g.addColorStop(0, "#FFFFFF");
        g.addColorStop(1, "#E6EEF6");
      }
      // Outer shape with soft shadow
      ctx.shadowColor = "rgba(0,0,0,0.16)";
      ctx.shadowBlur = 8;
      roundRectPath(ctx, 0, 0, this.w, this.h, 12);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#072A40";
      ctx.stroke();

      // terminals
      ctx.fillStyle = "#072A40";
      ctx.fillRect(this.w - 10, this.h / 2 - 6, 8, 12);

      // value circle
      ctx.beginPath();
      ctx.arc(this.w - 28, this.h / 2, 18, 0, Math.PI * 2);
      ctx.fillStyle = this.selected ? "#6F2DA8" : "#072A40";
      ctx.fill();

      // Number
      ctx.fillStyle = this.selected ? "#FFF8F4" : "#FFFFFF";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.value.toString(), this.w - 28, this.h / 2);

      // Label
      ctx.font = "11px Arial";
      ctx.textAlign = "left";
      ctx.fillStyle = "#072A40";
      ctx.fillText("cell", 8, this.h - 8);

      // glow ring when selected
      if (this.selected || this.pulse > 0) {
        ctx.beginPath();
        ctx.arc(this.w / 2, this.h / 2, 34 + this.pulse * 20, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(93, 255, 154, ${0.04 + this.pulse * 0.08})`;
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // Friendly characters
  function drawDrAmp(ctx, x, y, mood = "happy", t = 0) {
    ctx.save();
    ctx.translate(x, y);
    // subtle sway
    ctx.rotate(Math.sin(t * 1.2) * 0.03);
    // body halo
    ctx.beginPath();
    ctx.ellipse(0, -16, 46, 54, 0, 0, Math.PI * 2);
    const g = ctx.createRadialGradient(-8, -30, 6, 0, -16, 80);
    g.addColorStop(0, "#FFF9E6");
    g.addColorStop(1, "#FFE6A7");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#6a3e00";
    ctx.stroke();

    // base
    ctx.fillStyle = "#2f3b45";
    ctx.fillRect(-28, 32, 56, 12);
    ctx.strokeStyle = "#1b242a";
    ctx.strokeRect(-28, 32, 56, 12);

    // face
    ctx.fillStyle = "#072A40";
    ctx.beginPath();
    ctx.arc(-10, -30, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -30, 5, 0, Math.PI * 2);
    ctx.fill();

    // mouth
    ctx.beginPath();
    ctx.lineWidth = 2;
    if (mood === "happy") ctx.arc(0, -12, 9, 0, Math.PI, false);
    else if (mood === "surprised") {
      ctx.arc(0, -12, 5, 0, Math.PI * 2);
    } else {
      ctx.arc(0, -8, 9, 0, Math.PI, true);
    }
    ctx.strokeStyle = "#2a2f33";
    ctx.stroke();

    // small glasses
    ctx.beginPath();
    ctx.strokeStyle = "rgba(10,20,30,0.35)";
    ctx.lineWidth = 1.5;
    ctx.arc(-10, -30, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(10, -30, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawSpark(ctx, x, y, t, scale = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 6) * 0.3);
    ctx.scale(scale, scale);
    // star spikes
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 10 : 5;
      const px = Math.cos(angle) * r;
      const py = Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    const hue = 45 + Math.sin(t * 5) * 8;
    ctx.fillStyle = `hsl(${hue} 95% 60%)`;
    ctx.shadowColor = "rgba(255,220,90,0.8)";
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // ---------- Game Logic (unchanged math) ----------
  class Game {
    constructor(ctx) {
      this.ctx = ctx;
      this.batteries = [];
      this.target = 0;
      this.level = 1;
      this.score = 0;
      this.lives = 3;
      this.selectionIndex = 0;
      this.lastTick = performance.now();
      this.running = true;
      this.hintTimer = 0;
      this.feedbackText = "";
      this.feedbackTimer = 0;
      this.audioOn = false;
      this.mouse = { x: 0, y: 0, down: false };
      this.time = 0;
      this.particles = []; // visual particles (sparks)
      this.generateRound();

      // Input
      canvas.addEventListener("keydown", (e) => this.onKeyDown(e));
      canvas.addEventListener("mousemove", (e) => this.onMouseMove(e));
      canvas.addEventListener("mousedown", (e) => this.onMouseDown(e));
      canvas.addEventListener("mouseup", (e) => this.onMouseUp(e));
      canvas.addEventListener("mouseleave", (e) => this.onMouseLeave(e));
      canvas.addEventListener("click", (e) => {
        // First click try to enable audio as a gesture
        if (!audio.enabled && audio.available) {
          audio
            .enable()
            .then((ok) => {
              this.audioOn = ok;
              this.updateAnnounce();
            })
            .catch(() => {});
        }
      });

      // Touch mapping
      canvas.addEventListener(
        "touchstart",
        (e) => {
          e.preventDefault();
          const t = e.touches[0];
          const rect = canvas.getBoundingClientRect();
          this.onMouseMove({ clientX: t.clientX, clientY: t.clientY });
          this.onMouseDown({ clientX: t.clientX, clientY: t.clientY });
        },
        { passive: false }
      );
      canvas.addEventListener("touchend", (e) => {
        e.preventDefault();
        this.onMouseUp({});
      });

      announce(
        "Welcome! Help Dr. Amp light the lamp by selecting batteries that add up to the target. Use mouse or keyboard. Press A to toggle audio."
      );
      this.updateAnnounce();
    }

    generateRound() {
      // Solvable set creation unchanged
      const nPick = randInt(2, 3);
      const chosen = [];
      while (chosen.length < nPick) {
        const v = randInt(1, 9);
        if (!chosen.includes(v)) chosen.push(v);
      }
      const targetSum = arraySum(chosen);
      const batteries = [...chosen];
      while (batteries.length < 4) {
        const cand = randInt(1, 9);
        if (batteries.length < 3 || Math.random() > 0.3) {
          batteries.push(cand);
        }
      }
      batteries.sort(() => Math.random() - 0.5);
      this.batteries = [];
      const startX = 48;
      const gap = 28;
      for (let i = 0; i < 4; i++) {
        const bx = startX + i * (120 + gap);
        const by = GAME_Y + 28;
        this.batteries.push(new Battery(bx, by, batteries[i], i));
      }
      this.target = targetSum;
      this.selectionIndex = 0;
      this.feedbackText = "";
      this.feedbackTimer = 0;
      this.hintTimer = 5.0;
      this.time = 0;

      announce(
        `Level ${this.level}. Target ${this.target} volts. Select batteries to add to ${this.target}.`
      );
      this.updateAnnounce();
    }

    updateAnnounce() {
      const selectedVals = this.batteries.filter((b) => b.selected).map((b) => b.value);
      const sum = arraySum(selectedVals);
      const audioText = audio.available
        ? this.audioOn
          ? "Audio on."
          : "Audio off. Press A to enable."
        : "Audio not available.";
      announce(
        `Target ${this.target}. Selected ${selectedVals.join(", ") || "none"}. Sum ${sum}. ${audioText} Score ${this.score}. Lives ${this.lives}.`
      );
    }

    onKeyDown(e) {
      if (!this.running) return;
      if (e.key === "ArrowRight") {
        this.selectionIndex = (this.selectionIndex + 1) % this.batteries.length;
        audio.playClick(-0.2);
        this.updateAnnounce();
      } else if (e.key === "ArrowLeft") {
        this.selectionIndex =
          (this.selectionIndex - 1 + this.batteries.length) % this.batteries.length;
        audio.playClick(0.2);
        this.updateAnnounce();
      } else if (e.key === " " || e.key === "Enter") {
        this.toggleBattery(this.selectionIndex);
      } else if (e.key >= "1" && e.key <= "4") {
        const idx = Number(e.key) - 1;
        if (idx >= 0 && idx < this.batteries.length) this.toggleBattery(idx);
      } else if (e.key.toLowerCase() === "a") {
        if (!audio.available) {
          announce("Audio is not supported in this browser.");
        } else {
          if (!audio.enabled) {
            audio
              .enable()
              .then((ok) => {
                this.audioOn = ok;
                announce(ok ? "Audio enabled." : "Audio could not be enabled.");
                this.updateAnnounce();
              })
              .catch(() => {});
          } else {
            audio.disable();
            this.audioOn = false;
            announce("Audio disabled.");
            this.updateAnnounce();
          }
        }
      }
    }

    toggleBattery(idx) {
      const b = this.batteries[idx];
      if (!b) return;
      b.toggleSelected();
      // spawn a little spark particle
      this.spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.selected ? 12 : 6);
      // click sound with pan based on index
      const pan = (idx - 1.5) / 2;
      audio.playClick(pan);
      this.updateAnnounce();
      const selectedVals = this.batteries.filter((b) => b.selected).map((b) => b.value);
      const sum = arraySum(selectedVals);
      if (sum === this.target) {
        this.onSuccess();
      } else if (sum > this.target) {
        this.onOver();
      }
    }

    onSuccess() {
      audio.playSuccess();
      // big celebratory sparks
      const centerX = WIDTH / 2;
      const centerY = HUD_HEIGHT / 2 + 8;
      this.spawnParticles(centerX, centerY, 40);
      this.feedbackText = "Zap! Perfect match!";
      this.feedbackTimer = 2.0;
      this.score += 10 * this.level;
      this.level += 1;
      setTimeout(() => {
        this.generateRound();
      }, 900);
      this.updateAnnounce();
    }

    onOver() {
      audio.playFail();
      this.feedbackText = "Too much! Try again or unselect a battery.";
      this.feedbackTimer = 2.0;
      this.lives -= 1;
      // small negative particle puff
      const centerX = WIDTH / 2;
      const centerY = HUD_HEIGHT / 2 + 8;
      this.spawnParticles(centerX, centerY, 12, true);
      if (this.lives <= 0) {
        this.onGameOver();
      } else {
        this.updateAnnounce();
      }
    }

    onGameOver() {
      this.running = false;
      this.feedbackText =
        "Oh no — the circuit fizzled out! Game over. Press R to restart.";
      this.feedbackTimer = 6.0;
      announce(`Game over. Your score ${this.score}. Press R to restart.`);
      const restartHandler = (e) => {
        if (e.key.toLowerCase() === "r") {
          window.removeEventListener("keydown", restartHandler);
          this.reset();
        }
      };
      window.addEventListener("keydown", restartHandler);
    }

    reset() {
      this.level = 1;
      this.score = 0;
      this.lives = 3;
      this.running = true;
      this.generateRound();
    }

    onMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX || 0) - rect.left;
      const my = (e.clientY || 0) - rect.top;
      this.mouse.x = mx;
      this.mouse.y = my;
      for (const b of this.batteries) {
        b.hover = b.contains(mx, my);
      }
    }

    onMouseDown(e) {
      this.mouse.down = true;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX || 0) - rect.left;
      const my = (e.clientY || 0) - rect.top;
      for (let i = 0; i < this.batteries.length; i++) {
        const b = this.batteries[i];
        if (b.contains(mx, my)) {
          this.selectionIndex = i;
          this.toggleBattery(i);
          return;
        }
      }
      // audio icon area top-right
      if (mx > WIDTH - 54 && my < 54) {
        if (!audio.available) {
          announce("Audio not available on this device.");
        } else {
          if (!audio.enabled) {
            audio
              .enable()
              .then((ok) => {
                this.audioOn = ok;
                announce(ok ? "Audio enabled." : "Audio could not be enabled.");
                this.updateAnnounce();
              })
              .catch(() => {});
          } else {
            audio.disable();
            this.audioOn = false;
            announce("Audio disabled.");
            this.updateAnnounce();
          }
        }
      }
    }

    onMouseUp(e) {
      this.mouse.down = false;
    }

    onMouseLeave(e) {
      this.mouse.down = false;
      for (const b of this.batteries) b.hover = false;
    }

    // Particle system: simple sparks
    spawnParticles(x, y, count = 10, negative = false) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 120;
        const life = 0.6 + Math.random() * 0.8;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy:
            Math.sin(angle) * speed -
            40 * (negative ? 0.2 : 0.6),
          life,
          age: 0,
          color: negative
            ? "255,90,70"
            : `${200 + Math.random() * 55},${200 + Math.random() * 55},90`,
          size: 2 + Math.random() * 3,
        });
      }
    }

    update(dt) {
      this.time += dt;
      for (const b of this.batteries) b.update(dt);
      if (this.feedbackTimer > 0) this.feedbackTimer = Math.max(0, this.feedbackTimer - dt);
      if (this.hintTimer > 0) this.hintTimer = Math.max(0, this.hintTimer - dt);

      // update particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        p.age += dt;
        if (p.age >= p.life) {
          this.particles.splice(i, 1);
          continue;
        }
        p.vy += 220 * dt; // gravity
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    }

    draw() {
      // Layered background: subtle gradient + faint circuit pattern
      ctx.save();
      const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      bg.addColorStop(0, "#071423");
      bg.addColorStop(1, "#0c2b3f");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();

      // background grid of soft nodes
      ctx.save();
      ctx.globalAlpha = 0.06;
      ctx.fillStyle = "#8fe1c0";
      for (let y = 40; y < HEIGHT; y += 40) {
        for (let x = 40; x < WIDTH; x += 60) {
          ctx.beginPath();
          ctx.arc(x + (y % 80 === 0 ? 10 : 0), y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // Top HUD area with lamp, characters
      ctx.save();
      roundRectDraw(ctx, 8, 8, WIDTH - 16, HUD_HEIGHT - 12, 14, "rgba(255,255,255,0.02)");
      ctx.restore();

      // Dr. Amp left
      drawDrAmp(
        ctx,
        72,
        HUD_HEIGHT / 2 + 6,
        this.feedbackText.includes("Too") ? "sad" : "happy",
        this.time
      );

      // lamp in center
      const lampX = WIDTH / 2;
      const lampY = HUD_HEIGHT / 2 + 8;
      const selectedSum = arraySum(this.batteries.filter((b) => b.selected).map((b) => b.value));
      const closeness = clamp(Math.abs(this.target - selectedSum), 0, Math.max(1, this.target));
      const lit = selectedSum === this.target;
      const glowAmount = clamp(1 - closeness / Math.max(1, this.target), 0, 1);

      // wire from batteries to lamp - animate pulse when close
      ctx.save();
      for (const b of this.batteries) {
        // draw wire from center of battery to lamp bottom
        const sx = b.x + b.w / 2;
        const sy = b.y + b.h;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        const cx = (sx + lampX) / 2;
        const cy = sy + 40 + Math.sin(this.time * 2 + sx * 0.01) * 10;
        ctx.quadraticCurveTo(cx, cy, lampX, lampY + 60);
        // stroke style: if battery selected, lively color
        if (b.selected) {
          const alpha = 0.7 + Math.sin(this.time * 8 + b.id) * 0.15;
          ctx.strokeStyle = `rgba(93,212,132,${alpha})`;
          ctx.lineWidth = 4;
        } else {
          ctx.strokeStyle = "rgba(255,255,255,0.03)";
          ctx.lineWidth = 2;
        }
        ctx.stroke();
      }
      ctx.restore();

      // Lamp
      ctx.save();
      ctx.translate(lampX, lampY);
      // stand
      ctx.fillStyle = "#22343f";
      ctx.fillRect(-34, 48, 68, 12);

      // bulb with glow based on closeness
      const bulbGrad = ctx.createRadialGradient(-10, -16, 8, 0, 0, 110);
      bulbGrad.addColorStop(0, lit ? "#FFFCE6" : "#D6F2FF");
      bulbGrad.addColorStop(1, lit ? "#FFF3C6" : "#85BFE6");
      ctx.beginPath();
      ctx.ellipse(0, 0, 54, 68, 0, 0, Math.PI * 2);
      ctx.fillStyle = bulbGrad;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0f2b3a";
      ctx.stroke();

      // outer glow
      if (glowAmount > 0.02) {
        ctx.beginPath();
        ctx.ellipse(0, 0, 60 + glowAmount * 40, 74 + glowAmount * 40, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,230,130,${0.02 + glowAmount * 0.14})`;
        ctx.fill();
      }

      // face
      ctx.fillStyle = "#072A40";
      ctx.beginPath();
      ctx.arc(-14, -12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(14, -12, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.lineWidth = 2;
      if (lit) ctx.arc(0, 6, 10, 0, Math.PI, false);
      else ctx.arc(0, 10, 10, 0, Math.PI, true);
      ctx.stroke();

      // target label
      ctx.fillStyle = "#072A40";
      ctx.font = "bold 18px Arial";
      ctx.textAlign = "center";
      ctx.fillText(`${this.target} V`, 0, 38);
      ctx.restore();

      // Draw batteries with position update and subtle shine
      for (let i = 0; i < this.batteries.length; i++) {
        const b = this.batteries[i];
        // hover bounce
        const hoverOffset = b.hover ? -6 : 0;
        b.y = GAME_Y + 28 + hoverOffset;
        b.draw(ctx, this.time + i * 0.2);
        // keyboard selection halo
        if (i === this.selectionIndex) {
          ctx.save();
          ctx.beginPath();
          roundRectPath(ctx, b.x - 8, b.y - 8, b.w + 16, b.h + 16, 16);
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(255,209,102,0.9)";
          ctx.stroke();
          ctx.restore();
        }
      }

      // HUD right: score, lives, audio
      ctx.save();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "600 18px Arial";
      ctx.textAlign = "right";
      ctx.fillText(`Score: ${this.score}`, WIDTH - 18, 28);
      // draw lives as small bulbs
      const livesX = WIDTH - 18;
      const livesY = 54;
      ctx.font = "16px Arial";
      ctx.fillText("Lives:", livesX - 90, 56);
      for (let i = 0; i < 3; i++) {
        const lx = WIDTH - 18 - (3 - i) * 18;
        const ly = 62;
        ctx.beginPath();
        ctx.ellipse(lx, ly, 6, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = i < this.lives ? "#FFD166" : "rgba(255,255,255,0.08)";
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.stroke();
      }
      ctx.restore();

      // Audio icon top-right
      ctx.save();
      const spX = WIDTH - 32;
      const spY = 32;
      ctx.translate(spX, spY);
      ctx.beginPath();
      ctx.moveTo(-12, -10);
      ctx.lineTo(-2, -10);
      ctx.lineTo(6, -16);
      ctx.lineTo(6, 16);
      ctx.lineTo(-2, 10);
      ctx.lineTo(-12, 10);
      ctx.closePath();
      ctx.fillStyle = audio.available
        ? audio.enabled && this.audioOn
          ? "#3ddc84"
          : "#FFFFFF"
        : "#6c6c6c";
      ctx.fill();
      if (!audio.available) {
        ctx.strokeStyle = "#ff7b7b";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-18, -18);
        ctx.lineTo(18, 18);
        ctx.moveTo(18, -18);
        ctx.lineTo(-18, 18);
        ctx.stroke();
      } else if (!audio.enabled) {
        ctx.strokeStyle = "#072A40";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(12, -12);
        ctx.lineTo(18, -18);
        ctx.stroke();
      } else {
        ctx.strokeStyle = "#3ddc84";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(12, 0, 6, -0.6, 0.6);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(12, 0, 10, -0.6, 0.6);
        ctx.stroke();
      }
      ctx.restore();

      // HUD bottom-left instructions
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "13px Arial";
      ctx.textAlign = "left";
      const instr = "Click batteries or use ← → and Enter. Combine to reach the target.";
      ctx.fillText(instr, 12, HUD_HEIGHT - 10);
      ctx.restore();

      // Feedback bubble near Dr. Amp
      if (this.feedbackTimer > 0) {
        ctx.save();
        const bx = 140;
        const by = 36;
        roundRectDraw(ctx, bx, by, 360, 44, 10, "rgba(255,255,255,0.95)");
        ctx.fillStyle = "#072A40";
        ctx.font = "bold 15px Arial";
        ctx.textAlign = "left";
        ctx.fillText(this.feedbackText, bx + 12, by + 28);
        ctx.restore();
      }

      // draw spark characters in HUD
      drawSpark(ctx, WIDTH - 120, HUD_HEIGHT / 2 - 6, this.time, 0.9);
      drawSpark(ctx, 120, HUD_HEIGHT / 2 - 14, this.time + 0.6, 0.7);

      // Decorative slanted dashes in game area for depth
      ctx.save();
      ctx.translate(0, GAME_Y);
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      for (let i = 0; i < 10; i++) {
        ctx.beginPath();
        ctx.moveTo(20 + i * 72, 0);
        ctx.lineTo(0 + i * 72, GAME_HEIGHT);
        ctx.stroke();
      }
      ctx.restore();

      // draw particles
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const p = this.particles[i];
        const lifeRatio = 1 - p.age / p.life;
        ctx.save();
        ctx.globalAlpha = 0.9 * lifeRatio;
        ctx.fillStyle = `rgba(${p.color},${0.9 * lifeRatio})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * lifeRatio, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Hint box bottom-right when helpful
      if (this.hintTimer < 4.0) {
        ctx.save();
        const hx = WIDTH - 260;
        const hy = HEIGHT - 88;
        roundRectDraw(ctx, hx, hy, 240, 72, 12, "rgba(255,255,255,0.04)");
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "13px Arial";
        ctx.textAlign = "left";
        ctx.fillText("Hint: Try combining batteries to make the target!", hx + 12, hy + 28);
        ctx.fillStyle = "rgba(255,255,255,0.72)";
        ctx.font = "12px Arial";
        ctx.fillText("Select/unselect to change the sum.", hx + 12, hy + 48);
        ctx.restore();
      }

      // Game over overlay
      if (!this.running) {
        ctx.save();
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#FFD166";
        ctx.font = "bold 36px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Circuit Fizzled!", WIDTH / 2, HEIGHT / 2 - 6);
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "20px Arial";
        ctx.fillText(`Score: ${this.score}`, WIDTH / 2, HEIGHT / 2 + 28);
        ctx.restore();
      }
    }
  }

  function roundRectPath(ctx, x, y, w, h, r) {
    // Re-declare for closure (keeps previous signature)
    const radius = Math.min(r, w / 2, h / 2);
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
  }

  // ---------- Main Loop ----------
  const game = new Game(ctx);

  function loop(now) {
    const dt = Math.min(0.05, (now - game.lastTick) / 1000);
    game.lastTick = now;
    if (game.running) game.update(dt);
    game.draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame((t) => {
    game.lastTick = t;
    requestAnimationFrame(loop);
  });

  // Focus canvas for keyboard events
  canvas.addEventListener("focus", () => {});
  canvas.addEventListener("blur", () => {});

  // Expose debug helper
  window.__zapTheSum = { audio, game };

  // Announce audio availability status
  if (!audio.available) {
    announce("Audio unavailable — sounds are disabled. Use keyboard or mouse to play.");
  }
})();