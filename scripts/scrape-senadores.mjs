// Scraper Senado Perú 2026 → public/data/senadores.json
// - Senado Nacional (distrito único)       idEleccion=15
// - Senado Regional (distrito múltiple)    idEleccion=14
//
// Calcula escaños por D'Hondt (nacional con valla 5%, regional sin valla).
//
// Uso:
//   node scripts/scrape-senadores.mjs          # 1 ejecución
//   node scripts/scrape-senadores.mjs --watch  # loop (INTERVAL=60s)

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'data', 'senadores.json');
const INTERVAL = (Number(process.env.INTERVAL) || 60) * 1000;
const WATCH = process.argv.includes('--watch');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BASE = 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend';

const SENADO_NACIONAL_ESCANOS = 30;
const VALLA_NACIONAL = 5.0; // %

const HEADERS_UNICO = {
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Referer': 'https://resultadoelectoral.onpe.gob.pe/main/senadores-distrito-nacional-unico',
};
const HEADERS_MULT = { ...HEADERS_UNICO, Referer: 'https://resultadoelectoral.onpe.gob.pe/main/senadores-distrito-electoral-multiple' };

async function getJson(page, url, headers) {
  const r = await page.request.get(url, { headers });
  if (!r.ok()) throw new Error(`${url} → ${r.status()}`);
  if (r.status() === 204) return null;
  return r.json();
}

/** D'Hondt: reparte `escanos` entre `votos` (array), devuelve `seats` paralelo. */
function dhondt(votos, escanos) {
  const seats = new Array(votos.length).fill(0);
  for (let i = 0; i < escanos; i++) {
    let bestIdx = 0, best = -1;
    for (let j = 0; j < votos.length; j++) {
      const q = votos[j] / (seats[j] + 1);
      if (q > best) { best = q; bestIdx = j; }
    }
    if (best <= 0) break;
    seats[bestIdx]++;
  }
  return seats;
}

/** Filtra votos-blanco/nulo (codigoAgrupacionPolitica numérico > 79) */
function esPartidoReal(p) {
  const cod = Number(p.codigoAgrupacionPolitica);
  return Number.isFinite(cod) && cod < 80 && p.totalVotosValidos > 0;
}

