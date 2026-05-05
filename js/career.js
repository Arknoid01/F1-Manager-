// ============================================================
//  F1 Manager — career.js
//  Système de carrière long terme :
//  - Évolution / déclin des pilotes
//  - Génération de nouveaux pilotes
//  - Vieillissement annuel
//  - Retraites
// ============================================================

const Career = {

  // ── COURBE D'ÉVOLUTION PAR ÂGE ────────────────────────────
  // Retourne un multiplicateur de progression/déclin selon l'âge
  ageProgression(age) {
    if (age <= 20) return { pace: +2.5, consistency: +1.5, wetSkill: +1.0, defending: +0.5, overtaking: +1.5 };
    if (age <= 23) return { pace: +1.8, consistency: +1.2, wetSkill: +0.8, defending: +0.8, overtaking: +1.2 };
    if (age <= 26) return { pace: +1.0, consistency: +0.8, wetSkill: +0.5, defending: +0.5, overtaking: +0.8 };
    if (age <= 29) return { pace: +0.4, consistency: +0.5, wetSkill: +0.3, defending: +0.3, overtaking: +0.3 };
    if (age <= 32) return { pace: +0.0, consistency: +0.3, wetSkill: +0.1, defending: +0.2, overtaking: +0.0 };
    if (age <= 35) return { pace: -0.5, consistency: +0.1, wetSkill: +0.0, defending: +0.1, overtaking: -0.3 };
    if (age <= 38) return { pace: -1.2, consistency: -0.2, wetSkill: -0.2, defending: -0.1, overtaking: -0.8 };
    return             { pace: -2.0, consistency: -0.8, wetSkill: -0.5, defending: -0.5, overtaking: -1.5 };
  },

  // ── VIEILLISSEMENT ANNUEL ─────────────────────────────────
  // Appelé en fin de saison pour tous les pilotes
  ageAllDrivers(save) {
    if (!save) return;
    const retired = [];

    F1Data.drivers.forEach(driver => {
      if (driver.retired) return;

      driver.age = (driver.age || 25) + 1;

      // Progression selon l'âge
      const prog = this.ageProgression(driver.age);
      const trait = F1Data.traits[driver.trait] || {};

      // Variabilité individuelle (±50% de la progression de base)
      const variance = 0.5 + Math.random();

      // Stats plafonnées par le potentiel du pilote
      const cap = driver.potential || 95;

      ['pace','consistency','wetSkill','overtaking','defending'].forEach(stat => {
        const delta = (prog[stat] || 0) * variance;
        driver[stat] = Math.max(50, Math.min(cap, Math.round((driver[stat] || 70) + delta)));
      });

      // Retraite possible à partir de 38 ans (probabilité croissante)
      if (driver.age >= 38) {
        const retireChance = (driver.age - 37) * 0.18;
        if (Math.random() < retireChance) {
          driver.retired = true;
          driver.teamId  = null;
          retired.push(driver);
        }
      }

      // Mise à jour salaire selon les stats
      driver.salary = this.calcSalary(driver);
    });

    return retired;
  },

  // ── CALCUL SALAIRE ────────────────────────────────────────
  calcSalary(driver) {
    const avg = (driver.pace + driver.consistency + driver.wetSkill) / 3;
    if (avg >= 93) return Math.round(30 + (avg - 93) * 8);
    if (avg >= 87) return Math.round(10 + (avg - 87) * 3.5);
    if (avg >= 80) return Math.round(4  + (avg - 80) * 0.8);
    return Math.max(1, Math.round(avg * 0.05));
  },

  // ── GÉNÉRATION D'UN NOUVEAU PILOTE ────────────────────────
  generateDriver(save) {
    const names  = F1Data.driverNames;
    const nats   = Object.keys(names.firstNames);
    const nat    = nats[Math.floor(Math.random() * nats.length)];

    const fnames = names.firstNames[nat] || names.firstNames.british;
    const lnames = names.lastNames[nat]  || names.lastNames.british;

    const firstName = fnames[Math.floor(Math.random() * fnames.length)];
    const lastName  = lnames[Math.floor(Math.random() * lnames.length)];

    // Numéro libre
    const usedNumbers = new Set(F1Data.drivers.filter(d=>!d.retired).map(d=>d.number));
    const available   = F1Data.availableNumbers.filter(n => !usedNumbers.has(n));
    const number      = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : Math.floor(Math.random() * 90) + 10;

    // Âge : 18-22 (jeune talent)
    const age = 18 + Math.floor(Math.random() * 5);

    // Spécialité → boost dans 1 ou 2 stats
    const traits    = Object.keys(F1Data.traits);
    const trait     = traits[Math.floor(Math.random() * traits.length)];
    const traitData = F1Data.traits[trait];

    // Stats de base selon l'âge (jeune = bas mais potentiel élevé)
    const base = 62 + Math.floor(Math.random() * 15); // 62-77

    // Potentiel aléatoire : détermine le plafond de progression
    // Rare talent (95+) = 5% de chance, bon talent (88-94) = 25%, correct (80-87) = 45%, limité (70-79) = 25%
    const potRoll = Math.random();
    let potential;
    if      (potRoll < 0.05) potential = 95 + Math.floor(Math.random() * 5);  // 95-99 : futur champion
    else if (potRoll < 0.30) potential = 88 + Math.floor(Math.random() * 7);  // 88-94 : très bon
    else if (potRoll < 0.75) potential = 80 + Math.floor(Math.random() * 8);  // 80-87 : correct
    else                     potential = 70 + Math.floor(Math.random() * 10); // 70-79 : limité

    // Spécialisation selon le trait
    const statMap = {
      aggressive:  { pace:+4, overtaking:+5, wetSkill:+0, consistency:-3 },
      consistent:  { pace:+0, consistency:+5, wetSkill:+2, defending:+2   },
      qualifier:   { pace:+6, consistency:-2, wetSkill:+0, overtaking:+1  },
      rain_master: { wetSkill:+8, pace:+0, consistency:+2, defending:+2   },
      defender:    { defending:+7, pace:-1, consistency:+3, wetSkill:+1   },
      overtaker:   { overtaking:+7, pace:+2, consistency:-1, wetSkill:+0  },
      prodigy:     { pace:+3, consistency:+3, wetSkill:+3, overtaking:+3  },
      technical:   { consistency:+4, defending:+3, pace:+1, wetSkill:+2   },
    };

    const spec = statMap[trait] || {};

    const driver = {
      id:          `GEN_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      name:        lastName,
      firstName,
      nationality: nat,
      teamId:      null, // sans équipe au départ
      number,
      age,
      potential,
      trait,
      retired:     false,
      generated:   true,
      pace:        Math.min(potential, Math.max(50, base + (spec.pace || 0))),
      consistency: Math.min(potential, Math.max(50, base + (spec.consistency || 0))),
      wetSkill:    Math.min(potential, Math.max(50, base + (spec.wetSkill || 0))),
      overtaking:  Math.min(potential, Math.max(50, base + (spec.overtaking || 0))),
      defending:   Math.min(potential, Math.max(50, base + (spec.defending || 0))),
      salary:      1, // calculé après
      seasons:     0, // nombre de saisons en F1
    };

    driver.salary = this.calcSalary(driver);

    return driver;
  },

  // ── ENTRÉES EN F1 CHAQUE SAISON ───────────────────────────
  // Génère 2-4 jeunes talents qui entrent dans le pool
  generateNewTalents(save) {
    const count = 2 + Math.floor(Math.random() * 3); // 2-4 par saison
    const newDrivers = [];
    for (let i = 0; i < count; i++) {
      const d = this.generateDriver(save);
      newDrivers.push(d);
      F1Data.drivers.push(d);
    }
    return newDrivers;
  },

  // ── LIBÉRATION DES SIÈGES ─────────────────────────────────
  // En fin de saison, certains pilotes perdent leur siège (perf insuffisante)
  releasePoorPerformers(save) {
    const released = [];
    if (!save?.teamStandings) return released;

    F1Data.teams.forEach(team => {
      const teamDrivers = F1Data.drivers.filter(d => d.teamId === team.id && !d.retired);
      if (teamDrivers.length < 2) return;

      // Le pilote le moins bon peut être remplacé si l'écart est trop grand
      const sorted = [...teamDrivers].sort((a, b) => {
        const scoreA = (a.pace + a.consistency + a.wetSkill) / 3;
        const scoreB = (b.pace + b.consistency + b.wetSkill) / 3;
        return scoreB - scoreA;
      });

      const best  = sorted[0];
      const worst = sorted[sorted.length - 1];
      const gap   = ((best.pace + best.consistency) / 2) - ((worst.pace + worst.consistency) / 2);

      // Libère si écart > 12 points et pas l'équipe joueur
      if (gap > 12 && team.id !== save.playerTeamId && Math.random() < 0.45) {
        worst.teamId = null;
        released.push(worst);
      }
    });

    return released;
  },

  // ── SIGNATURE IA : remplacer les sièges vides ────────────
  fillEmptySeats(save) {
    const freeDrivers = F1Data.drivers.filter(d => !d.teamId && !d.retired);

    F1Data.teams.forEach(team => {
      if (team.id === save?.playerTeamId) return; // géré par le joueur
      const count = F1Data.drivers.filter(d => d.teamId === team.id && !d.retired).length;
      if (count >= 2) return;

      const needed = 2 - count;
      for (let i = 0; i < needed; i++) {
        if (!freeDrivers.length) break;
        // Choisir le meilleur disponible adapté au niveau de l'équipe
        const teamLevel = team.performance;
        const candidates = freeDrivers.sort((a, b) => {
          const sa = Math.abs(((a.pace + a.consistency) / 2) - teamLevel);
          const sb = Math.abs(((b.pace + b.consistency) / 2) - teamLevel);
          return sa - sb;
        });
        const pick = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
        if (pick) {
          pick.teamId = team.id;
          freeDrivers.splice(freeDrivers.indexOf(pick), 1);
        }
      }
    });
  },

  // ── FIN DE SAISON COMPLÈTE ────────────────────────────────
  endOfSeason(save) {
    const report = {
      retired:    [],
      newTalents: [],
      released:   [],
    };

    if (!save) return report;

    save.generatedDrivers = save.generatedDrivers || [];

    // 1. Vieillir tous les pilotes
    report.retired = this.ageAllDrivers(save) || [];

    // 2. Libérer les mauvais performers (IA)
    report.released = this.releasePoorPerformers(save);

    // 3. Générer de nouveaux talents
    const newDrivers = this.generateNewTalents(save);
    report.newTalents = newDrivers;
    newDrivers.forEach(d => save.generatedDrivers.push(d));

    // 4. Persister l'état de tous les pilotes
    save.driverStates = {};
    F1Data.drivers.forEach(d => {
      save.driverStates[d.id] = {
        age:         d.age,
        pace:        d.pace,
        consistency: d.consistency,
        wetSkill:    d.wetSkill,
        overtaking:  d.overtaking,
        defending:   d.defending,
        salary:      d.salary,
        trait:       d.trait,
        potential:   d.potential,
        retired:     d.retired,
        teamId:      d.teamId,
        seasons:     (d.seasons || 0) + 1,
      };
    });

    // 5. Remplir les sièges vides (IA)
    this.fillEmptySeats(save);

    // 6. Incrémenter la saison
    save.season = (save.season || 2025) + 1;
    save.race   = 0;

    // 7. Tokens bonus
    save.tokens = (save.tokens || 0) + 5;

    // 8. Revenus annuels
    const team = F1Data.teams.find(t => t.id === save.playerTeamId);
    if (team) {
      const incomeBonus = Math.round(team.performance * 0.8);
      save.budget = Math.round(((save.budget || 0) + incomeBonus) * 10) / 10;
    }

    // 9. RESET standings pour nouvelle saison
    save.driverStandings = {};
    save.teamStandings   = {};
    save.raceResults     = save.raceResults || [];

    // 10. RESET carDev — revenir aux stats de base de l'équipe
    // On garde les upgrades achetés MAIS on recalcule depuis les stats actuelles
    // pour éviter les stats bloquées à 100
    if (save.carDev && team) {
      const CAR_COMPONENTS = ['aero','chassis','engine','reliability','suspension','pitstop'];
      CAR_COMPONENTS.forEach(compId => {
        if (!save.carDev[compId]) return;
        // Réinitialiser le niveau depuis les vraies stats de l'équipe
        // (pas depuis le carDev accumulé)
        const baseStat = team[compId] !== undefined ? team[compId] : 70;
        save.carDev[compId] = {
          level:    baseStat,
          upgrades: 0, // reset les upgrades pour repartir à coût de base
        };
      });
    }

    // 11. Reset le flag bannière pour qu'elle s'affiche à nouveau
    delete save._bannerDismissed;

    Save.save(save);
    return report;
  },

  // ── RECRUTER UN PILOTE ───────────────────────────────────
  signDriver(save, driverId, slot) {
    if (!save) return { ok: false, msg: 'Pas de sauvegarde' };

    const driver = F1Data.drivers.find(d => d.id === driverId);
    if (!driver) return { ok: false, msg: 'Pilote introuvable' };
    if (driver.retired) return { ok: false, msg: 'Pilote retraité' };

    const signingFee = Math.round(driver.salary * 1.5); // frais de transfert
    if ((save.budget || 0) < signingFee) {
      return { ok: false, msg: `Budget insuffisant (frais : ${signingFee}M€)` };
    }

    // Libérer l'ancien pilote du slot
    const team = F1Data.teams.find(t => t.id === save.playerTeamId);
    if (!team) return { ok: false, msg: 'Équipe joueur introuvable' };

    const teamDrivers = F1Data.drivers.filter(d => d.teamId === save.playerTeamId && !d.retired);

    if (slot === 'replace' && teamDrivers.length >= 2) {
      // Remplacer le moins bon
      const worst = teamDrivers.sort((a, b) =>
        ((a.pace + a.consistency) / 2) - ((b.pace + b.consistency) / 2)
      )[0];
      worst.teamId = null;
    } else if (teamDrivers.length >= 2) {
      return { ok: false, msg: 'L\'équipe a déjà 2 pilotes. Libérez un siège d\'abord.' };
    }

    // Libérer l'ancien employeur du pilote
    const oldTeam = driver.teamId;

    driver.teamId = save.playerTeamId;
    save.budget   = Math.round((save.budget - signingFee) * 10) / 10;

    // Log dans les news
    if (typeof CareerEvents !== 'undefined') {
      CareerEvents.log(save, {
        phase: 'mercato',
        title: 'Transfert signé',
        text:  `${driver.firstName} ${driver.name} rejoint l'équipe${oldTeam ? ` depuis ${oldTeam}` : ''} pour ${signingFee}M€.`,
      });
    }

    Save.save(save);
    return { ok: true, msg: `${driver.name} recruté pour ${signingFee}M€ !`, signingFee };
  },

  // ── LICENCIER UN PILOTE ──────────────────────────────────
  releaseDriver(save, driverId) {
    if (!save) return { ok: false, msg: 'Pas de sauvegarde' };
    const driver = F1Data.drivers.find(d => d.id === driverId);
    if (!driver || driver.teamId !== save.playerTeamId) {
      return { ok: false, msg: 'Ce pilote n\'est pas dans ton équipe' };
    }

    const teamDrivers = F1Data.drivers.filter(d => d.teamId === save.playerTeamId && !d.retired);
    if (teamDrivers.length <= 1) {
      return { ok: false, msg: 'Tu dois garder au moins 1 pilote' };
    }

    // Indemnité de licenciement
    const penalty = Math.round(driver.salary * 0.5);
    save.budget = Math.round(((save.budget || 0) - penalty) * 10) / 10;
    driver.teamId = null;

    if (typeof CareerEvents !== 'undefined') {
      CareerEvents.log(save, {
        phase: 'mercato',
        title: 'Pilote libéré',
        text:  `${driver.firstName} ${driver.name} quitte l'équipe. Indemnité : ${penalty}M€.`,
      });
    }

    Save.save(save);
    return { ok: true, msg: `${driver.name} libéré (indemnité : ${penalty}M€)` };
  },

  // ── STATS AFFICHABLES ───────────────────────────────────
  getDriverScore(driver) {
    const pace        = driver.pace        || 70;
    const consistency = driver.consistency || 70;
    const wetSkill    = driver.wetSkill    || 70;
    const overtaking  = driver.overtaking  || 70;
    const defending   = driver.defending   || 70;
    return Math.round(pace * 0.35 + consistency * 0.25 + wetSkill * 0.15 + overtaking * 0.15 + defending * 0.10);
  },

  getPotentialLabel(potential) {
    const p = potential || 80;
    if (p >= 97) return { label: 'Légendaire', color: '#ff6600' };
    if (p >= 93) return { label: 'Champion',   color: '#ffd700' };
    if (p >= 88) return { label: 'Excellent',  color: '#00e676' };
    if (p >= 83) return { label: 'Solide',     color: '#2979ff' };
    if (p >= 78) return { label: 'Correct',    color: '#6a6a8a' };
    return              { label: 'Limité',     color: '#444'    };
  },

  getAgePhase(age) {
    const a = age || 25;
    if (a <= 22) return { label: 'Jeune talent', color: '#00e676', icon: '🌱' };
    if (a <= 28) return { label: 'Prime',        color: '#ffd700', icon: '⭐' };
    if (a <= 33) return { label: 'Expérimenté',  color: '#2979ff', icon: '🔵' };
    if (a <= 37) return { label: 'Déclin',       color: '#ff9944', icon: '📉' };
    return              { label: 'Vétéran',      color: '#ff4444', icon: '⚠️' };
  },
};
