(function () {
  // Enhanced Electricity Math Game (visuals & audio improved)
  // Renders inside element with ID 'game-of-the-day-stage'
  // Canvas 720x480, uses Web Audio API (oscillators), accessible keyboard controls, drag/touch support.
  // All visuals drawn with canvas methods. No external resources.

  // Ensure container exists
  const container = document.getElementById('game-of-the-day-stage');
  if (!container) {
    console.error('Game container with ID "game-of-the-day-stage" not found.');
    return;
  }

  // Clear container and set ARIA
  container.innerHTML = '';
  container.setAttribute('role', 'application');
  container.setAttribute('aria-label', 'Electric math game. Solve addition puzzles to light bulbs.');
  container.style.outline = 'none';
  container.style.position = 'relative';

  // Create canvas (exact size required)
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 480;
  canvas.setAttribute('tabindex', '0');
  canvas.style.display = 'block';
  canvas.style.width = '720px';
  canvas.style.height = '480px';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });

  // Accessibility live region for announcements
  const live = document.createElement('div');
  live.setAttribute('aria-live', 'polite');
  live.style.position = 'absolute';
  live.style.left = '-9999px';
  live.style.width = '1px';
  live.style.height = '1px';
  live.style.overflow = 'hidden';
  live.textContent = '';
  container.appendChild(live);

  // Constants and state
  const WIDTH = 720;
  const HEIGHT = 480;
  let mouse = { x: 0, y: 0, down: false };
  let touchId = null;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function randInt(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  // Web Audio Manager (improved ambient and effects)
  class SoundManager {
    constructor() {
      this.enabled = true;
      this.available = false;
      this.ctx = null;
      this.master = null;
      this.ambGain = null;
      this.ambNodes = [];
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) throw new Error('Web Audio API not supported');
        this.ctx = new AudioContext();

        // Master gain
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);

        // Ambient pad: subtle two-oscillator pad with slow LFO on detune
        this.ambGain = this.ctx.createGain();
        this.ambGain.gain.value = 0.035; // very subtle
        this.ambGain.connect(this.master);

        // Two oscillators for warm pad
        const oscA = this.ctx.createOscillator();
        const oscB = this.ctx.createOscillator();
        oscA.type = 'sine';
        oscB.type = 'sawtooth';
        oscA.frequency.value = 110;
        oscB.frequency.value = 165;

        // gentle filter to smooth
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 420;

        // small slow LFO to modulate detune of oscB for movement
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.08;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 6; // detune cents
        lfo.connect(lfoGain);
        // connect to detune param if available
        try {
          lfoGain.connect(oscB.detune);
        } catch (e) {
          // fallback: small amplitude gain to filter frequency
          lfoGain.disconnect();
        }

        oscA.connect(lp);
        oscB.connect(lp);
        lp.connect(this.ambGain);

        oscA.start();
        oscB.start();
        lfo.start();

        this.ambNodes = [oscA, oscB, lfo, lp];

        this.available = true;
      } catch (err) {
        console.warn('Audio initialization failed:', err);
        this.available = false;
        this.ctx = null;
      }
    }

    async resume() {
      if (!this.ctx) return;
      try {
        if (this.ctx.state === 'suspended') await this.ctx.resume();
      } catch (e) {
        console.warn('Resume audio failed', e);
      }
    }

    setEnabled(on) {
      this.enabled = !!on;
      if (!this.available) this.enabled = false;
      if (this.master) {
        // scale master gain down gracefully
        try {
          this.master.gain.setTargetAtTime(this.enabled ? 0.9 : 0.0, this.ctx.currentTime, 0.02);
        } catch (e) {
          this.master.gain.value = this.enabled ? 0.9 : 0.0;
        }
      }
    }

    // soft UI click
    click() {
      if (!this.enabled || !this.available) return;
      try {
        const now = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const f = 880;
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(0.0001, now);
        o.connect(g);
        g.connect(this.master);
        o.start(now);
        g.gain.exponentialRampToValueAtTime(0.08, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
        o.stop(now + 0.17);
      } catch (e) {
        console.warn('click sound failed', e);
      }
    }

    // pleasant success: quick harmonic cluster with brief filter sweep
    success() {
      if (!this.enabled || !this.available) return;
      try {
        const now = this.ctx.currentTime;
        const freqs = [520, 660, 880];
        const baseGain = 0.09;
        freqs.forEach((freq, i) => {
          const o = this.ctx.createOscillator();
          o.type = ['sine', 'sine', 'triangle'][i % 3];
          o.frequency.value = freq + i * 6;
          const g = this.ctx.createGain();
          g.gain.value = 0.0001;
          const bp = this.ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.Q.value = 6;
          bp.frequency.value = freq * 1.1;
          o.connect(bp);
          bp.connect(g);
          g.connect(this.master);
          o.start(now + i * 0.02);
          g.gain.exponentialRampToValueAtTime(baseGain / (i + 1), now + 0.02 + i * 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55 + i * 0.02);
          o.stop(now + 0.6 + i * 0.02);
        });
      } catch (e) {
        console.warn('success sound failed', e);
      }
    }

    // soft error buzz
    error() {
      if (!this.enabled || !this.available) return;
      try {
        const now = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1200;
        o.type = 'sawtooth';
        o.frequency.value = 140;
        o.connect(filter);
        filter.connect(g);
        g.connect(this.master);
        g.gain.setValueAtTime(0.0001, now);
        o.start(now);
        g.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        o.frequency.exponentialRampToValueAtTime(420, now + 0.18);
        o.stop(now + 0.25);
      } catch (e) {
        console.warn('error sound failed', e);
      }
    }

    // gentle tap for movement/hints
    tap() {
      if (!this.enabled || !this.available) return;
      try {
        const now = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = 420;
        o.connect(g);
        g.connect(this.master);
        g.gain.setValueAtTime(0.0001, now);
        o.start(now);
        g.gain.exponentialRampToValueAtTime(0.06, now + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        o.stop(now + 0.13);
      } catch (e) {
        console.warn('tap sound failed', e);
      }
    }
  }

  const sound = new SoundManager();

  // Utility: rounded rectangle drawing
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Characters (visuals improved: subtle motion, textures)
  class Character {
    constructor(name, color, x, y, flip = false) {
      this.name = name;
      this.color = color;
      this.x = x;
      this.y = y;
      this.w = 120;
      this.h = 140;
      this.wave = Math.random() * Math.PI * 2;
      this.flip = flip;
    }

    update(dt) {
      this.wave += dt * 2.2;
    }

    draw(ctx, time) {
      ctx.save();
      ctx.translate(this.x, this.y + Math.sin(this.wave) * 3);
      if (this.flip) ctx.scale(-1, 1);

      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(0, 68, 46, 14, 0, 0, Math.PI * 2);
      ctx.fill();

      // rounded torso with subtle gradient
      const grd = ctx.createLinearGradient(-40, -20, 40, 60);
      grd.addColorStop(0, shadeColor(this.color, -8));
      grd.addColorStop(1, shadeColor(this.color, 8));
      ctx.fillStyle = grd;
      roundRect(ctx, -40, -18, 80, 70, 16);
      ctx.fill();

      // head
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, -36, 30, 0, Math.PI * 2);
      ctx.fill();

      // cheeks
      ctx.fillStyle = 'rgba(255,160,160,0.9)';
      ctx.beginPath();
      ctx.arc(-10, -28, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(10, -28, 6, 0, Math.PI * 2);
      ctx.fill();

      // eyes
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(-9, -36, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(9, -36, 4.5, 0, Math.PI * 2);
      ctx.fill();

      // friendly goggles / visor for Volt
      if (this.name === 'Volt') {
        ctx.strokeStyle = 'rgba(40,60,80,0.6)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-16, -36);
        ctx.lineTo(16, -36);
        ctx.stroke();
      }

      // smile
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, -28, 8, 0, Math.PI);
      ctx.stroke();

      // tool: little lightning wrench or bolt badge
      ctx.save();
      ctx.translate(36, 6 + Math.sin(this.wave * 3) * 2);
      ctx.rotate(Math.sin(this.wave * 2) * 0.25);
      ctx.fillStyle = '#ffd54f';
      roundRect(ctx, -6, -16, 12, 32, 4);
      ctx.fill();
      ctx.fillStyle = '#ff8a00';
      ctx.beginPath();
      ctx.moveTo(6, -12);
      ctx.lineTo(14, -4);
      ctx.lineTo(6, 4);
      ctx.lineTo(8, -2);
      ctx.lineTo(0, -2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // nameplate
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      roundRect(ctx, -44, 54, 88, 18, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.name, 0, 68);

      ctx.restore();
    }
  }

  // Slight color helper for gradients
  function shadeColor(hex, percent) {
    // convert #rrggbb to a slightly lighter/darker string
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(ch => ch + ch).join('');
    const num = parseInt(c, 16);
    let r = (num >> 16) + percent;
    let g = ((num >> 8) & 0x00FF) + percent;
    let b = (num & 0x0000FF) + percent;
    r = clamp(Math.round(r), 0, 255);
    g = clamp(Math.round(g), 0, 255);
    b = clamp(Math.round(b), 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  // Battery and Bulb (mechanics unchanged)
  class Battery {
    constructor(id, val, x, y) {
      this.id = id;
      this.val = val;
      this.x = x;
      this.y = y;
      this.r = 32;
      this.drag = false;
      this.offsetX = 0;
      this.offsetY = 0;
      this.attachedTo = null;
      this.pulse = Math.random() * Math.PI * 2;
      this.visible = true;
      this.focused = false;
      this.shine = Math.random() * 1000;
    }

    contains(px, py) {
      return Math.hypot(px - this.x, py - this.y) <= this.r;
    }

    draw(ctx, time) {
      if (!this.visible) return;
      this.pulse += 0.06;
      ctx.save();
      ctx.translate(this.x, this.y);

      // outer glow when dragging or focused
      if (this.drag || this.focused) {
        const glow = this.drag ? 0.9 : 0.45;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.fillStyle = `rgba(255,200,80,${0.03 * glow * (1 - i * 0.2)})`;
          ctx.arc(0, 0, this.r + 14 + i * 8, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // battery body with metallic stripes
      const bodyGrad = ctx.createLinearGradient(-26, -40, 26, 40);
      bodyGrad.addColorStop(0, '#fff9e6');
      bodyGrad.addColorStop(1, '#ffefc2');
      ctx.fillStyle = bodyGrad;
      roundRect(ctx, -26, -40, 52, 80, 8);
      ctx.fill();

      // stripes texture
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#ffd295';
      ctx.lineWidth = 2;
      for (let sx = -26; sx < 26; sx += 6) {
        ctx.beginPath();
        ctx.moveTo(sx + ((time + this.shine * 0.001) % 8), -40);
        ctx.lineTo(sx - 6 + ((time + this.shine * 0.001) % 8), 40);
        ctx.stroke();
      }
      ctx.restore();

      // top terminal
      ctx.fillStyle = '#cfcfcf';
      roundRect(ctx, -10, -46, 20, 12, 3);
      ctx.fill();

      // lightning symbol with subtle gradient
      const boltGrad = ctx.createLinearGradient(-6, -6, 6, 18);
      boltGrad.addColorStop(0, '#ffd54f');
      boltGrad.addColorStop(1, '#ff8a00');
      ctx.fillStyle = boltGrad;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(6, -6);
      ctx.lineTo(0, 18);
      ctx.lineTo(8, 4);
      ctx.lineTo(-4, 4);
      ctx.closePath();
      ctx.fill();

      // value with slight emboss
      ctx.fillStyle = '#222';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.val, 0, 28);

      // focus ring
      if (this.focused) {
        ctx.strokeStyle = 'rgba(255,250,200,0.9)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, this.r + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  class Bulb {
    constructor(id, target, x, y) {
      this.id = id;
      this.target = target;
      this.x = x;
      this.y = y;
      this.r = 46;
      this.attached = [];
      this.lit = false;
      this.glow = 0;
      this.focused = false;
      this.breath = Math.random() * Math.PI * 2;
    }

    contains(px, py) {
      return Math.hypot(px - this.x, py - this.y) <= this.r;
    }

    currentSum(batteries) {
      return this.attached.reduce((s, bid) => {
        const b = batteries.find(bb => bb.id === bid);
        return s + (b ? b.val : 0);
      }, 0);
    }

    update(dt, batteries) {
      const sum = this.currentSum(batteries);
      if (sum === this.target) {
        this.lit = true;
        this.glow = Math.min(1, this.glow + dt * 4);
      } else {
        this.lit = false;
        this.glow = Math.max(0, this.glow - dt * 2);
      }
      this.breath += dt * 3;
    }

    draw(ctx, batteries, time) {
      ctx.save();
      ctx.translate(this.x, this.y);

      // glass base with strong subtle reflection
      const litAmt = this.glow;
      const glassGrad = ctx.createRadialGradient(-8, -18, 6, 10, 8, 120);
      glassGrad.addColorStop(0, `rgba(255,255,225,${0.55 * (0.5 + litAmt * 0.5)})`);
      glassGrad.addColorStop(1, `rgba(30,60,90,${0.06 + litAmt * 0.16})`);
      ctx.fillStyle = glassGrad;
      ctx.beginPath();
      ctx.ellipse(0, -6, this.r * 0.9, this.r, 0, 0, Math.PI * 2);
      ctx.fill();

      // soft top highlight
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath();
      ctx.ellipse(-10, -22, this.r * 0.6, this.r * 0.42, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // filament or decorative bolt inside
      if (this.lit) {
        // glowing filament
        ctx.save();
        ctx.shadowColor = 'rgba(255,220,100,0.9)';
        ctx.shadowBlur = 22 * litAmt;
        ctx.strokeStyle = `rgba(255,230,120,${0.95})`;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-12, -8 + Math.sin(time * 6) * 2);
        ctx.lineTo(-2, 8 + Math.cos(time * 10) * 2);
        ctx.lineTo(12, -10);
        ctx.stroke();
        ctx.restore();

        // halo
        ctx.fillStyle = `rgba(255,220,120,${0.07 + 0.3 * litAmt})`;
        ctx.beginPath();
        ctx.ellipse(0, -6, this.r * 1.6, this.r * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // simple filament drawing
        ctx.strokeStyle = '#6d6d6d';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-12, -8);
        ctx.lineTo(-2, 8);
        ctx.lineTo(12, -10);
        ctx.stroke();
      }

      // metal screw base
      ctx.fillStyle = '#a6a6a6';
      roundRect(ctx, -28, 20, 56, 18, 4);
      ctx.fill();
      // subtle ridges
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      for (let ri = 0; ri < 3; ri++) {
        ctx.beginPath();
        ctx.moveTo(-26, 20 + 4 + ri * 4);
        ctx.lineTo(26, 20 + 4 + ri * 4);
        ctx.stroke();
      }

      // labels
      ctx.fillStyle = '#fff';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Need ${this.target}`, 0, 56);

      const sum = this.currentSum(batteries);
      ctx.fillStyle = sum > this.target ? '#ffd1d1' : '#bfefff';
      ctx.font = '16px bold sans-serif';
      ctx.fillText(`${sum}/${this.target}`, 0, 40);

      if (this.focused) {
        ctx.strokeStyle = 'rgba(180,220,255,0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -6, this.r + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  // Main Game: mechanics preserved, visuals/audio enhanced
  class Game {
    constructor(ctx) {
      this.ctx = ctx;
      this.last = performance.now();
      this.batteries = [];
      this.bulbs = [];
      this.characters = [
        new Character('Sparky', '#ff8a80', 110, 110, false),
        new Character('Volt', '#82b1ff', 610, 120, true)
      ];
      this.selectedBattery = null;
      this.focusList = [];
      this.focusIndex = 0;
      this.mouseOver = null;
      this.electrons = [];
      this.time = 0;
      this.audioOn = sound.enabled && sound.available;
      this.announced = '';
      this.running = true;
      this.celebrated = false;
      this.generatePuzzle();
      this.bindEvents();
      this.frame = this.frame.bind(this);
      requestAnimationFrame(this.frame);
    }

    generatePuzzle() {
      this.batteries = [];
      this.bulbs = [];
      const possibleTargets = [5, 6, 7, 8, 9, 10, 11, 12, 13];
      for (let i = 0; i < 3; i++) {
        const idx = randInt(0, possibleTargets.length - 1);
        const target = possibleTargets.splice(idx, 1)[0];
        const x = 180 + i * 180;
        const y = 200;
        this.bulbs.push(new Bulb(i, target, x, y));
      }

      const usedVals = [];
      let bid = 0;
      this.bulbs.forEach((bulb) => {
        const parts = Math.random() < 0.3 ? 3 : 2;
        let remaining = bulb.target;
        for (let p = 0; p < parts; p++) {
          const maxVal = Math.min(9, remaining - (parts - p - 1) * 1);
          const minVal = Math.max(1, Math.floor(remaining / (parts - p)) - 2);
          let v = randInt(minVal, maxVal);
          if (usedVals.includes(v)) v = Math.max(1, v - 1);
          remaining -= v;
          usedVals.push(v);
          const bx = 80 + (usedVals.length - 1) * 90 + (Math.random() * 20 - 10);
          const by = 360 + (Math.random() * 40 - 20);
          this.batteries.push(new Battery(bid++, v, bx, by));
        }
      });

      const extras = 3;
      for (let i = 0; i < extras; i++) {
        const v = randInt(1, 9);
        const bx = 80 + this.batteries.length * 82 + (Math.random() * 20 - 10);
        const by = 360 + (Math.random() * 40 - 20);
        this.batteries.push(new Battery(bid++, v, bx, by));
      }

      this.batteries.forEach((b, i) => {
        b.x = 70 + i * 90;
        b.y = 350 + (i % 2 === 0 ? -8 : 8);
        b.visible = true;
        b.attachedTo = null;
      });

      this.focusList = [
        ...this.batteries.map(b => ({ type: 'battery', id: b.id })),
        ...this.bulbs.map(b => ({ type: 'bulb', id: b.id }))
      ];
      this.focusIndex = 0;
      this.updateFocus();
      this.electrons = [];
      live.textContent = 'New puzzle. Drag number batteries to bulbs to make the sums match the needed values.';
      this.announce('New puzzle ready. Drag batteries to bulbs to match the numbers.');
    }

    updateFocus() {
      this.batteries.forEach(b => (b.focused = false));
      this.bulbs.forEach(b => (b.focused = false));
      const focused = this.focusList[this.focusIndex];
      if (!focused) return;
      if (focused.type === 'battery') {
        const b = this.batteries.find(bb => bb.id === focused.id);
        if (b) b.focused = true;
      } else {
        const bl = this.bulbs.find(bb => bb.id === focused.id);
        if (bl) bl.focused = true;
      }
    }

    bindEvents() {
      canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.down = true;
        this.onPointerDown(mouse.x, mouse.y);
      });
      window.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        if (mouse.down) this.onPointerMove(mouse.x, mouse.y);
      });
      window.addEventListener('mouseup', (e) => {
        if (mouse.down) {
          const rect = canvas.getBoundingClientRect();
          mouse.x = e.clientX - rect.left;
          mouse.y = e.clientY - rect.top;
          this.onPointerUp(mouse.x, mouse.y);
        }
        mouse.down = false;
      });

      // Touch
      canvas.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          if (touchId !== null) return;
          const t = e.changedTouches[0];
          touchId = t.identifier;
          const rect = canvas.getBoundingClientRect();
          const x = t.clientX - rect.left;
          const y = t.clientY - rect.top;
          mouse.x = x;
          mouse.y = y;
          mouse.down = true;
          this.onPointerDown(x, y);
        },
        { passive: false }
      );

      canvas.addEventListener(
        'touchmove',
        (e) => {
          e.preventDefault();
          for (let t of e.changedTouches) {
            if (t.identifier === touchId) {
              const rect = canvas.getBoundingClientRect();
              const x = t.clientX - rect.left;
              const y = t.clientY - rect.top;
              mouse.x = x;
              mouse.y = y;
              this.onPointerMove(x, y);
              break;
            }
          }
        },
        { passive: false }
      );

      canvas.addEventListener(
        'touchend',
        (e) => {
          e.preventDefault();
          for (let t of e.changedTouches) {
            if (t.identifier === touchId) {
              const rect = canvas.getBoundingClientRect();
              const x = t.clientX - rect.left;
              const y = t.clientY - rect.top;
              this.onPointerUp(x, y);
              touchId = null;
              mouse.down = false;
              break;
            }
          }
        },
        { passive: false }
      );

      // Keyboard interactions
      canvas.addEventListener('keydown', async (e) => {
        if (sound.available) await sound.resume();

        if (e.key === 'Tab') {
          e.preventDefault();
          this.focusIndex = (this.focusIndex + 1) % this.focusList.length;
          this.updateFocus();
          sound.tap();
          this.announce('Focus moved');
        } else if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const focused = this.focusList[this.focusIndex];
          if (!focused) return;
          if (focused.type === 'battery') {
            const battery = this.batteries.find(b => b.id === focused.id);
            if (!this.selectedBattery) {
              this.selectedBattery = battery;
              battery.drag = true;
              battery.offsetX = 0;
              battery.offsetY = 0;
              sound.click();
              this.announce(`Picked up battery ${battery.val}`);
            } else if (this.selectedBattery.id === battery.id) {
              this.selectedBattery.drag = false;
              this.selectedBattery = null;
              sound.tap();
              this.announce('Placed battery down');
            } else {
              this.selectedBattery.drag = false;
              this.selectedBattery = battery;
              this.selectedBattery.drag = true;
              sound.click();
              this.announce(`Picked up battery ${battery.val}`);
            }
          } else if (focused.type === 'bulb') {
            const bulb = this.bulbs.find(b => b.id === focused.id);
            if (this.selectedBattery) {
              this.tryAttach(this.selectedBattery, bulb);
            } else {
              const sum = bulb.currentSum(this.batteries);
              this.announce(`Bulb needs ${bulb.target}. It currently has ${sum}.`);
            }
          }
        } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
          if (this.selectedBattery) {
            switch (e.key) {
              case 'ArrowLeft':
                this.selectedBattery.x -= 12;
                break;
              case 'ArrowRight':
                this.selectedBattery.x += 12;
                break;
              case 'ArrowUp':
                this.selectedBattery.y -= 12;
                break;
              case 'ArrowDown':
                this.selectedBattery.y += 12;
                break;
            }
            sound.tap();
          }
        } else if (e.key === 'r' || e.key === 'R') {
          this.generatePuzzle();
          sound.tap();
        } else if (e.key === 'm' || e.key === 'M') {
          this.audioOn = !this.audioOn;
          sound.setEnabled(this.audioOn);
          this.announce(`Audio ${this.audioOn ? 'on' : 'off'}`);
        }
      });

      // Focus announcements
      canvas.addEventListener('focus', () => {
        this.announce(
          'Game focused. Tab to cycle through batteries and bulbs. Enter to pick up or attach. Arrow keys move picked battery. Press R for new puzzle. Press M to toggle audio.'
        );
      });

      // Click handler for UI buttons (Reset & Audio & speaker icon)
      canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Reset button area
        if (x >= WIDTH - 120 && x <= WIDTH - 16 && y >= 18 && y <= 54) {
          this.generatePuzzle();
          sound.tap();
          return;
        }
        // Audio toggle
        if (x >= WIDTH - 260 && x <= WIDTH - 140 && y >= 18 && y <= 54) {
          this.audioOn = !this.audioOn;
          sound.setEnabled(this.audioOn);
          this.announce(`Audio ${this.audioOn ? 'on' : 'off'}`);
          return;
        }
        // Speaker icon bottom-right
        if (x >= WIDTH - 52 && x <= WIDTH - 16 && y >= HEIGHT - 52 && y <= HEIGHT - 16) {
          this.audioOn = !this.audioOn;
          sound.setEnabled(this.audioOn);
          this.announce(`Audio ${this.audioOn ? 'on' : 'off'}`);
          return;
        }
      });
    }

    onPointerDown(x, y) {
      const b = this.batteries.slice().reverse().find(bb => bb.visible && bb.contains(x, y));
      if (b) {
        this.selectedBattery = b;
        b.drag = true;
        b.offsetX = x - b.x;
        b.offsetY = y - b.y;
        this.focusIndex = this.focusList.findIndex(f => f.type === 'battery' && f.id === b.id);
        this.updateFocus();
        sound.click();
        this.announce(`Picked up battery ${b.val}`);
        return;
      }

      const bl = this.bulbs.find(bb => bb.contains(x, y));
      if (bl && this.selectedBattery) {
        this.tryAttach(this.selectedBattery, bl);
        return;
      }

      if (this.selectedBattery) {
        this.selectedBattery.drag = false;
        this.announce('Placed battery');
        this.selectedBattery = null;
        sound.tap();
      }
    }

    onPointerMove(x, y) {
      if (this.selectedBattery && this.selectedBattery.drag) {
        this.selectedBattery.x = x - this.selectedBattery.offsetX;
        this.selectedBattery.y = y - this.selectedBattery.offsetY;
      } else {
        const overB = this.batteries.find(bb => bb.visible && bb.contains(x, y));
        if (overB) {
          this.mouseOver = { type: 'battery', id: overB.id };
        } else {
          const overBulb = this.bulbs.find(bb => bb.contains(x, y));
          if (overBulb) this.mouseOver = { type: 'bulb', id: overBulb.id };
          else this.mouseOver = null;
        }
      }
    }

    onPointerUp(x, y) {
      if (this.selectedBattery && this.selectedBattery.drag) {
        const overBulb = this.bulbs.find(bb => bb.contains(x, y));
        if (overBulb) {
          this.tryAttach(this.selectedBattery, overBulb);
        } else {
          this.selectedBattery.drag = false;
          this.selectedBattery = null;
          sound.tap();
        }
      }
    }

    tryAttach(battery, bulb) {
      if (!battery || !bulb) return;
      if (battery.attachedTo !== null) {
        const old = this.bulbs.find(b => b.id === battery.attachedTo);
        if (old) {
          old.attached = old.attached.filter(id => id !== battery.id);
        }
      }
      battery.attachedTo = bulb.id;
      bulb.attached.push(battery.id);
      battery.visible = true;
      battery.drag = false;
      const angle = (bulb.attached.length - 1) * 0.6 - 0.6;
      const dist = bulb.r + 30;
      battery.x = bulb.x + Math.cos(angle) * dist;
      battery.y = bulb.y + Math.sin(angle) * dist;
      sound.click();
      const sum = bulb.currentSum(this.batteries);
      if (sum === bulb.target) {
        sound.success();
        this.spawnElectrons(bulb);
        this.announce(`Bulb ${bulb.id + 1} lit! You matched ${bulb.target}.`);
      } else if (sum > bulb.target) {
        sound.error();
        this.announce(
          `Too much! Bulb ${bulb.id + 1} needs ${bulb.target} but has ${sum}. Remove some batteries.`
        );
      } else {
        sound.tap();
        this.announce(`Good. Bulb ${bulb.id + 1} now has ${sum} of ${bulb.target}.`);
      }
      if (this.selectedBattery && this.selectedBattery.id === battery.id) {
        this.selectedBattery = null;
      }
    }

    spawnElectrons(bulb) {
      const attachedBats = bulb.attached
        .map(id => this.batteries.find(b => b.id === id))
        .filter(Boolean);
      attachedBats.forEach((bat) => {
        for (let k = 0; k < Math.min(4, bat.val); k++) {
          this.electrons.push({
            x: bat.x,
            y: bat.y,
            tx: bulb.x + (Math.random() * 20 - 10),
            ty: bulb.y - 6 + (Math.random() * 10 - 5),
            life: 0,
            speed: 0.02 + Math.random() * 0.03,
            color: `hsl(${45 + Math.random() * 40}, 95%, ${60 + Math.random() * 10}%)`,
            size: 3 + Math.random() * 3
          });
        }
      });
    }

    update(dt) {
      this.time += dt;
      this.characters.forEach(c => c.update(dt));
      this.bulbs.forEach(b => b.update(dt, this.batteries));
      this.electrons = this.electrons.filter(e => e.life < 1);
      this.electrons.forEach(e => {
        e.life = Math.min(1, e.life + e.speed);
        const t = easeOutCubic(e.life);
        e.x = lerp(e.x, e.tx, t);
        e.y = lerp(e.y, e.ty, t);
      });

      if (this.bulbs.every(b => b.lit)) {
        if (!this.celebrated) {
          this.celebrated = true;
          sound.success();
          this.announce('All bulbs lit! Great job! Press R to play again.');
          this.bulbs.forEach((bulb) => {
            for (let i = 0; i < 14; i++) {
              this.electrons.push({
                x: bulb.x + (Math.random() * 200 - 100),
                y: bulb.y + (Math.random() * 200 - 100),
                tx: bulb.x + (Math.random() * 24 - 12),
                ty: bulb.y - 6 + (Math.random() * 14 - 7),
                life: 0,
                speed: 0.02 + Math.random() * 0.03,
                color: `hsl(${40 + Math.random() * 40}, 95%, ${58 + Math.random() * 8}%)`,
                size: 3 + Math.random() * 3
              });
            }
          });
        }
      } else {
        this.celebrated = false;
      }
    }

    frame(now) {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.render(now / 1000);
      requestAnimationFrame(this.frame);
    }

    render(time) {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // Background: soft layered gradients, gentle particle field
      this.drawBackground(ctx, time);

      // characters
      this.characters.forEach(c => c.draw(ctx, time));

      // bulbs then wires then batteries for layering
      this.bulbs.forEach(b => b.draw(ctx, this.batteries, time));
      this.drawWires(ctx, time);
      this.batteries.forEach(b => b.draw(ctx, time));

      // electrons particles (glow blend)
      this.electrons.forEach(e => {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = e.color;
        const alpha = 0.9 - e.life * 0.9;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // UI overlay
      this.drawUI(ctx);

      // audio icon
      this.drawAudioIcon(ctx);

      // tooltip
      if (this.mouseOver) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        roundRect(ctx, 12, HEIGHT - 78, 300, 54, 8);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'left';
        if (this.mouseOver.type === 'battery') {
          const b = this.batteries.find(bb => bb.id === this.mouseOver.id);
          ctx.fillText(`Battery ${b.val}. Drag to a bulb to add.`, 22, HEIGHT - 48);
        } else {
          const bl = this.bulbs.find(bb => bb.id === this.mouseOver.id);
          ctx.fillText(`Bulb needs ${bl.target}. Current ${bl.currentSum(this.batteries)}.`, 22, HEIGHT - 48);
        }
      }

      // footer hints
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Tab: change focus • Enter: pick/place • Arrows: move picked battery • R: reset • M: audio', 12, HEIGHT - 12);
    }

    drawBackground(ctx, time) {
      // gradient sky with vignette
      const g = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      g.addColorStop(0, '#05202e');
      g.addColorStop(1, '#081b2b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // soft radial vignette
      ctx.save();
      const vg = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 50, WIDTH / 2, HEIGHT / 2, 520);
      vg.addColorStop(0, 'rgba(255,255,255,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.35)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.restore();

      // circuit-like flowing nodes (subtle)
      ctx.save();
      ctx.globalAlpha = 0.08;
      for (let i = 0; i < 24; i++) {
        const px = (i % 8) * 90 + ((Math.sin(time * 0.6 + i) + 1) * 6);
        const py = Math.floor(i / 8) * 120 + ((Math.cos(time * 0.4 + i * 0.3) + 1) * 6);
        ctx.fillStyle = `rgba(70,160,230,${0.3 + 0.15 * Math.sin(time + i)})`;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawWires(ctx, time) {
      ctx.save();
      ctx.lineCap = 'round';
      this.bulbs.forEach((bulb) => {
        bulb.attached.forEach((bid) => {
          const b = this.batteries.find(bb => bb.id === bid);
          if (!b) return;
          const litAmt = bulb.glow;
          const sx = b.x;
          const sy = b.y;
          const tx = bulb.x;
          const ty = bulb.y - 6;
          const mx = (sx + tx) / 2;
          const cp1x = mx + (sy - ty) * 0.14;
          const cp1y = sy + (ty - sy) * 0.36;
          const cp2x = mx - (sy - ty) * 0.14;
          const cp2y = ty - (ty - sy) * 0.36;

          // base glow
          const grad = ctx.createLinearGradient(sx, sy, tx, ty);
          grad.addColorStop(0, `rgba(255,210,110,${0.35})`);
          grad.addColorStop(1, `rgba(160,230,255,${0.45 + litAmt * 0.45})`);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 6 + litAmt * 10;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tx, ty);
          ctx.stroke();

          // bright core
          ctx.strokeStyle = `rgba(255,255,220,${0.95})`;
          ctx.lineWidth = 2 + litAmt * 3;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tx, ty);
          ctx.stroke();

          // subtle animated dotted energy along path
          const segs = 16;
          for (let s = 0; s < segs; s++) {
            const t = s / (segs - 1);
            // cubic bezier point
            const pt = cubicBezierPoint(sx, sy, cp1x, cp1y, cp2x, cp2y, tx, ty, (t + time * 0.08) % 1);
            ctx.fillStyle = `rgba(255,245,210,${0.12 * (0.5 + Math.sin(time * 4 + s) * 0.5)})`;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 1.2 + litAmt * 1.8, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      });
      ctx.restore();
    }

    drawUI(ctx) {
      // title panel
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      roundRect(ctx, 8, 8, 420, 64, 10);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.font = '24px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Charge the Bulbs!', 22, 36);

      ctx.fillStyle = '#bfe8ff';
      ctx.font = '13px sans-serif';
      ctx.fillText('Help Sparky and Volt by adding number batteries to make each bulb reach its target.', 22, 56);

      // Reset button
      const bx = WIDTH - 120;
      const by = 18;
      const bw = 104;
      const bh = 36;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, bx, by, bw, bh, 8);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('New Puzzle (R)', bx + bw / 2, by + 24);

      // Audio toggle
      const ax = WIDTH - 260;
      const ay = 18;
      const aw = 120;
      const ah = 36;
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, ax, ay, aw, ah, 8);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Audio: ${this.audioOn ? 'On (M)' : 'Off (M)'}`, ax + aw / 2, ay + 24);
    }

    drawAudioIcon(ctx) {
      const x = WIDTH - 34;
      const y = HEIGHT - 34;
      ctx.save();
      // circular button
      ctx.beginPath();
      ctx.fillStyle = this.audioOn ? '#ffd54f' : '#505050';
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.audioOn ? '🔊' : '🔈', x, y);
      ctx.restore();

      if (!sound.available) {
        ctx.fillStyle = '#ff8a80';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('Audio Unavailable', WIDTH - 12, HEIGHT - 12);
      }
    }

    announce(text) {
      if (text === this.announced) return;
      this.announced = text;
      live.textContent = text;
    }
  }

  // Math helpers (unchanged)
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  // cubic bezier point calc
  function cubicBezierPoint(x0, y0, x1, y1, x2, y2, x3, y3, t) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    let x = uuu * x0;
    x += 3 * uu * t * x1;
    x += 3 * u * tt * x2;
    x += ttt * x3;
    let y = uuu * y0;
    y += 3 * uu * t * y1;
    y += 3 * u * tt * y2;
    y += ttt * y3;
    return { x, y };
  }

  // Start the game
  const game = new Game(ctx);

  // Ensure audio resumes gracefully on first user interaction
  window.addEventListener('click', async function resumeAudioOnce() {
    await sound.resume();
    window.removeEventListener('click', resumeAudioOnce);
  });

  // Ensure canvas focusable and focused
  canvas.focus();
})();