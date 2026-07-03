/**
 * A-Life Evolution Simulator - Core Physics & Simulation Engine
 */

// --- 1. Neural Network Class ---
class NeuralNetwork {
  constructor(inputSize, hiddenSize, outputSize, weights1, biases1, weights2, biases2) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;

    // Weights from Input to Hidden (hiddenSize x inputSize)
    this.weights1 = weights1 || this.randomMatrix(hiddenSize, inputSize);
    this.biases1 = biases1 || this.randomArray(hiddenSize);

    // Weights from Hidden to Output (outputSize x hiddenSize)
    this.weights2 = weights2 || this.randomMatrix(outputSize, hiddenSize);
    this.biases2 = biases2 || this.randomArray(outputSize);

    // Live state cache for visualization
    this.inputs = new Array(inputSize).fill(0);
    this.hiddenOutputs = new Array(hiddenSize).fill(0);
    this.outputs = new Array(outputSize).fill(0);
  }

  randomMatrix(rows, cols) {
    const matrix = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(Math.random() * 2 - 1);
      }
      matrix.push(row);
    }
    return matrix;
  }

  randomArray(size) {
    const arr = [];
    for (let i = 0; i < size; i++) {
      arr.push(Math.random() * 2 - 1);
    }
    return arr;
  }

  predict(inputs) {
    this.inputs = [...inputs];

    // Input -> Hidden
    this.hiddenOutputs = [];
    for (let h = 0; h < this.hiddenSize; h++) {
      let sum = this.biases1[h];
      for (let i = 0; i < this.inputSize; i++) {
        sum += this.inputs[i] * this.weights1[h][i];
      }
      // Tanh activation limits to [-1, 1]
      this.hiddenOutputs.push(Math.tanh(sum));
    }

    // Hidden -> Output
    this.outputs = [];
    for (let o = 0; o < this.outputSize; o++) {
      let sum = this.biases2[o];
      for (let h = 0; h < this.hiddenSize; h++) {
        sum += this.hiddenOutputs[h] * this.weights2[o][h];
      }
      // Tanh activation limits to [-1, 1]
      this.outputs.push(Math.tanh(sum));
    }

    return this.outputs;
  }

  clone() {
    const w1 = this.weights1.map(row => [...row]);
    const b1 = [...this.biases1];
    const w2 = this.weights2.map(row => [...row]);
    const b2 = [...this.biases2];
    return new NeuralNetwork(this.inputSize, this.hiddenSize, this.outputSize, w1, b1, w2, b2);
  }

  mutate(rate) {
    const mutateVal = (val) => {
      if (Math.random() < rate) {
        // Mutate by adding a Gaussian-like perturbation
        const offset = (Math.random() * 2 - 1) * 0.15;
        return Math.max(-1, Math.min(1, val + offset));
      }
      return val;
    };

    this.weights1 = this.weights1.map(row => row.map(mutateVal));
    this.biases1 = this.biases1.map(mutateVal);
    this.weights2 = this.weights2.map(row => row.map(mutateVal));
    this.biases2 = this.biases2.map(mutateVal);
  }
}

// --- 2. Genes Class ---
class Genes {
  constructor(diet, maxSpeed, size, sensoryRange) {
    // Diet: 0 = Herbivore (eat plants), 1 = Carnivore (eat other creatures/meat)
    this.diet = diet !== undefined ? diet : Math.random();
    // Max Speed: 1.5 to 5.0 pixels per frame/step
    this.maxSpeed = maxSpeed !== undefined ? maxSpeed : 1.5 + Math.random() * 3.0;
    // Size (radius): 5 to 14 pixels
    this.size = size !== undefined ? size : 5 + Math.random() * 9;
    // Sensory Range: 50 to 250 pixels
    this.sensoryRange = sensoryRange !== undefined ? sensoryRange : 60 + Math.random() * 160;
  }

  clone() {
    return new Genes(this.diet, this.maxSpeed, this.size, this.sensoryRange);
  }

