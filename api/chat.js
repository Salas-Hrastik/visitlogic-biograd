import Anthropic from "@anthropic-ai/sdk";
import { db } from "./_database.js";
import { translations } from "./_translations.js";
import { menus } from "./_menus.js";

// Instant lokalizacija kartica iz unaprijed prevedene baze (samo lookup, bez API poziva).
// Prevodi opis/recenziju/tip/sadržaje; naziv, adresu i telefon ostavlja (vlastita imena).
function localizeItems(items, lang) {
  const T = translations[lang];
  if (lang === 'hr' || !T || !items?.length) return items;
  const tr = s => (s && typeof s === 'string' && T[s]) ? T[s] : s;
  return items.map(it => ({
    ...it,
    opis:      tr(it.opis),
    recenzija: tr(it.recenzija),
    adresa:    tr(it.adresa)
  }));
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim()
});

// ===== HELPER: parsira krajnji datum termina ("DD.MM.YYYY" ili "DD.MM. – DD.MM.YYYY") =====
function terminToDate(termin) {
  if (!termin) return null;
  const clean = termin.replace(/\s/g, '');
  const parts = clean.split('–');
  const last = parts[parts.length - 1];
  const m = last.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  return null;
}

// Termin opisan riječima nema datum: vidljivo_do određuje kad takvo događanje nestaje.
function isEventActive(e) {
  const end = terminToDate(e.vidljivo_do || e.termin);
  return !end || end.getTime() >= new Date().setHours(0, 0, 0, 0);
}

// ===== KATEGORIJSKI KONTEKSTI =====
const CATEGORY_CONTEXTS = {
  plaze:       (db) => ({ grad: db.grad, plaze: db.plaze }),
  gastronomija:(db) => ({ grad: db.grad, gastronomija: db.gastronomija }),
  nautika:     (db) => ({ grad: db.grad, nautika: db.nautika }),
  smjestaj:    (db) => ({
    grad: db.grad,
    smjestaj: Object.fromEntries(Object.entries(db.smjestaj || {}).map(([k, v]) => [k, Array.isArray(v)
      ? v.map(({ naziv, opis, lokacija, telefon, telefon2, email, web }) =>
          Object.fromEntries(Object.entries({ naziv, opis, lokacija, telefon, telefon2, email, web }).filter(([, x]) => x)))
      : v]))
  }),
  kornati:     (db) => ({ grad: db.grad, kornati: db.kornati }),
  izleti:      (db) => ({ grad: db.grad, izleti: db.izleti }),
  sport:       (db) => ({ grad: db.grad, sport: db.sport }),
  atrakcije:   (db) => ({ grad: db.grad, atrakcije: db.atrakcije }),
  dogadanja:   (db) => ({
    grad: db.grad,
    dogadanja: { ...db.dogadanja, eventi: (db.dogadanja?.eventi || []).filter(isEventActive) }
  }),
  opcenito:    (db) => ({ grad: db.grad, opcenito: db.opcenito }),
  prakticno:   (db) => ({ grad: db.grad, prakticne_info: db.prakticne_info }),
  klima:       (db) => ({ grad: db.grad, klima: db.klima }),
};

// ===== EKSPLICITNI ZAHTJEV ZA JEZIKOM (prioritet nad svim ostalim) =====
// "Molim odgovor na talijanskom", "please respond in Italian", "auf Deutsch antworten"...
function detectRequestedLang(msg) {
  const m = msg.toLowerCase();

  // Zahtjevi na hrvatskom
  if (/na talijanskom|talijanski jezik|odgovori talijanski/i.test(m)) return 'it';
  if (/na njemačkom|njemački jezik|odgovori njemački|na njema/i.test(m)) return 'de';
  if (/na engleskom|engleski jezik|odgovori engleski/i.test(m)) return 'en';
  if (/na slovenskom|slovenski jezik|odgovori slovenski/i.test(m)) return 'sl';
  if (/na mađarskom|mađarski jezik|odgovori mađarski/i.test(m)) return 'hu';
  if (/na češkom|češki jezik|odgovori češki/i.test(m)) return 'cs';
  if (/na slovačkom|slovački jezik|odgovori slovački/i.test(m)) return 'sk';
  if (/na hrvatskom|hrvatski jezik|odgovori hrvatski/i.test(m)) return 'hr';

  // Zahtjevi na engleskom
  if (/respond in italian|answer in italian|reply in italian|in italian please/i.test(m)) return 'it';
  if (/respond in german|answer in german|reply in german|in german please|auf deutsch/i.test(m)) return 'de';
  if (/respond in english|answer in english|reply in english|in english please/i.test(m)) return 'en';
  if (/respond in slovenian|answer in slovenian|in slovenian/i.test(m)) return 'sl';
  if (/respond in hungarian|answer in hungarian|in hungarian/i.test(m)) return 'hu';
  if (/respond in czech|answer in czech|in czech/i.test(m)) return 'cs';
  if (/respond in slovak|answer in slovak|in slovak/i.test(m)) return 'sk';
  if (/respond in croatian|answer in croatian|in croatian/i.test(m)) return 'hr';

  // Zahtjevi na talijanskom
  if (/rispondi in italiano|risposta in italiano|in italiano per favore/i.test(m)) return 'it';
  if (/rispondi in tedesco|in tedesco/i.test(m)) return 'de';
  if (/rispondi in inglese|in inglese/i.test(m)) return 'en';
  if (/rispondi in croato|in croato/i.test(m)) return 'hr';

  // Zahtjevi na njemačkom
  if (/auf deutsch|antworte auf deutsch|bitte auf deutsch/i.test(m)) return 'de';
  if (/auf italienisch|antworte auf italienisch/i.test(m)) return 'it';
  if (/auf englisch|antworte auf englisch/i.test(m)) return 'en';
  if (/auf kroatisch|antworte auf kroatisch/i.test(m)) return 'hr';

  // Zahtjevi na slovenskom
  if (/prosim odgovorite slovensko|v slovenščini prosim|odgovorite v slovenščini/i.test(m)) return 'sl';

  // Zahtjevi na češkom (native)
  if (/prosím česky|odpovězte česky|odpovídejte česky|v češtině prosím/i.test(m)) return 'cs';

  // Zahtjevi na slovačkom (native)
  if (/prosím po slovensky|odpovedzte po slovensky|po slovensky prosím/i.test(m)) return 'sk';

  // Zahtjevi na mađarskom (native)
  if (/kérem magyarul|válaszoljon magyarul|magyarul kérem|magyarül kérem/i.test(m)) return 'hu';

  // Zahtjevi na engleskom za ove jezike
  if (/respond in slovenian|answer in slovenian|in slovenian please/i.test(m)) return 'sl';
  if (/respond in hungarian|answer in hungarian|in hungarian please/i.test(m)) return 'hu';
  if (/respond in czech|answer in czech|in czech please/i.test(m)) return 'cs';
  if (/respond in slovak|answer in slovak|in slovak please/i.test(m)) return 'sk';

  return null; // nije eksplicitni zahtjev
}

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

  // HU — ugrofinski, najtipičniji jezik — uvijek prepoznatljiv
  if (has(['hol','mikor','hogyan','miért','mennyibe','mennyit','melyik','étterem',
           'szállás','szálloda','szálloda','strand','tenger','sziget','kirándulás',
           'köszönöm','kérem','magyarul','magyarország','igen','nincs','van','nem',
           'jó','szép','drága','olcsó','étel','enni','inni','hal','bor','reggeli',
           'ebéd','vacsora','úszás','kerékpározás','búvárkodás','vitorlázás',
           'apartman','kemping','kikötő','hajó','időjárás','tó','folyó','erdő']))
    return 'hu';

  // SL — PRIJE EN/DE (slavenski, ali distinktivan)
  if (has(['kje','kdaj','zakaj','koliko','kateri','katere','katera','morje',
           'nastanitev','restavracija','restavracije','iščem','tukaj','torej',
           'slovenijo','slovenec','slovenka','slovenija','prosim','hvala',
           'lepo','dober','dobro','drago','poceni','hrana','jesti','piti',
           'ribe','vino','zajtrk','kosilo','večerja','plavanje','kolesarjenje',
           'potapljanje','jadranje','apartma','plaže','plaža','otok','izlet',
           'izleti','vreme','temperatura','parkirišče','avtobus','trajekt']))
    return 'sl';

  // CS — PRIJE EN/DE (zapadnoslavenski, háček = distinktivan)
  if (has(['kde','kdy','proč','restaurace','ubytování','ubytovanie','děkuji',
           'výlet','počasí','česky','česká','čechy','chci','jaké','kolik',
           'pláž','moře','jídlo','jíst','pít','ryby','víno','snídaně','oběd',
           'večeře','plavání','cyklistika','potápění','plachtění','apartmán',
           'kemp','přístav','loď','ostrov','dovolená','doporučte','prosím',
           'děkuji','dobrý','pěkný','levný','drahý','parkoviště','autobus',
           'trajekt','počasí','teplota','pláže','hotel']))
    return 'cs';

  // SK — PRIJE EN/DE (zapadnoslavenski, diakritika = distinktivna)
  if (has(['kedy','ako','prečo','reštaurácia','ubytovanie','ďakujem','výlet',
           'počasie','slovensky','slovenská','slovensko','koľko','pláž','more',
           'jedlo','jesť','piť','ryby','víno','raňajky','obed','večera',
           'plávanie','cyklistika','potápanie','plachtenie','apartmán',
           'kemp','prístav','loď','ostrov','dovolenka','odporúčate','prosím',
           'dobrý','pekný','lacný','drahý','parkovisko','autobus','trajekt',
           'teplota','pláže','kde','čo','ktoré','ktorý','som','sme','ste']))
    return 'sk';

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
// Riječi iz naziva događanja koje se javljaju i u običnim pitanjima pa ne smiju birati kategoriju.
const GENERIC_EVENT_WORDS = new Set(['biograd', 'biogradu', 'biograda', 'moru', 'boat', 'show', 'koncert', 'friends', 'family', 'sportska', 'natjecanja', 'povijest', 'race', '2026']);

