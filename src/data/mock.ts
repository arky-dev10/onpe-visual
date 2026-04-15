import type { DashboardData } from '../types';

const DEPTS = [
  'Amazonas','Áncash','Apurímac','Arequipa','Ayacucho','Cajamarca','Callao','Cusco',
  'Huancavelica','Huánuco','Ica','Junín','La Libertad','Lambayeque','Lima','Loreto',
  'Madre de Dios','Moquegua','Pasco','Piura','Puno','San Martín','Tacna','Tumbes','Ucayali'
];

function rand(seed: number) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Ganador esperado por departamento (patrón geográfico: Fujimori norte/selva, López Aliaga sur/costa, Sánchez + Nieto regiones puntuales)
const WIN_PATTERN: Record<string, 'fujimori'|'rla'|'sanchez'|'nieto'|'belmont'> = {
  'Tumbes':'fujimori','Piura':'fujimori','Lambayeque':'fujimori','La Libertad':'fujimori','Cajamarca':'fujimori',
  'Amazonas':'fujimori','San Martín':'fujimori','Loreto':'fujimori','Ucayali':'fujimori',
  'Áncash':'fujimori','Huánuco':'fujimori','Pasco':'fujimori','Junín':'fujimori',
  'Lima':'rla','Callao':'rla','Ica':'rla',
  'Arequipa':'sanchez','Moquegua':'belmont','Tacna':'sanchez','Puno':'sanchez',
  'Cusco':'nieto','Apurímac':'nieto','Ayacucho':'nieto','Huancavelica':'sanchez',
  'Madre de Dios':'fujimori',
};

function mkRegion(name: string, i: number) {
  const winner = WIN_PATTERN[name] || 'fujimori';
  const base = { fujimori: 13, rla: 11, sanchez: 10.5, nieto: 10, belmont: 9 };
  // bump ganador
  (base as any)[winner] += 6 + rand(i) * 4;
  // jitter
  const j = (k: number) => (rand(i + k) - 0.5) * 2;
  return {
    name,
    pct: 82 + rand(i + 10) * 15,
    fujimori: Math.max(2, base.fujimori + j(1)),
    rla:      Math.max(2, base.rla      + j(2)),
    sanchez:  Math.max(2, base.sanchez  + j(3)),
    nieto:    Math.max(2, base.nieto    + j(4)),
    belmont:  Math.max(2, base.belmont  + j(5)),
    actasRevisadas: Math.floor(2500 + rand(i + 20) * 3500),
    actasTotal:     Math.floor(3200 + rand(i + 21) * 4000),
  };
}

const regions = DEPTS.map((d, i) => mkRegion(d, i + 1));
const extranjero = mkRegion('Extranjero', 99);
// voto extranjero lo gana RLA (como reportó prensa: "fuerte en Lima metropolitana y exterior")
extranjero.fujimori = 15; extranjero.rla = 22; extranjero.nieto = 9; extranjero.sanchez = 10; extranjero.belmont = 8;
regions.push(extranjero);

const series: DashboardData['series'] = [];
// evolución temporal: Sánchez cruza a López Aliaga cerca del 89-90%
const targets = { fujimori: 16.88, sanchez: 12.18, rla: 12.09, nieto: 11.03, belmont: 7.7 };
for (let p = 5; p <= 89; p += 4) {
  const t = p / 89;
  series.push({
    pct: p,
    fujimori: 15 + (targets.fujimori - 15) * t + (rand(p) - 0.5) * 0.6,
    rla:      13 + (targets.rla      - 13) * t + (rand(p + 1) - 0.5) * 0.5,
    sanchez:  11 + (targets.sanchez  - 11) * t + (rand(p + 2) - 0.5) * 0.4,
    nieto:    12 + (targets.nieto    - 12) * t + (rand(p + 3) - 0.5) * 0.4,
    belmont:  9  + (targets.belmont  - 9)  * t + (rand(p + 4) - 0.5) * 0.3,
  });
}

// Actualizado 15 Abr · 10:04 a.m. — Sánchez supera a López Aliaga (fuente: ONPE 90.963%)
export const MOCK_ONPE: DashboardData = {
  pctActas: 90.963,
  actasRevisadas: 4519,
  actasTotal: 92766,
  votosEmitidos: 15_411_098,
  votosFaltantes: 1_551_210,
  proximoRefresh: '4:00',
  fechaActualizacion: '15 Abr · 10:04 a. m.',
  jeeStatus: 'En revisión',
  regions,
  extranjero,
  series,
  projection: { fujimori: 17.08, sanchez: 12.31, rla: 12.12, nieto: 10.94, belmont: 7.61 },
  // Sánchez ahora 2° — probabilidades reflejan el cruce
  probabilities: { fujimori: 99, sanchez: 58, rla: 41, nieto: 1, belmont: 0 },
};

export const MOCK_DATUM: DashboardData = {
  ...MOCK_ONPE,
  pctActas: 100,
  fechaActualizacion: 'Datum CR · 100%',
  regions: regions.map(r => ({ ...r, pct: 100 })),
  projection: { fujimori: 16.8, rla: 12.3, sanchez: 11.9, nieto: 11.1, belmont: 7.9 },
  probabilities: { fujimori: 100, rla: 71, sanchez: 28, nieto: 1, belmont: 0 },
};

// Segunda vuelta: Fujimori vs López Aliaga · 7 junio 2026
export const SEGUNDA_VUELTA_FECHA = new Date('2026-06-07T08:00:00-05:00');
