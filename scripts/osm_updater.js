// scripts/osm_updater.js
// Tjedni updater — dohvaća nova i promijenjena mjesta iz OpenStreetMap-a
// za Biograd na Moru i uspoređuje s postojećom bazom (_database.js)
// Izlaz: update_report.md (commit u GitHub → pregled novih mjesta)

import { db } from '../api/_database.js';
import { writeFileSync, readFileSync, existsSync } from 'fs';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const TODAY = new Date().toISOString().split('T')[0];
const SNAPSHOT_PATH = './data/osm_snapshot.json';

// ─── Overpass API upit ────────────────────────────────────────────────────────
const QUERY = `
[out:json][timeout:30];
area["name"="Biograd na Moru"]["admin_level"="8"]->.grad;
(
  node["amenity"~"restaurant|cafe|bar|fast_food|pub|nightclub|ice_cream"](area.grad);
  way["amenity"~"restaurant|cafe|bar|fast_food|pub|nightclub|ice_cream"](area.grad);
  node["tourism"~"hotel|camp_site|apartment|hostel|guest_house|attraction|museum|gallery|viewpoint"](area.grad);
  way["tourism"~"hotel|camp_site|apartment|hostel|guest_house|attraction|museum|gallery|viewpoint"](area.grad);
  node["leisure"~"beach_resort|marina|sports_centre|fitness_centre|water_park"](area.grad);
  way["leisure"~"beach_resort|marina|sports_centre|fitness_centre|water_park"](area.grad);
  node["shop"~"supermarket|bakery|butcher|seafood|dive"](area.grad);
);
out body;
`;

