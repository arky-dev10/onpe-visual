import { CANDIDATES, CAND_ORDER } from '../data/candidates';
import { IconArrowUp, IconArrowDown } from './Icons';
import { Avatar } from './Avatar';
import type { CandKey } from '../types';

interface Props {
  values: Record<CandKey, number>;
  deltas?: Partial<Record<CandKey, number>>;
  small?: Partial<Record<CandKey, string>>;
}

export function CandidateStrip({ values, deltas = {}, small = {} }: Props) {
  return (
    <div className="cand-strip">
      {CAND_ORDER.map((k, i) => {
        const c = CANDIDATES[k];
        const v = values[k] ?? 0;
        const d = deltas[k] ?? 0;
        const down = d < 0;
        const style = {
          '--cand-color': c.color,
          '--cand-bg': c.bg,
          animationDelay: `${i * 0.08 + 0.1}s`,
        } as React.CSSProperties;
        return (
          <div key={k} className="cand-card" style={style}>
            <div className="cand-head">
              <Avatar cand={c} size={38} />
              <div className="cand-name">{c.short}</div>
            </div>
            <div className="cand-pct">
              <span key={v.toFixed(3)} className="num-flash">{v.toFixed(3)}</span>%
              <span className={`cand-trend ${down ? 'down' : ''}`}>
                {down ? <IconArrowDown /> : <IconArrowUp />}
                {Math.abs(d).toFixed(3)}
              </span>
            </div>
            <div className="cand-foot">
              <span>{small[k] ?? '—'}</span>
              <span className="delta">{down ? '▼' : '▲'} {Math.abs(d).toFixed(3)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
