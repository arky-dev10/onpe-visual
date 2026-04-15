import { CANDIDATES } from '../data/candidates';

interface Props {
  secondPct: number;
  thirdPct: number;
  secondName: 'rla' | 'sanchez' | 'nieto' | 'belmont' | 'fujimori';
  thirdName:  'rla' | 'sanchez' | 'nieto' | 'belmont' | 'fujimori';
  votosRestantes: number;
}

export function CriticalGap({ secondPct, thirdPct, secondName, thirdName, votosRestantes }: Props) {
  const gap = Math.abs(secondPct - thirdPct);
  const gapVotos = Math.round(votosRestantes * gap / 100);
  const pctStr = gap.toFixed(3);
  const a = CANDIDATES[secondName];
  const b = CANDIDATES[thirdName];

  return (
    <div className="gap-card">
      <div className="gap-pulse" />
      <div className="gap-head">
        <span className="gap-tag">ALERTA · Brecha crítica por el 2° lugar</span>
      </div>
      <div className="gap-body">
        <div className="gap-names">
          <span style={{ color: a.color }}>● {a.name}</span>
          <span className="gap-vs">vs</span>
          <span style={{ color: b.color }}>● {b.name}</span>
        </div>
        <div className="gap-numbers">
          <div>
            <div className="gap-big">{pctStr}<span>pp</span></div>
            <div className="gap-lbl">diferencia actual</div>
          </div>
          <div>
            <div className="gap-big">≈{gapVotos.toLocaleString('es-PE')}</div>
            <div className="gap-lbl">votos de distancia</div>
          </div>
          <div>
            <div className="gap-big">{votosRestantes.toLocaleString('es-PE')}</div>
            <div className="gap-lbl">votos por contabilizar</div>
          </div>
        </div>
      </div>
    </div>
  );
}
