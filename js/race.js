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

  // ── APPLIQUER LES AMÉLIORATIONS JOUEUR ───────────────────
  getEffectiveTeam(team) {
    const effective = { ...team };
    try {
      const save = (typeof Save !== 'undefined' && Save.load) ? Save.load() : null;
      if (save && save.playerTeamId === team.id && save.carDev) {
        ['aero', 'chassis', 'engine', 'reliability'].forEach(stat => {
          if (save.carDev[stat] && Number.isFinite(save.carDev[stat].level)) {
            effective[stat] = Math.max(1, Math.min(100, save.carDev[stat].level));
          }
        });
        effective.performance = Math.round((effective.aero + effective.chassis + effective.engine) / 3);
      }
    } catch (e) {
      console.warn('[Race] Impossible d’appliquer le développement joueur', e);
    }
    return effective;
  },

  // ── INITIALISATION ────────────────────────────────────────
  init(circuitId, weather = 'dry', playerStrategies = {}) {
    const circuit = F1Data.circuits.find(c => c.id === circuitId);
    if (!circuit) throw new Error('Circuit introuvable : ' + circuitId);

    try { if (typeof CareerEvents !== 'undefined') { const save = Save.load(); CareerEvents.applyAiDevelopment(save); } } catch(e) {}

    const grid = [];

    const activeDrivers = F1Data.drivers.filter(d => d.teamId && !d.retired);
    activeDrivers.forEach((baseDriver, driverIndex) => {
      const driver = (typeof CareerEvents !== 'undefined') ? CareerEvents.effectiveDriver(baseDriver) : baseDriver;
      const baseTeam = F1Data.teams.find(t => t.id === driver.teamId);
      if (!baseTeam) return;
      const team     = this.getEffectiveTeam(baseTeam);
      let strategy = Engine.generateStrategy(circuit, team.performance, weather, driver.trait, driverIndex + 1);
      if (playerStrategies && playerStrategies[driver.id]) {
        strategy = Engine.normalizeStrategy(playerStrategies[driver.id], circuit, weather);
      }

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
        orderMode: 'normal',
        forcePit: false,
        requestedCompound: null,
        autoPitWeather: true,
        autoPitSafetyCar: true,
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
      playerTeamId: (typeof Save !== 'undefined' && Save.load && Save.load()) ? Save.load().playerTeamId : null,
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

    // ── Météo — synchronisée avec l'humidité (weather.js) ────
    // currentHumidity est mis à jour dans race.html avant simulateLap()
    if (typeof currentHumidity !== 'undefined') {
      const prevWeather = s.weather;
      if      (currentHumidity > 70) s.weather = 'heavy_rain';
      else if (currentHumidity >= 30) s.weather = 'light_rain';
      else                            s.weather = 'dry';

      if (prevWeather !== s.weather) {
        if (s.weather === 'heavy_rain')
          lapEvents.push({ lap, type:'weather', message:'⛈️ Forte pluie ! Safety Car déployée.' });
        else if (s.weather === 'light_rain')
          lapEvents.push({ lap, type:'weather', message:'🌧️ La pluie commence à tomber !' });
        else
          lapEvents.push({ lap, type:'weather', message:'☀️ La piste sèche !' });
      }
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
      const isPlayerCar  = car.driver.teamId?.toLowerCase() === (s.playerTeamId||'').toLowerCase();
      const maxPits      = (car.strategy?.compounds?.length || 2) - 1;
      const pitsDone     = car.pitStops?.length || 0;

      let pitDecision = Engine.shouldPit(
        car.tyre, lap, s.totalLaps, car.strategy, someoneJustPitted, s.weather, s.safetyCar.active
      );

      // Pour le joueur : respecter strictement le nombre d'arrêts prévu
      // sauf urgence absolue (pneus < 8%) ou changement météo
      if (isPlayerCar && pitsDone >= maxPits && pitDecision.pit) {
        if (pitDecision.reason !== 'weather_change' && car.tyre.condition > 0.08) {
          pitDecision = { pit: false }; // bloquer le pit non prévu
        }
      }

      if (car.forcePit) pitDecision = { pit: true, reason: 'team_order' };
      if (car.autoPitSafetyCar && s.safetyCar.active && !pitDecision.pit && car.strategy?.pitLaps?.some(pl => Math.abs(pl - lap) <= 4)) {
        pitDecision = { pit: true, reason: 'safety_car_opportunity' };
      }

      if (pitDecision.pit && lap < s.totalLaps - 2) {
        car.pitThisLap = true;
        someoneJustPitted = true;

        car.currentCompoundIndex = Math.min(
          car.currentCompoundIndex + 1,
          car.strategy.compounds.length - 1
        );

        let nextCompound = car.requestedCompound || car.strategy.compounds[car.currentCompoundIndex];

        // Choix du pneu météo seulement lors d'un vrai changement météo.
        // Les arrêts planifiés gardent le composé demandé dans la stratégie (ex: Medium → Hard).
        if (!car.requestedCompound && pitDecision.reason === 'weather_change') {
          const hum = typeof currentHumidity !== 'undefined' ? currentHumidity : 0;
          if      (hum >= 70) nextCompound = 'WET';
          else if (hum >= 30) nextCompound = 'INTER';
          else                nextCompound = 'MEDIUM';
        }

        car.pitStops.push({
          lap,
          fromCompound: car.tyre.compound,
          toCompound:   nextCompound,
          reason:       pitDecision.reason,
        });

        car.tyre = { compound: nextCompound, condition: 1.0, age: 0 };
        car.forcePit = false;
        car.requestedCompound = null;

        // ── Calcul du temps pit réaliste ─────────────────────
        // pitLoss = temps total incluant pit lane traversée
        // Le temps mécanique (changement pneus) est ~2.5s min
        // La pit lane traversée est incompressible (~15-22s selon circuit)
        // Total minimum réaliste : ~17-22s

        const basePitLoss   = cir.pitLoss; // déjà calibré par circuit
        const minPitTime    = basePitLoss - 4.0; // max 4s de gain possible (staff élite)
        let pitTime         = basePitLoss;

        // Bonus staff pit stop (depuis save.staffBonuses)
        try {
          const sv = Save.load();
          const sb = sv?.staffBonuses;

          // Staff bonus : plafonné à -3s max (réaliste)
          if (sb?.pitLossReduction) {
            pitTime -= Math.min(3.0, sb.pitLossReduction);
          }

          // Bonus carDev pitstop : plafonné à -1s max
          const pitDev = sv?.carDev?.pitstop;
          if (pitDev?.upgrades) {
            pitTime -= Math.min(1.0, pitDev.upgrades * 0.4);
          }

          // Jamais en dessous du minimum réaliste
          pitTime = Math.max(minPitTime, pitTime);

          // ── Arrêt raté ──────────────────────────────────────
          const pitLevel    = pitDev?.level || 50;
          const staffBonus  = sb?.pitstop   || 0;
          const effectiveLvl= Math.min(100, pitLevel + staffBonus);
          const missChance  = Math.max(0.01, 0.15 - effectiveLvl * 0.0014);

          if (Math.random() < missChance) {
            const severity = Math.random();
            const penalty  = severity > 0.8 ? 10 + Math.random() * 5
                           : severity > 0.5 ? 4  + Math.random() * 4
                           :                  2  + Math.random() * 2;
            pitTime += penalty;
            lapEvents.push({
              lap,
              type: 'pit',
              message: `⚠️ ${car.driver.name} — Arrêt raté ! (+${penalty.toFixed(1)}s)`,
            });
          }
        } catch(e) { /* ignore */ }

        car.totalTime += pitTime;

        // Supprimer les pitLaps proches pour éviter un double arrêt
        if (car.strategy?.pitLaps) {
          car.strategy.pitLaps = car.strategy.pitLaps.filter(pl => pl > lap + 5);
        }

        lapEvents.push({
          lap,
          type:    'pit',
          message: `🔧 ${car.driver.name} — Pit stop → ${F1Data.tyres[nextCompound].name}${pitDecision.reason === 'safety_car_opportunity' ? ' sous Safety Car' : ''}`,
        });
      }

      // ── Temps au tour ─────────────────────────────────────────
      // Pas de fuel load — en F1 moderne c'est calculé avant la course
      let lapTime = Engine.calcLapTime(
        car.driver, car.team, cir, car.tyre, 0, s.weather, lap, car.orderMode || 'normal'
      );

      // Safety Car : tout le monde roule au même rythme lent
      if (s.safetyCar.active) {
        lapTime = cir.baseLapTime * 1.38 + (Math.random() - 0.5) * 0.3;
      }

      car.currentPace  = lapTime;
      car.totalTime   += lapTime + car.penaltyTime;
      car.penaltyTime  = 0;
      car.lapTimes.push(parseFloat(lapTime.toFixed(3)));
      car.currentLap   = lap;

      if (!car.pitThisLap) {
        car.tyre = Engine.degradeTyre(car.tyre, cir, car.driver, s.weather, car.orderMode || 'normal');
      }
    });

    // ── Safety Car : regroupement ─────────────────────────────
    // Réduit progressivement les écarts — les voitures se rassemblent
    // derrière la SC. Chaque tour sous SC réduit l'écart de ~40%
    if (s.safetyCar.active) {
      const racing = s.grid
        .filter(c => c.status === 'racing')
        .sort((a, b) => a.totalTime - b.totalTime);

      if (racing.length > 1) {
        const leaderTime = racing[0].totalTime;

        racing.forEach((car, scIdx) => {
          if (scIdx === 0) return; // le leader garde son temps
          const currentGap = car.totalTime - leaderTime;
          if (currentGap <= 0) return;

          // Réduire l'écart de 35% par tour de SC (en ~3 tours tout le monde est regroupé)
          // Mais garder un écart minimum de 0.3s entre voitures (file indienne)
          const minGap     = scIdx * 0.3;
          const targetGap  = Math.max(minGap, currentGap * 0.65);
          car.totalTime    = leaderTime + targetGap;
        });
      }
    }

    // ── Dépassements actifs ───────────────────────────────────
    if (!s.safetyCar.active) {
      const racing = s.grid
        .filter(c => c.status === 'racing')
        .sort((a, b) => a.totalTime - b.totalTime);

      // Bonus DRS : plus de zones = dépassements plus faciles
      const drsBonus = Math.min(0.25, (cir.drsZones || 1) * 0.08);

      for (let i = 1; i < racing.length; i++) {
        const attacker = racing[i];
        const defender = racing[i - 1];

        // Écart en temps — le dépassement n'est possible que si proche
        const gap = attacker.totalTime - defender.totalTime;
        if (gap > 1.2) continue; // trop loin, pas de bataille

        // Tentative de dépassement via engine.js
        // On passe un circuit modifié avec le bonus DRS
        const circuitWithDRS = { ...cir, overtakingDifficulty: Math.max(0.05, cir.overtakingDifficulty - drsBonus) };
        const overtook = Engine.attemptOvertake(attacker, defender, circuitWithDRS);

        if (overtook) {
          // Échanger les temps pour refléter le dépassement
          // Penalty de temps pour le défenseur (résistance perdue)
          const timePenalty = 0.3 + Math.random() * 0.4;
          defender.totalTime += timePenalty;
          attacker.totalTime -= timePenalty * 0.3;

          lapEvents.push({
            lap,
            type: 'overtake',
            message: `🏎️ ${attacker.driver.name} dépasse ${defender.driver.name}${cir.overtakingDifficulty > 0.7 ? ' — dépassement exceptionnel !' : ''}`,
          });
        }
      }
    }

    // Safety Car aléatoire
    const scRoll = Engine.rollSafetyCar(lap, s.totalLaps, []);
    if (scRoll.active && !s.safetyCar.active) {
      s.safetyCar = { active: true, remainingLaps: 3 + Math.floor(Math.random() * 2) }; // 3-4 tours
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


  // ── ORDRES MANUELS ÉQUIPE JOUEUR ─────────────────────────
  setDriverMode(driverId, mode) {
    if (!this.state) return false;
    const car = this.state.grid.find(c => c.driver.id === driverId);
    if (!car || car.status !== 'racing') return false;
    car.orderMode = ['attack','normal','save'].includes(mode) ? mode : 'normal';
    this.state.events.push({ lap: this.state.currentLap, type: 'team_order', message: `📻 ${car.driver.name} reçoit l'ordre : ${car.orderMode === 'attack' ? 'attaque' : car.orderMode === 'save' ? 'économie pneus' : 'rythme normal'}` });
    return true;
  },

  forcePitStop(driverId, compound = 'MEDIUM') {
    if (!this.state) return false;
    const car = this.state.grid.find(c => c.driver.id === driverId);
    if (!car || car.status !== 'racing') return false;
    car.forcePit = true;
    car.requestedCompound = compound;
    this.state.events.push({ lap: this.state.currentLap, type: 'team_order', message: `📻 ${car.driver.name} appelé aux stands pour ${F1Data.tyres[compound]?.name || compound}` });
    return true;
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