// ─── Dohvati OSM podatke ──────────────────────────────────────────────────────
async function fetchOSM() {
  console.log('🌐 Dohvaćam podatke s Overpass API-ja...');
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Accept': '*/*',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'visitlogic-biograd-bot/1.0 (tourism chatbot; contact: info@visitlogic.hr)'
    },
    body: `data=${encodeURIComponent(QUERY)}`
  });
  if (!res.ok) throw new Error(`Overpass greška: ${res.status}`);
  return res.json();
}

// ─── Normalizacija OSM elemenata ──────────────────────────────────────────────
function normalizePOIs(data) {
  return data.elements
    .filter(el => el.tags?.name)
    .map(el => ({
      osm_id:   String(el.id),
      naziv:    el.tags.name,
      tip:      el.tags.amenity || el.tags.tourism || el.tags.leisure || el.tags.shop || 'ostalo',
      adresa:   [el.tags['addr:street'], el.tags['addr:housenumber']].filter(Boolean).join(' '),
      telefon:  el.tags.phone || el.tags['contact:phone'] || '',
      web:      el.tags.website || el.tags['contact:website'] || '',
      radno:    el.tags.opening_hours || '',
      cuisine:  el.tags.cuisine || '',
      stars:    el.tags.stars || '',
      osm_url:  `https://www.openstreetmap.org/${el.type || 'node'}/${el.id}`
    }));
}

// ─── Sva postojeća imena iz _database.js ─────────────────────────────────────
function getExistingNames() {
  const names = new Set();
  const add = arr => (arr || []).forEach(x => x?.naziv && names.add(x.naziv.toLowerCase().trim()));

  add(db.gastronomija?.restorani);
  add(db.gastronomija?.nocni_zivot);
  add(db.smjestaj?.hoteli);
  add(db.smjestaj?.vile_i_posebni);
  add(db.smjestaj?.kampovi);
  add(db.smjestaj?.pansioni);
  add(db.atrakcije?.objekti);
  add(db.plaze);
  add(db.nautika?.charter_agencije);
  add(db.izleti?.destinacije);
  add(db.sport?.aktivnosti);
  return names;
}

// ─── Prijevod kategorija ──────────────────────────────────────────────────────
const CATEGORY_HR = {
  restaurant:     '🍽️ Restoran',
  cafe:           '☕ Kafić',
  bar:            '🍸 Bar',
  pub:            '🍺 Pub',
  fast_food:      '🍔 Brza hrana',
  nightclub:      '🎵 Noćni klub',
  ice_cream:      '🍦 Sladoled',
  hotel:          '🏨 Hotel',
  guest_house:    '🏠 Pansion',
  hostel:         '🛏️ Hostel',
  camp_site:      '⛺ Kamp',
  apartment:      '🏢 Apartman',
  attraction:     '🎯 Atrakcija',
  museum:         '🏛️ Muzej',
  gallery:        '🖼️ Galerija',
  viewpoint:      '👁️ Vidikovac',
  beach_resort:   '🏖️ Plaža',
  marina:         '⚓ Marina',
  sports_centre:  '🏋️ Sportski centar',
  fitness_centre: '💪 Fitness',
  water_park:     '💧 Vodeni park',
  supermarket:    '🛒 Supermarket',
  bakery:         '🥖 Pekara',
  dive:           '🤿 Ronilački centar',
  ostalo:         '📍 Ostalo'
};

// ─── Usporedi s prethodnim snapshotom (detekcija promjena) ────────────────────
function loadSnapshot() {
  if (!existsSync(SNAPSHOT_PATH)) return {};
  try {
    return JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8'));
  } catch { return {}; }
}

function buildSnapshotMap(pois) {
  const map = {};
  pois.forEach(p => { map[p.osm_id] = p; });
  return map;
}

// ─── Generiraj Markdown izvještaj ─────────────────────────────────────────────
function generateReport(nova, izmijenjena, uklonjena) {
  let md = `# 🗺️ OSM Tjedni Update — Biograd na Moru\n`;
  md += `**Datum:** ${TODAY}\n\n`;

  if (nova.length === 0 && izmijenjena.length === 0 && uklonjena.length === 0) {
    md += `✅ **Nema promjena** — baza je aktualna.\n`;
    return md;
  }

  md += `| Kategorija | Broj |\n|---|---|\n`;
  if (nova.length)      md += `| 🆕 Nova mjesta       | **${nova.length}** |\n`;
  if (izmijenjena.length) md += `| ✏️ Izmijenjeni podaci | **${izmijenjena.length}** |\n`;
  if (uklonjena.length) md += `| ❌ Uklonjeno iz OSM  | **${uklonjena.length}** |\n`;
  md += '\n---\n\n';

  // Nova mjesta
  if (nova.length > 0) {
    // Grupiraj po tipu
    const byType = {};
    nova.forEach(p => {
      const cat = CATEGORY_HR[p.tip] || `📍 ${p.tip}`;
      if (!byType[cat]) byType[cat] = [];
      byType[cat].push(p);
    });

    md += `## 🆕 Nova mjesta (${nova.length})\n\n`;
    for (const [tip, items] of Object.entries(byType)) {
      md += `### ${tip}\n\n`;
      items.forEach(p => {
        md += `**${p.naziv}**\n`;
        if (p.adresa)   md += `- 📍 ${p.adresa}\n`;
        if (p.telefon)  md += `- 📞 ${p.telefon}\n`;
        if (p.web)      md += `- 🌐 ${p.web}\n`;
        if (p.radno)    md += `- 🕐 ${p.radno}\n`;
        if (p.cuisine)  md += `- 🍴 Kuhinja: ${p.cuisine}\n`;
        md += `- 🗺️ [OpenStreetMap](${p.osm_url})\n\n`;
      });
    }
  }

  // Izmijenjeni podaci
  if (izmijenjena.length > 0) {
    md += `## ✏️ Izmijenjeni podaci (${izmijenjena.length})\n\n`;
    izmijenjena.forEach(({ staro, novo }) => {
      md += `**${novo.naziv}**\n`;
      const fields = ['adresa','telefon','web','radno'];
      fields.forEach(f => {
        if (staro[f] !== novo[f] && (staro[f] || novo[f])) {
          md += `- ${f}: ~~${staro[f] || '—'}~~ → **${novo[f] || '—'}**\n`;
        }
      });
      md += `- 🗺️ [OpenStreetMap](${novo.osm_url})\n\n`;
    });
  }

  // Uklonjena mjesta
  if (uklonjena.length > 0) {
    md += `## ❌ Uklonjeno iz OSM (${uklonjena.length})\n\n`;
    md += `> Ova mjesta više ne postoje u OpenStreetMap-u — provjeri jesu li i fizički zatvorena.\n\n`;
    uklonjena.forEach(p => {
      md += `- **${p.naziv}** (${CATEGORY_HR[p.tip] || p.tip})\n`;
    });
    md += '\n';
  }

  md += `---\n*Generirano automatski — [osm_updater.js](./scripts/osm_updater.js)*\n`;
  return md;
}

// ─── Glavni tok ───────────────────────────────────────────────────────────────
async function main() {
  const data      = await fetchOSM();
  const pois      = normalizePOIs(data);
  const existing  = getExistingNames();
  const prevSnap  = loadSnapshot();
  const currSnap  = buildSnapshotMap(pois);

  console.log(`📦 OSM objekti pronađeni: ${pois.length}`);

  // 1. Nova mjesta (nisu u _database.js i nisu bila u prethodnom snapshotu)
  const nova = pois.filter(p =>
    !existing.has(p.naziv.toLowerCase().trim()) &&
    !prevSnap[p.osm_id]
  );

  // 2. Izmijenjeni podaci (postojeći OSM ID, ali drugačiji podaci)
  const izmijenjena = [];
  pois.forEach(p => {
    const prev = prevSnap[p.osm_id];
    if (!prev) return;
    const changed = ['adresa','telefon','web','radno'].some(f => prev[f] !== p[f]);
    if (changed) izmijenjena.push({ staro: prev, novo: p });
  });

  // 3. Uklonjena iz OSM (bila su u snapshotu, sada ih nema)
  const currIds   = new Set(pois.map(p => p.osm_id));
  const uklonjena = Object.values(prevSnap).filter(p => !currIds.has(p.osm_id));

  // Spremi novi snapshot
  writeFileSync(SNAPSHOT_PATH, JSON.stringify(currSnap, null, 2));
  console.log(`💾 Snapshot spremljen: ${pois.length} objekata`);

  // Generiraj izvještaj
  const report = generateReport(nova, izmijenjena, uklonjena);
  writeFileSync('update_report.md', report);

  // Ispis sažetka
  if (nova.length === 0 && izmijenjena.length === 0 && uklonjena.length === 0) {
    console.log('✅ Nema promjena.');
  } else {
    console.log(`📝 Izvještaj: ${nova.length} nova, ${izmijenjena.length} izmijenjena, ${uklonjena.length} uklonjena`);
    console.log('   → update_report.md');
  }
}

main().catch(err => {
  console.error('❌ Greška:', err.message);
  process.exit(1);
});
