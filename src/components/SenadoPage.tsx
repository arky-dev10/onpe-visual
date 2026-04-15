import { useEffect, useState } from 'react';
import { loadSenado, colorOfPartido, nombreCorto, type SenadoData, type DistritoRegional } from '../data/senadoSource';
import { Hemicycle } from './Hemicycle';

type SubTab = 'nacional' | 'regional';

export function SenadoPage() {
  const [data, setData] = useState<SenadoData | null>(null);
  const [sub, setSub] = useState<SubTab>('nacional');
  const [selected, setSelected] = useState<DistritoRegional | null>(null);

  useEffect(() => {
    let alive = true;
    async function fetchAll() {
      const d = await loadSenado();
      if (alive && d) setData(d);
    }
    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!data) {
    return (
      <div className="container">
        <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--tx3)' }}>
          Cargando datos del Senado…
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="hero">
        <div className="hero-left">
          <div className="hero-title">Senado · Perú 2026</div>
          <div className="hero-sub">Elección del Congreso Bicameral · Senadores</div>
        </div>
        <div className="hero-center">
          <div className="hero-label">ACTAS CONTABILIZADAS</div>
          <div className="hero-pct">
            {data.nacional.pctActas.toFixed(3).split('.')[0]}
            <span className="hero-pct-sign">.{data.nacional.pctActas.toFixed(3).split('.')[1]}%</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>
            <span className="live-dot" /> &nbsp; {data.nacional.fechaActualizacion} · En vivo
          </div>
        </div>
        <div className="hero-right" />
      </header>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${sub === 'nacional' ? 'active' : ''}`} onClick={() => setSub('nacional')}>
          Senado Nacional <span style={{ opacity: .5, marginLeft: 4 }}>({data.nacional.escanosTotales})</span>
        </button>
        <button className={`tab ${sub === 'regional' ? 'active' : ''}`} onClick={() => setSub('regional')}>
          Senado Regional <span style={{ opacity: .5, marginLeft: 4 }}>({data.regional.escanosTotales})</span>
        </button>
      </div>

      {sub === 'nacional' && <NacionalTab data={data} />}
      {sub === 'regional' && <RegionalTab data={data} onSelect={setSelected} />}

      {selected && <DistritoModal distrito={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function NacionalTab({ data }: { data: SenadoData }) {
  const n = data.nacional;
  const top = n.partidos.slice(0, 10);
  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Distribución proyectada del Senado (D'Hondt · valla {n.valla}%)</div>
        <div className="card-sub">
          {n.partidos.filter(p => p.pct >= n.valla).length} partidos superan la valla del {n.valla}%
        </div>
        <Hemicycle escanos={n.escanos} partidos={n.partidos} total={n.escanosTotales} />
      </div>

      <div className="card">
        <div className="card-title">Ranking de partidos</div>
        <div className="card-sub">Top por votos válidos nacional</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--tx3)', fontSize: 11, letterSpacing: 1 }}>
              <th style={{ padding: '8px 4px', textAlign: 'left' }}>#</th>
              <th style={{ padding: '8px 4px', textAlign: 'left' }}>PARTIDO</th>
              <th style={{ padding: '8px 4px', textAlign: 'right' }}>VOTOS</th>
              <th style={{ padding: '8px 4px', textAlign: 'right' }}>%</th>
              <th style={{ padding: '8px 4px', textAlign: 'right' }}>ESCAÑOS</th>
            </tr>
          </thead>
          <tbody>
            {top.map((p, i) => {
              const seats = n.escanos[p.codigo] || 0;
              const pasaValla = p.pct >= n.valla;
              return (
                <tr key={p.codigo} style={{ borderBottom: '1px solid var(--border)', opacity: pasaValla ? 1 : .55 }}>
                  <td style={{ padding: '8px 4px', color: 'var(--tx3)', fontFamily: 'DM Mono', fontWeight: 700 }}>{i + 1}</td>
                  <td style={{ padding: '8px 4px' }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: colorOfPartido(p.codigo), marginRight: 8, verticalAlign: 'middle' }} />
                    <span style={{ fontWeight: 600 }}>{nombreCorto(p.nombre)}</span>
                    {!pasaValla && <span style={{ fontSize: 10, color: 'var(--tx3)', marginLeft: 8 }}>bajo valla</span>}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'DM Mono', color: 'var(--tx2)' }}>
                    {p.votos.toLocaleString('es-PE')}
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'DM Mono', fontWeight: 600, color: colorOfPartido(p.codigo) }}>
                    {p.pct.toFixed(2)}%
                  </td>
                  <td style={{ padding: '8px 4px', textAlign: 'right', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 14 }}>
                    {seats || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RegionalTab({ data, onSelect }: { data: SenadoData; onSelect: (d: DistritoRegional) => void }) {
  const sorted = [...data.regional.distritos].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const resumen = data.regional.resumenPartidos.slice(0, 10);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Total nacional de escaños regionales</div>
        <div className="card-sub">{data.regional.escanosTotales} escaños · 27 distritos · D'Hondt por distrito</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--tx3)', fontSize: 11, letterSpacing: 1 }}>
              <th style={{ padding: '8px 4px', textAlign: 'left' }}>PARTIDO</th>
              <th style={{ padding: '8px 4px', textAlign: 'right' }}>ESCAÑOS</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map(r => (
              <tr key={r.codigo} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 4px' }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: colorOfPartido(r.codigo), marginRight: 8, verticalAlign: 'middle' }} />
                  <span style={{ fontWeight: 600 }}>{nombreCorto(r.nombre)}</span>
                </td>
                <td style={{ padding: '6px 4px', textAlign: 'right', fontFamily: 'DM Mono', fontWeight: 700 }}>
                  {r.escanos}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-title">Distritos electorales</div>
        <div className="card-sub">Click para ver asignación completa de escaños</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10, marginTop: 12 }}>
          {sorted.map(d => {
            const gan = d.ganador ? d.partidos.find(p => p.codigo === d.ganador) : null;
            return (
              <button
                key={d.codigo}
                onClick={() => onSelect(d)}
                style={{
                  textAlign: 'left',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderLeft: `4px solid ${gan ? colorOfPartido(gan.codigo) : '#888'}`,
                  borderRadius: 8,
                  padding: '10px 12px',
                  cursor: 'pointer',
                  transition: 'transform .15s, background .15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '')}
              >
                <div style={{ fontWeight: 700, fontSize: 13 }}>{d.nombre}</div>
                <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>
                  {d.escanos} escaño{d.escanos !== 1 ? 's' : ''} · actas {d.pctActas.toFixed(1)}%
                </div>
                {gan && (
                  <div style={{ fontSize: 11, marginTop: 4, color: colorOfPartido(gan.codigo), fontWeight: 600 }}>
                    {nombreCorto(gan.nombre)} · {gan.pct.toFixed(1)}%
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function DistritoModal({ distrito: d, onClose }: { distrito: DistritoRegional; onClose: () => void }) {
  const topPartidos = d.partidos.slice(0, 8);
  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h3>{d.nombre}</h3>
        <div className="region-sub">
          {d.escanos} escaños · actas {d.pctActas.toFixed(2)}% · {d.totalVotosValidos.toLocaleString('es-PE')} votos válidos
        </div>
        {topPartidos.map(p => {
          const asignados = d.asignacion[p.codigo] || 0;
          return (
            <div className="modal-row" key={p.codigo}>
              <span className="dot" style={{ background: colorOfPartido(p.codigo) }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="name">{nombreCorto(p.nombre)}</span>
                  <span className="pct" style={{ color: colorOfPartido(p.codigo) }}>
                    {p.pct.toFixed(2)}% {asignados > 0 && <span style={{ marginLeft: 6, color: 'var(--tx1)' }}>· {asignados} escaño{asignados !== 1 ? 's' : ''}</span>}
                  </span>
                </div>
                <div className="modal-bar" style={{ width: `${(p.pct / topPartidos[0].pct) * 100}%`, background: colorOfPartido(p.codigo) }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
