import { useState } from 'react';

const ONPE_PHOTO = (dni: string) => `https://resultadoelectoral.onpe.gob.pe/assets/img-reales/candidatos/${dni}.jpg`;

interface Props {
  dni?: string;
  nombre?: string;
  color: string;
  size?: number;
  ring?: boolean;
}

/** Avatar de candidato con foto real de ONPE por DNI + fallback a iniciales. */
export function CandidatePhoto({ dni, nombre, color, size = 48, ring = true }: Props) {
  const [broken, setBroken] = useState(false);
  const initials = (nombre || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase();

  const common: React.CSSProperties = {
    width: size, height: size,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'grid', placeItems: 'center',
    background: color,
    boxShadow: ring ? `0 0 0 3px ${color}22, 0 0 0 4px ${color}66 inset` : 'none',
    border: ring ? `2px solid ${color}` : 'none',
    position: 'relative',
  };

  if (dni && !broken) {
    return (
      <div style={common}>
        <img
          src={ONPE_PHOTO(dni)}
          alt={nombre || ''}
          onError={() => setBroken(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
        />
      </div>
    );
  }
  return (
    <div style={common}>
      <span style={{
        fontFamily: 'DM Mono, monospace',
        fontWeight: 800,
        fontSize: Math.max(10, Math.round(size * 0.33)),
        color: '#fff',
        letterSpacing: '-0.5px',
      }}>{initials}</span>
    </div>
  );
}
