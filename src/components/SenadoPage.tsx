import { useEffect, useMemo, useState } from 'react';
import { loadSenado, colorOfPartido, nombreCorto, type SenadoData, type DistritoRegional } from '../data/senadoSource';
import { Hemicycle, HemicycleLegend, type SeatInfo } from './Hemicycle';
import { SeatCard } from './SeatCard';
import { MapPartidos } from './MapPartidos';
import { ProvinciasView } from './ProvinciasView';

function seatsFromPartyMap(escanos: Record<string, number>, partidos: { codigo: string; nombre: string }[], distrito?: string): SeatInfo[] {
  const out: SeatInfo[] = [];
  const ordered = partidos
    .map(p => ({ ...p, n: escanos[p.codigo] || 0 }))
    .filter(p => p.n > 0)
    .sort((a, b) => b.n - a.n);
  for (const p of ordered) {
    for (let i = 0; i < p.n; i++) {
      out.push({
        color: colorOfPartido(p.codigo),
        partyCodigo: p.codigo,
        partyName: p.nombre,
        distrito,
        orderInParty: i,
      });
    }
  }
  return out;
}

// Ubigeo aproximado por nombre de distrito/departamento para el drill-down de provincias
const DEPT_UBIGEO: Record<string, string> = {
  'AMAZONAS': '010000', 'ÁNCASH': '020000', 'APURÍMAC': '030000', 'AREQUIPA': '040000',
  'AYACUCHO': '050000', 'CAJAMARCA': '060000', 'CALLAO': '240000', 'CUSCO': '070000',
  'HUANCAVELICA': '080000', 'HUÁNUCO': '090000', 'ICA': '100000', 'JUNÍN': '110000',
  'LA LIBERTAD': '120000', 'LAMBAYEQUE': '130000', 'LIMA': '140000', 'LORETO': '150000',
  'MADRE DE DIOS': '160000', 'MOQUEGUA': '170000', 'PASCO': '180000', 'PIURA': '190000',
  'PUNO': '200000', 'SAN MARTÍN': '210000', 'TACNA': '220000', 'TUMBES': '230000',
  'UCAYALI': '250000', 'LIMA PROVINCIAS': '140000',
};

type SubTab = 'nacional' | 'regional';

export function SenadoPage() {
  const [data, setData] = useState<SenadoData | null>(null);
  const [sub, setSub] = useState<SubTab>('nacional');
  const [selected, setSelected] = useState<DistritoRegional | null>(null);
  const [provDept, setProvDept] = useState<{ ubigeo: string; nombre: string } | null>(null);
  const [seatSelected, setSeatSelected] = useState<SeatInfo | null>(null);

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
          <div className="hero-pct" key={data.nacional.pctActas}>
            <span className="num-flash">{data.nacional.pctActas.toFixed(3).split('.')[0]}</span>
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

      {sub === 'nacional' && <NacionalTab data={data} onSeatClick={setSeatSelected} />}
      {sub === 'regional' && <RegionalTab data={data} onSelect={setSelected} onSeatClick={setSeatSelected} />}

      {seatSelected && <SeatCard seat={seatSelected} onClose={() => setSeatSelected(null)} />}

      {selected && (
        <DistritoModal
          distrito={selected}
          onClose={() => setSelected(null)}
          onSeatClick={setSeatSelected}
          onDrillProvincias={() => {
            const ubigeo = DEPT_UBIGEO[selected.nombre.toUpperCase()];
            if (ubigeo) {
              setProvDept({ ubigeo, nombre: selected.nombre });
              setSelected(null);
            }
          }}
        />
      )}
      {provDept && (
        <ProvinciasView
          deptUbigeo={provDept.ubigeo}
          deptNombre={provDept.nombre}
          onClose={() => setProvDept(null)}
        />
      )}
    </div>
  );
}

