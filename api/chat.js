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
  dogadanja:   (db) => ({ grad: db.grad, dogadanja: db.dogadanja }),
  opcenito:    (db) => ({ grad: db.grad, opcenito: db.opcenito }),
  prakticno:   (db) => ({ grad: db.grad, prakticne_info: db.prakticne_info }),
};

// ===== DETEKCIJA JEZIKA =====
function detectLang(msg) {
  const w = msg.toLowerCase().split(/[\s,?.!;:()\-]+/);
  const has = (list) => list.some(x => w.includes(x));
  if (has(['what','where','how','which','when','is','are','can','do','have','show','find','tell','any','the','and','best','visit','see','eat','drink','stay','sleep','book','beach','price','time','open','boat','sailing','island','sea','water']))
    return 'en';
  if (has(['was','wo','wie','welche','wann','ist','sind','kann','haben','zeig','gibt','ich','ein','eine','der','die','das','und','oder','nicht','hier','mit','für','von','strand','meer','insel','boot','wetter']))
    return 'de';
  return 'hr';
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
  }
};

// ===== DETEKCIJA KATEGORIJE IZ PORUKE =====
function detectCategory(msg, lastCategory) {
  const m = msg.toLowerCase();

  if (m.includes('plaža') || m.includes('plaze') || m.includes('plaže') || m.includes('plaža') || m.includes('kupanje') || m.includes('kupat') || m.includes('dražica') || m.includes('soline') || m.includes('bošana') || m.includes('kumenat') || m.includes('fkk') || m.includes('nudist') || m.includes('pješčan') || m.includes('sunčan') || m.includes('sunbath') || m.includes('more je') || m.includes('lijeva ruka') || m.includes('plivat')
    || m.includes('beach') || m.includes('swim') || m.includes('sunbathe') || m.includes('sand')
    || m.includes('strand') || m.includes('schwimmen') || m.includes('badestrand'))
    return 'plaze';

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

  if (m.includes('događaj') || m.includes('dogadaj') || m.includes('festival') || m.includes('boat show') || m.includes('manifestac') || m.includes('program') || m.includes('što se događa') || m.includes('što ima') || m.includes('ribarska večer') || m.includes('krešimir') || m.includes('ljetna zabava') || m.includes('koncerti')
    || m.includes('event') || m.includes('festival') || m.includes('what\'s on') || m.includes('boat show') || m.includes('upcoming') || m.includes('celebration')
    || m.includes('veranstaltung') || m.includes('fest') || m.includes('bootsmesse'))
    return 'dogadanja';

  if (m.includes('parking') || m.includes('parkir') || m.includes('trajekt') || m.includes('autobus') || m.includes('ljekar') || m.includes('bolnic') || m.includes('hitna') || m.includes('bankomat') || m.includes('banka') || m.includes('taksi') || m.includes('prijevoz') || m.includes('rent a car') || m.includes('wifi') || m.includes('euro') || m.includes('valuta') || m.includes('info') || m.includes('radno vrij')
    || m.includes('parking') || m.includes('pharmacy') || m.includes('hospital') || m.includes('atm') || m.includes('bank') || m.includes('taxi') || m.includes('bus') || m.includes('transport') || m.includes('rent a car') || m.includes('currency') || m.includes('practical')
    || m.includes('parkplatz') || m.includes('apotheke') || m.includes('bank') || m.includes('taxi') || m.includes('bus'))
    return 'prakticno';

  if (m.includes('povijest') || m.includes('histori') || m.includes('o biogradu') || m.includes('o gradu') || m.includes('osnovan') || m.includes('prijestolnica') || m.includes('krešimir') || m.includes('kresimir') || m.includes('zanimljiv') || m.includes('populacij') || m.includes('stanovnic') || m.includes('geografij')
    || m.includes('history') || m.includes('about') || m.includes('general') || m.includes('population') || m.includes('founded') || m.includes('capital') || m.includes('medieval')
    || m.includes('geschichte') || m.includes('über') || m.includes('einwohner') || m.includes('hauptstadt'))
    return 'opcenito';

  if (lastCategory && CATEGORY_CONTEXTS[lastCategory])
    return lastCategory;

  return null;
}

