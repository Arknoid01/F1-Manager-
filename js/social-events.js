// Génération partagée des messages sociaux (index + page social)
function getSocialMemory(save, driverId) {
  const driverName = F1Data.drivers.find(d=>d.id===driverId)?.name || '';
  const history = (save.socialHistory || []).filter(h => h.driverName?.includes(driverName));
  const lastChoices = history.slice(0, 5).map(h => h.choiceType || 'neutral');
  const hardCount   = lastChoices.filter(c => c === 'negative').length;
  const softCount   = lastChoices.filter(c => c === 'positive').length;
  return {
    wasHard:    hardCount >= 2,      // TP a été dur récemment
    wasSoft:    softCount >= 3,      // TP a été très accommodant
    lastType:   lastChoices[0] || 'none',
    count:      history.length,
    recentDnf:  history.slice(0,3).some(h => h.trigger?.includes('Abandon')),
    recentGood: history.slice(0,3).some(h => h.trigger?.includes('Podium') || h.trigger?.includes('P1') || h.trigger?.includes('P2')),
  };
}

//  ESCALADE NARRATIVE 
// Déclenche des situations en cascade selon les événements précédents
function checkEscalation(save, driverId, race, season) {
  const mem = getSocialMemory(save, driverId);
  const loyalty = save.driverLoyalty?.[driverId] ?? 50;
  const moral   = save.immersion?.driverMorale?.[driverId]?.value ?? 70;
  const d = F1Data.drivers.find(x=>x.id===driverId);
  if (!d) return null;

  // Escalade 1 : TP dur plusieurs fois → pilote menace de partir
  if (mem.wasHard && loyalty < 35 && !save[`esc_threat_${driverId}_${season}`]) {
    save[`esc_threat_${driverId}_${season}`] = true;
    return {
      id: `esc_threat_${driverId}_${season}`,
      driverId, type:'escalation',
      trigger:'⚠️ Situation critique',
      urgent: true,
      text:`URGENT — ${d.firstName} ${d.name} a mandaté son agent pour explorer d'autres options. Vos dernières interactions ont sérieusement entamé la relation. Il faut agir maintenant ou le perdre.`,
      choices:[
        { text:"Réunion privée immédiate. On repart sur des bases saines.", effect:{moral:+15,confiance:+12,loyalty:+15}, label:'🚨 Sauvetage', type:'positive' },
        { text:"On lui propose une prolongation avec augmentation.", effect:{moral:+10,confiance:+8,loyalty:+10,contractSignal:true}, label:'💰 Offre', type:'neutral' },
        { text:"S'il veut partir, on le remplace. On ne supplie pas.", effect:{moral:-15,confiance:-15,loyalty:-20}, label:'🚪 Adieu', type:'negative' },
      ]
    };
  }

  // Escalade 2 : Moral très bas depuis 3 GP → pilote demande un changement radical
  if (moral < 30 && mem.count >= 2 && !save[`esc_crisis_${driverId}_${race}`]) {
    save[`esc_crisis_${driverId}_${race}`] = true;
    return {
      id: `esc_crisis_${driverId}_${race}`,
      driverId, type:'escalation',
      trigger:'🆘 Crise de confiance',
      urgent: true,
      text:`${d.firstName} ${d.name} demande un entretien d'urgence. Son moral est au plus bas depuis plusieurs GP. Il envisage sérieusement de demander une thérapie du sport ou un congé.`,
      choices:[
        { text:"On fait venir un psychologue du sport. Sa santé mentale prime.", effect:{moral:+20,confiance:+10,loyalty:+12}, label:'❤️ Soutien total', type:'positive' },
        { text:"On allège son programme et on en parle régulièrement.", effect:{moral:+12,confiance:+8,loyalty:+8}, label:'🤝 Aménagement', type:'neutral' },
        { text:"Le sport de haut niveau c'est mental. Il doit se dépasser.", effect:{moral:-10,confiance:-8,loyalty:-8,pace:+2}, label:'💪 Dureté', type:'negative' },
      ]
    };
  }

  // Escalade 3 : Série de bons résultats + TP accommodant → demande de leadership
  if (mem.recentGood && mem.wasSoft && !save[`esc_leader_${driverId}_${season}`]) {
    save[`esc_leader_${driverId}_${season}`] = true;
    return {
      id: `esc_leader_${driverId}_${season}`,
      driverId, type:'escalation',
      trigger:'🌟 Demande de leadership',
      text:`Fort de vos relations excellentes et de ses récents résultats, ${d.firstName} ${d.name} propose de devenir le porte-parole de l'équipe et de prendre plus de responsabilités en développement voiture.`,
      choices:[
        { text:"Oui. Tu deviens l'ambassadeur technique et commercial de l'équipe.", effect:{moral:+10,confiance:+10,loyalty:+10,pace:+2,tokenBonus:+1}, label:'👑 Rôle élargi', type:'positive' },
        { text:"Ton rôle principal c'est de conduire vite. Le reste on gère.", effect:{moral:-3,confiance:+2,pace:+3}, label:'🏎️ Focus piste', type:'neutral' },
        { text:"On verra ça en fin de saison selon les résultats finaux.", effect:{moral:+2,confiance:+2}, label:'⏳ Report', type:'negative' },
      ]
    };
  }

  return null;
}

