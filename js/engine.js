// ============================================================
//  F1 Manager — engine.js
//  Moteur de simulation : calculs temps au tour, pneus, fuel
// ============================================================

const Engine = {

  // ── CALCUL TEMPS AU TOUR ──────────────────────────────────
  /**
   * Calcule le temps au tour pour un pilote donné
   * @param {Object} driver       - pilote
   * @param {Object} team         - équipe
   * @param {Object} circuit      - circuit
   * @param {Object} tyreState    - { compound, age, condition (0-1) }
   * @param {number} fuelLoad     - kg de carburant restant
   * @param {string} weather      - 'dry' | 'light_rain' | 'heavy_rain'
   * @param {number} lap          - numéro du tour actuel
   * @returns {number}            - temps au tour en secondes
   */
  calcLapTime(driver, team, circuit, tyreState, fuelLoad, weather = 'dry', lap = 1) {
    const tyre = F1Data.tyres[tyreState.compound];

    // 1. Base : temps de référence du circuit
    let lapTime = circuit.baseLapTime;

    // 2. Performance équipe (meilleure équipe = ~3s d'avance sur midfield)
    const teamFactor = (100 - team.performance) * 0.06;
    lapTime += teamFactor;

    // 3. Skill pilote (pace 97 = -0.3s vs pace 80 = +0.5s)
    const driverFactor = (95 - driver.pace) * 0.04;
    lapTime += driverFactor;

    // 4. Pneus — grip de base
    lapTime += (1 - tyre.grip) * 2.5;

    // 5. Dégradation pneus (condition 1=neuf, 0=mort)
    const degradation = (1 - tyreState.condition);
    lapTime += degradation * 4.5 * circuit.tyreDegradation;

    // 6. Phase de chauffe (premiers tours sur pneus neufs)
    if (tyreState.age < tyre.warmupLaps) {
      lapTime += (tyre.warmupLaps - tyreState.age) * 0.4;
    }

    // 7. Cliff pneu : au-delà de 80% dégradation, chute brutale
    if (degradation > 0.80) {
      lapTime += (degradation - 0.80) * 15;
    }

    // 8. Fuel load : chaque kg = ~0.03s (charge max ~110kg)
    lapTime += fuelLoad * 0.032;

    // 9. Météo
    if (weather === 'light_rain') {
      const wetBonus = (driver.wetSkill - 80) * 0.03;
      lapTime += 4.0 - wetBonus;
      // Mauvais pneus sous la pluie = grosse pénalité
      if (tyreState.compound === 'SOFT' || tyreState.compound === 'HARD' || tyreState.compound === 'MEDIUM') {
        lapTime += 8.0;
      }
    } else if (weather === 'heavy_rain') {
      const wetBonus = (driver.wetSkill - 80) * 0.05;
      lapTime += 12.0 - wetBonus;
      if (tyreState.compound !== 'WET') {
        lapTime += 20.0;
      }
    }

    // 10. Variabilité aléatoire (± 0.3s)
    lapTime += (Math.random() - 0.5) * 0.6;

    return Math.max(lapTime, circuit.baseLapTime * 0.98);
  },

  // ── DÉGRADATION PNEUS ─────────────────────────────────────
  /**
   * Met à jour l'état des pneus après un tour
   */
  degradeTyre(tyreState, circuit, driver, weather = 'dry') {
    const tyre = F1Data.tyres[tyreState.compound];
    let rate = tyre.degradationRate * circuit.tyreDegradation;

    // Style de conduite agressif = plus de dégradation
    const aggressionFactor = 1 + (driver.overtaking - 80) * 0.005;
    rate *= aggressionFactor;

    // Pluie réduit la dégradation des slicks (moins de grip = moins de stress)
    if (weather === 'light_rain') rate *= 0.8;
    if (weather === 'heavy_rain') rate *= 0.6;

    // Variabilité ± 20%
    rate *= (0.9 + Math.random() * 0.2);

    tyreState.condition = Math.max(0, tyreState.condition - rate);
    tyreState.age++;

    return tyreState;
  },

  // ── CALCUL FUEL ───────────────────────────────────────────
  calcFuelLoad(circuit, lap) {
    const totalFuel = circuit.fuelPerLap * circuit.laps;
    const consumed = circuit.fuelPerLap * (lap - 1);
    return Math.max(0, totalFuel - consumed);
  },

  // ── STRATÉGIE PNEUS ───────────────────────────────────────
  /**
   * Détermine si un pilote devrait pitter ce tour
   */
  shouldPit(tyreState, lap, totalLaps, strategy, hasOtherPitted = false, weather = 'dry') {
    // Pneu mort = pit obligatoire
    if (tyreState.condition < 0.10) return { pit: true, reason: 'tyre_dead' };

    // Pluie qui arrive = pit pour inter/wet
    if (weather === 'light_rain' && !['INTER', 'WET'].includes(tyreState.compound)) {
      return { pit: true, reason: 'weather_change' };
    }

    // Stratégie prévue
    if (strategy && strategy.pitLaps) {
      for (const pitLap of strategy.pitLaps) {
        if (lap >= pitLap - 1 && lap <= pitLap + 3) {
          // Undercut : si quelqu'un vient de pitter, on anticipe
          if (hasOtherPitted && lap >= pitLap - 3) {
            return { pit: true, reason: 'undercut' };
          }
          if (lap === pitLap) return { pit: true, reason: 'planned' };
        }
      }
    }

    // Dernier stint : pas de pit dans les 5 derniers tours
    if (lap > totalLaps - 5) return { pit: false };

    return { pit: false };
  },

  // ── GÉNÉRATION STRATÉGIE ──────────────────────────────────
  /**
   * Génère une stratégie de course (composés + tours de pit)
   */
  generateStrategy(circuit, teamPerformance, weather = 'dry') {
    if (weather === 'heavy_rain') {
      return { compounds: ['WET'], pitLaps: [] };
    }

    // Nombre d'arrêts selon dégradation et longueur de course
    const raceLength = circuit.laps;
    const degradation = circuit.tyreDegradation;

    let stops = 1;
    if (degradation > 1.3 || raceLength > 60) stops = 2;
    if (degradation > 1.5) stops = 3;

    // Top équipes peuvent faire des stratégies plus agressives
    if (teamPerformance > 85 && Math.random() > 0.6) stops = Math.max(stops - 1, 1);

    const strategies = {
      1: [
        { compounds: ['MEDIUM', 'HARD'],  pitLaps: [Math.round(raceLength * 0.45)] },
        { compounds: ['SOFT',   'HARD'],  pitLaps: [Math.round(raceLength * 0.35)] },
        { compounds: ['HARD',   'MEDIUM'], pitLaps: [Math.round(raceLength * 0.55)] },
      ],
      2: [
        { compounds: ['SOFT', 'MEDIUM', 'HARD'],  pitLaps: [Math.round(raceLength * 0.28), Math.round(raceLength * 0.58)] },
        { compounds: ['SOFT', 'HARD',   'MEDIUM'], pitLaps: [Math.round(raceLength * 0.25), Math.round(raceLength * 0.60)] },
        { compounds: ['MEDIUM', 'SOFT', 'HARD'],  pitLaps: [Math.round(raceLength * 0.35), Math.round(raceLength * 0.62)] },
      ],
      3: [
        { compounds: ['SOFT', 'SOFT', 'MEDIUM', 'HARD'], pitLaps: [Math.round(raceLength * 0.20), Math.round(raceLength * 0.42), Math.round(raceLength * 0.65)] },
      ],
    };

    const pool = strategies[stops] || strategies[1];
    return pool[Math.floor(Math.random() * pool.length)];
  },

  // ── INCIDENTS ─────────────────────────────────────────────
  /**
   * Calcule les incidents possibles ce tour
   */
  rollIncidents(driver, team, lap, totalLaps) {
    const events = [];

    // Abandon mécanique (plus probable en début/fin de course)
    const reliabilityFactor = (100 - team.reliability) / 100;
    if (Math.random() < reliabilityFactor * 0.003) {
      events.push({ type: 'dnf', reason: 'mechanical' });
    }

    // Crash (plus probable en début de course + duel)
    const crashChance = 0.0008 * (lap < 5 ? 3 : 1);
    if (Math.random() < crashChance) {
      events.push({ type: 'dnf', reason: 'crash' });
    }

    // Pénalité temps
    if (Math.random() < 0.002) {
      events.push({ type: 'penalty', seconds: Math.random() > 0.5 ? 5 : 10 });
    }

    return events;
  },

  // ── SAFETY CAR ────────────────────────────────────────────
  rollSafetyCar(lap, totalLaps, incidents) {
    const hasCrash = incidents.some(i => i.type === 'dnf' && i.reason === 'crash');
    if (hasCrash) return { active: true, laps: 4 + Math.floor(Math.random() * 3) };
    if (Math.random() < 0.015) return { active: true, laps: 3 + Math.floor(Math.random() * 2) };
    return { active: false };
  },

  // ── DÉPASSEMENT ───────────────────────────────────────────
  /**
   * Simule si une voiture plus rapide peut dépasser
   */
  attemptOvertake(attacker, defender, circuit, attackerTyre, defenderTyre) {
    const speedDiff = attacker.currentPace - defender.currentPace;
    if (speedDiff <= 0) return false;

    const baseChance = speedDiff * 0.15;
    const circuitFactor = 1 - circuit.overtakingDifficulty;
    const defenderSkill = defender.driver.defending / 100;
    const attackerSkill = attacker.driver.overtaking / 100;

    const chance = baseChance * circuitFactor * (0.5 + attackerSkill * 0.5) * (1 - defenderSkill * 0.3);
    return Math.random() < Math.max(0, Math.min(chance, 0.85));
  },

};
