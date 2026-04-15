import { useEffect, useState } from 'react';
import { CANDIDATES } from '../data/candidates';
import { SEGUNDA_VUELTA_FECHA } from '../data/mock';
import { Avatar } from './Avatar';

function useCountdown(target: Date) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const diff = Math.max(0, target.getTime() - now.getTime());
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return { d, h, m, s };
}

interface Props {
  aPct: number;
  bPct: number;
  aKey?: 'fujimori' | 'rla' | 'sanchez' | 'nieto' | 'belmont';
  bKey?: 'fujimori' | 'rla' | 'sanchez' | 'nieto' | 'belmont';
  aParty?: string;
  bParty?: string;
}

export function SecondRoundBanner({
  aPct, bPct,
  aKey = 'fujimori', bKey = 'sanchez',
  aParty = 'Fuerza Popular', bParty = 'Juntos por el Perú',
}: Props) {
  const a = CANDIDATES[aKey];
  const b = CANDIDATES[bKey];
  const { d, h, m, s } = useCountdown(SEGUNDA_VUELTA_FECHA);

  return (
    <div className="sv-banner">
      <div className="sv-left">
        <div className="sv-kicker">Segunda Vuelta Presidencial</div>
        <div className="sv-date">Domingo 7 de junio · 2026</div>
      </div>

      <div className="sv-center">
        <div className="sv-side" style={{ '--c': a.color, '--cbg': a.bg } as React.CSSProperties}>
          <Avatar cand={a} size={56} />
          <div className="sv-name">{a.name}</div>
          <div className="sv-pct">{aPct.toFixed(2)}%</div>
          <div className="sv-party">{aParty}</div>
        </div>

        <div className="sv-vs">VS</div>

        <div className="sv-side" style={{ '--c': b.color, '--cbg': b.bg } as React.CSSProperties}>
          <Avatar cand={b} size={56} />
          <div className="sv-name">{b.name}</div>
          <div className="sv-pct">{bPct.toFixed(2)}%</div>
          <div className="sv-party">{bParty}</div>
        </div>
      </div>

      <div className="sv-right">
        <div className="sv-countdown-label">Faltan</div>
        <div className="sv-countdown">
          <span><b>{d}</b><i>d</i></span>
          <span><b>{String(h).padStart(2,'0')}</b><i>h</i></span>
          <span><b>{String(m).padStart(2,'0')}</b><i>m</i></span>
          <span className="sv-secs"><b>{String(s).padStart(2,'0')}</b><i>s</i></span>
        </div>
      </div>
    </div>
  );
}