// ===== SUGESTIJE PO KATEGORIJI =====
function getSuggestions(category, lang) {
  const map = {
    hr: {
      plaze:       ['⛵ Izlet na Kornate?', '🤿 Ronjenje u Biogradu?', '🏨 Smještaj blizu plaže?'],
      gastronomija:['🐟 Kakva je lokalna riba?', '🍷 Preporuči konobu s pekarom?', '🏖 Plaže Biograda?'],
      nautika:     ['⚓ Koliko košta charter?', '🏝 Kornati izletom?', '🏖 Plaže za kupanje?'],
      smjestaj:    ['🏖 Koje plaže su blizu?', '🐟 Gdje jesti u Biogradu?', '⛵ Izlet na Kornate?'],
      kornati:     ['⛵ Kako doći do Kornata?', '🐟 Konobe na otocima?', '🤿 Ronjenje na Kornatima?'],
      izleti:      ['🏛️ Zadar — što vidjeti?', '🌊 Vransko jezero izlet?', '⛵ Kornati brodom?'],
      sport:       ['🏖 Plaže za windsurfing?', '🚴 Biciklizam oko Vranskog jezera?', '⛵ Nautika u Biogradu?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Ljetne manifestacije?', '🎶 Koncerti na rivi?'],
      opcenito:    ['🏖 Plaže Biograda?', '⛵ Izlet na Kornate?', '🐟 Dalmatinska gastronomija?'],
      prakticno:   ['🚌 Prijevoz do Zadra?', '⛽ Benzinska postaja?', '🏥 Liječnik u Biogradu?'],
    },
    en: {
      plaze:       ['⛵ Kornati day trip?', '🤿 Diving in Biograd?', '🏨 Accommodation near beach?'],
      gastronomija:['🐟 Best local fish dishes?', '🍷 Recommend a konoba?', '🏖 Biograd beaches?'],
      nautika:     ['⚓ How much is a charter?', '🏝 Kornati excursion?', '🏖 Best beaches nearby?'],
      smjestaj:    ['🏖 Beaches nearby?', '🐟 Where to eat?', '⛵ Kornati excursion?'],
      kornati:     ['⛵ How to reach Kornati?', '🐟 Taverns on islands?', '🤿 Snorkeling spots?'],
      izleti:      ['🏛️ What to see in Zadar?', '🌊 Lake Vrana trip?', '⛵ Kornati by boat?'],
      sport:       ['🏖 Windsurfing beaches?', '🚴 Cycling around Lake Vrana?', '⛵ Boat rental?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Summer events?', '🎶 Concerts on the waterfront?'],
      opcenito:    ['🏖 Biograd beaches?', '⛵ Kornati trip?', '🐟 Dalmatian food?'],
      prakticno:   ['🚌 Bus to Zadar?', '⛽ Petrol station?', '🏥 Doctor in Biograd?'],
    },
    de: {
      plaze:       ['⛵ Ausflug zu den Kornaten?', '🤿 Tauchen in Biograd?', '🏨 Unterkunft am Strand?'],
      gastronomija:['🐟 Lokale Fischspezialitäten?', '🍷 Konoba empfehlen?', '🏖 Strände von Biograd?'],
      nautika:     ['⚓ Charterpreise?', '🏝 Kornaten-Ausflug?', '🏖 Beste Strände?'],
      smjestaj:    ['🏖 Strände in der Nähe?', '🐟 Wo essen?', '⛵ Kornaten-Ausflug?'],
      kornati:     ['⛵ Wie erreicht man die Kornaten?', '🐟 Tavernen auf den Inseln?', '🤿 Schnorcheln?'],
      izleti:      ['🏛️ Was in Zadar sehen?', '🌊 Vranasee-Ausflug?', '⛵ Kornaten mit Boot?'],
      sport:       ['🏖 Windsurfing-Strände?', '🚴 Radtour am Vranasee?', '⛵ Bootsverleih?'],
      dogadanja:   ['⛵ Biograd Boat Show?', '🏖 Sommerveranstaltungen?', '🎶 Konzerte am Kai?'],
      opcenito:    ['🏖 Strände von Biograd?', '⛵ Kornaten-Ausflug?', '🐟 Dalmatinische Küche?'],
      prakticno:   ['🚌 Bus nach Zadar?', '⛽ Tankstelle?', '🏥 Arzt in Biograd?'],
    }
  };
  return (map[lang] || map.hr)[category] || [];
}

