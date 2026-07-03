/**
 * Assembly Biosphere - Virtual Machine Interpreter & Grid Physics Engine
 */

// --- 1. Assembly Program Parser & Formatter ---
class Assembler {
  static VALID_OPS = ['MOVE', 'TURN_L', 'TURN_R', 'SCAN', 'EAT', 'JUMP', 'JNZ', 'JE', 'SET', 'REPLICATE', 'ATTACK', 'SHARE'];
  
  static parseCode(codeString) {
    const lines = codeString.split('\n');
    const program = [];
    
    for (let line of lines) {
      // Strip comments
      line = line.split(';')[0].trim();
      if (!line) continue;

      // Strip line numbers if present, e.g. "0: MOVE"
      if (line.includes(':')) {
        line = line.substring(line.indexOf(':') + 1).trim();
      }

      if (!line) continue;

      const parts = line.split(/\s+/);
      const op = parts[0].toUpperCase();
      
      if (!Assembler.VALID_OPS.includes(op)) continue; // ignore unknown operators

      const args = parts.slice(1).map(p => {
        if (!isNaN(p)) return parseInt(p); // parse integers (line targets / values)
        return p; // keep register name strings like "R0", "R1"
      });

      program.push({ op, args, raw: line });
    }

    // Default program fallback if empty
    if (program.length === 0) {
      return Assembler.parseCode("SCAN\nJE R1 1 5\nMOVE\nJUMP 0\nEAT\nJUMP 0\nREPLICATE\nJUMP 0");
    }

    return program;
  }

  // Format program back to clean text editor string
  static formatCode(program) {
    return program.map((line, idx) => `${idx}: ${line.op} ${line.args.join(' ')}`).join('\n');
  }

  // Generate program-based hash code to map similar programs to similar HSL colors
  static getProgramHash(program) {
    let str = '';
    for (const inst of program) {
      str += inst.op + inst.args.join('');
    }
    
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return Math.abs(hash);
  }
}

// --- 2. Program Mutator (Genetic Algorithm) ---
class ProgramMutator {
  static mutate(program, rate) {
    // Determine if we mutate at all
    if (Math.random() > rate) return { program: program.map(line => ({ ...line })), mutated: false, desc: '' };

    const newProgram = program.map(line => ({ ...line }));
    
    // Choose mutation type:
    // 0: swap operator
    // 1: swap arguments
    // 2: insert random line
    // 3: delete random line
    const type = Math.floor(Math.random() * 4);
    const lineIndex = Math.floor(Math.random() * newProgram.length);
    let desc = '';

    if (type === 0 && newProgram.length > 0) {
      // Swap operator
      const oldOp = newProgram[lineIndex].op;
      const newOp = Assembler.VALID_OPS[Math.floor(Math.random() * Assembler.VALID_OPS.length)];
      newProgram[lineIndex].op = newOp;
      
      // Ensure arguments count match the operator
      newProgram[lineIndex].args = ProgramMutator.getCompatibleArgs(newOp, newProgram.length);
      desc = `Line ${lineIndex}: Altered operator ${oldOp} → ${newOp}`;
    } 
    else if (type === 1 && newProgram.length > 0) {
      // Swap arguments
      const inst = newProgram[lineIndex];
      if (inst.args.length > 0) {
        const argIdx = Math.floor(Math.random() * inst.args.length);
        const oldArg = inst.args[argIdx];
        let newArg = oldArg;

        if (typeof oldArg === 'number') {
          // Mutate number (jump address / value)
          newArg = Math.floor(Math.random() * Math.max(8, newProgram.length));
        } else {
          // Mutate registers: R0, R1, R2
          const regs = ['R0', 'R1', 'R2'];
          newArg = regs[Math.floor(Math.random() * regs.length)];
        }
        
        inst.args[argIdx] = newArg;
        desc = `Line ${lineIndex}: Altered argument ${oldArg} → ${newArg}`;
      } else {
        desc = `Line ${lineIndex}: No arguments to mutate`;
      }
    } 
    else if (type === 2 && newProgram.length < 16) {
      // Insert random line
      const randomOp = Assembler.VALID_OPS[Math.floor(Math.random() * Assembler.VALID_OPS.length)];
      const randomArgs = ProgramMutator.getCompatibleArgs(randomOp, newProgram.length + 1);
      
      newProgram.splice(lineIndex, 0, { op: randomOp, args: randomArgs, raw: `${randomOp} ${randomArgs.join(' ')}` });
      desc = `Line ${lineIndex}: Inserted new line ${randomOp}`;
    } 
    else if (type === 3 && newProgram.length > 3) {
      // Delete random line
      const deleted = newProgram.splice(lineIndex, 1);
      desc = `Line ${lineIndex}: Deleted line ${deleted[0].op}`;
    }

    return { program: newProgram, mutated: true, desc };
  }

