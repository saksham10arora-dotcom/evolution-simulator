/**
 * Gravity Warp - Spacetime Curvature & N-Body Physics Engine
 */

// --- 1. Vector Math Helpers ---
class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
  add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
  sub(v) { return new Vector2(this.x - v.x, this.y - v.y); }
  mult(n) { return new Vector2(this.x * n, this.y * n); }
  div(n) { return n !== 0 ? new Vector2(this.x / n, this.y / n) : new Vector2(); }
  magSq() { return this.x * this.x + this.y * this.y; }
  mag() { return Math.sqrt(this.magSq()); }
  heading() { return Math.atan2(this.y, this.x); }
  normalize() {
    const m = this.mag();
    return m > 0.001 ? this.div(m) : new Vector2();
  }
  distSq(v) {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }
}

// --- 2. Celestial Body Class ---
class CelestialBody {
  constructor(x, y, vx, vy, mass, radius, color, name, isStatic = false, type = 'planet') {
    this.pos = new Vector2(x, y);
    this.vel = new Vector2(vx, vy);
    this.acc = new Vector2(0, 0);
    this.mass = mass;
    this.radius = radius;
    this.color = color;
    this.name = name;
    this.isStatic = isStatic;
    this.type = type; // 'planet', 'star', 'blackhole'
    this.id = Math.random().toString(36).substr(2, 9);
  }

  update(world, dt) {
    if (this.isStatic) {
      this.vel = new Vector2();
      this.acc = new Vector2();
      return;
    }
    
    // Euler Integration
    this.vel = this.vel.add(this.acc.mult(dt));
    this.pos = this.pos.add(this.vel.mult(dt));
    this.acc = new Vector2(); // Reset acceleration
  }

  applyForce(f) {
    // a = F / m
    this.acc = this.acc.add(f.div(this.mass));
  }
}

// --- 3. Probe (Cargo Capsule) Class ---
class Probe {
  constructor(x, y, vx, vy) {
    this.pos = new Vector2(x, y);
    this.vel = new Vector2(vx, vy);
    this.acc = new Vector2(0, 0);
    
    this.radius = 3;
    this.color = '#c084fc'; // Purple Cargo
    this.trail = [];
    this.maxTrail = 180;
    this.isDead = false;
    this.reason = ''; // 'star_crash', 'escape_velocity', 'delivered', 'blackhole_absorbed'
    this.deliveredCount = 0;
    this.id = Math.random().toString(36).substr(2, 9);
  }

  update(bodies, gConstant, width, height, dt) {
    if (this.isDead) return;

    // Apply gravity from all celestial bodies
    for (const body of bodies) {
      const forceVec = body.pos.sub(this.pos);
      const dSq = forceVec.magSq();
      
      // Prevent division by zero / soft gravity inside body
      const dist = Math.sqrt(dSq) || 0.1;
      
      // Collision check
      if (dist < body.radius) {
        this.isDead = true;
        this.reason = body.type === 'blackhole' ? 'blackhole_absorbed' : 'star_crash';
        return;
      }

      // Gravitational force: F = G * m1 * m2 / d^2
      // Probe mass is considered 1.0 (so acceleration = forceVec.normalize * G * body.mass / d^2)
      const forceMag = (gConstant * body.mass) / dSq;
      const accel = forceVec.normalize().mult(forceMag);
      this.acc = this.acc.add(accel);
    }

    // Update motion
    this.vel = this.vel.add(this.acc.mult(dt));
    this.pos = this.pos.add(this.vel.mult(dt));
    this.acc = new Vector2(); // Reset

    // Save trail
    this.trail.push(new Vector2(this.pos.x, this.pos.y));
    if (this.trail.length > this.maxTrail) {
      this.trail.shift();
    }

    // Boundary check (Dead if flies too far off screen)
    const margin = 2000;
    if (this.pos.x < -margin || this.pos.x > width + margin || this.pos.y < -margin || this.pos.y > height + margin) {
      this.isDead = true;
      this.reason = 'escape_velocity';
    }
  }
}

// --- 4. Launchpad and Colony Targets ---
class Launchpad {
  constructor(x, y, radius, color = '#22c55e') {
    this.pos = new Vector2(x, y);
    this.radius = radius;
    this.color = color;
  }
}

