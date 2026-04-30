import OpenAI from "openai";
import { db } from "./_database.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY?.trim()
});

// ===== KATEGORIJSKI KONTEKSTI =====
const CATEGORY_CONTEXTS = {
  plaze:       (db) => ({ grad: db.grad, plaze: db.plaze }),
  gastronomija:(db) => ({ grad: db.grad, gastronomija: db.gastronomija }),
  nautika:     (db) => ({ grad: db.grad, nautika: db.nautika }),
  smjestaj:    (db) => ({ grad: db.grad, smjestaj: db.smjestaj }),
  kornati:     (db) => ({ grad: db.grad, kornati: db.kornati }),
  izleti:      (db) => ({ grad: db.grad, izleti: db.izleti }),
  sport:       (db) => ({ grad: db.grad, sport: db.sport }),
  atrakcije:   (db) => ({ grad: db.grad, atrakcije: db.atrakcije }),
  dogadanja:   (db) => ({ grad: db.grad, dogadanja: db.dogadanja }),
  opcenito:    (db) => ({ grad: db.grad, opcenito: db.opcenito }),
  prakticno:   (db) => ({ grad: db.grad, prakticne_info: db.prakticne_info }),
  klima:       (db) => ({ grad: db.grad, klima: db.klima }),
};

// ===== DETEKCIJA JEZIKA =====
function detectLang(msg, fallback = 'hr') {
  const w = msg.toLowerCase().split(/[\s,?.!;:()\-]+/);
  const has = (list) => list.some(x => w.includes(x));

  // HR — STROGI markeri (čisto hrvatska gramatika, ne postoje u EN/DE/IT/SL/...)
  const hrStrong = ['kako','što','gdje','koji','koja','koje','kada','zašto','koliko',
    'može','možete','imam','imaju','nema','trebam','mogu','jeste','jesi','imate','idemo',
    'plaža','plaže','restoran','konoba','smještaj','jedrilica','čarter','nautika',
    'biogradu','biograda','dalmacij','kakav','kakva','blizu','daleko',
    'preporuč','rezerv','sezona','srpanj','kolovoz','lipanj','rujan',
    'ljeto','zima','proljeće','jesen','klima','vjetar','kiša','bura','maestral',
    'otok','otoci','sidrište'];

  // HR — SLABI markeri (dijele se s drugim jezicima: 'more'=EN, 'hotel'=svugdje...)
  // Koriste se SAMO kad je korisnik već u HR razgovoru (fallback='hr')
  const hrWeak = [...hrStrong,
    'more','mora','sunce','temperatura','hotel','kamp','charter','marina',
    'kornati','kornata','ima'];

  if (fallback === 'hr') {
    if (has(hrWeak)) return 'hr';
  } else {
    // U stranom razgovoru — samo strogi HR markeri mogu resetirati jezik
    if (has(hrStrong)) return 'hr';
  }

  // HU — ugrofinski, veoma distinktivan
  if (has(['hol','mikor','hogyan','mennyibe','tenger','étterem','szállás','szálloda',
           'sziget','kirándulás','köszönöm','kérem','magyarul','magyarország',
           'strand','nincs','igen','van']))
    return 'hu';

  // IT — romanski, distinktivan
  if (has(['dove','quando','come','perché','spiaggia','ristorante','albergo',
           'grazie','ciao','buongiorno','buonasera','cosa','mangiare','bere',
           'escursione','appartamento','prego','italiano','italia','bella','bello',
           'mare','isola','volo','noleggio','quanto','quali']))
    return 'it';

  // DE
  if (has(['was','wo','wie','welche','wann','ist','sind','kann','haben','zeig','gibt',
           'ich','ein','eine','der','die','das','und','oder','nicht','hier','mit',
           'für','von','strand','meer','insel','boot','wetter','unterkunft','hafen']))
    return 'de';

  // EN
  if (has(['what','where','how','which','when','are','have','show','find','tell',
           'best','visit','eat','drink','stay','sleep','book','beach','price',
           'open','boat','sailing','island','water','recommend','charter','accommodation']))
    return 'en';

  // SL — južnoslavenski, srodan HR — tražimo distinktivne slovenačke riječi
  if (has(['kje','kdaj','zakaj','morje','nastanitev','restavracija','iščem',
           'tukaj','torej','katera','kateri','slovenijo','slovenec','slovenka',
           'hvala','prosim','lepo']))
    return 'sl';

  // CS — zapadnoslavenski
  if (has(['kde','pláž','moře','restaurace','ubytování','děkuji','výlet',
           'počasí','jsou','česky','česká','čechy','chci','jaké']))
    return 'cs';

  // SK — zapadnoslavenski
  if (has(['kedy','reštaurácia','ubytovanie','ďakujem','počasie',
           'slovensky','slovenská','som','áno','aké','koľko']))
    return 'sk';

  return fallback;
}

// ===== PRIJEVODI =====
const TR = {
  hr: {
    inCity:   'u Biogradu na Moru',
    beaches:  'Plaže Biograda',
    food:     'Gastronomija i restorani',
    nautical: 'Nautika i marina',
    accom:    'Smještaj',
    kornati:  'NP Kornati — izleti',
    trips:    'Izleti iz Biograda',
    sport:    'Sport i aktivnosti',
    events:   'Događanja',
    general:  'O Biogradu',
    tips:     'Praktične informacije',
    sea:      'temperatura mora',
  },
  en: {
    inCity:   'in Biograd na Moru',
    beaches:  'Beaches',
    food:     'Gastronomy & restaurants',
    nautical: 'Nautical & marina',
    accom:    'Accommodation',
    kornati:  'Kornati NP — excursions',
    trips:    'Day trips from Biograd',
    sport:    'Sports & activities',
    events:   'Events',
    general:  'About Biograd',
    tips:     'Practical info',
    sea:      'sea temperature',
  },
  de: {
    inCity:   'in Biograd na Moru',
    beaches:  'Strände',
    food:     'Gastronomie & Restaurants',
    nautical: 'Nautik & Marina',
    accom:    'Unterkunft',
    kornati:  'NP Kornaten — Ausflüge',
    trips:    'Tagesausflüge ab Biograd',
    sport:    'Sport & Aktivitäten',
    events:   'Veranstaltungen',
    general:  'Über Biograd',
    tips:     'Praktische Infos',
    sea:      'Meerestemperatur',
  },
  sl: {
    inCity:   'v Biogradu na Moru',
    beaches:  'Plaže Biograda',
    food:     'Gastronomija in restavracije',
    nautical: 'Nautika in marina',
    accom:    'Nastanitev',
    kornati:  'NP Kornati — izleti',
    trips:    'Izleti iz Biograda',
    sport:    'Šport in aktivnosti',
    events:   'Dogodki',
    general:  'O Biogradu',
    tips:     'Praktične informacije',
    sea:      'temperatura morja',
  },
  it: {
    inCity:   'a Biograd na Moru',
    beaches:  'Spiagge di Biograd',
    food:     'Gastronomia e ristoranti',
    nautical: 'Nautica e marina',
    accom:    'Alloggio',
    kornati:  'PN Kornati — escursioni',
    trips:    'Gite da Biograd',
    sport:    'Sport e attività',
    events:   'Eventi',
    general:  'Su Biograd',
    tips:     'Informazioni pratiche',
    sea:      'temperatura del mare',
  },
  hu: {
    inCity:   'Biogradban',
    beaches:  'Biograd strandjai',
    food:     'Gasztronómia és éttermek',
    nautical: 'Nautika és kikötő',
    accom:    'Szállás',
    kornati:  'Kornati NP — kirándulások',
    trips:    'Kirándulások Biogradból',
    sport:    'Sport és tevékenységek',
    events:   'Események',
    general:  'Biogradról',
    tips:     'Gyakorlati információk',
    sea:      'tengerpart hőmérséklete',
  },
  cs: {
    inCity:   'v Biogradu na Moři',
    beaches:  'Pláže Biogradu',
    food:     'Gastronomie a restaurace',
    nautical: 'Nautika a marina',
    accom:    'Ubytování',
    kornati:  'NP Kornati — výlety',
    trips:    'Výlety z Biogradu',
    sport:    'Sport a aktivity',
    events:   'Události',
    general:  'O Biogradu',
    tips:     'Praktické informace',
    sea:      'teplota moře',
  },
  sk: {
    inCity:   'v Biogradu na Mori',
    beaches:  'Pláže Biogradu',
    food:     'Gastronómia a reštaurácie',
    nautical: 'Nautika a marina',
    accom:    'Ubytovanie',
    kornati:  'NP Kornati — výlety',
    trips:    'Výlety z Biogradu',
    sport:    'Šport a aktivity',
    events:   'Udalosti',
    general:  'O Biogradu',
    tips:     'Praktické informácie',
    sea:      'teplota mora',
  }
};