  mutate(rate) {
    const mutateVal = (val, min, max, step) => {
      if (Math.random() < rate) {
        const offset = (Math.random() * 2 - 1) * step;
        return Math.max(min, Math.min(max, val + offset));
      }
      return val;
    };

    this.diet = mutateVal(this.diet, 0, 1, 0.12);
    this.maxSpeed = mutateVal(this.maxSpeed, 1.5, 5.0, 0.4);
    this.size = mutateVal(this.size, 5, 14, 0.8);
    this.sensoryRange = mutateVal(this.sensoryRange, 60, 250, 20);
  }
}

// --- 3. Organism Class ---
class Organism {
  constructor(x, y, genes, brain, generation = 1) {
    this.x = x;
    this.y = y;
    this.genes = genes || new Genes();
    
    // Physical traits computed from genes
    this.radius = this.genes.size;
    this.maxSpeed = this.genes.maxSpeed;
    this.sensoryRange = this.genes.sensoryRange;
    
    // Dynamics
    this.vx = (Math.random() * 2 - 1) * this.maxSpeed * 0.5;
    this.vy = (Math.random() * 2 - 1) * this.maxSpeed * 0.5;
    this.angle = Math.atan2(this.vy, this.vx);
    
    // Energy / Health system
    this.maxEnergy = this.radius * 12 + 80;
    this.energy = this.maxEnergy * 0.7; // Start at 70% energy
    
    // Age
    this.age = 0;
    // Max Age scales with size (larger live slightly longer)
    this.maxAge = 3500 + this.radius * 150;
    
    // Brain: 11 inputs, 8 hidden, 3 outputs
    this.brain = brain || new NeuralNetwork(11, 8, 3);
    
    // Lineage & Stats
    this.generation = generation;
    this.children = 0;
    this.id = Math.random().toString(36).substr(2, 9);
    this.speciesId = null;
    
    // Visual indicators
    this.isBiting = false;
    this.biteAnimTimer = 0;
    this.isSpawning = true;
    this.spawnAnimTimer = 25; // fade-in effect on birth
  }

  update(world, deltaTime) {
    this.age += deltaTime;
    
    if (this.isSpawning) {
      this.spawnAnimTimer -= deltaTime;
      if (this.spawnAnimTimer <= 0) this.isSpawning = false;
    }
    
    if (this.isBiting) {
      this.biteAnimTimer -= deltaTime;
      if (this.biteAnimTimer <= 0) this.isBiting = false;
    }

    // 1. Calculate Metabolism Cost
    // Metabolism scales with size^2 (mass), maxSpeed^2 (kinetic capability), and sensoryRange (brain power)
    const baseMetabolism = 0.04;
    const sizeCost = (this.radius * this.radius) * 0.00025;
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const speedCost = (currentSpeed * currentSpeed) * 0.001;
    const sensoryCost = this.sensoryRange * 0.00008;
    
    const metabolicRate = (baseMetabolism + sizeCost + speedCost + sensoryCost) * deltaTime;
    this.energy -= metabolicRate;

    // If age is near maximum, accelerate energy loss (senescence)
    if (this.age > this.maxAge * 0.8) {
      const senescenceRatio = (this.age - this.maxAge * 0.8) / (this.maxAge * 0.2);
      this.energy -= baseMetabolism * 4 * senescenceRatio * deltaTime;
    }

    // 2. Scan Environment (Gather inputs)
    const inputs = this.gatherSensoryInputs(world);

    // 3. Make Decision (Neural Net Inference)
    const outputs = this.brain.predict(inputs);

    // 4. Act on Decisions
    // Output 0: Steering torque [-1, 1] (angle adjustment)
    const steeringTorque = outputs[0] * 0.12 * deltaTime;
    this.angle += steeringTorque;

    // Keep angle normalized between -PI and PI
    if (this.angle > Math.PI) this.angle -= Math.PI * 2;
    if (this.angle < -Math.PI) this.angle += Math.PI * 2;

    // Output 1: Throttle [-1, 1] (acceleration force)
    const throttle = outputs[1]; // -1 to 1
    const acceleration = throttle * 0.22 * deltaTime;
    
    // Accelerate along current orientation angle
    this.vx += Math.cos(this.angle) * acceleration;
    this.vy += Math.sin(this.angle) * acceleration;

    // Apply friction/drag to prevent infinite slide
    const friction = 0.94;
    this.vx *= Math.pow(friction, deltaTime);
    this.vy *= Math.pow(friction, deltaTime);

    // Cap velocity at maxSpeed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > this.maxSpeed) {
      this.vx = (this.vx / speed) * this.maxSpeed;
      this.vy = (this.vy / speed) * this.maxSpeed;
    }

