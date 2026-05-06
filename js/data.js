// ============================================================
//  F1 Manager — data.js  (v4 — avec âges, traits, base noms)
// ============================================================

const F1Data = {

  // ── PNEUS ─────────────────────────────────────────────────
  tyres: {
    SOFT:   { name: 'Soft',     color: '#FF3333', degradationRate: 0.045, grip: 1.00, warmupLaps: 1 },
    MEDIUM: { name: 'Medium',   color: '#FFD700', degradationRate: 0.025, grip: 0.97, warmupLaps: 2 },
    HARD:   { name: 'Hard',     color: '#FFFFFF', degradationRate: 0.012, grip: 0.94, warmupLaps: 3 },
    INTER:  { name: 'Inter',    color: '#00CC44', degradationRate: 0.030, grip: 0.88, warmupLaps: 2 },
    WET:    { name: 'Full Wet', color: '#4488FF', degradationRate: 0.020, grip: 0.80, warmupLaps: 2 },
  },

  // ── CIRCUITS ──────────────────────────────────────────────
  circuits: [
    { id:'bahrain',     name:'Bahrain',     fullName:'Bahrain International Circuit',        laps:57, lapDistance:5.412, baseLapTime:93.5,  pitLoss:22, overtakingDifficulty:0.40, tyreDegradation:1.20, drsZones:2, fuelPerLap:1.8 },
    { id:'jeddah',      name:'Jeddah',      fullName:'Jeddah Corniche Circuit',               laps:50, lapDistance:6.174, baseLapTime:90.5,  pitLoss:21, overtakingDifficulty:0.42, tyreDegradation:0.95, drsZones:3, fuelPerLap:2.1 },
    { id:'melbourne',   name:'Australie',   fullName:'Albert Park Circuit',                   laps:58, lapDistance:5.278, baseLapTime:80.8,  pitLoss:20, overtakingDifficulty:0.55, tyreDegradation:1.00, drsZones:4, fuelPerLap:1.8 },
    { id:'imola',       name:'Imola',       fullName:'Autodromo Enzo e Dino Ferrari',          laps:63, lapDistance:4.909, baseLapTime:78.5,  pitLoss:25, overtakingDifficulty:0.72, tyreDegradation:0.90, drsZones:1, fuelPerLap:1.6 },
    { id:'miami',       name:'Miami',       fullName:'Miami International Autodrome',          laps:57, lapDistance:5.412, baseLapTime:91.1,  pitLoss:22, overtakingDifficulty:0.50, tyreDegradation:1.15, drsZones:3, fuelPerLap:1.9 },
    { id:'monaco',      name:'Monaco',      fullName:'Circuit de Monaco',                     laps:78, lapDistance:3.337, baseLapTime:75.0,  pitLoss:28, overtakingDifficulty:0.95, tyreDegradation:0.70, drsZones:1, fuelPerLap:1.2 },
    { id:'canada',      name:'Canada',      fullName:'Circuit Gilles-Villeneuve',              laps:70, lapDistance:4.361, baseLapTime:74.0,  pitLoss:19, overtakingDifficulty:0.35, tyreDegradation:1.05, drsZones:3, fuelPerLap:1.55 },
    { id:'barcelona',   name:'Espagne',     fullName:'Circuit de Barcelona-Catalunya',         laps:66, lapDistance:4.657, baseLapTime:78.8,  pitLoss:22, overtakingDifficulty:0.62, tyreDegradation:1.35, drsZones:2, fuelPerLap:1.7 },
    { id:'austria',     name:'Autriche',    fullName:'Red Bull Ring',                          laps:71, lapDistance:4.318, baseLapTime:66.4,  pitLoss:19, overtakingDifficulty:0.28, tyreDegradation:1.05, drsZones:3, fuelPerLap:1.45 },
    { id:'silverstone', name:'Silverstone', fullName:'Silverstone Circuit',                   laps:52, lapDistance:5.891, baseLapTime:89.5,  pitLoss:21, overtakingDifficulty:0.45, tyreDegradation:1.40, drsZones:2, fuelPerLap:2.0 },
    { id:'hungary',     name:'Hongrie',     fullName:'Hungaroring',                            laps:70, lapDistance:4.381, baseLapTime:78.0,  pitLoss:21, overtakingDifficulty:0.82, tyreDegradation:1.25, drsZones:1, fuelPerLap:1.55 },
    { id:'spa',         name:'Spa',         fullName:'Circuit de Spa-Francorchamps',           laps:44, lapDistance:7.004, baseLapTime:106.0, pitLoss:24, overtakingDifficulty:0.35, tyreDegradation:1.10, drsZones:2, fuelPerLap:2.2 },
    { id:'zandvoort',   name:'Pays-Bas',    fullName:'Circuit Zandvoort',                      laps:72, lapDistance:4.259, baseLapTime:71.5,  pitLoss:20, overtakingDifficulty:0.75, tyreDegradation:1.18, drsZones:2, fuelPerLap:1.45 },
    { id:'monza',       name:'Monza',       fullName:'Autodromo Nazionale Monza',              laps:53, lapDistance:5.793, baseLapTime:82.5,  pitLoss:23, overtakingDifficulty:0.30, tyreDegradation:0.90, drsZones:2, fuelPerLap:1.9 },
    { id:'baku',        name:'Azerbaïdjan', fullName:'Baku City Circuit',                      laps:51, lapDistance:6.003, baseLapTime:103.0, pitLoss:20, overtakingDifficulty:0.25, tyreDegradation:0.82, drsZones:2, fuelPerLap:2.0 },
    { id:'singapore',   name:'Singapour',   fullName:'Marina Bay Street Circuit',              laps:62, lapDistance:4.940, baseLapTime:95.0,  pitLoss:27, overtakingDifficulty:0.78, tyreDegradation:1.28, drsZones:3, fuelPerLap:1.75 },
    { id:'suzuka',      name:'Suzuka',      fullName:'Suzuka International Racing Course',     laps:53, lapDistance:5.807, baseLapTime:91.0,  pitLoss:22, overtakingDifficulty:0.60, tyreDegradation:1.15, drsZones:1, fuelPerLap:1.9 },
    { id:'qatar',       name:'Qatar',       fullName:'Lusail International Circuit',           laps:57, lapDistance:5.419, baseLapTime:84.0,  pitLoss:24, overtakingDifficulty:0.58, tyreDegradation:1.55, drsZones:1, fuelPerLap:1.85 },
    { id:'cota',        name:'États-Unis',  fullName:'Circuit of the Americas',                laps:56, lapDistance:5.513, baseLapTime:97.0,  pitLoss:22, overtakingDifficulty:0.48, tyreDegradation:1.20, drsZones:2, fuelPerLap:1.9 },
    { id:'mexico',      name:'Mexique',     fullName:'Autódromo Hermanos Rodríguez',           laps:71, lapDistance:4.304, baseLapTime:78.8,  pitLoss:20, overtakingDifficulty:0.38, tyreDegradation:0.95, drsZones:3, fuelPerLap:1.5 },
    { id:'brazil',      name:'Brésil',      fullName:'Interlagos',                             laps:71, lapDistance:4.309, baseLapTime:71.6,  pitLoss:20, overtakingDifficulty:0.33, tyreDegradation:1.20, drsZones:2, fuelPerLap:1.45 },
    { id:'vegas',       name:'Las Vegas',   fullName:'Las Vegas Strip Circuit',                laps:50, lapDistance:6.201, baseLapTime:94.0,  pitLoss:21, overtakingDifficulty:0.32, tyreDegradation:0.78, drsZones:2, fuelPerLap:2.05 },
    { id:'abudhabi',    name:'Abu Dhabi',   fullName:'Yas Marina Circuit',                     laps:58, lapDistance:5.281, baseLapTime:87.5,  pitLoss:22, overtakingDifficulty:0.52, tyreDegradation:0.98, drsZones:2, fuelPerLap:1.85 },
  ],

  // ── ÉQUIPES 2025 (+ Cadillac 2026) ───────────────────────
  teams: [
    // McLaren — Champions constructeurs 2024, dominants 2025
    { id:'mclaren',     name:'McLaren',         shortName:'MCL', color:'#FF8000', accentColor:'#FFFFFF', budget:480, performance:95, reliability:88, aero:96, chassis:94, engine:90, isPlayer:false },
    // Ferrari — Leclerc + Hamilton, challenger principal
    { id:'ferrari',     name:'Ferrari',         shortName:'FER', color:'#CC0000', accentColor:'#FFD700', budget:490, performance:92, reliability:85, aero:91, chassis:90, engine:96, isPlayer:false },
    // Red Bull — Verstappen + Tsunoda (après swap Lawson)
    { id:'redbull',     name:'Red Bull Racing', shortName:'RBR', color:'#1E3A6E', accentColor:'#FFD700', budget:500, performance:90, reliability:86, aero:92, chassis:90, engine:93, isPlayer:false },
    // Mercedes — Russell + Antonelli (rookie)
    { id:'mercedes',    name:'Mercedes',        shortName:'MER', color:'#00D2BE', accentColor:'#FFFFFF', budget:490, performance:87, reliability:90, aero:86, chassis:88, engine:96, isPlayer:false },
    // Aston Martin — Newey recruté, gros projet 2026
    { id:'aston',       name:'Aston Martin',    shortName:'AMR', color:'#006F62', accentColor:'#FFD700', budget:420, performance:78, reliability:82, aero:77, chassis:79, engine:88, isPlayer:false },
    // Alpine — Saison chaotique, Gasly + Colapinto (remplace Doohan)
    { id:'alpine',      name:'Alpine',          shortName:'ALP', color:'#0090FF', accentColor:'#FF0000', budget:320, performance:70, reliability:76, aero:70, chassis:69, engine:82, isPlayer:false },
    // Williams — Albon + Sainz, remontée sous Vowles
    { id:'williams',    name:'Williams',        shortName:'WIL', color:'#005AFF', accentColor:'#FFFFFF', budget:220, performance:68, reliability:76, aero:67, chassis:69, engine:85, isPlayer:false },
    // Haas — Bearman + Ocon, nouvelle ère
    { id:'haas',        name:'Haas',            shortName:'HAA', color:'#E8002D', accentColor:'#FFFFFF', budget:185, performance:63, reliability:73, aero:62, chassis:64, engine:85, isPlayer:false },
    // Kick Sauber — Hülkenberg + Bortoleto, transition Audi
    { id:'sauber',      name:'Kick Sauber',     shortName:'SAU', color:'#00E701', accentColor:'#FFFFFF', budget:210, performance:61, reliability:74, aero:60, chassis:62, engine:84, isPlayer:false },
    // Racing Bulls — Lawson + Hadjar (après swap Tsunoda→Red Bull)
    { id:'racingbulls', name:'Racing Bulls',    shortName:'RCB', color:'#6692FF', accentColor:'#FFD700', budget:215, performance:72, reliability:77, aero:71, chassis:73, engine:85, isPlayer:false },
    // Cadillac — 11ème équipe 2026, Pérez + Bottas
    { id:'cadillac',    name:'Cadillac',        shortName:'CAD', color:'#1A1A1A', accentColor:'#FFFFFF', budget:280, performance:55, reliability:65, aero:54, chassis:56, engine:82, isPlayer:false },
  ],

  // ── PILOTES 2025-2026 ────────────────────────────────────
  drivers: [
    // ── McLAREN ──────────────────────────────────────────────
    { id:'NOR', name:'Norris',      firstName:'Lando',    teamId:'mclaren',     number:4,  age:25, pace:94, consistency:89, wetSkill:89, overtaking:91, defending:84, salary:20, trait:'aggressive',  potential:97, retired:false },
    { id:'PIA', name:'Piastri',     firstName:'Oscar',    teamId:'mclaren',     number:81, age:24, pace:91, consistency:87, wetSkill:84, overtaking:86, defending:81, salary:10, trait:'consistent',  potential:96, retired:false },

    // ── FERRARI ──────────────────────────────────────────────
    { id:'LEC', name:'Leclerc',     firstName:'Charles',  teamId:'ferrari',     number:16, age:27, pace:94, consistency:87, wetSkill:92, overtaking:89, defending:85, salary:30, trait:'qualifier',   potential:97, retired:false },
    { id:'HAM', name:'Hamilton',    firstName:'Lewis',    teamId:'ferrari',     number:44, age:40, pace:93, consistency:91, wetSkill:96, overtaking:92, defending:90, salary:45, trait:'rain_master', potential:99, retired:false },

    // ── RED BULL ─────────────────────────────────────────────
    { id:'VER', name:'Verstappen',  firstName:'Max',      teamId:'redbull',     number:1,  age:27, pace:98, consistency:96, wetSkill:96, overtaking:95, defending:93, salary:60, trait:'aggressive',  potential:99, retired:false },
    // Tsunoda promu chez Red Bull après 2 courses (remplace Lawson)
    { id:'TSU', name:'Tsunoda',     firstName:'Yuki',     teamId:'redbull',     number:22, age:25, pace:84, consistency:79, wetSkill:80, overtaking:82, defending:76, salary:4,  trait:'aggressive',  potential:89, retired:false },

    // ── MERCEDES ─────────────────────────────────────────────
    { id:'RUS', name:'Russell',     firstName:'George',   teamId:'mercedes',    number:63, age:27, pace:91, consistency:89, wetSkill:88, overtaking:88, defending:84, salary:12, trait:'qualifier',   potential:95, retired:false },
    // Kimi Antonelli — rookie 2025, immense talent
    { id:'ANT', name:'Antonelli',   firstName:'Andrea Kimi', teamId:'mercedes', number:12, age:19, pace:87, consistency:78, wetSkill:82, overtaking:83, defending:74, salary:3,  trait:'prodigy',     potential:98, retired:false },

    // ── ASTON MARTIN ─────────────────────────────────────────
    { id:'ALO', name:'Alonso',      firstName:'Fernando', teamId:'aston',       number:14, age:43, pace:91, consistency:90, wetSkill:94, overtaking:91, defending:96, salary:20, trait:'defender',    potential:99, retired:false },
    { id:'STR', name:'Stroll',      firstName:'Lance',    teamId:'aston',       number:18, age:26, pace:79, consistency:76, wetSkill:74, overtaking:75, defending:77, salary:8,  trait:'consistent',  potential:83, retired:false },

    // ── ALPINE ───────────────────────────────────────────────
    { id:'GAS', name:'Gasly',       firstName:'Pierre',   teamId:'alpine',      number:10, age:29, pace:84, consistency:82, wetSkill:83, overtaking:81, defending:80, salary:6,  trait:'aggressive',  potential:88, retired:false },
    // Colapinto remplace Doohan après 6 courses
    { id:'COL', name:'Colapinto',   firstName:'Franco',   teamId:'alpine',      number:43, age:22, pace:82, consistency:76, wetSkill:79, overtaking:80, defending:74, salary:2,  trait:'aggressive',  potential:92, retired:false },

    // ── WILLIAMS ─────────────────────────────────────────────
    { id:'ALB', name:'Albon',       firstName:'Alexander',teamId:'williams',    number:23, age:29, pace:82, consistency:81, wetSkill:80, overtaking:80, defending:78, salary:4,  trait:'overtaker',   potential:87, retired:false },
    { id:'SAI', name:'Sainz',       firstName:'Carlos',   teamId:'williams',    number:55, age:30, pace:90, consistency:91, wetSkill:86, overtaking:86, defending:88, salary:12, trait:'consistent',  potential:93, retired:false },

    // ── HAAS ─────────────────────────────────────────────────
    // Bearman — rookie très prometteur, ex-Ferrari junior
    { id:'BEA', name:'Bearman',     firstName:'Ollie',    teamId:'haas',        number:87, age:20, pace:83, consistency:77, wetSkill:78, overtaking:79, defending:75, salary:2,  trait:'prodigy',     potential:93, retired:false },
    // Ocon — vient d'Alpine, expérimenté
    { id:'OCO', name:'Ocon',        firstName:'Esteban',  teamId:'haas',        number:31, age:29, pace:81, consistency:80, wetSkill:79, overtaking:78, defending:79, salary:5,  trait:'consistent',  potential:85, retired:false },

    // ── KICK SAUBER ──────────────────────────────────────────
    { id:'HUL', name:'Hülkenberg',  firstName:'Nico',     teamId:'sauber',      number:27, age:37, pace:83, consistency:84, wetSkill:81, overtaking:79, defending:81, salary:6,  trait:'consistent',  potential:87, retired:false },
    // Bortoleto — rookie F2 champion 2024, énorme potentiel
    { id:'BOR', name:'Bortoleto',   firstName:'Gabriel',  teamId:'sauber',      number:5,  age:20, pace:84, consistency:78, wetSkill:80, overtaking:82, defending:73, salary:2,  trait:'prodigy',     potential:95, retired:false },

    // ── RACING BULLS ─────────────────────────────────────────
    // Lawson revenu de Red Bull après swap
    { id:'LAW', name:'Lawson',      firstName:'Liam',     teamId:'racingbulls', number:30, age:23, pace:83, consistency:80, wetSkill:79, overtaking:81, defending:76, salary:3,  trait:'aggressive',  potential:91, retired:false },
    // Hadjar — rookie F2 runner-up 2024
    { id:'HAD', name:'Hadjar',      firstName:'Isack',    teamId:'racingbulls', number:6,  age:20, pace:82, consistency:77, wetSkill:76, overtaking:80, defending:72, salary:2,  trait:'qualifier',   potential:92, retired:false },

    // ── CADILLAC (2026) ──────────────────────────────────────
    { id:'PER', name:'Pérez',       firstName:'Sergio',   teamId:'cadillac',    number:11, age:35, pace:84, consistency:81, wetSkill:79, overtaking:82, defending:84, salary:10, trait:'consistent',  potential:87, retired:false },
    { id:'BOT', name:'Bottas',      firstName:'Valtteri', teamId:'cadillac',    number:77, age:36, pace:81, consistency:82, wetSkill:80, overtaking:77, defending:79, salary:6,  trait:'consistent',  potential:85, retired:false },
  ],

    // ── TRAITS PILOTES ────────────────────────────────────────
  traits: {
    aggressive:  { label:'Agressif',       icon:'🔥', desc:'Dépassements plus faciles, pneus plus usés',        paceBonus:0.15,  tyreMultiplier:1.20, overtakingBonus:3,  wetPenalty:0  },
    consistent:  { label:'Régulier',       icon:'📊', desc:'Rythme stable, gère bien les longs relais',          paceBonus:0,     tyreMultiplier:0.88, overtakingBonus:0,  wetPenalty:0  },
    qualifier:   { label:'Qualifiant',     icon:'⚡', desc:'Très rapide sur un tour, légèrement moins en course', paceBonus:0.20,  tyreMultiplier:1.10, overtakingBonus:1,  wetPenalty:0  },
    rain_master: { label:'Maître pluie',   icon:'🌧️', desc:'Exceptionnel sous la pluie',                        paceBonus:0,     tyreMultiplier:0.95, overtakingBonus:0,  wetPenalty:-5 },
    defender:    { label:'Défenseur',      icon:'🛡️', desc:'Défend très bien sa position',                       paceBonus:0,     tyreMultiplier:0.90, overtakingBonus:-2, wetPenalty:0  },
    overtaker:   { label:'Dépasseur',      icon:'🏎️', desc:'Spécialiste du dépassement en course',               paceBonus:0.05,  tyreMultiplier:1.05, overtakingBonus:5,  wetPenalty:0  },
    prodigy:     { label:'Prodige',        icon:'🌟', desc:'Talent exceptionnel, progression ultra rapide',       paceBonus:0.10,  tyreMultiplier:1.00, overtakingBonus:2,  wetPenalty:0  },
    technical:   { label:'Technicien',     icon:'🔧', desc:'Excellent feedback technique, optimise la voiture',  paceBonus:0.05,  tyreMultiplier:0.85, overtakingBonus:0,  wetPenalty:0  },
  },

  // ── NUMÉROS DISPONIBLES pour nouveaux pilotes ─────────────
  availableNumbers: [2,3,7,8,9,13,15,17,19,20,21,24,25,26,28,29,32,33,34,35,36,37,38,39,40,41,42,45,46,47,48,49,50,51,52,53,54,56,57,58,59,60,61,62,64,65,66,67,68,69,70,71,72,73,74,75,76,78,79,80,82,83,84,85,86,88,89,90,91,92,93,94,95,96,97,98],

  // ── BASE DE NOMS ─────────────────────────────────────────
  driverNames: {
    // Prénoms par nationalité
    firstNames: {
      french:    ['Pierre','Charles','Romain','Jules','Anthoine','Esteban','François','Sébastien','Olivier','Jean','Victor','Hugo','Louis','Théo','Maxime','Adrien','Baptiste','Clément','Damien','Émile'],
      british:   ['Lewis','George','Lando','Oliver','Jack','Jamie','Tom','Harry','Oscar','Callum','Will','James','Alex','Sam','Luke','Dan','Max','Ryan','Jake','Ben'],
      german:    ['Sebastian','Nico','Mick','David','Pascal','Adrian','Felix','Moritz','Florian','Philipp','Jan','Fabian','Simon','Tobias','Michael','Ralf','Heinz','Karl'],
      spanish:   ['Carlos','Fernando','Alex','Marc','Sergio','Dani','Pedro','Roberto','Miguel','Antonio','Juan','Diego','Álvaro','Raúl','Iván','Lorenzo','Víctor'],
      dutch:     ['Max','Nyck','Giedo','Daniël','Rinus','Robin','Bart','Jeroen','Jos','Tom','Liam','Tijmen'],
      italian:   ['Antonio','Luca','Marco','Andrea','Roberto','Davide','Giovanni','Matteo','Lorenzo','Riccardo','Edoardo','Giuliano','Paolo','Stefano'],
      japanese:  ['Yuki','Kazuki','Naoki','Ryo','Kenji','Hiroshi','Takuma','Daisuke','Sho','Nobuharu','Kenta','Marino','Ritomo'],
      brazilian: ['Felipe','Bruno','Nelson','Rubens','Emerson','Ayrton','Piquet','Gabriel','Caio','Vitor','Luca','Pietro','Enzo'],
      australian:['Oscar','Jack','Mark','David','Will','Mitch','Cameron','Thomas','Daniel','Marcus','James','Ryan','Liam'],
      canadian:  ['Lance','Jacques','Gilles','Patrick','Nicholas','Robert','Andre','Mike','Kevin'],
      chinese:   ['Guanyu','Yifei','Ye','Zheng','Wei','Hua','Xin'],
      american:  ['Logan','Mario','Eddie','Scott','Alexander','Ryan','Connor','Tyler','Chase','Austin','Hunter'],
      mexican:   ['Sergio','Esteban','José','Luis','Ricardo','Emiliano','Rodrigo','Diego'],
      finnish:   ['Valtteri','Kimi','Mika','Heikki','Leo','Eetu','Aleksi','Teemu'],
      monegasque:['Charles','Arthur','Louis','Pierre'],
      danish:    ['Kevin','Jan','Tom','Mikkel','Marcus','Frederik'],
    },
    // Noms de famille par nationalité
    lastNames: {
      french:    ['Gasly','Ocon','Grosjean','Vergne','Bianchi','Prost','Villeneuve','Celis','Aubry','Laurent','Renault','Dupont','Martin','Bernard','Lefevre','Fontaine','Girard','Mercier','Dubois','Petit'],
      british:   ['Hamilton','Russell','Norris','Albon','Button','Coulthard','Hill','Mansell','Moss','Clark','Surtees','Hunt','Watson','Warwick','Herbert','Blundell','Palmer','Heidfeld'],
      german:    ['Vettel','Schumacher','Rosberg','Hülkenberg','Marko','Weber','Frentzen','Wendlinger','Ludwig','Barth','Winkelhock','Auer','Trummer'],
      spanish:   ['Sainz','Alonso','Montoya','de la Rosa','Campos','Criville','Aspar','Lopez','Merhi','Llopis','Rueda'],
      dutch:     ['Verstappen','van der Garde','Doornbos','Bleekemolen','Lammers','Vermeulen'],
      italian:   ['Leclerc','Giovinazzi','Fisichella','Trulli','Barrichello','Piquet','Farina','Ascari','Nuvolari','Varzi'],
      japanese:  ['Tsunoda','Kobayashi','Nakajima','Suzuki','Sato','Yamamoto','Inoue','Kato','Noda','Hattori'],
      brazilian: ['Piquet','Barrichello','Massa','Fittipaldi','Senna','Prost','Alesi','Rosset','Bueno','Neto'],
      australian:['Webber','Ricciardo','Brabham','Moffat','Brock','Jones','Davison','Caruso'],
      canadian:  ['Stroll','Villeneuve','Doornbos','Comeau','Tagliani','Lapointe'],
      chinese:   ['Zhou','Ye','Ping','Li','Zhang','Wang','Chen','Liu'],
      american:  ['Sargeant','Andretti','Rahal','Tracy','Franchitti','Sullivan','McGee'],
      mexican:   ['Pérez','Rodriguez','Guerrero','Ibarra','Cortez','Medina'],
      finnish:   ['Bottas','Räikkönen','Häkkinen','Kovalainen','Salo','Rosberg'],
      monegasque:['Leclerc','Grimaldi','Noghes','Frissette'],
      danish:    ['Magnussen','Kristensen','Nielsen','Mortensen','Hansen'],
    },
  },

  // ── SPONSORS ──────────────────────────────────────────────
  sponsorBrands: ['Oracle','Heineken 0.0','DHL','Pirelli','Rolex','Qatar Airways','AWS','Aramco','Santander','Shell','Petronas','Castore','Monster Energy','Google Chrome','OKX','BWT'],

  // ── STAFF ─────────────────────────────────────────────────
  staffPool: [
    { id:'newey',     name:'Adrian Newey',        role:'Directeur technique', bonus:'aero',        level:98, salary:25, cost:45 },
    { id:'wache',     name:'Pierre Waché',         role:'Technique',           bonus:'chassis',     level:91, salary:12, cost:28 },
    { id:'allison',   name:'James Allison',        role:'Technique',           bonus:'chassis',     level:93, salary:15, cost:32 },
    { id:'seidl',     name:'Andreas Seidl',        role:'Opérations',          bonus:'pitstop',     level:86, salary:8,  cost:18 },
    { id:'wheatley',  name:'Jonathan Wheatley',    role:'Sportif',             bonus:'reliability', level:88, salary:8,  cost:20 },
    { id:'stella',    name:'Andrea Stella',        role:'Team principal',      bonus:'consistency', level:90, salary:10, cost:24 },
  ],

  // ── POINTS F1 ─────────────────────────────────────────────
  pointsSystem: [25, 18, 15, 12, 10, 8, 6, 4, 2, 1],

};
