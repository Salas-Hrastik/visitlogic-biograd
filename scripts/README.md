# Prijevod baze (unaprijed prevedene kartice)

Chatbot servira opise kartica na 8 jezika iz **unaprijed prevedene** datoteke
`api/_translations.js` — bez prijevoda u stvarnom vremenu (nula latencije).

## Kako generirati / osvježiti prijevode

```bash
OPENAI_API_KEY=sk-... node scripts/translate-db.mjs
```

- Prevodi polja: `opis`, `recenzija`, `tip`, `sadrzaji`, `pogodna_za`, `savjet`
- Jezici: en, de, sl, it, hu, cs, sk (hrvatski je izvor)
- **Idempotentno**: prevodi samo tekstove koji još nemaju prijevod — pa je jeftino
  ponovno pokrenuti kad scraper doda nove događaje/objekte.

Nakon pokretanja commitaj promijenjeni `api/_translations.js` i deployaj.

## Kada pokrenuti
- Jednom sada (prvi put)
- Nakon svakog većeg ažuriranja baze (npr. novi mjesečni program događanja)

Možeš dodati i u dnevni scrape zadatak (nakon ažuriranja baze) da se prijevodi
automatski dopunjuju.
