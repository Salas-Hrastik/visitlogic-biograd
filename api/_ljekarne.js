// Radno vrijeme ljekarni u Biogradu i noćna dežurna ljekarna u Zadru.
// Izvori (provjereno 6.11.2026.): ljekarnesvaljek.com/o-nama/ljekarne, ljekarne-joukhadar.hr/ljekarne, ljekarna-zadar.hr/lokacije
// Službeni raspored dežurstava za Biograd nije objavljen: "dežurna" je ljekarna koja je otvorena nedjeljom i blagdanom.
// Sati su [od, do] u obliku "HH:MM"; razdoblja su "DD.MM." uključivo; zatvoreno su datumi "DD.MM.YYYY." (izvanredna zatvaranja vrijede samo za tu godinu).

export const pharmacies = {
  provjereno: '6.11.2026.',
  ljekarne: [
    {
      naziv: 'Ljekarna Švaljek — Obala (br. 1)',
      adresa: 'Obala kneza Branimira bb, Biograd na Moru',
      telefon: '023 385 111',
      izvor: 'https://www.ljekarnesvaljek.com/o-nama/ljekarne/',
      razdoblja: [
        { od: '07.09.', do: '28.06.', radni: ['07:00', '20:00'], subota: ['07:00', '20:00'], nedjelja: ['08:00', '14:00'], blagdan: ['08:00', '14:00'], osim_blagdana: ['božić', 'nova godina', 'uskrs'] },
        { od: '29.06.', do: '06.09.', radni: ['07:00', '21:00'], subota: ['07:00', '21:00'], nedjelja: ['08:00', '14:00'], blagdan: ['08:00', '14:00'] },
      ],
      zatvoreno: ['18.10.2026.', '01.11.2026.', '18.11.2026.', '26.12.2026.'],
    },
    {
      naziv: 'Ljekarna Švaljek — br. 2',
      adresa: 'Matije Ivanića 2, Biograd na Moru',
      telefon: '023 385 444',
      izvor: 'https://www.ljekarnesvaljek.com/o-nama/ljekarne/',
      razdoblja: [
        { od: '07.09.', do: '28.06.', radni: ['07:00', '20:00'], subota: ['08:00', '15:00'] },
        { od: '29.06.', do: '06.09.', radni: ['07:00', '21:00'], subota: ['08:00', '15:00'] },
      ],
      blagdan_nepoznat: true,
    },
    {
      naziv: 'Ljekarna Švaljek — Park&Shop (br. 3)',
      adresa: 'Žutska 1 (Park&Shop), Biograd na Moru',
      telefon: '023 385 042',
      izvor: 'https://www.ljekarnesvaljek.com/o-nama/ljekarne/',
      razdoblja: [
        { od: '01.09.', do: '31.05.', radni: ['07:30', '20:30'], subota: ['08:00', '20:00'], nedjelja_samo: { datumi: ['20.12.', '27.12.'], sati: ['09:00', '17:00'] } },
        { od: '01.06.', do: '31.08.', radni: ['07:30', '20:30'], subota: ['08:00', '20:00'], nedjelja: ['09:00', '17:00'], blagdan: ['09:00', '17:00'] },
      ],
      zatvoreno: ['01.11.2026.', '18.11.2026.', '26.12.2026.'],
      blagdan_nepoznat: true,
    },
    {
      naziv: 'Ljekarna Avicenna',
      adresa: 'Matije Ivanića 4, Biograd na Moru',
      telefon: '023 385 358',
      izvor: 'https://www.ljekarne-joukhadar.hr/ljekarne',
      razdoblja: [{ od: '01.01.', do: '31.12.', radni: ['07:00', '20:00'], subota: ['08:00', '13:00'] }],
      blagdan_nepoznat: true,
    },
  ],
  nocna: {
    naziv: 'Ljekarna Jadran — dežurna 0–24 (Zadar)',
    adresa: 'Put Murvice 2, Zadar (oko 30 km od Biograda)',
    telefon: '023 211 743',
    email: 'jadran@ljekarna-zadar.hr',
    izvor: 'https://ljekarna-zadar.hr/lokacije/',
    sati: 'non-stop, svaki dan 0–24',
  },
};
