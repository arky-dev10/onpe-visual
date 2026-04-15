// Scraper Diputados Perú 2026 (idEleccion=13) → public/data/diputados.json
// · endpoint 1 (participantes-ubicacion-geografica-nombre): totales por partido + totalCandidatos
// · endpoint 2 (participantes-por-candidato): nombres + votos preferenciales por candidato
// · merge → D'Hondt por distrito → electos = top N preferenciales de cada partido según escaños asignados.

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'public', 'data', 'diputados.json');
const INTERVAL = (Number(process.env.INTERVAL) || 60) * 1000;
const WATCH = process.argv.includes('--watch');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BASE = 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend';

const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Referer': 'https://resultadoelectoral.onpe.gob.pe/main/diputados',
};

async function getJson(page, url) {
  const r = await page.request.get(url, { headers: HEADERS });
  if (!r.ok()) return null;
  if (r.status() === 204) return null;
  const t = await r.text();
  if (t.startsWith('<')) return null;
  try { return JSON.parse(t); } catch { return null; }
}

function dhondt(votos, escanos) {
  const seats = new Array(votos.length).fill(0);
  for (let i = 0; i < escanos; i++) {
    let best = -1, bestIdx = 0;
    for (let j = 0; j < votos.length; j++) {
      const q = votos[j] / (seats[j] + 1);
      if (q > best) { best = q; bestIdx = j; }
    }
    if (best <= 0) break;
    seats[bestIdx]++;
  }
  return seats;
}

async function scrape() {
  const t0 = Date.now();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();

  await page.goto('https://resultadoelectoral.onpe.gob.pe/main/diputados', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  const distritos = await getJson(page, `${BASE}/distrito-electoral/distritos`);
  if (!distritos?.data) throw new Error('no distritos');

  const distritosOut = [];
  const resumenEscanos = {};
  const nombreByCodigo = {};

  for (let i = 0; i < distritos.data.length; i += 3) {
    const chunk = distritos.data.slice(i, i + 3);
    const results = await Promise.all(chunk.map(async d => {
      const id = d.codigo;
      const [tot, porPartido, porCandidato] = await Promise.all([
        getJson(page, `${BASE}/resumen-general/totales?idEleccion=13&tipoFiltro=distrito_electoral&idDistritoElectoral=${id}`),
        getJson(page, `${BASE}/eleccion-diputado/participantes-ubicacion-geografica-nombre?idEleccion=13&tipoFiltro=distrito_electoral&idDistritoElectoral=${id}`),
        getJson(page, `${BASE}/eleccion-diputado/participantes-por-candidato?pagina=0&tamanio=3000&idEleccion=13&tipoFiltro=distrito_electoral&idDistritoElectoral=${id}`),
      ]);
      if (!tot?.data || !porPartido?.data || !porCandidato?.data) return null;

      // Partidos (fuente de verdad para totales + totalCandidatos)
      const byParty = {};
      for (const p of porPartido.data) {
        const cod = String(Number(p.codigoAgrupacionPolitica));
        if (!Number.isFinite(Number(cod)) || Number(cod) >= 80) continue;
        byParty[cod] = {
          codigo: cod,
          nombre: p.nombreAgrupacionPolitica,
          votos: p.totalVotosValidos || 0,
          totalCandidatos: p.totalCandidatos || 0,
          candidatos: [],
        };
      }

      // Candidatos (nombres y votos preferenciales) — merge en su partido
      for (const c of porCandidato.data) {
        const cod = String(Number(c.codigoAgrupacionPolitica));
        if (!byParty[cod]) continue;
        byParty[cod].candidatos.push({
          nombre: c.nombreCandidato || '',
          dni: c.dniCandidato || '',
          lista: c.lista ?? 0,
          votosPreferenciales: c.totalVotosValidos || 0,
        });
      }

      // Ordenar candidatos por votos preferenciales (método de asignación interna por voto preferencial)
      Object.values(byParty).forEach(p => {
        p.candidatos.sort((a, b) => b.votosPreferenciales - a.votosPreferenciales);
      });

      // Número de escaños del distrito = max(totalCandidatos) de las listas inscritas
      const escanosDist = Math.max(0, ...Object.values(byParty).map(p => p.totalCandidatos || 0));

      // D'Hondt sobre partidos
      const partidosArr = Object.values(byParty).sort((a, b) => b.votos - a.votos);
      const seats = dhondt(partidosArr.map(p => p.votos), escanosDist);

      const totalVotos = partidosArr.reduce((s, p) => s + p.votos, 0) || 1;
      const partidosOut = partidosArr.map((p, idx) => {
        const asignados = seats[idx] || 0;
        return {
          codigo: p.codigo,
          nombre: p.nombre,
          votos: p.votos,
          pct: (p.votos / totalVotos) * 100,
          escanos: asignados,
          totalCandidatos: p.totalCandidatos,
          candidatos: p.candidatos.map((c, ci) => ({ ...c, electo: ci < asignados })),
        };
      });

      for (const p of partidosOut) {
        nombreByCodigo[p.codigo] = p.nombre;
        resumenEscanos[p.codigo] = (resumenEscanos[p.codigo] || 0) + p.escanos;
      }

      return {
        codigo: id,
        nombre: d.nombre,
        pctActas: tot.data.actasContabilizadas,
        actasRevisadas: tot.data.contabilizadas,
        actasTotal: tot.data.totalActas,
        totalVotosValidos: tot.data.totalVotosValidos,
        votosEmitidos: tot.data.totalVotosEmitidos,
        escanos: escanosDist,
        partidos: partidosOut,
        ganador: partidosOut[0]?.codigo || null,
      };
    }));
    distritosOut.push(...results.filter(Boolean));
  }

  await browser.close();

  const totalEscanos = distritosOut.reduce((s, d) => s + d.escanos, 0);
  const resumenPartidos = Object.entries(resumenEscanos)
    .map(([codigo, escanos]) => ({ codigo, nombre: nombreByCodigo[codigo], escanos }))
    .sort((a, b) => b.escanos - a.escanos);

  const out = {
    _scrapedAt: new Date().toISOString(),
    _source: 'resultadoelectoral.onpe.gob.pe',
    totalEscanos,
    distritos: distritosOut,
    resumenPartidos,
  };

  await fs.mkdir(path.dirname(OUT), { recursive: true });
  await fs.writeFile(OUT, JSON.stringify(out, null, 2));
  console.log(`  ✓ diputados · ${distritosOut.length}/${distritos.data.length} distritos · ${totalEscanos} escaños · top: ${resumenPartidos.slice(0, 5).map(p => `${p.nombre.slice(0, 12)}(${p.escanos})`).join(' ')} · ${Date.now() - t0}ms`);
}

async function runOnce() {
  try { await scrape(); }
  catch (e) { console.error('  ✗', e.message); }
}

console.log(`[scrape-diputados] interval=${INTERVAL / 1000}s watch=${WATCH}`);
await runOnce();
if (WATCH) setInterval(runOnce, INTERVAL);
