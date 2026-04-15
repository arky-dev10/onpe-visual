import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { CANDIDATES, CAND_ORDER, getWinner } from '../data/candidates';
import type { RegionResult, CandKey } from '../types';
import { MapProvincias } from './MapProvincias';
import { CandidatePhoto } from './CandidatePhoto';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/per.topo.json';

const GEO_CENTERS: Record<string, [number, number]> = {
  'Amazonas':[-78,-6],'Áncash':[-77.5,-9.3],'Apurímac':[-73,-14],'Arequipa':[-72,-15.8],
  'Ayacucho':[-74,-13.8],'Cajamarca':[-78.5,-6.8],'Callao':[-77.12,-12.05],'Cusco':[-72,-13.2],
  'Huancavelica':[-75.2,-13],'Huánuco':[-76.2,-9.5],'Ica':[-75.5,-14.5],'Junín':[-75.3,-11.5],
  'La Libertad':[-78.5,-8],'Lambayeque':[-79.8,-6.5],'Lima':[-76.6,-12],'Loreto':[-75.5,-4.5],
  'Madre de Dios':[-70.5,-12],'Moquegua':[-70.9,-17],'Pasco':[-76,-10.4],'Piura':[-80.3,-5],
  'Puno':[-70,-15.2],'San Martín':[-76.7,-7],'Tacna':[-70.3,-17.6],'Tumbes':[-80.4,-3.7],
  'Ucayali':[-74,-9.5],
};