    // Apply movement
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;

    // Adjust physical angle to face direction of travel if moving quickly,
    // otherwise preserve heading.
    if (speed > 0.15) {
      this.angle = Math.atan2(this.vy, this.vx);
    }

    // Handle Wall Interactions (Bounce with energy penalty)
    this.handleWallCollisions(world);

    // Output 2: Attack/Bite trigger. If > 0, organism is biting
    if (outputs[2] > 0) {
      this.isBiting = true;
      this.biteAnimTimer = 8; // display bite visual for 8 steps
      // Attack consumes a tiny bit of energy
      this.energy -= 0.05 * deltaTime;
    }
  }

  handleWallCollisions(world) {
    const margin = this.radius;
    let bounced = false;

    // Outer petri boundaries
    if (this.x < margin) {
      this.x = margin;
      this.vx = -this.vx * 0.6;
      bounced = true;
    } else if (this.x > world.width - margin) {
      this.x = world.width - margin;
      this.vx = -this.vx * 0.6;
      bounced = true;
    }

    if (this.y < margin) {
      this.y = margin;
      this.vy = -this.vy * 0.6;
      bounced = true;
    } else if (this.y > world.height - margin) {
      this.y = world.height - margin;
      this.vy = -this.vy * 0.6;
      bounced = true;
    }

    // Custom Obstacle Walls Collision
    for (const wall of world.walls) {
      // Find closest point on wall (segment) to circle center
      const wallLenSq = (wall.x2 - wall.x1) * (wall.x2 - wall.x1) + (wall.y2 - wall.y1) * (wall.y2 - wall.y1);
      if (wallLenSq === 0) continue;

      let t = ((this.x - wall.x1) * (wall.x2 - wall.x1) + (this.y - wall.y1) * (wall.y2 - wall.y1)) / wallLenSq;
      t = Math.max(0, Math.min(1, t));

      const projX = wall.x1 + t * (wall.x2 - wall.x1);
      const projY = wall.y1 + t * (wall.y2 - wall.y1);

      const dx = this.x - projX;
      const dy = this.y - projY;
      const distSq = dx * dx + dy * dy;
      const minDist = this.radius + 3; // wall thickness buffer

      if (distSq < minDist * minDist) {
        const dist = Math.sqrt(distSq);
        const nx = dist > 0.01 ? dx / dist : 1;
        const ny = dist > 0.01 ? dy / dist : 0;

        // Push out of wall
        this.x = projX + nx * minDist;
        this.y = projY + ny * minDist;

        // Bounce velocity vector (reflect across normal)
        const dot = this.vx * nx + this.vy * ny;
        this.vx = (this.vx - 2 * dot * nx) * 0.6;
        this.vy = (this.vy - 2 * dot * ny) * 0.6;
        bounced = true;
      }
    }

    if (bounced) {
      this.energy -= 0.5; // Tiny energy tax for crashing
    }
  }

  gatherSensoryInputs(world) {
    // Input indices:
    // 0: Bias (1.0)
    // 1: Energy ratio [0, 1]
    // 2: Closest Plant Distance [0, 1] (1 = none)
    // 3: Closest Plant Angle [-1, 1]
    // 4: Closest Meat Distance [0, 1]
    // 5: Closest Meat Angle [-1, 1]
    // 6: Closest Other Creature Distance [0, 1]
    // 7: Closest Other Creature Angle [-1, 1]
    // 8: Closest Other Creature Diet [0, 1] (-1 if none)
    // 9: Closest Wall Distance [0, 1]
    // 10: Closest Wall Angle [-1, 1]

    let closestPlant = null;
    let closestPlantDistSq = Infinity;

    let closestMeat = null;
    let closestMeatDistSq = Infinity;

    let closestCreature = null;
    let closestCreatureDistSq = Infinity;

    let closestWallDist = Infinity;
    let closestWallAngle = 0;

    // Scan Food
    for (const food of world.food) {
      const dx = food.x - this.x;
      const dy = food.y - this.y;
      const dSq = dx * dx + dy * dy;
      
      if (dSq < this.sensoryRange * this.sensoryRange) {
        if (food.type === 'plant') {
          if (dSq < closestPlantDistSq) {
            closestPlantDistSq = dSq;
            closestPlant = food;
          }
        } else {
          if (dSq < closestMeatDistSq) {
            closestMeatDistSq = dSq;
            closestMeat = food;
          }
        }
      }
    }

    // Scan Other Creatures
    for (const other of world.organisms) {
      if (other.id === this.id || other.isSpawning) continue;
      const dx = other.x - this.x;
      const dy = other.y - this.y;
      const dSq = dx * dx + dy * dy;
      
      if (dSq < this.sensoryRange * this.sensoryRange) {
        if (dSq < closestCreatureDistSq) {
          closestCreatureDistSq = dSq;
          closestCreature = other;
        }
      }
    }

    // Scan Boundaries
    const checkWallDistance = (wx, wy) => {
      const dx = wx - this.x;
      const dy = wy - this.y;
      return dx * dx + dy * dy;
    };

    // Dist to boundary bounds
    const wallLeftDist = this.x;
    const wallRightDist = world.width - this.x;
    const wallTopDist = this.y;
    const wallBottomDist = world.height - this.y;
    
    let boundaryDist = Math.min(wallLeftDist, wallRightDist, wallTopDist, wallBottomDist);
    let boundaryAngle = 0;
    
    if (boundaryDist === wallLeftDist) boundaryAngle = Math.PI; // West
    else if (boundaryDist === wallRightDist) boundaryAngle = 0; // East
    else if (boundaryDist === wallTopDist) boundaryAngle = -Math.PI / 2; // North
    else boundaryAngle = Math.PI / 2; // South

    closestWallDist = boundaryDist;
    closestWallAngle = boundaryAngle - this.angle;

    // Scan Custom walls
    for (const wall of world.walls) {
      const wallLenSq = (wall.x2 - wall.x1) * (wall.x2 - wall.x1) + (wall.y2 - wall.y1) * (wall.y2 - wall.y1);
      if (wallLenSq === 0) continue;

      let t = ((this.x - wall.x1) * (wall.x2 - wall.x1) + (this.y - wall.y1) * (wall.y2 - wall.y1)) / wallLenSq;
      t = Math.max(0, Math.min(1, t));

      const projX = wall.x1 + t * (wall.x2 - wall.x1);
      const projY = wall.y1 + t * (wall.y2 - wall.y1);

      const dx = projX - this.x;
      const dy = projY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < this.sensoryRange && dist < closestWallDist) {
        closestWallDist = dist;
        closestWallAngle = Math.atan2(dy, dx) - this.angle;
      }
    }

    // Format & normalize signals
    const normalizeAngle = (ang) => {
      while (ang > Math.PI) ang -= Math.PI * 2;
      while (ang < -Math.PI) ang += Math.PI * 2;
      return ang / Math.PI; // Normalize to [-1, 1]
    };

    const inputs = [];
    inputs[0] = 1.0; // Bias
    inputs[1] = this.energy / this.maxEnergy; // [0, 1]

    // Plant sensor
    if (closestPlant) {
      const pAngle = Math.atan2(closestPlant.y - this.y, closestPlant.x - this.x) - this.angle;
      inputs[2] = Math.sqrt(closestPlantDistSq) / this.sensoryRange; // [0, 1]
      inputs[3] = normalizeAngle(pAngle);
    } else {
      inputs[2] = 1.0;
      inputs[3] = 0.0;
    }

    // Meat sensor
    if (closestMeat) {
      const mAngle = Math.atan2(closestMeat.y - this.y, closestMeat.x - this.x) - this.angle;
      inputs[4] = Math.sqrt(closestMeatDistSq) / this.sensoryRange; // [0, 1]
      inputs[5] = normalizeAngle(mAngle);
    } else {
      inputs[4] = 1.0;
      inputs[5] = 0.0;
    }

    // Other Creature sensor
    if (closestCreature) {
      const cAngle = Math.atan2(closestCreature.y - this.y, closestCreature.x - this.x) - this.angle;
      inputs[6] = Math.sqrt(closestCreatureDistSq) / this.sensoryRange; // [0, 1]
      inputs[7] = normalizeAngle(cAngle);
      inputs[8] = closestCreature.genes.diet; // [0, 1] indicating diet
    } else {
      inputs[6] = 1.0;
      inputs[7] = 0.0;
      inputs[8] = -1.0; // No creature seen
    }

    // Wall sensor
    inputs[9] = Math.min(1.0, closestWallDist / this.sensoryRange);
    inputs[10] = normalizeAngle(closestWallAngle);

    return inputs;
  }

  reproduce(world) {
    this.children++;
    // Energy cost: halve parent's energy and give other half to child
    const childEnergy = this.energy * 0.45;
    this.energy *= 0.5;

    // Mutate genes and brain
    const mutatedGenes = this.genes.clone();
    mutatedGenes.mutate(world.mutationRate);

    const mutatedBrain = this.brain.clone();
    mutatedBrain.mutate(world.mutationRate);

    // Spawn slightly behind parent or offset
    const spawnAngle = this.angle + Math.PI + (Math.random() * 0.6 - 0.3);
    const spawnOffset = this.radius * 2.5;
    const childX = Math.max(this.radius, Math.min(world.width - this.radius, this.x + Math.cos(spawnAngle) * spawnOffset));
    const childY = Math.max(this.radius, Math.min(world.height - this.radius, this.y + Math.sin(spawnAngle) * spawnOffset));

    const child = new Organism(childX, childY, mutatedGenes, mutatedBrain, this.generation + 1);
    child.energy = childEnergy;
    
    return child;
  }
}