function detectCategory(msg, lastCategory, db) {
  const m = msg.toLowerCase();

  if (/jelovnik|cjenik pić|speisekarte|étlap|jídeln|jedáln|jedilnik|wine list|vinsk\w* kart/.test(m) || Object.values(MENU_NAMES).some(re => re.test(msg))) return 'gastronomija';
  if (/(cijen|košta|koliko je|price|cost|how much|preis|kostet|prezz|costa|mennyibe|kolik|koľko)/.test(m) && MENU_TERMS.some(([re]) => re.test(msg))) return 'gastronomija';

  // Sajam je događanje; bez ovoga "boat" završava u nautici. Parking uz sajam ostaje praktična info.
  if (/turističk\w* agencij|turistične agencij|tourist agenc|travel agenc|reiseagentur|reisebüro|agenzi\w* (turistic|di viaggi)|utazási iroda|cestovn\w* agent/.test(m)) return 'smjestaj';
  if (/\bleut\b|adriagate|ilirija travel|my way travel|moreta/.test(m)) return 'smjestaj';
  if (/agencij/.test(m) && !/charter|čarter|jedr|nautič|izlet|kornat/.test(m)) return 'smjestaj';
  if (/pansion|pension|penzion|panzió|privatni smještaj|private accommodation|apartm|appartament|szállás|ubytov|nastanit|alloggi|unterkunft|ferienwohnung|ferienh|mediteransk\w* sel|mediterranean village|san antonij?\w*|crven\w* luk|bungalov|kuć\w* za odmor|\bkemp/.test(m)) return 'smjestaj';

  if (/škver|skver/.test(m) && !/izlet|brod|kornat|trip|boat/.test(m)) return 'smjestaj';

  if ((m.includes('boat show') || m.includes('bootsmesse')) && !m.includes('park')) return 'dogadanja';

  // Prioritet: ako poruka kombinira aktivnosti/plaže + Kornati → uvijek Kornati kategorija
  const hasKornati = m.includes('kornat');
  if (hasKornati) {
    const hasBeach  = m.includes('plaž') || m.includes('plaze') || m.includes('beach') || m.includes('strand') || m.includes('spiagge') || m.includes('strandok') || m.includes('pláž');
    const hasSport  = m.includes('ronjenj') || m.includes('ronit') || m.includes('diving') || m.includes('snorkel') || m.includes('swim') || m.includes('sport') || m.includes('kayak') || m.includes('ribolov') || m.includes('fishing') || m.includes('tauchen');
    const hasFood   = m.includes('konob') || m.includes('jesti') || m.includes('hrana') || m.includes('restoran') || m.includes('riba') || m.includes('fish') || m.includes('eat');
    if (hasBeach || hasSport || hasFood) return 'kornati';
  }

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
      .filter(w => w.length > 3 && !GENERIC_EVENT_WORDS.has(w));
    if (eventWords.some(w => m.includes(w))) return 'dogadanja';
  }

  if (m.includes('događaj') || m.includes('dogadaj') || m.includes('događanj') || m.includes('dogadanj') || m.includes('festival') || m.includes('boat show') || m.includes('manifestac') || m.includes('program') || m.includes('što se događa') || m.includes('što ima') || m.includes('ribarska večer') || m.includes('krešimir') || m.includes('ljetna zabava') || m.includes('koncerti')
    || m.includes('vikend') || m.includes('noć') || m.includes('biogradska noć') || m.includes('slovenski') || m.includes('slovenian') || m.includes('family') || m.includes('friends') || m.includes('priredba') || m.includes('smotra') || m.includes('sajam') || m.includes('karneval') || m.includes('praznik') || m.includes('blagdan') || m.includes('proslava') || m.includes('nastup') || m.includes('kada je') || m.includes('kad je') || m.includes('datum')
    || m.includes('event') || m.includes('what\'s on') || m.includes('upcoming') || m.includes('celebration') || m.includes('weekend') || m.includes('night') || m.includes('when is')
    || m.includes('veranstaltung') || m.includes('fest') || m.includes('bootsmesse') || m.includes('wann') || m.includes('wochenende')
    || m.includes('dogajanje') || m.includes('prireditev') || m.includes('manifestazione') || m.includes('quando') || m.includes('esemény') || m.includes('akce') || m.includes('podujatie'))
    return 'dogadanja';

  if (m.includes('lokalna') || m.includes('lokalne') || m.includes('lokalni') || m.includes('lokalno') ||
      m.includes('tržnica') || m.includes('trznica') || m.includes('ribarnica') || m.includes('bure centar') ||
      m.includes('park shop') || m.includes('jysk') || m.includes('suvenirnic') || m.includes('suvenir') ||
      m.includes('butik') || m.includes('boutique') || m.includes('shopping centar') || m.includes('dućan') ||
      m.includes('local shop') || m.includes('local store') || m.includes('souvenir'))
    return 'prakticno';

  if (m.includes('parking') || m.includes('parkir') || m.includes('trajekt') || m.includes('autobus') || m.includes('ljekar') || m.includes('bolnic') || m.includes('hitna') || m.includes('bankomat') || m.includes('banka') || m.includes('taksi') || m.includes('prijevoz') || m.includes('rent a car') || m.includes('wifi') || m.includes('euro') || m.includes('valuta') || m.includes('radno vrij')
    || m.includes('benzin') || m.includes('gorivo') || m.includes('servis') || m.includes('mehaničar') || m.includes('vulkanizer') || m.includes('guma') || m.includes('kvar') || m.includes('supermarket') || m.includes('konzum') || m.includes('lidl') || m.includes('kaufland') || m.includes('plodine') || m.includes('tommy') || m.includes('studenac') || m.includes('tifon')
    || m.includes('trgovin') || m.includes('kupovin') || m.includes('namirnic') || m.includes('shopping')
    || m.includes('pharmacy') || m.includes('hospital') || m.includes('atm') || m.includes('bank') || m.includes('taxi') || m.includes('bus') || m.includes('transport') || m.includes('practical') || m.includes('petrol') || m.includes('mechanic')
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
    telefon2:        o.telefon2 || '',
    email:           o.email || '',
    web:             o.web || '',
    jelovnik:        menus[o.naziv]?.url || '',
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

function getCategoryItems(category, message = '', { full = false } = {}) {
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

    const has = (...w) => w.some(x => m.includes(x));
    const isAgencija = has('agencij', 'agenc', 'škver', 'skver', 'agentur', 'agenzi', 'reisebüro', 'utazási iroda', 'leut', 'adriagate', 'ilirija travel', 'my way travel', 'moreta');
    const isHotel    = has('hotel', 'szálloda');
    const isApartman = has('apartm', 'appartament', 'privat', 'privát', 'zasebn', 'soukrom', 'súkrom', 'magán', 'soba', 'stanza', 'szoba', 'pokoj', 'izba',
      'rent', 'room', 'wohnung', 'zimmer', 'kuća za odmor', 'kuće za odmor', 'holiday home', 'ferienh');
    const isKamp     = has('kamp', 'kemp', 'camp', 'šator', 'karavan', 'mobile home', 'zelt');
    const isVila     = has('vila', 'villa', 'bungalov', 'bungalow', 'crven', 'san anton', 'mediteransk', 'mediterranean village');
    const isPansion  = has('pansion', 'pension', 'penzion', 'panzió', 'guest house', 'guesthouse', 'b&b');

    // Gumb za cijene vodi samo na vlastitu stranicu objekta: TZ stranice ne prikazuju cijene.
    const cijene = (o) => (o.web && /^https?:\/\//i.test(o.web) && !o.web.includes('discover-biograd.com')) ? { cijene_url: o.web } : {};
    const group = (arr, grupa, adresa = o => o.lokacija || '') =>
      (arr || []).map(o => item(o, { adresa: adresa(o), grupa, ...cijene(o) }));

    const S = db.smjestaj || {};
    const hoteli   = group(S.hoteli, 'hoteli');
    const kampovi  = group(S.kampovi, 'kampovi');
    const pansioni = group(S.pansioni, 'pansioni');
    const privatni = [...group(S.privatni_smjestaj, 'privatni'), ...group(S.vile_i_posebni, 'privatni')];
    const selo     = group(S.mediteransko_selo, 'selo');
    const luka     = group(S.crvena_luka, 'luka');
    const agencije = (S.turisticke_agencije || []).map(o => item(o, { adresa: o.lokacija || '', grupa: 'agencije' }));
    const kontakti = group(S.direktni_kontakti, 'katalozi', o => o.tip || '');

    if (full) return [...hoteli, ...kampovi, ...pansioni, ...privatni, ...selo, ...luka, ...agencije, ...kontakti];

    if (isAgencija) return agencije;
    const typeCount = [isHotel, isApartman, isKamp, isVila, isPansion].filter(Boolean).length;
    if (typeCount !== 1) return [...hoteli, ...kontakti];
    if (isHotel)    return filterByMessage(hoteli, message);
    if (isKamp)     return filterByMessage(kampovi, message);
    if (isPansion)  return pansioni;
    if (isVila)     return [...selo, ...luka, ...privatni.filter(p => /vil+a/i.test(p.naziv))];
    // Sadržaj se traži u hrvatskom opisu, a pitanje može biti na bilo kojem jeziku.
    const FEATURES = [
      [/bazen|pool|piscin|medenc|bazén/, 'bazen'],
      [/ljubim|\bpets?\b|haustier|animali|háziállat|mazl|zvierat/, 'ljubimci'],
      [/pogled na more|sea view|meerblick|vista mare|pogled na morje|tengerre|výhled na moře|výhľad na more/, 'pogled na more'],
      [/invalid|wheelchair|rollstuhl|rotelle|kerekesszék|bezbariér/, 'invalidsk'],
      [/kuć\\w* za odmor|ferienh|holiday home|počitniš|casa vacanze|nyaraló|rekreačn/, 'kuća za odmor']
    ];
    const wanted = FEATURES.filter(([re]) => re.test(m)).map(([, word]) => word);
    if (wanted.length) {
      const matching = privatni.filter(p => wanted.every(w => p.opis.toLowerCase().includes(w)));
      if (matching.length) return matching;
    }
    return filterByMessage([...privatni, ...kontakti], message);
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
    return (db.dogadanja?.eventi || [])
      .filter(isEventActive)
      .map(e => item(e, { adresa: e.termin || '', lokacija: e.lokacija || '' }));
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

    if (m.includes('lokalna') || m.includes('lokalne') || m.includes('lokalni') ||
        m.includes('tržnica') || m.includes('trznica') || m.includes('ribarnica') || m.includes('bure') ||
        m.includes('park shop') || m.includes('park&shop') || m.includes('jysk') ||
        m.includes('suvenirnic') || m.includes('suvenir') || m.includes('butik') || m.includes('boutique') ||
        m.includes('odjeća') || m.includes('odjeca') || m.includes('odjevni') || m.includes('shopping centar') ||
        m.includes('galerij') || m.includes('local shop') || m.includes('local store'))
      return toItems(pi.lokalne_trgovine);

    if (m.includes('market') || m.includes('supermarket') || m.includes('namirnic') || m.includes('namirnice') ||
        m.includes('konzum') || m.includes('studenac') || m.includes('kupovina') || m.includes('prehrambeni') ||
        m.includes('lidl') || m.includes('kaufland') || m.includes('plodine') || m.includes('tommy') ||
        m.includes('spar') || m.includes('interspar') || m.includes('hrana') || m.includes('živežne'))
      return toItems(pi.supermarketi);

    if (m.includes('shopping') || m.includes('kupiti') || m.includes('kupnja') || m.includes('gdje kupiti') ||
        m.includes('trgovin') || m.includes('prodavaonice') || m.includes('dućan'))
      return [...toItems(pi.lokalne_trgovine), ...toItems(pi.supermarketi)];

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

  const parts = [swimAdvice, windAdvice, skyAdvice, timeAdvice].filter(Boolean);
  return parts.length > 0
    ? '\nVREMENSKE DIREKTIVE (primijeni u odgovoru!):\n' + parts.map(p => '- ' + p).join('\n')
    : '';
}

// ===== PROGNOZA ZA NAREDNIH 5 DANA =====
function buildForecastSummary(forecast) {
  if (!forecast || forecast.length < 2) return '';

  // Preskačemo index 0 (danas je već u current weather) — uzimamo max 5 idućih dana
  const days = forecast.slice(1, 6);
  if (!days.length) return '';

  const lines = [];
  const goodDays  = [];
  const badDays   = [];

  for (const d of days) {
    const kisa  = d.kisa ?? 0;
    const code  = d.weathercode ?? 0;  // weathercode nije uvijek u forecast — nema veze
    const isRain  = kisa >= 60;
    const isOk    = kisa < 30 && d.tmax >= 15;
    const isIdeal = kisa < 15 && d.tmax >= 18;

    const kisaStr = d.kisa != null ? `, 🌧 ${d.kisa}%` : '';
    const tempStr = `${d.tmax}°C/${d.tmin}°C`;
    lines.push(`${d.dan} (${d.datum?.slice(5).replace('-','.')}): ${d.icon} ${tempStr}, ${d.opis}${kisaStr}`);

    if (isIdeal) goodDays.push(`${d.dan} (${d.datum?.slice(5).replace('-','.')})`);
    else if (isOk) goodDays.push(`${d.dan}`);
    if (isRain)   badDays.push(`${d.dan}`);
  }

  let recommendation = '';
  if (goodDays.length > 0) {
    recommendation = `Optimalni dani za izlete i kupanje: ${goodDays.join(', ')}.`;
  }
  if (badDays.length > 0) {
    recommendation += ` Loši uvjeti (kiša ≥60%): ${badDays.join(', ')} — preporuči alternative (konobe, grad, Zadar).`;
  }

  return `PROGNOZA ZA NAREDNIH ${days.length} DANA:\n` +
    lines.map(l => `- ${l}`).join('\n') +
    (recommendation ? `\n→ ${recommendation}` : '');
}

function getSeasonContext() {
  const month = new Date().getMonth() + 1; // 1-12

  if (month >= 7 && month <= 8) return {
    label: 'VRHUNAC SEZONE (srpanj/kolovoz)',
    opis: 'Gužve, sve radi, visoke cijene, obavezna rezervacija unaprijed.',
    izleti_kornati: 'Organizirani izleti SVAKI DAN, više polazaka. Polazak 07:30. Cijena 65–80 EUR/osobi s ručkom. OBAVEZNA rezervacija 2–3 dana unaprijed. Sve konobe na otocima rade.',
    savjet_izlet: 'Rezervirajte odmah — mjesta se pune tjednima unaprijed. Ponesite SPF50+, nema sjene na otocima.'
  };
  if (month === 6) return {
    label: 'POČETAK SEZONE (lipanj)',
    opis: 'Sve radi, manje gužvi nego u srpnju/kolovozu, povoljnije cijene.',
    izleti_kornati: 'Organizirani izleti svaki dan. Polazak 08:00. Cijena 50–70 EUR/osobi. Rezervacija dan ranije dovoljna. Sve konobe rade.',
    savjet_izlet: 'Lipanj je idealan — more toplo, nema gužvi, konobe prihvaćaju goste bez dugog čekanja.'
  };
  if (month === 9) return {
    label: 'POSTSEZONE (rujan)',
    opis: 'IDEALAN TERMIN — more toplo (24°C+), manje gužvi, romantična atmosfera.',
    izleti_kornati: 'Organizirani izleti svaki dan. Polazak 08:00. Cijena 50–70 EUR/osobi. Rezervacija dan ranije. Sve konobe rade.',
    savjet_izlet: 'Rujan je turistima tajna — jednaka ponuda kao lipanj/kolovoz, ali bez gužvi i jeftinije.'
  };
  if (month === 10) return {
    label: 'JESEN (listopad)',
    opis: 'Sezona se zatvara, dio sadržaja zatvoren, mirno i autentično.',
    izleti_kornati: 'Organizirani izleti SAMO vikendom. Inače privatni charter (200–400 EUR/dan za cijeli brod). Kontakt: Škver Tours (+385 23 384 457) ili Marina Kornati (+385 23 383 800). Konobe na otocima: provjeriti unaprijed, većina zatvorena.',
    savjet_izlet: 'Charter s lokalnim skiperom je pravo iskustvo u listopadu — tiho, bez turista, NP Kornati u punoj jesenskoj ljepoti.'
  };
  if (month >= 11 || month <= 3) return {
    label: 'VAN SEZONE (studeni–ožujak)',
    opis: 'Mnogi sadržaji zatvoreni, grad miran i autentičan.',
    izleti_kornati: 'NEMA organiziranih izleta. Isključivo privatni charter na upit (200+ EUR/dan). Kontakt: Marina Kornati (+385 23 383 800). VAŽNO: sve konobe na otocima zatvorene — nema ručka na otocima.',
    savjet_izlet: 'Van sezone Kornati su dostupni samo privatnim brodom ili charterom. Preporuča se iskusnijim nautičarima. Divlje, samotan i nezaboravno — ali bez ikakve infrastrukture.'
  };
  // month 4-5: predsezone
  return {
    label: 'PREDSEZONE (travanj/svibanj)',
    opis: 'Otvaranje sadržaja, idealno za aktivni odmor bez gužvi.',
    izleti_kornati: 'Organizirani izleti vikendom (Škver Tours, Biograd Boat Charter) — radnim danom NEMA grupnih izleta, ali privatni charter dostupan. Cijena 40–60 EUR/osobi za vikend izlet; charter 200–400 EUR/dan. Konobe na otocima: Levrnaka i Žakan otvaraju krajem travnja — provjeriti unaprijed.',
    savjet_izlet: 'Predsezoni charter s iskusnim skiperom nudi autentično iskustvo bez turista. Idealno za parove ili manje grupe.'
  };
}

// ===== STRIP BULLET LISTE I MARKDOWN NASLOVA IZ AI ODGOVORA =====
// Kad postoje kartice, uklanjamo bullet/numbered popise i bold naslove
// jer su informacije već prikazane kao kartice ispod teksta.
// Problem: AI generira "**Organizacija:**\n- bullet\n- bullet" →
// stripBulletList briše bullets, ali ostavlja prazan bold naslov.
// Rješenje: bold naslove (redak koji je samo **Tekst:** ili ### Tekst)
// brišemo zajedno s njihovim sadržajem.
const NAME_STOPWORDS = new Set(['turistička', 'turistica', 'agencija', 'agency', 'tourist', 'travel', 'poslovnica', 'biograd', 'online', 'apartman', 'apartmani', 'apartments', 'hotel', 'kamp', 'camp', 'villa', 'vila', 'pansion', 'guest', 'house', 'resort', 'mobile', 'homes', 'park', 'turistički', 'd.o.o.', 'the']);

// Model zna previdjeti kontakt jednog objekta u dugom popisu, pa objekt koji gost imenuje dobiva izravan redak.
function namedObjectsNote(items, message) {
  const words = (message || '').toLowerCase().split(/[^\p{L}\p{N}@.]+/u).filter(Boolean);
  const named = items.filter(o => (o.naziv || '').toLowerCase().split(/[^\p{L}\p{N}.]+/u)
    .filter(t => t.length >= 3 && !NAME_STOPWORDS.has(t))
    .some(t => words.some(w => t.length <= 3 ? w === t : w.startsWith(t))));
  if (!named.length || named.length > 3) return '';
  const lines = named.map(o => [o.naziv, o.adresa, o.telefon && `tel. ${o.telefon}`, o.telefon2 && `tel. ${o.telefon2}`, o.email && `e-mail ${o.email}`, o.web].filter(Boolean).join(' | '));
  return `\n[SUSTAV: Točni podaci iz baze za objekt koji gost spominje — navedi ih doslovno:\n${lines.join('\n')}]`;
}

const MAX_REPLY_LINKS = 6;
let linkableObjects = null;

function nameAliases(naziv) {
  const base = naziv.replace(/★/g, '').replace(/\([^)]*\)/g, '').split(/\s[—–-]\s/)[0].replace(/\bd\.o\.o\.?/gi, '').trim();
  const aliases = [base];
  const short = base
    .replace(/^turistička agencija\s+/i, '')
    .replace(/\s+turistička agencija$/i, '')
    .replace(/^(restaurant|restoran|pizzeria|plaža|konoba|bistro)\s+/i, '')
    .trim();
  if (short !== base && short.length >= 3) aliases.push(short);
  return aliases;
}

// Jednorječna imena koja su i obične riječi (restoran "More", trgovina "Konzum") ne smiju pogađati tekst.
const COMMON_NAME_WORDS = new Set(['parking', 'more', 'riva', 'slad', 'barba', 'fešta', 'guste', 'dupin', 'zadar', 'šibenik', 'nin', 'rent-a-car', 'soline', 'ina', 'studenac', 'konzum', 'arkada']);

function nameRegex(alias) {
  const words = alias.split(/\s+/).filter(Boolean);
  const singleWord = words.length === 1;
  if (singleWord && COMMON_NAME_WORDS.has(alias.toLowerCase())) return null;
  const parts = words.map(w => {
    const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return w.length <= 3 ? `${esc(w)}(?![\\p{L}\\p{N}])` : `${esc(w.length > 4 ? w.slice(0, -1) : w)}\\p{L}*`;
  });
  return new RegExp(`(?<![\\p{L}\\p{N}])${parts.join('\\s+')}`, singleWord ? 'u' : 'iu');
}

function getLinkableObjects() {
  if (linkableObjects) return linkableObjects;
  const found = new Map();
  (function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    if (v.naziv && (v.karta || v.web) && !found.has(v.naziv)) found.set(v.naziv, v);
    Object.values(v).forEach(walk);
  })(db);
  linkableObjects = [...found.values()].flatMap(o => nameAliases(o.naziv).map(alias => ({ o, alias, re: nameRegex(alias) })))
    .filter(x => x.re)
    .sort((a, b) => b.alias.length - a.alias.length || Number(!!(b.o.karta && b.o.web)) - Number(!!(a.o.karta && a.o.web)));
  return linkableObjects;
}