const DEPT_UBIGEO: Record<string, string> = {
  'Amazonas': '010000', 'Áncash': '020000', 'Apurímac': '030000', 'Arequipa': '040000',
  'Ayacucho': '050000', 'Cajamarca': '060000', 'Callao': '240000', 'Cusco': '070000',
  'Huancavelica': '080000', 'Huánuco': '090000', 'Ica': '100000', 'Junín': '110000',
  'La Libertad': '120000', 'Lambayeque': '130000', 'Lima': '140000', 'Loreto': '150000',
  'Madre de Dios': '160000', 'Moquegua': '170000', 'Pasco': '180000', 'Piura': '190000',
  'Puno': '200000', 'San Martín': '210000', 'Tacna': '220000', 'Tumbes': '230000',
  'Ucayali': '250000',
};

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLng = (b[0] - a[0]) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 + Math.cos(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function buildGeoMatch(features: Feature<Geometry, any>[], pathGen: d3.GeoPath<any, any>): Record<number, string> {
  const assigned = new Set<string>();
  const map: Record<number, string> = {};
  const items = features.map((f, i) => ({
    idx: i, centroid: d3.geoCentroid(f as any), area: pathGen.area(f as any),
  })).sort((a, b) => b.area - a.area);
  for (const it of items) {
    let best: string | null = null; let dist = Infinity;
    for (const [dept, ctr] of Object.entries(GEO_CENTERS)) {
      if (assigned.has(dept)) continue;
      const d = haversine([it.centroid[0], it.centroid[1]], ctr);
      if (d < dist) { dist = d; best = dept; }
    }
    if (best && dist < 300) { map[it.idx] = best; assigned.add(best); }
  }
  return map;
}

let topoCache: Topology | null = null;

// Paleta presidencial (5 candidatos principales)
const PRES_COLORS: Record<string, string> = {
  '8':  '#E8943A',  '35': '#4A90D9',  '16': '#2ECDA7',
  '10': '#E04848',  '14': '#F5D76E',
};
const presColorOf = (cod: string) => PRES_COLORS[cod] || '#6b7280';

interface ProvinciaPartido { partido: string; candidato: string | null; codigo: string; votos: number; pct: number; }
interface Provincia { ubigeo: string; nombre: string; pctActas: number; votosEmitidos: number; votosValidos: number; ganador: ProvinciaPartido | null; partidos: ProvinciaPartido[]; }

type Level = 'pais' | 'dept';

interface Props {
  regions: RegionResult[];
  source: string;
}

export function PresidencialExplorer({ regions, source }: Props) {
  const [level, setLevel] = useState<Level>('pais');
  const [dept, setDept] = useState<RegionResult | null>(null);
  const [hoverDept, setHoverDept] = useState<RegionResult | null>(null);
  const [provincias, setProvincias] = useState<Provincia[] | null>(null);
  const [hoverProv, setHoverProv] = useState<Provincia | null>(null);
  const [loadingProv, setLoadingProv] = useState(false);

  const regionById = useMemo(() => {
    const m = new Map<string, RegionResult>();
    regions.forEach(r => m.set(r.name, r));
    return m;
  }, [regions]);

  const goToPais = useCallback(() => {
    setLevel('pais'); setDept(null); setProvincias(null); setHoverProv(null);
  }, []);

  const goToDept = useCallback((r: RegionResult) => {
    setLevel('dept'); setDept(r); setHoverProv(null);
  }, []);

  useEffect(() => {
    if (level !== 'dept' || !dept) return;
    const ubigeo = DEPT_UBIGEO[dept.name];
    if (!ubigeo) return;
    let alive = true;
    setLoadingProv(true); setProvincias(null);
    (async () => {
      try {
        const r = await fetch(`/api/provincias?dept=${ubigeo}`);
        if (!r.ok) throw 0;
        const j = await r.json();
        if (alive) { setProvincias(j.provincias || []); setLoadingProv(false); }
      } catch { if (alive) setLoadingProv(false); }
    })();
    return () => { alive = false; };
  }, [level, dept]);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="explorer-crumbs">
        <button className={`crumb ${level === 'pais' ? 'active' : ''}`} onClick={goToPais}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          Perú
        </button>
        {dept && (
          <>
            <span className="crumb-sep">›</span>
            <button className={`crumb active`} style={{ cursor: 'default' }}>{dept.name}</button>
          </>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>
          {source} · {regions.length} regiones
        </div>
      </div>

      <div className="explorer-grid">
        <div className="explorer-map">
          {level === 'pais' && (
            <DeptsMap regions={regions} onSelect={goToDept} onHover={setHoverDept} />
          )}
          {level === 'dept' && dept && (
            <>
              {loadingProv && (
                <div style={{ padding: 50, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>
                  Cargando provincias de {dept.name}…
                </div>
              )}
              {!loadingProv && provincias && (
                <MapProvincias
                  deptNombre={dept.name}
                  provincias={provincias}
                  colorOf={presColorOf}
                  onHover={setHoverProv}
                />
              )}
            </>
          )}
        </div>

        <div className="explorer-panel">
          {level === 'pais' && <PaisPanel hoverDept={hoverDept} onPick={goToDept} />}
          {level === 'dept' && dept && (
            <DeptPanel dept={dept} hoverProv={hoverProv} onBack={goToPais} regionById={regionById} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Mapa nivel país (departamentos del presidencial) ──
const DeptsMap = memo(function DeptsMap({ regions, onSelect, onHover }: {
  regions: RegionResult[];
  onSelect: (r: RegionResult) => void;
  onHover: (r: RegionResult | null) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const onSelectRef = useRef(onSelect);
  const onHoverRef = useRef(onHover);
  useEffect(() => { onSelectRef.current = onSelect; onHoverRef.current = onHover; });

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      const wrap = wrapRef.current;
      const el = svgRef.current;
      if (!wrap || !el) return;
      el.innerHTML = '';
      setLoading(true);
      const W = wrap.clientWidth || 500;
      const H = wrap.clientHeight || Math.round(W * 1.33);

      try { if (!topoCache) topoCache = (await d3.json<Topology>(TOPO_URL))!; } catch { return; }
      if (cancelled) return;

      const topo = topoCache!;
      const objKey = 'per' in topo.objects ? 'per' : Object.keys(topo.objects)[0];
      const obj = topo.objects[objKey] as GeometryCollection;
      const fc = feature(topo, obj) as unknown as FeatureCollection;
      const features = fc.features;

      const margin = W * 0.04;
      const projection = d3.geoMercator().fitExtent([[margin, margin], [W - margin, H - margin]], { type: 'FeatureCollection', features } as any);
      const pathGen = d3.geoPath(projection as any);
      const match = buildGeoMatch(features, pathGen);

      const byName: Record<string, RegionResult> = {};
      regions.forEach(r => { byName[r.name] = r; });

      const svg = d3.select(el).append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      svg.selectAll('path').data(features).join('path')
        .attr('d', pathGen as any)
        .attr('class', 'dept-path animate-in')
        .attr('fill', (_d, i) => {
          const dept = match[i];
          const r = dept ? byName[dept] : null;
          if (!r) return '#2a2d38';
          return CANDIDATES[getWinner(r) as CandKey].color;
        })
        .style('animation-delay', (_d, i) => `${i * 60}ms`)
        .on('click', (_e, d) => {
          const i = features.indexOf(d as any);
          const r = byName[match[i]];
          if (r) onSelectRef.current(r);
        })
        .on('mouseenter', function (this: any, _e, d: any) {
          d3.select(this).attr('stroke', '#000').attr('stroke-width', 2);
          const i = features.indexOf(d);
          const r = byName[match[i]];
          onHoverRef.current(r || null);
        })
        .on('mouseleave', function (this: any) {
          d3.select(this).attr('stroke', '#0f1117').attr('stroke-width', 0.5);
          onHoverRef.current(null);
        });

      // etiquetas ganador + %
      const labelG = svg.append('g').attr('class', 'dept-labels').style('pointer-events', 'none');
      features.forEach((f, i) => {
        const dept = match[i];
        const r = dept ? byName[dept] : null;
        if (!r) return;
        const centroid = pathGen.centroid(f as any);
        if (isNaN(centroid[0])) return;
        const w = CANDIDATES[getWinner(r) as CandKey];
        const val = (r as any)[getWinner(r)];
        labelG.append('text')
          .attr('x', centroid[0]).attr('y', centroid[1] + 3)
          .attr('text-anchor', 'middle')
          .attr('font-size', 9).attr('font-family', '"JetBrains Mono", monospace').attr('font-weight', 700)
          .attr('fill', '#fff').attr('paint-order', 'stroke')
          .attr('stroke', 'rgba(0,0,0,.6)').attr('stroke-width', 2.5)
          .text(`${Math.round(val)}%`)
          .style('opacity', 0).style('animation', `fadeUp .4s ease ${i * 60 + 300}ms forwards`);
        void w;
      });

      setLoading(false);
    }
    draw();
    return () => { cancelled = true; };
  }, [regions]);

  return (
    <div ref={wrapRef} style={{ width: '100%', aspectRatio: '3/4', maxHeight: 520, position: 'relative' }}>
      <div ref={svgRef} style={{ width: '100%', height: '100%' }} />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--tx3)', fontSize: 12, pointerEvents: 'none' }}>
          Cargando mapa…
        </div>
      )}
    </div>
  );
});

// ── Panel nivel país ──
const PaisPanel = memo(function PaisPanel({ hoverDept, onPick }: { hoverDept: RegionResult | null; onPick: (r: RegionResult) => void }) {
  if (hoverDept) {
    return <DeptMiniStats region={hoverDept} onPick={() => onPick(hoverDept)} />;
  }
  return (
    <div className="panel-wrap">
      <div className="panel-kicker">VISTA NACIONAL</div>
      <div className="panel-title">Elecciones Presidenciales</div>
      <div className="panel-sub">Pasa el cursor sobre un departamento para ver el detalle</div>
      <div className="panel-hint" style={{ marginTop: 14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Click en un departamento para abrir sus provincias con el voto por candidato presidencial.
      </div>

      <div className="panel-subtitle">Candidatos en carrera</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        {CAND_ORDER.map(k => {
          const c = CANDIDATES[k];
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <CandidatePhoto dni={undefined} nombre={c.name} color={c.color} size={32} ring={false} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx1)' }}>{c.name}</div>
                <div style={{ fontSize: 10, color: 'var(--tx3)' }}>{c.short}</div>
              </div>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color }} />
            </div>
          );
        })}
      </div>
    </div>
  );
});

const DeptMiniStats = memo(function DeptMiniStats({ region, onPick }: { region: RegionResult; onPick: () => void }) {
  const winner = getWinner(region) as CandKey;
  const color = CANDIDATES[winner].color;
  const sorted = CAND_ORDER.map(k => ({ k, v: (region as any)[k] || 0 })).sort((a, b) => b.v - a.v).slice(0, 5);
  const maxPct = sorted[0]?.v || 1;

  return (
    <div className="panel-wrap">
      <div className="panel-kicker" style={{ color }}>DEPARTAMENTO</div>
      <div className="panel-title">{region.name}</div>
      <div className="panel-sub">actas {region.pct.toFixed(1)}%</div>

      <div style={{ marginTop: 10 }}>
        {sorted.map(({ k, v }) => {
          const c = CANDIDATES[k];
          return (
            <div key={k} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: c.color }}>{c.name}</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color: c.color }}>{v.toFixed(2)}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-alt)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${(v / maxPct) * 100}%`, background: c.color, borderRadius: 3, transition: 'width .3s' }} />
              </div>
            </div>
          );
        })}
      </div>

      <button onClick={onPick} className="panel-cta">
        Ver provincias de {region.name}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
    </div>
  );
});

// ── Panel nivel depto (dentro del dept, con provincias) ──
const DeptPanel = memo(function DeptPanel({ dept, hoverProv, onBack, regionById }: {
  dept: RegionResult;
  hoverProv: Provincia | null;
  onBack: () => void;
  regionById: Map<string, RegionResult>;
}) {
  void regionById;
  if (hoverProv) {
    const winnerColor = hoverProv.ganador ? presColorOf(hoverProv.ganador.codigo) : 'var(--tx3)';
    const pctMax = hoverProv.partidos[0]?.pct || 1;
    return (
      <div className="panel-wrap">
        <button onClick={onBack} className="panel-back">‹ Perú</button>
        <div className="panel-kicker" style={{ color: winnerColor }}>PROVINCIA · {dept.name.toUpperCase()}</div>
        <div className="panel-title">{hoverProv.nombre}</div>
        <div className="panel-sub">actas {hoverProv.pctActas.toFixed(1)}% · {hoverProv.votosEmitidos.toLocaleString('es-PE')} votos</div>

        <div className="panel-subtitle">Top candidatos</div>
        <div style={{ marginTop: 6 }}>
          {hoverProv.partidos.slice(0, 5).map(p => {
            const color = presColorOf(p.codigo);
            return (
              <div key={p.codigo} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color }}>
                    {p.candidato ? p.candidato.split(' ').slice(0, 3).join(' ') : p.partido.slice(0, 20)}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color }}>{p.pct.toFixed(2)}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-alt)', borderRadius: 3 }}>
                  <div style={{ height: '100%', width: `${(p.pct / pctMax) * 100}%`, background: color, borderRadius: 3, transition: 'width .3s' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const winner = getWinner(dept) as CandKey;
  const sorted = CAND_ORDER.map(k => ({ k, v: (dept as any)[k] || 0 })).sort((a, b) => b.v - a.v);
  const maxPct = sorted[0]?.v || 1;

  return (
    <div className="panel-wrap">
      <button onClick={onBack} className="panel-back">‹ Perú</button>
      <div className="panel-kicker" style={{ color: CANDIDATES[winner].color }}>DEPARTAMENTO</div>
      <div className="panel-title">{dept.name}</div>
      <div className="panel-sub">actas {dept.pct.toFixed(2)}%</div>

      <div className="panel-subtitle">Resultado por candidato</div>
      <div style={{ marginTop: 6 }}>
        {sorted.map(({ k, v }) => {
          const c = CANDIDATES[k];
          return (
            <div key={k} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: c.color }}>{c.name}</span>
                <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color: c.color }}>{v.toFixed(2)}%</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg-alt)', borderRadius: 3 }}>
                <div style={{ height: '100%', width: `${(v / maxPct) * 100}%`, background: c.color, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="panel-hint" style={{ marginTop: 14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
        Pasa el cursor sobre una provincia para ver el detalle presidencial ahí.
      </div>
    </div>
  );
});
