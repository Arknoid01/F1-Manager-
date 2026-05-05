// ============================================================
//  F1 Manager — race.js  (v3 — écarts réalistes)
//
//  LOGIQUE DES GAPS :
//  totalTime = temps cumulé réel depuis le départ (en secondes)
//  gap = totalTime(car) - totalTime(leader) = écart réel en secondes
//  Exemple réaliste : P1 finit en ~5400s, P20 en ~5440s → gap = 40s ✓
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
        tyre:        { compound: strategy.compounds[0], condition: 1.0, age: 0 },
        totalTime:   0,
        penaltyTime: 0,
        currentLap:  0,
        lapTimes:    [],
        pitStops:    [],
        position:    0,
        gap:         0,
        status:      'racing',
        pitThisLap:  false,
        dnfLap:      null,
        currentPace: 0,
      });
    });

    // ── Qualification simulée ─────────────────────────────────
    // Calcul d'un temps de quali pour chaque voiture (1 tour rapide en soft)
    // L'écart en quali est plus grand qu'en course (pas de fuel, pneus neufs)
    grid.forEach(car => {
      const teamDelta   = (85 - car.team.performance) * 0.032; // un peu plus marqué en quali
      const driverDelta = (87 - car.driver.pace)      * 0.013;
      const random      = (Math.random() - 0.5) * 0.40;       // ±0.20s
      car._qualiTime    = circuit.baseLapTime + teamDelta + driverDelta + random;
    });

    // Trier par temps de quali (meilleur devant)
    grid.sort((a, b) => a._qualiTime - b._qualiTime);

    // Assigner positions et décalage de départ
    // En F1 le départ est en rang, pas de vrai décalage temporel —
    // on met juste 0.3s entre chaque voiture pour simuler l'effet de trafic initial
    grid.forEach((car, i) => {
      car.position  = i + 1;
      car.totalTime = i * 0.3; // P1=0s, P2=+0.3s, ..., P20=+5.7s au départ
    });

    this.state = {
      circuit,
      weather,
      currentLap: 0,
      totalLaps:  circuit.laps,
      grid,
      safetyCar:  { active: false, remainingLaps: 0 },
      finished:   false,
      events:     [],
    };

    return this.state;
  },

  // ── SIMULER UN TOUR ───────────────────────────────────────
  simulateLap() {
    if (!this.state || this.state.finished) return null;

    const s   = this.state;
    const cir = s.circuit;
    s.currentLap++;
    const lap       = s.currentLap;
    const lapEvents = [];

    // ── Météo dynamique ───────────────────────────────────────
    if (s.weather === 'dry' && lap > 5 && Math.random() < 0.016) {
      s.weather = 'light_rain';
      lapEvents.push({ lap, type: 'weather', message: '🌧️ La pluie commence à tomber !' });
    } else if (s.weather === 'light_rain' && Math.random() < 0.022) {
      s.weather = 'heavy_rain';
      s.safetyCar = { active: true, remainingLaps: 5 };
      lapEvents.push({ lap, type: 'weather', message: '⛈️ Forte pluie ! Safety Car déployée.' });
    } else if (s.weather !== 'dry' && lap > 15 && Math.random() < 0.030) {
      s.weather = 'dry';
      lapEvents.push({ lap, type: 'weather', message: '☀️ La piste sèche !' });
    }

    // ── Safety Car ────────────────────────────────────────────
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
        car.status = 'dnf';
        car.dnfLap = lap;
        lapEvents.push({
          lap,
          type:    'dnf',
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

      // ── Pit stop ─────────────────────────────────────────────
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
        if (s.weather === 'heavy_rain')      nextCompound = 'WET';
        else if (s.weather === 'light_rain') nextCompound = 'INTER';
        else if (['INTER', 'WET'].includes(car.tyre.compound)) nextCompound = 'MEDIUM';

        car.pitStops.push({
          lap,
          fromCompound: car.tyre.compound,
          toCompound:   nextCompound,
          reason:       pitDecision.reason,
        });

        car.tyre = { compound: nextCompound, condition: 1.0, age: 0 };
        car.totalTime += cir.pitLoss; // ← correction : cir et non circuit

        lapEvents.push({
          lap,
          type:    'pit',
          message: `🔧 ${car.driver.name} — Pit stop → ${F1Data.tyres[nextCompound].name}`,
        });
      }

      // ── Temps au tour ─────────────────────────────────────────
      const fuelLoad = Engine.calcFuelLoad(cir, lap);
      let lapTime    = Engine.calcLapTime(
        car.driver, car.team, cir, car.tyre, fuelLoad, s.weather, lap
      );

      // Safety Car : tout le monde à ~135% du temps de base
      if (s.safetyCar.active) {
        lapTime = cir.baseLapTime * 1.38 + (Math.random() - 0.5) * 0.3;
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

    // Trier par temps total cumulé (le moins = en tête)
    racing.sort((a, b) => a.totalTime - b.totalTime);

    const leaderTime = racing.length > 0 ? racing[0].totalTime : 0;

    racing.forEach((car, i) => {
      car.position = i + 1;
      // Gap = différence de temps réelle avec le leader
      // Exemple : leader=5400s, P2=5412s → gap=12s ✓
      car.gap = i === 0 ? 0 : parseFloat((car.totalTime - leaderTime).toFixed(3));
    });

    // DNF triés par tour d'abandon (plus loin = mieux classé)
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
    while (!this.state.finished) {
      const result = this.simulateLap();
      if (onLapComplete) onLapComplete(result, this.state);
    }
    return this.getStandings();
  },

  // ── POINTS ────────────────────────────────────────────────
  assignPoints() {
    const all    = this.getStandings();
    const racing = all.filter(c => c.status === 'racing');
    const dnf    = all.filter(c => c.status === 'dnf');
    const results = [];

    racing.forEach((car, i) => {
      results.push({
        position:  i + 1,
        driver:    car.driver,
        team:      car.team,
        points:    F1Data.pointsSystem[i] || 0,
        totalTime: car.totalTime,
        gap:       car.gap,
        pitStops:  car.pitStops,
        bestLap:   car.lapTimes.length > 0 ? Math.min(...car.lapTimes) : null,
        status:    'racing',
      });
    });

    dnf.sort((a, b) => (b.dnfLap || 0) - (a.dnfLap || 0));
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