class Colony {
  constructor(x, y, radius, orbitRadius = 0, anchorBody = null, color = '#f43f5e') {
    this.pos = new Vector2(x, y);
    this.radius = radius;
    this.orbitRadius = orbitRadius;
    this.anchorBody = anchorBody; // CelestialBody reference
    this.color = color;
    this.angle = 0;
    this.orbitSpeed = 0.005;
  }

  update(dt) {
    if (this.anchorBody) {
      // Orbit around anchor body
      this.angle += this.orbitSpeed * dt;
      this.pos.x = this.anchorBody.pos.x + Math.cos(this.angle) * this.orbitRadius;
      this.pos.y = this.anchorBody.pos.y + Math.sin(this.angle) * this.orbitRadius;
    }
  }
}

// --- 5. Spacetime Curvature Mesh Helper ---
class SpacetimeMesh {
  constructor(width, height, spacing = 50) {
    this.width = width;
    this.height = height;
    this.spacing = spacing;
    
    // Build static grid of nodes
    this.nodes = [];
    for (let x = 0; x <= width; x += spacing) {
      for (let y = 0; y <= height; y += spacing) {
        this.nodes.push(new Vector2(x, y));
      }
    }
  }

  // Calculate grid warp based on celestial bodies
  computeWarp(bodies, gConstant, warpFactor) {
    const warpedNodes = [];
    
    for (const node of this.nodes) {
      let dispX = 0;
      let dispY = 0;

      for (const body of bodies) {
        const dx = body.pos.x - node.x;
        const dy = body.pos.y - node.y;
        const distSq = dx * dx + dy * dy;
        const dist = Math.sqrt(distSq) || 0.1;
        
        // Potential well formula: displacement pulls nodes toward mass
        // Scales inversely with distance. Softened to prevent infinite spikes.
        const softening = 45;
        const gravityEffect = (gConstant * body.mass) / (distSq + softening * softening);
        const pull = gravityEffect * warpFactor * 1.5;

        // Vector towards center
        dispX += (dx / dist) * pull;
        dispY += (dy / dist) * pull;
      }
      
      // Node gets pulled towards the gravity centers
      warpedNodes.push(new Vector2(node.x + dispX, node.y + dispY));
    }
    return warpedNodes;
  }
}