function NacionalTab({ data, onSeatClick }: { data: SenadoData; onSeatClick: (s: SeatInfo) => void }) {
  const n = data.nacional;
  const pasaValla = n.partidos.filter(p => p.pct >= n.valla);
  const maxPct = Math.max(...n.partidos.slice(0, 12).map(p => p.pct), 1);
  const nacSeats = useMemo(() => seatsFromPartyMap(n.escanos, n.partidos), [n]);

  return (
    <>
      <div className="card" style={{ marginBottom: 16, padding: '20px 20px 24px' }}>
        <div className="card-title" style={{ fontSize: 14 }}>Distribución proyectada del Senado</div>
        <div className="card-sub">
          Asignación por D'Hondt · valla {n.valla}% · {pasaValla.length} partido{pasaValla.length !== 1 ? 's' : ''} pasa{pasaValla.length === 1 ? '' : 'n'}
        </div>

        <Hemicycle seats={nacSeats} total={n.escanosTotales} size="lg" onSeatClick={onSeatClick} />

        <HemicycleLegend escanos={n.escanos} partidos={n.partidos} />
      </div>

      <div className="card">
        <div className="card-title">Ranking nacional</div>
        <div className="card-sub">Top partidos por votos válidos · con escaños proyectados</div>
        <table className="senado-table">
          <thead>
            <tr>
              <th>#</th>
              <th>PARTIDO</th>
              <th>VOTOS</th>
              <th className="tr">%</th>
              <th className="tr">ESCAÑOS</th>
            </tr>
          </thead>
          <tbody>
            {n.partidos.slice(0, 12).map((p, i) => {
              const seats = n.escanos[p.codigo] || 0;
              const dentro = p.pct >= n.valla;
              return (
                <tr key={p.codigo} className={dentro ? '' : 'under-valla'}>
                  <td style={{ color: 'var(--tx3)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{i + 1}</td>
                  <td>
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: colorOfPartido(p.codigo), marginRight: 10, verticalAlign: 'middle', boxShadow: '0 0 0 1px rgba(0,0,0,.06)' }} />
                    <span style={{ fontWeight: 600 }}>{nombreCorto(p.nombre)}</span>
                    <span className="senado-bar">
                      <span className="senado-bar-fill" style={{ width: `${(p.pct / maxPct) * 100}%`, background: colorOfPartido(p.codigo) }} />
                    </span>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--tx2)' }}>{p.votos.toLocaleString('es-PE')}</td>
                  <td className="tr" style={{ fontWeight: 600, color: colorOfPartido(p.codigo) }}>{p.pct.toFixed(2)}%</td>
                  <td className="tr" style={{ fontWeight: 600, fontSize: 15 }}>{seats || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function RegionalTab({ data, onSelect, onSeatClick }: { data: SenadoData; onSelect: (d: DistritoRegional) => void; onSeatClick: (s: SeatInfo) => void }) {
  const sorted = [...data.regional.distritos].sort((a, b) => a.nombre.localeCompare(b.nombre));
  const resumen = data.regional.resumenPartidos.slice(0, 10);
  const resumenEscanos: Record<string, number> = {};
  data.regional.resumenPartidos.forEach(p => { resumenEscanos[p.codigo] = p.escanos; });
  const regSeats = useMemo(() => seatsFromPartyMap(resumenEscanos, data.regional.resumenPartidos), [data]);

  return (
    <>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div className="card-title" style={{ fontSize: 14 }}>Escaños regionales consolidados</div>
          <div className="card-sub">
            {data.regional.escanosTotales} escaños · 27 distritos · D'Hondt por distrito
          </div>
          <Hemicycle seats={regSeats} total={data.regional.escanosTotales} size="md" onSeatClick={onSeatClick} />
          <HemicycleLegend escanos={resumenEscanos} partidos={resumen} />
        </div>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div className="card-title" style={{ fontSize: 14 }}>Mapa del Perú — partido ganador por distrito</div>
          <div className="card-sub">Número de escaños y % del ganador</div>
          <MapPartidos distritos={data.regional.distritos} onSelect={onSelect} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Distritos electorales</div>
        <div className="card-sub">Click para ver la asignación completa de escaños</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, marginTop: 14 }}>
          {sorted.map(d => {
            const gan = d.ganador ? d.partidos.find(p => p.codigo === d.ganador) : null;
            const ganColor = gan ? colorOfPartido(gan.codigo) : '#888';
            // seats row: cuadros del color de cada escaño asignado
            const seatColors: string[] = [];
            [...d.partidos]
              .map(p => ({ codigo: p.codigo, seats: d.asignacion[p.codigo] || 0 }))
              .sort((a, b) => b.seats - a.seats)
              .forEach(p => {
                for (let i = 0; i < p.seats; i++) seatColors.push(colorOfPartido(p.codigo));
              });
            return (
              <button
                key={d.codigo}
                onClick={() => onSelect(d)}
                className="distrito-card"
                style={{ borderLeftColor: ganColor }}
              >
                <div className="distrito-name">{d.nombre}</div>
                <div className="distrito-meta">
                  {d.escanos} escaño{d.escanos !== 1 ? 's' : ''} · actas {d.pctActas.toFixed(1)}%
                </div>
                <div className="distrito-seats-row">
                  {seatColors.map((c, i) => (
                    <span key={i} className="distrito-seat" style={{ background: c }} />
                  ))}
                  {seatColors.length === 0 && Array.from({ length: d.escanos }).map((_, i) => (
                    <span key={i} className="distrito-seat" style={{ background: 'var(--bg-alt)' }} />
                  ))}
                </div>
                {gan && (
                  <div className="distrito-ganador" style={{ color: ganColor }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: ganColor }} />
                    {nombreCorto(gan.nombre)}
                    <span className="distrito-ganador-pct">{gan.pct.toFixed(1)}%</span>
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

function DistritoModal({ distrito: d, onClose, onDrillProvincias, onSeatClick }: { distrito: DistritoRegional; onClose: () => void; onDrillProvincias?: () => void; onSeatClick: (s: SeatInfo) => void }) {
  const topPartidos = d.partidos.slice(0, 8);
  const hasDrill = !!(DEPT_UBIGEO[d.nombre.toUpperCase()] && onDrillProvincias);
  const seats = useMemo(() => seatsFromPartyMap(d.asignacion, d.partidos, d.nombre), [d]);
  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h3 style={{ fontSize: 18 }}>{d.nombre}</h3>
        <div className="region-sub">
          {d.escanos} escaños · actas {d.pctActas.toFixed(2)}% · {d.totalVotosValidos.toLocaleString('es-PE')} votos válidos
        </div>

        <div style={{ margin: '10px 0 14px' }}>
          <Hemicycle seats={seats} total={d.escanos} size="sm" onSeatClick={onSeatClick} />
        </div>

        {hasDrill && (
          <button
            onClick={onDrillProvincias}
            style={{
              width: '100%',
              marginBottom: 14,
              padding: '10px 14px',
              background: 'linear-gradient(90deg, #d4a017, #c9a44a)',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: 8,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              fontSize: 12,
              letterSpacing: 1.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'transform .15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.02)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            VER PROVINCIAS DE {d.nombre.toUpperCase()}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}

        {topPartidos.map(p => {
          const asignados = d.asignacion[p.codigo] || 0;
          return (
            <div className="modal-row" key={p.codigo}>
              <span className="dot" style={{ background: colorOfPartido(p.codigo) }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="name">{nombreCorto(p.nombre)}</span>
                  <span className="pct" style={{ color: colorOfPartido(p.codigo) }}>
                    {p.pct.toFixed(2)}%
                    {asignados > 0 && (
                      <span style={{ marginLeft: 8, color: 'var(--tx1)', background: 'var(--bg-alt)', padding: '2px 8px', borderRadius: 4, fontSize: 12 }}>
                        {asignados} escaño{asignados !== 1 ? 's' : ''}
                      </span>
                    )}
                  </span>
                </div>
                <div className="modal-bar" style={{ width: `${(p.pct / topPartidos[0].pct) * 100}%`, background: colorOfPartido(p.codigo), marginTop: 6 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
