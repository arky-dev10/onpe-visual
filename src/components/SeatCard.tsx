import type { SeatInfo } from './Hemicycle';
import { nombreCorto } from '../data/senadoSource';
import { CandidatePhoto } from './CandidatePhoto';

interface Props {
  seat: SeatInfo;
  onClose: () => void;
}

export function SeatCard({ seat, onClose }: Props) {
  const { color, partyName, partyCodigo, candidatoNombre, candidatoDni, votosPreferenciales, distrito, orderInParty, partidoPct, partidoVotos, partidoEscanos } = seat;
  const hasCandidato = !!candidatoNombre;
  const pctDelPartido = (hasCandidato && partidoVotos && votosPreferenciales != null)
    ? (votosPreferenciales / partidoVotos) * 100
    : null;

  return (
    <div className="seat-card-overlay" onClick={onClose}>
      <div className="seat-card-v2" onClick={e => e.stopPropagation()} style={{ '--c': color } as React.CSSProperties}>
        <button className="seat-card-close" onClick={onClose} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Header con color de partido */}
        <div className="seat-card-head">
          <div className="seat-card-kicker">
            <span className="seat-card-bullet" />
            ESCAÑO PROYECTADO
          </div>
        </div>

        {/* Hero: foto + nombre + partido */}
        <div className="seat-card-hero">
          <CandidatePhoto dni={candidatoDni} nombre={candidatoNombre || partyName} color={color} size={88} />
          <div className="seat-card-titles">
            {hasCandidato ? (
              <>
                <div className="seat-card-name">{candidatoNombre}</div>
                <div className="seat-card-party">{nombreCorto(partyName)}</div>
              </>
            ) : (
              <>
                <div className="seat-card-name" style={{ fontSize: 20 }}>{nombreCorto(partyName)}</div>
                <div className="seat-card-party" style={{ opacity: .6, fontSize: 12 }}>Partido · código {partyCodigo}</div>
              </>
            )}
          </div>
        </div>

        {/* Stat principal */}
        {hasCandidato && votosPreferenciales != null && (
          <div className="seat-card-bignum">
            <div className="seat-card-bignum-label">VOTOS PREFERENCIALES</div>
            <div className="seat-card-bignum-value">{votosPreferenciales.toLocaleString('es-PE')}</div>
            {pctDelPartido != null && (
              <div className="seat-card-bignum-sub">
                {pctDelPartido.toFixed(1)}% del voto del partido
              </div>
            )}
          </div>
        )}

        {/* Grid de metadatos */}
        <div className="seat-card-grid">
          {distrito && (
            <div className="seat-card-cell">
              <div className="seat-card-cell-label">DISTRITO</div>
              <div className="seat-card-cell-value">{distrito}</div>
            </div>
          )}
          {orderInParty != null && (
            <div className="seat-card-cell">
              <div className="seat-card-cell-label">POSICIÓN</div>
              <div className="seat-card-cell-value">#{orderInParty + 1}{partidoEscanos ? ` de ${partidoEscanos}` : ''}</div>
            </div>
          )}
          {candidatoDni && (
            <div className="seat-card-cell">
              <div className="seat-card-cell-label">DNI</div>
              <div className="seat-card-cell-value mono">{candidatoDni}</div>
            </div>
          )}
          {partidoPct != null && (
            <div className="seat-card-cell">
              <div className="seat-card-cell-label">PARTIDO DISTRITAL</div>
              <div className="seat-card-cell-value" style={{ color: 'var(--c)' }}>{partidoPct.toFixed(2)}%</div>
            </div>
          )}
        </div>

        <div className="seat-card-footer">
          Fuente: resultadoelectoral.onpe.gob.pe
        </div>
      </div>
    </div>
  );
}