// ===== DETEKCIJA KATEGORIJE IZ PORUKE =====
function detectCategory(msg, lastCategory, db) {
  const m = msg.toLowerCase();

  if (m.includes('plaža') || m.includes('plaze') || m.includes('plaže') || m.includes('plaža') || m.includes('kupanje') || m.includes('kupat') || m.includes('dražica') || m.includes('soline') || m.includes('bošana') || m.includes('kumenat') || m.includes('fkk') || m.includes('nudist') || m.includes('pješčan') || m.includes('sunčan') || m.includes('sunbath') || m.includes('more je') || m.includes('lijeva ruka') || m.includes('plivat')
    || m.includes('beach') || m.includes('swim') || m.includes('sunbathe') || m.includes('sand')
    || m.includes('strand') || m.includes('schwimmen') || m.includes('badestrand'))
    return 'plaze';

  if (m.includes('noćni') || m.includes('nocni') || m.includes('klub') || m.includes('disco') || m.includes('party') || m.includes('cocktail') || m.includes('kokteli') || m.includes('nightlife') || m.includes('nachtleben') || m.includes('izlazak') || m.includes('zabav') || m.includes('ples'))
    return 'gastronomija';

  if (m.includes('restoran') || m.includes('jelo') || m.includes('hrana') || m.includes('jesti') || m.includes('ručak') || m.includes('večera') || m.includes('doručak') || m.includes('riba') || m.includes('plodovi mora') || m.includes('konoba') || m.includes('kafi') || m.includes('kav') || m.includes('bar ') || m.includes(' bar') || m.includes('piti') || m.includes('pek') || m.includes('hobotnica') || m.includes('lignje') || m.includes('brancin') || m.includes('brudet') || m.includes('vino') || m.includes('dalmatinska') || m.includes('gastronomij')
    || m.includes('restaurant') || m.includes('food') || m.includes('eat') || m.includes('dinner') || m.includes('lunch') || m.includes('breakfast') || m.includes('fish') || m.includes('seafood') || m.includes('wine') || m.includes('tavern') || m.includes('konoba')
    || m.includes('essen') || m.includes('speise') || m.includes('trinken') || m.includes('café') || m.includes('fisch') || m.includes('wein'))
    return 'gastronomija';

  if (m.includes('marina') || m.includes('brod') || m.includes('jedrilica') || m.includes('jedrenj') || m.includes('charter') || m.includes('nautica') || m.includes('nautika') || m.includes('nautičk') || m.includes('plovidba') || m.includes('plovit') || m.includes('sidriš') || m.includes('vez') || m.includes('gumenjak') || m.includes('motorni brod') || m.includes('rent a boat') || m.includes('rent-a-boat') || m.includes('iznajmit brod') || m.includes('kapacitet veza') || m.includes('kornati marina')
    || m.includes('sailing') || m.includes('boat') || m.includes('yacht') || m.includes('marina') || m.includes('charter') || m.includes('nautical') || m.includes('berth') || m.includes('mooring') || m.includes('catamaran')
    || m.includes('segelboot') || m.includes('boot') || m.includes('jacht') || m.includes('marina') || m.includes('charter'))
    return 'nautika';

  if (m.includes('smještaj') || m.includes('smjestaj') || m.includes('hotel') || m.includes('apartman') || m.includes('soba') || m.includes('noćen') || m.includes('nocen') || m.includes('prenoćiš') || m.includes('kamp') || m.includes('camping') || m.includes('villaa') || m.includes('vila') || m.includes('rezervir') || m.includes('ilirija') || m.includes('bošana kamp') || m.includes('solaris kamp')
    || m.includes('accommodation') || m.includes('hotel') || m.includes('room') || m.includes('sleep') || m.includes('stay') || m.includes('book') || m.includes('apartment') || m.includes('camping') || m.includes('hostel')
    || m.includes('unterkunft') || m.includes('übernacht') || m.includes('zimmer') || m.includes('hotel') || m.includes('camping'))
    return 'smjestaj';

  if (m.includes('kornat') || m.includes('kornati') || m.includes('np kornati') || m.includes('park kornati') || m.includes('izlet kornati') || m.includes('otoci') || m.includes('arhipelag') || m.includes('levrnaka') || m.includes('mana') || m.includes('galešnjak') || m.includes('excursion') || m.includes('day trip to')
    || m.includes('kornaten') || m.includes('national park') || m.includes('inseln'))
    return 'kornati';

  if (m.includes('izlet') || m.includes('okolica') || m.includes('zadar') || m.includes('šibenik') || m.includes('sibenik') || m.includes('krka') || m.includes('vransko') || m.includes('vrana') || m.includes('pašman') || m.includes('pasman') || m.includes('nin ') || m.includes(' nin') || m.includes('paklenica') || m.includes('plitvice') || m.includes('blizina') || m.includes('ausflug')
    || m.includes('trip') || m.includes('excursion') || m.includes('day') || m.includes('nearby') || m.includes('visit zadar') || m.includes('around') || m.includes('surroundings')
    || m.includes('tagesausflug') || m.includes('umgebung'))
    return 'izleti';

  if (m.includes('sport') || m.includes('ronjenj') || m.includes('ronit') || m.includes('diving') || m.includes('snorkeling') || m.includes('windsurfing') || m.includes('kitesurfing') || m.includes('kayak') || m.includes('sup ') || m.includes('bicikl') || m.includes('ribolov') || m.includes('tenis') || m.includes('rekreacij') || m.includes('aktiv') || m.includes('paragliding') || m.includes('penjanje') || m.includes('pješačenj') || m.includes('hiking')
    || m.includes('sport') || m.includes('dive') || m.includes('swim') || m.includes('cycling') || m.includes('kayak') || m.includes('fishing') || m.includes('tennis') || m.includes('recreation') || m.includes('adventure')
    || m.includes('sport') || m.includes('tauchen') || m.includes('radfahren') || m.includes('angeln'))
    return 'sport';

  // Dinamička provjera: prepoznaj bilo koji naziv događanja iz baze
  if (db?.dogadanja?.eventi?.length) {
    const eventWords = db.dogadanja.eventi
      .flatMap(e => (e.naziv || '').toLowerCase().split(/[\s\-&]+/))
      .filter(w => w.length > 3);
    if (eventWords.some(w => m.includes(w))) return 'dogadanja';
  }

  if (m.includes('događaj') || m.includes('dogadaj') || m.includes('festival') || m.includes('boat show') || m.includes('manifestac') || m.includes('program') || m.includes('što se događa') || m.includes('što ima') || m.includes('ribarska večer') || m.includes('krešimir') || m.includes('ljetna zabava') || m.includes('koncerti')
    || m.includes('vikend') || m.includes('noć') || m.includes('biogradska noć') || m.includes('slovenski') || m.includes('slovenian') || m.includes('family') || m.includes('friends') || m.includes('priredba') || m.includes('smotra') || m.includes('sajam') || m.includes('karneval') || m.includes('praznik') || m.includes('blagdan') || m.includes('proslava') || m.includes('nastup') || m.includes('kada je') || m.includes('kad je') || m.includes('datum')
    || m.includes('event') || m.includes('what\'s on') || m.includes('upcoming') || m.includes('celebration') || m.includes('weekend') || m.includes('night') || m.includes('when is')
    || m.includes('veranstaltung') || m.includes('fest') || m.includes('bootsmesse') || m.includes('wann') || m.includes('wochenende')
    || m.includes('dogajanje') || m.includes('prireditev') || m.includes('manifestazione') || m.includes('quando') || m.includes('esemény') || m.includes('akce') || m.includes('podujatie'))
    return 'dogadanja';

  if (m.includes('parking') || m.includes('parkir') || m.includes('trajekt') || m.includes('autobus') || m.includes('ljekar') || m.includes('bolnic') || m.includes('hitna') || m.includes('bankomat') || m.includes('banka') || m.includes('taksi') || m.includes('prijevoz') || m.includes('rent a car') || m.includes('wifi') || m.includes('euro') || m.includes('valuta') || m.includes('info') || m.includes('radno vrij')
    || m.includes('benzin') || m.includes('gorivo') || m.includes('servis') || m.includes('mehaničar') || m.includes('vulkanizer') || m.includes('guma') || m.includes('kvar') || m.includes('supermarket') || m.includes('konzum') || m.includes('lidl') || m.includes('kaufland') || m.includes('plodine') || m.includes('tommy') || m.includes('studenac') || m.includes('tifon')
    || m.includes('pharmacy') || m.includes('hospital') || m.includes('atm') || m.includes('bank') || m.includes('taxi') || m.includes('bus') || m.includes('transport') || m.includes('practical') || m.includes('petrol') || m.includes('supermarket') || m.includes('mechanic')
    || m.includes('parkplatz') || m.includes('apotheke') || m.includes('tankstelle') || m.includes('werkstatt') || m.includes('reifenservice'))
    return 'prakticno';

  if (m.includes('muzej') || m.includes('crkva') || m.includes('atrakcij') || m.includes('kultura') || m.includes('baštini') || m.includes('baština') || m.includes('samostan') || m.includes('ruševin') || m.includes('arheolog') || m.includes('povijesn') || m.includes('stošija') || m.includes('katarina') || m.includes('bazilika') || m.includes('monument') || m.includes('spomen')
    || m.includes('museum') || m.includes('church') || m.includes('attraction') || m.includes('heritage') || m.includes('ruins') || m.includes('historic site')
    || m.includes('museum') || m.includes('kirche') || m.includes('sehenswürdigkeit') || m.includes('kloster'))
    return 'atrakcije';

  if (m.includes('povijest') || m.includes('histori') || m.includes('o biogradu') || m.includes('o gradu') || m.includes('osnovan') || m.includes('prijestolnica') || m.includes('krešimir') || m.includes('kresimir') || m.includes('zanimljiv') || m.includes('populacij') || m.includes('stanovnic') || m.includes('geografij')
    || m.includes('history') || m.includes('about') || m.includes('general') || m.includes('population') || m.includes('founded') || m.includes('capital') || m.includes('medieval')
    || m.includes('geschichte') || m.includes('über') || m.includes('einwohner') || m.includes('hauptstadt'))
    return 'opcenito';

  if (m.includes('temperatura') || m.includes('klima') || m.includes('klimat') || m.includes('vrijeme') || m.includes('vremenski') || m.includes('sunce') || m.includes('sunčan') || m.includes('kišn') || m.includes('kiša') || m.includes('vjetar') || m.includes('bura') || m.includes('jugo') || m.includes('sezona') || m.includes('srpanj') || m.includes('kolovoz') || m.includes('lipanj') || m.includes('rujan') || m.includes('travanj') || m.includes('svibanj') || m.includes('toplota') || m.includes('toplo') || m.includes('hladno')
    || m.includes('temperature') || m.includes('weather') || m.includes('climate') || m.includes('season') || m.includes('sunny') || m.includes('rain') || m.includes('wind') || m.includes('hot') || m.includes('cold') || m.includes('july') || m.includes('august') || m.includes('june') || m.includes('september')
    || m.includes('temperatur') || m.includes('wetter') || m.includes('klima') || m.includes('sommer') || m.includes('sonne'))
    return 'klima';

  return null;
}