  static getCompatibleArgs(op, programLen) {
    const registers = ['R0', 'R1', 'R2'];
    const randomReg = () => registers[Math.floor(Math.random() * registers.length)];
    const randomLine = () => Math.floor(Math.random() * programLen);
    
    if (op === 'JUMP') return [randomLine()];
    if (op === 'JNZ') return [randomReg(), randomLine()];
    if (op === 'JE') return [randomReg(), Math.floor(Math.random() * 4), randomLine()];
    if (op === 'SET') return [randomReg(), Math.floor(Math.random() * 5)];
    return []; // MOVE, SCAN, EAT, REPLICATE, ATTACK, SHARE have no args
  }
}

// --- 3. Robot (Virtual Machine) Entity ---
class Robot {
  constructor(x, y, program) {
    this.x = x;
    this.y = y;
    this.direction = Math.floor(Math.random() * 4); // 0=N, 1=E, 2=S, 3=W
    
    // Program Memory
    this.program = program || Assembler.parseCode("");
    
    // CPU Registers
    this.registers = {
      R0: 0, // Accumulator
      R1: 0, // Sensory result
      R2: 0  // Mutation factor
    };
    
    this.ip = 0; // Instruction Pointer
    this.energy = 90; // Start health
    this.maxEnergy = 200;
    this.age = 0;
    this.id = Math.random().toString(36).substr(2, 6);
    
    // HSL Color hash
    const progHash = Assembler.getProgramHash(this.program);
    this.hue = progHash % 360;
    this.color = `hsl(${this.hue}, 85%, 55%)`;

    // Combat indicators
    this.combatFlash = 0;
  }

  step(world) {
    this.age++;
    this.energy -= 0.28; // Tiny idle metabolism tax

    if (this.combatFlash > 0) this.combatFlash--;

    if (this.program.length === 0) return;

    // Safety checks for IP pointer out of bounds
    if (this.ip < 0 || this.ip >= this.program.length) {
      this.ip = 0;
    }

    const inst = this.program[this.ip];
    const op = inst.op;
    const args = inst.args;

    let jumped = false;
    let actionCost = 0.2; // base energy cost per execution

    // --- VM INSTRUCTION SET DECODER ---
    if (op === 'MOVE') {
      actionCost = 0.55;
      const targetPos = this.getFacingCell();
      if (world.isEmpty(targetPos.x, targetPos.y)) {
        // Move grid position
        world.moveRobot(this, targetPos.x, targetPos.y);
      }
    } 
    else if (op === 'TURN_L') {
      this.direction = (this.direction + 3) % 4;
    } 
    else if (op === 'TURN_R') {
      this.direction = (this.direction + 1) % 4;
    } 
    else if (op === 'SCAN') {
      actionCost = 0.3;
      const scanPos = this.getFacingCell();
      this.registers.R1 = world.scanTile(scanPos.x, scanPos.y); // 0=empty, 1=food, 2=robot, 3=wall
    } 
    else if (op === 'EAT') {
      actionCost = 0.2;
      const targetPos = this.getFacingCell();
      if (world.isFood(targetPos.x, targetPos.y)) {
        world.consumeFood(targetPos.x, targetPos.y);
        this.energy = Math.min(this.maxEnergy, this.energy + 45); // add energy
      }
    } 
    else if (op === 'JUMP') {
      const line = args[0];
      if (typeof line === 'number' && line >= 0 && line < this.program.length) {
        this.ip = line;
        jumped = true;
      }
    } 
    else if (op === 'JNZ') {
      const reg = args[0];
      const line = args[1];
      if (this.registers[reg] !== 0 && typeof line === 'number' && line >= 0 && line < this.program.length) {
        this.ip = line;
        jumped = true;
      }
    } 
    else if (op === 'JE') {
      const reg = args[0];
      const val = args[1];
      const line = args[2];
      if (this.registers[reg] === val && typeof line === 'number' && line >= 0 && line < this.program.length) {
        this.ip = line;
        jumped = true;
      }
    } 
    else if (op === 'SET') {
      const reg = args[0];
      const val = args[1];
      this.registers[reg] = val;
    } 
    else if (op === 'ATTACK') {
      actionCost = 0.7;
      const targetPos = this.getFacingCell();
      const targetRobot = world.getRobotAt(targetPos.x, targetPos.y);
      if (targetRobot) {
        targetRobot.energy -= 25; // damage target
        targetRobot.combatFlash = 6;
        this.energy = Math.min(this.maxEnergy, this.energy + 18); // siphon energy
      }
    } 
    else if (op === 'SHARE') {
      actionCost = 0.1;
      if (this.energy > 40) {
        const targetPos = this.getFacingCell();
        const targetRobot = world.getRobotAt(targetPos.x, targetPos.y);
        if (targetRobot) {
          this.energy -= 15;
          targetRobot.energy = Math.min(targetRobot.maxEnergy, targetRobot.energy + 15);
        }
      }
    } 
    else if (op === 'REPLICATE') {
      actionCost = 0.8;
      if (this.energy > 120) {
        const spawnPos = world.findAdjacentEmptyCell(this.x, this.y);
        if (spawnPos) {
          // Deduct 50% energy
          const childEnergy = this.energy * 0.45;
          this.energy *= 0.5;

          // Mutate program
          const mutResult = ProgramMutator.mutate(this.program, world.mutationRate);
          const child = new Robot(spawnPos.x, spawnPos.y, mutResult.program);
          child.energy = childEnergy;

          world.spawnRobot(child);
          
          if (mutResult.mutated) {
            world.logMutation(`Robot #${this.id} replicated with mutation: ${mutResult.desc} → new lineage #${child.id}`, 'mutation');
          }
        }
      }
    }

    // Deduct action cost
    this.energy -= actionCost;

    // Increment instruction pointer if we didn't jump
    if (!jumped) {
      this.ip++;
      if (this.ip >= this.program.length) this.ip = 0;
    }
  }