// --- 4. Food Class ---
class Food {
  constructor(x, y, energy, type = 'plant') {
    this.x = x;
    this.y = y;
    this.energy = energy;
    this.type = type; // 'plant' (green) or 'meat' (red)
    this.radius = type === 'plant' ? 3 : 4;
    this.id = Math.random().toString(36).substr(2, 9);
    
    // Spawn effect
    this.pulseAnim = 0;
  }
}

// --- 5. Species Clustering Classifier ---
class SpeciesManager {
  constructor() {
    this.speciesMap = new Map(); // id -> Species Object
    this.nextSpeciesId = 1;
    this.historyBuffer = []; // stores {step, speciesCounts: {id: count}}
  }

  // Taxonomic name generators
  static PREFIXES = {
    herbivore: ["Phyto", "Herbi", "Prati", "Folio", "Gran", "Alga"],
    carnivore: ["Carni", "Vorax", "Sica", "Lani", "Rapti", "Arpa"],
    omnivore: ["Omni", "Ambi", "Mixo", "Pam", "Pluri", "Panto"]
  };
  
  static SUFFIXES = ["phaga", "dermis", "poda", "saurus", "soma", "nura", "thrix", "stoma", "gnatha"];
  
  static SPEC_MODIFIERS = {
    fast: ["velox", "celer", "rapida"],
    slow: ["tarda", "lenta", "sedentaria"],
    large: ["gigas", "titana", "colossa"],
    small: ["pumila", "micro", "minima"],
    sighted: ["optica", "teles", "clara"],
    blind: ["caeca", "brevis"]
  };

