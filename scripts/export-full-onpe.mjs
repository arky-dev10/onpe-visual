// Extrae TODO ONPE 2026 y exporta a XLSX en ~/Desktop/onpe-completo-2026.xlsx
// Elecciones: Presidencial (10) · Senado único (15) · Senado múltiple (14) · Diputados (13) · Parlamento Andino (12)
//
//   node scripts/export-full-onpe.mjs

import { chromium } from 'playwright';
import * as XLSX from 'xlsx';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const BASE = 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend';
const OUT = path.join(os.homedir(), 'Desktop', 'onpe-completo-2026.xlsx');

const ELECCIONES = {
  10: { nombre: 'Presidencial',          endpoint: 'resumen-general/participantes', referer: '/main/presidenciales' },
  15: { nombre: 'Senado Distrito Único', endpoint: 'resumen-general/participantes', referer: '/main/senadores-distrito-nacional-unico' },
  14: { nombre: 'Senado Distrito Múltiple', endpoint: null /* por distrito */, referer: '/main/senadores-distrito-electoral-multiple' },
  13: { nombre: 'Diputados',             endpoint: 'resumen-general/participantes', referer: '/main/diputados' },
  12: { nombre: 'Parlamento Andino',     endpoint: 'resumen-general/participantes', referer: '/main/parlamento-andino' },
};

function headers(referer) {
  return {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Referer': `https://resultadoelectoral.onpe.gob.pe${referer}`,
  };
}

async function getJson(page, url, ref) {
  try {
    const r = await page.request.get(url, { headers: headers(ref) });
    if (r.status() === 204) return null;
    if (!r.ok()) return null;
    const t = await r.text();
    if (t.startsWith('<')) return null;
    return JSON.parse(t);
  } catch { return null; }
}

function fmtDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('es-PE', { timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

async function main() {
  const t0 = Date.now();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ userAgent: UA });
  const page = await ctx.newPage();

  // Hidratar sesión
  await page.goto('https://resultadoelectoral.onpe.gob.pe/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const bag = { meta: {}, elecciones: {} };

  // Metadata del proceso
  const proceso = await getJson(page, `${BASE}/proceso/proceso-electoral-activo`, '/');
  bag.meta = proceso?.data || {};

  // Catálogos
  const ubigeos   = await getJson(page, `${BASE}/ubigeos/departamentos?idEleccion=10&idAmbitoGeografico=1`, '/main/presidenciales');
  const distritos = await getJson(page, `${BASE}/distrito-electoral/distritos`, '/main/senadores-distrito-electoral-multiple');

  console.log('proceso:', bag.meta.nombre || '?');
  console.log('ubigeos:', ubigeos?.data?.length || 0, 'distritos:', distritos?.data?.length || 0);

  // ───── Por cada elección: totales + participantes (nacional) + por departamento (cuando aplique)
  for (const [idStr, cfg] of Object.entries(ELECCIONES)) {
    const id = Number(idStr);
    console.log(`\n─── ${cfg.nombre} (idEleccion=${id})`);
    await page.goto(`https://resultadoelectoral.onpe.gob.pe${cfg.referer}`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(2000);

    const eleccion = { id, nombre: cfg.nombre, totalesNac: null, participantesNac: [], porUbicacion: [] };

    // Totales nacional
    if (id === 14) {
      // Senado múltiple no tiene totales "nacional" con tipoFiltro=eleccion. Fallback: sumar por distrito.
    } else {
      const tot = await getJson(page, `${BASE}/resumen-general/totales?idEleccion=${id}&tipoFiltro=eleccion`, cfg.referer);
      eleccion.totalesNac = tot?.data || null;
    }

    // Participantes nacional (según elección hay endpoint específico)
    const endpoints = {
      10: `${BASE}/eleccion-presidencial/participantes-ubicacion-geografica-nombre?tipoFiltro=ambito_geografico&idAmbitoGeografico=1&listRegiones=TODOS,PER%C3%9A,EXTRANJERO&idEleccion=10`,
      15: `${BASE}/senadores-distrito-unico/participantes-ubicacion-geografica-nombre?idEleccion=15&tipoFiltro=eleccion`,
      13: `${BASE}/resumen-general/participantes?idEleccion=13&tipoFiltro=eleccion`,
      12: `${BASE}/resumen-general/participantes?idEleccion=12&tipoFiltro=eleccion`,
    };
    if (endpoints[id]) {
      const part = await getJson(page, endpoints[id], cfg.referer);
      eleccion.participantesNac = part?.data || [];
    }

    // Por ubicación: para presidencial (10) y diputados (13) por departamento; para senado regional (14) por distrito electoral
    if (id === 10 || id === 13) {
      const deptos = (ubigeos?.data || []);
      for (let i = 0; i < deptos.length; i += 5) {
        const chunk = deptos.slice(i, i + 5);
        const results = await Promise.all(chunk.map(async d => {
          const partsTotal = `tipoFiltro=ubigeo_nivel_01&idAmbitoGeografico=1&idUbigeoDepartamento=${d.ubigeo}`;
          const partsPart = `tipoFiltro=ubigeo_nivel_01&idAmbitoGeografico=1&ubigeoNivel1=${d.ubigeo}`;
          const partEndpoint = id === 10
            ? `${BASE}/eleccion-presidencial/participantes-ubicacion-geografica-nombre?${partsPart}&idEleccion=10`
            : `${BASE}/resumen-general/participantes?${partsPart}&idEleccion=${id}`;
          const [tot, part] = await Promise.all([
            getJson(page, `${BASE}/resumen-general/totales?${partsTotal}&idEleccion=${id}`, cfg.referer),
            getJson(page, partEndpoint, cfg.referer),
          ]);
          return { nombre: d.nombre, ubigeo: d.ubigeo, totales: tot?.data, participantes: part?.data || [] };
        }));
        eleccion.porUbicacion.push(...results);
      }
      // Extranjero
      const [totExt, partExt] = await Promise.all([
        getJson(page, `${BASE}/resumen-general/totales?tipoFiltro=ambito_geografico&idAmbitoGeografico=2&idEleccion=${id}`, cfg.referer),
        getJson(page, id === 10
          ? `${BASE}/eleccion-presidencial/participantes-ubicacion-geografica-nombre?tipoFiltro=ambito_geografico&idAmbitoGeografico=2&idEleccion=${id}`
          : `${BASE}/resumen-general/participantes?tipoFiltro=ambito_geografico&idAmbitoGeografico=2&idEleccion=${id}`, cfg.referer),
      ]);
      eleccion.porUbicacion.push({ nombre: 'EXTRANJERO', ubigeo: null, totales: totExt?.data, participantes: partExt?.data || [] });
      console.log(`  por departamento: ${eleccion.porUbicacion.length}`);
    } else if (id === 14) {
      const dArr = (distritos?.data || []);
      for (let i = 0; i < dArr.length; i += 5) {
        const chunk = dArr.slice(i, i + 5);
        const results = await Promise.all(chunk.map(async d => {
          const [tot, part] = await Promise.all([
            getJson(page, `${BASE}/resumen-general/totales?idEleccion=14&tipoFiltro=distrito_electoral&idDistritoElectoral=${d.codigo}`, cfg.referer),
            getJson(page, `${BASE}/senadores-distrital-multiple/participantes-ubicacion-geografica?idDistritoElectoral=${d.codigo}&idEleccion=14&tipoFiltro=distrito_electoral`, cfg.referer),
          ]);
          return { nombre: d.nombre, codigoDistrito: d.codigo, totales: tot?.data, participantes: part?.data || [] };
        }));
        eleccion.porUbicacion.push(...results);
      }
      console.log(`  por distrito electoral: ${eleccion.porUbicacion.length}`);
    }

    bag.elecciones[id] = eleccion;
  }

  await browser.close();

  // Escribir JSON completo como backup
  await fs.writeFile('/tmp/onpe_full_dump.json', JSON.stringify(bag, null, 2));
  console.log(`\nBackup JSON: /tmp/onpe_full_dump.json (${(await fs.stat('/tmp/onpe_full_dump.json')).size.toLocaleString()} bytes)`);

  // ───── Construir XLSX
  const wb = XLSX.utils.book_new();

  // Hoja: Metadata
  const meta = [
    ['ONPE — Elecciones Generales Perú 2026'],
    ['Generado', new Date().toISOString()],
    [],
    ['Campo', 'Valor'],
    ['Nombre proceso', bag.meta.nombre || ''],
    ['Acrónimo', bag.meta.acronimo || ''],
    ['Fecha proceso', fmtDate(bag.meta.fechaProceso)],
    ['ID proceso', bag.meta.id || ''],
    ['Tipo', bag.meta.tipoProcesoElectoral || ''],
    [],
    ['Fuente', 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend/*'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Metadata');

  // Hoja: Resumen por elección
  const resumenRows = [['Elección', 'ID', 'Actas %', 'Actas contabilizadas', 'Total actas', 'Votos emitidos', 'Votos válidos', 'Participación %', 'Actualizado']];
  for (const [id, e] of Object.entries(bag.elecciones)) {
    const t = e.totalesNac;
    resumenRows.push([
      e.nombre, Number(id),
      t?.actasContabilizadas ?? '', t?.contabilizadas ?? '', t?.totalActas ?? '',
      t?.totalVotosEmitidos ?? '', t?.totalVotosValidos ?? '',
      t?.participacionCiudadana ?? '', fmtDate(t?.fechaActualizacion),
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenRows), 'Resumen elecciones');

  // Función genérica para aplanar participantes a filas
  function partidosRows(participantes) {
    return participantes.map(p => ({
      partido: p.nombreAgrupacionPolitica || '',
      codigo: p.codigoAgrupacionPolitica ?? '',
      candidato: p.nombreCandidato || '',
      dni: p.dniCandidato || '',
      votos: p.totalVotosValidos ?? 0,
      pct_validos: p.porcentajeVotosValidos ?? 0,
      pct_emitidos: p.porcentajeVotosEmitidos ?? 0,
      total_candidatos: p.totalCandidatos ?? '',
      posicion: p.posicion ?? '',
    }));
  }

  // ───── PRESIDENCIAL — nacional + por departamento
  const pres = bag.elecciones[10];
  if (pres) {
    const nac = partidosRows(pres.participantesNac)
      .sort((a, b) => b.votos - a.votos);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nac), 'Presid · Nacional');

    const deptRows = [];
    for (const u of pres.porUbicacion) {
      const sorted = [...u.participantes].sort((a, b) => (b.totalVotosValidos || 0) - (a.totalVotosValidos || 0));
      sorted.forEach((p, idx) => {
        deptRows.push({
          departamento: u.nombre,
          actas_pct: u.totales?.actasContabilizadas ?? '',
          votos_emitidos: u.totales?.totalVotosEmitidos ?? '',
          votos_validos: u.totales?.totalVotosValidos ?? '',
          ranking: idx + 1,
          partido: p.nombreAgrupacionPolitica || '',
          candidato: p.nombreCandidato || '',
          dni: p.dniCandidato || '',
          votos: p.totalVotosValidos ?? 0,
          pct_validos: p.porcentajeVotosValidos ?? 0,
          pct_emitidos: p.porcentajeVotosEmitidos ?? 0,
        });
      });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptRows), 'Presid · Por depto');
  }

  // ───── SENADO ÚNICO
  const sen15 = bag.elecciones[15];
  if (sen15) {
    const rows = partidosRows(sen15.participantesNac).sort((a, b) => b.votos - a.votos);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Senado Único');
  }

  // ───── SENADO MÚLTIPLE (por distrito)
  const sen14 = bag.elecciones[14];
  if (sen14) {
    const rows = [];
    for (const u of sen14.porUbicacion) {
      const sorted = [...u.participantes].sort((a, b) => (b.totalVotosValidos || 0) - (a.totalVotosValidos || 0));
      sorted.forEach((p, idx) => {
        rows.push({
          distrito_electoral: u.nombre,
          codigo_distrito: u.codigoDistrito,
          actas_pct: u.totales?.actasContabilizadas ?? '',
          votos_emitidos: u.totales?.totalVotosEmitidos ?? '',
          votos_validos: u.totales?.totalVotosValidos ?? '',
          escanos_distrito: Math.max(0, ...u.participantes.map(x => x.totalCandidatos || 0)),
          ranking: idx + 1,
          partido: p.nombreAgrupacionPolitica || '',
          codigo_partido: p.codigoAgrupacionPolitica ?? '',
          votos: p.totalVotosValidos ?? 0,
          pct_validos: p.porcentajeVotosValidos ?? 0,
          pct_emitidos: p.porcentajeVotosEmitidos ?? 0,
          candidatos_en_lista: p.totalCandidatos ?? 0,
        });
      });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Senado Múltiple');
  }

  // ───── DIPUTADOS
  const dip = bag.elecciones[13];
  if (dip) {
    const nac = partidosRows(dip.participantesNac).sort((a, b) => b.votos - a.votos);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nac), 'Diputados · Nac');

    const deptRows = [];
    for (const u of dip.porUbicacion) {
      const sorted = [...u.participantes].sort((a, b) => (b.totalVotosValidos || 0) - (a.totalVotosValidos || 0));
      sorted.forEach((p, idx) => {
        deptRows.push({
          departamento: u.nombre,
          actas_pct: u.totales?.actasContabilizadas ?? '',
          ranking: idx + 1,
          partido: p.nombreAgrupacionPolitica || '',
          codigo: p.codigoAgrupacionPolitica ?? '',
          votos: p.totalVotosValidos ?? 0,
          pct_validos: p.porcentajeVotosValidos ?? 0,
        });
      });
    }
    if (deptRows.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptRows), 'Diputados · Por depto');
  }

  // ───── PARLAMENTO ANDINO
  const pa = bag.elecciones[12];
  if (pa) {
    const rows = partidosRows(pa.participantesNac).sort((a, b) => b.votos - a.votos);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Parl. Andino');
  }

  XLSX.writeFile(wb, OUT);
  console.log(`\n✓ XLSX: ${OUT}`);
  console.log(`  hojas: ${wb.SheetNames.join(' · ')}`);
  console.log(`  tiempo: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

main().catch(e => { console.error(e); process.exit(1); });
