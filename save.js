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

      this.migrateSponsorSeasonProgress(save);
      this.applyDriverStates(save);
      this.applyTeamDevelopment(save);
      return save;
    } catch (e) {
      console.error('[Save] Erreur chargement:', e);
      return null;
    }
  },


  migrateSponsorSeasonProgress(save) {
    if (!save || !Array.isArray(save.sponsors)) return;
    const season = Number(save.season || 2025);

    save.sponsors.forEach(sp => {
      const clauses = sp.clauses || [];
      const hasOldProgress = clauses.some(cl =>
        Number(cl.progress || 0) !== 0 ||
        cl.bonusPaid || cl.paid || cl.completed ||
        (cl.bonusObjective && (
          Number(cl.bonusObjective.progress || 0) !== 0 ||
          cl.bonusObjective.paid || cl.bonusObjective.bonusPaid ||
          cl.bonusObjective.completed || cl.bonusObjective.unlocked
        ))
      );

      if (sp._progressSeason !== season && ((save.race || 0) <= 1 || hasOldProgress)) {
        sp.progress = 0;
        sp.paid = false;
        sp.satisfied = true;
        sp._progressSeason = season;

        clauses.forEach(cl => {
          cl.progress = 0;
          cl.bonusPaid = false;
          cl.paid = false;
          cl.completed = false;
          cl.satisfied = false;

          if (cl.bonusObjective && typeof cl.bonusObjective === 'object') {
            cl.bonusObjective.progress = 0;
            cl.bonusObjective.paid = false;
            cl.bonusObjective.bonusPaid = false;
            cl.bonusObjective.completed = false;
            cl.bonusObjective.satisfied = false;
            cl.bonusObjective.unlocked = false;
          }
        });
      }
    });
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



  // ── SYNCHRO VOITURE JOUEUR / R&D / STAFF ─────────────────
  // Les pages lisent souvent directement F1Data.teams. On applique ici
  // la valeur finale partout : base sauvegardée + R&D + bonus staff.
  applyTeamDevelopment(save) {
    if (!save || typeof F1Data === 'undefined' || !Array.isArray(F1Data.teams) || !save.playerTeamId) return;
    const team = F1Data.teams.find(t => String(t.id) === String(save.playerTeamId));
    if (!team) return;

    const stats = ['aero','chassis','engine','reliability'];
    save._carBreakdown = save._carBreakdown || {};

    // Sécurité d'équilibrage : les anciens staffs générés pouvaient sauvegarder des bonus énormes (+7/+9).
    // On limite l'effet total du staff sur les stats voiture pour que la R&D reste importante.
    const staffBonuses = save.staffBonuses || {};
    ['aero','chassis','engine','reliability'].forEach(stat => {
      if (staffBonuses[stat] != null) staffBonuses[stat] = Math.max(0, Math.min(6, Number(staffBonuses[stat]) || 0));
    });

    stats.forEach(stat => {
      const originalBase = save.carDev?.[stat]?.base ?? team[stat] ?? 70;
      if (save.carDev?.[stat] && save.carDev[stat].base == null) save.carDev[stat].base = originalBase;
      const rdLevel = Number(save.carDev?.[stat]?.level ?? originalBase);
      const staff = Number(staffBonuses[stat] || 0);
      const finalValue = Math.max(1, Math.min(100, Math.round((rdLevel + staff) * 10) / 10));
      save._carBreakdown[stat] = {
        base: originalBase,
        rd: Math.round((rdLevel - originalBase) * 10) / 10,
        staff,
        final: finalValue
      };
      team[stat] = finalValue;
    });

    team.performance = Math.round(((team.aero || 0) + (team.chassis || 0) + (team.engine || 0)) / 3);
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



  // ── PROGRESSION PILOTES APRÈS COURSE ─────────────────────
  // Applique de petits gains persistants après chaque GP.
  // Le plafond est le potentiel du pilote : plus il s'en approche,
  // plus la progression ralentit.
  progressDriversAfterRace(save, results) {
    if (!save || typeof F1Data === 'undefined' || !Array.isArray(results)) return [];

    save.driverStates = save.driverStates || {};
    const progressed = [];
    const stats = ['pace', 'consistency', 'wetSkill', 'overtaking', 'defending'];

    results.forEach(r => {
      const d = r.driver;
      if (!d || !d.id) return;
      if (r.status && String(r.status).toLowerCase().includes('dnf')) return;

      const state = save.driverStates[d.id] || {
        age: d.age, pace: d.pace, consistency: d.consistency, wetSkill: d.wetSkill,
        overtaking: d.overtaking, defending: d.defending, salary: d.salary,
        trait: d.trait, potential: d.potential, retired: d.retired, teamId: d.teamId,
        seasons: d.seasons || 0, contractYears: d.contractYears || 0, personality: d.personality,
      };

      const potential = Number(state.potential ?? d.potential ?? 90);
      const avg = stats.reduce((sum, st) => sum + Number(state[st] ?? d[st] ?? 75), 0) / stats.length;
      const room = Math.max(0, potential - avg);
      if (room <= 0.05) {
        save.driverStates[d.id] = state;
        return;
      }

      const age = Number(state.age ?? d.age ?? 28);
      const youngMult = age <= 21 ? 1.45 : age <= 24 ? 1.25 : age <= 28 ? 1.0 : age <= 33 ? 0.65 : 0.35;
      const pos = Number(r.position || 20);
      const resultMult = pos <= 3 ? 1.25 : pos <= 10 ? 1.05 : 0.85;
      const traitMult = state.trait === 'prodigy' ? 1.25 : 1;
      const roomMult = Math.min(1.25, Math.max(0.25, room / 10));

      // 1 à 2 stats progressent par course, avec de petits gains visibles sur la durée.
      const pool = ['pace', 'consistency', 'overtaking', 'defending'];
      if (Math.random() < 0.25) pool.push('wetSkill');
      const first = pool[Math.floor(Math.random() * pool.length)];
      const selected = [first];
      if (Math.random() < 0.25) {
        const second = pool.filter(st => st !== first)[Math.floor(Math.random() * (pool.length - 1))];
        if (second) selected.push(second);
      }

      const gains = [];
      selected.forEach(st => {
        const current = Number(state[st] ?? d[st] ?? 75);
        if (current >= potential) return;
        const rawGain = (0.06 + Math.random() * 0.12) * youngMult * resultMult * traitMult * roomMult;
        const gain = Math.round(Math.min(0.3, rawGain) * 10) / 10;
        if (gain <= 0) return;
        const next = Math.min(potential, Math.round((current + gain) * 10) / 10);
        if (next > current) {
          state[st] = next;
          d[st] = next;
          gains.push({ stat: st, gain: Math.round((next - current) * 10) / 10 });
        }
      });

      save.driverStates[d.id] = state;
      if (gains.length) progressed.push({ driver: d, teamId: state.teamId || d.teamId, gains });
    });

    const playerProgress = progressed.filter(p => p.teamId === save.playerTeamId);
    if (playerProgress.length) {
      save.news = save.news || [];
      playerProgress.forEach(p => {
        const labels = { pace:'Pace', consistency:'Régularité', wetSkill:'Pluie', overtaking:'Dépassement', defending:'Défense' };
        save.news.unshift({
          icon: '📈', category: 'driver',
          title: `Progression — ${p.driver.firstName || ''} ${p.driver.name}`.trim(),
          text: p.gains.map(g => `${labels[g.stat] || g.stat} +${g.gain}`).join(' · '),
        });
      });
      save.news = save.news.slice(0, 30);
    }

    return progressed;
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

    // Progression réelle des pilotes après le GP, enregistrée dans driverStates.
    this.progressDriversAfterRace(save, results);

    const playerResults = results.filter(r => r.team && r.team.id === playerTeamId);
    const bestPosition  = playerResults.length ? Math.min(...playerResults.map(r => r.position)) : 20;
    const teamPoints    = playerResults.reduce((sum, r) => sum + (r.points || 0), 0);

    // Récompense course de base
    const reward = 2 + Math.round(teamPoints * 0.3) + (bestPosition <= 3 ? 3 : bestPosition <= 10 ? 1 : 0);

    // Tokens performance-based + 0.5 garanti (demi-token = 1 token tous les 2 GP)
    // Nerf v2 : gains réduits pour allonger la progression R&D
    // Petite équipe : ~12-15/saison → 1-2 domaines par saison max
    // Top équipe    : ~25-30/saison → peut développer 2-3 domaines
    const tokens = (Math.random() < 0.5 ? 1 : 0)  // 1 garanti sur 2 GP (demi-token)
                 + (teamPoints > 0 ? 1 : 0)         // top 10 = +1
                 + (bestPosition <= 5  ? 1 : 0);    // top 5  = +1 (max 3/course)

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
    // Coûts opérationnels croissants par saison (+4%/an, plafonné à +30%)
    const opMult = save._opCostMultiplier || 1.0;
    const gpOperatingCost  = Math.round((2.5 + annualExpenses / Math.max(1, F1Data.circuits.length)) * opMult * 10) / 10;
    save.budget  = Math.round(((Number(save.budget)||0) + reward + sponsorBonus - gpOperatingCost) * 10) / 10;
    // Budget plancher par course : minimum 0 (le plancher annuel est géré en fin de saison)
    if (save.budget < 0) { save.reputation = Math.max(0,(save.reputation||50)-3); save.budget = 0; }
    // Upgrade low-cost toujours disponible si budget < 15M (filet de sécurité mid-saison)
    if ((save.budget||0) < 15) save._safetyUpgradeAvailable = true;
    save.tokens  = (Number(save.tokens)||0) + tokens;
    save.race    = currentRaceIndex + 1;

    save.raceResults.push({
      season: save.season||2025, raceIndex: currentRaceIndex,
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


function resetSponsorObjectivesForNewSeason(career){
  if(!career || !Array.isArray(career.sponsors)) return career;

  career.sponsors.forEach(sponsor=>{
    sponsor.progress = 0;
    sponsor.paid = false;
    sponsor.satisfied = false;

    if(Array.isArray(sponsor.clauses)){
      sponsor.clauses.forEach(clause=>{
        clause.progress = 0;
        clause.bonusPaid = false;
        clause.paid = false;
        clause.completed = false;
        clause.satisfied = false;

        if(clause.bonusObjective && typeof clause.bonusObjective === "object"){
          clause.bonusObjective.progress = 0;
          clause.bonusObjective.paid = false;
          clause.bonusObjective.bonusPaid = false;
          clause.bonusObjective.completed = false;
          clause.bonusObjective.satisfied = false;
          if("unlocked" in clause.bonusObjective){
            clause.bonusObjective.unlocked = false;
          }
        }
      });
    }
  });

  return career;
}