// --- 6. Level Configs & Missions ---
class LevelManager {
  static levels = {
    sandbox: {
      name: "Free Sandbox",
      badge: "SANDBOX FREE-PLAY",
      desc: "Place celestial bodies, resize their masses, and slingshot probes. No constraints.",
      init: (world) => {
        // Clear everything
        world.bodies = [];
        world.probes = [];
        world.launchpad = new Launchpad(250, 450, 15);
        world.colony = new Colony(750, 450, 18, 0, null, '#f43f5e');
        
        // Spawn basic planet in center
        world.bodies.push(new CelestialBody(500, 450, 0, 0, 300, 24, '#3b82f6', 'Planet Prime', true));
      }
    },
    
    orbit: {
      name: "Lunar Insertion",
      badge: "MISSION: INSERTION",
      desc: "Deliver cargo from Earth launcher to the Lunar Base. The probe must pass close to the Moon (Colony) and match its speed to drop off cargo successfully (Distance < 25px, Velocity Relative < 1.8 px/frame).",
      init: (world) => {
        world.bodies = [];
        world.probes = [];
        
        // Earth (Static heavy Star/Body in Center)
        const earth = new CelestialBody(500, 450, 0, 0, 600, 35, '#3b82f6', 'Earth', true, 'planet');
        world.bodies.push(earth);
        
        // Moon orbiting Earth
        const moon = new CelestialBody(500, 150, 1.4, 0, 80, 15, '#9ca3af', 'Moon', false, 'planet');
        world.bodies.push(moon);
        
        // Launchpad on Earth's surface/edge
        world.launchpad = new Launchpad(500, 405, 12);
        
        // Colony is Moon Base (orbits with Moon)
        world.colony = new Colony(500, 150, 14, 25, moon, '#f43f5e');
        world.colony.orbitSpeed = 0.012; // Moon speed sync
      }
    },

    slingshot: {
      name: "Martian Slingshot",
      badge: "MISSION: SLINGSHOT",
      desc: "Target colony is located beyond the path of a moving asteroid belt. Launch probe from Earth, slingshot around Jupiter's massive gravity field to change course and intercept Mars Colony.",
      init: (world) => {
        world.bodies = [];
        world.probes = [];

        // Earth
        world.bodies.push(new CelestialBody(150, 150, 0, 0, 400, 25, '#3b82f6', 'Earth', true));
        world.launchpad = new Launchpad(150, 185, 12);

        // Jupiter (Massive and moving)
        world.bodies.push(new CelestialBody(500, 400, 0, 0.45, 1200, 45, '#eab308', 'Jupiter', false, 'star'));

        // Mars Colony
        world.colony = new Colony(850, 750, 16, 0, null, '#f43f5e');
      }
    },

    binary: {
      name: "Binary Star Dance",
      badge: "MISSION: BINARY STARS",
      desc: "Deliver cargo between a binary star system. Launch a cargo probe to navigate the chaotic gravity fields and reach the Lagrange Station.",
      init: (world) => {
        world.bodies = [];
        world.probes = [];

        // Star A
        const starA = new CelestialBody(380, 450, 0, -1.0, 800, 28, '#f97316', 'Star Sol', false, 'star');
        // Star B
        const starB = new CelestialBody(620, 450, 0, 1.0, 800, 28, '#fbbf24', 'Star Polaris', false, 'star');
        
        world.bodies.push(starA);
        world.bodies.push(starB);

        // Earth Launch pad
        world.launchpad = new Launchpad(120, 450, 14, '#22c55e');

        // Space Colony Station
        world.colony = new Colony(880, 450, 16, 0, null, '#f43f5e');
      }
    },

    blackhole: {
      name: "Event Horizon",
      badge: "MISSION: EVENT HORIZON",
      desc: "A Supermassive Black Hole is centered in space. Launch cargo to the colony on the other side. Spacetime is wrapped infinitely; aim carefully to warp around the horizon without getting swallowed.",
      init: (world) => {
        world.bodies = [];
        world.probes = [];

        // Black Hole in center
        world.bodies.push(new CelestialBody(500, 450, 0, 0, 1800, 22, '#030712', 'Sagittarius A*', true, 'blackhole'));

        // Launch pad
        world.launchpad = new Launchpad(180, 450, 12);
        
        // Outpost Colony
        world.colony = new Colony(820, 450, 15, 0, null, '#f43f5e');
      }
    }
  };
}

// --- 7. Main Gravity World class ---
class GravityWorld {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    
    this.bodies = [];
    this.probes = [];
    this.launchpad = null;
    this.colony = null;
    
    this.gConstant = 1.0;
    this.warpFactor = 1.5;
    this.predictionSteps = 400;
    
    this.mesh = new SpacetimeMesh(width, height, 40);
    this.currentLevelId = 'sandbox';
    
