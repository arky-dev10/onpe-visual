import { memo, useCallback, useMemo, useState } from 'react';
import {
  colorOfPartido, nombreCorto,
  type SenadoData, type DistritoRegional, type CandidatoSenado,
} from '../data/senadoSource';
import { Hemicycle, type SeatInfo } from './Hemicycle';
import { MapPartidos } from './MapPartidos';
import { CandidatePhoto } from './CandidatePhoto';

interface Props {
  data: SenadoData;
  onSeatClick: (s: SeatInfo) => void;
}

export function SenadoExplorer({ data, onSeatClick }: Props) {
  const [selected, setSelected] = useState<DistritoRegional | null>(null);

  const distritoById = useMemo(() => new Map(data.regional.distritos.map(d => [d.codigo, d])), [data]);
  const handleSelect = useCallback((d: any) => {
    const orig = distritoById.get(d.codigo);
    if (orig) setSelected(orig);
  }, [distritoById]);
  const handleHover = useCallback((d: any) => {
    // no-op; panel muestra distrito seleccionado, no hover
    void d;
  }, []);

  const goBack = useCallback(() => setSelected(null), []);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div className="explorer-crumbs">
        <button className={`crumb ${!selected ? 'active' : ''}`} onClick={goBack}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          Perú
        </button>
        {selected && (
          <>
            <span className="crumb-sep">›</span>
            <span className="crumb active" style={{ cursor: 'default' }}>{selected.nombre}</span>
          </>
        )}
        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>
          {!selected && `${data.regional.distritos.length} distritos · ${data.regional.escanosTotales} escaños`}
          {selected && `${selected.escanos} escaños · ${selected.pctActas.toFixed(1)}% actas`}
        </div>
      </div>

      <div className="explorer-grid">
        <div className="explorer-map">
          <MapPartidos distritos={data.regional.distritos} onSelect={handleSelect} onHover={handleHover} />
        </div>
        <div className="explorer-panel">
          {!selected && <PanelNacionalSummary data={data} />}
          {selected && <PanelDistrito distrito={selected} onBack={goBack} onSeatClick={onSeatClick} />}
        </div>
      </div>
    </div>
  );
}

const PanelNacionalSummary = memo(function PanelNacionalSummary({ data }: { data: SenadoData }) {
  const top = data.regional.resumenPartidos.slice(0, 6);
  const total = data.regional.escanosTotales;
  return (
    <div className="panel-wrap">
      <div className="panel-kicker">PANORAMA REGIONAL</div>
      <div className="panel-title">{total} escaños</div>
      <div className="panel-sub">Senado regional · suma de los 27 distritos</div>

      <div className="panel-subtitle">Partidos con más escaños</div>
      <div style={{ marginTop: 6 }}>
        {top.map((p, i) => (
          <div key={p.codigo} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ fontFamily: 'JetBrains Mono', color: 'var(--tx3)', width: 18, fontSize: 11 }}>#{i + 1}</div>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: colorOfPartido(p.codigo), flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: 'var(--tx1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {nombreCorto(p.nombre)}
              </div>
              <div style={{ height: 5, background: 'var(--bg-alt)', borderRadius: 3, marginTop: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(p.escanos / total) * 400}%`, background: colorOfPartido(p.codigo), borderRadius: 3 }} />
              </div>
            </div>
            <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 15, minWidth: 28, textAlign: 'right' }}>
              {p.escanos}
            </div>
          </div>
        ))}
      </div>

      <div className="panel-hint" style={{ marginTop: 14 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        Click en un distrito del mapa para ver sus senadores electos.
      </div>
    </div>
  );
});

const PanelDistrito = memo(function PanelDistrito({ distrito: d, onBack, onSeatClick }: {
  distrito: DistritoRegional;
  onBack: () => void;
  onSeatClick: (s: SeatInfo) => void;
}) {
  const partidosConEscanos = d.partidos.filter(p => (d.asignacion[p.codigo] || 0) > 0);

  // Construir seats con candidato (si hay candidatosList) o solo color
  const seats: SeatInfo[] = [];
  for (const p of partidosConEscanos) {
    const color = colorOfPartido(p.codigo);
    const asignados = d.asignacion[p.codigo] || 0;
    const clist: CandidatoSenado[] = Array.isArray(p.candidatosList) ? p.candidatosList : [];
    for (let i = 0; i < asignados; i++) {
      const c = clist[i];
      seats.push({
        color,
        partyCodigo: p.codigo,
        partyName: p.nombre,
        candidatoNombre: c?.nombre,
        candidatoDni: c?.dni,
        votosPreferenciales: c?.votosPreferenciales,
        distrito: d.nombre,
        orderInParty: i,
        partidoPct: p.pct,
        partidoVotos: p.votos,
        partidoEscanos: asignados,
      });
    }
  }

  return (
    <div className="panel-wrap">
      <button onClick={onBack} className="panel-back">‹ Perú</button>
      <div className="panel-kicker">DISTRITO ELECTORAL</div>
      <div className="panel-title">{d.nombre}</div>
      <div className="panel-sub">{d.escanos} escaños · actas {d.pctActas.toFixed(2)}%</div>

      <div style={{ margin: '10px -6px 14px' }}>
        <Hemicycle seats={seats} total={d.escanos} size="sm" onSeatClick={onSeatClick} />
      </div>

      <div className="panel-subtitle">Escaños por partido</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
        {partidosConEscanos.map(p => {
          const color = colorOfPartido(p.codigo);
          const asignados = d.asignacion[p.codigo] || 0;
          const clist: CandidatoSenado[] = Array.isArray(p.candidatosList) ? p.candidatosList : [];
          const firstElecto = clist.find(c => c.electo);
          return (
            <button
              key={p.codigo}
              onClick={() => onSeatClick({
                color, partyCodigo: p.codigo, partyName: p.nombre,
                candidatoNombre: firstElecto?.nombre,
                candidatoDni: firstElecto?.dni,
                votosPreferenciales: firstElecto?.votosPreferenciales,
                distrito: d.nombre, orderInParty: 0,
                partidoPct: p.pct, partidoVotos: p.votos, partidoEscanos: asignados,
              })}
              className="electo-row"
              style={{ ['--c' as any]: color }}
            >
              <CandidatePhoto dni={firstElecto?.dni} nombre={firstElecto?.nombre || p.nombre} color={color} size={32} ring={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="electo-nombre">{firstElecto?.nombre?.split(' ').slice(0,3).join(' ') || nombreCorto(p.nombre)}</div>
                <div className="electo-pref" style={{ color }}>{nombreCorto(p.nombre)} · {p.pct.toFixed(1)}%</div>
              </div>
              <div className="electo-rank">{asignados}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