  generateBinomialName(genes) {
    let pList;
    if (genes.diet < 0.3) pList = SpeciesManager.PREFIXES.herbivore;
    else if (genes.diet > 0.7) pList = SpeciesManager.PREFIXES.carnivore;
    else pList = SpeciesManager.PREFIXES.omnivore;

    const pref = pList[Math.floor(Math.random() * pList.length)];
    const suff = SpeciesManager.SUFFIXES[Math.floor(Math.random() * SpeciesManager.SUFFIXES.length)];
    const genus = pref + suff;

    let mList;
    if (genes.maxSpeed > 3.6) mList = SpeciesManager.SPEC_MODIFIERS.fast;
    else if (genes.maxSpeed < 2.0) mList = SpeciesManager.SPEC_MODIFIERS.slow;
    else if (genes.size > 11.5) mList = SpeciesManager.SPEC_MODIFIERS.large;
    else if (genes.size < 7.0) mList = SpeciesManager.SPEC_MODIFIERS.small;
    else if (genes.sensoryRange > 180) mList = SpeciesManager.SPEC_MODIFIERS.sighted;
    else mList = SpeciesManager.SPEC_MODIFIERS.blind;

    const modifier = mList[Math.floor(Math.random() * mList.length)];
    
    return `${genus} ${modifier}`;
  }

