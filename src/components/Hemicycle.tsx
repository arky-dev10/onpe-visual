import type { ReactElement } from 'react';
import { colorOfPartido, nombreCorto } from '../data/senadoSource';

export interface SeatInfo {
  color: string;
  partyCodigo: string;
  partyName: string;
  // opcionales (si el caller los tiene)
  candidatoNombre?: string;
  candidatoDni?: string;
  votosPreferenciales?: number;
  distrito?: string;
  orderInParty?: number;
  // contexto para la ficha del escaño
  partidoPct?: number;
  partidoVotos?: number;
  partidoEscanos?: number;
}

interface Props {
  // modo partidos (compat): para casos sin candidato individual
  escanos?: Record<string, number>;
  partidos?: { codigo: string; nombre: string }[];
  // modo seats: lista explícita de escaños con candidato
  seats?: SeatInfo[];
  total: number;
  size?: 'sm' | 'md' | 'lg';
  onSeatClick?: (seat: SeatInfo) => void;
}

/**
 * Hemiciclo parlamentario con asientos clickeables.
 * Si se pasa `seats`, cada asiento queda identificado con un candidato específico.
 * Si no, usa `escanos`+`partidos` (solo colores por partido, sin candidato).
 */
export function Hemicycle({ escanos, partidos, seats, total, size = 'md', onSeatClick }: Props) {
  const dims = size === 'sm'
    ? { w: 320, h: 140, r0: 48, dr: 20, sr: 5, centerFS: 18, centerY: -10 }
    : size === 'lg'
    ? { w: 720, h: 320, r0: 110, dr: 48, sr: 11, centerFS: 44, centerY: -20 }
    : { w: 560, h: 250, r0: 80, dr: 36, sr: 9, centerFS: 36, centerY: -16 };

  const cx = dims.w / 2;
  const cy = dims.h - dims.sr * 1.5;

  // Determinar filas óptimas
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
  let diff = total - seatsPerRow.reduce((a, b) => a + b, 0);
  let idx = rows - 1;
  while (diff !== 0) {
    seatsPerRow[idx] += diff > 0 ? 1 : -1;
    diff += diff > 0 ? -1 : 1;
    idx = (idx - 1 + rows) % rows;
  }

  // Construir lista de seats
  let expanded: SeatInfo[];
  if (seats && seats.length) {
    expanded = [...seats];
    // Ordenar por partido (desc por número de asientos de ese partido) para agrupar visualmente
    const countBy: Record<string, number> = {};
    for (const s of seats) countBy[s.partyCodigo] = (countBy[s.partyCodigo] || 0) + 1;
    expanded.sort((a, b) => (countBy[b.partyCodigo] - countBy[a.partyCodigo]) || a.partyCodigo.localeCompare(b.partyCodigo));
  } else {
    const ordered = (partidos || [])
      .map(p => ({ ...p, n: (escanos || {})[p.codigo] || 0 }))
      .filter(p => p.n > 0)
      .sort((a, b) => b.n - a.n);
    expanded = [];
    for (const p of ordered) {
      for (let i = 0; i < p.n; i++) {
        expanded.push({
          color: colorOfPartido(p.codigo),
          partyCodigo: p.codigo,
          partyName: p.nombre,
        });
      }
    }
  }

  const nodes: ReactElement[] = [];
  let placed = 0;
  for (let row = rows - 1; row >= 0; row--) {
    const radius = rowRadii[row];
    const count = seatsPerRow[row];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const angle = Math.PI - t * Math.PI;
      const x = cx + radius * Math.cos(angle);
      const y = cy - radius * Math.sin(angle);
      const seat = expanded[placed + i];
      const title = seat
        ? (seat.candidatoNombre
          ? `${seat.candidatoNombre} · ${nombreCorto(seat.partyName)}${seat.distrito ? ` · ${seat.distrito}` : ''}`
          : nombreCorto(seat.partyName))
        : '';
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
          style={{ cursor: seat && onSeatClick ? 'pointer' : 'default' }}
          onClick={seat && onSeatClick ? () => onSeatClick(seat) : undefined}
        >
          {title && <title>{title}</title>}
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
        fontFamily="'JetBrains Mono', monospace"
        fontSize={dims.centerFS}
        fontWeight="600"
        fill="var(--tx1)"
      >
        {total}
      </text>
      <text
        x={cx}
        y={cy + dims.centerY + 14}
        textAnchor="middle"
        fontSize="9"
        fontWeight="600"
        fill="var(--tx3)"
        letterSpacing="2"
      >
        ESCAÑOS
      </text>
    </svg>
  );
}

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
