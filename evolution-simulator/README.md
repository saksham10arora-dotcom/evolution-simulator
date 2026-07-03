# 🧬 A-Life Evolution Simulator

A real-time, browser-based artificial life simulator. Seed a petri dish with simple organisms containing neural networks for brains and genetic codes that mutate over generations. Watch survival strategies, ecosystems, and diverse species emerge from scratch.

---

## 🚀 How to Run

To run the simulator locally, navigate to the project directory and start the Vite dev server:

```bash
cd projects/evolution-simulator
npm run dev
```

This will spin up a development server and automatically open the application in your default browser at `http://localhost:3000`.

---

## 🔬 Simulation Mechanics

### 1. The Genotype & Phenotype
Each organism has physical traits governed by its **Genes**:
* **Diet type (`diet`)**: Ranges from `0.0` (pure Herbivore) to `1.0` (pure Carnivore). Dictates what type of food they digest and their combat strength.
* **Max Speed (`maxSpeed`)**: Speed limit for movement force (`1.5px/frame` to `5.0px/frame`). Higher speeds consume more energy.
* **Size (`size`)**: Radius of the creature (`5px` to `14px`). Larger size means higher maximum energy and combat power, but also increases metabolic cost.
* **Sensory Range (`sensoryRange`)**: Radius of detection (`60px` to `250px`). Larger ranges require more metabolic energy.

### 2. The Neural Brain
Every creature possesses a single-layer feed-forward artificial neural network (11 inputs, 8 hidden neurons, 3 outputs):

#### Inputs:
1. **Bias**: Constant signal (`1.0`).
2. **Energy level**: Current energy / Max energy (`0` to `1`).
3. **Plant Distance**: Distance to the closest green plant (`0` to `1`).
4. **Plant Angle**: Direction of the closest green plant (`-1` to `1`).
5. **Meat Distance**: Distance to the closest red meat particle (`0` to `1`).
6. **Meat Angle**: Direction of the closest red meat particle (`-1` to `1`).
7. **Creature Distance**: Distance to the closest other creature (`0` to `1`).
8. **Creature Angle**: Direction of the closest other creature (`-1` to `1`).
9. **Creature Diet**: Diet value of the closest creature (`0` to `1`, or `-1` if none visible).
10. **Wall Distance**: Distance to boundaries or obstacles (`0` to `1`).
11. **Wall Angle**: Angle to boundaries or obstacles (`-1` to `1`).

#### Outputs:
1. **Steering Torque**: Turning direction (`-1` for full left, `1` for full right).
2. **Throttle**: Acceleration/Force along heading (`-1` to slow down/reverse, `1` to sprint).
3. **Attack**: Attack trigger. If greater than `0`, causes the creature to "bite" nearby targets.

---

## 🎨 God-Mode Sandbox Tools

* **Inspect Tool**: Click on any moving creature to view its live vital logs, physical genes, and **real-time firing neural network** connections.
* **Draw Walls**: Click and drag on the petri dish to construct custom physical obstacles that block movement.
* **Spawn Plants / Drop Meat**: Manually inject plants (herbivore food) or meat (carnivore food) into the ecosystem.
* **Spawn Creature**: Manually inject a randomized ancestor.
* **Unleash Pathogen**: Instantly drain 50% of the energy of all living creatures to test resilience.
* **Trigger Extinction**: Wipe out 90% of the active population.

---

## 🗂 Speciation & Linnaean Names

The simulator uses a **dynamic clustering algorithm** to group organisms into distinct species lineages based on their genetic traits.
* **Speciation Events**: When a child's mutation pushes it past a threshold distance from existing species, a new species is registered.
* **Automated Binomials**: The system generates unique Latin-style binomial names dynamically based on traits (e.g. *Phytophaga velox* for fast plant-eaters, *Carnivora gigas* for giant predators).
* **Lineage Tracking**: Real-time line graphs at the bottom chart active species populations over time, illustrating boom and bust cycles, natural selection, and genetic drift.
