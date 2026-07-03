/**
 * A-Life Evolution Simulator - UI, Controls, and Canvas Rendering Logic
 */

window.addEventListener('DOMContentLoaded', () => {
  // --- 1. Canvas and Context Setup ---
  const simCanvas = document.getElementById('simulation-canvas');
  const simCtx = simCanvas.getContext('2d');
  
  const nnCanvas = document.getElementById('nn-canvas');
  const nnCtx = nnCanvas.getContext('2d');
  
  const chartCanvas = document.getElementById('species-chart');
  const chartCtx = chartCanvas.getContext('2d');

  // Set up world dimensions
  const WORLD_WIDTH = 2200;
  const WORLD_HEIGHT = 1600;
  
  // Initialize Simulation World
  const world = new World(WORLD_WIDTH, WORLD_HEIGHT);
  world.init(45); // Start with 45 creatures

  // Viewport / Camera variables for panning and zooming
  let zoom = 0.55;
  let panX = (simCanvas.clientWidth / 2) - (WORLD_WIDTH * zoom / 2);
  let panY = (simCanvas.clientHeight / 2) - (WORLD_HEIGHT * zoom / 2);
  
  let isPanning = false;
  let startMouseX = 0;
  let startMouseY = 0;
  let startPanX = 0;
  let startPanY = 0;

  // Selected state
  let selectedCreature = null;
  let isFollowingSelected = false;
  
  // Active Tool selection
  let activeTool = 'inspect'; // 'inspect', 'wall', 'food', 'meat', 'creature'
  
  // Wall Drawing drag state
  let isDrawingWall = false;
  let wallStartPos = null;
  let currentMouseWorldPos = null;

  // Simulation Running State & Playback
  let isPlaying = true;
  let simSpeed = 1; // 1x, 2x, etc.
  
  // Statistics variables
  let lastFPSUpdateTime = 0;
  let frameCount = 0;
  let currentFPS = 0;
  
  // Fit canvas to container size
  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    
    // Fit Simulation Canvas
    const rect = simCanvas.parentElement.getBoundingClientRect();
    simCanvas.width = rect.width * dpr;
    simCanvas.height = rect.height * dpr;
    simCtx.scale(dpr, dpr);
    
    // Fit Species Chart
    const chartRect = chartCanvas.parentElement.getBoundingClientRect();
    chartCanvas.width = chartRect.width * dpr;
    chartCanvas.height = chartRect.height * dpr;
    chartCtx.scale(dpr, dpr);
  }
  
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- 2. Input Coordinate Conversion Helpers ---
  function getEventWorldPos(e) {
    const rect = simCanvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    // Map screen coordinates back through viewport transformations
    const worldX = (clientX - simCanvas.clientWidth / 2) / zoom + WORLD_WIDTH / 2 - panX;
    const worldY = (clientY - simCanvas.clientHeight / 2) / zoom + WORLD_HEIGHT / 2 - panY;
    
    return { x: worldX, y: worldY };
  }

  // --- 3. Setup UI Interaction Event Listeners ---
  
  // Control Panel Speed Slider
  const sliderSpeed = document.getElementById('slider-speed');
  const valSpeed = document.getElementById('val-speed');
  sliderSpeed.addEventListener('input', (e) => {
    simSpeed = parseInt(e.target.value);
    valSpeed.textContent = `${simSpeed}x`;
  });

  // Target Population Slider
  const sliderTargetPop = document.getElementById('slider-target-pop');
  const valTargetPop = document.getElementById('val-target-pop');
  sliderTargetPop.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    world.targetPopulation = val;
    valTargetPop.textContent = val;
  });

  // Food Rate Slider
  const sliderPlantRate = document.getElementById('slider-plant-rate');
  const valPlantRate = document.getElementById('val-plant-rate');
  sliderPlantRate.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    world.plantSpawnRate = val;
    valPlantRate.textContent = val.toFixed(1);
  });

  // Mutation Rate Slider
  const sliderMutationRate = document.getElementById('slider-mutation-rate');
  const valMutationRate = document.getElementById('val-mutation-rate');
  sliderMutationRate.addEventListener('input', (e) => {
    const pct = parseInt(e.target.value);
    world.mutationRate = pct / 100;
    valMutationRate.textContent = `${pct}%`;
  });

  // Play / Pause Toggle Button
  const btnTogglePlay = document.getElementById('btn-toggle-play');
  const textTogglePlay = document.getElementById('text-toggle-play');
  const canvasOverlayMessage = document.getElementById('canvas-overlay-message');
  
  function setPlayState(state) {
    isPlaying = state;
    if (isPlaying) {
      textTogglePlay.textContent = "Pause";
      btnTogglePlay.querySelector('.btn-icon').textContent = "⏸";
      canvasOverlayMessage.classList.add('hidden');
    } else {
      textTogglePlay.textContent = "Resume";
      btnTogglePlay.querySelector('.btn-icon').textContent = "▶";
      canvasOverlayMessage.classList.remove('hidden');
    }
  }
  
  btnTogglePlay.addEventListener('click', () => {
    setPlayState(!isPlaying);
  });

  // Reset Simulation Button
  const btnReset = document.getElementById('btn-reset');
  btnReset.addEventListener('click', () => {
    if (confirm("Reset the entire sandbox? Current evolutions will be lost.")) {
      world.init(45);
      selectedCreature = null;
      isFollowingSelected = false;
      document.getElementById('inspector-content').classList.add('hidden');
      document.getElementById('inspector-placeholder').classList.remove('hidden');
      setPlayState(true);
    }
  });

  // Plague Trigger Button
  const btnPlague = document.getElementById('btn-plague');
  btnPlague.addEventListener('click', () => {
    world.triggerPlague();
    // Temporary flash effect on status badge
    const badge = document.getElementById('sim-status-badge');
    badge.textContent = "PATHOGEN DETECTED";
    badge.style.color = "#ef4444";
    badge.style.borderColor = "#ef4444";
    setTimeout(() => {
      badge.textContent = "SANDBOX ACTIVE";
      badge.style.color = "";
      badge.style.borderColor = "";
    }, 3000);
  });

  // Extinction Event Button
  const btnExtinction = document.getElementById('btn-extinction');
  btnExtinction.addEventListener('click', () => {
    if (confirm("Trigger an extinction event? 90% of the population will die.")) {
      world.triggerExtinctionEvent(selectedCreature ? selectedCreature.id : null);
    }
  });

  // Sandbox Tools Select Grid
  const toolButtons = document.querySelectorAll('.tool-btn[data-tool]');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTool = btn.dataset.tool;
      isDrawingWall = false;
    });
  });

  // Clear Walls Button
  const btnClearWalls = document.getElementById('tool-clear-walls');
  btnClearWalls.addEventListener('click', () => {
    world.clearWalls();
  });

  // Floating Zoom Controls
  document.getElementById('float-btn-zoom-in').addEventListener('click', () => zoom = Math.min(3.0, zoom + 0.15));
  document.getElementById('float-btn-zoom-out').addEventListener('click', () => zoom = Math.max(0.15, zoom - 0.15));
  document.getElementById('float-btn-zoom-reset').addEventListener('click', () => {
    zoom = 0.55;
    panX = (simCanvas.clientWidth / 2) - (WORLD_WIDTH * zoom / 2);
    panY = (simCanvas.clientHeight / 2) - (WORLD_HEIGHT * zoom / 2);
    isFollowingSelected = false;
  });

  // --- 4. Inspector Action Listeners ---
  const btnClone = document.getElementById('btn-inspect-clone');
  btnClone.addEventListener('click', () => {
    if (selectedCreature && world.organisms.length < 220) {
      const clonedGenes = selectedCreature.genes.clone();
      const clonedBrain = selectedCreature.brain.clone();
      // Spawn clone slightly offset from selected
      const clone = new Organism(
        selectedCreature.x + (Math.random() * 20 - 10),
        selectedCreature.y + (Math.random() * 20 - 10),
        clonedGenes,
        clonedBrain,
        selectedCreature.generation
      );
      world.speciesManager.classify(clone);
      world.organisms.push(clone);
      world.totalBirths++;
    }
  });

  const btnKill = document.getElementById('btn-inspect-kill');
  btnKill.addEventListener('click', () => {
    if (selectedCreature) {
      // Force energy to 0, it dies in next update cycle
      selectedCreature.energy = 0;
      selectedCreature = null;
      isFollowingSelected = false;
      document.getElementById('inspector-content').classList.add('hidden');
      document.getElementById('inspector-placeholder').classList.remove('hidden');
    }
  });

  const btnFollow = document.getElementById('btn-inspect-follow');
  btnFollow.addEventListener('click', () => {
    if (selectedCreature) {
      isFollowingSelected = !isFollowingSelected;
      btnFollow.classList.toggle('btn-primary', isFollowingSelected);
    }
  });

  // --- 5. Mouse Drag Panning & Tool Clicks on Simulation Canvas ---
  simCanvas.addEventListener('mousedown', (e) => {
    const pos = getEventWorldPos(e);
    
    // Left click handles tools, right click (or ctrl-click) handles panning
    const isRightClick = e.button === 2 || e.ctrlKey;

    if (isRightClick || activeTool === 'pan') {
      isPanning = true;
      startMouseX = e.clientX;
      startMouseY = e.clientY;
      startPanX = panX;
      startPanY = panY;
      e.preventDefault();
      return;
    }

    // Tool logic based on active tool selection
    if (activeTool === 'inspect') {
      // Find clicked creature
      let clicked = null;
      let closestDist = Infinity;
      for (const org of world.organisms) {
        const dx = org.x - pos.x;
        const dy = org.y - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < org.radius + 15 && dist < closestDist) {
          closestDist = dist;
          clicked = org;
        }
      }
      
      if (clicked) {
        selectedCreature = clicked;
        isFollowingSelected = false;
        document.getElementById('btn-inspect-follow').classList.remove('btn-primary');
        document.getElementById('inspector-placeholder').classList.add('hidden');
        document.getElementById('inspector-content').classList.remove('hidden');
      }
    } 
    else if (activeTool === 'wall') {
      isDrawingWall = true;
      wallStartPos = pos;
      currentMouseWorldPos = pos;
    } 
    else if (activeTool === 'food') {
      world.spawnFood('plant', pos.x, pos.y);
    } 
    else if (activeTool === 'meat') {
      world.spawnFood('meat', pos.x, pos.y);
    } 
    else if (activeTool === 'creature') {
      const genes = new Genes();
      const org = new Organism(pos.x, pos.y, genes);
      world.speciesManager.classify(org);
      world.organisms.push(org);
      world.totalBirths++;
    }
  });

  simCanvas.addEventListener('mousemove', (e) => {
    const pos = getEventWorldPos(e);
    currentMouseWorldPos = pos;

    if (isPanning) {
      const dx = e.clientX - startMouseX;
      const dy = e.clientY - startMouseY;
      panX = startPanX + dx;
      panY = startPanY + dy;
      isFollowingSelected = false;
      document.getElementById('btn-inspect-follow').classList.remove('btn-primary');
    }
  });

  simCanvas.addEventListener('mouseup', (e) => {
    if (isPanning) {
      isPanning = false;
    }

    if (activeTool === 'wall' && isDrawingWall && wallStartPos) {
      const pos = getEventWorldPos(e);
      // Ensure line is of significant length (e.g. > 15px)
      const dx = pos.x - wallStartPos.x;
      const dy = pos.y - wallStartPos.y;
      if (dx * dx + dy * dy > 225) {
        world.addWall(wallStartPos.x, wallStartPos.y, pos.x, pos.y);
      }
      isDrawingWall = false;
      wallStartPos = null;
    }
  });

  // Disable context menu on canvas to allow smooth right-click panning
  simCanvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  // Wheel zoom handling
  simCanvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomIntensity = 0.08;
    const mouseWorldBefore = getEventWorldPos(e);
    
    // Adjust zoom
    if (e.deltaY < 0) {
      zoom = Math.min(3.0, zoom + zoomIntensity);
    } else {
      zoom = Math.max(0.15, zoom - zoomIntensity);
    }

    // Re-adjust panning coordinates to zoom centered on mouse cursor
    const mouseWorldAfter = getEventWorldPos(e);
    panX += (mouseWorldAfter.x - mouseWorldBefore.x);
    panY += (mouseWorldAfter.y - mouseWorldBefore.y);
  }, { passive: false });


  // --- 6. Stats & Inspector Live DOM Updates ---
  function updateDOMStats(fps) {
    // Header Stats
    document.getElementById('header-pop-count').textContent = world.organisms.length;
    
    let totalGen = 0;
    let maxGen = 0;
    let herbivores = 0;
    let carnivores = 0;

    for (const org of world.organisms) {
      totalGen += org.generation;
      if (org.generation > maxGen) maxGen = org.generation;
      
      // Classify for progress bar
      if (org.genes.diet < 0.4) herbivores++;
      else if (org.genes.diet > 0.6) carnivores++;
    }

    const avgGen = world.organisms.length > 0 ? (totalGen / world.organisms.length).toFixed(1) : 0;
    
    document.getElementById('header-avg-gen').textContent = avgGen;
    document.getElementById('header-max-gen').textContent = maxGen;

    // Ecological bars updates
    const pop = world.organisms.length || 1;
    const herbPercent = (herbivores / pop * 100).toFixed(0);
    const carnPercent = (carnivores / pop * 100).toFixed(0);
    
    document.getElementById('label-herbivore-count').textContent = `${herbivores} (${herbPercent}%)`;
    document.getElementById('bar-herbivore-percent').style.width = `${herbPercent}%`;

    document.getElementById('label-carnivore-count').textContent = `${carnivores} (${carnPercent}%)`;
    document.getElementById('bar-carnivore-percent').style.width = `${carnPercent}%`;

    // Sidebar Stats Grid
    document.getElementById('stat-births').textContent = world.totalBirths;
    document.getElementById('stat-deaths').textContent = world.totalDeaths;
    document.getElementById('stat-steps').textContent = world.stepCount;
    document.getElementById('stat-fps').textContent = fps;
  }

  function updateInspectorPanel() {
    if (!selectedCreature) return;

    // Check if the selected creature died
    if (selectedCreature.energy <= 0) {
      selectedCreature = null;
      isFollowingSelected = false;
      document.getElementById('inspector-content').classList.add('hidden');
      document.getElementById('inspector-placeholder').classList.remove('hidden');
      return;
    }

    // Creature Info
    const spec = world.speciesManager.speciesMap.get(selectedCreature.speciesId);
    const speciesName = spec ? spec.name : "Unknown Binomial";
    
    document.getElementById('inspect-name').textContent = `Individual #${selectedCreature.id}`;
    document.getElementById('inspect-species-label').textContent = `Species: ${speciesName}`;
    document.getElementById('inspect-color').style.backgroundColor = spec ? spec.color : "#ffffff";
    
    // Vitals Progress
    const energyPercent = Math.max(0, Math.min(100, (selectedCreature.energy / selectedCreature.maxEnergy) * 100));
    const agePercent = Math.max(0, Math.min(100, (selectedCreature.age / selectedCreature.maxAge) * 100));
    
    document.getElementById('inspect-energy-bar').style.width = `${energyPercent}%`;
    document.getElementById('inspect-energy-val').textContent = `${Math.floor(selectedCreature.energy)}/${Math.floor(selectedCreature.maxEnergy)}`;
    
    document.getElementById('inspect-age-bar').style.width = `${agePercent}%`;
    document.getElementById('inspect-age-val').textContent = `${Math.floor(selectedCreature.age)}/${Math.floor(selectedCreature.maxAge)}`;

    // Trait Matrix table
    let dietText = "Omnivore";
    if (selectedCreature.genes.diet < 0.35) dietText = "Herbivore 🟢";
    else if (selectedCreature.genes.diet > 0.65) dietText = "Carnivore 🔴";
    
    document.getElementById('inspect-trait-diet').textContent = `${dietText} (${(selectedCreature.genes.diet * 100).toFixed(0)}%)`;
    document.getElementById('inspect-trait-size').textContent = `${selectedCreature.radius.toFixed(1)} px`;
    document.getElementById('inspect-trait-speed').textContent = `${selectedCreature.maxSpeed.toFixed(1)} px/s`;
    document.getElementById('inspect-trait-sense').textContent = `${selectedCreature.sensoryRange.toFixed(0)} px`;
    document.getElementById('inspect-trait-gen').textContent = selectedCreature.generation;
    document.getElementById('inspect-trait-kids').textContent = selectedCreature.children;
  }

  // --- 7. Species Chips list rendering ---
  function updateSpeciesList() {
    const listContainer = document.getElementById('species-list-container');
    listContainer.innerHTML = '';

    const sortedActiveSpecies = [...world.speciesManager.speciesMap.values()]
      .filter(s => s.count > 0)
      .sort((a, b) => b.count - a.count);

    if (sortedActiveSpecies.length === 0) {
      listContainer.innerHTML = '<div class="no-species">No active species yet...</div>';
      return;
    }

    sortedActiveSpecies.forEach(s => {
      const chip = document.createElement('button');
      chip.className = 'species-chip';
      chip.setAttribute('aria-label', `Species ${s.name}, population count ${s.count}`);
      
      const dot = document.createElement('span');
      dot.className = 'species-dot';
      dot.style.backgroundColor = s.color;
      
      const name = document.createElement('span');
      name.className = 'species-name';
      name.textContent = s.name;
      
      const count = document.createElement('span');
      count.className = 'species-count';
      count.textContent = s.count;

      chip.appendChild(dot);
      chip.appendChild(name);
      chip.appendChild(count);
      
      chip.addEventListener('click', () => {
        // Find first creature of this species and inspect/select it
        const firstCreature = world.organisms.find(o => o.speciesId === s.id);
        if (firstCreature) {
          selectedCreature = firstCreature;
          isFollowingSelected = true;
          document.getElementById('btn-inspect-follow').classList.add('btn-primary');
          document.getElementById('inspector-placeholder').classList.add('hidden');
          document.getElementById('inspector-content').classList.remove('hidden');
        }
      });

      listContainer.appendChild(chip);
    });
  }

  // --- 8. Species History Line Graph Renderer ---
  function drawSpeciesHistory() {
    const w = chartCanvas.width / (window.devicePixelRatio || 1);
    const h = chartCanvas.height / (window.devicePixelRatio || 1);
    
    chartCtx.clearRect(0, 0, w, h);
    
    const history = world.speciesManager.historyBuffer;
    if (history.length < 2) return;

    // Draw background grid lines
    chartCtx.strokeStyle = 'rgba(255,255,255,0.03)';
    chartCtx.lineWidth = 1;
    for (let i = 1; i <= 3; i++) {
      const gy = h * (i / 4);
      chartCtx.beginPath();
      chartCtx.moveTo(0, gy);
      chartCtx.lineTo(w, gy);
      chartCtx.stroke();
    }

    // Determine max population height
    let maxVal = 0;
    history.forEach(tick => {
      let sum = 0;
      Object.values(tick.speciesCounts).forEach(c => sum += c);
      if (sum > maxVal) maxVal = sum;
    });
    maxVal = Math.max(50, maxVal * 1.15); // buffer boundary

    const stepWidth = w / 300; // max 300 steps mapped horizontally

    // Render active species paths
    const activeSpec = [...world.speciesManager.speciesMap.values()];

    activeSpec.forEach(spec => {
      // Find if species ever existed in history buffer
      let hasHistory = false;
      chartCtx.beginPath();
      
      let countBuffer = [];
      for (let i = 0; i < history.length; i++) {
        const val = history[i].speciesCounts[spec.id] || 0;
        countBuffer.push(val);
        if (val > 0) hasHistory = true;
      }

      if (!hasHistory) return; // skip extinct / unspawned species

      chartCtx.strokeStyle = spec.color;
      chartCtx.lineWidth = 2;
      
      // Set glowing stroke
      chartCtx.shadowColor = spec.color;
      chartCtx.shadowBlur = 4;

      const startIdx = 300 - countBuffer.length;
      
      for (let i = 0; i < countBuffer.length; i++) {
        const cx = (startIdx + i) * stepWidth;
        const cy = h - (countBuffer[i] / maxVal) * h;
        
        if (i === 0) {
          chartCtx.moveTo(cx, cy);
        } else {
          chartCtx.lineTo(cx, cy);
        }
      }
      chartCtx.stroke();

      // Reset shadows for optimization
      chartCtx.shadowBlur = 0;
      
      // Draw faint filled area beneath path
      chartCtx.fillStyle = spec.color.replace(')', ', 0.05)').replace('hsl', 'hsla');
      chartCtx.lineTo((startIdx + countBuffer.length - 1) * stepWidth, h);
      chartCtx.lineTo(startIdx * stepWidth, h);
      chartCtx.closePath();
      chartCtx.fill();
    });
  }

  // --- 9. Live Neural Network Visualizer ---
  function drawNeuralNetwork() {
    if (!selectedCreature) return;

    const w = nnCanvas.width;
    const h = nnCanvas.height;
    nnCtx.clearRect(0, 0, w, h);

    const brain = selectedCreature.brain;
    
    // Node Layer Configurations (Columns layout)
    const columns = [
      { x: 30, size: brain.inputSize, labels: ["BIAS", "ENRG", "PLNT", "P_AN", "MEAT", "M_AN", "CREA", "C_AN", "C_DI", "WALL", "W_AN"] },
      { x: 140, size: brain.hiddenSize, labels: null },
      { x: 250, size: brain.outputSize, labels: ["TURN", "FORC", "BITE"] }
    ];

    // Compute coordinates for all nodes in all columns
    const nodeCoords = columns.map(col => {
      const coords = [];
      const colHeight = h - 25;
      const step = col.size > 1 ? colHeight / (col.size - 1) : 0;
      const startY = 12;
      
      for (let i = 0; i < col.size; i++) {
        coords.push({
          x: col.x,
          y: startY + i * step
        });
      }
      return coords;
    });

    // 1. Draw Weights lines (connectors)
    nnCtx.lineWidth = 1.2;

    // Inputs -> Hidden Connections
    for (let i = 0; i < brain.inputSize; i++) {
      const fromNode = nodeCoords[0][i];
      const activeSignal = Math.abs(brain.inputs[i]) > 0.05;

      for (let hNode = 0; hNode < brain.hiddenSize; hNode++) {
        const toNode = nodeCoords[1][hNode];
        const weight = brain.weights1[hNode][i];
        
        // Skip tiny faint lines to optimize performance
        if (Math.abs(weight) < 0.12) continue;

        // Line color: Blue for positive, Red for negative
        if (weight > 0) {
          nnCtx.strokeStyle = `rgba(59, 130, 246, ${Math.abs(weight) * 0.45})`;
        } else {
          nnCtx.strokeStyle = `rgba(239, 68, 68, ${Math.abs(weight) * 0.45})`;
        }
        
        nnCtx.lineWidth = Math.abs(weight) * 2.2;
        
        nnCtx.beginPath();
        nnCtx.moveTo(fromNode.x, fromNode.y);
        nnCtx.lineTo(toNode.x, toNode.y);
        nnCtx.stroke();
      }
    }

    // Hidden -> Output Connections
    for (let hNode = 0; hNode < brain.hiddenSize; hNode++) {
      const fromNode = nodeCoords[1][hNode];
      
      for (let o = 0; o < brain.outputSize; o++) {
        const toNode = nodeCoords[2][o];
        const weight = brain.weights2[o][hNode];
        
        if (Math.abs(weight) < 0.12) continue;

        if (weight > 0) {
          nnCtx.strokeStyle = `rgba(59, 130, 246, ${Math.abs(weight) * 0.45})`;
        } else {
          nnCtx.strokeStyle = `rgba(239, 68, 68, ${Math.abs(weight) * 0.45})`;
        }
        
        nnCtx.lineWidth = Math.abs(weight) * 2.2;
        
        nnCtx.beginPath();
        nnCtx.moveTo(fromNode.x, fromNode.y);
        nnCtx.lineTo(toNode.x, toNode.y);
        nnCtx.stroke();
      }
    }

    // 2. Draw Nodes (circles & activation glows)
    // Helper to draw node circles
    const drawNodeCircle = (x, y, activation, label, isLeftLabel) => {
      // Glow size based on activation level
      const pulse = Math.abs(activation) * 5;
      
      nnCtx.shadowBlur = pulse;
      nnCtx.shadowColor = activation > 0 ? '#10b981' : '#ef4444';
      
      nnCtx.beginPath();
      nnCtx.arc(x, y, 5, 0, Math.PI * 2);
      
      // Node fill: green-blue gradients for active, dark-gray for neutral
      if (activation > 0.05) {
        nnCtx.fillStyle = `rgb(16, 185, 129)`;
      } else if (activation < -0.05) {
        nnCtx.fillStyle = `rgb(239, 68, 68)`;
      } else {
        nnCtx.fillStyle = '#4b5563';
      }
      nnCtx.fill();
      
      // Stroke
      nnCtx.shadowBlur = 0; // reset shadow
      nnCtx.strokeStyle = '#9ca3af';
      nnCtx.lineWidth = 1;
      nnCtx.stroke();

      // Text labels
      if (label) {
        nnCtx.fillStyle = '#9ca3af';
        nnCtx.font = '700 8px "Space Mono", monospace';
        nnCtx.textAlign = isLeftLabel ? 'right' : 'left';
        const tx = isLeftLabel ? x - 8 : x + 8;
        nnCtx.fillText(label, tx, y + 2.5);
      }
    };

    // Draw Input layer
    for (let i = 0; i < brain.inputSize; i++) {
      const pos = nodeCoords[0][i];
      const val = brain.inputs[i];
      drawNodeCircle(pos.x, pos.y, val, columns[0].labels[i], true);
    }

    // Draw Hidden layer
    for (let hNode = 0; hNode < brain.hiddenSize; hNode++) {
      const pos = nodeCoords[1][hNode];
      const val = brain.hiddenOutputs[hNode];
      drawNodeCircle(pos.x, pos.y, val, null, false);
    }

    // Draw Output layer
    for (let o = 0; o < brain.outputSize; o++) {
      const pos = nodeCoords[2][o];
      const val = brain.outputs[o];
      drawNodeCircle(pos.x, pos.y, val, columns[2].labels[o], false);
    }
  }

  // --- 10. Petri Dish Canvas Drawer ---
  function drawSimulation() {
    const w = simCanvas.width / (window.devicePixelRatio || 1);
    const h = simCanvas.height / (window.devicePixelRatio || 1);
    
    // 1. Semi-transparent clear creates gorgeous trails
    simCtx.fillStyle = 'rgba(3, 4, 8, 0.22)';
    simCtx.fillRect(0, 0, w, h);

    // Apply Camera viewport zoom & pan transformations
    simCtx.save();
    simCtx.translate(w / 2, h / 2);
    simCtx.scale(zoom, zoom);
    simCtx.translate(-w / 2 + panX, -h / 2 + panY);

    // 2. Draw Petri dish grids
    simCtx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    simCtx.lineWidth = 1;
    const gridSpacing = 80;
    
    // vertical gridlines
    for (let gx = 0; gx < WORLD_WIDTH; gx += gridSpacing) {
      simCtx.beginPath();
      simCtx.moveTo(gx, 0);
      simCtx.lineTo(gx, WORLD_HEIGHT);
      simCtx.stroke();
    }
    // horizontal gridlines
    for (let gy = 0; gy < WORLD_HEIGHT; gy += gridSpacing) {
      simCtx.beginPath();
      simCtx.moveTo(0, gy);
      simCtx.lineTo(WORLD_WIDTH, gy);
      simCtx.stroke();
    }

    // Draw outer boundary ring / outline
    simCtx.strokeStyle = 'rgba(59, 130, 246, 0.22)';
    simCtx.lineWidth = 4;
    simCtx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // 3. Draw Obstacle Walls
    simCtx.strokeStyle = 'rgba(255,255,255,0.7)';
    simCtx.shadowColor = 'rgba(255,255,255,0.3)';
    simCtx.shadowBlur = 6;
    simCtx.lineWidth = 6;
    simCtx.lineCap = 'round';
    
    for (const wall of world.walls) {
      simCtx.beginPath();
      simCtx.moveTo(wall.x1, wall.y1);
      simCtx.lineTo(wall.x2, wall.y2);
      simCtx.stroke();
    }
    simCtx.shadowBlur = 0; // reset shadow

    // 4. Draw Food Particles (Plants and Meat)
    for (const food of world.food) {
      simCtx.beginPath();
      simCtx.arc(food.x, food.y, food.radius, 0, Math.PI * 2);
      
      if (food.type === 'plant') {
        // Glowing plant green
        simCtx.fillStyle = '#10b981';
        simCtx.shadowColor = 'rgba(16, 185, 129, 0.4)';
        simCtx.shadowBlur = 5;
      } else {
        // Glowing meat red/pink
        simCtx.fillStyle = '#ef4444';
        simCtx.shadowColor = 'rgba(239, 68, 68, 0.5)';
        simCtx.shadowBlur = 6;
      }
      simCtx.fill();
    }
    simCtx.shadowBlur = 0; // reset shadow

    // 5. Draw Organisms (Creatures)
    for (const org of world.organisms) {
      const spec = world.speciesManager.speciesMap.get(org.speciesId);
      const baseColor = spec ? spec.color : '#ffffff';

      simCtx.save();
      simCtx.translate(org.x, org.y);
      simCtx.rotate(org.angle);

      // Handle spawn scale animation
      if (org.isSpawning) {
        const scale = 1.0 - (org.spawnAnimTimer / 25.0);
        simCtx.scale(scale, scale);
      }

      // Draw Combat biting ring / aura
      if (org.isBiting) {
        simCtx.beginPath();
        simCtx.arc(0, 0, org.radius + 6, 0, Math.PI * 2);
        simCtx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        simCtx.lineWidth = 3;
        simCtx.stroke();
        
        // Bite spike chompers
        simCtx.beginPath();
        simCtx.moveTo(org.radius, -3);
        simCtx.lineTo(org.radius + 4, 0);
        simCtx.lineTo(org.radius, 3);
        simCtx.fillStyle = '#ef4444';
        simCtx.fill();
      }

      // Draw creature body (Interpolated HSL Hue: 150 = green herbivore, 0 = red carnivore)
      const creatureHue = (1 - org.genes.diet) * 150;
      simCtx.beginPath();
      simCtx.arc(0, 0, org.radius, 0, Math.PI * 2);
      simCtx.fillStyle = `hsl(${creatureHue}, 85%, 48%)`;
      
      // Faint glow
      simCtx.shadowColor = `hsl(${creatureHue}, 85%, 48%)`;
      simCtx.shadowBlur = 5;
      simCtx.fill();
      simCtx.shadowBlur = 0;

      // Draw shell outline
      simCtx.strokeStyle = baseColor;
      simCtx.lineWidth = 1.8;
      simCtx.stroke();

      // Draw Cute Eyes facing front (direction: positive X axis in rotated local coordinate)
      const eyeSize = Math.max(1.8, org.radius * 0.22);
      const eyeOffsetX = org.radius * 0.45;
      const eyeOffsetY = org.radius * 0.4;

      // Left Eye
      simCtx.beginPath();
      simCtx.arc(eyeOffsetX, -eyeOffsetY, eyeSize, 0, Math.PI * 2);
      simCtx.fillStyle = '#ffffff';
      simCtx.fill();
      simCtx.beginPath();
      simCtx.arc(eyeOffsetX + eyeSize*0.3, -eyeOffsetY, eyeSize * 0.45, 0, Math.PI * 2);
      simCtx.fillStyle = '#000000';
      simCtx.fill();

      // Right Eye
      simCtx.beginPath();
      simCtx.arc(eyeOffsetX, eyeOffsetY, eyeSize, 0, Math.PI * 2);
      simCtx.fillStyle = '#ffffff';
      simCtx.fill();
      simCtx.beginPath();
      simCtx.arc(eyeOffsetX + eyeSize*0.3, eyeOffsetY, eyeSize * 0.45, 0, Math.PI * 2);
      simCtx.fillStyle = '#000000';
      simCtx.fill();

      // Draw metabolic tail or flippers based on diet/speed genes
      simCtx.fillStyle = baseColor;
      simCtx.beginPath();
      simCtx.moveTo(-org.radius * 0.8, -org.radius * 0.3);
      simCtx.lineTo(-org.radius * 1.3, 0);
      simCtx.lineTo(-org.radius * 0.8, org.radius * 0.3);
      simCtx.fill();

      simCtx.restore();
    }

    // 6. Draw Selected Creature Highlighter HUD Bracket
    if (selectedCreature) {
      simCtx.beginPath();
      simCtx.arc(selectedCreature.x, selectedCreature.y, selectedCreature.radius + 10, 0, Math.PI * 2);
      simCtx.strokeStyle = 'rgba(59, 130, 246, 0.85)';
      simCtx.lineWidth = 1.5;
      simCtx.setLineDash([5, 5]);
      simCtx.stroke();
      simCtx.setLineDash([]); // clear dash

      // Sensory Cone indicator
      simCtx.beginPath();
      simCtx.arc(selectedCreature.x, selectedCreature.y, selectedCreature.sensoryRange, 0, Math.PI * 2);
      simCtx.strokeStyle = 'rgba(255, 255, 255, 0.045)';
      simCtx.lineWidth = 1;
      simCtx.stroke();
    }

    // 7. Draw Wall Drafting segment
    if (activeTool === 'wall' && isDrawingWall && wallStartPos && currentMouseWorldPos) {
      simCtx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      simCtx.lineWidth = 4;
      simCtx.lineCap = 'round';
      simCtx.beginPath();
      simCtx.moveTo(wallStartPos.x, wallStartPos.y);
      simCtx.lineTo(currentMouseWorldPos.x, currentMouseWorldPos.y);
      simCtx.stroke();
    }

    simCtx.restore();
  }

  // --- 11. Main Frame Loop ---
  function tick(timestamp) {
    const w = simCanvas.width / (window.devicePixelRatio || 1);
    const h = simCanvas.height / (window.devicePixelRatio || 1);

    // 1. Calculate FPS
    frameCount++;
    if (timestamp - lastFPSUpdateTime > 1000) {
      currentFPS = Math.round((frameCount * 1000) / (timestamp - lastFPSUpdateTime));
      frameCount = 0;
      lastFPSUpdateTime = timestamp;
    }

    // 2. Physics updates (only when playing, multiple steps for fast forward)
    if (isPlaying) {
      const substeps = simSpeed;
      // standard frame step rate is 1.0 (subdivided slightly to maintain collision accuracy at high speeds)
      const stepDelta = 1.0 / Math.max(1, Math.floor(substeps / 2));
      const loops = Math.max(1, Math.floor(substeps / 2)) * (substeps <= 2 ? 1 : Math.floor(substeps / 2));
      
      // Calculate how many times we run update loops
      // E.g. speed = 1x -> 1 loop of delta 1.0
      // speed = 4x -> 4 loops of delta 1.0
      // speed = 10x -> 10 loops of delta 1.0
      for (let s = 0; s < simSpeed; s++) {
        world.update(1.0);
      }

      // Camera follow selected creature
      if (selectedCreature && isFollowingSelected) {
        // smooth interpolation
        panX += (w / 2 - selectedCreature.x - panX) * 0.08;
        panY += (h / 2 - selectedCreature.y - panY) * 0.08;
      }
    }

    // 3. Render Views
    drawSimulation();
    
    // Update stats once per frame
    updateDOMStats(currentFPS);
    updateInspectorPanel();
    
    if (selectedCreature) {
      drawNeuralNetwork();
    }
    
    // Draw population chart once every 15 updates
    if (world.stepCount % 15 === 0 || !isPlaying) {
      drawSpeciesHistory();
      updateSpeciesList();
    }

    requestAnimationFrame(tick);
  }

  // Kickstart loop
  requestAnimationFrame((timestamp) => {
    lastFPSUpdateTime = timestamp;
    tick(timestamp);
  });
});