// Duža imena idu prva i izrezuju se iz teksta, inače "Villa Biograd 2" pogodi i "Villa Biograd".
function replyLinks(reply) {
  let text = reply || '';
  const hits = new Map();
  for (const { o, re } of getLinkableObjects()) {
    const g = new RegExp(re.source, re.flags + 'g');
    let m;
    while ((m = g.exec(text))) {
      const prev = hits.get(o.naziv);
      if (!prev || m.index < prev.at) hits.set(o.naziv, { at: m.index, naziv: o.naziv, karta: o.karta || '', web: o.web || '', jelovnik: menus[o.naziv]?.url || '' });
      text = text.slice(0, m.index) + ' '.repeat(m[0].length) + text.slice(m.index + m[0].length);
      g.lastIndex = m.index + m[0].length;
    }
  }
  return [...hits.values()].sort((a, b) => a.at - b.at).slice(0, MAX_REPLY_LINKS)
    .map(({ naziv, karta, web, jelovnik }) => ({ naziv, karta, web, jelovnik }));
}

const MENU_NAMES = {
  'Peperino': /peperin/i,
  'Restoran-Pizzeria Šare': /(^|[^\p{L}])(šare|sare)([^\p{L}]|$)/iu,
  'Pizzeria Beštek': /be[šs]tek/i,
  'Pizzeria Domestico': /domesti[ck]/i,
  'Pizzeria Casa Vecchia': /casa vecchi/i,
  'Restoran Arkada': /arkad/i,
  'Restaurant More': /restoran\p{L}* more|restaurant more/iu,
  'Barba': /(konob|restoran|gostion)\p{L}* barb|kod barb/iu,
  'Restaurant Riva': /(restoran|restaurant)\p{L}* riv/iu,
  'Bistro Europa': /bistr\p{L}* europ/iu,
};

