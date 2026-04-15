import { IconDoc } from './Icons';
import type { DashboardData } from '../types';

export function StatusBar({ d }: { d: DashboardData }) {
  const fmt = (n: number) => n.toLocaleString('es-PE');
  return (
    <div className="status-bar">
      <span className="strong">ONPE {d.pctActas.toFixed(3)}%</span>
      <span className="sep">·</span>
      <span>{fmt(d.actasTotal)} actas</span>
      <span className="sep">·</span>
      <span>Proyección recalculada</span>
      <span className="jee-badge"><IconDoc /> JEE · {fmt(d.actasRevisadas)} actas en revisión</span>
      <span className="sep">· −{fmt(d.votosFaltantes)} votos</span>
    </div>
  );
}
