// ============================================================
//  F1 Manager — engine.js  (v2 — gaps réalistes)
//  Moteur de simulation : calculs temps au tour, pneus, fuel
// ============================================================

const Engine = {

  // ── CALCUL TEMPS AU TOUR ──────────────────────────────────
  calcLapTime(driver, team, circuit, tyreState, fuelLoad, weather = 'dry', lap = 1) {
    const tyre = F1Data.tyres[tyreState.compound];

    // 1. Base circuit
    let lapTime = circuit.baseLapTime;

    // 2. Performance équipe
    // Écart réaliste : top (perf 95) = -1.0s, midfield (perf 75) = +1.0s, backmarker (perf 60) = +2.5s
    const teamFactor = (85 - team.performance) * 0.10;
    lapTime += teamFactor;

    // 3. Skill pilote — écart max ~0.5s entre meilleur et moins bon
    const driverFactor = (87 - driver.pace) * 0.018;
    lapTime += driverFactor;

    // 4. Pneus — grip de base
    lapTime += (1 - tyre.grip) * 1.8;

    // 5. Dégradation pneus
    const degradation = (1 - tyreState.condition);
    lapTime += degradation * 3.5 * circuit.tyreDegradation;

    // 6. Phase de chauffe (premiers tours sur pneus neufs)
    if (tyreState.age < tyre.warmupLaps) {
      lapTime += (tyre.warmupLaps - tyreState.age) * 0.35;
    }

    // 7. Cliff pneu au-delà de 75% dégradation
    if (degradation > 0.75) {
      lapTime += (degradation - 0.75) * 12;
    }

    // 8. Fuel load (allégement progressif, ~0.028s/kg)
    lapTime += fuelLoad * 0.028;

    // 9. Météo
    if (weather === 'light_rain') {
      const wetBonus = (driver.wetSkill - 82) * 0.025;
      lapTime += 3.5 - wetBonus;
      if (!['INTER', 'WET'].includes(tyreState.compound)) lapTime += 7.0;
    } else if (weather === 'heavy_rain') {
      const wetBonus = (driver.wetSkill - 82) * 0.045;
      lapTime += 10.0 - wetBonus;
      if (tyreState.compound !== 'WET') lapTime += 18.0;
    }

    // 10. Variabilité faible (± 0.15s — F1 est très consistent)
    lapTime += (Math.random() - 0.5) * 0.30;

    return Math.max(lapTime, circuit.baseLapTime * 0.985);
  },

  // ── DÉGRADATION PNEUS ─────────────────────────────────────
  degradeTyre(tyreState, circuit, driver, weather = 'dry') {
    const tyre = F1Data.tyres[tyreState.compound];
    let rate = tyre.degradationRate * circuit.tyreDegradation;

    const aggressionFactor = 1 + (driver.overtaking - 80) * 0.004;
    rate *= aggressionFactor;

    if (weather === 'light_rain') rate *= 0.75;
    if (weather === 'heavy_rain') rate *= 0.55;

    rate *= (0.925 + Math.random() * 0.15);

    tyreState.condition = Math.max(0, tyreState.condition - rate);
    tyreState.age++;
    return tyreState;
  },

  // ── CALCUL FUEL ───────────────────────────────────────────
  calcFuelLoad(circuit, lap) {
    const totalFuel = circuit.fuelPerLap * circuit.laps;
    const consumed  = circuit.fuelPerLap * (lap - 1);
    return Math.max(0, totalFuel - consumed);
  },

  // ── DÉCISION PIT STOP ─────────────────────────────────────
  shouldPit(tyreState, lap, totalLaps, strategy, someoneJustPitted = false, weather = 'dry') {
    if (tyreState.condition < 0.12) return { pit: true, reason: 'tyre_dead' };

    if ((weather === 'light_rain' || weather === 'heavy_rain') &&
        !['INTER', 'WET'].includes(tyreState.compound)) {
      return { pit: true, reason: 'weather_change' };
    }
    if (weather === 'dry' && ['INTER', 'WET'].includes(tyreState.compound)) {
      return { pit: true, reason: 'weather_change' };
    }

    if (lap > totalLaps - 4) return { pit: false };

    if (strategy && strategy.pitLaps) {
      for (const pitLap of strategy.pitLaps) {
        if (lap === pitLap) return { pit: true, reason: 'planned' };
        if (someoneJustPitted && lap >= pitLap - 2 && lap < pitLap) {
          return { pit: true, reason: 'undercut' };
        }
      }
    }

    return { pit: false };
  },

  // ── GÉNÉRATION STRATÉGIE ──────────────────────────────────
  generateStrategy(circuit, teamPerformance, weather = 'dry') {
    if (weather === 'heavy_rain') return { compounds: ['WET'], pitLaps: [] };

    const L = circuit.laps;
    const D = circuit.tyreDegradation;

    let stops = 1;
    if (D > 1.2 || L > 65) stops = 2;
    if (D > 1.45) stops = 3;
    if (teamPerformance > 87 && stops === 2 && Math.random() > 0.7) stops = 1;

    const strategies = {
      1: [
        { compounds: ['MEDIUM', 'HARD'],   pitLaps: [Math.round(L * 0.46)] },
        { compounds: ['SOFT',   'HARD'],   pitLaps: [Math.round(L * 0.36)] },
        { compounds: ['HARD',   'MEDIUM'], pitLaps: [Math.round(L * 0.56)] },
      ],
      2: [
        { compounds: ['SOFT',   'MEDIUM', 'HARD'],   pitLaps: [Math.round(L * 0.27), Math.round(L * 0.57)] },
        { compounds: ['SOFT',   'HARD',   'MEDIUM'],  pitLaps: [Math.round(L * 0.24), Math.round(L * 0.59)] },
        { compounds: ['MEDIUM', 'SOFT',   'HARD'],   pitLaps: [Math.round(L * 0.35), Math.round(L * 0.63)] },
        { compounds: ['MEDIUM', 'HARD',   'SOFT'],   pitLaps: [Math.round(L * 0.33), Math.round(L * 0.66)] },
      ],
      3: [
        { compounds: ['SOFT', 'SOFT', 'MEDIUM', 'HARD'], pitLaps: [Math.round(L * 0.19), Math.round(L * 0.40), Math.round(L * 0.64)] },
      ],
    };

    const pool = strategies[stops] || strategies[1];
    return pool[Math.floor(Math.random() * pool.length)];
  },

  // ── INCIDENTS ─────────────────────────────────────────────
  rollIncidents(driver, team, lap, totalLaps) {
    const events = [];

    const reliabilityFactor = (100 - team.reliability) / 100;
    if (Math.random() < reliabilityFactor * 0.0018) {
      events.push({ type: 'dnf', reason: 'mechanical' });
    }

    const crashChance = lap <= 2 ? 0.0025 : 0.00045;
    if (Math.random() < crashChance) {
      events.push({ type: 'dnf', reason: 'crash' });
    }

    if (Math.random() < 0.0018) {
      events.push({ type: 'penalty', seconds: Math.random() > 0.5 ? 5 : 10 });
    }

    return events;
  },

  // ── SAFETY CAR ────────────────────────────────────────────
  rollSafetyCar(lap, totalLaps, incidents) {
    const hasCrash = incidents.some(i => i.type === 'dnf' && i.reason === 'crash');
    if (hasCrash && Math.random() > 0.2) {
      return { active: true, laps: 4 + Math.floor(Math.random() * 3) };
    }
    if (Math.random() < 0.008) {
      return { active: true, laps: 3 + Math.floor(Math.random() * 2) };
    }
    return { active: false };
  },

  // ── DÉPASSEMENT ───────────────────────────────────────────
  attemptOvertake(attacker, defender, circuit) {
    const speedDiff = defender.currentPace - attacker.currentPace;
    if (speedDiff <= 0) return false;

    const baseChance    = speedDiff * 0.12;
    const circuitFactor = 1 - circuit.overtakingDifficulty;
    const attackerSkill = attacker.driver.overtaking / 100;
    const defenderSkill = defender.driver.defending  / 100;

    const chance = baseChance * circuitFactor * (0.5 + attackerSkill * 0.5) * (1 - defenderSkill * 0.3);
    return Math.random() < Math.max(0, Math.min(chance, 0.80));
  },

};