const MENU_TERMS = [
  [/pizz|pice\b|pizu/i, ['pizza', 'pizze', 'margherita', 'margarita', 'capricciosa', 'vesuvio', 'vezuvio', 'calzone', 'funghi']],
  [/\bpiv|beer|bier|birra|\bs[öo]r\b/i, ['pivo', 'piva', 'karlovačko', 'ožujsko', 'pan ', 'heineken', 'carlsberg', 'budweiser', 'staropramen', 'guinness']],
  [/\bvin[oa]?\b|vina\b|wine|wein|\bbor\b|v[ií]no/i, ['vino', 'vina', 'graševina', 'pošip', 'maraština', 'žlahtina', 'plavac', 'merlot', 'chardonnay', 'cabernet', 'prosecco', 'champagne']],
  [/\bkav[aeu]|coffee|kaffee|caff[eè]|k[aá]v[ée]|espresso|cappuccino/i, ['kava', 'espresso', 'macchiato', 'cappuccino']],
  [/\bpić|\bpic[ae]\b|drink|getränk|bevand|bevera|ital|n[aá]poj|pijač|alkohol/i, ['pivo', 'vino', 'kava', 'espresso', 'cola', 'voda', 'sok', 'spritz']],
  [/\bsok|juice|\bsaft|succo|gyümölcslé|d[žz]us/i, ['sok', 'juice', 'cappy', 'naranč', 'limunada']],
  [/koktel|cocktail|spritz|\bgin\b|whisk/i, ['spritz', 'mojito', 'negroni', 'cuba libre', 'moscow mule', 'gin', 'whisk']],
  [/\bvod[aeu]\b|water|wasser|acqua/i, ['voda', 'water']],
  [/\brib[aeuo]|riblj|fish|fisch|pesce|\bhal|ryb/i, ['riba', 'riblj', 'plodov', 'brancin', 'orada', 'tuna', 'tunj', 'škarpina', 'kovač', 'srdel', 'skuša']],
  [/lign|calamar|squid|tintenfisch|kalmar|kalm[aá]r/i, ['lignj', 'squid']],
  [/škamp|skamp|kozic|shrimp|prawn|garnel|gamber|scamp|krevet|krevetk/i, ['škamp', 'kozic', 'shrimp', 'gamberi']],
  [/hobotnic|octopus|oktopus|polpo|poln[aá]|chobotnic/i, ['hobotnic', 'octopus']],
  [/školjk|skoljk|dagnj|mussel|muschel|cozze|shell/i, ['školjk', 'dagnj', 'kunjk', 'mussel']],
  [/\bmes[oa]|mesn|meat|fleisch|carne|\bh[uú]s|m[aä]so/i, ['mesn', 'meso', 'odrezak', 'ćevap', 'cevap', 'pljeskav', 'biftek', 'steak', 'kotlet', 'ražnji']],
  [/biftek|steak|bistecc/i, ['biftek', 'steak', 'beefsteak', 'chateaubriand']],
  [/ćevap|cevap/i, ['ćevap', 'cevap']],
  [/piletin|chicken|hühn|hahn|pollo|csirke|kuřec|kurac/i, ['piletin', 'pileć', 'chicken', 'pollo']],
  [/burger|hamburger/i, ['burger']],
  [/tjestenin|pasta|špaget|spaghetti|spaget|nudel|těstovin|testovin|tészta/i, ['špaget', 'pasta', 'tjestenin', 'pljukanc', 'njoki', 'lazanj', 'lasagne']],
  [/rižot|rizot|risott|rizott/i, ['rižot', 'risotto']],
  [/salat|salad|insalat|sal[aá]t/i, ['salat', 'salad', 'caprese', 'dalmatina', 'greca']],
  [/\bjuh|soup|suppe|zuppa|leves|polévk|polievk/i, ['juha', 'soup']],
  [/desert|dessert|slatk|kolač|palačink|sweet|süß|dolc|édes|pancake/i, ['desert', 'palačink', 'pancake', 'kolač', 'tiramisu', 'sladoled', 'fritul', 'cheesecake']],
  [/sladoled|ice cream|\beis\b|gelato|fagylalt|zmrzlin/i, ['sladoled', 'ice cream']],
  [/predjel|starter|appetizer|vorspeis|antipast|előétel|predjed/i, ['pršut', 'sir', 'inćun', 'bruschett', 'pijat', 'plata', 'predjel']],
  [/vegetar|vegan/i, ['vegetar', 'veggie', 'vege', 'vegan', 'margherita']],
  [/\bdjec|dječj|kids|kinder|bambin|gyerek|d[ěe]ts/i, ['djec', 'mali goste', 'menu za djecu']],
];

