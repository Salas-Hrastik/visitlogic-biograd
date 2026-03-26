// api/weather.js — Aktualno vrijeme + 5-dnevna prognoza + temperatura mora za Biograd na Moru

const WMO_ICONS = {
  0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️',
  45:'🌫️', 48:'🌫️',
  51:'🌦️', 53:'🌦️', 55:'🌦️',
  61:'🌧️', 63:'🌧️', 65:'🌧️',
  71:'❄️', 73:'❄️', 75:'❄️', 77:'❄️',
  80:'🌦️', 81:'🌦️', 82:'🌦️',
  85:'❄️', 86:'❄️',
  95:'⛈️', 96:'⛈️', 99:'⛈️'
};

const WMO_DESC = {
  0:'vedro', 1:'pretežno vedro', 2:'djelomično oblačno', 3:'oblačno',
  45:'maglovito', 48:'maglovito',
  51:'slaba kiša', 53:'kiša', 55:'jača kiša',
  61:'slaba kiša', 63:'kiša', 65:'jaka kiša',
  71:'slabi snijeg', 73:'snijeg', 75:'jači snijeg', 77:'snježne pahulje',
  80:'pljuskovi', 81:'pljuskovi', 82:'jaki pljuskovi',
  85:'snježni pljuskovi', 86:'jači snježni pljuskovi',
  95:'grmljavina', 96:'grmljavina s gradom', 99:'jaka grmljavina'
};

const DAYS_HR = ['nedjelja','ponedjeljak','utorak','srijeda','četvrtak','petak','subota'];
const MONTHS_HR = ['siječnja','veljače','ožujka','travnja','svibnja','lipnja','srpnja','kolovoza','rujna','listopada','studenog','prosinca'];

// Biograd na Moru — koordinate
const LAT = 43.9397;
const LNG = 15.4455;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=600');

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);

    // Dohvati atmosfersko vrijeme i morsku temperaturu paralelno
    const [weatherRes, marineRes] = await Promise.allSettled([
      fetch(
        'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${LAT}&longitude=${LNG}` +
        '&current_weather=true' +
        '&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max' +
        '&wind_speed_unit=kmh&timezone=Europe%2FZagreb&forecast_days=6',
        { signal: ctrl.signal }
      ),
      fetch(
        'https://marine-api.open-meteo.com/v1/marine' +
        `?latitude=${LAT}&longitude=${LNG}` +
        '&current=sea_surface_temperature,wave_height' +
        '&timezone=Europe%2FZagreb',
        { signal: ctrl.signal }
      )
    ]);

    clearTimeout(timer);

    if (weatherRes.status === 'rejected' || !weatherRes.value.ok)
      throw new Error('Weather API failed');

    const d = await weatherRes.value.json();
    const w = d.current_weather;
    const daily = d.daily;

    // Temperatura mora
    let seaTemp = null;
    let waveHeight = null;
    if (marineRes.status === 'fulfilled' && marineRes.value.ok) {
      try {
        const m = await marineRes.value.json();
        seaTemp = m.current?.sea_surface_temperature != null
          ? Math.round(m.current.sea_surface_temperature)
          : null;
        waveHeight = m.current?.wave_height != null
          ? Math.round(m.current.wave_height * 10) / 10
          : null;
      } catch {}
    }

    // Prognoza za sljedećih 5 dana
    const forecast = (daily.time || []).slice(0, 6).map((date, i) => {
      const dt = new Date(date);
      return {
        datum: date,
        dan:   DAYS_HR[dt.getDay()],
        tmax:  Math.round(daily.temperature_2m_max[i]),
        tmin:  Math.round(daily.temperature_2m_min[i]),
        icon:  WMO_ICONS[daily.weathercode[i]] || '🌡️',
        opis:  WMO_DESC[daily.weathercode[i]] || '',
        kisa:  daily.precipitation_probability_max?.[i] ?? null
      };
    });

    const now = new Date();
    const datumHR = `${now.getDate()}. ${MONTHS_HR[now.getMonth()]} ${now.getFullYear()}.`;
    const danHR   = DAYS_HR[now.getDay()];

    return res.status(200).json({
      temperature: Math.round(w.temperature),
      windspeed:   Math.round(w.windspeed),
      icon:        WMO_ICONS[w.weathercode] || '🌡️',
      opis:        WMO_DESC[w.weathercode] || '',
      sea_temp:    seaTemp,
      wave_height: waveHeight,
      datum:       datumHR,
      dan:         danHR,
      forecast
    });

  } catch (err) {
    console.error('Weather error:', err.message);
    const now = new Date();
    return res.status(200).json({
      temperature: null, windspeed: null, icon: '🌡️', opis: '',
      sea_temp: null, wave_height: null,
      datum: `${now.getDate()}. ${MONTHS_HR[now.getMonth()]} ${now.getFullYear()}.`,
      dan: DAYS_HR[now.getDay()],
      forecast: []
    });
  }
}
