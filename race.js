// ============================================================
//  F1 Manager — race.js
//  Gestion d'état de course : initialisation, simulation tour par tour
// ============================================================

const Race = {

  state: null,

  // ── INITIALISATION ────────────────────────────────────────
  init(circuitId, weather = 'dry') {
    const circuit = F1Data.circuits.find(c => c.id === circuitId);
    if (!circuit) throw new Error('Circuit introuvable: ' + circuitId);

    // Construction de la grille
    const grid = [];
    F1Data.drivers.forEach(driver => {
      const team = F1Data.teams.find(t => t.id === driver.teamId);
      const strategy = Engine.generateStrategy(circuit, team.performance, weather);
      const firstCompound = strategy.compounds[0];

      grid.push({
        driver,
        team,
        strategy,
        currentCompoundIndex: 0,
        tyre: {
          compound: firstCompound,
          condition: 1.0,
          age: 0,
        },
        fuelLoad: circuit.fuelPerLap * circuit.laps,
        totalTime: 0,
        penaltyTime: 0,
        currentLap: 0,
        lapTimes: [],
        pitStops: [],
        position: 0,
        gap: 0,
        status: 'racing', // 'racing' | 'dnf' | 'pit'
        inPit: false,
        pitThisLap: false,
        dnfLap: null,
        currentPace: 0,
        safetyCarDelta: 0,
      });
    });

    // Grille de départ : tri par performance équipe + pilote + aléatoire
    grid.sort((a, b) => {
      const scoreA = a.team.performance * 0.6 + a.driver.pace * 0.4 + (Math.random() - 0.5) * 8;
      const scoreB = b.team.performance * 0.6 + b.driver.pace * 0.4 + (Math.random() - 0.5) * 8;
      return scoreB - scoreA;
    });

    grid.forEach((car, i) => car.position = i + 1);

    this.state = {
      circuit,
      weather,
      currentLap: 0,
      totalLaps: circuit.laps,
      grid,
      safetyCar: { active: false, remainingLaps: 0 },
      finished: false,
      raceTime: 0,
      events: [], // log des événements importants
    };

    return this.state;
  },

  // ── SIMULER UN TOUR ───────────────────────────────────────
  simulateLap() {
    if (!this.state || this.state.finished) return null;

    const s = this.state;
    s.currentLap++;
    const lap = s.currentLap;
    const lapEvents = [];

    // --- Météo dynamique ---
    if (Math.random() < 0.02 && s.weather === 'dry' && lap > 5) {
      s.weather = 'light_rain';
      lapEvents.push({ lap, type: 'weather', message: '🌧️ La pluie commence à tomber !' });
    } else if (s.weather === 'light_rain' && Math.random() < 0.03) {
      s.weather = 'heavy_rain';
      lapEvents.push({ lap, type: 'weather', message: '⛈️ Forte pluie ! Safety Car déployée.' });
      s.safetyCar = { active: true, remainingLaps: 5 };
    } else if (s.weather !== 'dry' && Math.random() < 0.04 && lap > 15) {
      s.weather = 'dry';
      lapEvents.push({ lap, type: 'weather', message: '☀️ La piste sèche !' });
    }

    // --- Safety Car ---
    if (s.safetyCar.active) {
      s.safetyCar.remainingLaps--;
      if (s.safetyCar.remainingLaps <= 0) {
        s.safetyCar.active = false;
        lapEvents.push({ lap, type: 'safety_car_end', message: '🟢 Safety Car rentre aux stands !' });
      }
    }

    // --- Calcul de chaque voiture ---
    let someoneJustPitted = false;

    s.grid.forEach(car => {
      if (car.status === 'dnf') return;

      car.pitThisLap = false;

      // Incidents
      const incidents = Engine.rollIncidents(car.driver, car.team, lap, s.totalLaps);
      const dnf = incidents.find(i => i.type === 'dnf');
      if (dnf) {
        car.status = 'dnf';
        car.dnfLap = lap;
        lapEvents.push({
          lap,
          type: 'dnf',
          message: `❌ ${car.driver.firstName} ${car.driver.name} abandon (${dnf.reason === 'crash' ? 'accident' : 'problème mécanique'}) — Tour ${lap}`,
        });
        return;
      }

      // Pénalités
      const penalty = incidents.find(i => i.type === 'penalty');
      if (penalty) {
        car.penaltyTime += penalty.seconds;
        lapEvents.push({
          lap,
          type: 'penalty',
          message: `⚠️ ${car.driver.name} — Pénalité ${penalty.seconds}s`,
        });
      }

      // Décision pit stop
      const pitDecision = Engine.shouldPit(
        car.tyre,
        lap,
        s.totalLaps,
        car.strategy,
        someoneJustPitted,
        s.weather
      );

      if (pitDecision.pit && lap < s.totalLaps - 2) {
        // PIT STOP
        car.pitThisLap = true;
        car.inPit = true;
        someoneJustPitted = true;

        // Prochain composé
        car.currentCompoundIndex = Math.min(
          car.currentCompoundIndex + 1,
          car.strategy.compounds.length - 1
        );

        // Adaptations météo : si pluie → inter/wet, si sec → slicks
        let nextCompound = car.strategy.compounds[car.currentCompoundIndex];
        if (s.weather === 'light_rain' || s.weather === 'heavy_rain') {
          nextCompound = s.weather === 'heavy_rain' ? 'WET' : 'INTER';
        } else if (['INTER', 'WET'].includes(car.tyre.compound) && s.weather === 'dry') {
          nextCompound = 'MEDIUM';
        }

        car.pitStops.push({
          lap,
          fromCompound: car.tyre.compound,
          toCompound: nextCompound,
          reason: pitDecision.reason,
        });

        car.tyre = { compound: nextCompound, condition: 1.0, age: 0 };
        car.totalTime += circuit.pitLoss; // temps perdu au stand

        lapEvents.push({
          lap,
          type: 'pit',
          message: `🔧 ${car.driver.name} — Pit stop → ${F1Data.tyres[nextCompound].name}`,
          teamColor: car.team.color,
        });
      }

      // Temps au tour
      const fuelLoad = Engine.calcFuelLoad(s.circuit, lap);
      let lapTime = Engine.calcLapTime(
        car.driver,
        car.team,
        s.circuit,
        car.tyre,
        fuelLoad,
        s.weather,
        lap
      );

      // Safety Car : tous les tours sont plus lents
      if (s.safetyCar.active) {
        lapTime = s.circuit.baseLapTime * 1.35 + (Math.random() * 0.5);
      }

      car.currentPace = lapTime;
      car.totalTime += lapTime + car.penaltyTime;
      car.penaltyTime = 0;
      car.lapTimes.push(parseFloat(lapTime.toFixed(3)));
      car.currentLap = lap;

      // Dégradation pneus
      if (!car.pitThisLap) {
        car.tyre = Engine.degradeTyre(car.tyre, s.circuit, car.driver, s.weather);
      }
    });

    // --- Safety Car aléatoire ---
    const scRoll = Engine.rollSafetyCar(lap, s.totalLaps, []);
    if (scRoll.active && !s.safetyCar.active) {
      s.safetyCar = { active: true, remainingLaps: scRoll.laps };
      lapEvents.push({ lap, type: 'safety_car', message: '🟡 Safety Car déployée !' });
    }

    // --- Classement ---
    this.updateStandings();

    // --- Fin de course ---
    if (lap >= s.totalLaps) {
      s.finished = true;
      lapEvents.push({ lap, type: 'finish', message: '🏁 Drapeau à damiers !' });
    }

    // Stockage des events
    s.events.push(...lapEvents);

    return { lap, events: lapEvents, standings: this.getStandings() };
  },

  // ── CLASSEMENT ────────────────────────────────────────────
  updateStandings() {
    const racing = this.state.grid.filter(c => c.status === 'racing');
    const dnf    = this.state.grid.filter(c => c.status === 'dnf');

    racing.sort((a, b) => a.totalTime - b.totalTime);
    racing.forEach((car, i) => {
      car.position = i + 1;
      car.gap = i === 0 ? 0 : car.totalTime - racing[0].totalTime;
    });

    dnf.forEach((car, i) => {
      car.position = racing.length + i + 1;
    });
  },

  getStandings() {
    return [...this.state.grid].sort((a, b) => a.position - b.position);
  },

  // ── SIMULATION COMPLÈTE (fast) ────────────────────────────
  simulateAll(onLapComplete = null) {
    if (!this.state) return null;
    const results = [];
    while (!this.state.finished) {
      const lapResult = this.simulateLap();
      results.push(lapResult);
      if (onLapComplete) onLapComplete(lapResult, this.state);
    }
    return results;
  },

  // ── POINTS ────────────────────────────────────────────────
  assignPoints() {
    const standings = this.getStandings().filter(c => c.status === 'racing');
    const results = [];
    standings.forEach((car, i) => {
      const pts = F1Data.pointsSystem[i] || 0;
      results.push({
        position: i + 1,
        driver: car.driver,
        team: car.team,
        points: pts,
        totalTime: car.totalTime,
        pitStops: car.pitStops,
        bestLap: Math.min(...car.lapTimes),
      });
    });
    // DNF = 0 points
    this.state.grid.filter(c => c.status === 'dnf').forEach(car => {
      results.push({
        position: car.position,
        driver: car.driver,
        team: car.team,
        points: 0,
        dnfLap: car.dnfLap,
        pitStops: car.pitStops,
        bestLap: car.lapTimes.length > 0 ? Math.min(...car.lapTimes) : null,
      });
    });
    return results;
  },

};

// Référence locale au circuit dans simulateLap
const circuit = null; // sera résolu via this.state.circuit
