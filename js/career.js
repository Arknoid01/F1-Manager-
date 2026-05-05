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
  // Appelé manuellement depuis drivers.html
  endOfSeason(save) {
    const report = {
      retired:    [],
      newTalents: [],
      released:   [],
    };

    if (!save) return report;

    save.generatedDrivers  = save.generatedDrivers  || [];
    save.completedSeasons  = save.completedSeasons  || [];
    save.driverStandings   = save.driverStandings   || {};
    save.teamStandings     = save.teamStandings     || {};
    save.raceResults       = save.raceResults       || [];

    const currentSeason = save.season || 2025;
    const playerTeamId  = save.playerTeamId;
    this.ensureContractSystem(save);

    // 0. Archiver le palmarès de la saison que l'on termine.
    // Même si le joueur clique sur "Fin de saison" avant le dernier GP,
    // l'ancienne saison est clôturée proprement et les stats repartent à zéro.
    const teamRank = [...F1Data.teams].sort((a, b) =>
      (save.teamStandings[b.id] || 0) - (save.teamStandings[a.id] || 0)
    );
    const driverRank = [...F1Data.drivers].sort((a, b) =>
      (save.driverStandings[b.id] || 0) - (save.driverStandings[a.id] || 0)
    );
    const playerConstructorPos = teamRank.findIndex(t => t.id === playerTeamId) + 1 || null;
    const champion             = driverRank[0] || null;
    const constructorChampion  = teamRank[0] || null;
    const prize = playerConstructorPos ? Math.max(20, 120 - (playerConstructorPos - 1) * 10) : 20;

    save.completedSeasons.push({
      season: currentSeason,
      playerConstructorPos,
      driverChampionId: champion?.id || null,
      constructorChampionId: constructorChampion?.id || null,
      prize,
      racesCompleted: Number(save.race) || 0,
    });

    // 1. Vieillir tous les pilotes
    report.retired = this.ageAllDrivers(save) || [];

    // 2. Libérer les mauvais performers (IA)
    report.released = this.releasePoorPerformers(save);

    // 3. Générer de nouveaux talents
    const newDrivers = this.generateNewTalents(save);
    report.newTalents = newDrivers;
    newDrivers.forEach(d => save.generatedDrivers.push(d));

    // 4. Remplir les sièges vides (IA) AVANT de persister les états pilotes.
    // Avant, les changements de teamId pouvaient être perdus au rechargement.
    this.fillEmptySeats(save);

    // 5. Persister l'état de tous les pilotes
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
      d.seasons = (d.seasons || 0) + 1;
    });

    // 5b. Les contrats perdent une année à la fin de chaque saison
    Object.keys(save.contracts || {}).forEach(id => {
      const c = save.contracts[id];
      if (!c) return;
      c.years = Math.max(0, (Number(c.years) || 0) - 1);
      const d = F1Data.drivers.find(x => x.id === id);
      if (d && d.teamId === playerTeamId && c.years === 0) {
        c.satisfaction = Math.max(10, (c.satisfaction ?? 50) - 8);
      }
    });

    // 6. Incrémenter la saison et reset complet des stats/courses
    save.season          = currentSeason + 1;
    save.race            = 0;
    save.driverStandings = {};
    save.teamStandings   = {};
    save.raceResults     = [];
    save.news            = (save.news || []).slice(0, 5);

    // Reset objectifs sponsors pour la nouvelle saison
    (save.sponsors || []).forEach(sp => { sp.progress = 0; sp.paid = false; });

    // 7. Tokens bonus + prime fin de saison
    save.tokens = (save.tokens || 0) + 5;
    save.budget = Math.round(((save.budget || 0) + prize) * 10) / 10;

    // 8. Revenus annuels
    const team = F1Data.teams.find(t => t.id === save.playerTeamId);
    if (team) {
      const incomeBonus = Math.round(team.performance * 0.8);
      save.budget = Math.round(((save.budget || 0) + incomeBonus) * 10) / 10;
    }

    // 9. Reset carDev aux stats de base de l'équipe
    if (save.carDev && team) {
      ['aero','chassis','engine','reliability','suspension','pitstop'].forEach(compId => {
        if (!save.carDev[compId]) return;
        const baseStat = team[compId] !== undefined ? team[compId] : 70;
        save.carDev[compId] = { level: baseStat, upgrades: 0 };
      });
    }

    // 10. Reset le flag bannière
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

    const team = F1Data.teams.find(t => t.id === save.playerTeamId);
    if (!team) return { ok: false, msg: 'Équipe joueur introuvable' };

    const oldTeam = driver.teamId;
    const transfer = this.replacePlayerDriver(save, driver, slot === 'replace' ? '' : slot, {
      salary: driver.salary,
      years: 2,
      role: 'pilote2',
    });
    if (!transfer.ok) return transfer;

    save.budget = Math.round((save.budget - signingFee) * 10) / 10;

    if (typeof CareerEvents !== 'undefined') {
      CareerEvents.log(save, {
        phase: 'mercato',
        title: 'Transfert signé',
        text: `${driver.firstName} ${driver.name} rejoint l'équipe${oldTeam ? ` depuis ${oldTeam}` : ''} pour ${signingFee}M€.${transfer.replaced ? ` ${transfer.replaced.firstName} ${transfer.replaced.name} devient agent libre.` : ''}`,
      });
    }

    this.persistDriverStates(save);
    Save.save(save);
    return { ok: true, msg: `${driver.name} recruté pour ${signingFee}M€${transfer.replaced ? `, ${transfer.replaced.name} devient agent libre` : ''} !`, signingFee };
  },



  // ── CONTRATS / NÉGOCIATIONS ──────────────────────────────
  persistDriverStates(save) {
    if (!save) return;
    save.driverStates = save.driverStates || {};
    F1Data.drivers.forEach(d => {
      save.driverStates[d.id] = {
        age: d.age, pace: d.pace, consistency: d.consistency, wetSkill: d.wetSkill,
        overtaking: d.overtaking, defending: d.defending, salary: d.salary,
        trait: d.trait, potential: d.potential, retired: d.retired, teamId: d.teamId,
        seasons: d.seasons || 0, contractYears: d.contractYears || 0, personality: d.personality,
      };
    });
  },

  ensureContractSystem(save) {
    if (!save) return;
    save.contracts = save.contracts || {};
    save.negotiations = save.negotiations || {};
    save.reputation = save.reputation ?? 50;

    const personalities = ['loyal', 'mercenaire', 'ambitieux', 'prudent', 'jeune_loup'];
    F1Data.drivers.forEach(d => {
      if (!d.personality) {
        const score = this.getDriverScore(d);
        if ((d.age || 25) <= 23) d.personality = 'jeune_loup';
        else if (score >= 88) d.personality = 'ambitieux';
        else if ((d.seasons || 0) >= 2) d.personality = 'loyal';
        else d.personality = personalities[Math.floor(Math.random() * personalities.length)];
      }
      if (!save.contracts[d.id]) {
        const baseYears = d.teamId ? 1 + Math.floor(Math.random() * 3) : 0;
        save.contracts[d.id] = {
          years: baseYears,
          salary: Number(d.salary) || 1,
          status: 'pilote2',
          refus: 0,
          cooldownUntilSeason: 0,
          satisfaction: d.teamId === save.playerTeamId ? 58 : 50,
        };
      }
    });
    this.persistDriverStates(save);
  },

  getPersonalityInfo(driver) {
    const map = {
      loyal:      { label:'Loyal', icon:'🤝', desc:'Préfère la stabilité, plus simple à prolonger.' },
      mercenaire: { label:'Mercenaire', icon:'💰', desc:'Très sensible au salaire et aux primes.' },
      ambitieux:  { label:'Ambitieux', icon:'🏆', desc:'Veut une équipe compétitive et un vrai statut.' },
      prudent:    { label:'Prudent', icon:'🧠', desc:'Aime les contrats longs et le risque faible.' },
      jeune_loup: { label:'Jeune loup', icon:'🌱', desc:'Cherche du temps de piste et une progression rapide.' },
    };
    return map[driver.personality] || map.prudent;
  },

  getTeamRank(save) {
    const standings = save?.teamStandings || {};
    if (!save?.playerTeamId) return 10;
    const ranked = [...F1Data.teams].sort((a,b)=>(standings[b.id]||0)-(standings[a.id]||0));
    const pos = ranked.findIndex(t=>t.id===save.playerTeamId);
    if (Object.values(standings).every(v => !v)) {
      const team = F1Data.teams.find(t=>t.id===save.playerTeamId);
      return Math.max(1, Math.round((100 - (team?.performance || 70)) / 5));
    }
    return pos >= 0 ? pos + 1 : 10;
  },

  evaluateContractOffer(save, driverId, offer = {}) {
    this.ensureContractSystem(save);
    const d = F1Data.drivers.find(x=>x.id===driverId);
    if (!d || d.retired) return { ok:false, msg:'Pilote indisponible' };
    const c = save.contracts[d.id] || {};
    const score = this.getDriverScore(d);
    const salary = Number(offer.salary ?? d.salary ?? 1);
    const years = Number(offer.years ?? 2);
    const role = offer.role || 'pilote2';
    const bonus = Number(offer.bonus ?? 0);
    const isRenewal = d.teamId === save.playerTeamId;
    const baseSalary = Math.max(1, Number(d.salary) || 1);
    const salaryRatio = salary / baseSalary;
    const teamRank = this.getTeamRank(save);
    const rep = Number(save.reputation ?? 50);

    let chance = isRenewal ? 55 : 38;
    chance += Math.max(-25, Math.min(30, (salaryRatio - 1) * 55));
    chance += Math.max(0, Math.min(12, bonus * 0.8));
    chance += (rep - 50) * 0.35;
    chance += Math.max(-18, 12 - teamRank * 3);
    if (role === 'pilote1') chance += 11;
    if (role === 'egal') chance += 5;
    if (years >= 3) chance += 4;
    if (years <= 1) chance -= 5;
    chance -= Math.max(0, score - 82) * 1.4;
    chance -= (c.refus || 0) * 7;
    if ((c.cooldownUntilSeason || 0) > (save.season || 2025)) chance -= 18;
    if (isRenewal) chance += Math.max(-15, Math.min(18, ((c.satisfaction ?? 58) - 50) * 0.45));

    switch (d.personality) {
      case 'loyal':
        if (isRenewal) chance += 14; else chance -= 4;
        if (salaryRatio < 0.95) chance -= 5;
        break;
      case 'mercenaire':
        chance += (salaryRatio - 1) * 25 + bonus * 0.5;
        if (salaryRatio < 1.1) chance -= 8;
        break;
      case 'ambitieux':
        if (teamRank > 5) chance -= 18;
        if (role !== 'pilote1') chance -= 8;
        break;
      case 'prudent':
        if (years >= 3) chance += 10;
        if (years <= 1) chance -= 8;
        break;
      case 'jeune_loup':
        if (role === 'pilote1' || role === 'egal') chance += 8;
        if (score > 82 && teamRank > 7) chance -= 8;
        break;
    }

    const demandSalary = Math.max(baseSalary, Math.ceil(baseSalary * (1.05 + Math.max(0, score - 80) / 90 + (d.personality === 'mercenaire' ? 0.18 : 0))));
    const demandBonus = Math.max(0, Math.round((score - 78) / 5));
    const demandYears = d.personality === 'prudent' ? 3 : (d.personality === 'ambitieux' ? 2 : years);
    chance = Math.round(Math.max(5, Math.min(92, chance)));
    return { ok:true, chance, isRenewal, score, teamRank, demand:{ salary:demandSalary, bonus:demandBonus, years:demandYears, role: score >= 86 ? 'pilote1' : 'egal' } };
  },

  replacePlayerDriver(save, incomingDriver, replaceDriverId, contractData = {}) {
    if (!save || !incomingDriver) return { ok:false, msg:'Transfert impossible.' };

    const playerTeamId = save.playerTeamId;
    const teamDrivers = F1Data.drivers.filter(x => x.teamId === playerTeamId && !x.retired);
    let replaced = null;

    // Si l'équipe a déjà 2 pilotes, le joueur doit choisir le siège à remplacer.
    if (teamDrivers.length >= 2) {
      if (!replaceDriverId) return { ok:false, msg:'Choisis le pilote de ton équipe à remplacer.' };
      replaced = F1Data.drivers.find(x => x.id === replaceDriverId && x.teamId === playerTeamId && !x.retired);
      if (!replaced) return { ok:false, msg:'Le pilote à remplacer est introuvable dans ton équipe.' };
      if (replaced.id === incomingDriver.id) return { ok:false, msg:'Ce pilote est déjà dans ton équipe.' };
    }

    const oldTeamId = incomingDriver.teamId || null;

    // L'ancien pilote du joueur devient agent libre.
    if (replaced) {
      replaced.teamId = null;
      replaced.contractYears = 0;
      save.contracts = save.contracts || {};
      save.contracts[replaced.id] = {
        ...(save.contracts[replaced.id] || {}),
        years: 0,
        status: 'agent libre',
        satisfaction: Math.max(25, (save.contracts[replaced.id]?.satisfaction ?? 50) - 12),
      };
    }

    // Le nouveau pilote prend exactement ce siège.
    incomingDriver.teamId = playerTeamId;
    incomingDriver.salary = Number(contractData.salary ?? incomingDriver.salary ?? 1);
    incomingDriver.contractYears = Number(contractData.years ?? 1);
    save.contracts[incomingDriver.id] = {
      ...(save.contracts[incomingDriver.id] || {}),
      years: Number(contractData.years ?? 1),
      salary: Number(contractData.salary ?? incomingDriver.salary ?? 1),
      status: contractData.role || 'pilote2',
      refus: 0,
      cooldownUntilSeason: 0,
      satisfaction: Math.min(95, (save.contracts[incomingDriver.id]?.satisfaction ?? 58) + 10),
    };

    // Si le pilote recruté venait d'une autre équipe, l'IA peut combler le siège vide.
    // Cela permet notamment à l'ancien pilote du joueur d'être recruté ailleurs.
    if (oldTeamId && oldTeamId !== playerTeamId) {
      this.fillEmptySeats(save);
    }

    return { ok:true, replaced, oldTeamId };
  },

  makeContractOffer(save, driverId, offer = {}) {
    const evalResult = this.evaluateContractOffer(save, driverId, offer);
    if (!evalResult.ok) return evalResult;
    const d = F1Data.drivers.find(x=>x.id===driverId);
    const salary = Number(offer.salary ?? d.salary ?? 1);
    const years = Number(offer.years ?? 2);
    const bonus = Number(offer.bonus ?? 0);
    const role = offer.role || 'pilote2';
    const isRenewal = d.teamId === save.playerTeamId;
    const upfront = isRenewal ? bonus : Math.round((Number(d.salary)||1) * 1.2 + bonus);
    if ((save.budget || 0) < upfront) return { ok:false, msg:`Budget insuffisant : il faut ${upfront}M€ maintenant.` };

    const roll = Math.floor(Math.random() * 100) + 1;
    const c = save.contracts[d.id] || {};
    if (roll <= evalResult.chance) {
      let transfer = { ok:true, replaced:null, oldTeamId:d.teamId || null };
      if (!isRenewal) {
        transfer = this.replacePlayerDriver(save, d, offer.replaceDriverId, { salary, years, role });
        if (!transfer.ok) return transfer;
      } else {
        d.salary = salary;
        d.contractYears = years;
        save.contracts[d.id] = { ...c, years, salary, status: role, refus:0, cooldownUntilSeason:0, satisfaction: Math.min(95, (c.satisfaction ?? 58) + 10) };
      }
      save.budget = Math.round(((save.budget || 0) - upfront) * 10) / 10;
      save.finances = save.finances || { income:0, expenses:0 };
      save.finances.expenses = Math.round(F1Data.drivers.filter(x=>x.teamId===save.playerTeamId&&!x.retired).reduce((sum,x)=>sum+(Number(x.salary)||0),0)*10)/10;
      this.persistDriverStates(save);
      if (typeof CareerEvents !== 'undefined') CareerEvents.log(save, { phase:'contrats', title: isRenewal ? 'Prolongation signée' : 'Contrat signé', text:`${d.firstName} ${d.name} signe ${years} an(s), ${salary}M€/an.${transfer?.replaced ? ' Il remplace '+transfer.replaced.firstName+' '+transfer.replaced.name+', désormais agent libre.' : ''}` });
      Save.save(save);
      return { ok:true, accepted:true, replaced:transfer?.replaced?.id || null, msg:`${d.firstName} ${d.name} accepte l'offre !${transfer?.replaced ? ' '+transfer.replaced.firstName+' '+transfer.replaced.name+' devient agent libre.' : ''}`, cost:upfront, chance:evalResult.chance };
    }

    save.contracts[d.id] = { ...c, refus:(c.refus||0)+1, cooldownUntilSeason:(save.season || 2025) + 1, salary:c.salary || d.salary, years:c.years || 0, status:c.status || 'pilote2', satisfaction: Math.max(15, (c.satisfaction ?? 50) - 6) };
    const counter = roll <= evalResult.chance + 22 ? evalResult.demand : null;
    Save.save(save);
    return { ok:true, accepted:false, counter, chance:evalResult.chance, msg: counter ? `${d.name} refuse mais propose une contre-offre.` : `${d.name} refuse l'offre.` };
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

    this.persistDriverStates(save);
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
