import { useState } from 'react';
import type { CandConfig } from '../types';

interface Props {
  cand: CandConfig;
  size?: number;
}

export function Avatar({ cand, size = 44 }: Props) {
  const [broken, setBroken] = useState(false);
  const style: React.CSSProperties = {
    width: size, height: size,
    borderRadius: '50%',
    border: `2px solid ${cand.color}`,
    background: cand.bg,
    display: 'grid', placeItems: 'center',
    fontFamily: '"DM Mono", monospace',
    fontWeight: 700,
    fontSize: Math.max(10, Math.round(size * 0.3)),
    color: cand.color,
    overflow: 'hidden',
    flexShrink: 0,
  };
  if (!broken) {
    return (
      <div style={style}>
        <img
          src={cand.photo}
          alt={cand.name}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    );
  }
  return <div style={style}>{cand.initials}</div>;
}