// ===== SUGESTIJE PO KATEGORIJI =====
// Pool od 5 sugestija po kategoriji — filtrira se trenutna poruka, vraćaju se 3
function getSuggestions(category, lang, message) {
  const m = (message || '').toLowerCase();
  const map = {
    hr: {
      plaze:       ['⛵ Izlet na Kornate?', '🤿 Ronjenje u Biogradu?', '🏨 Smještaj blizu plaže?', '🐟 Gdje jesti nakon plaže?', '☀️ Kakvo je vrijeme u srpnju?'],
      gastronomija:['🐟 Kakva je lokalna riba?', '🍷 Preporuči konobu s pekom?', '🏖 Plaže Biograda?', '🌙 Noćni život u Biogradu?', '⛵ Izlet na Kornate?'],
      nautika:     ['⚓ Koliko košta charter?', '🚢 Charter tvrtke u Biogradu?', '🏝 Kornati izletom?', '🏖 Plaže za kupanje?', '⛵ Iznajmiti jedrilicu?'],
      smjestaj:    ['🏖 Koje plaže su blizu?', '🐟 Gdje jesti u Biogradu?', '⛵ Izlet na Kornate?', '⛺ Kampovi u Biogradu?', '🏨 Hoteli uz more?'],
      kornati:     ['⛵ Kako doći do Kornata?', '🐟 Konobe na otocima?', '🤿 Ronjenje na Kornatima?', '⚓ Charter za Kornate?', '🏖 Plaže na Kornatima?'],
      izleti:      ['🏛️ Zadar — što vidjeti?', '🌊 Vransko jezero izlet?', '⛵ Kornati brodom?', '🏔️ Paklenica izlet?', '🐟 Šibenik i Krka?'],
      sport:       ['🏖 Plaže za windsurfing?', '🚴 Biciklizam oko Vranskog jezera?', '⛵ Nautika u Biogradu?', '🤿 Ronjenje — gdje?', '🎣 Ribolov u Biogradu?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Ljetne manifestacije?', '🎶 Koncerti na rivi?', '🐟 Ribarska večer?', '📅 Što se događa ovaj tjedan?'],
      atrakcije:   ['🏛️ Zavičajni muzej Biograd?', '⛪ Crkve i ruševine?', '🏖 Plaže Biograda?', '🎡 Dalmaland zabavni park?', '⛵ Izlet na Kornate?'],
      opcenito:    ['🏖 Plaže Biograda?', '⛵ Izlet na Kornate?', '🐟 Dalmatinska gastronomija?', '🏨 Smještaj u Biogradu?', '☀️ Klima i sezona?'],
      prakticno:   ['🅿️ Parkiranje u centru?', '⛽ Benzinska postaja?', '🏥 Liječnik u Biogradu?', '🛒 Gdje je Lidl ili Kaufland?', '🔧 Auto servis ili vulkanizer?'],
      klima:       ['🏖 Koje plaže preporučuješ?', '⛵ Kada je idealno za jedrenje?', '🌊 Temperatura mora u kolovozu?', '☀️ Koliko sunčanih dana?', '🏨 Smještaj za ljetovanje?'],
    },
    en: {
      plaze:       ['⛵ Kornati day trip?', '🤿 Diving in Biograd?', '🏨 Accommodation near beach?', '🐟 Where to eat after beach?', '☀️ Weather in July?'],
      gastronomija:['🐟 Best local fish dishes?', '🍷 Recommend a konoba?', '🏖 Biograd beaches?', '🌙 Nightlife in Biograd?', '⛵ Kornati excursion?'],
      nautika:     ['⚓ How much is a charter?', '🚢 Charter companies in Biograd?', '🏝 Kornati excursion?', '🏖 Best beaches nearby?', '⛵ Rent a sailboat?'],
      smjestaj:    ['🏖 Beaches nearby?', '🐟 Where to eat?', '⛵ Kornati excursion?', '⛺ Campsites in Biograd?', '🏨 Hotels by the sea?'],
      kornati:     ['⛵ How to reach Kornati?', '🐟 Taverns on islands?', '🤿 Snorkeling spots?', '⚓ Charter to Kornati?', '🏖 Beaches on Kornati?'],
      izleti:      ['🏛️ What to see in Zadar?', '🌊 Lake Vrana trip?', '⛵ Kornati by boat?', '🏔️ Paklenica trip?', '🐟 Šibenik and Krka?'],
      sport:       ['🏖 Windsurfing beaches?', '🚴 Cycling around Lake Vrana?', '⛵ Boat rental?', '🤿 Diving — where?', '🎣 Fishing in Biograd?'],
      atrakcije:   ['🏛️ Town museum?', '⛪ Medieval ruins?', '🏖 Biograd beaches?', '🎡 Dalmaland park?', '⛵ Kornati excursion?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Summer events?', '🎶 Concerts on the waterfront?', '🐟 Fishermen\'s evening?', '📅 What\'s on this week?'],
      opcenito:    ['🏖 Biograd beaches?', '⛵ Kornati trip?', '🐟 Dalmatian food?', '🏨 Accommodation?', '☀️ Climate and season?'],
      prakticno:   ['🅿️ Parking in the centre?', '⛽ Petrol station?', '🏥 Doctor in Biograd?', '🛒 Where is Lidl or Kaufland?', '🔧 Car service or tyre shop?'],
      klima:       ['🏖 Best beaches to visit?', '⛵ When is sailing season?', '🌊 Sea temperature in August?', '☀️ How many sunny days?', '🏨 Accommodation for summer?'],
    },
    de: {
      plaze:       ['⛵ Ausflug zu den Kornaten?', '🤿 Tauchen in Biograd?', '🏨 Unterkunft am Strand?', '🐟 Wo essen nach dem Strand?', '☀️ Wetter im Juli?'],
      gastronomija:['🐟 Lokale Fischspezialitäten?', '🍷 Konoba empfehlen?', '🏖 Strände von Biograd?', '🌙 Nachtleben in Biograd?', '⛵ Kornaten-Ausflug?'],
      nautika:     ['⚓ Charterpreise?', '🚢 Charterunternehmen Biograd?', '🏝 Kornaten-Ausflug?', '🏖 Beste Strände?', '⛵ Segelboot mieten?'],
      smjestaj:    ['🏖 Strände in der Nähe?', '🐟 Wo essen?', '⛵ Kornaten-Ausflug?', '⛺ Campingplätze?', '🏨 Hotels am Meer?'],
      kornati:     ['⛵ Wie erreicht man die Kornaten?', '🐟 Tavernen auf den Inseln?', '🤿 Schnorcheln?', '⚓ Charter zu den Kornaten?', '🏖 Strände auf Kornaten?'],
      izleti:      ['🏛️ Was in Zadar sehen?', '🌊 Vranasee-Ausflug?', '⛵ Kornaten mit Boot?', '🏔️ Paklenica Ausflug?', '🐟 Šibenik und Krka?'],
      sport:       ['🏖 Windsurfing-Strände?', '🚴 Radtour am Vranasee?', '⛵ Bootsverleih?', '🤿 Tauchen — wo?', '🎣 Angeln in Biograd?'],
      atrakcije:   ['🏛️ Stadtmuseum Biograd?', '⛪ Mittelalterliche Ruinen?', '🏖 Strände von Biograd?', '🎡 Dalmaland Park?', '⛵ Kornaten-Ausflug?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Sommerveranstaltungen?', '🎶 Konzerte am Kai?', '🐟 Fischerabend?', '📅 Was ist diese Woche los?'],
      opcenito:    ['🏖 Strände von Biograd?', '⛵ Kornaten-Ausflug?', '🐟 Dalmatinische Küche?', '🏨 Unterkunft?', '☀️ Klima und Saison?'],
      prakticno:   ['🅿️ Parken im Zentrum?', '⛽ Tankstelle?', '🏥 Arzt in Biograd?', '🛒 Wo ist Lidl oder Kaufland?', '🔧 Kfz-Werkstatt oder Reifenservice?'],
      klima:       ['🏖 Beste Strände?', '⛵ Wann ist Segelsaison?', '🌊 Meerestemperatur im August?', '☀️ Wie viele Sonnentage?', '🏨 Unterkunft für den Sommer?'],
    },
    sl: {
      plaze:       ['⛵ Izlet na Kornate?', '🤿 Potapljanje v Biogradu?', '🏨 Nastanitev blizu plaže?', '🐟 Kje jesti po plaži?', '☀️ Kakšno je vreme v juliju?'],
      gastronomija:['🐟 Kakšne lokalne ribe?', '🍷 Priporoči konobo s peko?', '🏖 Plaže Biograda?', '🌙 Nočno življenje?', '⛵ Izlet na Kornate?'],
      nautika:     ['⚓ Koliko stane čarter?', '🚢 Čarter podjetja v Biogradu?', '🏝 Kornati z izletom?', '🏖 Kopalne plaže?', '⛵ Najem jadrnice?'],
      smjestaj:    ['🏖 Katere plaže so blizu?', '🐟 Kje jesti v Biogradu?', '⛵ Izlet na Kornate?', '⛺ Kampi v Biogradu?', '🏨 Hoteli ob morju?'],
      kornati:     ['⛵ Kako priti na Kornate?', '🐟 Konobe na otokih?', '🤿 Potapljanje na Kornatih?', '⚓ Čarter za Kornate?', '🏖 Plaže na Kornatih?'],
      izleti:      ['🏛️ Zadar — kaj videti?', '🌊 Vransko jezero izlet?', '⛵ Kornati z ladjo?', '🏔️ Paklenica izlet?', '🐟 Šibenik in Krka?'],
      sport:       ['🏖 Plaže za windsurfing?', '🚴 Kolesarstvo ob Vranskem jezeru?', '⛵ Najem čolna?', '🤿 Potapljanje — kje?', '🎣 Ribolov v Biogradu?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Poletni dogodki?', '🎶 Koncerti na rivi?', '🐟 Ribarska večer?', '📅 Kaj se dogaja ta teden?'],
      atrakcije:   ['🏛️ Mestni muzej Biograd?', '⛪ Cerkve in ruševine?', '🏖 Plaže Biograda?', '🎡 Dalmaland zabaviščni park?', '⛵ Izlet na Kornate?'],
      opcenito:    ['🏖 Plaže Biograda?', '⛵ Izlet na Kornate?', '🐟 Dalmatinska kuhinja?', '🏨 Nastanitev v Biogradu?', '☀️ Podnebje in sezona?'],
      prakticno:   ['🅿️ Parkiranje v centru?', '⛽ Bencinska črpalka?', '🏥 Zdravnik v Biogradu?', '🛒 Kje je Lidl ali Kaufland?', '🔧 Avtomehanik?'],
      klima:       ['🏖 Katere plaže priporočaš?', '⛵ Kdaj je idealno za jadranje?', '🌊 Temperatura morja avgusta?', '☀️ Koliko sončnih dni?', '🏨 Nastanitev za poletje?'],
    },
    it: {
      plaze:       ['⛵ Gita alle Kornati?', '🤿 Immersioni a Biograd?', '🏨 Alloggio vicino alla spiaggia?', '🐟 Dove mangiare dopo la spiaggia?', '☀️ Meteo in luglio?'],
      gastronomija:['🐟 Pesce locale consigliato?', '🍷 Consiglia una konoba?', '🏖 Spiagge di Biograd?', '🌙 Vita notturna?', '⛵ Escursione Kornati?'],
      nautika:     ['⚓ Prezzi charter?', '🚢 Aziende charter a Biograd?', '🏝 Escursione Kornati?', '🏖 Migliori spiagge?', '⛵ Noleggio barca a vela?'],
      smjestaj:    ['🏖 Spiagge vicine?', '🐟 Dove mangiare?', '⛵ Escursione Kornati?', '⛺ Campeggi a Biograd?', '🏨 Hotel sul mare?'],
      kornati:     ['⛵ Come raggiungere Kornati?', '🐟 Ristoranti sulle isole?', '🤿 Snorkeling?', '⚓ Charter per Kornati?', '🏖 Spiagge di Kornati?'],
      izleti:      ['🏛️ Zadar — cosa vedere?', '🌊 Lago Vrana?', '⛵ Kornati in barca?', '🏔️ Paklenica escursione?', '🐟 Šibenik e Krka?'],
      sport:       ['🏖 Spiagge per windsurf?', '🚴 Ciclismo al lago Vrana?', '⛵ Noleggio barca?', '🤿 Immersioni — dove?', '🎣 Pesca a Biograd?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Eventi estivi?', '🎶 Concerti sul lungomare?', '🐟 Serata dei pescatori?', '📅 Cosa succede questa settimana?'],
      atrakcije:   ['🏛️ Museo di Biograd?', '⛪ Chiese e rovine?', '🏖 Spiagge di Biograd?', '🎡 Parco Dalmaland?', '⛵ Escursione Kornati?'],
      opcenito:    ['🏖 Spiagge di Biograd?', '⛵ Gita a Kornati?', '🐟 Cucina dalmata?', '🏨 Alloggio a Biograd?', '☀️ Clima e stagione?'],
      prakticno:   ['🅿️ Parcheggio in centro?', '⛽ Stazione di servizio?', '🏥 Medico a Biograd?', '🛒 Dove è il Lidl o Kaufland?', '🔧 Officina auto?'],
      klima:       ['🏖 Quali spiagge consigliare?', '⛵ Quando è ideale per veleggiare?', '🌊 Temperatura del mare in agosto?', '☀️ Quante giornate di sole?', '🏨 Alloggio per l\'estate?'],
    },
    hu: {
      plaze:       ['⛵ Kirándulás Kornatira?', '🤿 Búvárkodás Biogradban?', '🏨 Szállás a strandnál?', '🐟 Hol együnk strand után?', '☀️ Időjárás júliusban?'],
      gastronomija:['🐟 Helyi halételek?', '🍷 Ajánlj egy konobu?', '🏖 Biograd strandjai?', '🌙 Éjszakai élet?', '⛵ Kornati kirándulás?'],
      nautika:     ['⚓ Mennyibe kerül a csárter?', '🚢 Csárter cégek Biogradban?', '🏝 Kornati kirándulás?', '🏖 Legjobb strandok?', '⛵ Vitorlás bérlet?'],
      smjestaj:    ['🏖 Közeli strandok?', '🐟 Hol együnk Biogradban?', '⛵ Kornati kirándulás?', '⛺ Kemping Biogradban?', '🏨 Tenger melletti szállodák?'],
      kornati:     ['⛵ Hogyan jutunk el Kornatira?', '🐟 Éttermek a szigeteken?', '🤿 Snorkeling helyek?', '⚓ Csárter Kornatira?', '🏖 Strandok Kornatin?'],
      izleti:      ['🏛️ Zadar — mit nézzünk?', '🌊 Vrana-tó kirándulás?', '⛵ Kornati hajóval?', '🏔️ Paklenica kirándulás?', '🐟 Šibenik és Krka?'],
      sport:       ['🏖 Windsurfing strandok?', '🚴 Kerékpározás a Vrana-tónál?', '⛵ Csónakbérlés?', '🤿 Búvárkodás — hol?', '🎣 Horgászat Biogradban?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Nyári rendezvények?', '🎶 Koncertek a rakparton?', '🐟 Halászest?', '📅 Mi lesz ezen a héten?'],
      atrakcije:   ['🏛️ Biograd múzeum?', '⛪ Templomok és romok?', '🏖 Biograd strandjai?', '🎡 Dalmaland vidámpark?', '⛵ Kornati kirándulás?'],
      opcenito:    ['🏖 Biograd strandjai?', '⛵ Kornati kirándulás?', '🐟 Dalmát gasztronómia?', '🏨 Szállás Biogradban?', '☀️ Éghajlat és szezon?'],
      prakticno:   ['🅿️ Parkolás a belvárosban?', '⛽ Benzinkút?', '🏥 Orvos Biogradban?', '🛒 Hol van a Lidl vagy Kaufland?', '🔧 Autószerelő?'],
      klima:       ['🏖 Melyik strandot ajánlod?', '⛵ Mikor ideális a vitorlázás?', '🌊 Tenger hőmérséklete augusztusban?', '☀️ Hány napos nap?', '🏨 Szállás nyárra?'],
    },
    cs: {
      plaze:       ['⛵ Výlet na Kornati?', '🤿 Potápění v Biogradu?', '🏨 Ubytování u pláže?', '🐟 Kde jíst po pláži?', '☀️ Počasí v červenci?'],
      gastronomija:['🐟 Místní rybí pokrmy?', '🍷 Doporuč konobu?', '🏖 Pláže Biogradu?', '🌙 Noční život?', '⛵ Výlet na Kornati?'],
      nautika:     ['⚓ Cena charteru?', '🚢 Charterové firmy v Biogradu?', '🏝 Výlet na Kornati?', '🏖 Nejlepší pláže?', '⛵ Pronájem plachetnice?'],
      smjestaj:    ['🏖 Pláže v okolí?', '🐟 Kde jíst v Biogradu?', '⛵ Výlet na Kornati?', '⛺ Kempy v Biogradu?', '🏨 Hotely u moře?'],
      kornati:     ['⛵ Jak se dostat na Kornati?', '🐟 Restaurace na ostrovech?', '🤿 Šnorchlování?', '⚓ Charter na Kornati?', '🏖 Pláže na Kornati?'],
      izleti:      ['🏛️ Zadar — co vidět?', '🌊 Vranjské jezero?', '⛵ Kornati lodí?', '🏔️ Paklenica výlet?', '🐟 Šibenik a Krka?'],
      sport:       ['🏖 Pláže pro windsurfing?', '🚴 Cyklistika kolem jezera?', '⛵ Pronájem lodi?', '🤿 Potápění — kde?', '🎣 Rybaření v Biogradu?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Letní akce?', '🎶 Koncerty na nábřeží?', '🐟 Rybářský večer?', '📅 Co se děje tento týden?'],
      atrakcije:   ['🏛️ Muzeum Biogradu?', '⛪ Kostely a ruiny?', '🏖 Pláže Biogradu?', '🎡 Zábavní park Dalmaland?', '⛵ Výlet na Kornati?'],
      opcenito:    ['🏖 Pláže Biogradu?', '⛵ Výlet na Kornati?', '🐟 Dalmatská kuchyně?', '🏨 Ubytování v Biogradu?', '☀️ Klima a sezóna?'],
      prakticno:   ['🅿️ Parkování v centru?', '⛽ Čerpací stanice?', '🏥 Lékař v Biogradu?', '🛒 Kde je Lidl nebo Kaufland?', '🔧 Autoservis?'],
      klima:       ['🏖 Jaké pláže doporučuješ?', '⛵ Kdy je ideální pro plachtění?', '🌊 Teplota moře v srpnu?', '☀️ Kolik slunečných dní?', '🏨 Ubytování na léto?'],
    },
    sk: {
      plaze:       ['⛵ Výlet na Kornati?', '🤿 Potápanie v Biogradu?', '🏨 Ubytovanie pri pláži?', '🐟 Kde jesť po pláži?', '☀️ Počasie v júli?'],
      gastronomija:['🐟 Miestne rybie jedlá?', '🍷 Odporúč konobu?', '🏖 Pláže Biogradu?', '🌙 Nočný život?', '⛵ Výlet na Kornati?'],
      nautika:     ['⚓ Cena chartru?', '🚢 Chartrové firmy v Biogradu?', '🏝 Výlet na Kornati?', '🏖 Najlepšie pláže?', '⛵ Prenájom plachetnice?'],
      smjestaj:    ['🏖 Pláže v okolí?', '🐟 Kde jesť v Biogradu?', '⛵ Výlet na Kornati?', '⛺ Kempy v Biogradu?', '🏨 Hotely pri mori?'],
      kornati:     ['⛵ Ako sa dostať na Kornati?', '🐟 Reštaurácie na ostrovoch?', '🤿 Šnorchlování?', '⚓ Charter na Kornati?', '🏖 Pláže na Kornati?'],
      izleti:      ['🏛️ Zadar — čo vidieť?', '🌊 Vranské jazero?', '⛵ Kornati loďou?', '🏔️ Paklenica výlet?', '🐟 Šibenik a Krka?'],
      sport:       ['🏖 Pláže na windsurfing?', '🚴 Cyklistika okolo jazera?', '⛵ Prenájom lode?', '🤿 Potápanie — kde?', '🎣 Rybárčenie v Biogradu?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Letné podujatia?', '🎶 Koncerty na nábreží?', '🐟 Rybársky večer?', '📅 Čo sa deje tento týždeň?'],
      atrakcije:   ['🏛️ Múzeum Biogradu?', '⛪ Kostoly a ruiny?', '🏖 Pláže Biogradu?', '🎡 Zábavný park Dalmaland?', '⛵ Výlet na Kornati?'],
      opcenito:    ['🏖 Pláže Biogradu?', '⛵ Výlet na Kornati?', '🐟 Dalmatská kuchyňa?', '🏨 Ubytovanie v Biogradu?', '☀️ Klíma a sezóna?'],
      prakticno:   ['🅿️ Parkovanie v centre?', '⛽ Čerpacia stanica?', '🏥 Lekár v Biogradu?', '🛒 Kde je Lidl alebo Kaufland?', '🔧 Autoservis?'],
      klima:       ['🏖 Aké pláže odporúčaš?', '⛵ Kedy je ideálne na plachtenie?', '🌊 Teplota mora v auguste?', '☀️ Koľko slnečných dní?', '🏨 Ubytovanie na leto?'],
    },
  };

  const pool = (map[lang] || map.hr)[category] || [];

  // Filtriraj sugestiju koja se podudara s trenutnom porukom (sprječava ponavljanje)
  const filtered = pool.filter(s => {
    const sWords = s.toLowerCase().replace(/[⚓🏝🏖⛵🐟🍷🤿🌙🏛️⛪🎡🚌⛽🏥🏧🅿️🚢🏔️🌊☀️📅🎶🎣⛺🏨🏰🚴🎣]/g, '').trim();
    const keywords = sWords.split(/[\s?!,.]+/).filter(w => w.length > 3);
    return !keywords.some(kw => m.includes(kw));
  });

  return filtered.slice(0, 3);
}

