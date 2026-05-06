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
      this.applyDriverStates(save);
      return save;
    } catch (e) {
      console.error('[Save] Erreur chargement:', e);
      return null;
    }
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
    const reward        = 5 + teamPoints + (bestPosition <= 3 ? 12 : bestPosition <= 10 ? 5 : 0);
    const tokens        = 1 + (teamPoints > 0 ? 1 : 0) + (bestPosition <= 3 ? 1 : 0);

    // Progression sponsors : on valide les objectifs progressivement après chaque GP.
    let sponsorBonus = 0;
    (save.sponsors || []).forEach(sp => {
      if (sp.paid) return;
      if (sp.type === 'races') sp.progress = Math.min(sp.target, (sp.progress || 0) + 1);
      if (sp.type === 'top10' && bestPosition <= 10) sp.progress = Math.min(sp.target, (sp.progress || 0) + 1);
      if (sp.type === 'podium' && bestPosition <= 3) sp.progress = Math.min(sp.target, (sp.progress || 0) + 1);
      if (sp.type === 'points' && teamPoints > 0) sp.progress = Math.min(sp.target, (sp.progress || 0) + teamPoints);
      if (sp.progress >= sp.target) { sp.paid = true; sponsorBonus += Number(sp.value) || 0; }
    });

    const currentRaceIndex = Number(save.race) || 0;
    
    // Économie plus profonde : frais fixes par GP + salaires annualisés + budget cap simplifié.
    const annualExpenses = Number(save.finances?.expenses) || 0;
    const gpOperatingCost = Math.round((2.5 + annualExpenses / Math.max(1, F1Data.circuits.length)) * 10) / 10;
    save.budget = Math.round(((Number(save.budget) || 0) + reward + sponsorBonus - gpOperatingCost) * 10) / 10;
    if (save.budget < 0) { save.reputation = Math.max(0, (save.reputation || 50) - 3); save.budget = 0; }
    save.tokens = (Number(save.tokens) || 0) + tokens;
    save.race   = currentRaceIndex + 1;

    save.raceResults.push({
      season: save.season || 2025,
      raceIndex: save.raceResults.length,
      circuitId: circuit ? circuit.id : null,
      circuitName: circuit ? circuit.name : 'Circuit inconnu',
      date: new Date().toISOString(),
      reward: reward + sponsorBonus,
      operatingCost: gpOperatingCost,
      baseReward: reward,
      sponsorBonus,
      tokens,
      results: results.map(r => ({
        position: r.position,
        driverId: r.driver ? r.driver.id : null,
        teamId: r.team ? r.team.id : null,
        points: r.points || 0,
        totalTime: Number.isFinite(r.totalTime) ? r.totalTime : null,
        gap: Number.isFinite(r.gap) ? r.gap : null,
        status: r.status,
        dnfLap: r.dnfLap || null,
        bestLap: Number.isFinite(r.bestLap) ? r.bestLap : null,
        pitStops: r.pitStops || [],
      })),
    });

    // Fin de saison : archive le palmarès, verse les primes, puis relance une année.
    if (save.race >= F1Data.circuits.length) {
      const teamRank = [...F1Data.teams].sort((a,b)=>(save.teamStandings[b.id]||0)-(save.teamStandings[a.id]||0));
      const playerPos = teamRank.findIndex(t => t.id === playerTeamId) + 1;
      const champion = [...F1Data.drivers].sort((a,b)=>(save.driverStandings[b.id]||0)-(save.driverStandings[a.id]||0))[0];
      const constructorChampion = teamRank[0];
      const prize = Math.max(20, 120 - (playerPos - 1) * 10);
      save.completedSeasons = save.completedSeasons || [];
      save.completedSeasons.push({ season: save.season || 2025, playerConstructorPos: playerPos, driverChampionId: champion?.id, constructorChampionId: constructorChampion?.id, prize });
      save.season = (save.season || 2025) + 1;
      save.race = 0;
      save.budget = Math.round((save.budget + prize) * 10) / 10;
      save.tokens = (save.tokens || 0) + 6;
      save.driverStandings = {};
      save.teamStandings = {};
      save.raceResults = [];  // ← RESET les résultats pour la nouvelle saison
      (save.sponsors || []).forEach(sp => { sp.progress = 0; sp.paid = false; });
    }

    const ok = this.save(save);
    return ok ? { reward: reward + sponsorBonus,
      operatingCost: gpOperatingCost, baseReward: reward, sponsorBonus, tokens, save } : null;
  },

  // ── AUTOSAVE ─────────────────────────────────────────────
  startAutosave(getData, intervalMs = 60000) {
    return setInterval(() => {
      const data = getData();
      if (data) this.save(data);
    }, intervalMs);
  },

};
