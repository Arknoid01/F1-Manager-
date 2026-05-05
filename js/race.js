// ============================================================
//  F1 Manager — race.js  (v2 — gaps réalistes)
//  Gestion d'état de course : initialisation, simulation tour par tour
// ============================================================

const Race = {

  state: null,

  // ── INITIALISATION ────────────────────────────────────────
  init(circuitId, weather = 'dry') {
    const circuit = F1Data.circuits.find(c => c.id === circuitId);
    if (!circuit) throw new Error('Circuit introuvable : ' + circuitId);

    const grid = [];
    F1Data.drivers.forEach(driver => {
      const team     = F1Data.teams.find(t => t.id === driver.teamId);
      const strategy = Engine.generateStrategy(circuit, team.performance, weather);

      grid.push({
        driver,
        team,
        strategy,
        currentCompoundIndex: 0,
        tyre: { compound: strategy.compounds[0], condition: 1.0, age: 0 },
        fuelLoad: circuit.fuelPerLap * circuit.laps,
        totalTime: 0,
        penaltyTime: 0,
        currentLap: 0,
        lapTimes: [],
        pitStops: [],
        position: 0,
        gap: 0,          // écart en secondes au leader (calculé chaque tour)
        gapLaps: 0,      // écart en tours (doublés)
        status: 'racing',
        pitThisLap: false,
        dnfLap: null,
        currentPace: 0,
      });
    });

    // ── Grille de départ : quali simulée ──────────────────────
    // On calcule un score de qualif (temps sec sur 1 tour rapide)
    grid.forEach(car => {
      const qualiBase  = circuit.baseLapTime;
      const teamBonus  = (85 - car.team.performance) * 0.10;
      const driverBonus= (87 - car.driver.pace) * 0.018;
      // Soft en quali → meilleur grip
      const tyreBonus  = 0; // tout le monde en soft
      const random     = (Math.random() - 0.5) * 0.5; // ±0.25s seulement
      car._qualiTime   = qualiBase + teamBonus + driverBonus + tyreBonus + random;
    });

    grid.sort((a, b) => a._qualiTime - b._qualiTime);
    grid.forEach((car, i) => {
      car.position = i + 1;
      // Décalage de grille en secondes : P1=0, P2=+0.2s, P3=+0.4s…
      // Cela simule les intervalles de départ
      car.totalTime = i * 0.2;
    });

    this.state = {
      circuit,
      weather,
      currentLap: 0,
      totalLaps: circuit.laps,
      grid,
      safetyCar: { active: false, remainingLaps: 0 },
      finished: false,
      events: [],
    };

    return this.state;
  },

  // ── SIMULER UN TOUR ───────────────────────────────────────
  simulateLap() {
    if (!this.state || this.state.finished) return null;

    const s   = this.state;
    const cir = s.circuit; // ← référence correcte au circuit
    s.currentLap++;
    const lap       = s.currentLap;
    const lapEvents = [];

    // ── Météo dynamique ──────────────────────────────────────
    if (s.weather === 'dry' && lap > 5 && Math.random() < 0.018) {
      s.weather = 'light_rain';
      lapEvents.push({ lap, type: 'weather', message: '🌧️ La pluie commence à tomber !' });
    } else if (s.weather === 'light_rain' && Math.random() < 0.025) {
      s.weather = 'heavy_rain';
      s.safetyCar = { active: true, remainingLaps: 5 };
      lapEvents.push({ lap, type: 'weather', message: '⛈️ Forte pluie ! Safety Car déployée.' });
    } else if (s.weather !== 'dry' && lap > 15 && Math.random() < 0.035) {
      s.weather = 'dry';
      lapEvents.push({ lap, type: 'weather', message: '☀️ La piste sèche !' });
    }

    // ── Safety Car ───────────────────────────────────────────
    if (s.safetyCar.active) {
      s.safetyCar.remainingLaps--;
      if (s.safetyCar.remainingLaps <= 0) {
        s.safetyCar.active = false;
        lapEvents.push({ lap, type: 'safety_car_end', message: '🟢 Safety Car rentre aux stands !' });
      }
    }

    // ── Calcul chaque voiture ─────────────────────────────────
    let someoneJustPitted = false;

    s.grid.forEach(car => {
      if (car.status === 'dnf') return;
      car.pitThisLap = false;

      // Incidents
      const incidents = Engine.rollIncidents(car.driver, car.team, lap, s.totalLaps);
      const dnf = incidents.find(i => i.type === 'dnf');
      if (dnf) {
        car.status  = 'dnf';
        car.dnfLap  = lap;
        lapEvents.push({
          lap,
          type: 'dnf',
          message: `❌ ${car.driver.firstName} ${car.driver.name} — Abandon (${dnf.reason === 'crash' ? 'Accident' : 'Problème mécanique'}) Tour ${lap}`,
        });
        return;
      }

      // Pénalités
      const penalty = incidents.find(i => i.type === 'penalty');
      if (penalty) {
        car.penaltyTime += penalty.seconds;
        lapEvents.push({ lap, type: 'penalty', message: `⚠️ ${car.driver.name} — Pénalité +${penalty.seconds}s` });
      }

      // Pit stop
      const pitDecision = Engine.shouldPit(
        car.tyre, lap, s.totalLaps, car.strategy, someoneJustPitted, s.weather
      );

      if (pitDecision.pit && lap < s.totalLaps - 2) {
        car.pitThisLap = true;
        someoneJustPitted = true;

        car.currentCompoundIndex = Math.min(
          car.currentCompoundIndex + 1,
          car.strategy.compounds.length - 1
        );

        let nextCompound = car.strategy.compounds[car.currentCompoundIndex];
        if (s.weather === 'heavy_rain') nextCompound = 'WET';
        else if (s.weather === 'light_rain') nextCompound = 'INTER';
        else if (['INTER', 'WET'].includes(car.tyre.compound)) nextCompound = 'MEDIUM';

        car.pitStops.push({ lap, fromCompound: car.tyre.compound, toCompound: nextCompound, reason: pitDecision.reason });
        car.tyre = { compound: nextCompound, condition: 1.0, age: 0 };

        // ← CORRECTION : utiliser cir.pitLoss et non circuit.pitLoss
        car.totalTime += cir.pitLoss;

        lapEvents.push({
          lap,
          type: 'pit',
          message: `🔧 ${car.driver.name} — Pit stop → ${F1Data.tyres[nextCompound].name}`,
        });
      }

      // Temps au tour
      const fuelLoad = Engine.calcFuelLoad(cir, lap);
      let lapTime    = Engine.calcLapTime(car.driver, car.team, cir, car.tyre, fuelLoad, s.weather, lap);

      // Safety Car : tout le monde roule au même rythme lent
      if (s.safetyCar.active) {
        lapTime = cir.baseLapTime * 1.38 + (Math.random() - 0.5) * 0.4;
      }

      car.currentPace  = lapTime;
      car.totalTime   += lapTime + car.penaltyTime;
      car.penaltyTime  = 0;
      car.lapTimes.push(parseFloat(lapTime.toFixed(3)));
      car.currentLap   = lap;

      if (!car.pitThisLap) {
        car.tyre = Engine.degradeTyre(car.tyre, cir, car.driver, s.weather);
      }
    });

    // Safety Car aléatoire
    const scRoll = Engine.rollSafetyCar(lap, s.totalLaps, []);
    if (scRoll.active && !s.safetyCar.active) {
      s.safetyCar = { active: true, remainingLaps: scRoll.laps };
      lapEvents.push({ lap, type: 'safety_car', message: '🟡 Safety Car déployée !' });
    }

    // Classement
    this.updateStandings();

    // Fin de course
    if (lap >= s.totalLaps) {
      s.finished = true;
      lapEvents.push({ lap, type: 'finish', message: '🏁 Drapeau à damiers !' });
    }

    s.events.push(...lapEvents);
    return { lap, events: lapEvents, standings: this.getStandings() };
  },

  // ── CLASSEMENT ────────────────────────────────────────────
  updateStandings() {
    const racing = this.state.grid.filter(c => c.status === 'racing');
    const dnf    = this.state.grid.filter(c => c.status === 'dnf');

    racing.sort((a, b) => a.totalTime - b.totalTime);

    const leaderTime = racing.length > 0 ? racing[0].totalTime : 0;

    racing.forEach((car, i) => {
      car.position = i + 1;
      // Gap = écart réel en secondes au leader (pas le temps cumulé total)
      car.gap = i === 0 ? 0 : parseFloat((car.totalTime - leaderTime).toFixed(3));
    });

    // DNF : classés derrière, triés par tour d'abandon (le plus loin = mieux classé)
    dnf.sort((a, b) => (b.dnfLap || 0) - (a.dnfLap || 0));
    dnf.forEach((car, i) => {
      car.position = racing.length + i + 1;
      car.gap      = null;
    });
  },

  getStandings() {
    return [...this.state.grid].sort((a, b) => a.position - b.position);
  },

  // ── SIMULATION COMPLÈTE ───────────────────────────────────
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
    const all     = this.getStandings();
    const racing  = all.filter(c => c.status === 'racing');
    const dnf     = all.filter(c => c.status === 'dnf');
    const results = [];

    racing.forEach((car, i) => {
      results.push({
        position: i + 1,
        driver:   car.driver,
        team:     car.team,
        points:   F1Data.pointsSystem[i] || 0,
        totalTime: car.totalTime,
        gap:      car.gap,
        pitStops: car.pitStops,
        bestLap:  car.lapTimes.length > 0 ? Math.min(...car.lapTimes) : null,
        status:   'racing',
      });
    });

    dnf.forEach((car, i) => {
      results.push({
        position: racing.length + i + 1,
        driver:   car.driver,
        team:     car.team,
        points:   0,
        dnfLap:   car.dnfLap,
        pitStops: car.pitStops,
        bestLap:  car.lapTimes.length > 0 ? Math.min(...car.lapTimes) : null,
        status:   'dnf',
      });
    });

    return results;
  },

};
