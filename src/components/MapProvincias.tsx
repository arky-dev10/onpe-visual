import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

const PROV_URL = '/peru_provincial.geojson';

// Mapeo depto name normalizado (como aparece en GeoJSON FIRST_NOMB vs el que uso en la app)
const DEPT_MATCH: Record<string, string[]> = {
  'LIMA': ['LIMA'],
  'CALLAO': ['CALLAO'],
  'AMAZONAS': ['AMAZONAS'],
  'ÁNCASH': ['ANCASH'],
  'APURÍMAC': ['APURIMAC'],
  'AREQUIPA': ['AREQUIPA'],
  'AYACUCHO': ['AYACUCHO'],
  'CAJAMARCA': ['CAJAMARCA'],
  'CUSCO': ['CUSCO', 'CUZCO'],
  'HUANCAVELICA': ['HUANCAVELICA'],
  'HUÁNUCO': ['HUANUCO'],
  'ICA': ['ICA'],
  'JUNÍN': ['JUNIN'],
  'LA LIBERTAD': ['LA LIBERTAD'],
  'LAMBAYEQUE': ['LAMBAYEQUE'],
  'LORETO': ['LORETO'],
  'MADRE DE DIOS': ['MADRE DE DIOS'],
  'MOQUEGUA': ['MOQUEGUA'],
  'PASCO': ['PASCO'],
  'PIURA': ['PIURA'],
  'PUNO': ['PUNO'],
  'SAN MARTÍN': ['SAN MARTIN'],
  'TACNA': ['TACNA'],
  'TUMBES': ['TUMBES'],
  'UCAYALI': ['UCAYALI'],
};

function norm(s: string) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
}

let geoCache: FeatureCollection | null = null;

interface ProvinciaLike {
  ubigeo: string;
  nombre: string;
  pctActas: number;
  ganador: { codigo: string; pct: number } | null;
}

interface Props<T extends ProvinciaLike> {
  deptNombre: string;
  provincias: T[];
  colorOf: (codigo: string) => string;
  onHover?: (prov: T | null) => void;
}

export function MapProvincias<T extends ProvinciaLike>({ deptNombre, provincias, colorOf, onHover }: Props<T>) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function draw() {
      const wrap = wrapRef.current;
      const el = svgRef.current;
      if (!wrap || !el) return;
      el.innerHTML = '';
      setLoading(true);

      const W = wrap.clientWidth || 500;
      const H = wrap.clientHeight || 360;

      try {
        if (!geoCache) geoCache = (await d3.json<FeatureCollection>(PROV_URL))!;
      } catch { return; }
      if (cancelled) return;

      const allowed = DEPT_MATCH[deptNombre.toUpperCase()] || [norm(deptNombre)];
      const matches = geoCache!.features.filter(f => {
        const dep = norm(f.properties?.FIRST_NOMB || '');
        return allowed.some(a => norm(a) === dep);
      });

      if (!matches.length) {
        el.innerHTML = '<div style="padding:20px;color:var(--tx3);font-size:12px;">No hay mapa para este departamento</div>';
        setLoading(false);
        return;
      }

      const subFc: FeatureCollection = { type: 'FeatureCollection', features: matches as Feature<Geometry, any>[] };
      const margin = 10;
      const projection = d3.geoMercator()
        .fitExtent([[margin, margin], [W - margin, H - margin]], subFc as any);
      const pathGen = d3.geoPath(projection as any);

      // index provincias by normalized name
      const provByName: Record<string, T> = {};
      provincias.forEach(p => { provByName[norm(p.nombre)] = p; });

      const svg = d3.select(el).append('svg')
        .attr('viewBox', `0 0 ${W} ${H}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      svg.selectAll('path')
        .data(matches)
        .join('path')
        .attr('d', pathGen as any)
        .attr('class', 'prov-path animate-in')
        .attr('fill', (f: any) => {
          const name = norm(f.properties?.NOMBPROV || '');
          const p = provByName[name];
          if (!p || !p.ganador) return '#2a2d38';
          return colorOf(p.ganador.codigo);
        })
        .attr('stroke', '#fff')
        .attr('stroke-width', 0.7)
        .style('animation-delay', (_d: any, i: number) => `${i * 40}ms`)
        .on('mouseenter', function (this: any, _e, f: any) {
          const name = norm(f.properties?.NOMBPROV || '');
          d3.select(this).attr('stroke', '#000').attr('stroke-width', 1.5);
          onHover?.(provByName[name] || null);
        })
        .on('mouseleave', function (this: any) {
          d3.select(this).attr('stroke', '#fff').attr('stroke-width', 0.7);
          onHover?.(null);
        });

      // Labels: nombre provincia + % ganador
      const labelG = svg.append('g').attr('class', 'dept-labels').style('pointer-events', 'none');
      matches.forEach((f: any, i: number) => {
        const name = f.properties?.NOMBPROV || '';
        const p = provByName[norm(name)];
        const centroid = pathGen.centroid(f as any);
        if (isNaN(centroid[0])) return;
        const fs = Math.min(11, Math.max(7, W / 60));
        const delay = `${i * 40 + 300}ms`;

        if (p?.ganador) {
          labelG.append('text')
            .attr('x', centroid[0])
            .attr('y', centroid[1] - 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', fs)
            .attr('font-family', '"DM Sans", sans-serif')
            .attr('font-weight', 600)
            .attr('fill', '#fff')
            .attr('paint-order', 'stroke')
            .attr('stroke', 'rgba(0,0,0,0.7)')
            .attr('stroke-width', 2.5)
            .text(name.length > 12 ? name.slice(0, 10) + '…' : name)
            .style('opacity', 0)
            .style('animation', `fadeUp .3s ease ${delay} forwards`);

          labelG.append('text')
            .attr('x', centroid[0])
            .attr('y', centroid[1] + fs + 2)
            .attr('text-anchor', 'middle')
            .attr('font-size', fs - 1)
            .attr('font-family', '"DM Mono", monospace')
            .attr('font-weight', 700)
            .attr('fill', '#fff')
            .attr('paint-order', 'stroke')
            .attr('stroke', 'rgba(0,0,0,0.7)')
            .attr('stroke-width', 2)
            .text(`${p.ganador.pct.toFixed(0)}%`)
            .style('opacity', 0)
            .style('animation', `fadeUp .3s ease ${delay} forwards`);
        }
      });

      setLoading(false);
    }
    draw();
    return () => { cancelled = true; };
  }, [deptNombre, provincias, colorOf, onHover]);

  return (
    <div ref={wrapRef} style={{ width: '100%', aspectRatio: '4/3', position: 'relative', maxHeight: 440 }}>
      <div ref={svgRef} style={{ width: '100%', height: '100%' }} />
      {loading && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--tx3)', fontSize: 12, pointerEvents: 'none' }}>
          Cargando mapa…
        </div>
      )}
    </div>
  );
}
