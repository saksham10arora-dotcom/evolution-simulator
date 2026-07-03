/**
 * Chaos Synth - UI, 3D Camera Controls, and Ribbon Trail Renderer
 */

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('chaos-canvas');
  const ctx = canvas.getContext('2d');

  // Initialize Chaotic attractor system
  const system = new ChaosSystem();
  
  // Initialize Synthesizer
  const synth = new ChaosSynthesizer();

  // 3D Camera Orbit controls
  let yaw = 0.5; // yaw rotation angle (horizontal)
  let pitch = 0.3; // pitch rotation angle (vertical)
  let cameraZoom = 12.0; // zoom scale multiplier
  
  let isDragging = false;
  let startMouseX = 0;
  let startMouseY = 0;
  let startYaw = 0;
  let startPitch = 0;

  // Fit canvas to containers
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // --- 1. 3D-to-2D Camera Projection Matrix ---
  function project(point) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    
    // Scale coordinate offsets based on attractor type
    let xOffset = 0;
    let yOffset = 0;
    let zOffset = 0;
    let coordinateScale = 1.0;

    if (system.type === 'lorenz') {
      zOffset = -25; // center Lorenz along Z axis
      coordinateScale = 7.0;
    } else if (system.type === 'aizawa') {
      zOffset = -0.8;
      coordinateScale = 110.0;
    } else if (system.type === 'halvorsen') {
      xOffset = 2.0;
      yOffset = 2.0;
      zOffset = 2.0;
      coordinateScale = 22.0;
    } else if (system.type === 'rossler') {
      zOffset = -10;
      coordinateScale = 12.0;
    }

    // Apply offset/center centering
    const cx = point.x + xOffset;
    const cy = point.y + yOffset;
    const cz = point.z + zOffset;

    // Yaw rotation (Y-axis rotation)
    const x1 = cx * Math.cos(yaw) - cz * Math.sin(yaw);
    const z1 = cx * Math.sin(yaw) + cz * Math.cos(yaw);
    
    // Pitch rotation (X-axis rotation)
    const y2 = cy * Math.cos(pitch) - z1 * Math.sin(pitch);
    const z2 = cy * Math.sin(pitch) + z1 * Math.cos(pitch);

    // Apply perspective scale
    const finalZoom = coordinateScale * (cameraZoom / 10.0);
    
    // Orthographic projection is simpler & highly readable, but perspective gives real depth!
    // We use a softened perspective projection
    const d = 300; // view distance
    const depthScale = d / (d + z2);

    const screenX = w / 2 + x1 * finalZoom * depthScale;
    const screenY = h / 2 - y2 * finalZoom * depthScale;

    return { x: screenX, y: screenY, depth: z2 };
  }

  // --- 2. Dynamic Sliders Generation ---
  function buildParameterSliders() {
    const container = document.getElementById('param-sliders-container');
    container.innerHTML = ''; // clear

    const config = system.configs[system.type];
    
    // Loop through parameters
    for (const [key, val] of Object.entries(system.params)) {
      const range = config.ranges[key];
      const step = range[2] || 0.1;

      const group = document.createElement('div');
      group.className = 'control-group';

      const header = document.createElement('div');
      header.className = 'control-header';
      
      const label = document.createElement('label');
      label.setAttribute('for', `slider-param-${key}`);
      label.textContent = `${key.toUpperCase()}`;
      
      const valueSpan = document.createElement('span');
      valueSpan.className = 'control-val';
      valueSpan.id = `val-param-${key}`;
      valueSpan.textContent = val.toFixed(step >= 0.1 ? 1 : 2);

      header.appendChild(label);
      header.appendChild(valueSpan);

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.id = `slider-param-${key}`;
      slider.min = range[0];
      slider.max = range[1];
      slider.value = val;
      slider.step = step;
      slider.setAttribute('aria-valuemin', range[0]);
      slider.setAttribute('aria-valuemax', range[1]);
      slider.setAttribute('aria-valuenow', val);

      slider.addEventListener('input', (e) => {
        const newVal = parseFloat(e.target.value);
        system.params[key] = newVal;
        valueSpan.textContent = newVal.toFixed(step >= 0.1 ? 1 : 2);
      });

      group.appendChild(header);
      group.appendChild(slider);
      container.appendChild(group);
    }
    
    // Update Math formula display
    const formulaDisplay = document.getElementById('equation-formula');
    formulaDisplay.innerHTML = `<h3>${config.name}</h3>`;
    config.formula.forEach(mathStr => {
      const p = document.createElement('p');
      p.className = 'math';
      p.textContent = mathStr;
      formulaDisplay.appendChild(p);
    });
  }

  // Initial build
  buildParameterSliders();

  // --- 3. UI Interactions Event Listeners ---
  const eqnButtons = document.querySelectorAll('.eqn-btn');
  const headerAttractorName = document.getElementById('header-attractor-name');
  
  eqnButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      eqnButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const type = btn.dataset.eqn;
      system.changeAttractor(type);
      
      // Update UI
      headerAttractorName.textContent = system.configs[type].name.split(' ')[0];
      buildParameterSliders();
    });
  });

  // Reset Constants button
  document.getElementById('btn-reset-params').addEventListener('click', () => {
    system.params = { ...system.configs[system.type].defaults };
    buildParameterSliders();
  });

  // Toggle Audio button
  const btnToggleAudio = document.getElementById('btn-toggle-audio');
  const synthStatusBadge = document.getElementById('synth-status-badge');
  btnToggleAudio.addEventListener('click', () => {
    const isEnabled = synth.toggle();
    btnToggleAudio.classList.toggle('active', isEnabled);
    
    if (isEnabled) {
      btnToggleAudio.textContent = "⏸ Disable Audio Probe";
      synthStatusBadge.textContent = "AUDIO ACTIVE";
      synthStatusBadge.style.color = "#a855f7";
      synthStatusBadge.style.borderColor = "#a855f7";
    } else {
      btnToggleAudio.textContent = "🔊 Enable Audio Probe";
      synthStatusBadge.textContent = "AUDIO STANDBY";
      synthStatusBadge.style.color = "";
      synthStatusBadge.style.borderColor = "";
      document.getElementById('header-synth-pitch').textContent = "0 Hz";
    }
  });

  // Master Volume slider
  const sliderVolume = document.getElementById('slider-volume');
  const valVolume = document.getElementById('val-volume');
  sliderVolume.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    synth.setVolume(val);
    valVolume.textContent = `${val}%`;
  });

  // Echo Delay Slider
  const sliderEcho = document.getElementById('slider-echo');
  const valEcho = document.getElementById('val-echo');
  sliderEcho.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    synth.setEchoDelay(val);
    valEcho.textContent = `${(val / 100 * 0.8).toFixed(2)}s`;
  });

  // Filter Resonance Q Slider
  const sliderReso = document.getElementById('slider-resonance');
  const valReso = document.getElementById('val-resonance');
  sliderReso.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    synth.setFilterQ(val);
    valReso.textContent = val.toFixed(1);
  });

  // Waveform selectors
  const waveButtons = document.querySelectorAll('.wave-btn');
  waveButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      waveButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      synth.setWaveform(btn.dataset.wave);
    });
  });

  // --- 4. 3D Drag Rotations ---
  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    startMouseX = e.clientX;
    startMouseY = e.clientY;
    startYaw = yaw;
    startPitch = pitch;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startMouseX;
    const dy = e.clientY - startMouseY;
    
    // Scale drag distance to angles rotation
    yaw = startYaw + dx * 0.007;
    pitch = Math.max(-Math.PI/2 + 0.05, Math.min(Math.PI/2 - 0.05, startPitch - dy * 0.007));
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Scroll zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      cameraZoom = Math.min(45.0, cameraZoom + 0.7);
    } else {
      cameraZoom = Math.max(1.5, cameraZoom - 0.7);
    }
  }, { passive: false });


  // --- 5. Main Canvas Attractor Render Loop ---
  function frame() {
    // 1. Math physics update
    // Update multiple loops for high precision trail density
    for (let steps = 0; steps < 3; steps++) {
      system.update();
    }

    // 2. Clear canvas with cosmic gradient
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    
    // Clear screen fully to preserve performance without heavy trail leftovers
    ctx.fillStyle = 'rgba(2, 3, 6, 0.25)';
    ctx.fillRect(0, 0, w, h);

    // 3. Audio update hook
    const metrics = system.getAverageMetrics();
    const extents = system.getExtents();
    
    synth.updateSynthParameters(metrics, extents);
    
    if (synth.isEnabled) {
      document.getElementById('header-synth-pitch').textContent = `${Math.round(synth.currentFrequency)} Hz`;
    }

    // 4. Project & Sort particles by depth (painter's algorithm)
    // Helps render correct visual overlap in 3D
    const projectedParticles = system.particles.map(p => {
      const proj = project(p);
      return { p, proj };
    });
    
    // Sort descending by depth (Z2 coordinate)
    projectedParticles.sort((a, b) => b.proj.depth - a.proj.depth);

    // 5. Draw Particles and Trails (Ribbons)
    for (const item of projectedParticles) {
      const p = item.p;
      const proj = item.proj;

      // Skip offscreen points
      if (proj.x < 0 || proj.x > w || proj.y < 0 || proj.y > h) continue;

      // Draw Ribbon trail line connecting history points
      if (p.history.length > 2) {
        ctx.beginPath();
        for (let i = 0; i < p.history.length; i++) {
          const sPos = project(p.history[i]);
          if (i === 0) {
            ctx.moveTo(sPos.x, sPos.y);
          } else {
            ctx.lineTo(sPos.x, sPos.y);
          }
        }
        
        // Color shifts based on speed (velocity magnitude)
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
        // Lorenz has massive speeds compared to Aizawa. Scale speed accordingly.
        const speedFactor = system.type === 'lorenz' ? 85.0 : 4.5;
        const speedRatio = Math.min(1.0, speed / speedFactor);
        
        // HSL Interpolation:
        // Slow speed (0) -> Hue = 250 (Deep Blue/Indigo)
        // High speed (1) -> Hue = 320 (Neon Pink/Magenta)
        const hue = 240 + speedRatio * 85;
        const opacity = Math.max(0.12, 0.45 * (1 - speedRatio)) * (5 / (5 + proj.depth * 0.05)); // soften far points
        
        ctx.strokeStyle = `hsla(${hue}, 85%, 60%, ${opacity})`;
        ctx.lineWidth = 1.0;
        ctx.stroke();
      }

      // Draw particle core sphere
      ctx.beginPath();
      // Farther points are smaller
      const radius = Math.max(0.5, 1.6 * (10 / (10 + proj.depth * 0.08)));
      ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    requestAnimationFrame(frame);
  }

  // Start Loop
  requestAnimationFrame(frame);
});