// ===== IMAGE PROXY — zaobilazi hotlink protection =====
// Wikimedia uvijek radi izravno; sve ostalo ide kroz wsrv.nl proxy
function proxyImg(url) {
  if (!url) return '';
  if (url.includes('upload.wikimedia.org') || url.includes('commons.wikimedia.org')) return url;
  return 'https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=200&h=150&fit=cover&output=jpg&errorredirect=https%3A%2F%2Fupload.wikimedia.org%2Fwikipedia%2Fcommons%2F5%2F51%2FKornati.jpg';
}

// ===== ITEM KARTICE — uzima sve dostupne podatke iz baze =====
function item(o, extra = {}) {
  return {
    naziv:           o.naziv || '',
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

// Filtrira listu po ključnim riječima iz poruke — ako nema podudaranja, vraća sve
function filterByMessage(lista, msg) {
  if (!msg) return lista;
  const m = msg.toLowerCase();
  const matched = lista.filter(it => {
    // Uzmi značajne riječi iz naziva (dulje od 3 slova, bez zvjezdica/simbola)
    const words = it.naziv.toLowerCase().replace(/[★✓\-\/,\.]+/g, ' ').split(/\s+/).filter(w => w.length > 3);
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
    const svi = (db.gastronomija?.restorani || []).map(r => item(r, { adresa: r.tip || '' }));
    return filterByMessage(svi, message);
  }
  if (category === 'nautika') {
    const marina = db.nautika?.marina;
    return marina ? [item(marina, { adresa: marina.adresa || '' })] : [];
  }
  if (category === 'smjestaj') {
    const hoteli  = (db.smjestaj?.hoteli  || []).map(h => item(h));
    const kampovi = (db.smjestaj?.kampovi || []).map(k => item(k));
    return filterByMessage([...hoteli, ...kampovi], message);
  }
  if (category === 'kornati') {
    const k = db.kornati;
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
  if (category === 'dogadanja') {
    return (db.dogadanja?.eventi || []).map(e => item(e, { adresa: e.termin || '' }));
  }
  return [];
}

// ===== SYSTEM PROMPT =====
function buildSystemPrompt(lang, context, weatherCtx) {
  const weatherNote = weatherCtx?.temperature != null
    ? `\nAKTUALNO STANJE: Temperatura zraka ${weatherCtx.temperature}°C, vjetar ${weatherCtx.windspeed} km/h${weatherCtx.sea_temp != null ? `, temperatura mora ${weatherCtx.sea_temp}°C` : ''}${weatherCtx.wave_height != null ? `, visina vala ${weatherCtx.wave_height} m` : ''}.`
    : '';

  const langNote = lang === 'en'
    ? 'IMPORTANT: The user writes in English — respond ONLY in English.'
    : lang === 'de'
    ? 'WICHTIG: Der Nutzer schreibt auf Deutsch — antworte NUR auf Deutsch.'
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
${weatherNote}

TURISTIČKI PROFILI POSJETITELJA:
- Nautičari (charter, jedriličari, motorni brodovi)
- Obiteljski turisti (plaže, animacija, kampovi)
- Aktivni turisti (ronjenje, windsurfing, kayak, biciklizam)
- Gastronomski turisti
- Izletnici (Kornati, Zadar, NP Krka)

SEZONALNE NAPOMENE (uvijek naglasi!):
- Srpanj/kolovoz: gužve, obavezna rezervacija 3–4 mj. unaprijed, visoke cijene
- Rujan: IDEALAN termin — more toplo (24°C+), manje gužve, povoljnije cijene
- Lipanj: početak sezone, sve radi, manje gužvi
- Van sezone (lista–svibanj): mnogi restorani i sadržaji zatvoreni

TEMPERATURA MORA (ljeto): 24–27°C (srpanj–kolovoz)

SPECIFIČNI SAVJETI:
- Za NP Kornati: izlet brodom iz Biograda (8–10 sati, ~50–80 EUR), ili charter brod
- Peka: naručiti 2+ sata unaprijed
- Parking: u sezoni naplaćen, centar gust — preporuči dolazak ujutro
- Trajekt na Pašman: svakodnevno iz Biograda, 10 min vožnje — mirno okruženje
- Vransko jezero: kružna biciklistička ruta 32 km — idealno za aktivne turiste

KONTAKT TZ Biograd na Moru:
${db.grad.adresa_tz} | Tel: ${db.grad.telefon_tz} | ${db.grad.web_tz}

BAZA PODATAKA (koristi ove informacije):
${JSON.stringify(context, null, 0).substring(0, 6000)}

PRAVILA ODGOVARANJA:
- Odgovori na jeziku na kojem korisnik piše (hr/en/de)
- Budi konkretan i praktičan — turisti žele akcijske informacije
- Uvijek naglasi sezonalnost kada je relevantno
- Za preporuke smještaja/restorana napomeni da se rezervacija preporuča unaprijed
- Temperatura mora je važan podatak — navedi je kada je relevantno za korisnika

KLJUČNO PRAVILO — KARTICE:
Kada korisnik pita za restorane, smještaj, plaže, hotele, kampove, izlete ili atrakcije,
sustav će automatski prikazati vizualne kartice sa slikama, linkovima i recenzijama.
ZBOG TOGA: u svom tekstu NEMOJ nabrajati ni ponavljati te objekte u obliku liste!
Napiši samo kratki uvodni tekst (1-4 rečenice) s kontekstom, savjetom ili napomenom,
a kartice sa svim detaljima prikazat će se automatski ispod tvog teksta.
ZABRANJEN FORMAT (nemoj ovako): "1. Konoba Kampanel — ...\n2. Restoran Dupin — ..."
ISPRAVAN FORMAT: "Biograd ima izvrsnu ponudu svježe ribe i plodova mora. Preporuča se rezervacija unaprijed u sezoni."`;

}

// ===== GLAVNI HANDLER =====
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, history = [], category: lastCategory, weather } = req.body || {};

  // Warmup ping
  if (message === '__warmup__') {
    return res.status(200).json({ reply: 'ok' });
  }

  if (!message?.trim()) {
    return res.status(400).json({ error: 'No message' });
  }

  try {
    const lang = detectLang(message);
    const detectedCategory = detectCategory(message, lastCategory);
    const ctxFn = detectedCategory ? CATEGORY_CONTEXTS[detectedCategory] : null;
    const context = ctxFn ? ctxFn(db) : { grad: db.grad, opcenito: db.opcenito };

    const systemPrompt = buildSystemPrompt(lang, context, weather);

    // Poruke za OpenAI (do 10 prethodnih)
    const messages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10),
      { role: 'user', content: message }
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      temperature: 0.4,
      max_tokens: 800
    });

    const reply = completion.choices[0]?.message?.content || '';
    const suggestions = getSuggestions(detectedCategory || 'opcenito', lang);
    const items = getCategoryItems(detectedCategory, message);

    return res.status(200).json({
      reply,
      category: detectedCategory,
      suggestions,
      items
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