//  ARC NARRATIF DE SAISON 
// Situations spécifiques selon la phase de saison
function getSeasonArcEvent(save, d, race, season, totalRaces) {
  const pct = race / totalRaces; // 0 = début, 1 = fin
  const driverPts = save.driverStandings?.[d.id] || 0;
  const existing = (save.socialEvents||[]).find(e => e.driverId === d.id && !e.resolved);
  if (existing) return null;

  // ACTE 1 — Début de saison (GP 1-5) : ambitions et objectifs
  if (pct < 0.22 && !save[`arc_start_${d.id}_${season}`]) {
    save[`arc_start_${d.id}_${season}`] = true;
    return {
      id:`arc_start_${d.id}_${season}`, driverId:d.id, type:'season_arc',
      trigger:'🏁 Début de saison — objectifs',
      text:`${d.firstName} ${d.name} veut définir vos objectifs communs pour cette saison. C'est le moment de poser les bases de votre collaboration et de fixer les ambitions.`,
      choices:[
        { text:"Minimum 3 podiums et le top 6 constructeurs.", effect:{moral:+8,confiance:+6,loyalty:+5,pace:+1}, label:'🎯 Ambitieux', type:'positive' },
        { text:"On progresse GP après GP. Pas d'objectif chiffré.", effect:{moral:+4,confiance:+4,loyalty:+3}, label:'📈 Progressif', type:'neutral' },
        { text:"L'objectif c'est de maximiser chaque point disponible.", effect:{moral:+2,confiance:+3,pace:+2}, label:'🧮 Pragmatique', type:'negative' },
      ]
    };
  }

  // ACTE 2 — Montée en puissance (GP 6-11) : premiers vrais tests
  if (pct >= 0.22 && pct < 0.48 && !save[`arc_build_${d.id}_${season}`]) {
    save[`arc_build_${d.id}_${season}`] = true;
    const onTrack = driverPts >= 20;
    return {
      id:`arc_build_${d.id}_${season}`, driverId:d.id, type:'season_arc',
      trigger:'📊 Bilan du premier tiers',
      text:`${d.firstName} ${d.name} fait le point avec vous. ${onTrack ? `Avec ${driverPts} points, la dynamique est bonne. Il veut maintenant viser plus haut.` : `Seulement ${driverPts} points. Il faut analyser ce qui coince et trouver les solutions ensemble.`}`,
      choices:[
        { text: onTrack ? "On vise le top 5 constructeurs d'ici la fin." : "On repart de zéro. Nouveaux réglages, nouvelle approche.", effect:{moral:+8,confiance:+7,loyalty:+5,pace:+2}, label: onTrack?'🚀 Ambition':'🔄 Reset', type:'positive' },
        { text:"On continue dans la même direction en optimisant.", effect:{moral:+4,confiance:+4}, label:'🔧 Optimisation', type:'neutral' },
        { text: onTrack ? "Garde la tête froide. Le championnat est long." : "Les résultats doivent changer rapidement.", effect:{moral:-2,confiance:+2,pace:+2}, label: onTrack?'🧊 Prudence':'⚠️ Pression', type:'negative' },
      ]
    };
  }

  // ACTE 3 — Tension mi-saison (GP 12-16) : décisions cruciales
  if (pct >= 0.48 && pct < 0.70 && !save[`arc_tension_${d.id}_${season}`]) {
    save[`arc_tension_${d.id}_${season}`] = true;
    return {
      id:`arc_tension_${d.id}_${season}`, driverId:d.id, type:'season_arc',
      trigger:'⚡ Phase cruciale de la saison',
      text:`${d.firstName} ${d.name} sent que les prochains GP sont décisifs. C'est maintenant que se jouent les positions finales. Il veut savoir ce qu'on est prêts à risquer.`,
      choices:[
        { text:"On joue l'attaque totale. Setup agressif, stratégie audacieuse.", effect:{moral:+6,confiance:+5,pace:+3,dnfRisk:true}, label:'🔥 Tout ou rien', type:'positive' },
        { text:"On joue nos forces. Régularité et opportunisme.", effect:{moral:+4,confiance:+5,pace:+1}, label:'🎯 Régularité', type:'neutral' },
        { text:"On sécurise les points. Pas de risque inutile.", effect:{moral:+2,confiance:+3,pace:-1}, label:'🛡️ Sécurité', type:'negative' },
      ]
    };
  }

  // ACTE 4 — Sprint final (GP 17-20) : tout donner
  if (pct >= 0.70 && pct < 0.87 && !save[`arc_sprint_${d.id}_${season}`]) {
    save[`arc_sprint_${d.id}_${season}`] = true;
    return {
      id:`arc_sprint_${d.id}_${season}`, driverId:d.id, type:'season_arc',
      trigger:'🏃 Sprint final',
      text:`Plus que ${Math.round(totalRaces - race)} GP. ${d.firstName} ${d.name} veut tout donner sur ce finish de saison. Il demande carte blanche sur son style de pilotage.`,
      choices:[
        { text:"Carte blanche. Tu sais ce que tu as à faire. On te fait confiance.", effect:{moral:+12,confiance:+10,loyalty:+8,pace:+3}, label:'🃏 Carte blanche', type:'positive' },
        { text:"On attaque mais dans les limites du raisonnable.", effect:{moral:+6,confiance:+6,pace:+2}, label:'⚡ Contrôlé', type:'neutral' },
        { text:"On maintient le cap. Pas de changement de stratégie.", effect:{moral:-2,confiance:+2,pace:+1}, label:'📋 Discipline', type:'negative' },
      ]
    };
  }

  // ACTE 5 — Épilogue (GP 21-23) : bilan et futur
  if (pct >= 0.87 && !save[`arc_end_${d.id}_${season}`]) {
    save[`arc_end_${d.id}_${season}`] = true;
    return {
      id:`arc_end_${d.id}_${season}`, driverId:d.id, type:'season_arc',
      trigger:'🏆 Fin de saison — bilan',
      text:`${d.firstName} ${d.name} veut faire le bilan de cette saison ensemble avant le dernier GP. ${driverPts} points. C'est le moment de regarder en arrière... et vers l'avenir.`,
      choices:[
        { text:"Une saison qui nous a beaucoup appris. On repart plus forts.", effect:{moral:+10,confiance:+8,loyalty:+8,contractSignal:true}, label:'🌟 Positif', type:'positive' },
        { text:"Des hauts et des bas. On analyse et on améliore.", effect:{moral:+5,confiance:+5,loyalty:+4}, label:'📊 Objectif', type:'neutral' },
        { text:"Franchement, on attendait mieux. On en parle cet hiver.", effect:{moral:-5,confiance:-3,loyalty:-4}, label:'😤 Déception', type:'negative' },
      ]
    };
  }

  return null;
}

