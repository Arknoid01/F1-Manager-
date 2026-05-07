// ============================================================
//  F1 Manager — save.js
//  Persistence via localStorage (migration PHP facile plus tard)
// ============================================================

const Save = {

  KEY: 'f1manager_v1',

  // ── STRUCTURE DE SAUVEGARDE ───────────────────────────────
  defaultSave() {
    return {
      version: 2,
      lastSaved: null,
      season: 2025,
      race: 0, // index dans le calendrier
      playerTeamId: null,
      budget: 0,
      tokens: 0,
      finances: { income: 0, expenses: 0 },
      sponsors: [],
      staff: [],
      completedSeasons: [],
      news: [],
      reputation: 50,
      driverEffects: {},
      contracts: {},
      aiDevelopment: {},

      // Championnat
      driverStandings: {},   // { driverId: points }
      teamStandings: {},     // { teamId: points }

      // Résultats des courses
      raceResults: [],

      // État équipe joueur
      playerTeam: null,

      // Développement voiture
      carDev: {
        current: null,  // stats actuelles
        nextYear: null, // budget alloué N+1
      },
    };
  },

  // ── SAVE ──────────────────────────────────────────────────
  save(data) {
    try {
      data.lastSaved = new Date().toISOString();
      localStorage.setItem(this.KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('[Save] Erreur sauvegarde:', e);
      return false;
    }
  },

  // ── LOAD ──────────────────────────────────────────────────
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return null;
      const save = JSON.parse(raw);

      // Migration DATA_VERSION — met à jour le grid si data.js a changé
      const currentDataVersion = typeof F1Data !== 'undefined' ? (F1Data.DATA_VERSION || 1) : 1;
      if ((save.dataVersion || 0) < currentDataVersion) {
        this.migrateBaseData(save, currentDataVersion);
      }

      this.applyDriverStates(save);
      return save;
    } catch (e) {
      console.error('[Save] Erreur chargement:', e);
      return null;
    }
  },

  migrateBaseData(save, newVersion) {
    if (typeof F1Data === 'undefined') return;
    if (!save.driverStates) { save.dataVersion = newVersion; return; }

    F1Data.drivers.forEach(driver => {
      const state = save.driverStates[driver.id];
      if (!state) {
        // Nouveau pilote (ex: Antonelli, Colapinto...) — initialiser
        save.driverStates[driver.id] = {
          age:driver.age, pace:driver.pace, consistency:driver.consistency,
          wetSkill:driver.wetSkill, overtaking:driver.overtaking, defending:driver.defending,
          salary:driver.salary, trait:driver.trait, potential:driver.potential,
          retired:false, teamId:driver.teamId, seasons:0,
        };
      } else if (!state.teamId || state.teamId === save.playerTeamId) {
        // Ne pas toucher aux pilotes recrutés par le joueur
      } else if (state.teamId !== driver.teamId) {
        // Pilote qui a changé d'équipe dans la réalité → mettre à jour
        state.teamId = driver.teamId;
      }
    });

    // Supprimer les états de pilotes qui n'existent plus
    const currentIds = new Set(F1Data.drivers.map(d => d.id));
    Object.keys(save.driverStates).forEach(id => {
      if (!currentIds.has(id) && !(save.generatedDrivers||[]).find(g=>g.id===id)) {
        delete save.driverStates[id];
      }
    });

    save.dataVersion = newVersion;
    try { localStorage.setItem(this.KEY, JSON.stringify(save)); } catch(e) {}
    console.log(`[Save] Migration data v${newVersion} OK`);
  },

  // ── SYNCHRO PILOTES / MARCHÉ ──────────────────────────────
  // Toutes les pages appellent Save.load(). Cette fonction restaure donc
  // les transferts sauvegardés avant que Race, Standings ou Index lisent
  // F1Data.drivers. Sans ça, ces pages reprenaient les teamId d'origine.
  applyDriverStates(save) {
    if (!save || typeof F1Data === 'undefined' || !Array.isArray(F1Data.drivers)) return;

    if (Array.isArray(save.generatedDrivers)) {
      save.generatedDrivers.forEach(gd => {
        if (gd && gd.id && !F1Data.drivers.find(d => d.id === gd.id)) {
          F1Data.drivers.push({ ...gd });
        }
      });
    }

    if (!save.driverStates) return;
    F1Data.drivers.forEach(d => {
      const state = save.driverStates[d.id];
      if (!state) return;
      d.age = state.age ?? d.age;
      d.pace = state.pace ?? d.pace;
      d.consistency = state.consistency ?? d.consistency;
      d.wetSkill = state.wetSkill ?? d.wetSkill;
      d.overtaking = state.overtaking ?? d.overtaking;
      d.defending = state.defending ?? d.defending;
      d.salary = state.salary ?? d.salary;
      d.trait = state.trait ?? d.trait;
      d.potential = state.potential ?? d.potential;
      d.retired = state.retired ?? false;
      d.personality = state.personality ?? d.personality;
      d.contractYears = state.contractYears ?? d.contractYears ?? 0;
      d.seasons = state.seasons ?? d.seasons ?? 0;
      if (Object.prototype.hasOwnProperty.call(state, 'teamId')) d.teamId = state.teamId;
    });
  },

  persistDriverStates(save) {
    if (!save || typeof F1Data === 'undefined') return;
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

  // ── RESET ─────────────────────────────────────────────────
  reset() {
    localStorage.removeItem(this.KEY);
  },

  // ── CHECK ─────────────────────────────────────────────────
  hasSave() {
    return localStorage.getItem(this.KEY) !== null;
  },


  // ── ENREGISTRER UNE COURSE DANS LA CARRIÈRE ───────────────
  recordRaceResults(raceState, results) {
    const save = this.load();
    if (typeof CareerEvents !== 'undefined') CareerEvents.ensure(save || {});
    if (!save || !save.playerTeamId || !raceState || !results || !results.length) {
      console.warn('[Save] Course non enregistrée : sauvegarde/carrière introuvable ou résultats vides.');
      return null;
    }

    const circuit = raceState.circuit;
    if (typeof CareerEvents !== 'undefined') { CareerEvents.triggerPostRace(save, { results }); }
    const playerTeamId = save.playerTeamId;

    save.driverStandings = save.driverStandings || {};
    save.teamStandings   = save.teamStandings || {};
    save.raceResults     = save.raceResults || [];

    results.forEach(r => {
      const driverId = r.driver && r.driver.id;
      const teamId   = r.team && r.team.id;
      if (!driverId || !teamId) return;
      save.driverStandings[driverId] = (save.driverStandings[driverId] || 0) + (r.points || 0);
      save.teamStandings[teamId]     = (save.teamStandings[teamId] || 0) + (r.points || 0);
    });

    const playerResults = results.filter(r => r.team && r.team.id === playerTeamId);
    const bestPosition  = playerResults.length ? Math.min(...playerResults.map(r => r.position)) : 20;
    const teamPoints    = playerResults.reduce((sum, r) => sum + (r.points || 0), 0);

    // Récompense course de base
    const reward = 1 + Math.round(teamPoints * 0.3) + (bestPosition <= 3 ? 3 : bestPosition <= 10 ? 1 : 0);

    // Tokens performance-based + 1 garanti (évite le blocage total)
    // Petite équipe (~0 podiums) : ~20-25/saison → doit choisir 2-3 domaines
    // Top équipe (~8 podiums)    : ~45-55/saison → peut tout développer en 2 ans
    const tokens = 1                               // minimum garanti
                 + (teamPoints > 0 ? 1 : 0)       // top 10 = +1
                 + (bestPosition <= 5  ? 1 : 0)   // top 5  = +1
                 + (bestPosition <= 3  ? 1 : 0)   // podium = +1
                 + (bestPosition === 1 ? 1 : 0);  // victoire = +1 (max 5/course)

    // Revenus sponsors — 3 versements clairs dans la saison
    let sponsorBonus = 0;
    if (typeof Sponsors !== 'undefined') {
      Sponsors.updateAfterRace(save, { results: results.map(r => ({
        teamId: r.team?.id, position: r.position||20, points: r.points||0, status: r.status
      }))});
    }

    const totalSponsorAnnual = (save.sponsors||[]).reduce((s,sp)=>s+(sp.value||0),0);
    const raceIdx = Number(save.race) || 0;
    const totalRaces = F1Data.circuits.length;
    const midPoint = Math.floor(totalRaces / 2);

    // Versement 1 : 40% au démarrage (course 1)
    if (raceIdx === 0 && totalSponsorAnnual > 0) {
      sponsorBonus = Math.round(totalSponsorAnnual * 0.40 * 10) / 10;
      if (save.news) save.news.push({ icon:'💰', category:'finance',
        title:'Versement sponsors — Début de saison',
        text:`40% des contrats sponsors versés : +${sponsorBonus}M€` });
    }
    // Versement 2 : 30% à mi-saison
    else if (raceIdx === midPoint && totalSponsorAnnual > 0) {
      sponsorBonus = Math.round(totalSponsorAnnual * 0.30 * 10) / 10;
      if (save.news) save.news.push({ icon:'💰', category:'finance',
        title:'Versement sponsors — Mi-saison',
        text:`30% des contrats sponsors versés : +${sponsorBonus}M€` });
    }

    const currentRaceIndex = Number(save.race) || 0;
    const annualExpenses   = Number(save.finances?.expenses) || 0;
    const gpOperatingCost  = Math.round((2.5 + annualExpenses / Math.max(1, F1Data.circuits.length)) * 10) / 10;
    save.budget  = Math.round(((Number(save.budget)||0) + reward + sponsorBonus - gpOperatingCost) * 10) / 10;
    if (save.budget < 0) { save.reputation = Math.max(0,(save.reputation||50)-3); save.budget = 0; }
    save.tokens  = (Number(save.tokens)||0) + tokens;
    save.race    = currentRaceIndex + 1;

    save.raceResults.push({
      season: save.season||2025, raceIndex: save.raceResults.length,
      circuitId: circuit?.id||null, circuitName: circuit?.name||'Circuit inconnu',
      date: new Date().toISOString(),
      reward: reward+sponsorBonus, operatingCost: gpOperatingCost,
      baseReward: reward, sponsorBonus, tokens,
      results: results.map(r => ({
        position: r.position, driverId: r.driver?.id||null, teamId: r.team?.id||null,
        points: r.points||0, totalTime: Number.isFinite(r.totalTime)?r.totalTime:null,
        gap: Number.isFinite(r.gap)?r.gap:null, status: r.status,
        dnfLap: r.dnfLap||null, bestLap: Number.isFinite(r.bestLap)?r.bestLap:null,
        pitStops: r.pitStops||[],
      })),
    });

    // ── FIN DE SAISON ─────────────────────────────────────────
    if (save.race >= F1Data.circuits.length) {
      const teamRank   = [...F1Data.teams].sort((a,b)=>(save.teamStandings[b.id]||0)-(save.teamStandings[a.id]||0));
      const playerPos  = teamRank.findIndex(t=>t.id===playerTeamId)+1;
      const champion   = [...F1Data.drivers].sort((a,b)=>(save.driverStandings[b.id]||0)-(save.driverStandings[a.id]||0))[0];
      const constrChamp= teamRank[0];

      // ── Revenus Concorde (proportionnels au classement) ─────
      const concordeRevs = F1Data.concordeRevenues || [120,100,85,72,62,54,46,38,30,22,15];
      const concordePrize= concordeRevs[Math.min(playerPos-1, concordeRevs.length-1)] || 15;

      save.completedSeasons = save.completedSeasons||[];
      save.completedSeasons.push({
        season: save.season||2025, playerConstructorPos: playerPos,
        driverChampionId: champion?.id, constructorChampionId: constrChamp?.id,
        prize: concordePrize,
      });

      // ── Recharge budget dynamique selon classement ──────────
      // Meilleur classement = plus de budget → boule de neige positive
      const budgetGrowth = Math.max(10, concordePrize * 0.15); // 15% des revenus Concorde
      const team = F1Data.teams.find(t=>t.id===playerTeamId);
      if (team) {
        team.budget = Math.round(Math.min(600, (team.budget||200) + budgetGrowth) * 10) / 10;
      }

      // ── Budget R&D rechargé selon le classement ─────────────
      const newRdBudget  = Math.round((team?.budget||200) * (F1Data.rdBudgetRatio||0.4));
      save.rdBudget      = newRdBudget;
      save.rdBudgetTotal = newRdBudget;

      // ── Changement de règlement ─────────────────────────────
      const nextSeason = (save.season||2025) + 1;
      const regulation = (F1Data.regulationCycles||[]).find(r=>r.season===nextSeason);
      if (regulation) {
        this.applyRegulationReset(save, regulation);
      }

      save.budget = Math.round((save.budget + concordePrize) * 10) / 10;
      // Tokens fin de saison : minimum 2 garanti + bonus classement
      save.tokens = (save.tokens||0) + Math.max(2, playerPos <= 3 ? 8 : playerPos <= 6 ? 5 : playerPos <= 10 ? 3 : 1);
      save.season = nextSeason;
      save.race   = 0;
      save.driverStandings = {};
      save.teamStandings   = {};
      save.raceResults     = [];
      // Fin de saison sponsors — versement final 30% + bonus/pénalités
      if (typeof Sponsors !== 'undefined') {
        const finalPayment = Math.round(totalSponsorAnnual * 0.30 * 10) / 10;
        save.budget = Math.round(((save.budget||0) + finalPayment) * 10) / 10;
        const result = Sponsors.endOfSeason(save, playerPos);
        if (save.news) save.news.push({ icon:'💰', category:'finance',
          title:'Versement sponsors — Fin de saison',
          text:`30% final : +${finalPayment}M€. Bonus objectifs : +${Math.max(0,result.bonuses)}M€. Contrats renouvelés : ${result.renewed}. Perdus : ${result.lost}.` });
      } else {
        (save.sponsors||[]).forEach(sp=>{ sp.progress=0; sp.paid=false; });
      }

      // Log info saison
      save._newSeasonBanner = `P${playerPos} constructeurs · ${concordePrize}M€ revenus Concorde${regulation?` · ⚠️ ${regulation.name} — nouveau règlement !`:''}`;
    }

    const ok = this.save(save);
    return ok ? { reward: reward + sponsorBonus,
      operatingCost: gpOperatingCost, baseReward: reward, sponsorBonus, tokens, save } : null;
  },

  // ── RESET RÉGLEMENTAIRE ───────────────────────────────────
  applyRegulationReset(save, regulation) {
    const resetFactor = regulation.resetFactor || 0.82;

    F1Data.teams.forEach(team => {
      // Calculer le bonus next year investi par le joueur
      const isPlayer = team.id === save.playerTeamId;
      let nextYearBonus = 0;

      if (isPlayer && save.nextYearDev) {
        Object.values(save.nextYearDev).forEach(inv => {
          nextYearBonus += (inv.gain || 0) * (F1Data.nextYearBonusMultiplier || 1.8);
        });
      }

      // IA : investissement simulé selon la richesse de l'équipe
      if (!isPlayer) {
        const richness = (team.budget||200) / 500; // 0 à 1
        nextYearBonus  = Math.round(richness * 15 + Math.random() * 10);
      }

      // Reset : base × resetFactor + bonus investissement
      const stats = ['aero','chassis','engine','reliability'];
      stats.forEach(stat => {
        const current = isPlayer ? (save.carDev?.[stat]?.level || team[stat]) : team[stat];
        const reset   = Math.round(current * resetFactor + nextYearBonus * 0.25);
        const newVal  = Math.max(45, Math.min(95, reset));

        if (isPlayer && save.carDev?.[stat]) {
          save.carDev[stat].level    = newVal;
          save.carDev[stat].done     = []; // reset upgrades
          save.carDev[stat].pending  = [];
        }
        team[stat] = newVal;
      });

      team.performance = Math.round((team.aero + team.chassis + team.engine) / 3);

      // Log news pour l'IA
      if (!isPlayer && nextYearBonus > 12) {
        if (typeof save.news === 'undefined') save.news = [];
        save.news.push({
          icon: '⚙️', category: 'technical',
          title: `${team.name} bien préparée pour ${regulation.season}`,
          text: `${team.name} a massivement investi dans le nouveau règlement. Performance de base : ${team.performance}.`,
        });
      }
    });

    // Reset next year dev après application
    save.nextYearDev = {};

    // Bannière règlement
    if (typeof save.news === 'undefined') save.news = [];
    save.news.push({
      icon: '📋', category: 'regulation',
      title: regulation.name,
      text: regulation.desc + ` Reset des performances (×${regulation.resetFactor}). Les équipes qui ont investi dans le nouveau concept partent avec un avantage.`,
    });
  },

  // ── AUTOSAVE ─────────────────────────────────────────────
  startAutosave(getData, intervalMs = 60000) {
    return setInterval(() => {
      const data = getData();
      if (data) this.save(data);
    }, intervalMs);
  },

};