const MENU_INTENT = /jelovnik|\bmeni\b|\bmenu\b|cjenik|cijen|košta|koštaju|koliko je|preis|kostet|speisekarte|price|cost|how much|prezz|quanto cost|\bár\b|ára\b|árak|mennyibe|étlap|\bcen[aey]\b|kolik stoj|koľko stoj|jídeln|jedáln|jedilnik|imaju li|ima li|nude li/i;

function menuLine(it) {
  return `${it.n}${it.o ? ` (${it.o})` : ''}${it.c ? `: ${it.c}` : ''}`;
}

function menuHeader(naziv, m) {
  const notes = [m.izvor, m.stari_podaci ? 'STARIJI PODACI, cijene su možda promijenjene' : '', m.bez_cijena ? 'BEZ CIJENA' : '', m.napomena].filter(Boolean);
  return `${naziv} (${notes.join('; ')})`;
}

function menuItemMatches(it, stems) {
  const t = `${it.n} ${it.k || ''}`.toLowerCase();
  return stems.some(s => t.includes(s));
}

// "pizza margherita" treba margheritu, a ne prvih osam pizza s jelovnika.
function narrowToNamedDish(hits, text) {
  const words = text.toLowerCase().split(/[^\p{L}]+/u).filter(w => w.length >= 5);
  const exact = hits.filter(it => words.some(w => it.n.toLowerCase().includes(w.slice(0, -1))));
  return exact.length ? exact : hits;
}