// ===== IMAGE PROXY — zaobilazi hotlink protection =====
// Wikimedia uvijek radi izravno; sve ostalo ide kroz wsrv.nl proxy
function proxyImg(url) {
  if (!url) return '';
  // Direktni CDN-ovi koji ne trebaju proxy
  if (url.includes('upload.wikimedia.org') || url.includes('commons.wikimedia.org')) return url;
  if (url.includes('lh3.googleusercontent.com')) return url;
  if (url.includes('ilirijabiograd.com')) return url;
  if (url.includes('camping-biograd.com')) return url;
  if (url.includes('bestinbiograd.com')) return url;
  if (url.includes('avtokampi.si')) return url;
  return 'https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=200&h=150&fit=cover&output=jpg&errorredirect=https%3A%2F%2Fupload.wikimedia.org%2Fwikipedia%2Fcommons%2F5%2F51%2FKornati.jpg';
}

// ===== ITEM KARTICE — uzima sve dostupne podatke iz baze =====
function item(o, extra = {}) {
  return {
    naziv:           o.naziv || '',
    opis:            o.opis || '',
    slika:           proxyImg(o.slika || ''),
    adresa:          o.adresa || o.lokacija || o.tip || o.udaljenost || '',
    telefon:         o.telefon || '',
    web:             o.web || '',
    karta:           o.karta || '',
    recenzija:       o.recenzija || '',
    ocjena:          o.ocjena || '',
    recenzija_izvor: o.recenzija_izvor || '',
    recenzija_url:   o.recenzija_url || '',
    ...extra
  };
}

