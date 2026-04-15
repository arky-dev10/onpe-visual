import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { CANDIDATES, getWinner } from '../data/candidates';
import type { CandKey, RegionResult } from '../types';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/per.topo.json';

// Lat/lon aproximado del centroide de cada departamento
const GEO_CENTERS: Record<string, [number, number]> = {
  'Amazonas':[-78,-6],'Áncash':[-77.5,-9.3],'Apurímac':[-73,-14],'Arequipa':[-72,-15.8],
  'Ayacucho':[-74,-13.8],'Cajamarca':[-78.5,-6.8],'Callao':[-77.12,-12.05],'Cusco':[-72,-13.2],
  'Huancavelica':[-75.2,-13],'Huánuco':[-76.2,-9.5],'Ica':[-75.5,-14.5],'Junín':[-75.3,-11.5],
  'La Libertad':[-78.5,-8],'Lambayeque':[-79.8,-6.5],'Lima':[-76.6,-12],'Loreto':[-75.5,-4.5],
  'Madre de Dios':[-70.5,-12],'Moquegua':[-70.9,-17],'Pasco':[-76,-10.4],'Piura':[-80.3,-5],
  'Puno':[-70,-15.2],'San Martín':[-76.7,-7],'Tacna':[-70.3,-17.6],'Tumbes':[-80.4,-3.7],
  'Ucayali':[-74,-9.5],
};

