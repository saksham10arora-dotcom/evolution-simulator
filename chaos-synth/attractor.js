/**
 * Chaos Synth - Attractor Math and Web Audio Synthesizer Engine
 */

// --- 1. Particle Class (Attractor solver point) ---
class Particle {
  constructor(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.vx = 0;
    this.vy = 0;
    this.vz = 0;
    this.history = []; // local ribbon trail coordinates
    this.maxHistory = 15;
  }

  update(type, params, dt) {
    let dx = 0;
    let dy = 0;
    let dz = 0;

    // Apply specific differential equations
    if (type === 'lorenz') {
      const s = params.sigma;
      const r = params.rho;
      const b = params.beta;
      dx = s * (this.y - this.x);
      dy = this.x * (r - this.z) - this.y;
      dz = this.x * this.y - b * this.z;
    } 
    else if (type === 'aizawa') {
      const a = params.a;
      const b = params.b;
      const c = params.c;
      const d = params.d;
      const e = params.e;
      const f = params.f;
      dx = (this.z - b) * this.x - d * this.y;
      dy = d * this.x + (this.z - b) * this.y;
      dz = c + a * this.z - (this.z * this.z * this.z) / 3 - (this.x * this.x + this.y * this.y) * (1 + e * this.z) + f * this.z * (this.x * this.x * this.x);
    } 
    else if (type === 'halvorsen') {
      const a = params.a;
      dx = -a * this.x - 4 * this.y - 4 * this.z - this.y * this.y;
      dy = -a * this.y - 4 * this.z - 4 * this.x - this.z * this.z;
      dz = -a * this.z - 4 * this.x - 4 * this.y - this.x * this.x;
    } 
    else if (type === 'rossler') {
      const a = params.a;
      const b = params.b;
      const c = params.c;
      dx = -this.y - this.z;
      dy = this.x + a * this.y;
      dz = b + this.z * (this.x - c);
    }

    // Save velocities
    this.vx = dx;
    this.vy = dy;
    this.vz = dz;

    // Update positions
    this.x += dx * dt;
    this.y += dy * dt;
    this.z += dz * dt;

    // Update trail
    this.history.push({ x: this.x, y: this.y, z: this.z });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
}

// --- 2. Chaos Attractor System ---
class ChaosSystem {
  constructor() {
    this.type = 'lorenz';
    this.particles = [];
    this.maxParticles = 1800;
    
    // Attractor Parameters Configurations
    this.configs = {
      lorenz: {
        name: "Lorenz Attractor",
        dt: 0.005,
        defaults: { sigma: 10, rho: 28, beta: 2.666 },
        ranges: { sigma: [2, 22, 0.5], rho: [5, 45, 0.5], beta: [0.5, 6, 0.1] },
        formula: ["dx = σ(y - x) dt", "dy = (x(ρ - z) - y) dt", "dz = (xy - βz) dt"],
        startRange: { x: [-1, 1], y: [-1, 1], z: [20, 22] }
      },
      aizawa: {
        name: "Aizawa Attractor",
        dt: 0.010,
        defaults: { a: 0.95, b: 0.7, c: 0.6, d: 3.5, e: 0.25, f: 0.1 },
        ranges: { a: [0.1, 1.5, 0.05], b: [0.1, 1.2, 0.05], c: [0.1, 1.2, 0.05], d: [1.0, 5.0, 0.1], e: [0.05, 0.5, 0.05], f: [0.02, 0.3, 0.01] },
        formula: ["dx = (z-b)x - dy", "dy = dx + (z-b)y", "dz = c + az - z³/3 - (x²+y²)(1+ez) + fzx³"],
        startRange: { x: [-0.1, 0.1], y: [-0.1, 0.1], z: [0.1, 0.2] }
      },
      halvorsen: {
        name: "Halvorsen Attractor",
        dt: 0.005,
        defaults: { a: 1.4 },
        ranges: { a: [0.5, 2.5, 0.1] },
        formula: ["dx = -ax - 4y - 4z - y²", "dy = -ay - 4z - 4x - z²", "dz = -az - 4x - 4y - x²"],
        startRange: { x: [-1, 0], y: [-1, 0], z: [-1, 0] }
      },
      rossler: {
        name: "Rössler Attractor",
        dt: 0.015,
        defaults: { a: 0.2, b: 0.2, c: 5.7 },
        ranges: { a: [0.05, 0.4, 0.01], b: [0.05, 0.4, 0.01], c: [2.0, 10.0, 0.1] },
        formula: ["dx = -y - z", "dy = x + ay", "dz = b + z(x - c)"],
        startRange: { x: [0.1, 0.5], y: [0.1, 0.5], z: [0.1, 0.5] }
      }
    };

    this.params = { ...this.configs.lorenz.defaults };
    this.initSwarm();
  }