// Generičke kategorijske riječi koje se ne smiju koristiti za filtriranje
const GENERICKE_RIJECI = new Set([
  'plaža','plaže','plaza','beach','strand',
  'hotel','hoteli','hotels','unterkunft',
  'restoran','restorani','restaurant','konoba','konobe','essen',
  'kamp','kampovi','camping','smještaj','smjestaj','accommodation',
  'izlet','izleti','excursion','kornati','kornate','ausflug',
  'sport','aktivnosti','activities','atrakcij','atrakcija',
  'biograd','biograda','biogradu','moru','mora',
  'gdje','jesti','preporuči','preporuka','lokalna','lokalni'
]);

// Filtrira listu po ključnim riječima iz poruke — ako nema podudaranja, vraća sve
function filterByMessage(lista, msg) {
  if (!msg) return lista;
  const m = msg.toLowerCase();
  const matched = lista.filter(it => {
    // Uzmi značajne riječi iz naziva — isključi generičke kategorijske pojmove
    const words = it.naziv.toLowerCase()
      .replace(/[★✓\-\/,\.\(\)]+/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !GENERICKE_RIJECI.has(w));
    return words.some(w => m.includes(w));
  });
  return matched.length > 0 ? matched : lista;
}

function getCategoryItems(category, message = '') {
  if (category === 'plaze') {
    const svi = (db.plaze || []).map(p => item(p, { adresa: p.tip || '' }));
    return filterByMessage(svi, message);
  }
  if (category === 'gastronomija') {
    const m = (message || '').toLowerCase();
    const isNocni = m.includes('noćni') || m.includes('nocni') || m.includes('klub') ||
      m.includes('disco') || m.includes('party') || m.includes('cocktail') || m.includes('kokteli') ||
      m.includes('nightlife') || m.includes('izlazak') || m.includes('zabav') || m.includes('ples');
    if (isNocni) {
      return (db.gastronomija?.nocni_zivot || []).map(r => item(r, { adresa: r.tip || '' }));
    }
    // Sortiranje: 1) restorani prije konoba, 2) unutar grupe: centar/riva prije ostalih
    const tipGrupa = r => {
      const naziv = (r.naziv || '').toLowerCase();
      const tip   = (r.tip   || '').toLowerCase();
      if (naziv.includes('konoba') || tip.includes('konoba')) return 1;
      if (naziv.includes('restoran') || naziv.includes('restaurant') ||
          tip.includes('restoran')   || tip.includes('restaurant')) return 0;
      return 2; // pizzerie, grill, ostalo
    };
    const lokacijaPriority = r => {
      const adr = (r.adresa || '').toLowerCase();
      if (!adr) return 1; // bez adrese – sredina
      if (adr.includes('put solina') || adr.includes('crvena luka') ||
          adr.includes('šetalište') || adr.includes('setaliste')) return 2; // periferno
      return 0; // centar / riva (Obala, Trg, Ul. …)
    };
    const sortirani = (db.gastronomija?.restorani || [])
      .slice()
      .sort((a, b) => {
        const gA = tipGrupa(a), gB = tipGrupa(b);
        if (gA !== gB) return gA - gB;
        return lokacijaPriority(a) - lokacijaPriority(b);
      });
    const svi = sortirani.map(r => item(r, { adresa: r.tip || '' }));
    return filterByMessage(svi, message);
  }
  if (category === 'nautika') {
    const m = (message || '').toLowerCase();
    const isCharter = m.includes('charter') || m.includes('čarter') || m.includes('agencij') ||
      m.includes('iznajm') || m.includes('rent') || m.includes('jedrilica') || m.includes('katamaran') ||
      m.includes('skipper') || m.includes('skipersk') || m.includes('hire') || m.includes('mieten');
    if (isCharter) {
      const agencije = (db.nautika?.charter_agencije || []).map(a => item(a, { adresa: a.tip || '' }));
      return agencije.length ? agencije : [item(db.nautika?.marina, { adresa: db.nautika?.marina?.adresa || '' })];
    }
    const marina = db.nautika?.marina;
    return marina ? [item(marina, { adresa: marina.adresa || '' })] : [];
  }
  if (category === 'smjestaj') {
    const m = (message || '').toLowerCase();

    // Definiraj sve tipove unaprijed
    const isHotel    = m.includes('hotel') || m.includes('hotels');
    const isApartman = m.includes('apartman') || m.includes('privat') || m.includes('soba') ||
      m.includes('rent') || m.includes('apartment') || m.includes('private') || m.includes('room') ||
      m.includes('wohnung') || m.includes('ferienwohnung');
    const isKamp     = m.includes('kamp') || m.includes('camping') || m.includes('šator') ||
      m.includes('karavan') || m.includes('mobile home') || m.includes('zelt');
    const isVila     = m.includes('vila') || m.includes('bungalov') || m.includes('villa') ||
      m.includes('crvena luka') || m.includes('san antonio');
    const isPansion  = m.includes('pansion') || m.includes('guest house') || m.includes('guesthouse') ||
      m.includes('pension') || m.includes('b&b');

    const hoteli   = (db.smjestaj?.hoteli || []).map(h => item(h, { adresa: h.lokacija || '' }));
    const kontakti = (db.smjestaj?.direktni_kontakti || []).map(p => item(p, { adresa: p.tip || '' }));
    const kampovi  = (db.smjestaj?.kampovi || []).map(k => item(k, { adresa: k.lokacija || '' }));
    const pansioni = (db.smjestaj?.pansioni || []).map(p => item(p, { adresa: p.lokacija || '' }));
    const vile     = (db.smjestaj?.vile_i_posebni || []).map(v => item(v, { adresa: v.lokacija || '' }));

    // Miješani upit (2+ tipa) ili generalni smještaj → svi hoteli + direktni kontakti
    const typeCount = [isHotel, isApartman, isKamp, isVila, isPansion].filter(Boolean).length;
    if (typeCount >= 2 || (!isHotel && !isApartman && !isKamp && !isVila && !isPansion)) {
      return [...hoteli, ...kontakti];
    }

    // Specifični upiti
    if (isHotel)    return filterByMessage(hoteli, message);
    if (isKamp)     return filterByMessage(kampovi, message);
    if (isVila)     return vile;
    if (isPansion)  return pansioni;
    if (isApartman) return filterByMessage([...kontakti, ...pansioni], message);

    return [...hoteli, ...kontakti];
  }
  if (category === 'kornati') {
    const m = (message || '').toLowerCase();
    const k = db.kornati;
    // Ako pita za hranu/konobe na Kornatima → prikaži konobe kartice
    const isKonoba = m.includes('konob') || m.includes('rest') || m.includes('jelo') || m.includes('hranu') ||
      m.includes('ručak') || m.includes('ruča') || m.includes('jesti') || m.includes('riba') ||
      m.includes('jastog') || m.includes('plodovi') || m.includes('levrnaka') || m.includes('žakan') ||
      m.includes('fešta') || m.includes('opat') || m.includes('piccolo') ||
      m.includes('eat') || m.includes('food') || m.includes('lunch') || m.includes('dinner') ||
      m.includes('restaurant') || m.includes('tavern') || m.includes('essen') || m.includes('speise');
    if (isKonoba) {
      const konobe = k?.izleti?.konobe_na_otocima || [];
      return konobe.map(kon => item(kon, { adresa: kon.adresa || kon.tip || '' }));
    }
    return k ? [item(k, { adresa: k.polaziste || '' })] : [];
  }
  if (category === 'izleti') {
    const svi = (db.izleti?.destinacije || []).map(d => item(d, {
      adresa: d.udaljenost ? `🚗 ${d.udaljenost}` : ''
    }));
    return filterByMessage(svi, message);
  }
  if (category === 'sport') {
    const svi = (db.sport?.aktivnosti || []).map(a => item(a, { adresa: a.tip || '' }));
    return filterByMessage(svi, message);
  }
  if (category === 'atrakcije') {
    const svi = (db.atrakcije?.objekti || []).map(a => item(a, { adresa: a.tip || '' }));
    return filterByMessage(svi, message);
  }
  if (category === 'dogadanja') {
    return (db.dogadanja?.eventi || []).map(e => item(e, { adresa: e.termin || '' }));
  }
  if (category === 'prakticno') {
    const m = (message || '').toLowerCase();
    const pi = db.prakticne_info || {};

    const toItems = (arr) => (arr || []).map(x => item(x, { adresa: x.adresa || x.tip || '' }));

    if (m.includes('parking') || m.includes('parkiralis') || m.includes('parkira') || m.includes('park'))
      return toItems(pi.parking);

    if (m.includes('autobus') || m.includes('bus') || m.includes('taksi') || m.includes('taxi') ||
        m.includes('prijevoz') || m.includes('rent') || m.includes('automobil') || m.includes('dolaz') ||
        m.includes('javni') || m.includes('bus') || m.includes('flixbus'))
      return toItems(pi.prijevoz);

    if (m.includes('ljekarn') || m.includes('lijek') || m.includes('apoteka') || m.includes('farmac') ||
        m.includes('pharmacy') || m.includes('apotheke'))
      return toItems(pi.ljekarne);

    if (m.includes('hitna') || m.includes('zdravstvo') || m.includes('doktor') || m.includes('liječnik') ||
        m.includes('bolnica') || m.includes('ambulanta') || m.includes('hitne') || m.includes('hospital') ||
        m.includes('doctor') || m.includes('arzt'))
      return toItems(pi.zdravstvo);

    if (m.includes('bankomat') || m.includes('banka') || m.includes('atm') || m.includes('novac') ||
        m.includes('gotovina') || m.includes('isplat') || m.includes('bank') || m.includes('geldautomat'))
      return toItems(pi.banke_atm);

    if (m.includes('benzin') || m.includes('gorivo') || m.includes('nafta') || m.includes('tifon') ||
        m.includes('autoplin') || m.includes('tankiranje') || m.includes('tankstelle') ||
        (m.includes('ina') && !m.includes('marina')))
      return toItems(pi.benzinska);

    if (m.includes('servis') || m.includes('mehaničar') || m.includes('kvar') || m.includes('vulkanizer') ||
        m.includes('guma') || m.includes('popravak') || m.includes('auto servis') || m.includes('radionica') ||
        m.includes('mechanic') || m.includes('werkstatt') || m.includes('reifenservice'))
      return toItems(pi.servisi);

    if (m.includes('market') || m.includes('supermarket') || m.includes('trgovina') || m.includes('kupovina') ||
        m.includes('konzum') || m.includes('studenac') || m.includes('namirnic') || m.includes('shopping'))
      return toItems(pi.supermarketi);

    if (m.includes('trajekt') || m.includes('ferry') || m.includes('pašman') || m.includes('pasman') ||
        m.includes('tkon') || m.includes('jadrolinija'))
      return pi.trajekt_pasmanskim_kanalom
        ? [item(pi.trajekt_pasmanskim_kanalom, { adresa: pi.trajekt_pasmanskim_kanalom.ruta || '' })]
        : [];

    // Generalni upit → parking + prijevoz + ljekarna (prva)
    return [
      ...toItems(pi.parking),
      ...toItems(pi.prijevoz),
      toItems(pi.ljekarne)[0]
    ].filter(Boolean);
  }

  if (category === 'klima') {
    return [
      {
        naziv: '☀️ Klima Biograda na Moru',
        slika: 'https://wsrv.nl/?url=www.discover-biograd.com/images/tz-biograd-video.webp&w=400&h=220&fit=cover&output=jpg',
        adresa: '🌡 Mediteranska klima · 300 sunčanih dana godišnje',
        recenzija: 'Lipanj–rujan: 26–32°C · More: 24–28°C · Srpanj i kolovoz najtopliji.',
        recenzija_izvor: 'Meteorološki podaci',
        web: 'https://www.discover-biograd.com',
        karta: 'https://maps.google.com/?q=Biograd+na+Moru',
        telefon: '', ocjena: ''
      },
      {
        naziv: '🏖 Plaže — idealno kupanje',
        slika: 'https://wsrv.nl/?url=upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Biograd_na_moru_aerial.jpg/1280px-Biograd_na_moru_aerial.jpg&w=400&h=220&fit=cover&output=jpg',
        adresa: '🌊 Temperatura mora: 24–28°C (srpanj–kolovoz)',
        recenzija: 'Dražica, Soline, Bošana — plaže idealne za kupanje i sunčanje.',
        recenzija_izvor: 'TZ Biograd',
        web: 'https://www.discover-biograd.com/prirodne-ljepote/plaze',
        karta: 'https://maps.google.com/?q=plaže+Biograd+na+Moru',
        telefon: '', ocjena: ''
      },
      {
        naziv: '⛵ Nautička sezona',
        slika: proxyImg('https://www.discover-biograd.com/storage/media/prirodne-ljepote/NP-kornati/11-06-21%20NP%20KORNATI%202%20_86Y9965.jpg'),
        adresa: '🗓 Sezona: travanj – listopad',
        recenzija: 'Idealni uvjeti za jedrenje i izlete na Kornate. Marina Biograd — 1200 vezova.',
        recenzija_izvor: 'Marina Biograd',
        web: 'https://www.discover-biograd.com/nautika',
        karta: 'https://maps.google.com/?q=Marina+Biograd+na+Moru',
        telefon: '', ocjena: ''
      }
    ];
  }
  return [];
}