function haversine(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLng = (b[0] - a[0]) * Math.PI / 180;
  const x = Math.sin(dLat/2) ** 2
    + Math.cos(a[1] * Math.PI/180) * Math.cos(b[1] * Math.PI/180) * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function buildGeoMatch(features: Feature<Geometry, any>[], pathGen: d3.GeoPath<any, any>): Record<number, string> {
  const assigned = new Set<string>();
  const map: Record<number, string> = {};
  const items = features.map((f, i) => ({
    idx: i,
    centroid: d3.geoCentroid(f as any),
    area: pathGen.area(f as any),
  })).sort((a, b) => b.area - a.area);
  for (const it of items) {
    let best: string | null = null;
    let dist = Infinity;
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

interface Props {
  regions: RegionResult[];
  source: string;
  onSelect: (r: RegionResult) => void;
}

// Labels de departamentos pequeños (offset desde el centroide)
const SMALL_DEPTS: Record<string, { dx: number; dy: number }> = {
  'Callao':   { dx: -55, dy: 15 },
  'Tumbes':   { dx:  20, dy: -18 },
  'Moquegua': { dx:  30, dy:  10 },
};

export function MapDept({ regions, source, onSelect }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      const wrap = wrapRef.current;
      const el = svgRef.current;
      if (!wrap || !el) return;
      el.innerHTML = '';
      setError(null);
      setLoading(true);

      let W = wrap.clientWidth || 500;
      let H = wrap.clientHeight || Math.round(W * 1.33);

      try {
        if (!topoCache) topoCache = (await d3.json<Topology>(TOPO_URL))!;
      } catch (e) {
        setError('No se pudo cargar el mapa');
        return;
      }
      if (cancelled) return;
      const topo = topoCache!;
      const objKey = 'per' in topo.objects ? 'per' : Object.keys(topo.objects)[0];
      const obj = topo.objects[objKey] as GeometryCollection;
      const fc = feature(topo, obj) as unknown as FeatureCollection;
      const features = fc.features;

      const margin = W * 0.04;
      const projection = d3.geoMercator()
        .fitExtent([[margin, margin], [W - margin, H - margin]], { type: 'FeatureCollection', features } as any);
      const pathGen = d3.geoPath(projection as any);
      const match = buildGeoMatch(features, pathGen);

      const regMap: Record<string, RegionResult> = {};
      regions.forEach(r => { regMap[r.name] = r; });

      const svg = d3.select(el).append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      svg.selectAll('path')
        .data(features)
        .join('path')
        .attr('d', pathGen as any)
        .attr('class', 'dept-path animate-in')
        .attr('fill', (_d, i) => {
          const dept = match[i];
          const r = dept ? regMap[dept] : null;
          if (!r) return '#2a2d38';
          return CANDIDATES[getWinner(r) as CandKey].color;
        })
        .style('animation-delay', (_d, i) => `${i * 60}ms`)
        .on('click', (_e, d) => {
          const i = features.indexOf(d as any);
          const dept = match[i];
          if (dept && regMap[dept]) onSelect(regMap[dept]);
        });

      // etiquetas %
      const labelG = svg.append('g').attr('class', 'dept-labels');
      features.forEach((f, i) => {
        const dept = match[i];
        const r = dept ? regMap[dept] : null;
        if (!r || typeof r.pct === 'undefined') return;
        const centroid = pathGen.centroid(f as any);
        if (isNaN(centroid[0])) return;
        const pctText = `${Math.round(r.pct)}%`;
        const fontSize = W < 400 ? 7 : 8.5;
        const delay = `${i * 60 + 400}ms`;
        const small = SMALL_DEPTS[dept];

        if (small) {
          const tx = centroid[0] + small.dx;
          const ty = centroid[1] + small.dy;
          labelG.append('line')
            .attr('x1', centroid[0]).attr('y1', centroid[1])
            .attr('x2', tx).attr('y2', ty)
            .attr('stroke', 'rgba(255,255,255,.4)').attr('stroke-width', 0.7)
            .style('opacity', 0)
            .style('animation', `fadeUp .4s ease ${delay} forwards`);
          labelG.append('circle')
            .attr('cx', centroid[0]).attr('cy', centroid[1]).attr('r', 2)
            .attr('fill', 'rgba(255,255,255,.5)')
            .style('opacity', 0)
            .style('animation', `fadeUp .4s ease ${delay} forwards`);
          labelG.append('text')
            .attr('x', tx).attr('y', ty + 3)
            .attr('text-anchor', small.dx < 0 ? 'end' : 'start')
            .attr('font-size', fontSize)
            .attr('font-family', '"JetBrains Mono", monospace')
            .attr('font-weight', 600).attr('fill', '#fff')
            .attr('paint-order', 'stroke')
            .attr('stroke', '#0f1117').attr('stroke-width', 2.5)
            .text(pctText)
            .style('opacity', 0)
            .style('animation', `fadeUp .4s ease ${delay} forwards`);
        } else {
          labelG.append('text')
            .attr('x', centroid[0]).attr('y', centroid[1] + 3)
            .attr('text-anchor', 'middle')
            .attr('font-size', fontSize)
            .attr('font-family', '"JetBrains Mono", monospace')
            .attr('font-weight', 600).attr('fill', '#fff')
            .attr('paint-order', 'stroke')
            .attr('stroke', 'rgba(15,17,23,.75)').attr('stroke-width', 2.5)
            .text(pctText)
            .style('opacity', 0)
            .style('animation', `fadeUp .4s ease ${delay} forwards`);
        }
      });

      // globo Extranjero (esquina inferior izquierda)
      const ext = regions.find(r => r.name.toLowerCase().startsWith('extr'));
      if (ext) {
        const winKey = getWinner(ext) as CandKey;
        const winColor = CANDIDATES[winKey].color;
        const gx = W * 0.12, gy = H * 0.82, gr = 16;
        const extG = svg.append('g').attr('class', 'ext-globe')
          .style('cursor', 'pointer').style('opacity', 0)
          .style('animation', 'fadeUp .6s ease 2s forwards')
          .on('click', () => onSelect(ext));
        extG.append('circle').attr('cx', gx).attr('cy', gy).attr('r', gr + 4)
          .attr('fill', 'none').attr('stroke', 'rgba(74,144,217,.15)').attr('stroke-width', 1.5);
        extG.append('circle').attr('cx', gx).attr('cy', gy).attr('r', gr)
          .attr('fill', winColor).attr('opacity', .2)
          .attr('stroke', winColor).attr('stroke-width', 1.5);
        const g2 = extG.append('g').attr('transform', `translate(${gx},${gy})`);
        g2.append('ellipse').attr('rx', gr*0.45).attr('ry', gr*0.9)
          .attr('fill','none').attr('stroke', winColor).attr('stroke-width',.7).attr('opacity',.5);
        g2.append('line').attr('x1',-gr).attr('x2',gr).attr('y1',0).attr('y2',0)
          .attr('stroke', winColor).attr('stroke-width',.5).attr('opacity',.4);
        g2.append('line').attr('x1',-gr*.85).attr('x2',gr*.85).attr('y1',-gr*.5).attr('y2',-gr*.5)
          .attr('stroke', winColor).attr('stroke-width',.4).attr('opacity',.3);
        g2.append('line').attr('x1',-gr*.85).attr('x2',gr*.85).attr('y1',gr*.5).attr('y2',gr*.5)
          .attr('stroke', winColor).attr('stroke-width',.4).attr('opacity',.3);
        extG.append('text').attr('x', gx).attr('y', gy + gr + 12)
          .attr('text-anchor', 'middle').attr('font-size', 9)
          .attr('font-family', '"JetBrains Mono", monospace').attr('font-weight', 700)
          .attr('fill', '#fff').text('Extranjero');
      }

      setLoading(false);
    }
    draw();
    return () => { cancelled = true; };
  }, [regions, onSelect]);

  return (
    <>
      <div className="legend">
        {Object.values(CANDIDATES).map(c => (
          <span key={c.key} className="legend-item">
            <i className="legend-dot" style={{ background: c.color }} />
            {c.name}
          </span>
        ))}
      </div>
      <div className="map-container" ref={wrapRef}>
        <div ref={svgRef} style={{ width: '100%', height: '100%' }} />
        {loading && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--tx3)', fontSize: 12, pointerEvents: 'none' }}>
            Cargando mapa…
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--c-sanch)', fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>
        Fuente: {source}
      </div>
    </>
  );
}