async function scrape() {
  const t0 = Date.now();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();

  // Hidratar sesión (importante para endpoints de senadores-distrito-unico/*)
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/senadores-distrito-nacional-unico', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // ─────────── NACIONAL (único) ───────────
  const [totNac, partNac, candNac] = await Promise.all([
    getJson(page, `${BASE}/resumen-general/totales?idEleccion=15&tipoFiltro=eleccion`, HEADERS_UNICO),
    getJson(page, `${BASE}/senadores-distrito-unico/participantes-ubicacion-geografica-nombre?idEleccion=15&tipoFiltro=eleccion`, HEADERS_UNICO),
    getJson(page, `${BASE}/senadores-distrito-unico/participantes-por-candidato?pagina=0&tamanio=3000&idEleccion=15&tipoFiltro=eleccion`, HEADERS_UNICO),
  ]);

  const partidosNac = (partNac?.data || []).filter(esPartidoReal).sort((a, b) => b.totalVotosValidos - a.totalVotosValidos);
  const totalValidosNac = partidosNac.reduce((s, p) => s + p.totalVotosValidos, 0);

  // Agrupar candidatos nacional por partido (sorted por preferencial)
  const candidatosByParty = {};
  for (const c of (candNac?.data || [])) {
    const cod = String(Number(c.codigoAgrupacionPolitica));
    if (!candidatosByParty[cod]) candidatosByParty[cod] = [];
    candidatosByParty[cod].push({
      nombre: c.nombreCandidato || '',
      dni: c.dniCandidato || '',
      lista: c.lista ?? 0,
      votosPreferenciales: c.totalVotosValidos || 0,
    });
  }
  Object.values(candidatosByParty).forEach(arr => arr.sort((a, b) => b.votosPreferenciales - a.votosPreferenciales));

  const partidosNacOut = partidosNac.map(p => {
    const cod = String(p.codigoAgrupacionPolitica);
    return {
      codigo: cod,
      nombre: p.nombreAgrupacionPolitica,
      votos: p.totalVotosValidos,
      pct: p.porcentajeVotosValidos ?? 0,
      candidatos: candidatosByParty[cod] || [],
    };
  });

  // D'Hondt solo sobre los que pasan la valla
  const passVallaIdx = partidosNacOut
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.pct >= VALLA_NACIONAL)
    .map(({ i }) => i);
  const votosPass = passVallaIdx.map(i => partidosNacOut[i].votos);
  const seatsPass = dhondt(votosPass, SENADO_NACIONAL_ESCANOS);
  const escanosNac = {};
  for (const p of partidosNacOut) escanosNac[p.codigo] = 0;
  passVallaIdx.forEach((idx, k) => { escanosNac[partidosNacOut[idx].codigo] = seatsPass[k]; });

  // Marcar candidatos electos (top N por partido según escaños)
  for (const p of partidosNacOut) {
    const n = escanosNac[p.codigo] || 0;
    p.candidatos = p.candidatos.map((c, i) => ({ ...c, electo: i < n }));
  }

  const nacional = {
    pctActas: totNac.data.actasContabilizadas,
    actasRevisadas: totNac.data.contabilizadas,
    actasTotal: totNac.data.totalActas,
    votosEmitidos: totNac.data.totalVotosEmitidos,
    totalVotosValidos: totalValidosNac,
    fechaActualizacion: new Date(totNac.data.fechaActualizacion).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    escanosTotales: SENADO_NACIONAL_ESCANOS,
    valla: VALLA_NACIONAL,
    partidos: partidosNacOut,
    escanos: escanosNac,
  };

  console.log(`  NAC: ${partidosNac.length} partidos · actas ${nacional.pctActas.toFixed(3)}% · valla ${VALLA_NACIONAL}% → ${passVallaIdx.length} pasan`);
  const topNac = partidosNacOut.slice(0, 5).map(p => `${p.nombre.slice(0,12)}(${p.pct.toFixed(1)}%→${escanosNac[p.codigo]}e)`).join(' ');
  console.log(`  NAC top: ${topNac}`);

  // ─────────── REGIONAL (múltiple) ───────────
  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/senadores-distrito-electoral-multiple', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const distritos = await getJson(page, `${BASE}/distrito-electoral/distritos`, HEADERS_MULT);
  const distritosOut = [];

  // chunk 5 en 5
  const dArr = distritos.data;
  for (let i = 0; i < dArr.length; i += 5) {
    const chunk = dArr.slice(i, i + 5);
    const results = await Promise.all(chunk.map(async d => {
      const id = d.codigo;
      const [tot, part, cand] = await Promise.all([
        getJson(page, `${BASE}/resumen-general/totales?idEleccion=14&tipoFiltro=distrito_electoral&idDistritoElectoral=${id}`, HEADERS_MULT).catch(() => null),
        getJson(page, `${BASE}/senadores-distrital-multiple/participantes-ubicacion-geografica?idDistritoElectoral=${id}&idEleccion=14&tipoFiltro=distrito_electoral`, HEADERS_MULT).catch(() => null),
        getJson(page, `${BASE}/senadores-distrital-multiple/participantes-por-candidato?pagina=0&tamanio=2000&idDistritoElectoral=${id}&idEleccion=14&tipoFiltro=distrito_electoral`, HEADERS_MULT).catch(() => null),
      ]);
      if (!tot?.data || !part?.data) return null;
      const pts = part.data.filter(esPartidoReal).sort((a, b) => b.totalVotosValidos - a.totalVotosValidos);
      const escanosDist = Math.max(0, ...pts.map(p => p.totalCandidatos || 0));

      // Candidatos por partido (si hay)
      const candByParty = {};
      for (const c of (cand?.data || [])) {
        const cod = String(Number(c.codigoAgrupacionPolitica));
        if (!candByParty[cod]) candByParty[cod] = [];
        candByParty[cod].push({
          nombre: c.nombreCandidato || '',
          dni: c.dniCandidato || '',
          lista: c.lista ?? 0,
          votosPreferenciales: c.totalVotosValidos || 0,
        });
      }
      Object.values(candByParty).forEach(arr => arr.sort((a, b) => b.votosPreferenciales - a.votosPreferenciales));

      const partidosOut = pts.map(p => {
        const cod = String(p.codigoAgrupacionPolitica ?? p.idAgrupacionPolitica ?? '');
        return {
          codigo: cod,
          nombre: p.nombreAgrupacionPolitica,
          votos: p.totalVotosValidos,
          pct: p.porcentajeVotosValidos ?? 0,
          candidatos: p.totalCandidatos || 0,
          candidatosList: candByParty[cod] || [],
        };
      });
      const seats = dhondt(partidosOut.map(p => p.votos), escanosDist);
      const asignacion = {};
      partidosOut.forEach((p, idx) => {
        asignacion[p.codigo] = seats[idx];
        // marcar electos
        p.candidatosList = p.candidatosList.map((c, i) => ({ ...c, electo: i < seats[idx] }));
      });

      return {
        codigo: id,
        nombre: d.nombre,
        pctActas: tot.data.actasContabilizadas,
        actasRevisadas: tot.data.contabilizadas,
        actasTotal: tot.data.totalActas,
        escanos: escanosDist,
        totalVotosValidos: tot.data.totalVotosValidos,
        partidos: partidosOut,
        asignacion,
        ganador: partidosOut[0]?.codigo || null,
      };
    }));
    for (const r of results) if (r) distritosOut.push(r);
  }

  // Suma de escaños regionales por partido (usando codigo como key)
  const escanosRegTotales = {};
  const nombreByCodigo = {};
  for (const d of distritosOut) {
    for (const p of d.partidos) {
      nombreByCodigo[p.codigo] = p.nombre;
      escanosRegTotales[p.codigo] = (escanosRegTotales[p.codigo] || 0) + (d.asignacion[p.codigo] || 0);
    }
  }
  const escanosRegionalesTotales = Object.values(escanosRegTotales).reduce((a, b) => a + b, 0);

  console.log(`  REG: ${distritosOut.length}/${dArr.length} distritos · escaños totales asignados=${escanosRegionalesTotales}`);

  await browser.close();

  const out = {
    _scrapedAt: new Date().toISOString(),
    _source: 'resultadoelectoral.onpe.gob.pe',
    nacional,
    regional: {
      distritos: distritosOut,
      escanosTotales: escanosRegionalesTotales,
      resumenPartidos: Object.entries(escanosRegTotales)
        .map(([codigo, escanos]) => ({ codigo, nombre: nombreByCodigo[codigo], escanos }))
        .sort((a, b) => b.escanos - a.escanos),
    },
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`  ✓ senadores.json · ${Date.now() - t0}ms → ${OUT}`);
}

async function runOnce() {
  try { await scrape(); }
  catch (e) { console.error('  ✗', e.message); }
}

console.log(`[scrape-senadores] interval=${INTERVAL / 1000}s watch=${WATCH}`);
await runOnce();
if (WATCH) setInterval(runOnce, INTERVAL);
