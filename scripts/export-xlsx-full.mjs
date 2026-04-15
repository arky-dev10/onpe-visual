// Exporta TODA la info scrapeada a XLSX en ~/Desktop/onpe-elecciones-2026-completo.xlsx
import * as XLSX from 'xlsx';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const DATA_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'data');
const OUT = path.join(os.homedir(), 'Desktop', 'onpe-elecciones-2026-completo.xlsx');

const presidencial = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'onpe.json'), 'utf8'));
const senadores = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'senadores.json'), 'utf8'));
const diputados = JSON.parse(await fs.readFile(path.join(DATA_DIR, 'diputados.json'), 'utf8'));

const wb = XLSX.utils.book_new();

// ─────── Metadata
const meta = [
  ['ONPE · Elecciones Generales Perú 2026 · Dashboard Goberna'],
  ['Generado', new Date().toLocaleString('es-PE', { timeZone: 'America/Lima' })],
  [],
  ['Elección', 'Actas %', 'Actualizado', 'Escaños'],
  ['Presidencial',     presidencial.pctActas?.toFixed(3) + '%', presidencial.fechaActualizacion, '—'],
  ['Senado nacional',  senadores.nacional.pctActas?.toFixed(3) + '%', senadores.nacional.fechaActualizacion, senadores.nacional.escanosTotales],
  ['Senado regional',  '—', '—', senadores.regional.escanosTotales],
  ['Diputados',        '—', new Date(diputados._scrapedAt).toLocaleString('es-PE'), diputados.totalEscanos],
  [],
  ['Fuente', 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend/*'],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), 'Metadata');

// ─────── Presidencial · Nacional
const presNac = [[
  'Candidato', 'Pct (%)', 'Votos', 'Probabilidad 2da vuelta (%)',
]];
const PCAND_MAP = {
  fujimori: 'Keiko Fujimori',
  rla: 'Rafael López Aliaga',
  sanchez: 'Roberto Sánchez',
  nieto: 'Jorge Nieto',
  belmont: 'Ricardo Belmont',
};
for (const [k, name] of Object.entries(PCAND_MAP)) {
  presNac.push([name, presidencial.projection[k], presidencial.votes?.[k] || '', presidencial.probabilities?.[k] || 0]);
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(presNac), 'Presid · Nacional');

// ─────── Presidencial · Por departamento
const presDept = [];
for (const r of presidencial.regions) {
  const vals = { fujimori: r.fujimori, rla: r.rla, sanchez: r.sanchez, nieto: r.nieto, belmont: r.belmont };
  const winner = Object.entries(vals).sort((a, b) => b[1] - a[1])[0][0];
  presDept.push({
    departamento: r.name,
    actas_pct: r.pct,
    ganador: PCAND_MAP[winner],
    fujimori_pct: r.fujimori,
    rla_pct: r.rla,
    sanchez_pct: r.sanchez,
    nieto_pct: r.nieto,
    belmont_pct: r.belmont,
    actas_revisadas: r.actasRevisadas || '',
    actas_total: r.actasTotal || '',
  });
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(presDept), 'Presid · Por depto');

// ─────── Senado Nacional (partidos)
const senNacRows = senadores.nacional.partidos.map((p, i) => ({
  rank: i + 1,
  partido: p.nombre,
  codigo: p.codigo,
  votos: p.votos,
  pct: p.pct,
  sobre_valla: p.pct >= senadores.nacional.valla,
  escanos: senadores.nacional.escanos[p.codigo] || 0,
}));
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(senNacRows), 'Senado Nacional · Partidos');

// ─────── Senado Nacional (candidatos electos)
const senNacCand = [];
for (const p of senadores.nacional.partidos) {
  const escanos = senadores.nacional.escanos[p.codigo] || 0;
  if (escanos === 0) continue;
  const clist = Array.isArray(p.candidatos) ? p.candidatos : [];
  clist.forEach((c, i) => {
    senNacCand.push({
      partido: p.nombre,
      pos_partido: i + 1,
      candidato: c.nombre,
      dni: c.dni,
      votos_preferenciales: c.votosPreferenciales,
      electo: c.electo ? 'SÍ' : 'No',
    });
  });
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(senNacCand), 'Senado Nac · Candidatos');

// ─────── Senado Regional (distritos)
const senRegDist = senadores.regional.distritos.map(d => ({
  distrito: d.nombre,
  codigo: d.codigo,
  escanos: d.escanos,
  actas_pct: d.pctActas,
  ganador: d.ganador,
  total_votos_validos: d.totalVotosValidos,
}));
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(senRegDist), 'Senado Reg · Distritos');

// ─────── Senado Regional (partido × distrito)
const senRegRows = [];
for (const d of senadores.regional.distritos) {
  for (const p of d.partidos) {
    if ((d.asignacion[p.codigo] || 0) === 0 && p.votos === 0) continue;
    senRegRows.push({
      distrito: d.nombre,
      partido: p.nombre,
      codigo: p.codigo,
      votos: p.votos,
      pct: p.pct,
      escanos: d.asignacion[p.codigo] || 0,
    });
  }
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(senRegRows), 'Senado Reg · Partidos');

// ─────── Senado Regional resumen nacional
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(senadores.regional.resumenPartidos), 'Senado Reg · Resumen');

// ─────── Diputados · Resumen nacional
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diputados.resumenPartidos), 'Diputados · Resumen');

// ─────── Diputados · Distritos
const dipDist = diputados.distritos.map(d => ({
  distrito: d.nombre,
  codigo: d.codigo,
  escanos: d.escanos,
  actas_pct: d.pctActas,
  ganador: d.ganador,
  total_votos_validos: d.totalVotosValidos,
}));
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dipDist), 'Diputados · Distritos');

// ─────── Diputados · Partidos por distrito
const dipPart = [];
for (const d of diputados.distritos) {
  for (const p of d.partidos) {
    if (p.escanos === 0 && p.votos < 100) continue;
    dipPart.push({
      distrito: d.nombre,
      partido: p.nombre,
      codigo: p.codigo,
      votos: p.votos,
      pct: p.pct,
      escanos: p.escanos,
      total_candidatos: p.totalCandidatos,
    });
  }
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dipPart), 'Diputados · Partidos');

// ─────── Diputados · Electos (candidatos)
const dipElectos = [];
for (const d of diputados.distritos) {
  for (const p of d.partidos) {
    if (p.escanos === 0) continue;
    const electos = (p.candidatos || []).filter(c => c.electo);
    electos.forEach((c, i) => {
      dipElectos.push({
        distrito: d.nombre,
        partido: p.nombre,
        pos: i + 1,
        candidato: c.nombre,
        dni: c.dni,
        votos_preferenciales: c.votosPreferenciales,
        lista_cedula: c.lista,
      });
    });
  }
}
XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dipElectos), 'Diputados · Electos');

XLSX.writeFile(wb, OUT);
console.log(`✓ XLSX generado: ${OUT}`);
console.log(`  hojas: ${wb.SheetNames.join(' · ')}`);