  generateDistinctColor() {
    // Generate saturated colors that stand out on black
    const hue = Math.floor(Math.random() * 360);
    const sat = 85 + Math.floor(Math.random() * 15);
    const light = 50 + Math.floor(Math.random() * 15);
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  }

  classify(organism) {
    const genes = organism.genes;
    let bestMatch = null;
    let minDistance = Infinity;

    // Euclidean distance in trait space
    for (const [id, spec] of this.speciesMap) {
      const rep = spec.representativeGenes;
      
      const dDiet = Math.abs(genes.diet - rep.diet) * 1.5;
      const dSpeed = Math.abs(genes.maxSpeed - rep.maxSpeed) / 3.5 * 0.8;
      const dSize = Math.abs(genes.size - rep.size) / 9.0 * 0.8;
      const dSense = Math.abs(genes.sensoryRange - rep.sensoryRange) / 190.0 * 0.6;
      
      const dist = Math.sqrt(dDiet * dDiet + dSpeed * dSpeed + dSize * dSize + dSense * dSense);

      if (dist < minDistance) {
        minDistance = dist;
        bestMatch = spec;
      }
    }

    // Speciation distance threshold (0.28)
    if (bestMatch && minDistance < 0.28) {
      organism.speciesId = bestMatch.id;
      bestMatch.count++;
      
      // Gradually adjust cluster center / representative genes
      const rep = bestMatch.representativeGenes;
      const rate = 0.03; // learning rate
      rep.diet += (genes.diet - rep.diet) * rate;
      rep.maxSpeed += (genes.maxSpeed - rep.maxSpeed) * rate;
      rep.size += (genes.size - rep.size) * rate;
      rep.sensoryRange += (genes.sensoryRange - rep.sensoryRange) * rate;
    } else {
      // Create new Species (Speciation Event)
      const specId = `sp-${this.nextSpeciesId++}`;
      const name = this.generateBinomialName(genes);
      const color = this.generateDistinctColor();
      
      const newSpec = {
        id: specId,
        name: name,
        color: color,
        representativeGenes: genes.clone(),
        count: 1,
        births: 1,
        colorHue: parseInt(color.split('(')[1].split(',')[0])
      };
      
      this.speciesMap.set(specId, newSpec);
      organism.speciesId = specId;
    }
  }

  recordHistory(step) {
    const counts = {};
    for (const [id, spec] of this.speciesMap) {
      counts[id] = spec.count;
    }
    
    this.historyBuffer.push({
      step: step,
      speciesCounts: counts
    });

    // Cap history buffer size at 300 entries to prevent memory leak
    if (this.historyBuffer.length > 300) {
      this.historyBuffer.shift();
    }
  }
}

// --- 6. World / Simulation Manager ---
class World {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    
    this.organisms = [];
    this.food = [];
    this.walls = [];
    
    // Environment Configurations
    this.mutationRate = 0.10; // 10%
    this.plantSpawnRate = 0.5; // per frame/step spawn potential
    this.targetPopulation = 40;
    
    this.speciesManager = new SpeciesManager();
    this.stepCount = 0;
    
