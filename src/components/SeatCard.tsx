import type { SeatInfo } from './Hemicycle';
import { nombreCorto } from '../data/senadoSource';

interface Props {
  seat: SeatInfo;
  onClose: () => void;
}

export function SeatCard({ seat, onClose }: Props) {
  return (
    <div className="seat-card-overlay" onClick={onClose}>
      <div className="seat-card" onClick={e => e.stopPropagation()} style={{ '--c': seat.color } as React.CSSProperties}>
        <button className="seat-card-close" onClick={onClose} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="seat-card-badge">
          <span className="seat-card-bullet" />
          ESCAÑO PROYECTADO
        </div>

        {seat.candidatoNombre ? (
          <>
            <div className="seat-card-name">{seat.candidatoNombre}</div>
            <div className="seat-card-party">{nombreCorto(seat.partyName)}</div>
          </>
        ) : (
          <>
            <div className="seat-card-name" style={{ fontSize: 18 }}>{nombreCorto(seat.partyName)}</div>
            <div className="seat-card-party" style={{ fontSize: 12 }}>Partido político</div>
          </>
        )}

        <div className="seat-card-rows">
          {seat.distrito && (
            <div className="seat-card-row">
              <span className="seat-card-key">Distrito electoral</span>
              <span className="seat-card-val">{seat.distrito}</span>
            </div>
          )}
          {seat.candidatoDni && (
            <div className="seat-card-row">
              <span className="seat-card-key">DNI</span>
              <span className="seat-card-val">{seat.candidatoDni}</span>
            </div>
          )}
          {seat.votosPreferenciales != null && (
            <div className="seat-card-row">
              <span className="seat-card-key">Votos preferenciales</span>
              <span className="seat-card-val" style={{ color: 'var(--c)', fontWeight: 800 }}>
                {seat.votosPreferenciales.toLocaleString('es-PE')}
              </span>
            </div>
          )}
          {seat.orderInParty != null && (
            <div className="seat-card-row">
              <span className="seat-card-key">Orden en partido</span>
              <span className="seat-card-val">#{seat.orderInParty + 1}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
