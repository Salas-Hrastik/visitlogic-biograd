// Cijene i radno vrijeme benzinskih postaja (Biograd i Petrol Pakoštane).
// Generira ~/.claude/scheduled-tasks/biograd-menus-monthly-2/scripts/update_fuel.py iz službene tražilice mzoe-gor.hr.
// Ne uređivati ručno: mjesečna provjera prepisuje datoteku.
export const fuel = {
 "izvor": "https://mzoe-gor.hr/",
 "provjereno": "6.11.2026.",
 "postaje": {
  "INA Biograd — Magistrala (0–24)": {"url": "https://mzoe-gor.hr/383-ina-industrija-nafte-d-d-biograd-na-moru-magistrala", "radno": "00:00–24:00", "cijene": [["Eurosuper 95", 1.69], ["Eurosuper 95 Premium", 1.84], ["Eurosuper 100", 2.23], ["Eurodizel", 1.89], ["Eurodizel Premium", 2.14]]},
  "INA Biograd — Obala": {"url": "https://mzoe-gor.hr/376-ina-industrija-nafte-d-d-biograd-na-moru-obala", "radno": "07:00–19:00", "cijene": [["Eurosuper 95", 1.69], ["Eurodizel", 1.89], ["Eurodizel Premium", 2.14], ["Plavi dizel", 1.45]]},
  "INA Biograd — Zagrebačka": {"url": "https://mzoe-gor.hr/384-ina-industrija-nafte-d-d-biograd-na-moru-zagrebacka", "radno": "07:00–19:00", "cijene": [["Eurosuper 95", 1.69], ["Eurodizel", 1.89], ["Eurodizel Premium", 2.14]]},
  "Petrol Pakoštane — autoplin (oko 7 km)": {"url": "https://mzoe-gor.hr/771-petrol-d-o-o-pm-pakostane", "radno": "06:00–22:00", "cijene": [["Eurosuper 95", 1.69], ["Eurosuper 100", 2.26], ["Eurodizel", 1.89], ["Q Max Eurodizel", 2.17], ["Autoplin", 1.09]]}
 }
};