    // Stats
    this.totalLaunches = 0;
    this.cargoDelivered = 0;
  }

  loadLevel(levelId) {
    this.currentLevelId = levelId;
    const level = LevelManager.levels[levelId];
    if (level) {
      level.init(this);
    }
  }

  launchProbe(vx, vy) {
    if (!this.launchpad) return;
    this.probes.push(new Probe(this.launchpad.pos.x, this.launchpad.pos.y, vx, vy));
    this.totalLaunches++;
  }

  update(dt = 1.0) {
    // 1. Resolve Gravity forces between Celestial bodies (N-Body Physics)
    const size = this.bodies.length;
    for (let i = 0; i < size; i++) {
      const b1 = this.bodies[i];
      if (b1.isStatic) continue;

      for (let j = i + 1; j < size; j++) {
        const b2 = this.bodies[j];
        
        const forceVec = b2.pos.sub(b1.pos);
        const dSq = forceVec.magSq() + 100; // soft factor to prevent division by 0
        const dist = Math.sqrt(dSq);
        
        // F = G * m1 * m2 / d^2
        const forceMag = (this.gConstant * b1.mass * b2.mass) / dSq;
        const forceUnit = forceVec.normalize();
        
        // Apply equal and opposite gravitational forces
        b1.applyForce(forceUnit.mult(forceMag));
        b2.applyForce(forceUnit.mult(-forceMag));
      }
    }

    // 2. Update positions of Celestial bodies
    for (const body of this.bodies) {
      body.update(this, dt);
    }

    // 3. Update Colony Orbit
    if (this.colony) {
      this.colony.update(dt);
    }

    // 4. Update active Probes & check Colony Delivery status
    for (let i = this.probes.length - 1; i >= 0; i--) {
      const probe = this.probes[i];
      probe.update(this.bodies, this.gConstant, this.width, this.height, dt);
      
      // Check target intersection
      if (!probe.isDead && this.colony) {
        const distSq = probe.pos.distSq(this.colony.pos);
        const threshold = this.colony.radius + probe.radius + 8;
        
        if (distSq < threshold * threshold) {
          // Check mission specific success condition (speed match)
          let speedMatch = true;
          
          if (this.currentLevelId === 'orbit') {
            // Must have low relative velocity to insert into colony orbit
            const relVelX = probe.vel.x - (this.colony.anchorBody ? this.colony.anchorBody.vel.x : 0);
            const relVelY = probe.vel.y - (this.colony.anchorBody ? this.colony.anchorBody.vel.y : 0);
            const relSpeed = Math.sqrt(relVelX * relVelX + relVelY * relVelY);
            if (relSpeed > 1.8) {
              speedMatch = false;
            }
          }
          
          if (speedMatch) {
            probe.isDead = true;
            probe.reason = 'delivered';
            this.cargoDelivered++;
          }
        }
      }
    }
  }

  // Visual Helper: Simulate Launch trajectory to draw predictor line
  predictTrajectory(vx, vy) {
    if (!this.launchpad) return [];
    
    // Copy positions of celestial bodies to simulate them forward
    const virtualBodies = this.bodies.map(b => {
      return {
        pos: new Vector2(b.pos.x, b.pos.y),
        vel: new Vector2(b.vel.x, b.vel.y),
        mass: b.mass,
        radius: b.radius,
        isStatic: b.isStatic,
        type: b.type
      };
    });

    const path = [];
    const vProbe = {
      pos: new Vector2(this.launchpad.pos.x, this.launchpad.pos.y),
      vel: new Vector2(vx, vy),
      acc: new Vector2()
    };

    const simSteps = this.predictionSteps;
    const simDt = 1.0;

    for (let step = 0; step < simSteps; step++) {
      let isDead = false;

      // N-Body gravity on virtual bodies
      const size = virtualBodies.length;
      for (let i = 0; i < size; i++) {
        const b1 = virtualBodies[i];
        if (b1.isStatic) continue;

        for (let j = i + 1; j < size; j++) {
          const b2 = virtualBodies[j];
          const fVec = b2.pos.sub(b1.pos);
          const dSq = fVec.magSq() + 100;
          const fMag = (this.gConstant * b1.mass * b2.mass) / dSq;
          const accel = fVec.normalize().mult(fMag);
          
          // b1 acceleration
          b1.vel = b1.vel.add(accel.div(b1.mass).mult(simDt));
          // b2 acceleration (opposite)
          b2.vel = b2.vel.add(accel.div(-b2.mass).mult(simDt));
        }
      }

      // Update virtual body positions
      for (const b of virtualBodies) {
        if (!b.isStatic) {
          b.pos = b.pos.add(b.vel.mult(simDt));
        }
      }

      // Gravity on virtual probe
      for (const b of virtualBodies) {
        const fVec = b.pos.sub(vProbe.pos);
        const dSq = fVec.magSq();
        const dist = Math.sqrt(dSq) || 0.1;

        if (dist < b.radius) {
          isDead = true;
          break;
        }

        const forceMag = (this.gConstant * b.mass) / dSq;
        const accel = fVec.normalize().mult(forceMag);
        vProbe.acc = vProbe.acc.add(accel);
      }

      if (isDead) break;

      // Update virtual probe position
      vProbe.vel = vProbe.vel.add(vProbe.acc.mult(simDt));
      vProbe.pos = vProbe.pos.add(vProbe.vel.mult(simDt));
      vProbe.acc = new Vector2();

      path.push(new Vector2(vProbe.pos.x, vProbe.pos.y));

      // Quick boundary check for performance
      if (vProbe.pos.x < -800 || vProbe.pos.x > this.width + 800 || vProbe.pos.y < -800 || vProbe.pos.y > this.height + 800) {
        break;
      }
    }

    return path;
  }
}
