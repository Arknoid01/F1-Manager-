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
    const staffBonuses = save.staffBonuses || {};

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
      if (Object.prototype.hasOwnProperty.call(state, 'teamId') && state.teamId) d.teamId = state.teamId;
    });
  },

  persistDriverStates(save) {
    if (!save || typeof F1Data === 'undefined') return;
    save.driverStates = save.driverStates || {};
    F1Data.drivers.forEach(d => {
      const existing = save.driverStates[d.id];
      if (existing) {
        // Conserver les stats acquises — seulement mettre à jour les champs non-stats
        save.driverStates[d.id] = {
          ...existing,
          age: d.age, salary: d.salary, trait: d.trait,
          retired: d.retired, teamId: d.teamId,
          seasons: d.seasons || 0, contractYears: d.contractYears || 0,
          personality: d.personality,
          // Conserver potential et stats si déjà présents
          potential:    existing.potential    ?? d.potential,
          pace:         existing.pace         ?? d.pace,
          consistency:  existing.consistency  ?? d.consistency,
          wetSkill:     existing.wetSkill     ?? d.wetSkill,
          overtaking:   existing.overtaking   ?? d.overtaking,
          defending:    existing.defending    ?? d.defending,
        };
      } else {
        // Nouveau pilote — initialiser avec les valeurs de base
        save.driverStates[d.id] = {
          age: d.age, pace: d.pace, consistency: d.consistency, wetSkill: d.wetSkill,
          overtaking: d.overtaking, defending: d.defending, salary: d.salary,
          trait: d.trait, potential: d.potential, retired: d.retired, teamId: d.teamId,
          seasons: d.seasons || 0, contractYears: d.contractYears || 0, personality: d.personality,
        };
      }
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

    // -- PROGRESSION EN COURSE --
    // Gains très faibles — progression sur 2-3 saisons max
    try {
      if (!save.driverStates) save.driverStates = {};
      results.forEach(r => {
        const dId = (r.driver && r.driver.id) || r.driverId;
        if (!dId) return;
        const driver = F1Data.drivers.find(d => d.id === dId);
        if (!driver) return;
        // Initialiser si absent (save ancien ou premier GP)
        if (!save.driverStates[dId]) {
          save.driverStates[dId] = {
            pace: driver.pace, consistency: driver.consistency,
            wetSkill: driver.wetSkill, overtaking: driver.overtaking,
            defending: driver.defending, potential: driver.potential,
            age: driver.age, retired: driver.retired, teamId: driver.teamId,
          };
        }
        const state = save.driverStates[dId];

        const pot   = state.potential || driver.potential || 85;
        const age   = state.age       || driver.age       || 25;
        const pos   = r.position || 20;
        const isDnf = r.status === 'dnf';
        if (isDnf) return; // pas de progression sur abandon

        // Facteur age
        const ageFactor = age < 23 ? 1.5 : age < 29 ? 1.2 : age < 34 ? 0.8 : 0.3;
        // Facteur resultat
        const posFactor = pos <= 3 ? 1.5 : pos <= 6 ? 1.2 : pos <= 10 ? 1.0 : 0.7;
        // Gain de base par course : 0.10 à 0.25
        const baseGain  = (0.10 + Math.random() * 0.15) * ageFactor * posFactor;

        // Stat a ameliorer
        const statToImprove = pos <= 10
          ? (Math.random() < 0.6 ? 'pace' : 'consistency')
          : (Math.random() < 0.5 ? 'defending' : 'overtaking');

        const current = state[statToImprove] || driver[statToImprove] || 75;
        if (current >= pot) return; // plafond potentiel

        // Ralentir si proche du potentiel
        const gap       = pot - current;
        const gapFactor = gap <= 2 ? 0.3 : gap <= 5 ? 0.6 : 1.0;
        // Arrondir à 2 décimales pour éviter les gains nuls
        const finalGain = Math.round(baseGain * gapFactor * 100) / 100;

        if (finalGain >= 0.01) {
          state[statToImprove] = Math.min(pot, Math.round((current + finalGain) * 100) / 100);
          console.log('[Progression] ' + dId + ' ' + statToImprove + ' +' + finalGain + ' -> ' + state[statToImprove]);
        }

        // Regression legere apres 34 ans
        if (age >= 34 && Math.random() < 0.15) {
          const regStat = Math.random() < 0.5 ? 'pace' : 'consistency';
          const cur = state[regStat] || driver[regStat] || 75;
          state[regStat] = Math.max(cur - 0.1, Math.round(cur * 0.998 * 10) / 10);
        }
      });
    } catch(e) { console.warn('Progression pilotes:', e); }

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

    // ── FIN DE SAISON : ne PAS lancer l'intersaison ici ────────────
    // La course doit seulement enregistrer le dernier GP et marquer la saison
    // comme terminée. La vraie transition (vieillissement, contrats, mercato,
    // revenus annuels, reset championnats) est déclenchée depuis season-review.html
    // via Career.endOfSeason(save). Avant, cette fonction faisait déjà le reset :
    // la page bilan recevait donc une saison vide ou pouvait appliquer la fin
    // de saison deux fois.
    if (save.race >= F1Data.circuits.length) {
      const teamRank = [...F1Data.teams].sort((a,b)=>(save.teamStandings[b.id]||0)-(save.teamStandings[a.id]||0));
      const playerPos = teamRank.findIndex(t=>t.id===playerTeamId)+1;
      save.seasonFinished = true;
      save._seasonReadyForReview = true;
      save._newSeasonBanner = `Saison ${save.season||2025} terminée · P${playerPos || '?'} constructeurs · Revue annuelle disponible`;
      save.news = save.news || [];
      if (!save.news.some(n => n && n.id === `season_review_${save.season||2025}`)) {
        save.news.unshift({
          id:`season_review_${save.season||2025}`, icon:'🏁', category:'season',
          title:'Fin de saison',
          text:'Le dernier Grand Prix est terminé. La revue annuelle est disponible avant de lancer la prochaine saison.'
        });
      }
    }

    const ok = this.save(save);
    return ok ? { reward: reward + sponsorBonus,
      operatingCost: gpOperatingCost, baseReward: reward, sponsorBonus, tokens, save } : null;

    // -- GENERATION DISCUSSIONS SOCIALES POST-COURSE --
    // Genere une seule fois apres chaque GP
    try {
      this.generatePostRaceSocial(save, results, playerTeamId);
    } catch(e) { console.warn('Social gen:', e); }

    return null;
  },

  // -- GENERATION DISCUSSIONS SOCIALES POST-COURSE --
  // Appele une seule fois par recordRaceResults — genere 3-5 discussions structurees
  generatePostRaceSocial(save, results, playerTeamId) {
    if (!save || !playerTeamId) return;

    // Ne pas regenerer si deja fait pour ce GP
    const gpKey = `social_generated_gp_${save.race||0}_${save.season||2025}`;
    if (save[gpKey]) return;
    save[gpKey] = true;

    // Nettoyer les anciens events resolus pour ne garder que les non traites
    save.socialEvents = (save.socialEvents||[]).filter(e => !e.resolved);

    const drivers    = F1Data.drivers.filter(d => d.teamId && d.teamId === playerTeamId && !d.retired);
    const circuits   = F1Data.circuits || [];
    const nextCirc   = circuits[(save.race||0) % Math.max(1, circuits.length)];
    const race       = save.race || 0;
    const season     = save.season || 2025;
    const totalRaces = circuits.length;
    const pct        = race / Math.max(1, totalRaces);

    if (!save.socialEvents) save.socialEvents = [];

    const playerResults = results.filter(r => (r.team?.id || r.teamId) === playerTeamId);
    const bestPos       = playerResults.length ? Math.min(...playerResults.map(r => r.position||20)) : 20;
    const hasDnf        = playerResults.some(r => r.status === 'dnf');
    const hasPodium     = bestPos <= 3;
    const hasPoints     = bestPos <= 10;

    const events = [];

    // ── PHASE POST-COURSE (1-2 events) ──────────────────────
    drivers.forEach(d => {
      const dRes    = playerResults.find(r => (r.driver?.id || r.driverId) === d.id);
      const pos     = dRes?.position || 20;
      const isDnf   = dRes?.status === 'dnf';
      const moral   = save.immersion?.driverMorale?.[d.id]?.value ?? 70;
      const loyalty = save.driverLoyalty?.[d.id] ?? 50;

      // Garantir 1 event post-course par pilote
      // Priorite : DNF > podium > points > moral bas > result generique
      if (isDnf) {
        const texts = [
          `${d.firstName} est silencieux dans le motorhome depuis l'abandon. Personne n'ose lui parler. C'est a vous de faire le premier pas.`,
          `La radio de ${d.firstName} est coupee depuis l'arrivee au garage. Son mecanicien vous fait signe du regard — il faut intervenir.`,
          `${d.firstName} est assis seul sur le muret des stands, casque entre les mains. La deception est palpable.`,
        ];
        events.push({
          id: `post_dnf_${d.id}_${race}`,
          driverId: d.id, phase: 'post', type: 'driver',
          trigger: 'Abandon',
          text: texts[race % texts.length],
          choices: [
            { text: "Tu n'y es pour rien. La mecanique nous a laches — on va regler ca.", effect: {moral:+10, confiance:+6, loyalty:+4}, choiceType:'positive' },
            { text: "Raconte-moi ce qui s'est passe depuis ton point de vue.", effect: {moral:+4, confiance:+8}, choiceType:'neutral' },
            { text: "Ce genre d'abandon nous coute des points precieux. On doit faire mieux.", effect: {moral:-8, confiance:-5, loyalty:-3}, choiceType:'negative' },
          ]
        });
      } else if (pos <= 3) {
        const texts = [
          `${d.firstName} arrive dans votre bureau, sourire aux levres. P${pos}. L'equipe est en feu. Il attend votre reaction.`,
          `Le debriefing vient de se terminer. ${d.firstName} est en pleine confiance — c'est le moment de capitaliser.`,
          `P${pos} pour ${d.firstName}. Les sponsors appellent deja. Comment gerez-vous ce moment ?`,
        ];
        events.push({
          id: `post_podium_${d.id}_${race}`,
          driverId: d.id, phase: 'post', type: 'driver',
          trigger: `P${pos}`,
          text: texts[race % texts.length],
          choices: [
            { text: "Une performance magistrale. Tu as tout donne et ca se voit.", effect: {moral:+8, confiance:+6, loyalty:+5}, choiceType:'positive' },
            { text: "Excellent. Maintenant on ne relache pas la pression.", effect: {moral:+4, confiance:+4, pace:+2}, choiceType:'neutral' },
            { text: "Bon resultat mais j'ai vu des details a corriger pour la prochaine fois.", effect: {moral:-2, confiance:+3, pace:+3}, choiceType:'negative' },
          ]
        });
      } else if (pos <= 10) {
        events.push({
          id: `post_points_${d.id}_${race}`,
          driverId: d.id, phase: 'post', type: 'driver',
          trigger: `P${pos}`,
          text: `${d.firstName} est pragmatique apres son P${pos}. Points pris, voiture dans le mur, course propre. Il vient vous voir avant de quitter le circuit.`,
          choices: [
            { text: "Travail propre et efficace. C'est exactement ce qu'on attendait.", effect: {moral:+6, confiance:+5, loyalty:+3}, choiceType:'positive' },
            { text: "P${pos} c'est correct. On a encore de la marge pour progresser.", effect: {moral:+2, confiance:+3}, choiceType:'neutral' },
            { text: "Honnêtement on meritait mieux. Il y avait des opportunites ratees.", effect: {moral:-4, confiance:-2, pace:+2}, choiceType:'negative' },
          ]
        });
      } else if (moral < 45) {
        events.push({
          id: `post_low_moral_${d.id}_${race}`,
          driverId: d.id, phase: 'post', type: 'driver',
          trigger: 'Passage difficile',
          text: `${d.firstName} n'est pas en grande forme ces derniers temps. P${pos} aujourd'hui, et quelque chose semble peser. Son mecanicien rapporte qu'il a quitte le garage sans debriefing.`,
          choices: [
            { text: "Je t'ai observe en course — je sais que tu peux faire bien mieux. Qu'est-ce qui se passe ?", effect: {moral:+10, confiance:+8, loyalty:+5}, choiceType:'positive' },
            { text: "On va analyser les donnees ensemble et repartir de zero.", effect: {moral:+5, confiance:+6, pace:+1}, choiceType:'neutral' },
            { text: "Ces resultats ne sont pas acceptables. Il faut que ca change rapidement.", effect: {moral:-8, confiance:-6, loyalty:-4, pace:+3}, choiceType:'negative' },
          ]
        });
      } else {
        // Fallback garanti — resultat quelconque
        const fallbackTexts = [
          `Le debriefing vient de se terminer. ${d.firstName} vous croise dans le couloir en sortant du garage. Un regard, quelques mots suffisent parfois.`,
          `${d.firstName} range ses affaires apres la course. P${pos}. Il leve les yeux quand vous entrez dans le garage.`,
          `Fin de course. ${d.firstName} signe quelques autographes puis revient vers le motorhome. Il vous fait signe d'approcher.`,
        ];
        events.push({
          id: `post_result_${d.id}_${race}`,
          driverId: d.id, phase: 'post', type: 'driver',
          trigger: `P${pos}`,
          text: fallbackTexts[race % fallbackTexts.length],
          choices: [
            { text: "Bonne course. On repart de ca pour le prochain GP.", effect: {moral:+5, confiance:+4, loyalty:+2}, choiceType:'positive' },
            { text: "P${pos}. Pas parfait mais on avance. On en parle demain.", effect: {moral:+2, confiance:+2}, choiceType:'neutral' },
            { text: "Je t'attends au debriefing demain matin. On a des choses a revoir.", effect: {moral:-3, confiance:+2, pace:+1}, choiceType:'negative' },
          ]
        });
      }
    });

    // ── PHASE TECHNIQUE (1-2 events ingenieur) ──────────────
    const engExisting = events.filter(e => e.phase === 'tech').length;
    if (engExisting === 0) {
      const techOptions = [];

      // Fiabilite si DNF
      if (hasDnf) {
        techOptions.push({
          id: `tech_reliability_${race}`,
          driverId: 'engineer', phase: 'tech', type: 'engineer',
          trigger: 'Analyse fiabilite',
          text: `Votre chef mecanicien a passe la nuit a analyser l'abandon. Il identifie deux options pour le prochain GP : changer la piece concernee au risque d'une penalite de grille, ou rouler avec le risque d'un nouvel abandon.`,
          choices: [
            { text: "On change. Une penalite de 5 places vaut mieux qu'un deuxieme abandon.", effect: {moral:+3, confiance:+5, penaltyGrid:true}, choiceType:'positive' },
            { text: "On surveille de pres et on decide jeudi apres les donnees EL.", effect: {moral:+1, confiance:+2}, choiceType:'neutral' },
            { text: "On prend le risque. La grille de depart ne se negocie pas.", effect: {dnfRisk:true, moral:-2}, choiceType:'negative' },
          ]
        });
      }

      // Analyse post-course standard
      const postAnalysis = [
        `Votre ingenieur de piste vient de compiler les donnees de la course. Il y a une piste serieuse d'amelioration sur le comportement en freinage tardif. Votre feu vert est necessaire pour lancer le travail.`,
        `L'analyse post-course est prete. Les donnees montrent que l'on perd principalement dans les virages lents — setup ou pilotage, la question se pose. L'ingenieur attend votre decision sur l'orientation.`,
        `Debriefing termine. Votre ingenieur a identifie un gain potentiel sur la gestion thermique des pneus. Cela necessite un changement de protocole pour le prochain week-end.`,
      ];
      techOptions.push({
        id: `tech_debrief_${race}`,
        driverId: 'engineer', phase: 'tech', type: 'engineer',
        trigger: 'Debriefing technique',
        text: postAnalysis[race % postAnalysis.length],
        choices: [
          { text: "Lancez le travail. On integre ca au programme du prochain week-end.", effect: {pace:+2, confiance:+3, tokenBonus:0}, choiceType:'positive' },
          { text: "Interessant. On fait un point apres les EL du prochain GP avant de valider.", effect: {pace:+1}, choiceType:'neutral' },
          { text: "On a d'autres priorites pour l'instant. Gardez ca en reserve.", effect: {}, choiceType:'negative' },
        ]
      });

      // R&D tous les 4 GP
      if (race % 4 === 0 && race > 0) {
        const domains = ['aero','chassis','engine','reliability'];
        const labels  = {aero:'aerodynamique',chassis:'chassis',engine:'moteur',reliability:'fiabilite'};
        const dom     = domains[race % domains.length];
        techOptions.push({
          id: `tech_rd_${race}`,
          driverId: 'engineer', phase: 'tech', type: 'engineer',
          trigger: 'Opportunite R&D',
          text: `L'equipe technique a identifie une piste de developpement sur le ${labels[dom]} suite aux donnees de ce GP. Les ressources sont disponibles mais limitees.`,
          choices: [
            { text: "On investit. C'est exactement le genre d'opportunite qu'on cherchait.", effect: {rdBonus:dom, tokenBonus:+1}, choiceType:'positive' },
            { text: "Donnez-moi les projections detaillees avant que je valide.", effect: {}, choiceType:'neutral' },
            { text: "Pas maintenant. On concentre les ressources ailleurs.", effect: {}, choiceType:'negative' },
          ]
        });
      }

      // Briefing pneus prochain circuit
      if (nextCirc) {
        const highDeg = nextCirc.tyreDegradation > 1.2;
        techOptions.push({
          id: `tech_tyres_${race}`,
          driverId: 'engineer', phase: 'tech', type: 'engineer',
          trigger: `Preparation ${nextCirc.name || 'prochain GP'}`,
          text: `Premier briefing sur le prochain circuit. La degradation des pneus est ${highDeg ? 'elevee — les simulations privilegient deux arrets' : 'moderee — un seul arret bien gere semble optimal'}. Comment orientez-vous la preparation ?`,
          choices: [
            { text: highDeg ? "Deux arrets. On optimise chaque relance plutot que de subir la degradation." : "Un arret. On maximise le rythme et on gere.", effect: {setupBonus:'race', moral:+2}, choiceType:'positive' },
            { text: "On reste ouverts aux deux options et on decide selon la meteo du vendredi.", effect: {}, choiceType:'neutral' },
            { text: "On attaque avec les Softs des le depart et on verra.", effect: {setupBonus:'qualify'}, choiceType:'negative' },
          ]
        });
      }

      // Choisir 1-2 events technique selon le contexte
      if (hasDnf) {
        events.push(techOptions[0]); // fiabilite en priorite
        if (techOptions.length > 2) events.push(techOptions[techOptions.length-1]); // + pneus
      } else {
        // Un debrief + un pneus ou RD
        events.push(techOptions.find(e=>e.id.includes('debrief')) || techOptions[0]);
        const extra = techOptions.find(e=>e.id.includes('rd') || e.id.includes('tyres'));
        if (extra) events.push(extra);
      }
    }

    // ── PHASE PRE-COURSE (1 event) ───────────────────────────
    if (drivers.length > 0) {
      const d = drivers[Math.floor(Math.random() * drivers.length)];
      const driverPts = save.driverStandings?.[d.id] || 0;
      const loyalty   = save.driverLoyalty?.[d.id] ?? 50;
      const nextName  = nextCirc?.name || 'le prochain Grand Prix';

      let preEvent = null;

      // Arc narratif selon la phase de saison
      if (pct < 0.22 && !save[`arc_start_${d.id}_${season}`]) {
        save[`arc_start_${d.id}_${season}`] = true;
        preEvent = {
          id: `pre_arc_start_${d.id}_${season}`,
          driverId: d.id, phase: 'pre', type: 'driver',
          trigger: 'Debut de saison',
          text: `${d.firstName} vient vous voir dans votre bureau. "On a fait quoi comme objectifs cette saison ?" La question est posee calmement mais elle compte.`,
          choices: [
            { text: "On vise le top 5 constructeurs minimum. Et on se bat pour chaque point.", effect: {moral:+8, confiance:+6, loyalty:+5}, choiceType:'positive' },
            { text: "On progresse GP apres GP. Pas d'objectif chiffre — juste la performance.", effect: {moral:+4, confiance:+4}, choiceType:'neutral' },
            { text: "L'objectif c'est d'etre competitif a chaque sortie. Le classement suivra.", effect: {moral:+2, confiance:+3, pace:+1}, choiceType:'negative' },
          ]
        };
      } else if (pct >= 0.48 && pct < 0.70 && !save[`arc_tension_${d.id}_${season}`]) {
        save[`arc_tension_${d.id}_${season}`] = true;
        preEvent = {
          id: `pre_arc_tension_${d.id}_${season}`,
          driverId: d.id, phase: 'pre', type: 'driver',
          trigger: 'Phase cruciale',
          text: `On arrive dans le coeur de la saison. ${d.firstName} vous prend a part : "Les prochains GP vont tout decider. Je veux savoir jusqu'ou tu es pret a pousser cette voiture."`,
          choices: [
            { text: "On attaque. Setup agressif, strategie audacieuse — on ne gere pas.", effect: {moral:+6, confiance:+5, pace:+3, dnfRisk:true}, choiceType:'positive' },
            { text: "On joue nos forces. Regularite et saisir les opportunites.", effect: {moral:+4, confiance:+5, pace:+1}, choiceType:'neutral' },
            { text: "On securise les points. On prend zero risque inutile.", effect: {moral:+2, confiance:+3, pace:-1}, choiceType:'negative' },
          ]
        };
      } else if (pct >= 0.87 && !save[`arc_end_${d.id}_${season}`]) {
        save[`arc_end_${d.id}_${season}`] = true;
        preEvent = {
          id: `pre_arc_end_${d.id}_${season}`,
          driverId: d.id, phase: 'pre', type: 'driver',
          trigger: 'Derniers GP de la saison',
          text: `Il ne reste que quelques courses. ${d.firstName} vous dit simplement : "C'est la derniere ligne droite. Je veux qu'on finisse fort ensemble."`,
          choices: [
            { text: "On finit comme on a commence — tout donner. Carte blanche.", effect: {moral:+12, confiance:+10, loyalty:+8, pace:+3}, choiceType:'positive' },
            { text: "On reste concentres. Chaque point compte jusqu'au bout.", effect: {moral:+6, confiance:+6, pace:+2}, choiceType:'neutral' },
            { text: "On protege notre classement. La prudence d'abord.", effect: {moral:+2, confiance:+3, pace:-1}, choiceType:'negative' },
          ]
        };
      } else {
        // Event pré-course contextuel
        const preTexts = [
          `${d.firstName} passe la tete dans votre bureau la veille du depart pour ${nextName}. "On est prets ?" Il attend votre leadership avant de monter dans l'avion.`,
          `Avant de quitter le paddock, ${d.firstName} vous croise dans le couloir. "Le prochain circuit me convient bien. On peut viser plus haut ?" Sa confiance est visible.`,
          `${d.firstName} vous envoie un message depuis l'hotel : il a regarde des donnees de qualification sur ${nextName} et a des idees. Il veut en discuter.`,
        ];
        preEvent = {
          id: `pre_generic_${d.id}_${race}`,
          driverId: d.id, phase: 'pre', type: 'driver',
          trigger: `Avant ${nextName}`,
          text: preTexts[race % preTexts.length],
          choices: [
            { text: "Plus que prets. On va chercher le maximum la-bas.", effect: {moral:+7, confiance:+5, loyalty:+3}, choiceType:'positive' },
            { text: "On fait notre travail et on reste concentres sur nos points forts.", effect: {moral:+3, confiance:+3}, choiceType:'neutral' },
            { text: "On se concentre d'abord sur les EL avant de fixer des objectifs.", effect: {moral:+1, confiance:+2}, choiceType:'negative' },
          ]
        };
      }

      if (preEvent) events.push(preEvent);
    }

    // ── EVENT D'ESCALADE PRIORITAIRE ────────────────────────
    drivers.forEach(d => {
      const loyalty = save.driverLoyalty?.[d.id] ?? 50;
      const moral   = save.immersion?.driverMorale?.[d.id]?.value ?? 70;
      const history = (save.socialHistory||[]).filter(h => h.driverName?.includes(d.name));
      const hardCount = history.slice(0,5).filter(h=>h.choiceType==='negative').length;

      if (hardCount >= 2 && loyalty < 35 && !save[`esc_threat_${d.id}_${season}`]) {
        save[`esc_threat_${d.id}_${season}`] = true;
        events.unshift({
          id: `esc_threat_${d.id}_${season}`,
          driverId: d.id, phase: 'post', type: 'escalation', urgent: true,
          trigger: 'Situation critique',
          text: `${d.firstName} ${d.name} a demande un entretien prive d'urgence. Son agent est en contact avec deux equipes. Les tensions des derniers GP ont fragilise la relation. Il est temps de clarifier.`,
          choices: [
            { text: "J'ai fait des erreurs de management. On repart sur une base saine.", effect: {moral:+15, confiance:+12, loyalty:+15}, choiceType:'positive' },
            { text: "Je t'offre une prolongation avec une revalorisation. Tu es notre avenir.", effect: {moral:+10, confiance:+8, loyalty:+10, contractSignal:true}, choiceType:'neutral' },
            { text: "Si les conditions ne te conviennent plus, je comprends. Chacun ses choix.", effect: {moral:-15, confiance:-15, loyalty:-20}, choiceType:'negative' },
          ]
        });
      }
    });

    // Ajouter tous les events au save
    events.forEach(ev => {
      if (!save.socialEvents.find(e => e.id === ev.id)) {
        save.socialEvents.push({...ev, read: false, resolved: false});
      }
    });
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

