import type { ReactElement } from 'react';
import { colorOfPartido, nombreCorto } from '../data/senadoSource';

interface Props {
  escanos: Record<string, number>;
  partidos: { codigo: string; nombre: string }[];
  total: number;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Hemiciclo parlamentario — escaños dispuestos en arcos concéntricos.
 * Partidos ordenados "ideológicamente" (izquierda a derecha por escaños desc) como convención.
 */
export function Hemicycle({ escanos, partidos, total, size = 'md' }: Props) {
  const dims = size === 'sm'
    ? { w: 320, h: 140, r0: 48, dr: 20, sr: 5, centerFS: 18, centerY: -10 }
    : size === 'lg'
    ? { w: 720, h: 320, r0: 110, dr: 48, sr: 11, centerFS: 44, centerY: -20 }
    : { w: 560, h: 250, r0: 80, dr: 36, sr: 9, centerFS: 36, centerY: -16 };

  const cx = dims.w / 2;
  const cy = dims.h - dims.sr * 1.5;

  // Determinar nº óptimo de filas para acomodar `total` escaños
  // cada fila cabe ~floor(π × r / (seat * 1.3)) asientos
  let rows = 1;
  while (true) {
    let capacity = 0;
    for (let i = 0; i < rows; i++) {
      const r = dims.r0 + i * dims.dr;
      capacity += Math.floor((Math.PI * r) / (dims.sr * 2.4));
    }
    if (capacity >= total) break;
    rows++;
    if (rows > 10) break;
  }

  // Distribuir asientos por fila (proporcional al radio)
  const rowRadii: number[] = [];
  const rowCaps: number[] = [];
  let totalCap = 0;
  for (let i = 0; i < rows; i++) {
    const r = dims.r0 + i * dims.dr;
    const cap = Math.floor((Math.PI * r) / (dims.sr * 2.4));
    rowRadii.push(r);
    rowCaps.push(cap);
    totalCap += cap;
  }
  const seatsPerRow = rowCaps.map(c => Math.round((c / totalCap) * total));
  // Ajustar para sumar exactamente total
  let diff = total - seatsPerRow.reduce((a, b) => a + b, 0);
  let idx = rows - 1;
  while (diff !== 0) {
    seatsPerRow[idx] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
    idx = (idx - 1 + rows) % rows;
  }

  // Lista lineal de colores de escaños (ordenados por partido desc)
  const ordered = partidos
    .map(p => ({ ...p, seats: escanos[p.codigo] || 0 }))
    .filter(p => p.seats > 0)
    .sort((a, b) => b.seats - a.seats);

  const seatColors: { color: string; nombre: string; codigo: string }[] = [];
  for (const p of ordered) {
    for (let i = 0; i < p.seats; i++) {
      seatColors.push({ color: colorOfPartido(p.codigo), nombre: p.nombre, codigo: p.codigo });
    }
  }

  // Colocar seats fila por fila, de fuera hacia dentro, ángulo de izquierda a derecha
  const nodes: ReactElement[] = [];
  let placed = 0;
  for (let row = rows - 1; row >= 0; row--) {  // fuera → dentro
    const radius = rowRadii[row];
    const count = seatsPerRow[row];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = Math.PI - t * Math.PI; // 180° a 0°
      const x = cx + radius * Math.cos(angle);
      const y = cy - radius * Math.sin(angle);
      const seat = seatColors[placed + i];
      nodes.push(
        <circle
          key={`r${row}-i${i}`}
          cx={x}
          cy={y}
          r={dims.sr}
          fill={seat?.color ?? 'var(--bg-alt)'}
          stroke="var(--bg)"
          strokeWidth={1.5}
          className="hemi-seat"
        >
          {seat && <title>{nombreCorto(seat.nombre)}</title>}
        </circle>
      );
    }
    placed += count;
  }

  return (
    <svg viewBox={`0 0 ${dims.w} ${dims.h}`} width="100%" height="auto" className="hemicycle-svg">
      {nodes}
      <text
        x={cx}
        y={cy + dims.centerY}
        textAnchor="middle"
        fontFamily="'DM Mono', monospace"
        fontSize={dims.centerFS}
        fontWeight="800"
        fill="var(--tx1)"
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + dims.centerY + 14}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="var(--tx3)"
        letterSpacing="2"
      >
        ESCAÑOS
      </text>
    </svg>
  );
}

/** Leyenda de partidos con escaños debajo del hemiciclo */
export function HemicycleLegend({ escanos, partidos }: { escanos: Record<string, number>; partidos: { codigo: string; nombre: string }[] }) {
  const rows = partidos
    .map(p => ({ ...p, seats: escanos[p.codigo] || 0 }))
    .filter(p => p.seats > 0)
    .sort((a, b) => b.seats - a.seats);

  return (
    <div className="hemi-legend">
      {rows.map(r => (
        <div key={r.codigo} className="hemi-legend-row">
          <span className="hemi-legend-swatch" style={{ background: colorOfPartido(r.codigo) }} />
          <span className="hemi-legend-name">{nombreCorto(r.nombre)}</span>
          <span className="hemi-legend-seats">{r.seats}</span>
        </div>
      ))}
    </div>
  );
}
