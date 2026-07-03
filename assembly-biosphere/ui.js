/**
 * Assembly Biosphere - UI Event Listeners and Grid Canvas Renderer
 */

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('biosphere-canvas');
  const ctx = canvas.getContext('2d');

  // Setup grid dimensions
  const COLS = 55;
  const ROWS = 42;
  
  const world = new BiosphereWorld(COLS, ROWS);
  world.init();

  let selectedRobot = null;
  let activeTool = 'inspect'; // 'inspect', 'food', 'ancestor', 'wall'

  // Playback state
  let isPlaying = true;
  let simSpeed = 1;

  // Fit canvas sizes
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
  }
  window.addEventListener('resize', resize);
  resize();

  // Helper mapping screen click to grid cell coordinates
  function getGridCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);

    const cellW = w / COLS;
    const cellH = h / ROWS;

    const col = Math.floor(mx / cellW);
    const row = Math.floor(my / cellH);

    return { col: Math.max(0, Math.min(COLS - 1, col)), row: Math.max(0, Math.min(ROWS - 1, row)) };
  }

  // --- 1. UI Event Listeners ---
  
  // Speed slider
  const sliderSpeed = document.getElementById('slider-speed');
  const valSpeed = document.getElementById('val-speed');
  sliderSpeed.addEventListener('input', (e) => {
    simSpeed = parseInt(e.target.value);
    valSpeed.textContent = `${simSpeed}x`;
  });

  // Min Pop slider
  const sliderTargetPop = document.getElementById('slider-target-pop');
  const valTargetPop = document.getElementById('val-target-pop');
  sliderTargetPop.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    world.targetPopulation = val;
    valTargetPop.textContent = val;
  });

  // Food spawn slider
  const sliderFoodSpawn = document.getElementById('slider-food-spawn');
  const valFoodSpawn = document.getElementById('val-food-spawn');
  sliderFoodSpawn.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    world.foodSpawnRate = val;
    valFoodSpawn.textContent = val.toFixed(1);
  });

  // Mutation rate slider
  const sliderMutation = document.getElementById('slider-mutation');
  const valMutation = document.getElementById('val-mutation');
  sliderMutation.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    world.mutationRate = val / 100;
    valMutation.textContent = `${val}%`;
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
  btnTogglePlay.addEventListener('click', () => setPlayState(!isPlaying));

  // Reset Button
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm("Reset the biosphere? All mutations will be wiped.")) {
      world.init();
      selectedRobot = null;
      document.getElementById('inspector-content').classList.add('hidden');
      document.getElementById('inspector-placeholder').classList.remove('hidden');
      setPlayState(true);
    }
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

  // Clear barrier walls
  document.getElementById('btn-clear-walls').addEventListener('click', () => {
    world.clearWalls();
  });

  // Induce radiation mutation burst
  document.getElementById('btn-inject-mutation').addEventListener('click', () => {
    world.triggerRadiationBurst();
  });

  // --- 2. Code Memory Editor Handlers ---
  const textareaCode = document.getElementById('textarea-code');
  const btnWriteMemory = document.getElementById('btn-write-memory');

  btnWriteMemory.addEventListener('click', () => {
    if (selectedRobot) {
      const code = textareaCode.value;
      selectedRobot.program = Assembler.parseCode(code);
      selectedRobot.ip = 0; // reset pointer

      // Update color hue based on new code
      const progHash = Assembler.getProgramHash(selectedRobot.program);
      selectedRobot.hue = progHash % 360;
      selectedRobot.color = `hsl(${selectedRobot.hue}, 85%, 55%)`;

      world.logMutation(`User manually overwrote program code memory of Robot #${selectedRobot.id}`, 'system');
      buildCodeIDE(selectedRobot); // rebuild panel view
    }
  });

  // Inspector buttons
  document.getElementById('btn-inspect-kill').addEventListener('click', () => {
    if (selectedRobot) {
      selectedRobot.energy = 0; // dies in next frame step
      selectedRobot = null;
      document.getElementById('inspector-content').classList.add('hidden');
      document.getElementById('inspector-placeholder').classList.remove('hidden');
    }
  });

  document.getElementById('btn-inspect-mutate').addEventListener('click', () => {
    if (selectedRobot) {
      const mutResult = ProgramMutator.mutate(selectedRobot.program, 1.0); // force mutation
      if (mutResult.mutated) {
        selectedRobot.program = mutResult.program;
        const progHash = Assembler.getProgramHash(selectedRobot.program);
        selectedRobot.hue = progHash % 360;
        selectedRobot.color = `hsl(${selectedRobot.hue}, 85%, 55%)`;
        
        world.logMutation(`⚡ RADIATION BEAM: Mutated Robot #${selectedRobot.id}: ${mutResult.desc}`, 'mutation');
        buildCodeIDE(selectedRobot);
      }
    }
  });

  // --- 3. Grid mouse clicks handler ---
  canvas.addEventListener('mousedown', (e) => {
    const grid = getGridCoords(e);

    if (activeTool === 'inspect') {
      const bot = world.getRobotAt(grid.col, grid.row);
      if (bot) {
        selectedRobot = bot;
        document.getElementById('inspector-placeholder').classList.add('hidden');
        document.getElementById('inspector-content').classList.remove('hidden');
        buildCodeIDE(bot);
      }
    } 
    else if (activeTool === 'food') {
      if (world.isEmpty(grid.col, grid.row)) {
        const f = new FoodCell(grid.col, grid.row);
        world.food.push(f);
        world.grid[grid.col][grid.row] = f;
      }
    } 
    else if (activeTool === 'ancestor') {
      if (world.isEmpty(grid.col, grid.row)) {
        const r = new Robot(grid.col, grid.row);
        world.spawnRobot(r);
      }
    } 
    else if (activeTool === 'wall') {
      world.spawnManualWall(grid.col, grid.row);
    }
  });

  // --- 4. IDE Code View Builders ---
  function buildCodeIDE(robot) {
    const container = document.getElementById('ide-code-lines');
    container.innerHTML = ''; // clear

    robot.program.forEach((line, idx) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'ide-line';
      lineDiv.id = `ide-line-${idx}`;

      const numSpan = document.createElement('span');
      numSpan.className = 'line-num';
      numSpan.textContent = idx;

      const codeSpan = document.createElement('span');
      codeSpan.className = 'line-code';
      codeSpan.textContent = `${line.op} ${line.args.join(' ')}`;

      lineDiv.appendChild(numSpan);
      lineDiv.appendChild(codeSpan);
      container.appendChild(lineDiv);
    });

    // Set textarea formatted code
    textareaCode.value = Assembler.formatCode(robot.program);
  }

  function updateCodeLineHighlight() {
    if (!selectedRobot) return;

    // Reset old line highlights
    const lines = document.querySelectorAll('.ide-line');
    lines.forEach(l => l.classList.remove('active-exec'));

    // Highlight current line IP
    const activeLine = document.getElementById(`ide-line-${selectedRobot.ip}`);
    if (activeLine) {
      activeLine.classList.add('active-exec');
      // Scroll into view inside IDE container
      activeLine.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }

  // --- 5. Grid Viewport Renderer ---
  function drawGrid() {
    const w = canvas.width / (window.devicePixelRatio || 1);
    const h = canvas.height / (window.devicePixelRatio || 1);
    
    ctx.clearRect(0, 0, w, h);

    const cellW = w / COLS;
    const cellH = h / ROWS;

    // 1. Draw subtle background checkerboard grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, h);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(w, r * cellH);
      ctx.stroke();
    }

    // 2. Draw static Barrier Walls
    ctx.fillStyle = '#475569';
    for (const wall of world.walls) {
      ctx.fillRect(wall.x * cellW + 1, wall.y * cellH + 1, cellW - 2, cellH - 2);
    }

    // 3. Draw Energy Food cells
    ctx.fillStyle = '#10b981';
    for (const food of world.food) {
      // Draw as circular glowing dots
      ctx.beginPath();
      ctx.arc(food.x * cellW + cellW/2, food.y * cellH + cellH/2, cellW * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw Assembly Robots
    for (const robot of world.robots) {
      const rx = robot.x * cellW;
      const ry = robot.y * cellH;

      ctx.save();
      ctx.translate(rx + cellW / 2, ry + cellH / 2);
      
      // Rotate triangle facing direction (0=N, 1=E, 2=S, 3=W)
      const angle = robot.direction * Math.PI / 2;
      ctx.rotate(angle);

      // Draw triangle body
      ctx.beginPath();
      ctx.moveTo(0, -cellH * 0.42); // top point
      ctx.lineTo(cellW * 0.38, cellH * 0.36); // bottom right
      ctx.lineTo(-cellW * 0.38, cellH * 0.36); // bottom left
      ctx.closePath();

      // Flashing combat effect
      if (robot.combatFlash > 0) {
        ctx.fillStyle = '#ef4444';
      } else {
        ctx.fillStyle = robot.color;
      }
      ctx.fill();
      
      // Outline
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.restore();

      // Draw faint energy bar indicator underneath
      const barH = 2.5;
      const barW = cellW * 0.8;
      const bx = rx + (cellW - barW)/2;
      const by = ry + cellH - barH - 1;
      
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(bx, by, barW, barH);
      
      const energyRatio = Math.max(0, Math.min(1.0, robot.energy / robot.maxEnergy));
      ctx.fillStyle = energyRatio > 0.4 ? '#10b981' : '#f59e0b';
      ctx.fillRect(bx, by, barW * energyRatio, barH);

      // Draw Selected highlighting bracket ring
      if (selectedRobot === robot) {
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(rx + cellW / 2, ry + cellH / 2, cellW * 0.7, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  // --- 6. Live HUD Panels update handlers ---
  function updateInspectorHUD() {
    if (!selectedRobot) return;

    // Check if robot died
    if (selectedRobot.energy <= 0) {
      selectedRobot = null;
      document.getElementById('inspector-content').classList.add('hidden');
      document.getElementById('inspector-placeholder').classList.remove('hidden');
      return;
    }

    // Registers DOM labels
    document.getElementById('inspect-id').textContent = `Robot CPU: #${selectedRobot.id}`;
    document.getElementById('inspect-age-label').textContent = `Age: ${selectedRobot.age} cycles`;
    
    document.getElementById('inspect-reg-energy').textContent = `${Math.round(selectedRobot.energy)} / ${selectedRobot.maxEnergy}`;
    document.getElementById('inspect-reg-ip').textContent = selectedRobot.ip;
    document.getElementById('inspect-reg-r0').textContent = selectedRobot.registers.R0;
    document.getElementById('inspect-reg-r1').textContent = selectedRobot.registers.R1;
    
    document.getElementById('inspect-icon').style.borderColor = selectedRobot.color;
    document.getElementById('inspect-icon').style.color = selectedRobot.color;

    // Highlights active execution row in the IDE
    updateCodeLineHighlight();
  }

  function updateGlobalHUD() {
    document.getElementById('header-pop-count').textContent = world.robots.length;
    document.getElementById('header-food-count').textContent = world.food.length;
    document.getElementById('header-mutations').textContent = world.totalMutations;
  }

  function updateTimelineLogs() {
    const container = document.getElementById('log-container');
    container.innerHTML = ''; // clear

    world.timelineLogs.forEach(entry => {
      const row = document.createElement('div');
      row.className = `log-entry ${entry.type}`;
      row.textContent = `[${entry.time}] ${entry.text}`;
      container.appendChild(row);
    });

    // Auto scroll down to newest logs
    container.scrollTop = container.scrollHeight;
  }

  // --- 7. Main Game tick frame loop ---
  function tick() {
    if (isPlaying) {
      // Step simulator multiple times for speed adjustments
      for (let s = 0; s < simSpeed; s++) {
        world.update();
      }
    }

    // Render Grid Board
    drawGrid();

    // Update Panels
    updateGlobalHUD();
    updateInspectorHUD();
    
    // Update timeline logs once every 12 frames
    if (world.robots.length > 0 && Math.random() < 0.08) {
      updateTimelineLogs();
    }

    requestAnimationFrame(tick);
  }

  // Start Loop
  requestAnimationFrame(tick);
});
