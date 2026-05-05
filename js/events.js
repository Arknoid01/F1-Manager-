
// ============================================================
//  F1 Manager — events.js
//  Événements réalistes de carrière, déclenchés avant/après GP
// ============================================================
const CareerEvents = {
  KEY_LAST_PRE: '_lastPreEventRaceKey',
  rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; },
  ensure(save){
    save.news = save.news || [];
    save.reputation = Number.isFinite(save.reputation) ? save.reputation : 50;
    save.driverEffects = save.driverEffects || {};
    save.contracts = save.contracts || {};
    save.aiDevelopment = save.aiDevelopment || {};
    return save;
  },
  teamDrivers(save){ return F1Data.drivers.filter(d=>d.teamId===save.playerTeamId); },
  log(save, item){
    this.ensure(save);
    save.news.unshift({ date:new Date().toISOString(), season:save.season, race:save.race, ...item });
    save.news = save.news.slice(0,30);
  },
  applyDriverEffect(save, driverId, effect){
    this.ensure(save);
    const cur = save.driverEffects[driverId] || { pace:0, consistency:0, wetSkill:0, overtaking:0, defending:0, races:0, label:'' };
    ['pace','consistency','wetSkill','overtaking','defending'].forEach(k=>cur[k]=(cur[k]||0)+(effect[k]||0));
    cur.races = Math.max(cur.races||0, effect.races||1);
    cur.label = effect.label || cur.label;
    save.driverEffects[driverId] = cur;
  },
  decayEffects(save){
    this.ensure(save);
    Object.keys(save.driverEffects).forEach(id=>{
      save.driverEffects[id].races = (save.driverEffects[id].races||0)-1;
      if (save.driverEffects[id].races <= 0) delete save.driverEffects[id];
    });
  },
  triggerPreRace(save){
    this.ensure(save);
    const raceKey = `${save.season}-${save.race}`;
    if (save[this.KEY_LAST_PRE] === raceKey) return null;
    save[this.KEY_LAST_PRE] = raceKey;
    if (Math.random() > 0.55) return null;
    const drivers = this.teamDrivers(save);
    const d = this.rand(drivers);
    const events = [
      () => ({ title:'Blessure légère à l’entraînement', text:`${d.firstName} ${d.name} s’est blessé au poignet en simulateur. Il sera moins performant ce week-end.`, effect:()=>this.applyDriverEffect(save,d.id,{pace:-4,consistency:-3,races:1,label:'Blessure légère'}) }),
      () => ({ title:'Package aérodynamique validé', text:'La FIA valide votre nouveau package aéro. Petit gain immédiat.', effect:()=>{ if(save.carDev?.aero) save.carDev.aero.level=Math.min(100,save.carDev.aero.level+1); save.reputation+=1; } }),
      () => ({ title:'Fuite hydraulique détectée', text:'Les mécaniciens ont repéré un problème avant la course. Fiabilité temporairement en baisse.', effect:()=>{ if(save.carDev?.reliability) save.carDev.reliability.level=Math.max(1,save.carDev.reliability.level-2); } }),
      () => ({ title:'Pilote très en forme', text:`${d.firstName} ${d.name} a dominé les séances libres. Bonus de confiance pour ce GP.`, effect:()=>this.applyDriverEffect(save,d.id,{pace:+2,consistency:+2,races:1,label:'Confiance élevée'}) }),
      () => ({ title:'Contrôle technique renforcé', text:'La FIA contrôle plusieurs pièces. Vos ingénieurs perdent du temps de développement.', effect:()=>{ save.tokens=Math.max(0,(save.tokens||0)-1); } }),
      () => ({ title:'Sponsor satisfait', text:'Un partenaire augmente sa visibilité pour ce GP. Bonus financier immédiat.', effect:()=>{ save.budget=Math.round(((save.budget||0)+8)*10)/10; save.reputation+=1; } }),
      () => ({ title:'Rumeur mercato', text:`Le clan ${d.name} demande des garanties sportives. Sa prolongation coûtera plus cher.`, effect:()=>{ save.contracts[d.id]=save.contracts[d.id]||{years:2}; save.contracts[d.id].salaryDemand=(d.salary||5)+3; } }),
      () => ({ title:'Mise à jour moteur concurrente', text:'Une équipe rivale semble avoir apporté une grosse évolution moteur.', effect:()=>{ const rivals=F1Data.teams.filter(t=>t.id!==save.playerTeamId); const r=this.rand(rivals); save.aiDevelopment[r.id]=save.aiDevelopment[r.id]||{aero:0,chassis:0,engine:0,reliability:0}; save.aiDevelopment[r.id].engine+=1; } }),
    ];
    const ev = this.rand(events)(); ev.effect();
    this.log(save,{phase:'pre',title:ev.title,text:ev.text});
    return ev;
  },
  triggerPostRace(save, summary={}){
    this.ensure(save);
    this.decayEffects(save);
    if (Math.random() > 0.65) return null;
    const drivers=this.teamDrivers(save); const d=this.rand(drivers);
    const events=[
      () => ({ title:'Usine inspirée par le résultat', text:'Les ingénieurs trouvent une piste de développement. +1 token R&D.', effect:()=>{save.tokens=(save.tokens||0)+1;save.reputation+=1;} }),
      () => ({ title:'Accident coûteux au garage', text:'Une casse logistique coûte 6M€ en réparations.', effect:()=>{save.budget=Math.max(0,Math.round(((save.budget||0)-6)*10)/10);save.reputation-=1;} }),
      () => ({ title:'Mécanos en progrès', text:'Les arrêts au stand ont été analysés, le département pit stop progresse.', effect:()=>{ if(save.carDev?.pitstop) save.carDev.pitstop.level=Math.min(100,save.carDev.pitstop.level+1); } }),
      () => ({ title:'Presse positive', text:'La presse souligne votre progression. Réputation en hausse.', effect:()=>{save.reputation=Math.min(100,(save.reputation||50)+3);} }),
      () => ({ title:'Tension interne', text:`${d.firstName} ${d.name} critique la stratégie. Consistance réduite au prochain GP.`, effect:()=>this.applyDriverEffect(save,d.id,{consistency:-3,races:1,label:'Tension interne'}) }),
      () => ({ title:'Sponsor bonus', text:'Un sponsor verse une prime d’image de 10M€.', effect:()=>{save.budget=Math.round(((save.budget||0)+10)*10)/10;} }),
      () => ({ title:'Budget cap surveillé', text:'Les dépenses augmentent, votre département finance signale un risque de dépassement.', effect:()=>{save.finances=save.finances||{income:0,expenses:0};save.finances.expenses+=4;} }),
    ];
    const ev=this.rand(events)(); ev.effect();
    this.log(save,{phase:'post',title:ev.title,text:ev.text});
    return ev;
  },
  applyAiDevelopment(save){
    if(!save?.aiDevelopment) return;
    F1Data.teams.forEach(t=>{
      const ai=save.aiDevelopment[t.id]; if(!ai) return;
      ['aero','chassis','engine','reliability'].forEach(k=>{ if(ai[k]) t[k]=Math.max(1,Math.min(100,(t[k]||70)+ai[k])); });
      t.performance=Math.round((t.aero+t.chassis+t.engine)/3);
    });
  },
  effectiveDriver(driver){
    try{
      const save=Save.load(); if(!save?.driverEffects?.[driver.id]) return driver;
      const e=save.driverEffects[driver.id]; const d={...driver};
      ['pace','consistency','wetSkill','overtaking','defending'].forEach(k=>d[k]=Math.max(1,Math.min(100,(d[k]||70)+(e[k]||0))));
      d.eventLabel=e.label; return d;
    }catch(err){return driver;}
  },
  renewDriver(save, driverId){
    this.ensure(save); const d=F1Data.drivers.find(x=>x.id===driverId); if(!d) return {ok:false,msg:'Pilote introuvable'};
    const demand=save.contracts?.[driverId]?.salaryDemand || (d.salary+2);
    const cost=Math.round(demand*1.5);
    if((save.budget||0)<cost) return {ok:false,msg:'Budget insuffisant'};
    save.budget=Math.round((save.budget-cost)*10)/10;
    save.contracts[driverId]={years:2,salaryDemand:demand};
    this.log(save,{phase:'mercato',title:'Contrat prolongé',text:`${d.firstName} ${d.name} prolonge pour deux saisons. Coût de signature : ${cost}M€.`});
    return {ok:true,msg:`${d.name} prolongé pour ${cost}M€`};
  }
};
