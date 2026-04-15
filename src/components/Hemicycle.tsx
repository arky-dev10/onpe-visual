import type { ReactElement } from 'react';
import { colorOfPartido } from '../data/senadoSource';

interface Props {
  escanos: Record<string, number>;
  partidos: { codigo: string; nombre: string }[];
  total: number;
}

/** Dibuja un hemiciclo tipo parlamento con N puntos coloreados por partido. */
export function Hemicycle({ escanos, partidos, total }: Props) {
  const width = 520, height = 220, cx = width / 2, cy = height - 10;
  // Orden partidos por escaños desc para pintar izquierda→derecha
  const ordered = partidos
    .map(p => ({ ...p, seats: escanos[p.codigo] || 0 }))
    .filter(p => p.seats > 0)
    .sort((a, b) => b.seats - a.seats);

  // Construir array de colores (1 por escaño), alternando desde el centro por estética
  const expanded: { codigo: string; color: string; nombre: string }[] = [];
  for (const p of ordered) {
    for (let i = 0; i < p.seats; i++) {
      expanded.push({ codigo: p.codigo, color: colorOfPartido(p.codigo), nombre: p.nombre });
    }
  }

  // Distribuir en 3 filas concéntricas
  const rows = 3;
  const perRow = Math.ceil(total / rows);
  const seatR = 8;
  const nodes: ReactElement[] = [];

  let placed = 0;
  for (let row = 0; row < rows; row++) {
    const radius = 80 + row * 34;
    const count = Math.min(perRow, total - placed);
    for (let i = 0; i < count; i++) {
      // ángulo desde 180° (izq) a 0° (der)
      const angle = Math.PI - (Math.PI * i) / (count - 1 || 1);
      const x = cx + radius * Math.cos(angle);
      const y = cy - radius * Math.sin(angle);
      const seat = expanded[placed + i];
      nodes.push(
        <circle
          key={`${row}-${i}`}
          cx={x}
          cy={y}
          r={seatR}
          fill={seat ? seat.color : '#cbd5e1'}
          stroke="#fff"
          strokeWidth={1.2}
        >
          {seat && <title>{seat.nombre}</title>}
        </circle>
      );
    }
    placed += count;
  }

  return (
    <div className="hemicycle">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="auto">
        {nodes}
        <text x={cx} y={cy - 20} textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="28" fontWeight="700" fill="var(--tx1)">
          {total}
        </text>
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="10" fill="var(--tx3)" letterSpacing="1.5">
          ESCAÑOS
        </text>
      </svg>
    </div>
  );
}