  getFacingCell() {
    const dx = [0, 1, 0, -1][this.direction]; // 0=N, 1=E, 2=S, 3=W
    const dy = [-1, 0, 1, 0][this.direction];
    return { x: this.x + dx, y: this.y + dy };
  }
}

// --- 4. Spawners ---
class FoodCell {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.id = Math.random().toString(36).substr(2, 6);
  }
}

// --- 5. Biosphere World Grid ---
class BiosphereWorld {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    
    this.robots = [];
    this.food = [];
    this.walls = []; // array of {x, y} coordinates
    
    this.grid = Array(cols).fill(null).map(() => Array(rows).fill(null));
    
    this.mutationRate = 0.12;
    this.foodSpawnRate = 0.4;
    this.targetPopulation = 25;
    
    this.timelineLogs = [];
    this.totalMutations = 0;
  }

  init() {
    this.robots = [];
    this.food = [];
    this.walls = [];
    this.timelineLogs = [];
    this.totalMutations = 0;
    this.clearGrid();

    // Default Barrier Walls (place a couple of nice blocks)
    this.addWallBlock(10, 8, 3, 3);
    this.addWallBlock(this.cols - 13, this.rows - 11, 3, 3);

    // Initial Ancestors program
    const ancestorCode = "SCAN\nJE R1 1 5\nJE R1 2 7\nMOVE\nJUMP 0\nEAT\nJUMP 0\nREPLICATE\nJUMP 0";
    const ancestorProg = Assembler.parseCode(ancestorCode);

    for (let i = 0; i < 25; i++) {
      this.spawnRandomAncestor(ancestorProg);
    }

    // Initial Food
    for (let i = 0; i < 35; i++) {
      this.spawnFoodRandom();
    }
  }

  clearGrid() {
    this.grid = Array(this.cols).fill(null).map(() => Array(this.rows).fill(null));
  }

  addWallBlock(sx, sy, w, h) {
    for (let x = sx; x < sx + w; x++) {
      for (let y = sy; y < sy + h; y++) {
        if (x >= 0 && x < this.cols && y >= 0 && y < this.rows) {
          this.walls.push({ x, y });
          this.grid[x][y] = 'wall';
        }
      }
    }
  }

  clearWalls() {
    // Remove all wall tokens from grid, preserving robots and food
    this.walls = [];
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        if (this.grid[x][y] === 'wall') {
          this.grid[x][y] = null;
        }
      }
    }
  }

  spawnRandomAncestor(prog = null) {
    const pos = this.findRandomEmptyCell();
    if (!pos) return;
    
    const program = prog || Assembler.parseCode("SCAN\nJE R1 1 5\nJE R1 2 7\nMOVE\nJUMP 0\nEAT\nJUMP 0\nREPLICATE\nJUMP 0");
    const r = new Robot(pos.x, pos.y, program);
    this.spawnRobot(r);
  }

  spawnRobot(robot) {
    this.robots.push(robot);
    this.grid[robot.x][robot.y] = robot;
  }

  spawnFoodRandom() {
    const pos = this.findRandomEmptyCell();
    if (!pos) return;
    const f = new FoodCell(pos.x, pos.y);
    this.food.push(f);
    this.grid[pos.x][pos.y] = f;
  }

  spawnManualWall(x, y) {
    if (this.isEmpty(x, y)) {
      this.walls.push({ x, y });
      this.grid[x][y] = 'wall';
    }
  }

  moveRobot(robot, tx, ty) {
    // clear old
    this.grid[robot.x][robot.y] = null;
    // update
    robot.x = tx;
    robot.y = ty;
    this.grid[tx][ty] = robot;
  }

  consumeFood(x, y) {
    const idx = this.food.findIndex(f => f.x === x && f.y === y);
    if (idx !== -1) {
      this.food.splice(idx, 1);
      this.grid[x][y] = null;
    }
  }

  // --- Grid Cell Query Helpers ---
  isEmpty(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false;
    return this.grid[x][y] === null;
  }

  isFood(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return false;
    return this.grid[x][y] instanceof FoodCell;
  }

  getRobotAt(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return null;
    return this.grid[x][y] instanceof Robot ? this.grid[x][y] : null;
  }

  scanTile(x, y) {
    if (x < 0 || x >= this.cols || y < 0 || y >= this.rows) return 3; // Wall
    const tile = this.grid[x][y];
    if (tile === 'wall') return 3;
    if (tile instanceof FoodCell) return 1;
    if (tile instanceof Robot) return 2;
    return 0; // Empty
  }

  findAdjacentEmptyCell(x, y) {
    // Check 4 cardinals randomly
    const dirs = [
      { dx: 0, dy: -1 }, // N
      { dx: 1, dy: 0 },  // E
      { dx: 0, dy: 1 },  // S
      { dx: -1, dy: 0 }  // W
    ];
    
    // Shuffle
    dirs.sort(() => Math.random() - 0.5);

    for (const d of dirs) {
      const tx = x + d.dx;
      const ty = y + d.dy;
      if (this.isEmpty(tx, ty)) {
        return { x: tx, y: ty };
      }
    }
    return null;
  }

  findRandomEmptyCell() {
    for (let attempts = 0; attempts < 100; attempts++) {
      const rx = Math.floor(Math.random() * this.cols);
      const ry = Math.floor(Math.random() * this.rows);
      if (this.isEmpty(rx, ry)) {
        return { x: rx, y: ry };
      }
    }
    return null;
  }

  // --- Radiation / Plague triggers ---
  triggerRadiationBurst() {
    // Instantly mutate one random line of ALL living robots
    let mutatedCount = 0;
    for (const r of this.robots) {
      const mutResult = ProgramMutator.mutate(r.program, 1.0); // 100% force mutate
      r.program = mutResult.program;
      
      // Update color hue based on new code
      const progHash = Assembler.getProgramHash(r.program);
      r.hue = progHash % 360;
      r.color = `hsl(${r.hue}, 85%, 55%)`;
      mutatedCount++;
    }
    this.logMutation(`☢️ RADIATION BURST: Force mutated code programs of ${mutatedCount} robots!`, 'system');
  }

  // Log system for activity panel
  logMutation(text, type = 'system') {
    this.timelineLogs.push({ text, type, time: new Date().toLocaleTimeString() });
    
    if (type === 'mutation') {
      this.totalMutations++;
    }

    if (this.timelineLogs.length > 50) {
      this.timelineLogs.shift();
    }
  }

  update() {
    // 1. Spawning food cell potential
    if (Math.random() < this.foodSpawnRate) {
      if (this.food.length < 80) {
        this.spawnFoodRandom();
      }
    }

    // 2. Step all Robot CPU interpreters
    for (let i = this.robots.length - 1; i >= 0; i--) {
      const robot = this.robots[i];
      robot.step(this);

      // Handle Robot Death
      if (robot.energy <= 0) {
        // Leave food where it died
        this.grid[robot.x][robot.y] = null;
        this.robots.splice(i, 1);
        
        // Spawn food
        const f = new FoodCell(robot.x, robot.y);
        this.food.push(f);
        this.grid[robot.x][robot.y] = f;
        
        this.logMutation(`Robot #${robot.id} died of energy exhaustion. Left energy cell.`, 'death');
      }
    }

    // 3. Maintain Target Minimum Population
    if (this.robots.length < this.targetPopulation) {
      const needed = this.targetPopulation - this.robots.length;
      for (let k = 0; k < needed; k++) {
        this.spawnRandomAncestor();
      }
    }
  }
}
