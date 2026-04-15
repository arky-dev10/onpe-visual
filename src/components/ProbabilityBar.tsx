import { CANDIDATES, CAND_ORDER } from '../data/candidates';
import type { CandKey } from '../types';

export function ProbabilityBar({ probs }: { probs: Record<CandKey, number> }) {
  const entries = CAND_ORDER.map(k => ({ k, p: probs[k] ?? 0 })).filter(e => e.p > 0);
  const total = entries.reduce((a,b) => a + b.p, 0) || 100;
  return (
    <div className="prob-card">
      <div className="prob-title">Probabilidad de pase a segunda vuelta</div>
      <div className="prob-bar">
        {entries.map(({ k, p }) => (
          <div
            key={k}
            className="prob-fill"
            style={{ width: `${(p/total)*100}%`, background: CANDIDATES[k].color }}
            title={`${CANDIDATES[k].name}: ${p}%`}
          />
        ))}
      </div>
      <div className="prob-legend">
        {entries.map(({ k, p }) => (
          <span key={k}>
            <i style={{ background: CANDIDATES[k].color }} />
            {CANDIDATES[k].name} {p}%
          </span>
        ))}
      </div>
    </div>
  );
}