// Vraća bilješku za model i objekte čije su stavke relevantne za pitanje.
function menuContext(message, history, category) {
  const text = message || '';
  const stems = MENU_TERMS.filter(([re]) => re.test(text)).flatMap(([, s]) => s);
  const intent = MENU_INTENT.test(text);
  let named = Object.keys(MENU_NAMES).filter(n => MENU_NAMES[n].test(text));
  if (!named.length && (intent || stems.length)) {
    const recent = (history || []).slice(-2).map(h => h.content || '').join(' ');
    named = Object.keys(MENU_NAMES).filter(n => MENU_NAMES[n].test(recent));
  }
  if (!named.length && !(category === 'gastronomija' && (intent || stems.length))) return { note: '', names: [] };

  const blocks = [];
  const names = [];
  if (named.length) {
    for (const naziv of named.slice(0, 2)) {
      const m = menus[naziv];
      const hits = narrowToNamedDish(stems.length ? m.stavke.filter(it => menuItemMatches(it, stems)) : [], text);
      if (stems.length && !hits.length) {
        const cats = [...new Set(m.stavke.map(it => it.k).filter(Boolean))].join(', ');
        blocks.push(`${menuHeader(naziv, m)}\nNa ovom jelovniku nema tražene stavke. Jelovnik sadrži: ${cats || 'stavke nisu izdvojene'}.`);
        names.push(naziv);
        continue;
      }
      const list = (hits.length ? hits : m.stavke);
      const byCat = {};
      for (const it of list) (byCat[it.k || ''] ||= []).push(menuLine(it));
      const body = Object.entries(byCat).map(([k, v]) => `${k}: ${v.join('; ')}`).join('\n');
      blocks.push(`${menuHeader(naziv, m)}\n${body || 'Stavke nisu izdvojene; gosta uputi na poveznicu jelovnika.'}`);
      names.push(naziv);
    }
  } else if (stems.length) {
    for (const [naziv, m] of Object.entries(menus)) {
      const hits = narrowToNamedDish(m.stavke.filter(it => menuItemMatches(it, stems)), text);
      if (!hits.length) continue;
      blocks.push(`${menuHeader(naziv, m)}\n${hits.slice(0, 8).map(menuLine).join('; ')}`);
      names.push(naziv);
    }
  } else {
    for (const [naziv, m] of Object.entries(menus)) {
      const byCat = {};
      for (const it of m.stavke) (byCat[it.k || ''] ||= []).push(it.c ? parseFloat(it.c.replace(',', '.')) : null);
      const parts = Object.entries(byCat).map(([k, v]) => {
        const nums = v.filter(x => x !== null);
        return nums.length ? `${k} ${Math.min(...nums)}–${Math.max(...nums)} €` : k;
      });
      blocks.push(`${menuHeader(naziv, m)}\n${parts.join('; ') || 'Stavke nisu izdvojene; gosta uputi na poveznicu jelovnika.'}`);
      names.push(naziv);
    }
  }
  const withMenu = Object.keys(menus).join(', ');
  const note = `\n[SUSTAV: JELOVNICI s vlastitih stranica objekata, provjereno ${Object.values(menus)[0].provjereno}. Cijene navodi točno kako pišu, nikad ih ne procjenjuj i ne izmišljaj. Uz cijene jednom kratko reci da su s jelovnika objekta i da ih je dobro potvrditi. Ako piše STARIJI PODACI, to izričito napomeni. Ako piše BEZ CIJENA, reci da cijene nemamo. Jelovnik imamo samo za: ${withMenu}. Za druge objekte reci da nemamo jelovnik i uputi na njihov kontakt.\n${blocks.join('\n\n').slice(0, 14000)}]`;
  return { note, names };
}

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

// ===== SYSTEM PROMPT =====
// ===== SUSTAVSKI PROMPT — DVA BLOKA RADI PROMPT CACHINGA =====
// 1) SYSTEM_STABLE: nepromjenjiv u svakom upitu (persona, karakter, pravila,
//    stalne referentne info o gradu). Računa se JEDNOM pri učitavanju modula i
//    šalje se s cache_control → Anthropic ga kešira (~10x jeftinije/brže na
//    ponovljenim upitima). Uključuje db.grad + db.opcenito da stabilni prefiks
//    sigurno prijeđe minimalni prag keširanja.
// 2) buildDynamicSystem(): mijenja se po upitu (jezik, vrijeme, sezona, kontekst
//    kategorije) — ide NAKON keširanog bloka (cache je prefiks-podudaranje).
const SYSTEM_STABLE = `Ti si AI turistički informator za Biograd na Moru — primorski grad u Zadarskoj županiji na dalmatinskoj obali između Zadra i Šibenika.

KARAKTER DESTINACIJE:
- Primorski turistički grad s izraženom LJETNOM SEZONALNOŠĆU (vrhunac srpanj–kolovoz)
- Nautički centar: Marina Kornati (800+ vezova), charter centar, polazište za NP Kornati
- Plaže: Dražica, Soline, Bošana, Kumenat, FKK Rakovica — šljunčane i kamenite
- Gastronomija: svježa riba i plodovi mora (brancin, lignje, hobotnica, dagnje, brudet, peka)
- Blizina NP Kornati (140 otoka — obavezni izlet brodom)
- Park prirode Vransko jezero (6 km) — ornitološki rezervat, biciklizam
- Zadar 28 km, Šibenik 65 km, NP Krka 65 km
- Topla mediteranska klima, 2700+ sunčanih sati godišnje

TURISTIČKI PROFILI POSJETITELJA:
- Nautičari (charter, jedriličari, motorni brodovi)
- Obiteljski turisti (plaže, animacija, kampovi)
- Aktivni turisti (ronjenje, windsurfing, kayak, biciklizam)
- Gastronomski turisti
- Izletnici (Kornati, Zadar, NP Krka)

PRIVATNI SMJEŠTAJ — DIREKTNI KONTAKTI (bez provizije):
Biograd ima 1000+ privatnih apartmana. Uvijek upućuj na DIREKTNE kontakte — bez Booking.com/Airbnb:
- Vrste smještaja prema TZ-u: hoteli, kampovi, pansioni, privatni smještaj, Mediteransko selo San Antonio, Crvena Luka i turističke agencije (svi kontakti su u bazi)
- TZ katalog privatnog smještaja: https://www.discover-biograd.com/smjestaj/privatni-smjestaj
- BiogradBooking: https://www.biogradbooking.com (privatni smještaj, direktni kontakti vlasnika)
- Škver Tours: https://skver-tours.com/?l=hr | Tel: +385 23 384 457
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

STALNE REFERENTNE INFORMACIJE O GRADU (osnovni i opći podaci — uvijek dostupni):
${JSON.stringify({ grad: db.grad, opcenito: db.opcenito }, null, 0)}

PRAVILA ODGOVARANJA:
- Odgovaraj ISKLJUČIVO na jeziku naznačenom u odjeljku "JEZIK ODGOVORA" (na kraju sustavskog prompta) — ČAK I ako je korisnikova poruka ili prethodni razgovor na drugom jeziku. Prevedi SVE (vremenske uvjete, praktične info, savjete, opise) na taj jezik. Iznimka: samo ako korisnik u ovoj poruci izričito traži drugi jezik. Podržani jezici: hr, en, de, it, sl, cs, sk, hu.
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

// Dinamički dio sustavskog prompta (mijenja se po upitu) — ide NAKON keširanog
// SYSTEM_STABLE. Sadrži jezik odgovora, aktualno vrijeme/prognozu, sezonu i
// kontekst baze za konkretnu kategoriju pitanja.
function buildDynamicSystem(lang, context, weatherCtx) {
  const weatherDirectives = buildWeatherDirectives(weatherCtx);
  const forecastSummary   = buildForecastSummary(weatherCtx?.forecast);
  const seasonCtx = getSeasonContext();

  const weatherSummary = weatherCtx?.temperature != null
    ? `Temperatura zraka: ${weatherCtx.temperature}°C | Vjetar: ${weatherCtx.windspeed} km/h${weatherCtx.sea_temp != null ? ` | Mora: ${weatherCtx.sea_temp}°C` : ''}${weatherCtx.wave_height != null ? ` | Val: ${weatherCtx.wave_height} m` : ''} | ${weatherCtx.icon || ''} ${weatherCtx.opis || ''}`
    : 'Vremenski podaci nisu dostupni.';

  const langNote = lang === 'en'
    ? 'IMPORTANT: Respond in English. Translate ALL content (weather, tips, seasons) into English. If the user explicitly requests a different language, switch immediately.'
    : lang === 'de'
    ? 'WICHTIG: Antworte ausschließlich auf Deutsch. Übersetze ALLE Inhalte (Wetter, Tipps, Jahreszeiten) ins Deutsche. Falls der Nutzer eine andere Sprache wünscht, wechsle sofort.'
    : lang === 'sl'
    ? 'POMEMBNO: Odgovarjaj IZKLJUČNO v slovenščini. Prevedi VSE vsebine (vreme, nasvete, sezone) v slovenščino. Kontekst baze podatkov je na hrvaščini — prevedite vse za gosta. Če uporabnik zahteva drug jezik, ga takoj uporabi.'
    : lang === 'it'
    ? 'IMPORTANTE: Rispondi ESCLUSIVAMENTE in italiano. Traduci TUTTI i contenuti (meteo, consigli, stagioni) in italiano. Se l\'utente richiede un\'altra lingua, passa subito a quella.'
    : lang === 'hu'
    ? 'FONTOS: Válaszolj KIZÁRÓLAG magyarul. Fordítsd le AZ ÖSSZES tartalmat (időjárás, tippek, szezon) magyarra. Az adatbázis kontextusa horvát — mindent fordíts le a vendég számára. Ha a felhasználó más nyelvet kér, azonnal válts.'
    : lang === 'cs'
    ? 'DŮLEŽITÉ: Odpovídej VÝHRADNĚ česky. Přelož VEŠKERÝ obsah (počasí, tipy, sezóna) do češtiny. Kontext databáze je v chorvatštině — vše přelož pro hosta. Pokud uživatel požaduje jiný jazyk, okamžitě přepni.'
    : lang === 'sk'
    ? 'DÔLEŽITÉ: Odpovedaj VÝLUČNE po slovensky. Prelož VŠETOK obsah (počasie, tipy, sezóna) do slovenčiny. Kontext databázy je v chorvátčine — všetko prelož pre hosťa. Ak používateľ požaduje iný jazyk, okamžite prejdi naň.'
    : '';

  const LANG_LABEL = { hr:'hrvatskom', en:'engleskom (English)', de:'njemačkom (Deutsch)', sl:'slovenskom (slovenščina)', it:'talijanskom (italiano)', hu:'mađarskom (magyar)', cs:'češkom (čeština)', sk:'slovačkom (slovenčina)' };
  const targetLangLabel = LANG_LABEL[lang] || 'hrvatskom';

  return `JEZIK ODGOVORA: Odgovaraj ISKLJUČIVO na ${targetLangLabel} jeziku. ${langNote}

