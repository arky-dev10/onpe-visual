import { CANDIDATES, CAND_ORDER } from '../data/candidates';
import type { CandKey } from '../types';

export function ProbabilityBar({ probs }: { probs: Record<CandKey, number> }) {
  // Tomamos los 3 con mayor probabilidad (no 0)
  const entries = CAND_ORDER
    .map(k => ({ k, p: probs[k] ?? 0 }))
    .filter(e => e.p > 0)
    .sort((a, b) => b.p - a.p)
    .slice(0, 3);

  return (
    <div className="prob-card">
      <div className="prob-title">Probabilidad de pase a segunda vuelta</div>
      <div className="prob-rows">
        {entries.map(({ k, p }, i) => {
          const c = CANDIDATES[k];
          return (
            <div key={k} className="prob-row" style={{ '--c': c.color } as React.CSSProperties}>
              <div className="prob-row-head">
                <span className="prob-row-rank">#{i + 1}</span>
                <span className="prob-row-name">{c.name}</span>
                <span className="prob-row-pct">{p}%</span>
              </div>
              <div className="prob-row-track">
                <div
                  className="prob-row-fill"
                  style={{ width: `${p}%`, background: c.color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
