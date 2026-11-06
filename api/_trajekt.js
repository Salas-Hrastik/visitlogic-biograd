// Trajektna linija 432 Biograd na Moru – Tkon (Pašman), Jadrolinija.
// Izvor: "Privremeni red plovidbe za 2026. godinu" (PDF od 29.5.2026.) na
// https://www.jadrolinija.hr/hr/putovanje/biograd_-_tkon_pasman ; provjereno 6.11.2026.
// Oznake polazaka: '*' ne plovi nedjeljom i blagdanom; '**' ne plovi 01.01. i 25.12.;
// '***' plovi samo od 20.03. do 24.05., petkom, subotom, nedjeljom i blagdanom.

export const ferry = {
  linija: '432 Tkon (Pašman) – Biograd na Moru',
  operater: 'Jadrolinija',
  godina: 2026,
  provjereno: '6.11.2026.',
  izvor: 'https://www.jadrolinija.hr/hr/putovanje/biograd_-_tkon_pasman',
  napomena: 'Privremeni red plovidbe, podložan promjenama. Vožnja traje 15 minuta. Karta vrijedi cijeli dan i za druge polaske iste linije. Kućni ljubimci se ne naplaćuju.',
  sezone: [
    { naziv: 'izvansezona', razdoblja: [['01.01.', '28.05.'], ['28.09.', '31.12.']],
      biograd: ['06:00*', '07:00*', '08:00**', '09:00', '11:00', '12:30*', '14:30', '16:45', '18:40**', '20:10', '21:20***'],
      tkon: ['05:30*', '06:30*', '07:25**', '08:30', '09:30', '11:30*', '13:20', '16:20', '18:10**', '19:30', '21:00***'] },
    { naziv: 'niska sezona', razdoblja: [['29.05.', '02.07.'], ['31.08.', '27.09.']],
      biograd: ['06:00*', '07:00', '08:00*', '09:00', '10:00*', '11:00', '12:30', '14:30', '16:45', '18:40', '20:10', '21:20'],
      tkon: ['05:30*', '06:30', '07:25', '08:30*', '09:30', '10:30*', '11:30', '13:20', '16:20', '18:10', '19:30', '21:00'] },
    { naziv: 'visoka sezona', razdoblja: [['03.07.', '30.08.']],
      biograd: ['06:00', '07:00', '08:00', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:30', '13:40', '14:30', '15:45', '16:45', '17:45', '18:40', '20:00', '21:20', '22:30'],
      tkon: ['05:30', '06:30', '07:25', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:20', '14:05', '15:00', '16:20', '17:15', '18:10', '19:30', '21:00', '22:00'] },
  ],
  // Izvansezonski cjenik: 01.01.–28.05. i 28.09.–31.12.; sezonski: 29.05.–27.09. Cijena je ista u oba smjera.
  cjenik_sezonski_od_do: ['29.05.', '27.09.'],
  cjenik: [
    { stavka: 'odrasla osoba', izvan: 2.20, sezona: 3.50 },
    { stavka: 'dijete od 3 do 12 godina', izvan: 1.10, sezona: 1.70 },
    { stavka: 'osobni automobil do 5 m dužine i/ili 2 m visine', izvan: 10.40, sezona: 14.60 },
    { stavka: 'osobni automobil preko 5 m dužine i/ili 2 m visine', izvan: 14.90, sezona: 18.80 },
    { stavka: 'kamp kućica / kamper do 5 m', izvan: 14.90, sezona: 20.10 },
    { stavka: 'kamp kućica / kamper 5,01–7 m', izvan: 17.00, sezona: 22.60 },
    { stavka: 'kamp kućica / kamper preko 7 m', izvan: 22.50, sezona: 29.20 },
    { stavka: 'laka prikolica do 3 m', izvan: 7.00, sezona: 10.70 },
    { stavka: 'motocikl, moped', izvan: 4.60, sezona: 6.90 },
    { stavka: 'bicikl', izvan: 2.10, sezona: 3.30 },
    { stavka: 'autobus 10–17 sjedala', izvan: 32.90, sezona: 40.30 },
  ],
  djeca: 'Djeca do 3 godine besplatno (od 1 do 3 godine dobivaju kartu). Ručna prtljaga do 20 kg se ne naplaćuje.',
};
