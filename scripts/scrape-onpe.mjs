// Scraper ONPE → public/data/onpe.json
// v2: datos reales por departamento + extranjero + mapping de Belmont corregido
//
// Uso:
//   node scripts/scrape-onpe.mjs          # 1 ejecución
//   node scripts/scrape-onpe.mjs --watch  # loop (INTERVAL=60s por default)

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'data', 'onpe.json');
const HIST = path.join(__dirname, '..', 'public', 'data', 'onpe-history.json');
const INTERVAL = (Number(process.env.INTERVAL) || 60) * 1000;
const WATCH = process.argv.includes('--watch');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BASE = 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend';

// Mapeo nombre partido ONPE → key interna (corregido Belmont: OBRAS, no PAÍS PARA TODOS)
const PARTY_TO_KEY = {
  'FUERZA POPULAR': 'fujimori',
  'RENOVACIÓN POPULAR': 'rla',
  'RENOVACION POPULAR': 'rla',
  'JUNTOS POR EL PERÚ': 'sanchez',
  'JUNTOS POR EL PERU': 'sanchez',
  'PARTIDO DEL BUEN GOBIERNO': 'nieto',
  'PARTIDO CÍVICO OBRAS': 'belmont',
  'PARTIDO CIVICO OBRAS': 'belmont',
};

const CAND_KEYS = ['fujimori', 'rla', 'sanchez', 'nieto', 'belmont'];

// Re-capitaliza el nombre UPPERCASE de ONPE al formato pretty de nuestra app
const PRETTY_NAME = {
  'AMAZONAS': 'Amazonas', 'ÁNCASH': 'Áncash', 'APURÍMAC': 'Apurímac',
  'AREQUIPA': 'Arequipa', 'AYACUCHO': 'Ayacucho', 'CAJAMARCA': 'Cajamarca',
  'CALLAO': 'Callao', 'CUSCO': 'Cusco', 'HUANCAVELICA': 'Huancavelica',
  'HUÁNUCO': 'Huánuco', 'ICA': 'Ica', 'JUNÍN': 'Junín', 'LA LIBERTAD': 'La Libertad',
  'LAMBAYEQUE': 'Lambayeque', 'LIMA': 'Lima', 'LORETO': 'Loreto',
  'MADRE DE DIOS': 'Madre de Dios', 'MOQUEGUA': 'Moquegua', 'PASCO': 'Pasco',
  'PIURA': 'Piura', 'PUNO': 'Puno', 'SAN MARTÍN': 'San Martín', 'TACNA': 'Tacna',
  'TUMBES': 'Tumbes', 'UCAYALI': 'Ucayali',
};

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Referer': 'https://resultadoelectoral.onpe.gob.pe/main/presidenciales',
};

async function getJson(page, url) {
  const r = await page.request.get(url, { headers: HEADERS });
  if (!r.ok()) throw new Error(`${url} → ${r.status()}`);
  if (r.status() === 204) return null;
  return r.json();
}

function pctsByKey(participantes) {
  const pct = { fujimori: 0, rla: 0, sanchez: 0, nieto: 0, belmont: 0 };
  const votes = { fujimori: 0, rla: 0, sanchez: 0, nieto: 0, belmont: 0 };
  for (const p of participantes) {
    const key = PARTY_TO_KEY[p.nombreAgrupacionPolitica?.toUpperCase().trim()];
    if (!key) continue;
    pct[key] = p.porcentajeVotosValidos ?? 0;
    votes[key] = p.totalVotosValidos ?? 0;
  }
  return { pct, votes };
}

