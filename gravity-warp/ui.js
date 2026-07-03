/**
 * Gravity Warp - UI Event Listeners and Spacetime Grid Renderer
 */

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gravity-canvas');
  const ctx = canvas.getContext('2d');

  // Instantiate physical world
  const WORLD_WIDTH = 1000;
  const WORLD_HEIGHT = 900;
  const world = new GravityWorld(WORLD_WIDTH, WORLD_HEIGHT);
  world.loadLevel('sandbox');

  // Tool State
  let activeTool = 'aim'; // 'aim', 'planet', 'star', 'bh'
  let selectedBody = null;

  // Aiming Probe State
  let isAiming = false;
  let aimStartWorldPos = null;
  let aimCurrentWorldPos = null;

  // Spawning Body Drag Vector State
  let isSpawningBody = false;
  let spawnStartWorldPos = null;
  let spawnCurrentWorldPos = null;
  let spawnType = 'planet'; // 'planet', 'star', 'bh'

  // Fit Canvas sizes
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // --- 1. Coordinate conversion ---
  // Camera translation and zoom
  let zoom = 1.0;
  let panX = 0;
  let panY = 0;

  function toScreen(worldPos) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    return {
      x: (worldPos.x - WORLD_WIDTH / 2 + panX) * zoom + w / 2,
      y: (worldPos.y - WORLD_HEIGHT / 2 + panY) * zoom + h / 2
    };
  }

  function toWorld(screenX, screenY) {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    return new Vector2(
      (screenX - w / 2) / zoom + WORLD_WIDTH / 2 - panX,
      (screenY - h / 2) / zoom + WORLD_HEIGHT / 2 - panY
    );
  }

  // --- 2. Mission Level Updates ---
  const missionButtons = document.querySelectorAll('.mission-btn');
  const missionInfoTitle = document.querySelector('#mission-info h3');
  const missionInfoDesc = document.querySelector('#mission-info p');
  const simModeBadge = document.getElementById('sim-mode-badge');

  missionButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      missionButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const levelId = btn.dataset.level;
      world.loadLevel(levelId);
      
      // Update UI panels
      const levelInfo = LevelManager.levels[levelId];
      missionInfoTitle.textContent = levelInfo.name;
      missionInfoDesc.textContent = levelInfo.desc;
      simModeBadge.textContent = levelInfo.badge;
      
      selectedBody = null;
      document.getElementById('inspector-content').classList.add('hidden');
      document.getElementById('inspector-placeholder').classList.remove('hidden');
      
      // Reset launch count
      world.totalLaunches = 0;
      world.cargoDelivered = 0;
    });
  });

  // Slider adjustments
  const sliderG = document.getElementById('slider-g');
  const valG = document.getElementById('val-g');
  sliderG.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    world.gConstant = val;
    valG.textContent = val.toFixed(1);
  });

  const sliderWarp = document.getElementById('slider-mesh-warp');
  const valWarp = document.getElementById('val-mesh-warp');
  sliderWarp.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    world.warpFactor = val;
    valWarp.textContent = `${val.toFixed(1)}x`;
  });

  const sliderPrediction = document.getElementById('slider-prediction');
  const valPrediction = document.getElementById('val-prediction');
  sliderPrediction.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    world.predictionSteps = val;
    valPrediction.textContent = val;
  });

  // Spawner Select Tool grid
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = btn.dataset.tool;
    });
  });

  // Clear Probes Button
  document.getElementById('btn-clear-probes').addEventListener('click', () => {
    world.probes = [];
  });

  // Clear Board Button
  document.getElementById('btn-clear-all').addEventListener('click', () => {
    world.loadLevel(world.currentLevelId);
    selectedBody = null;
    document.getElementById('inspector-content').classList.add('hidden');
    document.getElementById('inspector-placeholder').classList.remove('hidden');
  });

  // Inspector Adjustments
  const sliderMass = document.getElementById('slider-planet-mass');
  const valMass = document.getElementById('val-planet-mass');
  sliderMass.addEventListener('input', (e) => {
    if (selectedBody) {
      const mass = parseInt(e.target.value);
      selectedBody.mass = mass;
      
      // Scale radius slightly with mass cubed root
      selectedBody.radius = selectedBody.type === 'blackhole' ? 22 : Math.max(10, Math.pow(mass, 1/3) * 3.8);
      valMass.textContent = mass;
    }
  });

  const btnStatic = document.getElementById('btn-planet-static');
  btnStatic.addEventListener('click', () => {
    if (selectedBody) {
      selectedBody.isStatic = !selectedBody.isStatic;
      btnStatic.textContent = selectedBody.isStatic ? "Unlock Body" : "Anchor Body";
      btnStatic.classList.toggle('btn-primary', selectedBody.isStatic);
    }
  });

  const btnDelete = document.getElementById('btn-planet-delete');
  btnDelete.addEventListener('click', () => {
    if (selectedBody) {
      const idx = world.bodies.indexOf(selectedBody);
      if (idx !== -1) {
        world.bodies.splice(idx, 1);
        selectedBody = null;
        document.getElementById('inspector-content').classList.add('hidden');
        document.getElementById('inspector-placeholder').classList.remove('hidden');
      }
    }
  });

  // --- 3. Mouse Handlers on Spacetime Board ---
  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    
    const worldPos = toWorld(mx, my);

    // Aim tool (Launch Probe)
    if (activeTool === 'aim') {
      // Check if clicking inside launchpad boundary to aim probe
      if (world.launchpad) {
        const dx = world.launchpad.pos.x - worldPos.x;
        const dy = world.launchpad.pos.y - worldPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < world.launchpad.radius + 15) {
          isAiming = true;
          aimStartWorldPos = world.launchpad.pos;
          aimCurrentWorldPos = worldPos;
          return;
        }
      }

      // Check click on celestial body to inspect
      let clicked = null;
      let minD = Infinity;
      for (const b of world.bodies) {
        const d = worldPos.distSq(b.pos);
        if (d < (b.radius + 15) * (b.radius + 15) && d < minD) {
          minD = d;
          clicked = b;
        }
      }

      if (clicked) {
        selectedBody = clicked;
        showInspector(clicked);
      }
    } 
    // Spawning celestial body (Click and drag to set initial orbital speed)
    else if (activeTool === 'planet' || activeTool === 'star' || activeTool === 'bh') {
      isSpawningBody = true;
      spawnStartWorldPos = worldPos;
      spawnCurrentWorldPos = worldPos;
      spawnType = activeTool;
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const worldPos = toWorld(mx, my);

    if (isAiming) {
      aimCurrentWorldPos = worldPos;
    }

    if (isSpawningBody) {
      spawnCurrentWorldPos = worldPos;
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (isAiming && aimStartWorldPos && aimCurrentWorldPos) {
      // Aim Vector is: Start (Launchpad) -> End (Current mouse position)
      // Velocity vector points in launch direction, scaled by distance
      const aimVec = aimStartWorldPos.sub(aimCurrentWorldPos);
      const launchSpeedScale = 0.08; // scale aim drag to launch velocity
      const vx = aimVec.x * launchSpeedScale;
      const vy = aimVec.y * launchSpeedScale;
      
      world.launchProbe(vx, vy);
      isAiming = false;
      aimStartWorldPos = null;
      aimCurrentWorldPos = null;
    }

    if (isSpawningBody && spawnStartWorldPos && spawnCurrentWorldPos) {
      const dragVec = spawnCurrentWorldPos.sub(spawnStartWorldPos);
      // Speed scaling
      const vx = dragVec.x * 0.03;
      const vy = dragVec.y * 0.03;

      let mass = 200;
      let color = '#3b82f6';
      let name = 'New Planet';
      let isStatic = false;

      if (spawnType === 'planet') {
        mass = 150 + Math.random() * 200;
        color = `hsl(${Math.random() * 360}, 75%, 60%)`;
        name = 'Minor Planet';
      } else if (spawnType === 'star') {
        mass = 800 + Math.random() * 400;
        color = '#eab308';
        name = 'Bright Star';
      } else if (spawnType === 'bh') {
        mass = 2000;
        color = '#020306';
        name = 'Sagittarius A*';
        isStatic = true;
      }

      const radius = spawnType === 'bh' ? 22 : Math.max(10, Math.pow(mass, 1/3) * 3.8);

      const newBody = new CelestialBody(
        spawnStartWorldPos.x,
        spawnStartWorldPos.y,
        vx,
        vy,
        mass,
        radius,
        color,
        name,
        isStatic,
        spawnType === 'bh' ? 'blackhole' : (spawnType === 'star' ? 'star' : 'planet')
      );

      world.bodies.push(newBody);
      
      isSpawningBody = false;
      spawnStartWorldPos = null;
      spawnCurrentWorldPos = null;

      // Select newly spawned body
      selectedBody = newBody;
      showInspector(newBody);
    }
  });

  function showInspector(body) {
    document.getElementById('inspector-placeholder').classList.add('hidden');
    document.getElementById('inspector-content').classList.remove('hidden');

    document.getElementById('inspect-name').textContent = body.name;
    document.getElementById('inspect-type').textContent = `Type: ${body.type.toUpperCase()}`;
    document.getElementById('inspect-color').style.backgroundColor = body.color;
    
    sliderMass.value = body.mass;
    valMass.textContent = body.mass;

    btnStatic.textContent = body.isStatic ? "Unlock Body" : "Anchor Body";
    btnStatic.classList.toggle('btn-primary', body.isStatic);
  }

  // --- 4. Spacetime Grid Mesh Drawer ---
  function drawSpacetimeMesh(warpedNodes) {
    const spacing = world.mesh.spacing;
    
    // Grid sizing
    const cols = Math.floor(WORLD_WIDTH / spacing) + 1;
    const rows = Math.floor(WORLD_HEIGHT / spacing) + 1;

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.15)';
    ctx.lineWidth = 0.85;

    // Draw horizontal grid lines
    for (let r = 0; r < rows; r++) {
      ctx.beginPath();
      for (let c = 0; c < cols; c++) {
        const idx = c * rows + r;
        const screenPos = toScreen(warpedNodes[idx]);
        if (c === 0) {
          ctx.moveTo(screenPos.x, screenPos.y);
        } else {
          ctx.lineTo(screenPos.x, screenPos.y);
        }
      }
      ctx.stroke();
    }

    // Draw vertical grid lines
    for (let c = 0; c < cols; c++) {
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        const idx = c * rows + r;
        const screenPos = toScreen(warpedNodes[idx]);
        if (r === 0) {
          ctx.moveTo(screenPos.x, screenPos.y);
        } else {
          ctx.lineTo(screenPos.x, screenPos.y);
        }
      }
      ctx.stroke();
    }
  }

  // --- 5. Custom render visual effects ---
  function drawLaunchpad() {
    if (!world.launchpad) return;
    const sPos = toScreen(world.launchpad.pos);
    
    // Draw circular landing zone
    ctx.beginPath();
    ctx.arc(sPos.x, sPos.y, world.launchpad.radius * zoom, 0, Math.PI * 2);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2 * zoom;
    ctx.setLineDash([3 * zoom, 3 * zoom]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw launch tower icon
    ctx.fillStyle = '#22c55e';
    ctx.font = `${11 * zoom}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("🚀", sPos.x, sPos.y);
  }

  function drawColony() {
    if (!world.colony) return;
    const sPos = toScreen(world.colony.pos);

    // Glowing target ring
    ctx.beginPath();
    ctx.arc(sPos.x, sPos.y, world.colony.radius * zoom + 5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.lineWidth = 1.5 * zoom;
    ctx.stroke();

    // Solid inner station dome
    ctx.beginPath();
    ctx.arc(sPos.x, sPos.y, world.colony.radius * zoom, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
    ctx.fill();
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 2.5 * zoom;
    ctx.stroke();

    // Crosshairs
    ctx.beginPath();
    ctx.arc(sPos.x, sPos.y, 2 * zoom, 0, Math.PI * 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fill();
  }

  function drawCelestialBodies() {
    for (const b of world.bodies) {
      const sPos = toScreen(b.pos);
      const rad = b.radius * zoom;

      // 1. Draw Accretion Disk / Corona Glow first (for stars & black holes)
      if (b.type === 'blackhole') {
        // Accretion disk rings
        const diskGrad = ctx.createRadialGradient(sPos.x, sPos.y, rad * 0.9, sPos.x, sPos.y, rad * 2.8);
        diskGrad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        diskGrad.addColorStop(0.12, 'rgba(239, 68, 68, 0.85)'); // Red horizon
        diskGrad.addColorStop(0.35, 'rgba(249, 115, 22, 0.7)'); // Orange ring
        diskGrad.addColorStop(0.7, 'rgba(34, 211, 238, 0.35)'); // Cyan outer glow
        diskGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        
        ctx.beginPath();
        ctx.arc(sPos.x, sPos.y, rad * 3, 0, Math.PI * 2);
        ctx.fillStyle = diskGrad;
        ctx.fill();
      } 
      else if (b.type === 'star') {
        // Corona fire glow
        const starGrad = ctx.createRadialGradient(sPos.x, sPos.y, rad * 0.7, sPos.x, sPos.y, rad * 2.5);
        starGrad.addColorStop(0, '#ffffff');
        starGrad.addColorStop(0.2, '#fef08a'); // amber
        starGrad.addColorStop(0.5, '#f97316'); // orange fire
        starGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        
        ctx.beginPath();
        ctx.arc(sPos.x, sPos.y, rad * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = starGrad;
        ctx.fill();
      }

      // 2. Draw Solid Body Sphere
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, rad, 0, Math.PI * 2);
      ctx.fillStyle = b.color;
      ctx.fill();

      // Atmospheric shading/rim lighting (for planets)
      if (b.type === 'planet') {
        const rimGrad = ctx.createRadialGradient(sPos.x - rad*0.2, sPos.y - rad*0.2, rad * 0.1, sPos.x, sPos.y, rad);
        rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
        rimGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.6)');
        rimGrad.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
        
        ctx.beginPath();
        ctx.arc(sPos.x, sPos.y, rad, 0, Math.PI * 2);
        ctx.fillStyle = rimGrad;
        ctx.fill();
      }

      // 3. Highlight boundary if selected
      if (selectedBody === b) {
        ctx.beginPath();
        ctx.arc(sPos.x, sPos.y, rad + 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.8;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  function drawProbes() {
    for (const p of world.probes) {
      if (p.isDead) continue;
      
      // Draw glowing Trail line
      if (p.trail.length > 1) {
        ctx.beginPath();
        for (let i = 0; i < p.trail.length; i++) {
          const sPos = toScreen(p.trail[i]);
          if (i === 0) {
            ctx.moveTo(sPos.x, sPos.y);
          } else {
            ctx.lineTo(sPos.x, sPos.y);
          }
        }
        ctx.strokeStyle = 'rgba(192, 132, 252, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Draw probe dot
      const sPos = toScreen(p.pos);
      ctx.beginPath();
      ctx.arc(sPos.x, sPos.y, p.radius * zoom, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5;
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }
  }

  // Draw Dotted Trajectory Predictor Line
  function drawTrajectoryPredictor() {
    if (!isAiming || !aimStartWorldPos || !aimCurrentWorldPos) return;

    const aimVec = aimStartWorldPos.sub(aimCurrentWorldPos);
    const vx = aimVec.x * 0.08;
    const vy = aimVec.y * 0.08;

    const path = world.predictTrajectory(vx, vy);

    if (path.length > 1) {
      ctx.beginPath();
      for (let i = 0; i < path.length; i++) {
        const sPos = toScreen(path[i]);
        if (i === 0) {
          ctx.moveTo(sPos.x, sPos.y);
        } else {
          ctx.lineTo(sPos.x, sPos.y);
        }
      }
      ctx.strokeStyle = 'rgba(192, 132, 252, 0.45)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw drag slingshot line
    const sStart = toScreen(aimStartWorldPos);
    const sCurrent = toScreen(aimCurrentWorldPos);
    
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sStart.x, sStart.y);
    ctx.lineTo(sCurrent.x, sCurrent.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sCurrent.x, sCurrent.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#22d3ee';
    ctx.fill();
  }

  // Draw Planet Spawn Launch Line
  function drawSpawnerVector() {
    if (!isSpawningBody || !spawnStartWorldPos || !spawnCurrentWorldPos) return;

    const sStart = toScreen(spawnStartWorldPos);
    const sCurrent = toScreen(spawnCurrentWorldPos);

    ctx.strokeStyle = 'rgba(234, 179, 8, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sStart.x, sStart.y);
    ctx.lineTo(sCurrent.x, sCurrent.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sCurrent.x, sCurrent.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#eab308';
    ctx.fill();
  }

  // --- 6. Main render frame loops ---
  function updateStatsPanel() {
    document.getElementById('stat-launches').textContent = world.totalLaunches;
    document.getElementById('stat-active-probes').textContent = world.probes.filter(p => !p.isDead).length;
    
    if (world.currentLevelId === 'sandbox') {
      document.getElementById('stat-delivered').textContent = world.cargoDelivered;
    } else {
      document.getElementById('stat-delivered').textContent = `${world.cargoDelivered} / 1`;
    }
  }

  function frame() {
    // 1. Update Physics (runs 60 updates per second)
    world.update(1.0);

    // 2. Clear canvas with cosmic deep black
    ctx.fillStyle = '#010204';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 3. Compute spacetime grid deformation
    const warpedNodes = world.mesh.computeWarp(world.bodies, world.gConstant, world.warpFactor);

    // 4. Render Layers
    drawSpacetimeMesh(warpedNodes);
    drawLaunchpad();
    drawColony();
    drawCelestialBodies();
    drawProbes();
    
    // Render draft vectors
    drawTrajectoryPredictor();
    drawSpawnerVector();

    // Update DOM panels
    updateStatsPanel();

    requestAnimationFrame(frame);
  }

  // Start loop
  requestAnimationFrame(frame);
});
