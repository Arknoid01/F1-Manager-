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
    return save;
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

  progressJuniors(save){
    this.ensure(save);
    save.immersion.juniorAcademy.forEach(j=>{
      const gain = 1 + ((save.race || 0) % 3);
      j.progress = Math.min(100, (j.progress||0) + gain);
      if(j.progress>=100){ j.potential = Math.min(99,(j.potential||70)+1); j.progress = 35; j.note = 'Vient de franchir un palier en F2.'; }
    });
  },

  top(obj, n=5, asc=false){
    return Object.entries(obj||{}).map(([id,v])=>({id, name:v.name||id, value:v.value||0}))
      .sort((a,b)=>asc?a.value-b.value:b.value-a.value).slice(0,n);
  }
};