// ===== VREMENSKA INTELIGENCIJA =====
function buildWeatherDirectives(w) {
  if (!w || w.temperature == null) return '';

  const lines = [];
  const temp  = w.temperature;
  const wind  = w.windspeed || 0;
  const code  = w.weathercode ?? -1;
  const sea   = w.sea_temp;
  const wave  = w.wave_height;
  const hour  = w.hour ?? new Date().getHours();

  // --- Weathercode: stanje neba ---
  const isStorm    = code >= 95;
  const isHeavyRain= (code >= 80 && code <= 82) || (code >= 65 && code <= 67);
  const isRain     = (code >= 51 && code <= 65) || (code >= 80 && code <= 82);
  const isCloudy   = code === 3;
  const isClear    = code <= 1;
  const isPartly   = code === 2;

  // --- Temperatura zraka ---
  let swimAdvice = '';
  if (temp < 12) {
    swimAdvice = 'Temperatura zraka ispod 12°C — kupanje nije preporučljivo, fokusiraj se na kulturni/gastronomski program.';
  } else if (temp < 18) {
    swimAdvice = `Temperatura zraka ${temp}°C — kupanje za ljubitelje hladnijeg mora${sea != null ? `, more ${sea}°C` : ''}.`;
  } else if (temp >= 30) {
    swimAdvice = `Temperatura ${temp}°C — vrućina! Preporuči kupanje ujutro (do 10h) ili poslijepodne (od 17h), izbjegavaj podnevno sunce.`;
  } else {
    swimAdvice = `Temperatura zraka ${temp}°C${sea != null ? `, more ${sea}°C` : ''} — ugodni uvjeti za plažu i kupanje.`;
  }

  // --- Vjetar / nautika ---
  let windAdvice = '';
  if (wind > 45) {
    windAdvice = `UPOZORENJE: Jak vjetar ${wind} km/h — izleti brodom i charter nisu preporučljivi, marina može imati ograničenja plovidbe.`;
  } else if (wind > 35) {
    windAdvice = `Vjetar ${wind} km/h — oprez na moru, nautičari neka provjere uvjete u Marini Kornati prije isplovljenja.`;
  } else if (wind > 20) {
    windAdvice = `Lagani do umjereni vjetar ${wind} km/h — ugodni uvjeti za jedrenje.`;
  }

  // --- Visina vala ---
  if (wave != null && wave >= 1.5) {
    windAdvice += ` Visina vala ${wave} m — manji brodovi neka ostanu u uvali.`;
  }

  // --- Kiša / oluja ---
  let skyAdvice = '';
  if (isStorm) {
    skyAdvice = 'OLUJA — preporuči zatvorene aktivnosti: muzeji, restorani, shopping, degustacija vina u konobama. Odgodi izlete i nautiku.';
  } else if (isHeavyRain) {
    skyAdvice = 'Jaka kiša — idealan dan za gastronomiju (svježa riba, peka, brudet) i zatvorene atrakcije. Plaža i izleti odgođeni.';
  } else if (isRain) {
    skyAdvice = 'Kiša — preporuči konobe, šetnju starim gradom uz kišobran, degustaciju lokalnih vina.';
  } else if (isCloudy) {
    skyAdvice = 'Oblačno — dobri uvjeti za biciklizam, pješačenje, posjete Vranskom jezeru ili izlet do Zadra.';
  } else if (isClear || isPartly) {
    skyAdvice = 'Sunčano i vedro — savršeni uvjeti za plažu, Kornate i nautiku.';
  }

  // --- Večernji / jutarnji mod ---
  let timeAdvice = '';
  if (hour >= 19) {
    timeAdvice = 'Večer je — preporuči šetnju rivom, večeru u restoranu s pogledom na more, degustaciju lokalnih vina ili ljetne manifestacije.';
  } else if (hour < 9) {
    timeAdvice = 'Jutro je — savršeno za ranu šetnju rivom, doručak u kafiću uz more, ili rani polazak na izlet brodom.';
  }

  // --- Prognoza sažetak (ako postoji) ---
  let forecastNote = '';
  if (w.forecast && w.forecast.length > 1) {
    const tomorrow = w.forecast[1];
    if (tomorrow) {
      forecastNote = `Sutra (${tomorrow.dan}): ${tomorrow.icon} ${tomorrow.tmax}°C/${tomorrow.tmin}°C, ${tomorrow.opis}${tomorrow.kisa != null ? `, kiša ${tomorrow.kisa}%` : ''}.`;
    }
  }

  const parts = [swimAdvice, windAdvice, skyAdvice, timeAdvice, forecastNote].filter(Boolean);
  return parts.length > 0
    ? '\nVREMENSKE DIREKTIVE (primijeni u odgovoru!):\n' + parts.map(p => '- ' + p).join('\n')
    : '';
}

