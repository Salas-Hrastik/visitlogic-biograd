// Državna brodska linija 415 Vrgada – Pakoštane – Biograd, brodar Vrgada r.p.z.
// Izvor: "Plovidbeni red linija 415 Vrgada Pakoštane Biograd 2026" (PDF) na https://vrgada-rpz.hr/hr ; provjereno 8.11.2026.
// 31.8. nije pokriven ni jednim listom PDF-a. Ključevi polazaka: odakle_kamo. "radni" = ponedjeljak–subota, "nedjelja" = nedjelja (i blagdan gdje to piše u PDF-u).

export const vrgada = {
  linija: '415 Vrgada – Pakoštane – Biograd',
  operater: 'Vrgada r.p.z.',
  telefon: '+385 91 601 9153',
  email: 'info@vrgada-rpz.hr',
  godina: 2026,
  provjereno: '8.11.2026.',
  izvor: 'https://vrgada-rpz.hr/hr',
  napomena: 'Putnički brod (bez automobila; Vrgada nema prometa vozilima). Vožnja Vrgada–Pakoštane oko 20 minuta, Pakoštane–Biograd oko 30 minuta. Bicikl se plaća kao karta za osobu, kućni ljubimci besplatno, ručna prtljaga do 20 kg besplatno. Djeca 3–12 godina plaćaju pola cijene, do 3 godine besplatno.',
  razdoblja: [
    { od_do: [['01.09.', '28.09.']], blagdan_kao_nedjelja: false,
      radni: { vrgada_pakostane: ['06:00', '11:30', '13:00', '16:00', '18:00'], pakostane_vrgada: ['10:05', '12:00', '15:05', '16:30', '18:30'],
               pakostane_biograd: ['06:25', '13:25'], biograd_pakostane: ['09:30', '14:30'] },
      nedjelja: { vrgada_pakostane: ['10:30', '16:00', '18:00'], pakostane_vrgada: ['11:00', '16:30', '18:30'] } },
    { od_do: [['01.01.', '30.04.'], ['28.09.', '31.12.']], blagdan_kao_nedjelja: true,
      radni: { vrgada_pakostane: ['06:00', '11:30', '13:00', '17:00'], pakostane_vrgada: ['10:05', '12:00', '15:05', '17:30'],
               vrgada_biograd: ['06:00', '13:00'], biograd_vrgada: ['09:30', '14:30'],
               pakostane_biograd: ['06:25', '13:25'], biograd_pakostane: ['09:30', '14:30'] },
      nedjelja: { vrgada_pakostane: ['10:30', '17:00'], pakostane_vrgada: ['11:00', '17:30'] } },
    { od_do: [['01.05.', '28.05.']], blagdan_kao_nedjelja: true,
      radni: { vrgada_pakostane: ['06:00', '11:30', '13:00', '17:00'], pakostane_vrgada: ['10:05', '12:00', '15:05', '17:30'],
               vrgada_biograd: ['06:00', '13:00'], biograd_vrgada: ['09:30', '14:30'],
               pakostane_biograd: ['06:25', '13:25'], biograd_pakostane: ['09:30', '14:30'] },
      nedjelja: { vrgada_pakostane: ['10:30', '19:00'], pakostane_vrgada: ['11:00', '19:30'] } },
    { od_do: [['29.05.', '02.07.']], blagdan_kao_nedjelja: false,
      radni: { vrgada_pakostane: ['06:00', '11:30', '13:00', '17:00', '19:00'], pakostane_vrgada: ['10:05', '12:00', '15:05', '17:30', '19:30'],
               vrgada_biograd: ['06:00', '13:00'], biograd_vrgada: ['09:30', '14:30'],
               pakostane_biograd: ['06:25', '13:25'], biograd_pakostane: ['09:30', '14:30'] },
      nedjelja: { vrgada_pakostane: ['10:30', '17:00', '19:00'], pakostane_vrgada: ['11:00', '17:30', '19:30'] } },
    { od_do: [['03.07.', '30.08.']], blagdan_kao_nedjelja: false,
      radni: { vrgada_pakostane: ['06:00', '09:00', '10:20', '11:40', '13:00', '16:15', '18:00', '20:00'],
               pakostane_vrgada: ['08:10', '09:40', '11:00', '12:20', '15:10', '16:45', '18:30', '20:30'],
               vrgada_biograd: ['06:00', '13:00'], biograd_vrgada: ['07:30', '14:30'],
               pakostane_biograd: ['06:25', '13:25'], biograd_pakostane: ['07:30', '14:30'] },
      nedjelja: { vrgada_pakostane: ['09:00', '10:20', '11:40', '16:15', '18:00', '20:00'], pakostane_vrgada: ['09:40', '11:00', '12:20', '16:45', '18:30', '20:30'] } },
  ],
  // Odrasli, jednako u oba smjera.
  cjenik_sezonski_od_do: ['29.05.', '28.09.'],
  cjenik: [
    { relacija: 'Vrgada – Biograd', izvan: 2.90, sezona: 3.50 },
    { relacija: 'Vrgada – Pakoštane', izvan: 2.40, sezona: 3.20 },
    { relacija: 'Pakoštane – Biograd', izvan: 2.40, sezona: 3.20 },
  ],
};
