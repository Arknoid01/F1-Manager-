// ============================================================
//  F1 Manager — events.js  (v2 — événements enrichis)
//  Événements carrière, objectifs direction, news center
// ============================================================

const CareerEvents = {
  KEY_LAST_PRE: '_lastPreEventRaceKey',

  rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; },

  ensure(save) {
    save.news          = save.news          || [];
    save.reputation    = Number.isFinite(save.reputation) ? save.reputation : 50;
    save.driverEffects = save.driverEffects || {};
    save.contracts     = save.contracts     || {};
    save.aiDevelopment = save.aiDevelopment || {};
    save.boardObjectives = save.boardObjectives || this.generateObjectives(save);
    save.boardPressure = Number.isFinite(save.boardPressure) ? save.boardPressure : 0;
    save.fanBase       = Number.isFinite(save.fanBase) ? save.fanBase : 50;

    // Couche narrative persistante, volontairement douce sur l'équilibrage.
    save.notifications = Array.isArray(save.notifications) ? save.notifications : [];
    save.storyWorld = save.storyWorld || {};
    save.storyWorld.memory = Array.isArray(save.storyWorld.memory) ? save.storyWorld.memory : [];
    save.storyWorld.rivalries = Array.isArray(save.storyWorld.rivalries) ? save.storyWorld.rivalries : [];
    save.storyWorld.relationships = save.storyWorld.relationships || {};
    save.storyWorld.teamIdentity = save.storyWorld.teamIdentity || { strategy:0, development:0, reliability:0, media:0, academy:0 };
    save.storyWorld.cooldowns = save.storyWorld.cooldowns || {};
    return save;
  },

  teamDrivers(save) {
    return F1Data.drivers.filter(d => d.teamId === save.playerTeamId);
  },

  // ── NEWS LOG ──────────────────────────────────────────────
  log(save, item) {
    this.ensure(save);
    save.news.unshift({
      date:   new Date().toISOString(),
      season: save.season,
      race:   save.race,
      ...item
    });
    save.news = save.news.slice(0, 50);
  },

  // ── EFFETS TEMPORAIRES SUR PILOTES ────────────────────────
  applyDriverEffect(save, driverId, effect) {
    this.ensure(save);
    const cur = save.driverEffects[driverId] || {
      pace:0, consistency:0, wetSkill:0, overtaking:0, defending:0, races:0, label:''
    };
    ['pace','consistency','wetSkill','overtaking','defending']
      .forEach(k => cur[k] = (cur[k]||0) + (effect[k]||0));
    cur.races = Math.max(cur.races||0, effect.races||1);
    cur.label = effect.label || cur.label;
    save.driverEffects[driverId] = cur;
  },

  decayEffects(save) {
    this.ensure(save);
    Object.keys(save.driverEffects).forEach(id => {
      save.driverEffects[id].races = (save.driverEffects[id].races||0) - 1;
      if (save.driverEffects[id].races <= 0) delete save.driverEffects[id];
    });
  },

  // ── OBJECTIFS DIRECTION (BOARD) ───────────────────────────
  generateObjectives(save) {
    const team  = F1Data.teams.find(t => t.id === save?.playerTeamId);
    const perf  = team?.performance || 70;
    const season = save?.season || 2025;

    // Objectifs calibrés selon le niveau de l'équipe
    let constructorTarget, driverTarget, minRaces, budgetTarget;

    if (perf >= 90) {
      constructorTarget = 1; driverTarget = 1; minRaces = 15; budgetTarget = 50;
    } else if (perf >= 80) {
      constructorTarget = 3; driverTarget = 5; minRaces = 10; budgetTarget = 30;
    } else if (perf >= 70) {
      constructorTarget = 5; driverTarget = 8; minRaces = 6;  budgetTarget = 15;
    } else {
      constructorTarget = 8; driverTarget = 12; minRaces = 3; budgetTarget = 8;
    }

    return {
      season,
      constructorPos:  constructorTarget,
      driverPos:       driverTarget,
      minPointsRaces:  minRaces,
      budgetSurplus:   budgetTarget,
      description: [
        `Terminer P${constructorTarget} au championnat constructeurs`,
        `Avoir un pilote dans le top ${driverTarget} pilotes`,
        `Marquer des points dans ${minRaces} courses`,
        `Dégager un surplus de ${budgetTarget}M€ en fin de saison`,
      ],
    };
  },

  // Évaluer si les objectifs sont atteints
  evaluateObjectives(save) {
    if (!save?.boardObjectives) return { score:0, details:[] };
    const obj = save.boardObjectives;
    const details = [];
    let score = 0;

    // Position constructeurs
    const teams = [...F1Data.teams].sort((a,b) =>
      (save.teamStandings?.[b.id]||0) - (save.teamStandings?.[a.id]||0)
    );
    const constPos = teams.findIndex(t => t.id === save.playerTeamId) + 1;
    const constOk  = constPos <= obj.constructorPos;
    details.push({ label:`Constructeurs P${constPos}/${obj.constructorPos}`, ok: constOk });
    if (constOk) score += 30;

    // Position pilote
    const drivers = [...F1Data.drivers].filter(d => d.teamId === save.playerTeamId)
      .sort((a,b) => (save.driverStandings?.[b.id]||0) - (save.driverStandings?.[a.id]||0));
    const driverPts = drivers[0] ? (save.driverStandings?.[drivers[0].id]||0) : 0;
    const allDrivers = [...F1Data.drivers].filter(d=>!d.retired)
      .sort((a,b)=>(save.driverStandings?.[b.id]||0)-(save.driverStandings?.[a.id]||0));
    const driverPos = allDrivers.findIndex(d=>d.teamId===save.playerTeamId)+1;
    const driverOk  = driverPos > 0 && driverPos <= obj.driverPos;
    details.push({ label:`Pilote P${driverPos||'?'}/${obj.driverPos}`, ok: driverOk });
    if (driverOk) score += 30;

    // Courses avec points
    const racesWithPoints = (save.raceResults||[]).filter(r =>
      (r.playerPoints||0) > 0
    ).length;
    const racesOk = racesWithPoints >= obj.minPointsRaces;
    details.push({ label:`${racesWithPoints}/${obj.minPointsRaces} courses avec points`, ok: racesOk });
    if (racesOk) score += 20;

    // Budget surplus (simplifié)
    const budgetOk = (save.budget||0) > 50;
    details.push({ label:`Budget ${budgetOk?'sain':'insuffisant'}`, ok: budgetOk });
    if (budgetOk) score += 20;

    return { score, details, constPos, driverPos };
  },

  // Calculer la pression du board
  updateBoardPressure(save) {
    const eval_ = this.evaluateObjectives(save);
    const races  = (save.raceResults||[]).length;
    if (races < 3) return; // trop tôt pour juger

    // Pression monte si objectifs pas atteints
    const deficit = 100 - eval_.score;
    save.boardPressure = Math.min(100, (save.boardPressure||0) + deficit * 0.02);
    save.boardPressure = Math.max(0,   save.boardPressure - eval_.score * 0.01);
    save.boardPressure = Math.round(save.boardPressure * 10) / 10;
  },

  getPressureLevel(pressure) {
    if (pressure >= 80) return { label:'🔴 Licenciement imminent', color:'#ff2244', fire:true };
    if (pressure >= 60) return { label:'🟠 Forte pression',        color:'#ff8844', fire:false };
    if (pressure >= 40) return { label:'🟡 Sous surveillance',     color:'#ffdd44', fire:false };
    if (pressure >= 20) return { label:'🟢 Acceptable',            color:'#44cc44', fire:false };
    return                     { label:'✅ Direction satisfaite',  color:'#00e676', fire:false };
  },

  // ── RÉPUTATION & FANS ─────────────────────────────────────
  updateFanBase(save, racePosition) {
    const change = racePosition === 1  ? +8
      : racePosition <= 3  ? +4
      : racePosition <= 10 ? +1
      : racePosition <= 15 ? -1
      : -3;
    save.fanBase = Math.max(0, Math.min(100, (save.fanBase||50) + change));
  },

  // ── ÉVÉNEMENTS PRÉ-COURSE ─────────────────────────────────
  triggerPreRace(save) {
    this.ensure(save);
    const raceKey = `${save.season}-${save.race}`;
    if (save[this.KEY_LAST_PRE] === raceKey) return null;
    save[this.KEY_LAST_PRE] = raceKey;
    if (Math.random() > 0.55) return null;

    const drivers = this.teamDrivers(save);
    if (!drivers.length) return null;
    const d = this.rand(drivers);

    const circuit = F1Data.circuits[(save.race||0) % F1Data.circuits.length];
    const circName = circuit?.name || 'ce circuit';

    const events = [
      // Blessures / Forme physique
      () => ({
        title: 'Blessure légère à l\'entraînement',
        text:  `${d.firstName} ${d.name} s'est blessé au poignet en simulateur. Il sera moins performant ce week-end.`,
        icon:  '🤕', category: 'medical',
        effect: () => this.applyDriverEffect(save, d.id, {pace:-4, consistency:-3, races:1, label:'Blessure légère'})
      }),
      () => ({
        title: 'Pilote en grande forme',
        text:  `${d.firstName} ${d.name} a dominé les séances libres à ${circName}. Bonus de confiance pour ce GP.`,
        icon:  '💪', category: 'performance',
        effect: () => this.applyDriverEffect(save, d.id, {pace:+3, consistency:+2, races:1, label:'En grande forme'})
      }),
      () => ({
        title: 'Gastro dans l\'équipe',
        text:  `Une gastro-entérite touche plusieurs membres de l'équipe dont ${d.name}. Week-end compliqué en perspective.`,
        icon:  '🤒', category: 'medical',
        effect: () => this.applyDriverEffect(save, d.id, {consistency:-5, races:1, label:'Pas dans son assiette'})
      }),

      // Technique
      () => ({
        title: 'Package aérodynamique validé',
        text:  'La FIA valide votre nouveau package aéro. Petit gain de performance immédiat.',
        icon:  '🌊', category: 'technical',
        effect: () => { if(save.carDev?.aero) save.carDev.aero.level=Math.min(100,save.carDev.aero.level+1); save.reputation+=1; }
      }),
      () => ({
        title: 'Fuite hydraulique détectée',
        text:  'Les mécaniciens ont repéré un problème sur la voiture de pole. Fiabilité temporairement en baisse.',
        icon:  '🔧', category: 'technical',
        effect: () => { if(save.carDev?.reliability) save.carDev.reliability.level=Math.max(1,save.carDev.reliability.level-2); }
      }),
      () => ({
        title: 'Soufflerie validée',
        text:  'Vos données de soufflerie se confirment en piste. La corrélation est excellente ce week-end.',
        icon:  '🏭', category: 'technical',
        effect: () => { save.reputation=(save.reputation||50)+2; save.tokens=(save.tokens||0)+1; }
      }),
      () => ({
        title: 'Problème de boîte de vitesses',
        text:  'Un problème de boîte détecté en FP3. L\'équipe change la boîte, pénalité de 5 places sur la grille.',
        icon:  '⚙️', category: 'technical',
        effect: () => this.applyDriverEffect(save, d.id, {consistency:-2, races:1, label:'Pénalité grille'})
      }),

      // Financier / Sponsor
      () => ({
        title: 'Sponsor satisfait',
        text:  'Un partenaire principal augmente sa visibilité pour ce GP. Prime d\'activation de 8M€.',
        icon:  '💰', category: 'financial',
        effect: () => { save.budget=Math.round(((save.budget||0)+8)*10)/10; save.reputation+=1; save.fanBase=(save.fanBase||50)+2; }
      }),
      () => ({
        title: 'Contrôle technique renforcé',
        text:  'La FIA contrôle plusieurs pièces de votre voiture. Vos ingénieurs perdent du temps de développement.',
        icon:  '🔍', category: 'regulatory',
        effect: () => { save.tokens=Math.max(0,(save.tokens||0)-1); }
      }),
      () => ({
        title: 'Nouveau sponsor intéressé',
        text:  'Une grande marque de tech veut s\'associer à votre équipe. Négociation en cours.',
        icon:  '🤝', category: 'financial',
        effect: () => { save.budget=Math.round(((save.budget||0)+12)*10)/10; }
      }),

      // Mercato / Contrats
      () => ({
        title: 'Rumeur mercato',
        text:  `Le clan ${d.name} demande des garanties sportives pour sa prolongation. Le coût augmente.`,
        icon:  '📰', category: 'mercato',
        effect: () => {
          save.contracts[d.id] = save.contracts[d.id] || {years:2};
          save.contracts[d.id].salaryDemand = (d.salary||5) + 3;
        }
      }),
      () => ({
        title: 'Approche d\'une équipe rivale',
        text:  `Une équipe rivale tente de débaucher ${d.firstName} ${d.name}. Votre pilote reste loyal… pour l'instant.`,
        icon:  '🔄', category: 'mercato',
        effect: () => {
          save.contracts[d.id] = save.contracts[d.id] || {years:2};
          save.contracts[d.id].salaryDemand = (d.salary||5) + 5;
          save.boardPressure = Math.min(100, (save.boardPressure||0) + 5);
        }
      }),

      // IA / Concurrents
      () => ({
        title: 'Mise à jour moteur concurrente',
        text:  'Une équipe rivale a apporté une grosse évolution moteur ce week-end. Attention !',
        icon:  '⚡', category: 'competitor',
        effect: () => {
          const rivals = F1Data.teams.filter(t=>t.id!==save.playerTeamId);
          const r = this.rand(rivals);
          save.aiDevelopment[r.id] = save.aiDevelopment[r.id]||{};
          save.aiDevelopment[r.id].engine = (save.aiDevelopment[r.id].engine||0) + 2;
        }
      }),
      () => ({
        title: 'Accident en pitlane IA',
        text:  'Une équipe rivale a eu un incident en pitlane lors des essais. Safety car probable.',
        icon:  '💥', category: 'competitor',
        effect: () => { /* effet cosmétique */ }
      }),

      // Board
      () => ({
        title: 'Réunion de direction',
        text:  save.boardPressure > 50
          ? 'La direction est préoccupée par les résultats. Elle attend une amélioration immédiate.'
          : 'La direction confirme son soutien. Objectifs maintenus pour la saison.',
        icon:  '🏢', category: 'board',
        effect: () => {
          if(save.boardPressure > 50) save.boardPressure = Math.min(100, save.boardPressure + 5);
          else save.reputation = Math.min(100, (save.reputation||50) + 2);
        }
      }),
    ];

    const ev = this.rand(events)();
    ev.effect();
    this.log(save, { phase:'pre', icon:ev.icon||'📰', category:ev.category||'general', title:ev.title, text:ev.text });
    return ev;
  },

  // ── ÉVÉNEMENTS POST-COURSE ────────────────────────────────
  triggerPostRace(save, summary={}) {
    this.ensure(save);
    this.decayEffects(save);
    this.updateBoardPressure(save);

    // Compatibilité : recordRaceResults appelle parfois avec seulement {results}.
    if ((!summary.playerPosition || !summary.playerPoints) && Array.isArray(summary.results)) {
      const playerResults = summary.results.filter(r => r.team?.id === save.playerTeamId || r.teamId === save.playerTeamId);
      if (playerResults.length) {
        summary.playerPosition = Math.min(...playerResults.map(r=>r.position||99));
        summary.playerPoints = playerResults.reduce((sum,r)=>sum+(r.points||0),0);
      }
    }

    const pos = summary.playerPosition || 0;
    if (pos > 0) this.updateFanBase(save, pos);
    this.generateStoryPulse(save, summary);

    // Toujours loguer le résultat de course
    if (pos > 0) {
      const drivers = this.teamDrivers(save);
      const circuit = F1Data.circuits[(save.race||1)-1];
      this.log(save, {
        phase: 'result',
        icon:  pos === 1 ? '🏆' : pos <= 3 ? '🥈' : pos <= 10 ? '✅' : '📊',
        category: 'race_result',
        title: pos === 1 ? `Victoire au GP de ${circuit?.name||'?'} !`
          : pos <= 3 ? `Podium P${pos} au GP de ${circuit?.name||'?'}`
          : `P${pos} au GP de ${circuit?.name||'?'}`,
        text: `Points marqués : ${summary.playerPoints||0}. ${pos===1?'Drapeau à damiers sous les vivats du public !':''}`,
      });
    }

    if (Math.random() > 0.60) return null;

    const drivers = this.teamDrivers(save);
    if (!drivers.length) return null;
    const d = this.rand(drivers);

    const events = [
      () => ({
        title: 'Usine inspirée par le résultat',
        text:  'Les ingénieurs ont trouvé une piste de développement suite à la course. +1 token R&D.',
        icon:  '🔬', category: 'technical',
        effect: () => { save.tokens=(save.tokens||0)+1; save.reputation+=1; }
      }),
      () => ({
        title: 'Accident coûteux au garage',
        text:  'Une casse logistique lors du transport coûte 6M€ en réparations.',
        icon:  '💸', category: 'financial',
        effect: () => { save.budget=Math.max(0,Math.round(((save.budget||0)-6)*10)/10); save.reputation-=1; }
      }),
      () => ({
        title: 'Progrès en pit stop',
        text:  'L\'analyse vidéo des arrêts au stand porte ses fruits. Le département pit stop progresse.',
        icon:  '⏱️', category: 'technical',
        effect: () => { if(save.carDev?.pitstop) save.carDev.pitstop.level=Math.min(100,save.carDev.pitstop.level+1); }
      }),
      () => ({
        title: 'Interview remarquée',
        text:  `${d.firstName} ${d.name} a donné une interview percutante après la course. La fanbase s'agrandit.`,
        icon:  '🎤', category: 'media',
        effect: () => { save.fanBase=Math.min(100,(save.fanBase||50)+3); save.reputation+=1; }
      }),
      () => ({
        title: 'Presse positive',
        text:  'Les médias soulignent votre progression. La réputation de l\'équipe monte.',
        icon:  '📰', category: 'media',
        effect: () => { save.reputation=Math.min(100,(save.reputation||50)+3); save.fanBase=(save.fanBase||50)+2; }
      }),
      () => ({
        title: 'Tension interne',
        text:  `${d.firstName} ${d.name} critique publiquement la stratégie. Ambiance tendue au garage.`,
        icon:  '😤', category: 'internal',
        effect: () => this.applyDriverEffect(save, d.id, {consistency:-3, races:1, label:'Tension interne'})
      }),
      () => ({
        title: 'Prime d\'image sponsor',
        text:  'Un sponsor verse une prime d\'image suite au résultat. +10M€.',
        icon:  '💰', category: 'financial',
        effect: () => { save.budget=Math.round(((save.budget||0)+10)*10)/10; }
      }),
      () => ({
        title: 'Analyse aéro post-course',
        text:  'Les données de course permettent une corrélation exceptionnelle avec la soufflerie.',
        icon:  '🌊', category: 'technical',
        effect: () => { if(save.carDev?.aero) save.carDev.aero.level=Math.min(100,save.carDev.aero.level+1); }
      }),
      () => ({
        title: pos <= 3 ? 'Fête au paddock !' : 'Débrief d\'équipe',
        text:  pos <= 3
          ? 'Le podium galvanise toute l\'équipe. Moral au plus haut !'
          : 'L\'équipe analyse les données pour progresser lors du prochain GP.',
        icon:  pos <= 3 ? '🎉' : '📊', category: 'internal',
        effect: () => {
          if(pos <= 3) {
            save.reputation=Math.min(100,(save.reputation||50)+4);
            save.boardPressure=Math.max(0,(save.boardPressure||0)-8);
          } else {
            save.reputation=Math.min(100,(save.reputation||50)+1);
          }
        }
      }),
      () => ({
        title: 'Surveillance budget cap FIA',
        text:  'La FIA annonce un audit du budget cap. Vos finances seront scrutées en fin de saison.',
        icon:  '📋', category: 'regulatory',
        effect: () => { /* cosmétique */ }
      }),
      () => ({
        title: pos === 1 ? 'Victoire historique !' : 'Contact avec une équipe adverse',
        text:  pos === 1
          ? `${d.firstName} ${d.name} s'impose ! L'équipe est en liesse, les fans sont en délire.`
          : 'Un incident en piste est sous investigation. Résultat à confirmer.',
        icon:  pos === 1 ? '🏆' : '⚠️', category: pos === 1 ? 'race_result' : 'incident',
        effect: () => {
          if(pos===1) {
            save.reputation=Math.min(100,(save.reputation||50)+6);
            save.fanBase=Math.min(100,(save.fanBase||50)+5);
            save.boardPressure=Math.max(0,(save.boardPressure||0)-15);
          }
        }
      }),
    ];

    const ev = this.rand(events)();
    ev.effect();
    this.log(save, { phase:'post', icon:ev.icon||'📰', category:ev.category||'general', title:ev.title, text:ev.text });
    return ev;
  },

  // ── DRIVER EFFECTIF (avec effets temporaires) ─────────────
  effectiveDriver(driver) {
    try {
      const save = Save.load();
      if (!save?.driverEffects?.[driver.id]) return driver;
      const e = save.driverEffects[driver.id];
      const d = { ...driver };
      ['pace','consistency','wetSkill','overtaking','defending']
        .forEach(k => d[k] = Math.max(1, Math.min(100, (d[k]||70) + (e[k]||0))));
      d.eventLabel = e.label;
      return d;
    } catch(err) { return driver; }
  },


  // ── STORY WORLD / NOTIFICATIONS IMPACTANTES ──────────────
  clamp(v,min=0,max=100){ return Math.max(min, Math.min(max, Number(v)||0)); },

  money(save, delta){
    const d = Math.max(-6, Math.min(8, Number(delta)||0));
    save.budget = Math.round(((Number(save.budget)||0) + d) * 10) / 10;
    if (save.budget < 0) save.budget = 0;
  },

  tokens(save, delta){
    const d = Math.max(-1, Math.min(1, Number(delta)||0));
    save.tokens = Math.max(0, (Number(save.tokens)||0) + d);
  },

  addMemory(save, item){
    this.ensure(save);
    save.storyWorld.memory.unshift({
      date:new Date().toISOString(), season:save.season, race:save.race,
      ...item
    });
    save.storyWorld.memory = save.storyWorld.memory.slice(0,80);
  },

  notificationKey(type){ return `_lastStory_${type}`; },

  canTriggerStory(save, type, gap=2){
    this.ensure(save);
    const key=this.notificationKey(type);
    const now=(save.season||2025)*100 + (save.race||0);
    const last=save.storyWorld.cooldowns[key] || -9999;
    if (now-last < gap) return false;
    save.storyWorld.cooldowns[key]=now;
    return true;
  },

  createDecision(save, ev){
    this.ensure(save);
    const sameOpen = save.notifications.some(n => !n.resolved && n.title === ev.title && n.text === ev.text);
    if (sameOpen) return null; // évite les doublons visibles
    const unresolved = save.notifications.filter(n=>!n.resolved).length;
    if (unresolved >= 3) return null; // évite le spam et la pression permanente
    const id = `story_${Date.now()}_${Math.floor(Math.random()*9999)}`;
    const notif = {
      id, resolved:false, date:new Date().toISOString(), season:save.season, race:save.race,
      importance: ev.importance || 'normal', category: ev.category || 'story',
      icon: ev.icon || '📌', title: ev.title, text: ev.text, choices: ev.choices || []
    };
    save.notifications.unshift(notif);
    save.notifications = save.notifications.slice(0,30);
    this.log(save, { phase:'story', icon:notif.icon, category:notif.category, title:`Décision — ${notif.title}`, text:notif.text, notificationId:id });
    return notif;
  },

  resolveNotification(save, id, choiceId){
    this.ensure(save);
    const n = save.notifications.find(x=>x.id===id);
    if (!n || n.resolved) return { ok:false, msg:'Notification introuvable ou déjà résolue.' };
    const c = (n.choices||[]).find(x=>x.id===choiceId) || (n.choices||[])[0];
    if (!c) return { ok:false, msg:'Choix introuvable.' };
    if (typeof c.apply === 'function') c.apply(save, n);
    n.resolved = true; n.choiceId = c.id; n.resolvedAt = new Date().toISOString(); n.outcome = c.outcome || c.label;
    this.log(save, { phase:'story', icon:'✅', category:n.category, title:`Choix validé — ${n.title}`, text:c.outcome || c.label });
    this.addMemory(save, { icon:n.icon, category:n.category, title:n.title, text:c.outcome || c.label });
    if (typeof Save !== 'undefined') Save.save(save);
    return { ok:true, msg:c.outcome || 'Décision appliquée.' };
  },


  updateRivalries(save, results, best){
    if(!best || !Array.isArray(results) || !results.length) return;
    const me = best.driverId || best.driver?.id || best.driverName;
    const nearby = results.find(r => r !== best && Math.abs((r.position||99) - (best.position||99)) === 1);
    if(!me || !nearby) return;
    const rival = nearby.driverId || nearby.driver?.id || nearby.driverName;
    if(!rival) return;
    const key = [me,rival].sort().join('_vs_');
    let row = save.storyWorld.rivalries.find(r=>r.key===key);
    if(!row){
      row = { key, a:me, b:rival, aName:best.driverName || [best.driver?.firstName,best.driver?.name].filter(Boolean).join(' '), bName:nearby.driverName || [nearby.driver?.firstName,nearby.driver?.name].filter(Boolean).join(' '), heat:0, races:0 };
      save.storyWorld.rivalries.push(row);
    }
    row.heat = this.clamp((row.heat||0)+6,0,100);
    row.races = (row.races||0)+1;
    row.lastSeason = save.season; row.lastRace = save.race;
    if(row.heat>=18 && row.races%3===0){
      this.log(save,{ phase:'story', icon:'🔥', category:'rivalry', title:'Rivalité qui s’installe', text:`${row.aName} et ${row.bName} se croisent encore en piste. Le paddock commence à suivre ce duel.` });
      this.addMemory(save,{ icon:'🔥', category:'rivalry', title:'Rivalité suivie', text:`${row.aName} vs ${row.bName} gagne en intensité.` });
    }
  },

  generateStoryPulse(save, summary={}){
    this.ensure(save);
    const results = summary.results || [];
    const player = results.filter(r=>r.team?.id === save.playerTeamId || r.teamId === save.playerTeamId);
    const best = player.length ? player.slice().sort((a,b)=>(a.position||99)-(b.position||99))[0] : null;
    const pts = player.reduce((s,r)=>s+(r.points||0),0);
    const drivers = this.teamDrivers(save);
    const d = drivers.length ? this.rand(drivers) : null;
    const pos = best?.position || summary.playerPosition || 99;
    const teamIdentity = save.storyWorld.teamIdentity;

    // Mémoire douce après chaque GP : toujours utile pour l'historique, sans impact direct.
    if (best) {
      this.addMemory(save, {
        icon: pts>0?'✅':'📊', category:'race_memory',
        title:`GP ${save.race+1 || ''} — ${pts>0?'points marqués':'week-end sans point'}`,
        text:`Meilleur résultat P${pos}. ${pts} point${pts>1?'s':''} pour l'équipe.`
      });
      this.updateRivalries(save, results, best);
    }

    // Décisions rares et équilibrées : 0 ou 1 par GP en moyenne.
    if (Math.random() > 0.48) return;

    const options = [];
    if (d && this.canTriggerStory(save,'driver_mood',2)) options.push(() => this.createDecision(save, {
      icon:'🎧', category:'driver', title:`Message de ${d.firstName} ${d.name}`,
      text: pos<=10 ? `${d.firstName} sent que l'équipe progresse et demande plus de priorité stratégique au prochain GP.` : `${d.firstName} trouve que la stratégie ne lui a pas permis de maximiser le résultat.`,
      choices:[
        { id:'support', label:'Le soutenir publiquement', preview:'+moral pilote, +médias, légère pression interne', outcome:`${d.firstName} se sent soutenu. Le paddock remarque votre gestion humaine.`, apply:(s)=>{ this.applyDriverEffect(s,d.id,{consistency:+2,races:1,label:'Soutenu par l’équipe'}); s.fanBase=this.clamp((s.fanBase||50)+2); teamIdentity.media+=1; } },
        { id:'data', label:'Réunion données privée', preview:'+constance, petit gain technique possible', outcome:'L’équipe choisit une réponse calme et technique. Les ingénieurs repartent avec des axes précis.', apply:(s)=>{ this.applyDriverEffect(s,d.id,{consistency:+1,races:2,label:'Plan clair'}); if(Math.random()<0.45) this.tokens(s,+1); teamIdentity.strategy+=1; } },
        { id:'firm', label:'Rappeler la priorité équipe', preview:'+board, moral pilote en léger risque', outcome:'Le message est clair : personne ne passe au-dessus du collectif.', apply:(s)=>{ s.boardPressure=Math.max(0,(s.boardPressure||0)-2); this.applyDriverEffect(s,d.id,{consistency:-1,races:1,label:'Recadré'}); } },
      ]
    }));

    if (this.canTriggerStory(save,'sponsor_activation',3)) options.push(() => this.createDecision(save, {
      icon:'💼', category:'financial', title:'Activation sponsor proposée',
      text:'Un partenaire veut une opération média plus visible avant le prochain GP. C’est rentable, mais cela mobilise l’équipe.',
      choices:[
        { id:'accept', label:'Accepter l’opération', preview:'+3M€, +sponsors, fatigue légère', outcome:'L’opération plaît aux sponsors. Le garage râle un peu, mais les finances respirent.', apply:(s)=>{ this.money(s,+3); s.fanBase=this.clamp((s.fanBase||50)+1); if(s.immersion?.sponsorMood) s.immersion.sponsorMood.value=this.clamp(s.immersion.sponsorMood.value+3); teamIdentity.media+=1; } },
        { id:'negotiate', label:'Négocier un format court', preview:'+1M€, impact neutre', outcome:'Vous trouvez un compromis propre : visibilité correcte, préparation préservée.', apply:(s)=>{ this.money(s,+1); if(s.immersion?.sponsorMood) s.immersion.sponsorMood.value=this.clamp(s.immersion.sponsorMood.value+1); } },
        { id:'refuse', label:'Refuser pour protéger la performance', preview:'+focus sportif, sponsor -2', outcome:'Vous protégez la préparation. Le partenaire accepte, mais attend un résultat.', apply:(s)=>{ if(s.immersion?.sponsorMood) s.immersion.sponsorMood.value=this.clamp(s.immersion.sponsorMood.value-2); teamIdentity.strategy+=1; } },
      ]
    }));

    if (this.canTriggerStory(save,'rd_focus',4)) options.push(() => this.createDecision(save, {
      icon:'🔬', category:'technical', title:'Réunion R&D exceptionnelle',
      text:'Les données du week-end révèlent une piste de travail. Les ingénieurs demandent quelle priorité suivre.',
      choices:[
        { id:'aero', label:'Priorité aéro', preview:'petit gain aéro ou +1 token', outcome:'Le département aéro reçoit un brief clair. Les gains restent progressifs.', apply:(s)=>{ if(s.carDev?.aero && Math.random()<0.35) s.carDev.aero.level=Math.min(100,s.carDev.aero.level+1); else this.tokens(s,+1); teamIdentity.development+=1; } },
        { id:'reliability', label:'Priorité fiabilité', preview:'petit gain fiabilité', outcome:'L’équipe choisit la robustesse. Moins spectaculaire, mais précieux sur la saison.', apply:(s)=>{ if(s.carDev?.reliability) s.carDev.reliability.level=Math.min(100,s.carDev.reliability.level+1); teamIdentity.reliability+=1; } },
        { id:'pitwall', label:'Priorité stratégie', preview:'+board / identité stratégie', outcome:'Le muret travaille sur les scénarios de course. L’équipe devient plus méthodique.', apply:(s)=>{ s.boardPressure=Math.max(0,(s.boardPressure||0)-1); teamIdentity.strategy+=2; } },
      ]
    }));

    if (save.immersion?.juniorAcademy?.some(j=>j.promotable) && this.canTriggerStory(save,'academy_buzz',5)) {
      const j = save.immersion.juniorAcademy.find(j=>j.promotable);
      options.push(() => this.createDecision(save, {
        icon:'🌱', category:'academy', title:`Le paddock observe ${j.firstName} ${j.name}`,
        text:'Votre jeune pilote attire l’attention. Son entourage veut savoir si l’équipe croit vraiment en lui.',
        choices:[
          { id:'protect', label:'Le protéger médiatiquement', preview:'+loyauté, progression stable', outcome:`${j.firstName} reste concentré loin du bruit médiatique.`, apply:(s)=>{ j.loyalty=this.clamp((j.loyalty||55)+5); j.progress=Math.min(100,(j.progress||0)+3); teamIdentity.academy+=1; } },
          { id:'spotlight', label:'Le mettre en avant', preview:'+fans, risque pression', outcome:`${j.firstName} devient un nom cité dans le paddock. La pression monte.`, apply:(s)=>{ s.fanBase=this.clamp((s.fanBase||50)+3); j.pressure=this.clamp((j.pressure||40)+5); teamIdentity.media+=1; } },
          { id:'tests', label:'Financer des tests privés', preview:'-2M€, progression junior +', outcome:'Les tests coûtent un peu, mais le retour technique est excellent.', apply:(s)=>{ this.money(s,-2); j.progress=Math.min(100,(j.progress||0)+8); teamIdentity.academy+=2; } },
        ]
      }));
    }

    if (!options.length) return;
    this.rand(options)();
  },

  // ── CONTRATS ──────────────────────────────────────────────
  ensureContractSystem(save) {
    this.ensure(save);
    F1Data.drivers.filter(d=>d.teamId===save.playerTeamId).forEach(d => {
      save.contracts[d.id] = save.contracts[d.id] || { years:2, salaryDemand: (d.salary||1)+2 };
    });
  },

  makeContractOffer(save, driverId, offer) {
    this.ensure(save);
    const driver = F1Data.drivers.find(d => d.id === driverId);
    if (!driver) return { ok:false, accepted:false, msg:'Pilote introuvable.' };

    const isMine  = driver.teamId === save.playerTeamId;
    const fee     = isMine ? 0 : Math.round((driver.salary||1) * 1.5);
    const total   = fee + (offer.bonus||0) + (offer.salary||driver.salary||1) * (offer.years||2);

    if ((save.budget||0) < fee + (offer.bonus||0)) {
      return { ok:false, accepted:false, msg:`Budget insuffisant (frais : ${fee}M€ + prime ${offer.bonus||0}M€).` };
    }

    // Évaluation de l'offre par le pilote
    const demand   = save.contracts?.[driverId]?.salaryDemand || (driver.salary||1) + 2;
    const salaryOk = (offer.salary||0) >= demand;
    const yearsOk  = (offer.years||0) >= 2;
    const bonusOk  = (offer.bonus||0) >= Math.round((driver.salary||1)*0.3);

    // Score d'attractivité (0-100)
    let score = 0;
    if (salaryOk) score += 40;
    else          score += Math.max(0, 40 - (demand - (offer.salary||0)) * 5);
    if (yearsOk)  score += 20;
    if (bonusOk)  score += 20;
    // Réputation et niveau équipe
    score += Math.round((save.reputation||50) * 0.2);

    const accepted = score >= 60 || Math.random() < score / 120;

    if (accepted) {
      if (!isMine) {
        // Libérer l'ancien employeur
        driver.teamId = save.playerTeamId;
        save.budget   = Math.round(((save.budget||0) - fee - (offer.bonus||0)) * 10) / 10;

        // Si pas de siège libre, remplacer le moins bon
        const myDrivers = F1Data.drivers.filter(d => d.teamId===save.playerTeamId && !d.retired);
        if (myDrivers.length > 2) {
          const worst = myDrivers.sort((a,b)=>
            ((a.pace+a.consistency)/2) - ((b.pace+b.consistency)/2)
          )[0];
          if (worst.id !== driverId) worst.teamId = null;
        }
      }
      save.contracts[driverId] = { years: offer.years||2, salaryDemand: offer.salary||demand };

      // Persister le teamId dans driverStates
      save.driverStates = save.driverStates || {};
      save.driverStates[driverId] = save.driverStates[driverId] || {};
      save.driverStates[driverId].teamId = save.playerTeamId;

      // Libérer l'ancien employeur dans driverStates aussi
      Object.keys(save.driverStates).forEach(id => {
        if (id !== driverId && save.driverStates[id]?.teamId === save.playerTeamId) {
          const stillMine = F1Data.drivers.find(d=>d.id===id&&d.teamId===save.playerTeamId);
          if (!stillMine) save.driverStates[id].teamId = null;
        }
      });

      this.log(save, { phase:'mercato', icon:'✅', category:'transfer',
        title: isMine ? `Contrat prolongé` : `Transfert signé`,
        text: `${driver.firstName} ${driver.name} ${isMine?'prolonge':'rejoint l\'équipe'} pour ${offer.salary}M€/an, ${offer.years} an(s).`
      });
      Save.save(save);
      return { ok:true, accepted:true, msg:`${driver.name} a accepté l'offre !` };
    } else {
      // Contre-offre
      save.contracts[driverId] = save.contracts[driverId] || {};
      save.contracts[driverId].refus = (save.contracts[driverId].refus||0) + 1;
      const counter = { salary: demand + 1, years: Math.max(offer.years||1, 2) };
      Save.save(save);
      return {
        ok:false, accepted:false,
        counter,
        msg:`${driver.name} refuse. Il demande ${demand+1}M€/an minimum.`
      };
    }
  },

  // ── IA DÉVELOPPEMENT ─────────────────────────────────────
  applyAiDevelopment(save) {
    if (!save?.aiDevelopment) return;
    F1Data.teams.forEach(t => {
      const ai = save.aiDevelopment[t.id];
      if (!ai) return;
      ['aero','chassis','engine','reliability'].forEach(k => {
        if (ai[k]) t[k] = Math.max(1, Math.min(100, (t[k]||70) + ai[k]));
      });
      t.performance = Math.round((t.aero + t.chassis + t.engine) / 3);
    });
  },
};