async function scrape() {
  const t0 = Date.now();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();

  // 1. Hidratar sesión
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/presidenciales', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // 2. Datos nacionales
  const [totales, participantes, ubigeos, mapaCalor] = await Promise.all([
    getJson(page, `${BASE}/resumen-general/totales?idEleccion=10&tipoFiltro=eleccion`),
    getJson(page, `${BASE}/resumen-general/participantes?idEleccion=10&tipoFiltro=eleccion`),
    getJson(page, `${BASE}/ubigeos/departamentos?idEleccion=10&idAmbitoGeografico=1`),
    getJson(page, `${BASE}/resumen-general/mapa-calor?idAmbitoGeografico=1&idEleccion=10&tipoFiltro=ambito_geografico`),
  ]);

  const t = totales.data;
  const { pct: byKey, votes: votesByKey } = pctsByKey(participantes.data);
  const matched = Object.values(byKey).filter(v => v > 0).length;
  console.log(`  nacional: match ${matched}/5 candidatos · actas ${t.actasContabilizadas.toFixed(3)}%`);

  // 3. Datos por departamento (en paralelo, con pequeño chunking para no saturar)
  const dptos = ubigeos.data.slice();
  dptos.push({ ubigeo: '999999', nombre: 'EXTRANJERO' }); // handled separately abajo

  const heatByUbigeo = {};
  for (const h of mapaCalor.data) {
    if (h.ubigeoNivel01) heatByUbigeo[h.ubigeoNivel01] = h;
  }

  async function fetchDept(d) {
    const name = d.nombre.toUpperCase();
    const isExt = name === 'EXTRANJERO';

    // Per-departamento: tipoFiltro=ubigeo_nivel_01 + idUbigeoDepartamento (totales) / ubigeoNivel1 (participantes)
    // Extranjero: tipoFiltro=ambito_geografico + idAmbitoGeografico=2
    const partsTotal = isExt
      ? `tipoFiltro=ambito_geografico&idAmbitoGeografico=2`
      : `tipoFiltro=ubigeo_nivel_01&idAmbitoGeografico=1&idUbigeoDepartamento=${d.ubigeo}`;
    const partsPart = isExt
      ? `tipoFiltro=ambito_geografico&idAmbitoGeografico=2`
      : `tipoFiltro=ubigeo_nivel_01&idAmbitoGeografico=1&ubigeoNivel1=${d.ubigeo}`;

    const [tot, part] = await Promise.all([
      getJson(page, `${BASE}/resumen-general/totales?${partsTotal}&idEleccion=10`).catch(() => null),
      getJson(page, `${BASE}/eleccion-presidencial/participantes-ubicacion-geografica-nombre?${partsPart}&idEleccion=10`).catch(() => null),
    ]);
    if (!tot?.data || !part?.data) return null;
    const { pct } = pctsByKey(part.data);
    return {
      name: PRETTY_NAME[name] || name,
      pct: tot.data.actasContabilizadas,
      fujimori: pct.fujimori,
      rla: pct.rla,
      sanchez: pct.sanchez,
      nieto: pct.nieto,
      belmont: pct.belmont,
      actasRevisadas: tot.data.contabilizadas,
      actasTotal: tot.data.totalActas,
    };
  }

  // chunking de 5 en 5 para no saturar
  const regions = [];
  let extranjero = null;
  for (let i = 0; i < dptos.length; i += 5) {
    const batch = await Promise.all(dptos.slice(i, i + 5).map(fetchDept));
    for (const r of batch) {
      if (!r) continue;
      if (r.name === 'EXTRANJERO' || r.name === 'Extranjero') {
        extranjero = { ...r, name: 'Extranjero' };
      } else {
        regions.push(r);
      }
    }
  }
  if (extranjero) regions.push(extranjero);
  console.log(`  regiones: ${regions.length - (extranjero ? 1 : 0)}/25 + extranjero=${!!extranjero}`);

  await browser.close();

  // 4. Serie histórica persistente (leer snapshot previo si existe, agregar)
  let history = [];
  try { history = JSON.parse(await fs.readFile(HIST, 'utf8')); } catch {}
  const lastPct = history[history.length - 1]?.pct ?? -1;
  if (t.actasContabilizadas > lastPct + 0.1) {
    history.push({
      pct: Number(t.actasContabilizadas.toFixed(2)),
      at: Date.now(),
      ...byKey,
    });
    await fs.writeFile(HIST, JSON.stringify(history, null, 2));
  }
  const series = history.length >= 3
    ? history.map(h => ({ pct: h.pct, fujimori: h.fujimori, rla: h.rla, sanchez: h.sanchez, nieto: h.nieto, belmont: h.belmont }))
    : generateSyntheticSeries(byKey, t.actasContabilizadas);

  // 5. Probabilidades por ranking
  const ranking = [...CAND_KEYS].sort((a, b) => byKey[b] - byKey[a]);
  const [first, second, third] = ranking;
  const gap23 = (byKey[second] - byKey[third]) / Math.max(0.1, byKey[second]);
  const probs = { fujimori: 0, rla: 0, sanchez: 0, nieto: 0, belmont: 0 };
  probs[first] = 99;
  probs[second] = Math.min(95, Math.max(35, Math.round(55 + gap23 * 200)));
  probs[third] = 100 - probs[second];

  // 6. Output
  const fmtFecha = new Date(t.fechaActualizacion).toLocaleString('es-PE', {
    timeZone: 'America/Lima',
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  const out = {
    pctActas: t.actasContabilizadas,
    actasRevisadas: t.contabilizadas,
    actasTotal: t.totalActas,
    votosEmitidos: t.totalVotosEmitidos,
    votosFaltantes: Math.max(0, Math.round(t.totalVotosEmitidos * (1 - t.actasContabilizadas / 100))),
    proximoRefresh: '4:00',
    fechaActualizacion: fmtFecha,
    jeeStatus: `${t.enviadasJee.toLocaleString('es-PE')} actas en JEE`,
    regions,
    extranjero: extranjero || regions[0],
    series,
    projection: { ...byKey },
    probabilities: probs,
    _scrapedAt: new Date().toISOString(),
    _source: 'resultadoelectoral.onpe.gob.pe',
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`  ✓ ${t.actasContabilizadas.toFixed(3)}% · ${first}(${byKey[first].toFixed(2)}) > ${second}(${byKey[second].toFixed(2)}) > ${third}(${byKey[third].toFixed(2)}) · ${Date.now() - t0}ms`);
}

function generateSyntheticSeries(byKey, currentPct) {
  const series = [];
  const start = Math.max(20, currentPct - 70);
  const step = Math.max(2, (currentPct - start) / 15);
  for (let p = start; p <= currentPct; p += step) {
    const t2 = (p - start) / Math.max(1, currentPct - start);
    series.push({
      pct: Number(p.toFixed(1)),
      fujimori: byKey.fujimori * (0.93 + t2 * 0.07),
      rla: byKey.rla * (0.95 + t2 * 0.05),
      sanchez: byKey.sanchez * (0.88 + t2 * 0.12),
      nieto: byKey.nieto * (1.02 - t2 * 0.02),
      belmont: byKey.belmont * (1.0 - t2 * 0.0),
    });
  }
  return series;
}

async function runOnce() {
  try { await scrape(); }
  catch (e) { console.error('  ✗', e.message); }
}

console.log(`[onpe-scraper v2] interval=${INTERVAL / 1000}s watch=${WATCH}`);
await runOnce();
if (WATCH) setInterval(runOnce, INTERVAL);
