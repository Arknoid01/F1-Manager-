// ============================================================
// F1 Manager — immersion.js
// Couche narrative SAFE : ne modifie pas le moteur de course.
// Alimente : paddock news, réputation, moral, historique, records,
// interviews, sponsors vivants et académie junior.
// ============================================================

const Immersion = {
  ensure(save){
    if(!save) return save;
    save.immersion = save.immersion || {};
    const im = save.immersion;
    im.version = im.version || 1;
    im.paddockNews = Array.isArray(im.paddockNews) ? im.paddockNews : [];
    im.interviews = Array.isArray(im.interviews) ? im.interviews : [];
    im.gpHistory = Array.isArray(im.gpHistory) ? im.gpHistory : [];
    im.records = im.records || { wins:{}, podiums:{}, points:{}, poles:{}, bestResults:{}, teamWins:{}, teamPodiums:{} };
    im.teamReputation = im.teamReputation || { value: save.reputation || 50, tags: [] };
    im.driverMorale = im.driverMorale || {};
    im.staffMorale = im.staffMorale || { value: 60, note:'Ambiance stable dans le garage.' };
    im.sponsorMood = im.sponsorMood || { value: 60, note:'Les partenaires attendent des résultats réguliers.' };
    im.juniorAcademy = Array.isArray(im.juniorAcademy) ? im.juniorAcademy : this.defaultJuniors(save);
    im.seasonStory = im.seasonStory || [];
    this.capAcademyDriverStats(save);
    return save;
  },

  // Les juniors sortent de l'académie avec du potentiel, pas comme stars immédiates.
  // Le potentiel reste élevé, mais le niveau F1 initial est plafonné pour garder l'équilibrage.
  ACADEMY_MAX_OVR: 77,

  capVal(v, max=this.ACADEMY_MAX_OVR){ return Math.max(45, Math.min(max, Math.round(Number(v)||60))); },

  capProfile(profile, potential){
    if(!profile) return profile;
    const max = this.ACADEMY_MAX_OVR;
    profile.ovr = this.capVal(profile.ovr, max);
    profile.stats = profile.stats || {};
    ['pace','consistency','wetSkill','overtaking','defending'].forEach(k=>{
      profile.stats[k] = this.capVal(profile.stats[k], max);
    });
    return profile;
  },

  capAcademyDriverStats(save){
    try{
      const cap = this.ACADEMY_MAX_OVR;
      const capDriver = (d)=>{
        if(!d || !(d.fromAcademy || String(d.id||'').startsWith('JR_'))) return;
        ['pace','consistency','wetSkill','overtaking','defending'].forEach(k=>{ d[k] = this.capVal(d[k], cap); });
        d.potential = Math.max(d.potential || cap, cap);
        d.salary = Math.max(1, Math.min(Number(d.salary)||2, 3));
      };
      if(typeof F1Data !== 'undefined' && Array.isArray(F1Data.drivers)) F1Data.drivers.forEach(capDriver);
      if(Array.isArray(save?.generatedDrivers)) save.generatedDrivers.forEach(capDriver);
      if(save?.driverStates){
        Object.keys(save.driverStates).forEach(id=>{
          const st = save.driverStates[id];
          if(st?.fromAcademy || String(id).startsWith('JR_')) capDriver(st);
        });
      }
      save?.immersion?.juniorAcademy?.forEach(j=>{ if(j.profile) this.capProfile(j.profile, j.potential); });
    }catch(e){ console.warn('[Immersion] capAcademyDriverStats', e); }
  },

  defaultJuniors(save){
    const seed = Number(save?.season || 2025);
    const names = [
      ['Léo','Martins','🇫🇷'],['Noah','Keller','🇩🇪'],['Mateo','Rossi','🇮🇹'],
      ['Ethan','Brooks','🇬🇧'],['Hugo','Sato','🇯🇵'],['Alex','Moreau','🇫🇷']
    ];
    return names.map((n,i)=>({
      id:'jr_'+(seed+i), firstName:n[0], name:n[1], flag:n[2], age:17+(i%3),
      potential:72+((seed+i*7)%19), racecraft:58+((seed+i*5)%25),
      focus:55+((seed+i*3)%30), cost:2+i, progress:8+((seed+i*11)%40),
      note:['Très rapide en qualif','Excellent sous la pluie','Calme sous pression','Agressif en duel','Protège bien ses pneus','Gros potentiel marketing'][i]
    }));
  },

  driverName(r){ return r?.driverName || [r?.driver?.firstName, r?.driver?.name].filter(Boolean).join(' ') || 'Pilote'; },
  teamName(r){ return r?.teamName || r?.team?.name || 'Équipe'; },
  esc(s){ return String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); },

  afterRace(save, gp){
    if(!save || !gp) return save;
    this.ensure(save);
    const im = save.immersion;
    const key = `${gp.season || save.season}-${gp.raceNumber || save.race}-${gp.circuitId || gp.circuitName}`;
    if(im.lastProcessedGpKey === key) return save; // évite les doublons si la page résultat est rouverte
    im.lastProcessedGpKey = key;

    const results = Array.isArray(gp.results) ? gp.results : [];
    const winner = results[0] || gp.winner;
    const podium = results.slice(0,3);
    const player = Array.isArray(gp.playerResults) ? gp.playerResults : [];
    const bestPlayer = player.slice().sort((a,b)=>(a.position||99)-(b.position||99))[0];
    const teamPts = Number(gp.teamPoints || 0);
    const dnf = results.filter(r=>r.status==='dnf');
    const sc = Number(gp.safetyCarLaps || 0);
    const wet = /pluie|humide/i.test(gp.weather || '');

    im.gpHistory.push({
      key, season: gp.season || save.season, raceNumber: gp.raceNumber || save.race || 0,
      circuitName: gp.circuitName || 'Grand Prix', date: gp.date || new Date().toISOString(),
      winner: winner ? this.driverName(winner) : '—', winnerTeam: winner ? this.teamName(winner) : '—',
      podium: podium.map(r=>this.driverName(r)), playerBest: bestPlayer?.position || null,
      teamPoints: teamPts, weather: gp.weather || '—', safetyCarLaps: sc, dnf: dnf.length
    });
    im.gpHistory = im.gpHistory.slice(-80);

    this.updateRecords(im, results);
    this.updateMoraleAndReputation(save, gp, results, player, teamPts);
    this.generatePaddockNews(save, gp, results, player, teamPts, dnf, sc, wet);
    this.generateInterview(save, gp, results, player, teamPts, dnf, sc, wet);
    this.progressJuniors(save);
    return save;
  },

  updateRecords(im, results){
    results.forEach(r=>{
      const id = r.driverId || r.driverName;
      if(!id) return;
      const name = this.driverName(r);
      im.records.points[id] = { name, value:(im.records.points[id]?.value||0)+(r.points||0) };
      if(r.position===1) im.records.wins[id] = { name, value:(im.records.wins[id]?.value||0)+1 };
      if(r.position<=3) im.records.podiums[id] = { name, value:(im.records.podiums[id]?.value||0)+1 };
      const prev = im.records.bestResults[id];
      if(!prev || r.position < prev.value) im.records.bestResults[id] = { name, value:r.position };
      const tid = r.teamId || r.teamName;
      if(tid && r.position===1) im.records.teamWins[tid] = { name:this.teamName(r), value:(im.records.teamWins[tid]?.value||0)+1 };
      if(tid && r.position<=3) im.records.teamPodiums[tid] = { name:this.teamName(r), value:(im.records.teamPodiums[tid]?.value||0)+1 };
    });
  },

  updateMoraleAndReputation(save, gp, results, player, teamPts){
    const im = save.immersion;
    const best = player.slice().sort((a,b)=>(a.position||99)-(b.position||99))[0];
    const rep = im.teamReputation;
    let delta = 0;
    if(teamPts>=20) delta += 5; else if(teamPts>=10) delta += 3; else if(teamPts>0) delta += 1; else delta -= 2;
    if(best?.position<=3) delta += 3;
    if(player.some(r=>r.status==='dnf')) delta -= 3;
    rep.value = Math.max(0, Math.min(100, Math.round((rep.value ?? save.reputation ?? 50) + delta)));
    const tags=[];
    const avgPos = player.length ? player.reduce((s,r)=>s+(r.position||20),0)/player.length : 20;
    if(teamPts>=15) tags.push('Équipe en forme');
    if(best?.position<=3) tags.push('Candidate au podium');
    if(player.some(r=>r.pitStops?.length>=2)) tags.push('Stratégie agressive');
    if(player.some(r=>r.status==='dnf')) tags.push('Fiabilité sous surveillance');
    if(avgPos>12) tags.push('Week-end difficile');
    rep.tags = tags.length ? tags : ['Projet stable'];

    player.forEach(r=>{
      const id = r.driverId || r.driverName;
      const base = im.driverMorale[id]?.value ?? 60;
      let md = 0;
      if(r.position<=3) md+=8; else if(r.position<=6) md+=5; else if(r.points>0) md+=2; else md-=2;
      if(r.status==='dnf') md-=8;
      im.driverMorale[id] = { name:this.driverName(r), value:Math.max(5,Math.min(100,base+md)), note:this.moraleNote(base+md, r) };
    });

    const staffBase = im.staffMorale.value ?? 60;
    im.staffMorale.value = Math.max(0, Math.min(100, staffBase + (teamPts>=10?3:teamPts>0?1:-1)));
    im.staffMorale.note = teamPts>=10 ? 'Le garage croit au projet après ce résultat.' : teamPts>0 ? 'Le staff reste positif, mais veut plus.' : 'Le staff veut comprendre où le week-end a été perdu.';

    const spBase = im.sponsorMood.value ?? 60;
    const moodDelta = teamPts>=10 ? 4 : teamPts>0 ? 1 : -3;
    im.sponsorMood.value = Math.max(0, Math.min(100, spBase + moodDelta));
    im.sponsorMood.note = teamPts>=10 ? 'Les sponsors sont très satisfaits de la visibilité.' : teamPts>0 ? 'Les sponsors valident le résultat, sans euphorie.' : 'Les sponsors attendent une réaction au prochain GP.';
  },

  moraleNote(v,r){
    if(r.status==='dnf') return 'Frustré par l’abandon.';
    if(r.position<=3) return 'Très motivé après le podium.';
    if(r.position<=6) return 'Confiant, le rythme était là.';
    if(r.points>0) return 'Satisfait d’avoir marqué des points.';
    return 'A besoin d’un meilleur week-end.';
  },

  addNews(save, icon, title, text, type='paddock'){
    this.ensure(save);
    const item = { icon, title, text, type, date:new Date().toISOString(), season:save.season, race:save.race };
    save.immersion.paddockNews.push(item);
    save.immersion.paddockNews = save.immersion.paddockNews.slice(-60);
    save.news = Array.isArray(save.news) ? save.news : [];
    save.news.push({ icon, title, text, date:item.date, type });
    save.news = save.news.slice(-80);
  },

  generatePaddockNews(save,gp,results,player,teamPts,dnf,sc,wet){
    const winner = results[0] || gp.winner;
    const best = player.slice().sort((a,b)=>(a.position||99)-(b.position||99))[0];
    this.addNews(save,'📰',`Paddock — ${gp.circuitName || 'Grand Prix'}`,`${this.driverName(winner)} s’impose pour ${this.teamName(winner)}. ${teamPts>0?`Votre équipe repart avec ${teamPts} point${teamPts>1?'s':''}.`:'Votre équipe quitte le circuit sans point.'}`);
    if(best){
      if(best.position<=3) this.addNews(save,'🏆','Réaction paddock',`${this.driverName(best)} offre un podium qui change le regard du paddock sur votre projet.`,'reaction');
      else if(best.points>0) this.addNews(save,'✅','Objectif points atteint',`${this.driverName(best)} termine P${best.position}. Résultat solide pour la dynamique de l’équipe.`,'reaction');
      else this.addNews(save,'⚠️','Week-end à analyser',`Meilleur résultat P${best.position}. Le board attend une réponse dès le prochain Grand Prix.`,'reaction');
    }
    if(sc>0) this.addNews(save,'🚨','Course neutralisée',`La Safety Car a pesé sur le rythme du GP pendant ${sc} tour${sc>1?'s':''}. Les stratèges en parlent encore.`,'fia');
    if(dnf.length) this.addNews(save,'💥','Abandons en course',`${dnf.length} abandon${dnf.length>1?'s':''} recensé${dnf.length>1?'s':''}. ${this.driverName(dnf[0])} fait partie des pilotes piégés.`,'fia');
    if(wet) this.addNews(save,'🌧️','Météo sous surveillance',`Les conditions humides ont rendu les choix pneus plus tendus que prévu.`,'weather');
    const rep = save.immersion.teamReputation;
    if(rep.value>=75) this.addNews(save,'📈','Réputation en hausse',`Le paddock commence à considérer votre équipe comme une menace sérieuse.`,'reputation');
    if(save.immersion.sponsorMood.value<45) this.addNews(save,'💼','Sponsors exigeants',`Les partenaires veulent plus de visibilité et surveilleront le prochain week-end.`,'sponsor');
  },

  generateInterview(save,gp,results,player,teamPts,dnf,sc,wet){
    this.ensure(save);
    const best = player.slice().sort((a,b)=>(a.position||99)-(b.position||99))[0];
    const q = best?.position<=3 ? 'Un podium qui confirme le potentiel de l’équipe.' : teamPts>0 ? 'Des points importants pour le championnat.' : 'Un week-end difficile mais riche en enseignements.';
    const driverQuote = best ? (best.status==='dnf' ? `« On avait le rythme, mais aujourd’hui la course nous a échappé. » — ${this.driverName(best)}` : best.position<=3 ? `« La voiture était incroyable, on a maximisé chaque opportunité. » — ${this.driverName(best)}` : best.points>0 ? `« Ce n’est pas spectaculaire, mais ces points comptent. » — ${this.driverName(best)}` : `« Il faut comprendre pourquoi nous manquions de rythme. » — ${this.driverName(best)}`) : '« On va analyser les données et revenir plus fort. » — Team Principal';
    const principal = teamPts>=10 ? '« Le garage a exécuté un week-end très propre. » — Team Principal' : teamPts>0 ? '« On prend les points, mais on sait qu’il reste du travail. » — Team Principal' : '« Ce résultat ne reflète pas nos ambitions. » — Team Principal';
    save.immersion.interviews.push({
      date:new Date().toISOString(), season:gp.season||save.season, circuitName:gp.circuitName||'Grand Prix',
      headline:q, quotes:[principal, driverQuote], context:{teamPts, safetyCarLaps:sc, wet, dnf:dnf.length}
    });
    save.immersion.interviews = save.immersion.interviews.slice(-30);
  },

  // ══════════════════════════════════════════════════════════
  //  SYSTÈME ACADÉMIE JUNIOR — étapes 1 à 6
  // ══════════════════════════════════════════════════════════

  JUNIOR_TRAITS: [
    { id:'rain',       label:'Très rapide sous pluie',     icon:'🌧️', stat:'wetSkill',    bonus:+8 },
    { id:'aggressive', label:'Agressif',                   icon:'🔥', stat:'overtaking',  bonus:+6 },
    { id:'tyres',      label:'Mauvaise gestion pneus',     icon:'⚠️', stat:'consistency', bonus:-5 },
    { id:'quali',      label:'Excellent en qualif',        icon:'⚡', stat:'pace',        bonus:+6 },
    { id:'consistent', label:'Régulier',                   icon:'🎯', stat:'consistency', bonus:+7 },
    { id:'smart',      label:'Intelligent tactiquement',   icon:'🧠', stat:'defending',   bonus:+5 },
    { id:'pressure',   label:'Fort sous pression',         icon:'💪', stat:'consistency', bonus:+5 },
    { id:'rookie',     label:'Inexpérimenté en F1',        icon:'😬', stat:'overtaking',  bonus:-4 },
    { id:'marketing',  label:'Gros potentiel marketing',   icon:'📸', stat:null,          bonus:0  },
    { id:'fragile',    label:'Parfois tête brûlée',        icon:'💥', stat:'consistency', bonus:-3 },
  ],

  PADDOCK_BUZZ: [
    n => `Mercedes surveille votre junior ${n}.`,
    n => `Red Bull s'intéresse de près à ${n}.`,
    n => `Les médias parlent de ${n} comme futur crack.`,
    n => `${n} épate les ingénieurs lors des tests.`,
    n => `La presse classe ${n} parmi les meilleurs espoirs.`,
    n => `Ferrari serait prête à faire une offre pour ${n}.`,
    n => `${n} impressionne en F2 — les équipes top se réveillent.`,
  ],

  generateJuniorProfile(j, save){
    const cap = this.ACADEMY_MAX_OVR;
    // Un gros potentiel donne une meilleure base, mais la sortie d'académie reste plafonnée.
    const base = Math.min(cap - 5, 58 + Math.round((j.potential||75) * 0.14));
    const ovr = this.capVal(base + Math.floor(Math.random()*5), cap);
    const shuffled = [...this.JUNIOR_TRAITS].sort(()=>Math.random()-0.5);
    const traits = shuffled.slice(0, 2 + Math.floor(Math.random()*2));
    const stats = {
      pace:        this.capVal(base + (Math.random()>0.5?3:-2), cap),
      consistency: this.capVal(base + (Math.random()>0.5?2:-3), cap),
      wetSkill:    this.capVal(base + (Math.random()>0.5?4:-1), cap),
      overtaking:  this.capVal(base + (Math.random()>0.5?3:-2), cap),
      defending:   this.capVal(base + (Math.random()>0.5?2:-2), cap),
    };
    traits.forEach(t=>{ if(t.stat && stats[t.stat]!==undefined) stats[t.stat]=this.capVal(stats[t.stat]+t.bonus, cap); });
    return this.capProfile({ ovr, stats, traits: traits.map(t=>t.id) }, j.potential);
  },

  progressJuniors(save){
    this.ensure(save);
    const im = save.immersion;
    im.juniorAcademy.forEach(j=>{
      const base = 1 + Math.floor(Math.random()*3);
      const prev = j.progress||0;
      j.progress = Math.min(100, prev + base);
      j.age = j.age || 17;

      if(j.progress >= 100 && prev < 100){
        j.potential = Math.min(99,(j.potential||70)+1);
        j.progress = 30;
        j.paliers = (j.paliers||0) + 1;
        j.note = ['Franchit un cap décisif en F2.','Meilleur temps aux tests de Jerez.','Sa régularité impressionne les recruteurs.'][Math.floor(Math.random()*3)];
      }

      const paliers = j.paliers||0;
      const wasPromotable = j.promotable;
      j.promotable = !j.promoted && (paliers >= 3 || (j.potential||70) >= 88);

      if(j.promotable && !wasPromotable && !j.profile){
        j.profile = this.generateJuniorProfile(j, save);
        j.stage = 'reserve';
        const fn = `${j.firstName} ${j.name}`;
        const buzz = this.PADDOCK_BUZZ[Math.floor(Math.random()*this.PADDOCK_BUZZ.length)](fn);
        this.addNews(save,'🌟',`Académie — ${fn} promouvable`, buzz);
      }

      if(!j.promotable && Math.random()<0.18){
        const fn = `${j.firstName} ${j.name}`;
        const buzzes = [
          `${fn} signe un hat-trick de poles en Formule 3.`,
          `${fn} marque les esprits avec une remontée spectaculaire.`,
          `L'académie note des progrès constants chez ${fn}.`,
        ];
        this.addNews(save,'🌱','Académie — Progression', buzzes[Math.floor(Math.random()*buzzes.length)]);
      }
    });

    if((save.race||0) > 4){
      const promotables = im.juniorAcademy.filter(j=>j.promotable && !j.promoted);
      if(promotables.length && Math.random()<0.25){
        const j = promotables[Math.floor(Math.random()*promotables.length)];
        const msg = this.PADDOCK_BUZZ[Math.floor(Math.random()*this.PADDOCK_BUZZ.length)](`${j.firstName} ${j.name}`);
        this.addNews(save,'👀','Intérêt extérieur — paddock', msg);
      }
    }

    // Évolution des juniors déjà promus
    this.evolvePromotedJuniors(save);
  },

  juniorFP(save, juniorId, session='fp1'){
    this.ensure(save);
    const im = save.immersion;
    const j = im.juniorAcademy.find(x=>x.id===juniorId);
    if(!j || !j.promotable) return { ok:false, msg:'Ce junior n\'est pas encore promouvable.' };
    if(j.promoted) return { ok:false, msg:'Ce pilote est déjà titulaire.' };
    j.fpSessions = (j.fpSessions||0) + 1;
    const crash = Math.random() < 0.08;
    const t = (Math.random()*1.2-0.6);
    const timeStr = (t>=0?'+':'')+t.toFixed(3)+'s';
    const gain = crash ? 0 : Math.ceil(Math.random()*2);
    const repGain = crash ? -2 : (t<0 ? 5 : 2);
    if(!crash && j.profile){
      const stat = ['pace','consistency','wetSkill'][Math.floor(Math.random()*3)];
      j.profile.stats[stat] = this.capVal((j.profile.stats[stat]||65)+gain);
      j.profile.ovr = this.capVal((j.profile.ovr||65)+Math.ceil(gain/2));
      this.capProfile(j.profile, j.potential);
    }
    if(im.teamReputation) im.teamReputation.value = Math.max(0,Math.min(100,(im.teamReputation.value||50)+repGain));
    const fn = `${j.firstName} ${j.name}`;
    const lbl = { fp1:'EL1', fp2:'EL2', rookie:'Session rookie' }[session]||session.toUpperCase();
    let title, text;
    if(crash){ title=`${fn} accroche lors des ${lbl}`; text=`Une erreur de jeunesse. Voiture endommagée, pilote indemne. Expérience acquise.`; }
    else if(t<-0.2){ title=`${fn} impressionne aux ${lbl}`; text=`${timeStr} vs leader. L'ingénieur de piste est enthousiaste.`; }
    else { title=`${fn} — ${lbl} terminés`; text=`${timeStr} vs leader. Session correcte, données récupérées.`; }
    this.addNews(save, crash?'💥':'🏎️', title, text, 'junior');
    Save.save(save);
    return { ok:true, crash, timeStr, gain, repGain, session:lbl };
  },

  promoteJunior(save, juniorId, replaceDriverId=null){
    this.ensure(save);
    const im = save.immersion;
    const j = im.juniorAcademy.find(x=>x.id===juniorId);
    if(!j || !j.promotable) return { ok:false, msg:'Ce junior n\'est pas promouvable.' };
    if(j.promoted) return { ok:false, msg:'Déjà promu.' };
    if(!j.profile) j.profile = this.generateJuniorProfile(j, save);
    this.capProfile(j.profile, j.potential);

    const currentTeamDrivers = (typeof F1Data !== 'undefined')
      ? F1Data.drivers.filter(d=>d.teamId===save.playerTeamId && !d.retired)
      : [];
    if(currentTeamDrivers.length >= 2 && !replaceDriverId){
      return { ok:false, needReplacement:true, msg:'Choisis le titulaire à remplacer avant de promouvoir ce junior.' };
    }

    let newDriver = null;
    let transfer = { ok:true, replaced:null };
    if(typeof F1Data !== 'undefined'){
      const stats = j.profile?.stats || {};
      const ovr = this.capVal(j.profile?.ovr || 70);
      newDriver = {
        id:`JR_${j.id}`, name:j.name, firstName:j.firstName, nationality:j.flag,
        teamId:null, number:10+Math.floor(Math.random()*89),
        age:j.age||18, potential:j.potential||80, trait:j.profile?.traits?.[0]||'prodigy',
        retired:false, generated:true, fromAcademy:true,
        pace:this.capVal(stats.pace||ovr), consistency:this.capVal(stats.consistency||ovr-1),
        wetSkill:this.capVal(stats.wetSkill||ovr-2), overtaking:this.capVal(stats.overtaking||ovr-2),
        defending:this.capVal(stats.defending||ovr-3),
        salary:Math.max(1,Math.min(3,Math.round(ovr*0.035))), seasons:0, contractYears:2,
      };
      const existing = F1Data.drivers.find(d=>d.id===newDriver.id);
      if(existing) Object.assign(existing, newDriver);
      else F1Data.drivers.push(newDriver);

      const contract = { salary:newDriver.salary, years:2, role:'pilote2' };
      if(typeof Career !== 'undefined' && Career.replacePlayerDriver){
        transfer = Career.replacePlayerDriver(save, newDriver, replaceDriverId, contract);
        if(!transfer.ok) return transfer;
      } else {
        if(currentTeamDrivers.length >= 2){
          const replaced = F1Data.drivers.find(x=>x.id===replaceDriverId && x.teamId===save.playerTeamId && !x.retired);
          if(!replaced) return { ok:false, msg:'Pilote à remplacer introuvable.' };
          replaced.teamId = null;
          replaced.contractYears = 0;
          transfer.replaced = replaced;
        }
        newDriver.teamId = save.playerTeamId;
      }

      save.generatedDrivers = save.generatedDrivers || [];
      const gdIndex = save.generatedDrivers.findIndex(d=>d.id===newDriver.id);
      const generatedCopy = { ...newDriver };
      if(gdIndex >= 0) save.generatedDrivers[gdIndex] = generatedCopy;
      else save.generatedDrivers.push(generatedCopy);

      save.contracts = save.contracts || {};
      save.contracts[newDriver.id] = { years:2, salary:newDriver.salary, status:'pilote2', refus:0, cooldownUntilSeason:0, satisfaction:68 };
      if(transfer.replaced){
        save.contracts[transfer.replaced.id] = { ...(save.contracts[transfer.replaced.id]||{}), years:0, status:'agent libre', satisfaction:Math.max(25,(save.contracts[transfer.replaced.id]?.satisfaction||50)-12) };
      }

      save.driverStates=save.driverStates||{};
      save.driverStates[newDriver.id]={...newDriver, fromAcademy:true};
      if(transfer.replaced) save.driverStates[transfer.replaced.id] = { ...(save.driverStates[transfer.replaced.id]||{}), teamId:null, contractYears:0 };
      if(typeof Save !== 'undefined' && Save.persistDriverStates) Save.persistDriverStates(save);
      save.finances = save.finances || { income:0, expenses:0 };
      save.finances.expenses = Math.round(F1Data.drivers.filter(x=>x.teamId===save.playerTeamId&&!x.retired).reduce((sum,x)=>sum+(Number(x.salary)||0),0)*10)/10;
    }
    j.promoted=true; j.promotedSeason=save.season||2025; j.driverId=newDriver?.id; j.stage='f1';
    const fn=`${j.firstName} ${j.name}`;
    const repTxt = transfer?.replaced ? ` Il remplace ${transfer.replaced.firstName} ${transfer.replaced.name}, désormais agent libre.` : '';
    this.addNews(save,'🏁','Promotion en F1 !',`${fn} rejoint l\'équipe comme titulaire.${repTxt} Contrat rookie : ${newDriver?.salary||1}M€/an sur 2 ans.`,'promotion');
    if(im.staffMorale){ im.staffMorale.value=Math.min(100,(im.staffMorale.value||60)+6); im.staffMorale.note=`L'équipe est fière de voir ${j.firstName} franchir le pas.`; }
    if(im.sponsorMood){ im.sponsorMood.value=Math.min(100,(im.sponsorMood.value||60)+3); im.sponsorMood.note=`Les sponsors apprécient la promotion d'un jeune talent maison.`; }
    if(im.teamReputation){ im.teamReputation.value=Math.min(100,(im.teamReputation.value||50)+4); if(!im.teamReputation.tags.includes('Formation jeunes')) im.teamReputation.tags.push('Formation jeunes'); }
    Save.save(save);
    return { ok:true, driver:newDriver, replaced:transfer?.replaced||null, msg:`${fn} est officiellement en Formule 1 !${repTxt}\nContrat rookie : ${newDriver?.salary||1}M€/an, 2 ans.` };
  },

  evolvePromotedJuniors(save){
    this.ensure(save);
    const im = save.immersion;
    im.juniorAcademy.filter(j=>j.promoted&&j.driverId).forEach(j=>{
      const d = typeof F1Data!=='undefined' ? F1Data.drivers.find(x=>x.id===j.driverId) : null;
      if(!d||d.retired) return;
      if((d.age||18)<=22 && Math.random()<0.4){
        const stat=['pace','consistency','wetSkill','overtaking'][Math.floor(Math.random()*4)];
        d[stat]=Math.min(d.potential||90,(d[stat]||65)+1);
      }
      const race=save.race||0;
      if(race>0 && race%6===0 && j._lastStoryRace!==race){
        j._lastStoryRace=race;
        const fn=`${j.firstName} ${j.name}`;
        const roll=Math.random();
        if(roll<0.15)      this.addNews(save,'🚀','Percée !',`${fn} signe sa meilleure course. Le paddock retient son nom.`,'junior');
        else if(roll<0.25) this.addNews(save,'📉','Passage à vide',`${fn} traverse une période difficile. L'adaptation à la F1 prend du temps.`,'junior');
        else if(roll<0.35) this.addNews(save,'💬','Médias',`La presse compare déjà ${fn} aux grands noms de sa génération.`,'junior');
      }
    });
  },

  syncLatestGp(save){
    if(!save || !save.lastGpSummary) return save;
    this.ensure(save);
    const gp = save.lastGpSummary;
    const key = `${gp.season || save.season}-${gp.raceNumber || save.race}-${gp.circuitId || gp.circuitName}`;
    if(save.immersion.lastProcessedGpKey !== key){
      this.afterRace(save, gp);
    }
    return save;
  },

  top(obj, n=5, asc=false){
    return Object.entries(obj||{}).map(([id,v])=>({id, name:v.name||id, value:v.value||0}))
      .sort((a,b)=>asc?a.value-b.value:b.value-a.value).slice(0,n);
  }
};


// Exposition globale : nécessaire pour que race.html puisse appeler Immersion.afterRace()
// depuis un autre bloc <script>. Sans ça, les stats existent mais ne sont jamais alimentées.
if (typeof window !== 'undefined') {
  window.Immersion = Immersion;
}