//  GÉNÉRATEUR PRINCIPAL 
function generateSocialEvents(save) {
  const events = [];
  const drivers    = F1Data.drivers.filter(d => d.teamId === save.playerTeamId && !d.retired);
  const lastGP     = save.lastGpSummary;
  const race       = save.race || 0;
  const season     = save.season || 2025;
  const totalRaces = F1Data.circuits.length;
  const circuits   = F1Data.circuits || [];
  const circuit    = circuits[race % Math.max(1, circuits.length)];

  //  VÉRIFICATION ESCALADES D'ABORD 
  // Les escalades sont prioritaires — elles écrasent les situations normales
  drivers.forEach(d => {
    const existing = (save.socialEvents||[]).find(e => e.driverId === d.id && !e.resolved);
    if (existing) return;
    const escalation = checkEscalation(save, d.id, race, season);
    if (escalation) events.push(escalation);
  });

  //  ARC NARRATIF 
  drivers.forEach(d => {
    const existing = (save.socialEvents||[]).find(e => e.driverId === d.id && !e.resolved);
    if (existing) return;
    const arcEvent = getSeasonArcEvent(save, d, race, season, totalRaces);
    if (arcEvent) events.push(arcEvent);
  });

  //  SITUATIONS CONTEXTUELLES 
  drivers.forEach(d => {
    const mem        = getSocialMemory(save, d.id);
    const moral      = save.immersion?.driverMorale?.[d.id]?.value ?? 70;
    const confiance  = save.driverConfidence?.[d.id] ?? 50;
    const loyalty    = save.driverLoyalty?.[d.id] ?? 50;
    const contract   = save.contracts?.[d.id];
    const yearsLeft  = contract?.years ?? 2;
    const driverPts  = save.driverStandings?.[d.id] || 0;
    const allPts     = Object.values(save.driverStandings||{});
    const driverRank = allPts.filter(v=>v>driverPts).length + 1;
    const lastResult = lastGP?.playerResults?.find(r => r.driverName?.includes(d.name));

    const existing = (save.socialEvents||[]).find(e => e.driverId === d.id && !e.resolved);
    if (existing) return;

    // Adapter le ton selon la mémoire
    const tonePrefix = mem.wasHard
      ? `Malgré les tensions récentes, `
      : mem.wasSoft
      ? `Dans le sillage de vos bonnes relations, `
      : '';

    // DNF récent — ton adapté à l historique
    if (lastResult?.status === 'dnf' && !save[`social_dnf_${d.id}_${race}`]) {
      const baseTexts = [
        `${d.firstName} ${d.name} est dans le garage, casque encore sur la tête.`,
        `${d.firstName} ${d.name} n'a pas dit un mot depuis l'abandon.`,
        `Abandon brutal pour ${d.firstName} ${d.name}. La frustration est visible.`,
        `${d.firstName} ${d.name} est assis seul dans le motorhome depuis 20 minutes.`,
        `Le mécanicien en chef vous prévient : ${d.firstName} ${d.name} est dans un état difficile.`,
      ];
      const text = tonePrefix + baseTexts[race % baseTexts.length] + (mem.wasHard ? ' Après vos dernières discussions tendues, cette conversation va être délicate.' : ' Comment gérez-vous la situation ?');
      events.push({ id:`dnf_${d.id}_${race}`, driverId:d.id, type:'dnf', trigger:'Abandon au dernier GP',
        text,
        choices: mem.wasHard ? [
          { text:"On met de côté nos tensions. Je suis là pour toi.", effect:{moral:+12,confiance:+10,loyalty:+8}, label:'🤝 Réconciliation', type:'positive' },
          { text:"C'était mécanique. On regarde les données ensemble.", effect:{moral:+5,confiance:+6}, label:'📊 Analyse', type:'neutral' },
          { text:"Un abandon de plus. C'est inacceptable.", effect:{moral:-15,confiance:-10,loyalty:-8}, label:'😤 Colère', type:'negative' },
        ] : [
          { text:"C'était mécanique, pas ta faute. On règle ça en usine.", effect:{moral:+8,confiance:+5,loyalty:+3}, label:'🤝 Soutien', type:'positive' },
          { text:"Analysons ensemble. Tu aurais pu anticiper ?", effect:{moral:+2,confiance:+4}, label:'📊 Analyse', type:'neutral' },
          { text:"Ces abandons coûtent cher aux sponsors.", effect:{moral:-10,confiance:-6,loyalty:-3,pace:+2}, label:'😤 Pression', type:'negative' },
        ]
      });
      save[`social_dnf_${d.id}_${race}`] = true;
    }
    // Moral bas — textes variés
    else if (moral < 35 && !save[`social_moral_${d.id}_${race}`]) {
      const moralTexts = [
        `${d.firstName} ${d.name} semble absent. Ses réponses sont laconiques.`,
        `Le staff rapporte que ${d.firstName} ${d.name} quitte le garage sans débriefing.`,
        `${d.firstName} ${d.name} a été photographié dans un restaurant rival.`,
        `Les journalistes notent la mine fermée de ${d.firstName} ${d.name} en conférence.`,
        `${d.firstName} ${d.name} a sauté deux sessions de debriefing cette semaine.`,
      ];
      events.push({ id:`moralLow_${d.id}_${race}`, driverId:d.id, type:'moral', trigger:'Moral en baisse',
        text: moralTexts[race % moralTexts.length],
        choices:[
          { text:"Je crois en toi. Tu es essentiel à ce projet.", effect:{moral:+14,confiance:+7,loyalty:+5}, label:'💪 Soutien', type:'positive' },
          { text:"Qu'est-ce qui se passe vraiment ? Parle-moi.", effect:{moral:+6,confiance:+10}, label:'🤝 Dialogue', type:'neutral' },
          { text:"Les résultats doivent s'améliorer ou on reconsidère.", effect:{moral:-8,confiance:-6,loyalty:-5,pace:+3}, label:'⚠️ Ultimatum', type:'negative' },
        ]
      });
      save[`social_moral_${d.id}_${race}`] = true;
    }
    // Contrat expire
    else if (yearsLeft <= 1 && !save[`social_contract_${d.id}_${season}`]) {
      const contractTexts = [
        `L'agent de ${d.firstName} ${d.name} a contacté deux équipes rivales.`,
        `${d.firstName} ${d.name} vous demande un entretien. Son contrat expire et il veut savoir où il en est.`,
        `La presse spécule sur l'avenir de ${d.firstName} ${d.name}. Des offres sont sur la table.`,
        `${d.firstName} ${d.name} n'a pas encore signé nulle part mais les discussions avancent ailleurs.`,
      ];
      events.push({ id:`contract_${d.id}_${season}`, driverId:d.id, type:'contract', trigger:'Contrat en fin de saison',
        text: contractTexts[season % contractTexts.length],
        choices:[
          { text:"On te prolonge. Tu es central à notre projet.", effect:{moral:+12,confiance:+12,loyalty:+10,contractSignal:true}, label:'✅ Prolongation', type:'positive' },
          { text:"Je veux te garder, laisse-moi du temps.", effect:{moral:+3,confiance:+3,loyalty:-2}, label:'⏳ Patience', type:'neutral' },
          { text:"On évalue toutes les options. Rien n'est décidé.", effect:{moral:-8,confiance:-10,loyalty:-8}, label:'❄️ Ambiguïté', type:'negative' },
        ]
      });
      save[`social_contract_${d.id}_${season}`] = true;
    }
    // Podium
    else if (lastResult?.position <= 3 && lastResult?.position && !save[`social_podium_${d.id}_${race}`]) {
      const podiumTexts = [
        `${d.firstName} ${d.name} rayonne après son P${lastResult.position}. Le garage était en feu.`,
        `P${lastResult.position} pour ${d.firstName} ${d.name}. Les interviews s'enchaînent, les sponsors sont ravis.`,
        `Le sourire de ${d.firstName} ${d.name} en dit long. Une performance magistrale.`,
        `${d.firstName} ${d.name} est euphorique. C'est le moment de capitaliser sur cet élan.`,
        `Podium de ${d.firstName} ${d.name}. Dans les coulisses, l'équipe retient ses larmes de joie.`,
      ];
      events.push({ id:`podium_${d.id}_${race}`, driverId:d.id, type:'podium', trigger:`Podium P${lastResult.position}`,
        text: podiumTexts[race % podiumTexts.length],
        choices:[
          { text:"Tu as été parfait. Ce podium est entièrement mérité.", effect:{moral:+10,confiance:+7,loyalty:+5}, label:'🏆 Célébration', type:'positive' },
          { text:"Excellent travail. Maintenant on vise la victoire.", effect:{moral:+6,confiance:+5,pace:+2}, label:'🎯 Ambition', type:'neutral' },
          { text:"Bonne course mais le rythme en fin de relance était insuffisant.", effect:{moral:-3,confiance:+2,pace:+3}, label:'📊 Critique', type:'negative' },
        ]
      });
      save[`social_podium_${d.id}_${race}`] = true;
    }
    // Victoire
    else if (lastResult?.position === 1 && !save[`social_win_${d.id}_${race}`]) {
      const winTexts = [
        `${d.firstName} ${d.name} est en mode champion. Les interviews s'enchaînent.`,
        `Victoire de ${d.firstName} ${d.name}. Son agent appelle déjà pour renégocier.`,
        `${d.firstName} ${d.name} a gagné et il le sait. Son attitude a changé.`,
        `Le vestiaire résonne. ${d.firstName} ${d.name} veut célébrer mais aussi envoyer un message à la concurrence.`,
      ];
      events.push({ id:`win_${d.id}_${race}`, driverId:d.id, type:'victory', trigger:'Gestion post-victoire',
        text: winTexts[race % winTexts.length],
        choices:[
          { text:"En public on célèbre, en privé on recadre si besoin.", effect:{moral:+6,confiance:+6,loyalty:+4}, label:'🏆 Diplomatie', type:'positive' },
          { text:"Laisse-le profiter. Une victoire ça se célèbre.", effect:{moral:+10,loyalty:+4,confiance:-2}, label:'🎉 Liberté', type:'neutral' },
          { text:"Une victoire c'est bien. Ne te repose pas sur tes lauriers.", effect:{moral:-4,confiance:+3,pace:+3}, label:'📋 Rigueur', type:'negative' },
        ]
      });
      save[`social_win_${d.id}_${race}`] = true;
    }
    // Points marqués
    else if (lastResult?.position <= 8 && lastResult?.position && !save[`social_good_${d.id}_${race}`]) {
      events.push({ id:`good_${d.id}_${race}`, driverId:d.id, type:'performance', trigger:`P${lastResult.position} au dernier GP`,
        text:`${d.firstName} ${d.name} est satisfait de son P${lastResult.position}. ${tonePrefix}Il cherche votre validation avant le prochain GP.`,
        choices:[
          { text:"Très bonne course. L'équipe est fière de toi.", effect:{moral:+7,confiance:+5,loyalty:+3}, label:'👍 Validation', type:'positive' },
          { text:"Points pris, c'est l'essentiel. On continue.", effect:{moral:+3,confiance:+3}, label:'📈 Pragmatisme', type:'neutral' },
          { text:"On méritait mieux. Des erreurs à analyser.", effect:{moral:-4,confiance:-2,pace:+2}, label:'🔍 Exigence', type:'negative' },
        ]
      });
      save[`social_good_${d.id}_${race}`] = true;
    }
    // Rivalité interne
    else if (drivers.length >= 2 && race > 5 && !save[`social_rivalry_${season}`] && Math.random() < 0.35) {
      const d2 = drivers.find(x => x.id !== d.id);
      if (d2) {
        events.push({ id:`rivalry_${season}_${race}`, driverId:d.id, type:'rivalry', trigger:'Tension en interne',
          text:`${d.firstName} ${d.name} estime que ${d2.firstName} ${d2.name} reçoit un traitement de faveur sur le setup et la stratégie. La tension monte dans le garage.`,
          choices:[
            { text:"Les deux pilotes sont traités à égalité. Je te le garantis.", effect:{moral:+8,confiance:+6,loyalty:+4}, label:'⚖️ Équité', type:'positive' },
            { text:"On analyse et on clarifie ensemble.", effect:{moral:+4,confiance:+5}, label:'📊 Transparence', type:'neutral' },
            { text:"C'est moi qui décide des priorités.", effect:{moral:-8,confiance:-8,loyalty:-5,pace:+3}, label:'✊ Autorité', type:'negative' },
          ]
        });
        save[`social_rivalry_${season}`] = true;
      }
    }
    // Anniversaire
    else if (!save[`social_bday_${d.id}_${season}`] && d.age && (race % 5 === 2)) {
      events.push({ id:`bday_${d.id}_${season}`, driverId:d.id, type:'birthday', trigger:'Anniversaire',
        text:`C'est l'anniversaire de ${d.firstName} ${d.name} ce week-end. Un geste humain peut faire beaucoup pour la relation.`,
        choices:[
          { text:"Message personnel + cadeau de l'équipe.", effect:{moral:+10,confiance:+6,loyalty:+8}, label:'🎂 Célébration', type:'positive' },
          { text:"Un mot rapide. Simple mais sincère.", effect:{moral:+5,confiance:+4,loyalty:+4}, label:'👋 Discret', type:'neutral' },
          { text:"On a une course à préparer.", effect:{moral:-3,confiance:-2,loyalty:-3}, label:'😐 Neutre', type:'negative' },
        ]
      });
      save[`social_bday_${d.id}_${season}`] = true;
    }
    // Demande augmentation
    else if (race > 10 && driverPts > 40 && !save[`social_salary_${d.id}_${season}`] && Math.random() < 0.4) {
      events.push({ id:`salary_${d.id}_${season}`, driverId:d.id, type:'salary', trigger:'Discussion financière',
        text:`Avec ${driverPts} pts, l'agent de ${d.firstName} ${d.name} estime que son salaire ne reflète plus sa valeur. ${mem.wasHard ? 'Le contexte tendu de vos relations complique les négociations.' : ''}`,
        choices:[
          { text:"Tu mérites une revalorisation. On trouve un accord.", effect:{moral:+10,confiance:+8,loyalty:+6}, label:'💰 Accord', type:'positive' },
          { text:"On en parle en fin de saison.", effect:{moral:+2,confiance:+2,loyalty:-2}, label:'⏳ Report', type:'neutral' },
          { text:"Ton contrat court jusqu'au bout.", effect:{moral:-8,confiance:-8,loyalty:-6}, label:'🚫 Refus', type:'negative' },
        ]
      });
      save[`social_salary_${d.id}_${season}`] = true;
    }
    // Rumeur top team
    else if (driverPts > 60 && !save[`social_rumor_${d.id}_${season}`] && Math.random() < 0.3) {
      const topTeams = ['Ferrari','McLaren','Red Bull','Mercedes'];
      const topTeam  = topTeams[race % topTeams.length];
      events.push({ id:`rumor_${d.id}_${season}`, driverId:d.id, type:'rumor', trigger:'Rumeur de transfert',
        text:`La presse annonce que ${topTeam} s'intéresse à ${d.firstName} ${d.name}. ${mem.wasHard ? 'Étant donné vos tensions récentes, cette rumeur prend une dimension particulière.' : 'Il attend votre réaction avant de se prononcer.'}`,
        choices:[
          { text:"Tu es intransférable. On prolonge et on augmente.", effect:{moral:+12,confiance:+10,loyalty:+12}, label:'💎 Engagement', type:'positive' },
          { text:"Je comprends l'intérêt mais notre projet est solide.", effect:{moral:+5,confiance:+5,loyalty:+4}, label:'🤝 Discussion', type:'neutral' },
          { text:"S'il veut partir, c'est son choix.", effect:{moral:-12,confiance:-12,loyalty:-15}, label:'🚪 Indifférence', type:'negative' },
        ]
      });
      save[`social_rumor_${d.id}_${season}`] = true;
    }
    // Plainte voiture
    else if (moral < 55 && !save[`social_carcomp_${d.id}_${race}`] && Math.random() < 0.3) {
      events.push({ id:`carcomp_${d.id}_${race}`, driverId:d.id, type:'complaint', trigger:'Insatisfaction voiture',
        text:`${d.firstName} ${d.name} exprime ses frustrations : la voiture manque d equilibre. ${mem.count > 2 ? "Ce n est pas la premiere fois qu il souleve ce probleme." : ""}`,
        choices:[
          { text:"On prend ça en compte. Réunion technique cette semaine.", effect:{moral:+8,confiance:+6}, label:'🔧 Action', type:'positive' },
          { text:"La voiture s'améliore. Encore un peu de patience.", effect:{moral:+2,confiance:+2}, label:'⏳ Patience', type:'neutral' },
          { text:"C'est le mieux avec ce budget. Adapte-toi.", effect:{moral:-10,confiance:-8,loyalty:-4}, label:'😤 Dure réalité', type:'negative' },
        ]
      });
      save[`social_carcomp_${d.id}_${race}`] = true;
    }
    // Blessure légère
    else if (!save[`social_injury_${d.id}_${season}`] && race > 5 && Math.random() < 0.12) {
      events.push({ id:`injury_${d.id}_${season}`, driverId:d.id, type:'injury', trigger:'Légère blessure',
        text:`${d.firstName} ${d.name} a signalé une douleur. Rien de grave mais le médecin recommande du repos avant le prochain GP.`,
        choices:[
          { text:"Sa santé d'abord. On évalue au jour le jour.", effect:{moral:+10,confiance:+8,loyalty:+8}, label:'❤️ Santé', type:'positive' },
          { text:"Traitement intensif et on l'aligne si possible.", effect:{moral:+3,confiance:+3,loyalty:+2}, label:'💊 Traitement', type:'neutral' },
          { text:"Il roule sauf avis contraire. On a besoin de lui.", effect:{moral:-8,confiance:-6,loyalty:-5,pace:-2}, label:'⚠️ Risqué', type:'negative' },
        ]
      });
      save[`social_injury_${d.id}_${season}`] = true;
    }
    // Demande simulateur
    else if (!save[`social_sim_${d.id}_${season}`] && race > 2 && race < 18 && Math.random() < 0.25) {
      events.push({ id:`sim_${d.id}_${season}`, driverId:d.id, type:'simulator', trigger:'Demande simulateur',
        text:`${d.firstName} ${d.name} demande plus de temps simulateur pour travailler son style de freinage.`,
        choices:[
          { text:"Accordé. On organise deux jours à l'usine.", effect:{moral:+7,confiance:+5,pace:+2}, label:'✅ Accordé', type:'positive' },
          { text:"Une journée seulement. Le calendrier est serré.", effect:{moral:+3,confiance:+3,pace:+1}, label:'⏳ Partiel', type:'neutral' },
          { text:"Le simulateur est occupé. On verra après.", effect:{moral:-4,confiance:-3}, label:'❌ Refusé', type:'negative' },
        ]
      });
      save[`social_sim_${d.id}_${season}`] = true;
    }
    // Demande statut N1
    else if (driverRank <= 5 && yearsLeft >= 2 && !save[`social_n1_${d.id}_${season}`] && Math.random() < 0.25) {
      events.push({ id:`n1_${d.id}_${season}`, driverId:d.id, type:'number1', trigger:'Demande statut numéro 1',
        text:`${d.firstName} ${d.name} réclame le statut de premier pilote. Il veut la priorité setup et stratégie.`,
        choices:[
          { text:"Tu l'as mérité. Tu es notre pilote numéro 1.", effect:{moral:+12,confiance:+10,loyalty:+8,pace:+2}, label:'⭐ Accordé', type:'positive' },
          { text:"Les deux pilotes restent à égalité.", effect:{moral:-3,confiance:+2}, label:'⚖️ Égalité', type:'neutral' },
          { text:"Les résultats décident. Prouve-le sur la piste.", effect:{moral:-5,confiance:-3,loyalty:-4,pace:+3}, label:'🏁 Mérite', type:'negative' },
        ]
      });
      save[`social_n1_${d.id}_${season}`] = true;
    }
    // Fatigue fin de saison
    else if (race >= totalRaces - 4 && !save[`social_fatigue_${d.id}_${season}`]) {
      events.push({ id:`fatigue_${d.id}_${season}`, driverId:d.id, type:'fatigue', trigger:'Fatigue fin de saison',
        text:`${d.firstName} ${d.name} accuse le coup. Après ${race} GP, la fatigue se lit sur son visage. Les dernières courses sont cruciales.`,
        choices:[
          { text:"Prends soin de toi. On gère ensemble ces derniers GP.", effect:{moral:+8,confiance:+6,loyalty:+4}, label:'❤️ Bienveillance', type:'positive' },
          { text:"Encore quelques courses. Tu peux le faire.", effect:{moral:+4,confiance:+3}, label:'💪 Motivation', type:'neutral' },
          { text:"La fatigue ne peut pas être une excuse.", effect:{moral:-6,confiance:-4,pace:+2}, label:'😤 Exigence', type:'negative' },
        ]
      });
      save[`social_fatigue_${d.id}_${season}`] = true;
    }
    // Série négative
    else if (driverPts < 10 && race > 5 && !save[`social_slump_${d.id}_${season}`] && Math.random() < 0.5) {
      events.push({ id:`slump_${d.id}_${season}`, driverId:d.id, type:'slump', trigger:'Série de mauvais résultats',
        text:`${d.firstName} ${d.name} traverse une période difficile. ${driverPts} points en ${race} GP. ${mem.wasHard ? "La situation est critique — vos tensions recentes n arrangent rien." : "Le paddock commence a parler."}`,
        choices:[
          { text:"On analyse ensemble. Je crois en ton potentiel.", effect:{moral:+10,confiance:+8,loyalty:+5}, label:'🤝 Confiance', type:'positive' },
          { text:"On change quelque chose : setup, stratégie, programme.", effect:{moral:+4,confiance:+4,pace:+2}, label:'🔧 Changement', type:'neutral' },
          { text:"Les résultats doivent changer ou on reconsidère.", effect:{moral:-10,confiance:-8,loyalty:-6,pace:+3}, label:'⚠️ Ultimatum', type:'negative' },
        ]
      });
      save[`social_slump_${d.id}_${season}`] = true;
    }
    // Série positive
    else if (driverPts > 50 && moral > 75 && !save[`social_momentum_${d.id}_${season}`] && race > 8) {
      events.push({ id:`momentum_${d.id}_${season}`, driverId:d.id, type:'momentum', trigger:'Série positive',
        text:`${d.firstName} ${d.name} est en pleine confiance. ${driverPts} points et une dynamique remarquable. Il veut capitaliser sur cet élan.`,
        choices:[
          { text:"On vise plus haut. Attaque totale sur les prochains GP.", effect:{moral:+8,confiance:+8,pace:+2,loyalty:+4}, label:'🔥 Full attack', type:'positive' },
          { text:"Excellente série. On reste concentrés et humbles.", effect:{moral:+4,confiance:+5,loyalty:+2}, label:'🎯 Focus', type:'neutral' },
          { text:"Garde la tête froide. Le championnat est long.", effect:{moral:+1,confiance:+2}, label:'🧊 Prudence', type:'negative' },
        ]
      });
      save[`social_momentum_${d.id}_${season}`] = true;
    }
    // Vie privée
    else if (!save[`social_private_${d.id}_${season}`] && race > 6 && Math.random() < 0.2) {
      events.push({ id:`private_${d.id}_${season}`, driverId:d.id, type:'personal', trigger:'Vie privée',
        text:`${d.firstName} ${d.name} vous confie que les voyages permanents pèsent sur sa vie de famille. Il cherche un équilibre.`,
        choices:[
          { text:"On peut adapter le programme. Ta famille c'est important.", effect:{moral:+12,confiance:+8,loyalty:+10}, label:'❤️ Humanité', type:'positive' },
          { text:"Je comprends. On en parle entre deux saisons.", effect:{moral:+5,confiance:+5,loyalty:+4}, label:'🤝 Écoute', type:'neutral' },
          { text:"Le niveau élite exige des sacrifices.", effect:{moral:-8,confiance:-5,loyalty:-6}, label:'🏆 Excellence', type:'negative' },
        ]
      });
      save[`social_private_${d.id}_${season}`] = true;
    }
    // Départ imminent
    else if (yearsLeft === 0 && !save[`social_leaving_${d.id}_${season}`]) {
      events.push({ id:`leaving_${d.id}_${season}`, driverId:d.id, type:'departure', trigger:'Départ imminent',
        text:`Le contrat de ${d.firstName} ${d.name} expire en fin de saison. Il a déjà signé ailleurs. Comment gérez-vous ces derniers GP ensemble ?`,
        choices:[
          { text:"On finit avec professionnalisme et respect mutuel.", effect:{moral:+8,confiance:+6,loyalty:+8,pace:+1}, label:'🤝 Fairplay', type:'positive' },
          { text:"On reste focus sur les objectifs. Rien ne change.", effect:{moral:+3,confiance:+3}, label:'🎯 Focus', type:'neutral' },
          { text:"Il part. Minimums syndicaux.", effect:{moral:-10,confiance:-8,loyalty:-10,pace:-2}, label:'❄️ Froid', type:'negative' },
        ]
      });
      save[`social_leaving_${d.id}_${season}`] = true;
    }
    // Bonne ambiance
    else if (moral > 80 && loyalty > 70 && !save[`social_vibe_${d.id}_${season}`] && race > 10 && Math.random() < 0.3) {
      events.push({ id:`vibe_${d.id}_${season}`, driverId:d.id, type:'positive_vibe', trigger:'Excellente ambiance',
        text:`${d.firstName} ${d.name} vous dit que c'est la meilleure ambiance d'équipe qu'il ait connue. Il veut vous remercier personnellement.`,
        choices:[
          { text:"C'est toi qui construis cette dynamique. Merci à toi.", effect:{moral:+8,confiance:+6,loyalty:+8}, label:'🙏 Réciprocité', type:'positive' },
          { text:"L'équipe entière le mérite. On continue.", effect:{moral:+5,confiance:+4,loyalty:+5}, label:'👥 Collectif', type:'neutral' },
          { text:"Bonne ambiance et bons résultats. C'est tout ce qu'on veut.", effect:{moral:+3,confiance:+3}, label:'📊 Résultats', type:'negative' },
        ]
      });
      save[`social_vibe_${d.id}_${season}`] = true;
    }
    // Duel rival
    else if (!save[`social_rival_${d.id}_${race}`] && race > 3 && Math.random() < 0.3) {
      const rivals = F1Data.drivers.filter(x => x.teamId !== save.playerTeamId && !x.retired && x.pace > 85);
      const rival  = rivals[race % Math.max(1,rivals.length)];
      if (rival) {
        events.push({ id:`rival_${d.id}_${race}`, driverId:d.id, type:'rivalry', trigger:'Duel avec un rival',
          text:`${d.firstName} ${d.name} parle de sa bataille avec ${rival.firstName} ${rival.name}. Il veut une stratégie claire pour les prochaines confrontations.`,
          choices:[
            { text:"On prépare un plan d'attaque spécifique contre lui.", effect:{moral:+7,confiance:+6,pace:+2}, label:'⚔️ Plan attaque', type:'positive' },
            { text:"On se concentre sur notre course. Les rivaux viendront.", effect:{moral:+3,confiance:+3}, label:'🎯 Focus', type:'neutral' },
            { text:"Il est plus rapide en ce moment. Sois patient.", effect:{moral:-4,confiance:-2,loyalty:-2}, label:'😐 Réaliste', type:'negative' },
          ]
        });
        save[`social_rival_${d.id}_${race}`] = true;
      }
    }
    // Idée technique pilote
    else if (!save[`social_idea_${d.id}_${season}`] && race > 4 && Math.random() < 0.25) {
      events.push({ id:`idea_${d.id}_${season}`, driverId:d.id, type:'technical', trigger:'Idée technique du pilote',
        text:`${d.firstName} ${d.name} a une idée sur un réglage non conventionnel après avoir discuté avec un ingénieur rival. Il propose de tester le concept.`,
        choices:[
          { text:"On teste en EL. Les pilotes ont souvent de bonnes intuitions.", effect:{moral:+10,confiance:+8,pace:+2}, label:'🔬 On teste', type:'positive' },
          { text:"On en discute avec les ingénieurs et on voit.", effect:{moral:+4,confiance:+4}, label:'💬 Discussion', type:'neutral' },
          { text:"On s'en tient aux protocoles établis.", effect:{moral:-3,confiance:-2}, label:'📋 Protocole', type:'negative' },
        ]
      });
      save[`social_idea_${d.id}_${season}`] = true;
    }
  });

  //  DISCUSSIONS INGÉNIEURS 
  const eng     = save.staff?.find(s => s.role === 'race_engineer' || s.specialty === 'race_engineer');
  const engName = eng ? (eng.firstName ? `${eng.firstName} ${eng.name}` : eng.name) : 'Votre ingénieur';
  const engExisting  = (save.socialEvents||[]).find(e => e.driverId === 'engineer' && !e.resolved);
  const eng2Existing = (save.socialEvents||[]).find(e => e.driverId === 'engineer2' && !e.resolved);

  if (!engExisting) {
    if (race > 0 && !save[`eng_tyres_${race}_${season}`] && Math.random() < 0.45) {
      const highDeg = circuit?.tyreDegradation > 1.2;
      events.push({ id:`eng_tyres_${race}_${season}`, driverId:'engineer', type:'engineer', trigger:`Briefing pneus`,
        text:`${engName} présente l'analyse pneus. Dégradation ${highDeg ? 'élevée' : 'modérée'} sur ce circuit. Quelle stratégie privilégier ?`,
        choices:[
          { text: highDeg ? "2 arrêts Medium/Hard en priorité." : "1 arrêt optimisé, on gère la dégradation.", effect:{tyreBonus:+2,setupBonus:'race'}, label:'🏁 Stratégie course', type:'positive' },
          { text:"Softs au départ, pit tôt, overcut.", effect:{tyreBonus:+1,setupBonus:'qualify'}, label:'⚡ Agressif', type:'neutral' },
          { text:"On s'adapte en direct. Rester flexible.", effect:{tyreBonus:0}, label:'🎲 Improvisation', type:'negative' },
        ]
      });
      save[`eng_tyres_${race}_${season}`] = true;
    }
    else if (save.weekendFPDone >= 2 && !save[`eng_setup_${race}_${season}`] && Math.random() < 0.45) {
      events.push({ id:`eng_setup_${race}_${season}`, driverId:'engineer', type:'engineer', trigger:'Analyse setup post-EL',
        text:`${engName} a compilé les données EL. Deux options : optimiser pour les qualifs ou préserver les pneus pour la course.`,
        choices:[
          { text:"Tout sur la qualif. On maximise la position de départ.", effect:{qualiBonusPct:+3,tyreMalus:+8}, label:'⚡ Mode qualif', type:'positive' },
          { text:"Équilibre qualif/course.", effect:{qualiBonusPct:+1,tyreMalus:+3}, label:'⚖️ Équilibre', type:'neutral' },
          { text:"Priorité course. Les points restent.", effect:{qualiBonusPct:0,tyreMalus:0,raceBonus:+2}, label:'🏁 Mode course', type:'negative' },
        ]
      });
      save[`eng_setup_${race}_${season}`] = true;
    }
    else if (race % 4 === 0 && race > 0 && !save[`eng_rd_${race}_${season}`]) {
      const domains = ['aero','chassis','engine','reliability'];
      const domain  = domains[race % domains.length];
      const labels  = {aero:'aérodynamique',chassis:'châssis',engine:'moteur',reliability:'fiabilité'};
      events.push({ id:`eng_rd_${race}_${season}`, driverId:'engineer', type:'engineer', trigger:'Piste de développement R&D',
        text:`L'équipe a identifié une piste sur le ${labels[domain]}. Feu vert pour orienter les ressources ?`,
        choices:[
          { text:"Lancez les recherches. On investit.", effect:{rdBonus:domain,tokenBonus:+1}, label:'🔬 Investir', type:'positive' },
          { text:"On attend les prochains GP pour confirmer.", effect:{tokenBonus:0}, label:'⏳ Prudence', type:'neutral' },
          { text:"On a d'autres priorités.", effect:{}, label:'❌ Refus', type:'negative' },
        ]
      });
      save[`eng_rd_${race}_${season}`] = true;
    }
    else if (race > 3 && !save[`eng_reliability_${race}_${season}`] && Math.random() < 0.25) {
      const parts = ['boîte de vitesses','MGU-K','turbo','freinage','suspension'];
      const part  = parts[race % parts.length];
      events.push({ id:`eng_reliability_${race}_${season}`, driverId:'engineer', type:'engineer', trigger:'Alerte fiabilité',
        text:`Anomalie détectée sur le ${part}. Changer implique -5 places sur la grille. Ne pas changer risque un abandon.`,
        choices:[
          { text:"On change la pièce. Mieux vaut P-5 que l'abandon.", effect:{moral:+3,confiance:+4,penaltyGrid:true}, label:'🔧 Changement', type:'positive' },
          { text:"On surveille. On change si ça empire.", effect:{moral:+1,confiance:+1}, label:'👁️ Surveillance', type:'neutral' },
          { text:"On prend le risque. On a besoin de la position.", effect:{moral:-2,confiance:-3,dnfRisk:true}, label:'🎲 Risque', type:'negative' },
        ]
      });
      save[`eng_reliability_${race}_${season}`] = true;
    }
    else if (!save[`eng_wing_${race}_${season}`] && Math.random() < 0.35) {
      const highspeed = circuit?.overtakingDifficulty < 0.4;
      events.push({ id:`eng_wing_${race}_${season}`, driverId:'engineer', type:'engineer', trigger:'Choix configuration aileron',
        text:`${engName} propose deux configs. ${highspeed ? 'Circuit rapide : faible appui = vitesse.' : 'Circuit technique : fort appui = tenue.'} Votre choix ?`,
        choices:[
          { text: highspeed ? "Faible appui. Vitesse de pointe." : "Fort appui. Stabilité en virage.", effect:{setupBonus:highspeed?'low_drag':'high_df',pace:+2}, label: highspeed?'💨 Faible appui':'🏁 Fort appui', type:'positive' },
          { text:"Configuration intermédiaire.", effect:{setupBonus:'balanced'}, label:'⚖️ Équilibre', type:'neutral' },
          { text:"On fait confiance au pilote pour le choix.", effect:{moral:+4,confiance:+3}, label:'🤝 Délégation', type:'negative' },
        ]
      });
      save[`eng_wing_${race}_${season}`] = true;
    }
    else if (save.weekendFPDone >= 1 && !save[`eng_feedback_${race}_${season}`] && Math.random() < 0.4) {
      const fbs = [
        `${drivers[0]?.firstName||'Le pilote'} remonte un sous-virage dans les virages lents.`,
        `Retour pilote : survirage en sortie. Solution rapide dispo mais impacte l'usure arrière.`,
        `Le pilote se plaint du plancher. Monter de 2mm réduirait les risques.`,
        `Vibrations inhabituelles signalées au niveau de la suspension avant.`,
      ];
      events.push({ id:`eng_feedback_${race}_${season}`, driverId:'engineer', type:'engineer', trigger:'Feedback pilote — setup',
        text:`${fbs[race % fbs.length]} ${engName} attend votre validation.`,
        choices:[
          { text:"On applique. La sensation pilote prime.", effect:{moral:+5,confiance:+4,pace:+2}, label:'✅ Validé', type:'positive' },
          { text:"On teste en EL3 avant de décider.", effect:{moral:+2,confiance:+3}, label:'🔬 Test', type:'neutral' },
          { text:"Les données disent que c'est optimal. On garde.", effect:{moral:-3,confiance:-2,pace:+1}, label:'📊 Data', type:'negative' },
        ]
      });
      save[`eng_feedback_${race}_${season}`] = true;
    }
    else if (!save[`eng_ers_${race}_${season}`] && race > 6 && Math.random() < 0.3) {
      events.push({ id:`eng_ers_${race}_${season}`, driverId:'engineer', type:'engineer', trigger:'Stratégie ERS',
        text:`${engName} présente trois modes ERS. Chaque choix est un compromis entre performance et durabilité sur la course.`,
        choices:[
          { text:"Mode Attack : déploiement maximum.", effect:{pace:+3,moral:+2,dnfRisk:true}, label:'⚡ Attack', type:'positive' },
          { text:"Mode Standard : équilibre perf/durée.", effect:{pace:+1}, label:'⚖️ Standard', type:'neutral' },
          { text:"Mode Save : on préserve pour la fin.", effect:{pace:-1,tyreBonus:+2}, label:'🔋 Save', type:'negative' },
        ]
      });
      save[`eng_ers_${race}_${season}`] = true;
    }
    else if (!save[`eng_engine_${race}_${season}`] && Math.random() < 0.3) {
      events.push({ id:`eng_engine_${race}_${season}`, driverId:'engineer', type:'engineer', trigger:'Mode moteur',
        text:`Mode qualification possible sur toute la course mais accélérerait l'usure. Risque de pénalité moteur dans 3-4 GP.`,
        choices:[
          { text:"Mode qualif sur toute la course.", effect:{pace:+3,engineWear:+2}, label:'🔥 Pleine puissance', type:'positive' },
          { text:"Mode course avec boost sur les 20 derniers tours.", effect:{pace:+1}, label:'📈 Dosé', type:'neutral' },
          { text:"Mode préservation. La longévité moteur prime.", effect:{pace:-1}, label:'🛡️ Préservation', type:'negative' },
        ]
      });
      save[`eng_engine_${race}_${season}`] = true;
    }
    else if ((save.carDev?.aero?.pending?.length > 0 || save.carDev?.chassis?.pending?.length > 0) && !save[`eng_upgrade_${race}_${season}`]) {
      const dom = save.carDev?.aero?.pending?.length > 0 ? 'aéro' : 'châssis';
      events.push({ id:`eng_upgrade_${race}_${season}`, driverId:'engineer', type:'engineer', trigger:'Upgrade disponible',
        text:`L'upgrade ${dom} vient d'arriver. L'installer maintenant implique des EL raccourcis. Attendre = perdre une course avec l'ancien package.`,
        choices:[
          { text:"On l'installe maintenant. Chaque course compte.", effect:{pace:+3,setupBonus:'balanced'}, label:'🚀 Maintenant', type:'positive' },
          { text:"On teste d'abord en EL pour confirmer le gain.", effect:{pace:+1}, label:'🔬 Test', type:'neutral' },
          { text:"On attend le prochain GP. On fait ça proprement.", effect:{pace:0}, label:'⏳ Attendre', type:'negative' },
        ]
      });
      save[`eng_upgrade_${race}_${season}`] = true;
    }
    else if (save.weekendWeather !== 'dry' && !save[`eng_weather_${race}_${season}`]) {
      const isHeavy = save.weekendWeather === 'heavy_rain';
      events.push({ id:`eng_weather_${race}_${season}`, driverId:'engineer', type:'engineer', trigger:'Briefing météo',
        text:`${engName} alerte : météo ${isHeavy ? 'très perturbée' : 'incertaine'} ce week-end. Plusieurs scénarios possibles.`,
        choices:[
          { text: isHeavy ? "Full Wet en priorité, Inters en backup." : "On prépare les Inters. On sera réactifs.", effect:{weatherBonus:3,moral:+2}, label:'🌧️ Adapté météo', type:'positive' },
          { text:"On reste sur notre plan. La météo changera.", effect:{weatherBonus:+1}, label:'🎲 Optimiste', type:'neutral' },
          { text:"On improvise au muret.", effect:{weatherBonus:0}, label:'🤷 Attentiste', type:'negative' },
        ]
      });
      save[`eng_weather_${race}_${season}`] = true;
    }
  }

  if (!eng2Existing) {
    if (race > 1 && !save[`eng2_postrace_${race}_${season}`] && Math.random() < 0.4) {
      events.push({ id:`eng2_postrace_${race}_${season}`, driverId:'engineer2', type:'engineer', trigger:'Débriefing post-course',
        text:`Votre chef mécanicien présente l'analyse du dernier GP. Trois points d'amélioration potentiels. Où concentrer les efforts ?`,
        choices:[
          { text:"On travaille sur les freinages.", effect:{pace:+2,confiance:+3}, label:'🛑 Freinages', type:'positive' },
          { text:"Priorité à la sortie de virage.", effect:{pace:+2,confiance:+3}, label:'⚡ Accélération', type:'neutral' },
          { text:"On travaille les trois en parallèle.", effect:{pace:+1,tokenBonus:+1}, label:'🔬 Tout', type:'negative' },
        ]
      });
      save[`eng2_postrace_${race}_${season}`] = true;
    }
    else if (!save[`eng2_fitness_${race}_${season}`] && race > 5 && Math.random() < 0.3) {
      const d = drivers[0];
      events.push({ id:`eng2_fitness_${race}_${season}`, driverId:'engineer2', type:'engineer', trigger:'Programme physique',
        text:`Légère baisse de concentration de ${d?.firstName||'votre pilote'} en fin de course. Un programme spécifique est proposé.`,
        choices:[
          { text:"On l'intègre dans le planning.", effect:{pace:+2,moral:+4,confiance:+3}, label:'💪 Programme', type:'positive' },
          { text:"On laisse le pilote gérer son physique.", effect:{moral:+2,confiance:+2}, label:'🤝 Autonomie', type:'neutral' },
          { text:"On se concentre sur la voiture.", effect:{pace:-1,moral:-2}, label:'🚗 Voiture first', type:'negative' },
        ]
      });
      save[`eng2_fitness_${race}_${season}`] = true;
    }
    else if (!save[`eng2_team_${race}_${season}`] && race > 8 && Math.random() < 0.3) {
      events.push({ id:`eng2_team_${race}_${season}`, driverId:'engineer2', type:'engineer', trigger:'Moral du staff technique',
        text:`Fatigue détectée au sein de l'équipe après plusieurs courses consécutives. Un moment de cohésion est suggéré.`,
        choices:[
          { text:"On organise un dîner d'équipe.", effect:{moral:+5,pace:+1}, label:'🍽️ Cohésion', type:'positive' },
          { text:"Une journée de repos supplémentaire.", effect:{moral:+3,pace:+1}, label:'😴 Repos', type:'neutral' },
          { text:"On a un championnat à courir. Le repos attendra.", effect:{moral:-4,pace:-1}, label:'📋 Focus', type:'negative' },
        ]
      });
      save[`eng2_team_${race}_${season}`] = true;
    }
    else if (!save[`eng2_rival_${race}_${season}`] && race > 3 && Math.random() < 0.35) {
      const rivals = F1Data.teams.filter(t => t.id !== save.playerTeamId).sort((a,b)=>b.performance-a.performance);
      const rival  = rivals[race % Math.max(1,rivals.length)];
      events.push({ id:`eng2_rival_${race}_${season}`, driverId:'engineer2', type:'engineer', trigger:'Analyse rivaux',
        text:`L'équipe data a analysé les télémétries de ${rival?.name||'vos rivaux'}. Un point faible exploitable a été identifié.`,
        choices:[
          { text:"On oriente notre setup pour exploiter ça.", effect:{pace:+3,confiance:+4}, label:'🎯 Exploitation', type:'positive' },
          { text:"On note et on adapte notre stratégie de course.", effect:{pace:+1,confiance:+2}, label:'📊 Adaptation', type:'neutral' },
          { text:"On se concentre sur nous.", effect:{pace:0,moral:+2}, label:'🔵 Focus interne', type:'negative' },
        ]
      });
      save[`eng2_rival_${race}_${season}`] = true;
    }
    else if (!save[`eng2_junior_${season}`] && race < 18 && save.immersion?.juniorAcademy?.length > 0 && Math.random() < 0.3) {
      const junior = save.immersion.juniorAcademy[0];
      events.push({ id:`eng2_junior_${season}`, driverId:'engineer2', type:'engineer', trigger:'Opportunité junior',
        text:`${junior?.firstName||'Un junior'} de l'académie demande une session de débriefing avec l'équipe senior pour accélérer son développement.`,
        choices:[
          { text:"On intègre le junior au débriefing complet.", effect:{tokenBonus:+1,moral:+3}, label:'🌱 Formation', type:'positive' },
          { text:"Une session limitée. On garde nos données sensibles.", effect:{moral:+2}, label:'⚖️ Limité', type:'neutral' },
          { text:"Pas le moment.", effect:{}, label:'❌ Pas maintenant', type:'negative' },
        ]
      });
      save[`eng2_junior_${season}`] = true;
    }
  }

  return events;
}

window.SocialEventsSync = {
  sync(save) {
    if (!save || !save.playerTeamId || typeof generateSocialEvents !== 'function') return 0;
    if (!save.socialEvents) save.socialEvents = [];
    const before = save.socialEvents.length;
    const newEvents = generateSocialEvents(save) || [];
    newEvents.forEach(ev => {
      if (!save.socialEvents.find(e => e.id === ev.id)) {
        save.socialEvents.push({ ...ev, read: false, resolved: false });
      }
    });
    const added = save.socialEvents.length - before;
    if (added > 0 && typeof Save !== 'undefined') Save.save(save);
    return added;
  },
  unreadCount(save) {
    return (save?.socialEvents || []).filter(e => !e.resolved && !e.read).length;
  }
};
