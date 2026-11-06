// Autobusni prijevoz iz Biograda.
// Prigradske linije: Liburnija Zadar, https://liburnija-zadar.hr/prigradski-prijevoz/ (PDF-ovi linija 120 i 129/130).
// Međugradske: FlixBus (https://www.flixbus.hr/autobus/biograd) i Arriva (vozni red na arriva.com.hr). Provjereno 6.11.2026.
// Polazak s '°' ne vozi za vrijeme školskih praznika (23.06.–02.09.).

export const buses = {
  provjereno: '6.11.2026.',
  kolodvor: { naziv: 'Autobusni kolodvor Biograd', adresa: 'Trg hrvatskih velikana 19, Biograd na Moru', telefon: '+385 60 350 350' },
  linija_120: {
    naziv: 'Liburnija 120 Zadar – Biograd (preko Sukošana, Sv. Filipa i Jakova)',
    vrijedi_od: '21.10.2024.',
    izvor: 'https://liburnija-zadar.hr/wp-content/uploads/2024/10/BIOGRAD-bez-skole-1.pdf',
    telefon: '+385 60 305 305',
    skolski_praznici: ['23.06.', '02.09.'],
    iz_biograda: {
      radni: ['04:50', '05:50', '06:30', '07:00', '07:45', '08:40', '09:30', '11:40', '12:30', '13:00', '13:30°', '14:10', '15:20', '16:00', '16:45', '18:30', '19:15°', '20:15'],
      subota: ['05:50', '07:00', '07:45', '08:40', '12:30', '14:10', '15:20'],
    },
    iz_zadra: {
      radni: ['05:20', '06:20', '07:10', '08:30', '09:45', '10:30', '10:45', '11:30', '11:45°', '12:20', '12:50', '13:30', '13:50°', '14:20', '15:20', '16:20', '18:20', '19:30', '19:50°', '20:30'],
      subota: ['06:20', '07:15', '11:30', '12:50', '13:30', '14:20', '15:20'],
    },
    nedjelja_blagdan: 'ne vozi',
  },
  pakostane: 'Dio polazaka linije 120 iz Zadra nastavlja preko Biograda do Crvene Luke i Pakoštana (vozni red od 5.6.2025.: https://liburnija-zadar.hr/wp-content/uploads/2025/08/PAKOSTANE-bez-skole.pdf).',
  lokalne: 'Lokalne linije 129 Biograd – Drage i 130 Biograd – Sikovo – Veterinci (Liburnija, vozni red od 6.9.2021., moguće zastario): iz Biograda prema Dragama radnim danom 06:00, 12:15, 15:00, 21:05; prema Raštanima Gornjim radnim danom 10:30, 14:15, 20:15, subotom 14:15.',
  medugradske: 'Međugradske i međunarodne linije (FlixBus, Arriva/Autotrans i drugi) staju na autobusnom kolodvoru (Trg hrvatskih velikana) i na stajalištu kod motela na Jadranskoj magistrali. Izravne veze FlixBusa uključuju Zagreb, Zadar, Split, Šibenik, Trogir, Makarsku, Dubrovnik, Rijeku, Ljubljanu, Maribor, Beč i Beograd. Vozni red i karte: flixbus.hr i arriva.com.hr; polasci ovise o sezoni.',
};
