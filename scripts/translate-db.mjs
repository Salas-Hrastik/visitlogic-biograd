// Generira api/_translations.js — unaprijed prevedene tekstove kartica na 7 jezika.
// Pokretanje (jednom, ili kad scraper doda nove tekstove):
//   OPENAI_API_KEY=sk-... node scripts/translate-db.mjs
// Idempotentno: prevodi SAMO tekstove koji još nemaju prijevod.
//
// Zašto OpenAI: gpt-4o-mini je brz i jeftin za prijevod. Možete i drugi model.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from '../api/_database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'api', '_translations.js');

const KEY = process.env.OPENAI_API_KEY?.trim();
if (!KEY) { console.error('❌ Nedostaje OPENAI_API_KEY. Pokreni: OPENAI_API_KEY=sk-... node scripts/translate-db.mjs'); process.exit(1); }

const LANGS = { en:'English', de:'German', sl:'Slovenian', it:'Italian', hu:'Hungarian', cs:'Czech', sk:'Slovak' };
const TRANSLATE_FIELDS = new Set(['opis','recenzija','tip','sadrzaji','pogodna_za','savjet']);

// 1) Izvuci jedinstvene HR tekstove iz baze
function extract() {
  const set = new Set();
  (function walk(o){
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === 'object') {
      for (const [k,v] of Object.entries(o)) {
        if (TRANSLATE_FIELDS.has(k) && typeof v === 'string' && v.trim()) set.add(v.trim());
        else walk(v);
      }
    }
  })(db);
  return [...set];
}

// 2) Učitaj postojeće prijevode (da preskočimo već prevedeno)
async function loadExisting() {
  try {
    const mod = await import('../api/_translations.js?ts=' + Date.now());
    return mod.translations || {};
  } catch { return {}; }
}

// 3) Prevedi batch (jedan jezik) preko OpenAI API-ja
async function translateBatch(strings, langName) {
  const body = {
    model: 'gpt-4o-mini',
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [{
      role: 'user',
      content: `Translate these Croatian tourism texts to ${langName}. Return ONLY JSON {"t":["...","..."]} — an array of translations in the SAME ORDER and SAME COUNT (${strings.length}). Keep proper nouns (place/restaurant/event names) unchanged. Preserve surrounding quotation marks if present. Keep it natural and concise.\n\n${JSON.stringify(strings)}`
    }]
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KEY },
        body: JSON.stringify(body)
      });
      if (!r.ok) { console.warn(`   HTTP ${r.status}, pokušaj ${attempt+1}`); await new Promise(s=>setTimeout(s, 1500*(attempt+1))); continue; }
      const data = await r.json();
      const raw = data.choices?.[0]?.message?.content || '';
      const m = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(m ? m[0] : raw);
      const arr = parsed.t || parsed.translations || [];
      if (Array.isArray(arr) && arr.length === strings.length) return arr;
      console.warn(`   Neusklađen broj (${arr.length}/${strings.length}), pokušaj ${attempt+1}`);
    } catch (e) { console.warn(`   Greška: ${e.message}, pokušaj ${attempt+1}`); }
    await new Promise(s=>setTimeout(s, 1500*(attempt+1)));
  }
  return null; // ne uspije → preskoči batch
}

const CHUNK = 20;
function chunk(a, n){ const out=[]; for(let i=0;i<a.length;i+=n) out.push(a.slice(i,i+n)); return out; }

(async () => {
  const all = extract();
  console.log(`Jedinstvenih HR tekstova: ${all.length}`);
  const existing = await loadExisting();
  const result = {};
  for (const code of Object.keys(LANGS)) result[code] = { ...(existing[code] || {}) };

  for (const [code, name] of Object.entries(LANGS)) {
    const missing = all.filter(s => !result[code][s]);
    if (!missing.length) { console.log(`✓ ${code}: sve prevedeno (0 novih)`); continue; }
    console.log(`→ ${code} (${name}): prevodim ${missing.length} novih…`);
    const batches = chunk(missing, CHUNK);
    for (let i = 0; i < batches.length; i++) {
      const b = batches[i];
      const tr = await translateBatch(b, name);
      if (tr) b.forEach((src, j) => { result[code][src] = tr[j]; });
      process.stdout.write(`   batch ${i+1}/${batches.length}\r`);
    }
    console.log(`   ✓ ${code} gotovo` + ' '.repeat(20));
  }

  // 4) Zapiši _translations.js
  const header = `// Unaprijed prevedeni tekstovi kartica — generira scripts/translate-db.mjs.\n// Ključ = izvorni HRVATSKI tekst; vrijednost = prijevod. NE uređivati ručno.\nexport const translations = `;
  fs.writeFileSync(OUT, header + JSON.stringify(result, null, 0) + ';\n');
  const counts = Object.entries(result).map(([k,v]) => `${k}:${Object.keys(v).length}`).join(', ');
  console.log(`\n✅ Zapisano ${OUT}\n   Prijevoda po jeziku: ${counts}`);
})();