    // Total stats
    this.totalBirths = 0;
    this.totalDeaths = 0;
  }

  init(populationSize) {
    this.organisms = [];
    this.food = [];
    this.walls = [];
    this.stepCount = 0;
    this.totalBirths = 0;
    this.totalDeaths = 0;
    this.speciesManager = new SpeciesManager();
    
    // Add default boundaries (represented by walls segment or handled natively)
    // Add initial organisms
    for (let i = 0; i < populationSize; i++) {
      this.spawnRandomCreature(true); // Is initial ancestor
    }

    // Add initial plants
    for (let i = 0; i < populationSize * 2.5; i++) {
      this.spawnFood('plant');
    }
  }

  spawnRandomCreature(isAncestor = false) {
    const x = Math.random() * (this.width - 30) + 15;
    const y = Math.random() * (this.height - 30) + 15;
    
    // Equal distribution of starting diets
    const diet = Math.random();
    const genes = new Genes(diet);
    
    // Ancestors get simple generation count
    const org = new Organism(x, y, genes, null, isAncestor ? 1 : 1);
    
    this.speciesManager.classify(org);
    this.organisms.push(org);
    this.totalBirths++;
  }

  spawnFood(type = 'plant', x = null, y = null) {
    const spawnX = x !== null ? x : Math.random() * (this.width - 10) + 5;
    const spawnY = y !== null ? y : Math.random() * (this.height - 10) + 5;
    
    // Energy plants give is flat 45, meat is 60
    const energy = type === 'plant' ? 45 : 60;
    this.food.push(new Food(spawnX, spawnY, energy, type));
  }

  addWall(x1, y1, x2, y2) {
    this.walls.push({ x1, y1, x2, y2, id: Math.random().toString(36).substr(2, 9) });
  }

  clearWalls() {
    this.walls = [];
  }

  triggerPlague() {
    // Infect all creatures: cut energy by 50%
    for (const org of this.organisms) {
      org.energy *= 0.50;
    }
  }

  triggerExtinctionEvent(exemptId = null) {
    // Kill off 90% of creatures, leaving the exempted one (if inspect active) safe.
    const survivors = [];
    for (const org of this.organisms) {
      if (org.id === exemptId || Math.random() < 0.1) {
        survivors.push(org);
      } else {
        // Drop meat where they die
        this.spawnFood('meat', org.x, org.y);
        this.totalDeaths++;
        
        // Update species counting
        const spec = this.speciesManager.speciesMap.get(org.speciesId);
        if (spec) spec.count--;
      }
    }
    this.organisms = survivors;
  }

  update(deltaTime = 1.0) {
    this.stepCount++;

    // 1. Spawn Plants randomly
    if (Math.random() < this.plantSpawnRate * deltaTime) {
      // Spawn limit to prevent plant bloating
      if (this.food.filter(f => f.type === 'plant').length < 250) {
        this.spawnFood('plant');
      }
    }

    // 2. Update all Organisms
    for (let i = this.organisms.length - 1; i >= 0; i--) {
      const org = this.organisms[i];
      org.update(this, deltaTime);

      // Handle Death of Organism
      if (org.energy <= 0 || org.age > org.maxAge) {
        // Spawn Meat particles relative to size
        const meatParticles = Math.max(1, Math.floor(org.radius / 3.5));
        for (let m = 0; m < meatParticles; m++) {
          const ox = org.x + (Math.random() * org.radius - org.radius/2);
          const oy = org.y + (Math.random() * org.radius - org.radius/2);
          this.spawnFood('meat', ox, oy);
        }
        
        // Remove from list
        this.organisms.splice(i, 1);
        this.totalDeaths++;
        
        // Decrement species count
        const spec = this.speciesManager.speciesMap.get(org.speciesId);
        if (spec) spec.count--;
        
        continue;
      }

      // Handle Reproduction
      if (org.energy > org.maxEnergy) {
        // Cap population count at 250 to avoid browser crashing
        if (this.organisms.length < 220) {
          const child = org.reproduce(this);
          this.speciesManager.classify(child);
          this.organisms.push(child);
          this.totalBirths++;
        }
      }
    }

    // 3. Resolve Collisions: Organisms vs Food (Feeding)
    this.resolveFeedingCollisions();

    // 4. Resolve Combat & Physical Collisions between Organisms
    this.resolveOrganismCollisions(deltaTime);

    // 5. Ensure minimum population (auto-spawn ancestors if needed)
    if (this.organisms.length < this.targetPopulation) {
      const needed = this.targetPopulation - this.organisms.length;
      for (let k = 0; k < needed; k++) {
        this.spawnRandomCreature(true);
      }
    }

    // 6. Record species count history every 15 frames/steps
    if (this.stepCount % 15 === 0) {
      this.speciesManager.recordHistory(this.stepCount);
    }
  }

  resolveFeedingCollisions() {
    // Loop backwards so we can remove food elements safely
    for (let f = this.food.length - 1; f >= 0; f--) {
      const food = this.food[f];
      
      let foodEaten = false;
      
      // Find overlap with closest organism
      for (const org of this.organisms) {
        const dx = org.x - food.x;
        const dy = org.y - food.y;
        const overlap = org.radius + food.radius;
        
        if (dx * dx + dy * dy < overlap * overlap) {
          // Check digestion capacity based on Diet gene
          // plant = green, meat = red
          if (food.type === 'plant') {
            // Herbivores (diet=0) get full energy, Carnivores (diet=1) get none
            const herbivoreEfficiency = 1 - org.genes.diet;
            if (herbivoreEfficiency > 0.15) {
              org.energy = Math.min(org.maxEnergy, org.energy + food.energy * herbivoreEfficiency);
              foodEaten = true;
            }
          } else { // Meat
            // Carnivores (diet=1) get full energy, Herbivores (diet=0) get none
            const carnivoreEfficiency = org.genes.diet;
            if (carnivoreEfficiency > 0.15) {
              org.energy = Math.min(org.maxEnergy, org.energy + food.energy * carnivoreEfficiency);
              foodEaten = true;
            }
          }
          
          if (foodEaten) break; // exit organism loop for this food particle
        }
      }

      if (foodEaten) {
        this.food.splice(f, 1);
      }
    }
  }

  resolveOrganismCollisions(deltaTime) {
    const size = this.organisms.length;
    
    // Double loop for pairwise test
    for (let i = 0; i < size; i++) {
      const orgA = this.organisms[i];
      if (!orgA) continue;

      for (let j = i + 1; j < size; j++) {
        const orgB = this.organisms[j];
        if (!orgB) continue;

        const dx = orgB.x - orgA.x;
        const dy = orgB.y - orgA.y;
        const distSq = dx * dx + dy * dy;
        const minDist = orgA.radius + orgB.radius;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.1;
          const nx = dx / dist;
          const ny = dy / dist;

          // 1. Resolve overlap physically (push back slightly)
          const pushForce = (minDist - dist) * 0.5;
          orgA.x -= nx * pushForce;
          orgA.y -= ny * pushForce;
          orgB.x += nx * pushForce;
          orgB.y += ny * pushForce;

          // Elastic recoil for velocities
          const kx = orgA.vx - orgB.vx;
          const ky = orgA.vy - orgB.vy;
          const p = 2 * (nx * kx + ny * ky) / (orgA.radius + orgB.radius);
          
          orgA.vx -= p * orgB.radius * nx * 0.5;
          orgA.vy -= p * orgB.radius * ny * 0.5;
          orgB.vx += p * orgA.radius * nx * 0.5;
          orgB.vy += p * orgA.radius * ny * 0.5;

          // 2. Resolve Combat: If either is biting, attack other!
          if (orgA.isBiting && !orgA.isSpawning) {
            this.executeAttack(orgA, orgB, deltaTime);
          }
          if (orgB.isBiting && !orgB.isSpawning) {
            this.executeAttack(orgB, orgA, deltaTime);
          }
        }
      }
    }
  }

  executeAttack(attacker, target, deltaTime) {
    // Combat Power depends on attacker's carnivore ratio (diet gene) and size
    // Herbivores cannot deal significant attack damage (diet=0 gives low power)
    const baseDamage = 3.5;
    const dietPower = attacker.genes.diet; // 0 to 1
    const sizePower = attacker.radius / 10.0;
    
    // Damage scaling
    const damage = baseDamage * dietPower * sizePower * deltaTime;

    if (damage > 0.05) {
      target.energy -= damage;
      
      // Attacker steals a portion of energy based on their carnivore rating
      // Transfer rate is 70%
      const feedEfficiency = attacker.genes.diet * 0.7;
      attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + damage * feedEfficiency);
      
      // Combat particle/bite animations
      target.isBiting = true; // Flashes red outline in renderer
      target.biteAnimTimer = 5;
    }
  }
}