function getSeasonContext() {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 7 && month <= 8) return 'VRHUNAC SEZONE (srpanj/kolovoz) — gužve, obavezna rezervacija 3-4 mj. unaprijed, visoke cijene, sve radi.';
  if (month === 6)  return 'POČETAK SEZONE (lipanj) — sve radi, manje gužvi, povoljnije cijene nego u srpnju/kolovozu.';
  if (month === 9)  return 'POSTSEZONI (rujan) — IDEALAN TERMIN: more toplo (24°C+), manje gužvi, povoljnije cijene, romantična atmosfera.';
  if (month === 10) return 'JESEN (listopad) — sezona se zatvara, dio restorana i sadržaja zatvoren, mirno i autentično.';
  if (month >= 11 || month <= 3) return 'VAN SEZONE — mnogi restorani, kampovi i nautički sadržaji zatvoreni. Grad je miran i autentičan.';
  if (month >= 4 && month <= 5) return 'PREDSEZONE (travanj/svibanj) — otvaranje sadržaja, idealno za aktivni odmor bez gužvi.';
  return '';
}

// ===== STRIP BULLET LISTE I MARKDOWN NASLOVA IZ AI ODGOVORA =====
// Kad postoje kartice, uklanjamo bullet/numbered popise i bold naslove
// jer su informacije već prikazane kao kartice ispod teksta.
// Problem: AI generira "**Organizacija:**\n- bullet\n- bullet" →
// stripBulletList briše bullets, ali ostavlja prazan bold naslov.
// Rješenje: bold naslove (redak koji je samo **Tekst:** ili ### Tekst)
// brišemo zajedno s njihovim sadržajem.
function stripBulletList(text) {
  const lines = text.split('\n');
  const out = [];
  let skipBlank = false;

  for (const line of lines) {
    const t = line.trim();

    // Bold naslov sekcije: **Tekst:** ili ### Tekst ili ## Tekst
    const isSectionHeader =
      /^\*\*[^*]+\*\*:?\s*$/.test(t) ||
      /^#{2,4}\s+/.test(t);

    // Bullet linija: počinje s "-", "•", "–", "—" ili brojem + točka
    const isBullet =
      /^[-•–—]\s+/.test(t) ||
      /^\d+[.)]\s+/.test(t);

    if (isBullet || isSectionHeader) {
      skipBlank = true;
      continue;
    }

    // Preskači prazne retke neposredno nakon bullet/header bloka
    if (skipBlank && t === '') continue;
    skipBlank = false;

    out.push(line);
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

// ===== PRIJEVOD KARTICA =====
const LANG_NAMES = {
  en:'English', de:'German', sl:'Slovenian',
  it:'Italian', hu:'Hungarian', cs:'Czech', sk:'Slovak'
};

async function translateItems(items, lang) {
  if (lang === 'hr' || !items.length) return items;
  const target = LANG_NAMES[lang];
  if (!target) return items;

  const fields = items.map(it => ({
    opis:      it.opis     || '',
    adresa:    it.adresa   || '',
    recenzija: it.recenzija ? it.recenzija.replace(/^["""]+|["""]+$/g, '') : ''
  }));

  try {
    const tr = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Translate Croatian tourism card texts to ${target}. Return ONLY JSON object {"t":[{"opis":"...","adresa":"...","recenzija":"..."},...]}. Keep proper nouns (place/restaurant names) unchanged. Be concise.\n\n${JSON.stringify(fields)}`
      }],
      temperature: 0.1,
      max_tokens: 3000
    });

    const raw = tr.choices[0]?.message?.content || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return items;
    let parsed;
    try { parsed = JSON.parse(match[0]); } catch { return items; }
    const tArr = parsed.t || parsed.translations || parsed.items || [];
    if (!Array.isArray(tArr) || !tArr.length) return items;

    // Per-item merge — preveди što je dostupno, ostatak ostavi HR
    return items.map((it, i) => {
      const t = tArr[i];
      if (!t) return it;
      return {
        ...it,
        opis:      t.opis     || it.opis,
        adresa:    t.adresa   || it.adresa,
        recenzija: t.recenzija ? `"${t.recenzija}"` : it.recenzija
      };
    });
  } catch {
    return items; // fallback na HR kartice ako prijevod ne uspije
  }
}

// ===== SYSTEM PROMPT =====
function buildSystemPrompt(lang, context, weatherCtx) {
  const weatherDirectives = buildWeatherDirectives(weatherCtx);
  const seasonCtx = getSeasonContext();

  const weatherSummary = weatherCtx?.temperature != null
    ? `Temperatura zraka: ${weatherCtx.temperature}°C | Vjetar: ${weatherCtx.windspeed} km/h${weatherCtx.sea_temp != null ? ` | Mora: ${weatherCtx.sea_temp}°C` : ''}${weatherCtx.wave_height != null ? ` | Val: ${weatherCtx.wave_height} m` : ''} | ${weatherCtx.icon || ''} ${weatherCtx.opis || ''}`
    : 'Vremenski podaci nisu dostupni.';

  const langNote = lang === 'en' ? 'IMPORTANT: The user writes in English — respond ONLY in English.'
    : lang === 'de' ? 'WICHTIG: Der Nutzer schreibt auf Deutsch — antworte NUR auf Deutsch.'
    : lang === 'sl' ? 'POMEMBNO: Uporabnik piše v slovenščini — odgovarjaj SAMO v slovenščini.'
    : lang === 'it' ? 'IMPORTANTE: L\'utente scrive in italiano — rispondi SOLO in italiano.'
    : lang === 'hu' ? 'FONTOS: A felhasználó magyarul ír — válaszolj CSAK magyarul.'
    : lang === 'cs' ? 'DŮLEŽITÉ: Uživatel píše česky — odpovídej POUZE česky.'
    : lang === 'sk' ? 'DÔLEŽITÉ: Používateľ píše po slovensky — odpovedaj IBA po slovensky.'
    : '';

  return `Ti si AI turistički informator za Biograd na Moru — primorski grad u Zadarskoj županiji na dalmatinskoj obali između Zadra i Šibenika.
${langNote}

KARAKTER DESTINACIJE:
- Primorski turistički grad s izraženom LJETNOM SEZONALNOŠĆU (vrhunac srpanj–kolovoz)
- Nautički centar: Marina Kornati (800+ vezova), charter centar, polazište za NP Kornati
- Plaže: Dražica, Soline, Bošana, Kumenat, FKK Rakovica — šljunčane i kamenite
- Gastronomija: svježa riba i plodovi mora (brancin, lignje, hobotnica, dagnje, brudet, peka)
- Blizina NP Kornati (140 otoka — obavezni izlet brodom)
- Park prirode Vransko jezero (6 km) — ornitološki rezervat, biciklizam
- Zadar 28 km, Šibenik 65 km, NP Krka 65 km
- Topla mediteranska klima, 2700+ sunčanih sati godišnje

AKTUALNO VRIJEME (REALNI PODACI — koristi ih konkretno!):
${weatherSummary}
${weatherDirectives}

SEZONA: ${seasonCtx}

TURISTIČKI PROFILI POSJETITELJA:
- Nautičari (charter, jedriličari, motorni brodovi)
- Obiteljski turisti (plaže, animacija, kampovi)
- Aktivni turisti (ronjenje, windsurfing, kayak, biciklizam)
- Gastronomski turisti
- Izletnici (Kornati, Zadar, NP Krka)

PRIVATNI SMJEŠTAJ — DIREKTNI KONTAKTI (bez provizije):
Biograd ima 1000+ privatnih apartmana. Uvijek upućuj na DIREKTNE kontakte — bez Booking.com/Airbnb:
- TZ katalog: https://www.discover-biograd.com/en/accommodation (hoteli, kampovi, privatni smještaj)
- BiogradBooking: https://www.biogradbooking.com (privatni smještaj, direktni kontakti vlasnika)
- Škver Tours: https://www.skver-tours.com/?l=hr&ispis=ponuda&vrsta=apart&id=672 | Tel: +385 233 844 57
- Ilirija Resort: reservations@ilirijabiograd.com | Tel: +385 23 383 556
- Cijenovno: 48–170+ EUR/noć ovisno o veličini i sezoni
- Rezervacija: srpanj/kolovoz → 3–4 mj. unaprijed, rujan/lipanj → 2–4 tjedna
VAŽNO: nikad ne predlažaj Booking.com ili Airbnb — gost treba direktno kontaktirati vlasnika ili lokalnu agenciju!

SPECIFIČNI SAVJETI:
- Za NP Kornati: izlet brodom iz Biograda (8–10 sati, ~50–80 EUR), ili charter brod
- Peka: naručiti 2+ sata unaprijed
- Parking (upravlja Bošana d.o.o., tel. +385 23 384 363): 3 zone — Zona 0 Bijela €2,60/sat (cijele god.), Zona I Plava €1,50/sat (sezona 15.6.–15.9.) / €1,00/sat (van sezone), Zona II Žuta €1,50/sat cijele god. Dnevna karta: €10 sezona / €5 van sezone. Plaćanje: parkomat ili m-parking SMS (Zona 0→708238, Zona I→708237). Šlep: €53,09. U sezoni centar gust — preporuči dolazak ujutro ili Zona II
- Trajekt na Pašman: svakodnevno iz Biograda, 10 min vožnje — mirno okruženje
- Vransko jezero: kružna biciklistička ruta 32 km — idealno za aktivne turiste

KONTAKT TZ Biograd na Moru:
${db.grad.adresa_tz} | Tel: ${db.grad.telefon_tz} | ${db.grad.web_tz}

BAZA PODATAKA (koristi ove informacije):
${JSON.stringify(context, null, 0).substring(0, 6000)}

PRAVILA ODGOVARANJA:
- Odgovori na jeziku na kojem korisnik piše (hr/en/de)
- HIJERARHIJA: REALNI VREMENSKI UVJETI → SEZONA → FUNKCIONALNA PREPORUKA → ATMOSFERA
- Uvijek integrira aktualne vremenske podatke u preporuku (ne ignoriraj ih!)
- Budi konkretan i praktičan — turisti žele akcijske informacije
- Za preporuke smještaja/restorana napomeni da se rezervacija preporuča unaprijed
- Temperatura mora je važan podatak — navedi je kada je relevantno

KLJUČNO PRAVILO — BAZA PODATAKA (ANTI-HALUCINACIJA):
Ti si turistički asistent ISKLJUČIVO za Biograd na Moru. Sve informacije o konkretnim objektima (restorani, hoteli, konobe, plaže, servisi, parkiranje itd.) MORAŠ crpiti SAMO iz priložene baze podataka.
ZABRANJENO: Koristiti opće znanje ili vlastitu procjenu za navođenje specifičnih naziva objekata koji nisu u bazi!
Ako korisnik pita za objekt po imenu koji se NE NALAZI u bazi — iskreno odgovori da nemaš tu informaciju i ponudi relevantne alternative koje baza sadrži.
PRIMJER ispravnog odgovora kad objekt nije u bazi: "Nemam informacije o objektu tog naziva u Biogradu. Mogu ti preporučiti [alternativa iz baze]."
NIKAD ne govori "pogledajte kartice ispod" — kartice se prikazuju automatski, ne treba ih najavljivati.

KLJUČNO PRAVILO — KARTICE:
Kada korisnik pita za restorane, konobe, smještaj, plaže, hotele, kampove, parkinge,
ljekarne, supermarkete, benzinske, servise, konobe na Kornatima, nautiku, izlete ili atrakcije,
sustav će automatski prikazati vizualne kartice sa slikama, opisima, linkovima i recenzijama.
ZBOG TOGA: u svom tekstu APSOLUTNO NEMOJ individualno nabrajati, navoditi niti opisivati svaki objekt posebno — ni u obliku liste, ni u obliku proze!
Napiši samo 1–2 kratke uvodne rečenice s općim kontekstom ili savjetom — NE opisuj svaku plažu/restoran/hotel zasebno!
KRITIČNO: Kada sustav prikazuje kartice za određenu kategoriju (benzinske, parkinge, ljekarne itd.),
to znači da baza SADRŽI te podatke — NIKAD ne piši "nemam informacije" ili "ne znam" za tu kategoriju!
Uvijek piši pozitivnu uvodnu rečenicu, npr.: "Biograd ima 3 benzinske postaje — dvije INA i Tifon s LPG-om."
ZABRANJEN FORMAT: "Plaža Dražica je najpopularnija gradska plaža... Plaža Soline smještena je u borovoj šumi..."
ZABRANJEN FORMAT: "- Konoba Levrnaka: Smještena na otoku... \n- Konoba Žakan: Ova konoba..."
ZABRANJEN FORMAT: "1. Restoran... 2. Hotel... 3. Plaža..."
ZABRANJEN FORMAT: "Za više informacija pogledajte kartice ispod." (kartice se prikazuju automatski!)
ZABRANJEN FORMAT: bold naslovi sekcija kao "**Organizacija izleta:**", "**Što vidjeti:**", "**Savjeti:**", "**Tips:**" — NE koristiti strukturu s naslovima!
ISPRAVAN FORMAT (plaže): "Biograd nudi nekoliko predivnih plaža uz kristalno čisto more — nešto za svačiji ukus."
ISPRAVAN FORMAT (kornati): "Izlet na Kornate traje 8–10 sati i kreće iz Biograd — idealno rezervirati unaprijed jer su mjesta ograničena."
ISPRAVAN FORMAT (konobe): "Kornati su poznati po svježoj ribi i autentičnoj dalmatinskoj kuhinji. Rezervirajte unaprijed — konobe su male i brzo se pune u sezoni."`;
}

// ===== GLAVNI HANDLER =====
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history = [], category: lastCategory, weather, clientLang } = req.body || {};

  // Warmup ping
  if (message === '__warmup__') {
    return res.status(200).json({ reply: 'ok' });
  }

  if (!message?.trim()) {
    return res.status(400).json({ error: 'No message' });
  }

  try {
    const lang = detectLang(message, clientLang || 'hr');
    const detectedCategory = detectCategory(message, lastCategory, db);
    const ctxFn = detectedCategory ? CATEGORY_CONTEXTS[detectedCategory] : null;
    const context = ctxFn ? ctxFn(db) : { grad: db.grad, opcenito: db.opcenito };

    // getCategoryItems je sinkron — pokrećemo PRIJE system prompta da LLM zna o karticama
    const items = getCategoryItems(detectedCategory, message);

    const systemPrompt = buildSystemPrompt(lang, context, weather);

    // Ako kartice postoje, dodajemo eksplicitnu uputu u zadnju user poruku
    const itemsNote = items.length > 0
      ? `\n[SUSTAV: Automatski će biti prikazano ${items.length} vizualnih kartica s detaljima. Napiši SAMO kratku pozitivnu uvodnu rečenicu — NE govori da nemaš informacije, jer ih imaš u bazi.]`
      : '';

    // Poruke za OpenAI (do 10 prethodnih)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10),
      { role: 'user', content: message + itemsNote }
    ];

    // Paralelno: glavni AI odgovor + prijevod kartica (nema dodatne latencije)
    const [completion, translatedItems] = await Promise.all([
      openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.4,
        max_tokens: 800
      }),
      translateItems(items, lang)
    ]);

    const rawReply = completion.choices[0]?.message?.content || '';
    const suggestions = getSuggestions(detectedCategory || 'opcenito', lang, message);

    // Ako postoje kartice → ukloni bullet/numbered liste iz AI teksta
    const reply = translatedItems.length > 0 ? stripBulletList(rawReply) : rawReply;

    return res.status(200).json({
      reply,
      category: detectedCategory,
      lang,
      suggestions,
      items: translatedItems
    });

  } catch (err) {
    console.error('Chat error:', err.message);
    return res.status(200).json({
      reply: 'Došlo je do greške. Molimo pokušajte ponovno ili nas kontaktirajte na ' + db.grad.telefon_tz,
      category: null,
      suggestions: [],
      items: []
    });
  }
}
