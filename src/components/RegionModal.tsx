import { CANDIDATES, CAND_ORDER } from '../data/candidates';
import { IconClose } from './Icons';
import type { RegionResult } from '../types';

interface Props { region: RegionResult | null; source: string; onClose: () => void; }

export function RegionModal({ region, source, onClose }: Props) {
  if (!region) return <div className="modal-overlay" onClick={onClose} />;
  const max = Math.max(...CAND_ORDER.map(k => region[k]));
  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">
          <IconClose />
        </button>
        <h3>{region.name}</h3>
        <div className="region-sub">{source} · {region.pct.toFixed(1)}% actas</div>
        {CAND_ORDER.map(k => {
          const c = CANDIDATES[k];
          const v = region[k];
          return (
            <div className="modal-row" key={k}>
              <span className="dot" style={{ background: c.color }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="name">{c.name}</span>
                  <span className="pct" style={{ color: c.color }}>{v.toFixed(2)}%</span>
                </div>
                <div className="modal-bar" style={{ width: `${(v/max)*100}%`, background: c.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