  changeAttractor(type) {
    this.type = type;
    this.params = { ...this.configs[type].defaults };
    this.initSwarm();
  }

  initSwarm() {
    this.particles = [];
    const ranges = this.configs[this.type].startRange;
    
    // Spawn particles with micro random variations
    for (let i = 0; i < this.maxParticles; i++) {
      const rx = ranges.x[0] + Math.random() * (ranges.x[1] - ranges.x[0]);
      const ry = ranges.y[0] + Math.random() * (ranges.y[1] - ranges.y[0]);
      const rz = ranges.z[0] + Math.random() * (ranges.z[1] - ranges.z[0]);
      
      // Inject some minor perturbation offset
      const offset = 0.002 * (i - this.maxParticles/2);
      this.particles.push(new Particle(rx + offset, ry, rz));
    }
  }

  update() {
    const dt = this.configs[this.type].dt;
    for (const p of this.particles) {
      p.update(this.type, this.params, dt);
    }
  }

  // Get average metrics for sound synthesis
  getAverageMetrics() {
    if (this.particles.length === 0) return { x: 0, y: 0, z: 0, speed: 0 };
    
    let sumX = 0, sumY = 0, sumZ = 0, sumSpeed = 0;
    
    for (const p of this.particles) {
      sumX += p.x;
      sumY += p.y;
      sumZ += p.z;
      
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
      sumSpeed += speed;
    }
    
    const count = this.particles.length;
    return {
      x: sumX / count,
      y: sumY / count,
      z: sumZ / count,
      speed: sumSpeed / count
    };
  }

  // Helper limits for mapping variables based on attractor type
  getExtents() {
    if (this.type === 'lorenz') {
      return { x: [-20, 20], y: [-20, 20], z: [5, 45] };
    } else if (this.type === 'aizawa') {
      return { x: [-1.8, 1.8], y: [-1.8, 1.8], z: [-0.8, 2.2] };
    } else if (this.type === 'halvorsen') {
      return { x: [-8, 4], y: [-8, 4], z: [-8, 4] };
    } else { // rossler
      return { x: [-10, 12], y: [-10, 12], z: [0, 22] };
    }
  }
}

// --- 3. Web Audio Synthesizer Class ---
class ChaosSynthesizer {
  constructor() {
    this.audioCtx = null;
    
    // Audio Nodes
    this.osc1 = null;
    this.osc2 = null; // sub-oscillator
    this.filter = null;
    this.delay = null;
    this.delayFeedback = null;
    this.panner = null;
    
    // Volume Gain nodes
    this.synthGain = null;
    this.masterGain = null;
    
    this.isEnabled = false;
    this.waveform = 'sine';
    
    this.currentFrequency = 0;
  }

  init() {
    // Standard AudioContext initialization
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    
    // Create nodes
    this.osc1 = this.audioCtx.createOscillator();
    this.osc2 = this.audioCtx.createOscillator();
    this.filter = this.audioCtx.createBiquadFilter();
    this.delay = this.audioCtx.createDelay(1.0);
    this.delayFeedback = this.audioCtx.createGain();
    this.panner = this.audioCtx.createStereoPanner();
    
    this.synthGain = this.audioCtx.createGain();
    this.masterGain = this.audioCtx.createGain();

    // Configure lowpass resonant filter
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(800, this.audioCtx.currentTime);
    this.filter.Q.setValueAtTime(3.0, this.audioCtx.currentTime);

    // Configure Delay Loop (spacey echo effect)
    this.delay.delayTime.setValueAtTime(0.3, this.audioCtx.currentTime);
    this.delayFeedback.gain.setValueAtTime(0.4, this.audioCtx.currentTime);

    // Initial gains
    this.synthGain.gain.setValueAtTime(0.0, this.audioCtx.currentTime); // start silent
    this.masterGain.gain.setValueAtTime(0.7, this.audioCtx.currentTime);

    // --- NODE GRAPH CONNECTIONS ---
    // Connect Carrier Oscillators to Synth Gain
    this.osc1.connect(this.synthGain);
    this.osc2.connect(this.synthGain);
    
    // Connect Synth Gain to Filter
    this.synthGain.connect(this.filter);
    
    // Setup Delay feedback loop
    this.filter.connect(this.delay);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay); // feedback loop
    
