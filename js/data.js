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

  // ── ÉQUIPES ───────────────────────────────────────────────
  teams: [
    { id:'redbull',     name:'Red Bull Racing', shortName:'RBR', color:'#1E3A6E', accentColor:'#FFD700', budget:500, performance:95, reliability:88, aero:96, chassis:94, engine:93, isPlayer:false },
    { id:'ferrari',     name:'Ferrari',         shortName:'FER', color:'#CC0000', accentColor:'#FFD700', budget:480, performance:92, reliability:84, aero:91, chassis:92, engine:95, isPlayer:false },
    { id:'mercedes',    name:'Mercedes',        shortName:'MER', color:'#00D2BE', accentColor:'#FFFFFF', budget:490, performance:90, reliability:90, aero:89, chassis:93, engine:96, isPlayer:false },
    { id:'mclaren',     name:'McLaren',         shortName:'MCL', color:'#FF8000', accentColor:'#FFFFFF', budget:420, performance:88, reliability:85, aero:90, chassis:87, engine:90, isPlayer:false },
    { id:'aston',       name:'Aston Martin',    shortName:'AMR', color:'#006F62', accentColor:'#FFD700', budget:380, performance:82, reliability:83, aero:81, chassis:83, engine:88, isPlayer:false },
    { id:'alpine',      name:'Alpine',          shortName:'ALP', color:'#0090FF', accentColor:'#FF0000', budget:320, performance:75, reliability:78, aero:76, chassis:74, engine:82, isPlayer:false },
    { id:'williams',    name:'Williams',        shortName:'WIL', color:'#005AFF', accentColor:'#FFFFFF', budget:200, performance:65, reliability:75, aero:64, chassis:66, engine:85, isPlayer:false },
    { id:'haas',        name:'Haas',            shortName:'HAA', color:'#FFFFFF', accentColor:'#FF0000', budget:180, performance:62, reliability:72, aero:61, chassis:63, engine:85, isPlayer:false },
    { id:'sauber',      name:'Kick Sauber',     shortName:'SAU', color:'#00E701', accentColor:'#FFFFFF', budget:190, performance:60, reliability:73, aero:59, chassis:61, engine:84, isPlayer:false },
    { id:'racingbulls', name:'Racing Bulls',    shortName:'RCB', color:'#4477FF', accentColor:'#FFD700', budget:210, performance:68, reliability:76, aero:67, chassis:69, engine:85, isPlayer:false },
  ],

  // ── PILOTES (avec âge, trait, potentiel) ──────────────────
  drivers: [
    // id, name, firstName, teamId, number, age, pace, consistency, wetSkill, overtaking, defending, salary, trait, potential, retired
    { id:'VER', name:'Verstappen', firstName:'Max',       teamId:'redbull',     number:1,  age:27, pace:97, consistency:95, wetSkill:96, overtaking:94, defending:92, salary:55, trait:'aggressive',  potential:99, retired:false },
    { id:'PER', name:'Pérez',      firstName:'Sergio',    teamId:'redbull',     number:11, age:34, pace:87, consistency:82, wetSkill:80, overtaking:83, defending:85, salary:12, trait:'consistent',  potential:88, retired:false },
    { id:'LEC', name:'Leclerc',    firstName:'Charles',   teamId:'ferrari',     number:16, age:27, pace:93, consistency:86, wetSkill:91, overtaking:88, defending:84, salary:25, trait:'qualifier',   potential:96, retired:false },
    { id:'SAI', name:'Sainz',      firstName:'Carlos',    teamId:'ferrari',     number:55, age:30, pace:89, consistency:90, wetSkill:85, overtaking:85, defending:87, salary:10, trait:'consistent',  potential:91, retired:false },
    { id:'HAM', name:'Hamilton',   firstName:'Lewis',     teamId:'mercedes',    number:44, age:40, pace:94, consistency:92, wetSkill:95, overtaking:93, defending:91, salary:40, trait:'rain_master', potential:99, retired:false },
    { id:'RUS', name:'Russell',    firstName:'George',    teamId:'mercedes',    number:63, age:27, pace:90, consistency:88, wetSkill:87, overtaking:87, defending:83, salary:8,  trait:'qualifier',   potential:94, retired:false },
    { id:'NOR', name:'Norris',     firstName:'Lando',     teamId:'mclaren',     number:4,  age:25, pace:92, consistency:87, wetSkill:88, overtaking:89, defending:82, salary:15, trait:'aggressive',  potential:96, retired:false },
    { id:'PIA', name:'Piastri',    firstName:'Oscar',     teamId:'mclaren',     number:81, age:24, pace:88, consistency:85, wetSkill:83, overtaking:84, defending:80, salary:6,  trait:'consistent',  potential:95, retired:false },
    { id:'ALO', name:'Alonso',     firstName:'Fernando',  teamId:'aston',       number:14, age:43, pace:91, consistency:89, wetSkill:93, overtaking:90, defending:95, salary:20, trait:'defender',    potential:99, retired:false },
    { id:'STR', name:'Stroll',     firstName:'Lance',     teamId:'aston',       number:18, age:26, pace:78, consistency:75, wetSkill:73, overtaking:74, defending:76, salary:8,  trait:'consistent',  potential:82, retired:false },
    { id:'GAS', name:'Gasly',      firstName:'Pierre',    teamId:'alpine',      number:10, age:28, pace:83, consistency:81, wetSkill:82, overtaking:80, defending:79, salary:5,  trait:'aggressive',  potential:87, retired:false },
    { id:'OCO', name:'Ocon',       firstName:'Esteban',   teamId:'alpine',      number:31, age:28, pace:80, consistency:79, wetSkill:78, overtaking:77, defending:78, salary:4,  trait:'consistent',  potential:84, retired:false },
    { id:'ALB', name:'Albon',      firstName:'Alexander', teamId:'williams',    number:23, age:28, pace:81, consistency:80, wetSkill:79, overtaking:79, defending:77, salary:3,  trait:'overtaker',   potential:86, retired:false },
    { id:'SAR', name:'Sargeant',   firstName:'Logan',     teamId:'williams',    number:2,  age:24, pace:72, consistency:70, wetSkill:68, overtaking:69, defending:71, salary:1,  trait:'consistent',  potential:80, retired:false },
    { id:'HUL', name:'Hülkenberg', firstName:'Nico',      teamId:'haas',        number:27, age:37, pace:82, consistency:83, wetSkill:80, overtaking:78, defending:80, salary:3,  trait:'consistent',  potential:86, retired:false },
    { id:'MAG', name:'Magnussen',  firstName:'Kevin',     teamId:'haas',        number:20, age:32, pace:77, consistency:74, wetSkill:76, overtaking:75, defending:77, salary:2,  trait:'aggressive',  potential:80, retired:false },
    { id:'BOT', name:'Bottas',     firstName:'Valtteri',  teamId:'sauber',      number:77, age:35, pace:82, consistency:81, wetSkill:80, overtaking:78, defending:79, salary:4,  trait:'consistent',  potential:86, retired:false },
    { id:'ZHO', name:'Zhou',       firstName:'Guanyu',    teamId:'sauber',      number:24, age:25, pace:75, consistency:74, wetSkill:72, overtaking:72, defending:73, salary:2,  trait:'consistent',  potential:82, retired:false },
    { id:'TSU', name:'Tsunoda',    firstName:'Yuki',      teamId:'racingbulls', number:22, age:24, pace:83, consistency:78, wetSkill:79, overtaking:81, defending:75, salary:3,  trait:'aggressive',  potential:89, retired:false },
    { id:'RIC', name:'Ricciardo',  firstName:'Daniel',    teamId:'racingbulls', number:3,  age:35, pace:84, consistency:79, wetSkill:81, overtaking:86, defending:78, salary:5,  trait:'overtaker',   potential:90, retired:false },
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
  availableNumbers: [5,6,7,8,9,12,13,15,17,19,21,25,26,28,29,30,32,33,34,35,36,37,38,39,40,41,42,43,45,46,47,48,49,50,51,52,53,54,56,57,58,59,60],

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
