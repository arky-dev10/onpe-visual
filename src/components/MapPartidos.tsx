import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { colorOfPartido, type DistritoRegional } from '../data/senadoSource';

const TOPO_URL = 'https://cdn.jsdelivr.net/npm/datamaps@0.5.10/src/js/data/per.topo.json';

const GEO_CENTERS: Record<string, [number, number]> = {
  'AMAZONAS':[-78,-6],'ÁNCASH':[-77.5,-9.3],'APURÍMAC':[-73,-14],'AREQUIPA':[-72,-15.8],
  'AYACUCHO':[-74,-13.8],'CAJAMARCA':[-78.5,-6.8],'CALLAO':[-77.12,-12.05],'CUSCO':[-72,-13.2],
  'HUANCAVELICA':[-75.2,-13],'HUÁNUCO':[-76.2,-9.5],'ICA':[-75.5,-14.5],'JUNÍN':[-75.3,-11.5],
  'LA LIBERTAD':[-78.5,-8],'LAMBAYEQUE':[-79.8,-6.5],'LIMA':[-76.6,-12],'LIMA PROVINCIAS':[-76.8,-11],
  'LORETO':[-75.5,-4.5],'MADRE DE DIOS':[-70.5,-12],'MOQUEGUA':[-70.9,-17],'PASCO':[-76,-10.4],
  'PIURA':[-80.3,-5],'PUNO':[-70,-15.2],'SAN MARTÍN':[-76.7,-7],'TACNA':[-70.3,-17.6],
  'TUMBES':[-80.4,-3.7],'UCAYALI':[-74,-9.5],
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
  distritos: DistritoRegional[];
  onSelect: (d: DistritoRegional) => void;
  onHover?: (d: DistritoRegional | null) => void;
}

export function MapPartidos({ distritos, onSelect, onHover }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  // Latest-ref para callbacks: evita re-render del mapa al cambiar hover/click handlers
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

      try {
        if (!topoCache) topoCache = (await d3.json<Topology>(TOPO_URL))!;
      } catch { return; }
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

      // Map: nombre normalizado → distrito data
      const distByName: Record<string, DistritoRegional> = {};
      distritos.forEach(d => {
        const key = d.nombre.toUpperCase().trim();
        distByName[key] = d;
      });

      const svg = d3.select(el).append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      svg.selectAll('path')
        .data(features)
        .join('path')
        .attr('d', pathGen as any)
        .attr('class', 'dept-path animate-in')
        .attr('fill', (_d, i) => {
          const deptName = match[i];
          const dist = deptName ? distByName[deptName] : null;
          if (!dist || !dist.ganador) return '#2a2d38';
          return colorOfPartido(dist.ganador);
        })
        .style('animation-delay', (_d, i) => `${i * 60}ms`)
        .on('click', (_e, d) => {
          const i = features.indexOf(d as any);
          const deptName = match[i];
          const dist = deptName ? distByName[deptName] : null;
          if (dist) onSelectRef.current(dist);
        })
        .on('mouseenter', function (this: any, _e, d: any) {
          const i = features.indexOf(d);
          const deptName = match[i];
          const dist = deptName ? distByName[deptName] : null;
          d3.select(this).attr('stroke', '#000').attr('stroke-width', 2);
          if (dist) onHoverRef.current?.(dist);
        })
        .on('mouseleave', function (this: any) {
          d3.select(this).attr('stroke', '#0f1117').attr('stroke-width', 0.5);
          onHoverRef.current?.(null);
        });

      // Etiquetas: ganador + escaños asignados
      const labelG = svg.append('g').attr('class', 'dept-labels');
      features.forEach((f, i) => {
        const deptName = match[i];
        const dist = deptName ? distByName[deptName] : null;
        if (!dist || !dist.ganador) return;
        const centroid = pathGen.centroid(f as any);
        if (isNaN(centroid[0])) return;

        const gan = dist.partidos.find(p => p.codigo === dist.ganador);
        if (!gan) return;
        const seats = dist.asignacion[dist.ganador] || 0;

        const fontSize = W < 400 ? 7 : 9;
        const delay = `${i * 60 + 400}ms`;

        labelG.append('text')
          .attr('x', centroid[0]).attr('y', centroid[1] - 2)
          .attr('text-anchor', 'middle')
          .attr('font-size', fontSize)
          .attr('font-family', '"DM Mono", monospace')
          .attr('font-weight', 700)
          .attr('fill', '#fff')
          .attr('paint-order', 'stroke')
          .attr('stroke', 'rgba(0,0,0,.6)').attr('stroke-width', 2.5)
          .text(`${seats}e`)
          .style('opacity', 0)
          .style('animation', `fadeUp .4s ease ${delay} forwards`);

        labelG.append('text')
          .attr('x', centroid[0]).attr('y', centroid[1] + 8)
          .attr('text-anchor', 'middle')
          .attr('font-size', fontSize - 1)
          .attr('font-family', '"DM Mono", monospace')
          .attr('font-weight', 500)
          .attr('fill', '#fff')
          .attr('paint-order', 'stroke')
          .attr('stroke', 'rgba(0,0,0,.6)').attr('stroke-width', 2)
          .text(`${gan.pct.toFixed(0)}%`)
          .style('opacity', 0)
          .style('animation', `fadeUp .4s ease ${delay} forwards`);
      });

      setLoading(false);
    }
    draw();
    return () => { cancelled = true; };
  }, [distritos]);

  return (
    <>
      <div className="map-container" ref={wrapRef} style={{ aspectRatio: '3/4', maxHeight: 520 }}>
        <div ref={svgRef} style={{ width: '100%', height: '100%' }} />
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--tx3)', fontSize: 12, pointerEvents: 'none' }}>
            Cargando mapa…
          </div>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--tx3)', textAlign: 'center', fontFamily: 'DM Mono, monospace' }}>
        Click en un departamento para ver provincias
      </div>
    </>
  );
}