    // Connect dry + wet (delay output) signals to Panner
    this.filter.connect(this.panner);
    this.delay.connect(this.panner);

    // Connect Panner to Master Gain, and then to speakers
    this.panner.connect(this.masterGain);
    this.masterGain.connect(this.audioCtx.destination);

    // Set Waveforms
    this.osc1.type = this.waveform;
    this.osc2.type = this.waveform;

    // Start oscillators
    this.osc1.start(0);
    this.osc2.start(0);
  }

  toggle() {
    if (!this.audioCtx) {
      this.init();
    }
    
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    this.isEnabled = !this.isEnabled;
    
    // Fade in or fade out volume to prevent pops/clicks
    const now = this.audioCtx.currentTime;
    if (this.isEnabled) {
      this.synthGain.gain.cancelScheduledValues(now);
      this.synthGain.gain.linearRampToValueAtTime(0.18, now + 0.15); // fade in
    } else {
      this.synthGain.gain.cancelScheduledValues(now);
      this.synthGain.gain.linearRampToValueAtTime(0.0, now + 0.15); // fade out
    }

    return this.isEnabled;
  }

  setVolume(percentage) {
    if (!this.audioCtx) return;
    const gainVal = percentage / 100 * 0.7; // cap master
    this.masterGain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
  }

  setWaveform(type) {
    this.waveform = type;
    if (this.osc1 && this.osc2) {
      this.osc1.type = type;
      this.osc2.type = type;
    }
  }

  setEchoDelay(percentage) {
    if (!this.audioCtx) return;
    const delayTime = (percentage / 100) * 0.8; // max 0.8s
    
    this.delay.delayTime.cancelScheduledValues(this.audioCtx.currentTime);
    this.delay.delayTime.linearRampToValueAtTime(delayTime, this.audioCtx.currentTime + 0.1);
    
    // adjust feedback proportional to delay
    const feedback = delayTime > 0.05 ? 0.35 : 0;
    this.delayFeedback.gain.setValueAtTime(feedback, this.audioCtx.currentTime);
  }

  setFilterQ(q) {
    if (!this.audioCtx) return;
    this.filter.Q.setValueAtTime(q, this.audioCtx.currentTime);
  }

  updateSynthParameters(metrics, extents) {
    if (!this.isEnabled || !this.audioCtx) return;

    const now = this.audioCtx.currentTime;

    // 1. Map X average coordinate to Carrier Frequency (Oscillator Pitch)
    // Scale linear coordinate into log frequency scale (e.g. 70Hz to 600Hz)
    const normX = (metrics.x - extents.x[0]) / (extents.x[1] - extents.x[0]);
    const clampedX = Math.max(0, Math.min(1, normX));
    const targetFreq = 75 * Math.pow(8.0, clampedX); // log pitch interpolation
    
    this.currentFrequency = targetFreq;

    // Smooth frequency adjustments (glide / portamento) to prevent pops
    this.osc1.frequency.setTargetAtTime(targetFreq, now, 0.08);
    // Sub-oscillator is exactly 1 octave lower (freq / 2)
    this.osc2.frequency.setTargetAtTime(targetFreq / 2.0, now, 0.08);

    // 2. Map Y average coordinate to Stereo Panner (-1 is left, 1 is right)
    const normY = (metrics.y - extents.y[0]) / (extents.y[1] - extents.y[0]);
    const panVal = Math.max(-1.0, Math.min(1.0, (normY * 2) - 1));
    this.panner.pan.setTargetAtTime(panVal, now, 0.12);

    // 3. Map Z average coordinate to Filter Cutoff Frequency
    const normZ = (metrics.z - extents.z[0]) / (extents.z[1] - extents.z[0]);
    const clampedZ = Math.max(0, Math.min(1, normZ));
    const filterFreq = 180 + clampedZ * 2200; // Sweep ranges 180Hz - 2380Hz
    this.filter.frequency.setTargetAtTime(filterFreq, now, 0.08);

    // 4. Map Speed to Volume Gate
    // Fast speed boosts energy. Scale volume slightly.
    const speedScale = Math.min(1.0, metrics.speed / 45.0);
    const volumeLevel = 0.09 + speedScale * 0.14; // auto volume ducking/swell
    this.synthGain.gain.setTargetAtTime(volumeLevel, now, 0.1);
  }
}