DANAŠNJI DATUM: ${new Date().toLocaleDateString('hr-HR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Zagreb' })}

AKTUALNO VRIJEME (REALNI PODACI — koristi ih konkretno!):
${weatherSummary}
${weatherDirectives}

${forecastSummary}

SEZONA: ${seasonCtx.label} — ${seasonCtx.opis}
IZLETI NA KORNATE (AKTUALNO ZA OVU SEZONU):
${seasonCtx.izleti_kornati}
SAVJET ZA IZLET: ${seasonCtx.savjet_izlet}

BAZA PODATAKA ZA OVO PITANJE (koristi ove informacije):
${JSON.stringify(context, null, 0).substring(0, 20000)}`;
}

// ===== INSTANT UVOD ZA KATEGORIJE (bez AI poziva — kao Slavonski Brod) =====
const CAT_LABEL = {
  dogadanja:    { hr:'Događanja', en:'Events', de:'Veranstaltungen', sl:'Dogodki', it:'Eventi', hu:'Rendezvények', cs:'Akce', sk:'Podujatia' },
  plaze:        { hr:'Plaže', en:'Beaches', de:'Strände', sl:'Plaže', it:'Spiagge', hu:'Strandok', cs:'Pláže', sk:'Pláže' },
  gastronomija: { hr:'Restorani i gastronomija', en:'Restaurants & dining', de:'Restaurants & Gastronomie', sl:'Restavracije in gastronomija', it:'Ristoranti e gastronomia', hu:'Éttermek és gasztronómia', cs:'Restaurace a gastronomie', sk:'Reštaurácie a gastronómia' },
  nautika:      { hr:'Nautika', en:'Boating & sailing', de:'Nautik', sl:'Navtika', it:'Nautica', hu:'Hajózás', cs:'Jachting', sk:'Jachting' },
  smjestaj:     { hr:'Smještaj', en:'Accommodation', de:'Unterkunft', sl:'Nastanitev', it:'Alloggi', hu:'Szállás', cs:'Ubytování', sk:'Ubytovanie' },
  kornati:      { hr:'Kornati', en:'Kornati', de:'Kornaten', sl:'Kornati', it:'Kornati', hu:'Kornati', cs:'Kornati', sk:'Kornati' },
  izleti:       { hr:'Izleti', en:'Excursions', de:'Ausflüge', sl:'Izleti', it:'Escursioni', hu:'Kirándulások', cs:'Výlety', sk:'Výlety' },
  sport:        { hr:'Sport i aktivnosti', en:'Sports & activities', de:'Sport & Aktivitäten', sl:'Šport in aktivnosti', it:'Sport e attività', hu:'Sport és tevékenységek', cs:'Sport a aktivity', sk:'Šport a aktivity' },
  atrakcije:    { hr:'Atrakcije', en:'Attractions', de:'Sehenswürdigkeiten', sl:'Znamenitosti', it:'Attrazioni', hu:'Látnivalók', cs:'Atrakce', sk:'Atrakcie' },
  prakticno:    { hr:'Praktične informacije', en:'Practical info', de:'Praktische Infos', sl:'Praktične informacije', it:'Info pratiche', hu:'Hasznos infók', cs:'Praktické informace', sk:'Praktické informácie' },
};
const INTRO_TMPL = {
  hr: (n, name) => `📍 **${name}** u Biogradu na Moru — ${n} ${n === 1 ? 'rezultat' : 'rezultata'}:`,
  en: (n, name) => `📍 **${name}** in Biograd na Moru — ${n} ${n === 1 ? 'result' : 'results'}:`,
  de: (n, name) => `📍 **${name}** in Biograd na Moru — ${n} ${n === 1 ? 'Ergebnis' : 'Ergebnisse'}:`,
  sl: (n, name) => `📍 **${name}** v Biogradu na Moru — ${n} ${n === 1 ? 'rezultat' : 'rezultatov'}:`,
  it: (n, name) => `📍 **${name}** a Biograd na Moru — ${n} ${n === 1 ? 'risultato' : 'risultati'}:`,
  hu: (n, name) => `📍 **${name}** Biogradban — ${n} találat:`,
  cs: (n, name) => `📍 **${name}** v Biogradu na Moru — ${n} ${n === 1 ? 'výsledek' : 'výsledků'}:`,
  sk: (n, name) => `📍 **${name}** v Biograde na Mori — ${n} ${n === 1 ? 'výsledok' : 'výsledkov'}:`,
};
function buildCategoryIntro(cat, n, lang) {
  const labelMap = CAT_LABEL[cat];
  const name = labelMap ? (labelMap[lang] || labelMap.hr) : (CAT_LABEL.atrakcije[lang] || 'Rezultati');
  const tmpl = INTRO_TMPL[lang] || INTRO_TMPL.hr;
  return tmpl(n, name);
}

// Uz tekstualni odgovor kartice su dopuna; puni popis je na tabu kategorije.
const MAX_CARDS_WITH_ANSWER = 8;

// ===== GLAVNI HANDLER =====
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history = [], category: lastCategory, forcedCategory, weather, clientLang, forceLang } = req.body || {};

  // Warmup ping
  if (message === '__warmup__') {
    return res.status(200).json({ reply: 'ok' });
  }

  if (!message?.trim()) {
    return res.status(400).json({ error: 'No message' });
  }

  try {
    // Prioritet: eksplicitni zahtjev u poruci ("odgovori na X") > korisnikov odabir zastavom
    // (forceLang) > automatska detekcija iz teksta poruke.
    const SUPPORTED_LANGS = ['hr','en','de','it','sl','cs','sk','hu'];
    const lang = detectRequestedLang(message)
      || (forceLang && SUPPORTED_LANGS.includes(forceLang) ? forceLang : detectLang(message, clientLang || 'hr'));
    // Eksplicitni klik na tab (forcedCategory) ima prioritet nad detekcijom iz teksta —
    // riješava krivo prepoznavanje kategorije na jezicima koje detekcija ne pokriva (hu, cs, sk, sl, it).
    const isForced = forcedCategory && CATEGORY_CONTEXTS[forcedCategory];
    const detectedCategory = isForced ? forcedCategory : detectCategory(message, lastCategory, db);
    const ctxFn = detectedCategory ? CATEGORY_CONTEXTS[detectedCategory] : null;
    const context = ctxFn ? ctxFn(db) : { grad: db.grad, opcenito: db.opcenito, atrakcije: db.atrakcije };

    // getCategoryItems je sinkron — pokrećemo PRIJE system prompta da LLM zna o karticama
    const items = getCategoryItems(detectedCategory, message, { full: !!isForced });

    const systemDynamic = buildDynamicSystem(lang, context, weather);
    const seasonCtx = getSeasonContext(); // za [SUSTAV] itinerer note

    // Ako kartice postoje, dodajemo eksplicitnu uputu u zadnju user poruku
    const msgLow = message.toLowerCase();

    // Detektiramo zahtjev za konkretnim itinererom / planom dana
    const wantsItinerary = msgLow.includes('itinerer') || msgLow.includes('raspored') ||
      msgLow.includes('plan puta') || msgLow.includes('sat po sat') || msgLow.includes('korak po korak') ||
      msgLow.includes('detaljan program') || msgLow.includes('itinerary') || msgLow.includes('schedule') ||
      msgLow.includes('step by step') || msgLow.includes('reiseplan') || msgLow.includes('tagesplan') ||
      // "konkretan prijedlog" za izletničke kategorije → itinerer
      ((msgLow.includes('konkretan') || msgLow.includes('konkretno') || msgLow.includes('specific') || msgLow.includes('konkreten')) &&
       (msgLow.includes('prijedlog') || msgLow.includes('plan') || msgLow.includes('odlazak') || msgLow.includes('izlet') || msgLow.includes('posjet') || msgLow.includes('trip') || msgLow.includes('visit') || msgLow.includes('ausflug')));

    // Klik na tab je pregled kategorije: instant lista bez AI poziva.
    // Tipkano pitanje uvijek ide kroz AI jer traži odgovor, a ne popis.
    if (items.length > 0 && isForced) {
      return res.status(200).json({
        reply: buildCategoryIntro(detectedCategory, items.length, lang),
        category: detectedCategory,
        lang,
        suggestions: getSuggestions(detectedCategory || 'opcenito', lang, message),
        items: localizeItems(items, lang)
      });
    }

    // Popis tražene vrste smještaja prikazuje se cijeli: to je ono što gost i pita.
    const menuInfo = menuContext(message, history, detectedCategory);
    const menuFirst = menuInfo.names.flatMap(n => {
      const known = items.find(i => i.naziv === n);
      if (known) return [known];
      const raw = (db.gastronomija?.restorani || []).find(r => r.naziv === n);
      return raw ? [item(raw)] : [];
    });
    const rankedItems = menuFirst.length ? [...menuFirst, ...items.filter(i => !menuInfo.names.includes(i.naziv))] : items;
    const cardItems = detectedCategory === 'smjestaj' ? rankedItems : rankedItems.slice(0, MAX_CARDS_WITH_ANSWER);
    const itemsNote = cardItems.length > 0
      ? wantsItinerary
        ? `\n[SUSTAV: Automatski će biti prikazano ${cardItems.length} vizualnih kartica s ponuđačima izleta. Korisnik traži KONKRETAN ITINERER.\n\nTRENUTNA SEZONA: ${seasonCtx.label}\nDOSTUPNOST IZLETA: ${seasonCtx.izleti_kornati}\nSAVJET: ${seasonCtx.savjet_izlet}\n\nPROGNOZA: Iz bloka "PROGNOZA ZA NAREDNIH X DANA" u promptu — preporuči KONKRETNE optimalne dane za izlet (koji dani su sunčani, koji kišoviti). Ako korisnik pita za "ovaj tjedan" ili "naredne dane" — napiši koji dani su dobri za izlet i koji loši.\n\nNapiši strukturiran plan dana PRILAGOĐEN OVOJ SEZONI I PROGNOZI. Format: emoji + vrijeme + kratki opis, npr. "🕖 07:30 — Polazak...". Na kraju dodaj preporuku optimalnog dana na temelju prognoze + praktične savjete. SMIJE koristiti strukturirani format s vremenima. Kartice s agencijama prikazuju se automatski ispod.]`
        : `\n[SUSTAV: Ispod odgovora automatski će biti prikazano ${cardItems.length} vizualnih kartica. Odgovori IZRAVNO na korisnikovo pitanje u 1–3 rečenice koristeći podatke iz baze (npr. cijena, datum, udaljenost, preporuka). Ako traženog podatka nema u bazi, reci to i uputi na TZ. NE nabrajaj kartice.]`
      : '';
    const namedNote = detectedCategory === 'smjestaj' ? namedObjectsNote(cardItems, message) : '';

    // Poruke za Claude (do 10 prethodnih; system ide kao zaseban parametar)
    const historyMessages = (history || []).slice(-10)
      .filter(m => m.role === 'user' || m.role === 'assistant');

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 800,
      thinking: { type: 'disabled' }, // turistički bot: prioritet je brzina odgovora
      // Prompt caching: stabilni blok (persona + pravila + stalne info) je keširan,
      // dinamički (jezik/vrijeme/sezona/baza) ide poslije njega.
      system: [
        { type: 'text', text: SYSTEM_STABLE, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: systemDynamic },
      ],
      messages: [
        ...historyMessages,
        { role: 'user', content: message + itemsNote + namedNote + menuInfo.note }
      ]
    });

    // Mjerenje prompt cachinga (Vercel logovi): read>0 → keširani prefiks se koristi.
    if (completion.usage) {
      const u = completion.usage;
      console.log(`[cache] read=${u.cache_read_input_tokens ?? 0} write=${u.cache_creation_input_tokens ?? 0} input=${u.input_tokens ?? 0} output=${u.output_tokens ?? 0}`);
    }

    const rawReply = completion.content[0]?.type === 'text' ? completion.content[0].text : '';
    const suggestions = getSuggestions(detectedCategory || 'opcenito', lang, message);

    // Ako postoje kartice → ukloni bullet/numbered liste iz AI teksta
    const reply = cardItems.length > 0 ? stripBulletList(rawReply) : rawReply;

    return res.status(200).json({
      reply,
      category: detectedCategory,
      lang,
      suggestions,
      links: replyLinks(reply),
      items: localizeItems(cardItems, lang)
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
