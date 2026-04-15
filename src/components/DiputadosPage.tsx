import { useEffect, useMemo, useState } from 'react';
import {
  loadDiputados, colorOfPartido, nombreCorto,
  type DiputadosData, type DistritoDiputados, type CandidatoElecto,
} from '../data/diputadosSource';
import { Hemicycle, HemicycleLegend, type SeatInfo } from './Hemicycle';
import { SeatCard } from './SeatCard';
import { CandidatePhoto } from './CandidatePhoto';
import { MapPartidos } from './MapPartidos';
import { ProvinciasView } from './ProvinciasView';

type SubTab = 'nacional' | 'distritos';

// Ubigeo por nombre de distrito (para drill-down provincias)
const DEPT_UBIGEO: Record<string, string> = {
  'AMAZONAS': '010000', 'ÁNCASH': '020000', 'APURÍMAC': '030000', 'AREQUIPA': '040000',
  'AYACUCHO': '050000', 'CAJAMARCA': '060000', 'CALLAO': '240000', 'CUSCO': '070000',
  'HUANCAVELICA': '080000', 'HUÁNUCO': '090000', 'ICA': '100000', 'JUNÍN': '110000',
  'LA LIBERTAD': '120000', 'LAMBAYEQUE': '130000', 'LORETO': '150000',
  'LIMA METROPOLITANA': '140000', 'LIMA PROVINCIAS': '140000',
  'MADRE DE DIOS': '160000', 'MOQUEGUA': '170000', 'PASCO': '180000', 'PIURA': '190000',
  'PUNO': '200000', 'SAN MARTÍN': '210000', 'TACNA': '220000', 'TUMBES': '230000',
  'UCAYALI': '250000',
};

function buildSeatsFromDistrito(d: DistritoDiputados): SeatInfo[] {
  const seats: SeatInfo[] = [];
  for (const p of d.partidos) {
    if (p.escanos <= 0) continue;
    const color = colorOfPartido(p.codigo);
    const electos = p.candidatos.filter(c => c.electo);
    for (let i = 0; i < electos.length; i++) {
      const c = electos[i];
      seats.push({
        color,
        partyCodigo: p.codigo,
        partyName: p.nombre,
        candidatoNombre: c.nombre,
        candidatoDni: c.dni,
        votosPreferenciales: c.votosPreferenciales,
        distrito: d.nombre,
        orderInParty: i,
        partidoPct: p.pct,
        partidoVotos: p.votos,
        partidoEscanos: p.escanos,
      });
    }
  }
  return seats;
}

function buildSeatsNacional(data: DiputadosData): SeatInfo[] {
  const all: SeatInfo[] = [];
  for (const d of data.distritos) {
    all.push(...buildSeatsFromDistrito(d));
  }
  return all;
}

export function DiputadosPage() {
  const [data, setData] = useState<DiputadosData | null>(null);
  const [sub, setSub] = useState<SubTab>('nacional');
  const [selected, setSelected] = useState<DistritoDiputados | null>(null);
  const [seatSelected, setSeatSelected] = useState<SeatInfo | null>(null);
  const [provDept, setProvDept] = useState<{ ubigeo: string; nombre: string } | null>(null);

  useEffect(() => {
    let alive = true;
    async function fetchAll() {
      const d = await loadDiputados();
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
          Cargando datos de Diputados…
        </div>
      </div>
    );
  }

  const totActas = data.distritos.reduce((s, d) => s + d.actasTotal, 0);
  const revActas = data.distritos.reduce((s, d) => s + d.actasRevisadas, 0);
  const pctActas = totActas ? (revActas / totActas) * 100 : 0;

  return (
    <div className="container">
      <header className="hero">
        <div className="hero-left">
          <div className="hero-title">Cámara de Diputados · 2026</div>
          <div className="hero-sub">Congreso Bicameral · voto preferencial · D'Hondt por distrito</div>
        </div>
        <div className="hero-center">
          <div className="hero-label">ACTAS CONTABILIZADAS</div>
          <div className="hero-pct" key={pctActas.toFixed(2)}>
            <span className="num-flash">{pctActas.toFixed(2).split('.')[0]}</span>
            <span className="hero-pct-sign">.{pctActas.toFixed(2).split('.')[1]}%</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 4 }}>
            <span className="live-dot" /> &nbsp; {data.totalEscanos} escaños · {data.distritos.length} distritos · En vivo
          </div>
        </div>
        <div className="hero-right" />
      </header>

      <div className="tabs" style={{ marginBottom: 20 }}>
        <button className={`tab ${sub === 'nacional' ? 'active' : ''}`} onClick={() => setSub('nacional')}>
          Vista Nacional
        </button>
        <button className={`tab ${sub === 'distritos' ? 'active' : ''}`} onClick={() => setSub('distritos')}>
          Por Distrito Electoral <span style={{ opacity: .5, marginLeft: 4 }}>({data.distritos.length})</span>
        </button>
      </div>

      {sub === 'nacional' && <NacionalTab data={data} onSeatClick={setSeatSelected} />}
      {sub === 'distritos' && <DistritosTab data={data} onSelect={setSelected} />}

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
      {seatSelected && <SeatCard seat={seatSelected} onClose={() => setSeatSelected(null)} />}
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

function NacionalTab({ data, onSeatClick }: { data: DiputadosData; onSeatClick: (s: SeatInfo) => void }) {
  const top = data.resumenPartidos.slice(0, 12);
  const escanos: Record<string, number> = {};
  data.resumenPartidos.forEach(p => { escanos[p.codigo] = p.escanos; });
  const partidos = data.resumenPartidos.map(p => ({ codigo: p.codigo, nombre: p.nombre }));
  const seats = useMemo(() => buildSeatsNacional(data), [data]);

  const votosNacional: Record<string, number> = {};
  data.distritos.forEach(d => {
    d.partidos.forEach(p => {
      votosNacional[p.codigo] = (votosNacional[p.codigo] || 0) + p.votos;
    });
  });
  const totalNac = Object.values(votosNacional).reduce((a, b) => a + b, 0) || 1;
  const maxPct = Math.max(...top.map(t => ((votosNacional[t.codigo] || 0) / totalNac) * 100), 1);

  return (
    <>
      <div className="card" style={{ marginBottom: 16, padding: '20px' }}>
        <div className="card-title" style={{ fontSize: 14 }}>Composición proyectada de la Cámara</div>
        <div className="card-sub">
          {data.totalEscanos} escaños · click en un asiento para ver al diputado electo
        </div>
        <Hemicycle seats={seats} total={data.totalEscanos} size="lg" onSeatClick={onSeatClick} />
        <HemicycleLegend escanos={escanos} partidos={partidos} />
      </div>

      <div className="card">
        <div className="card-title">Ranking nacional</div>
        <div className="card-sub">Top partidos por escaños proyectados · suma de votos en los 27 distritos</div>
        <table className="senado-table">
          <thead>
            <tr>
              <th>#</th><th>PARTIDO</th><th>VOTOS TOTALES</th><th className="tr">%</th><th className="tr">ESCAÑOS</th>
            </tr>
          </thead>
          <tbody>
            {top.map((p, i) => {
              const votos = votosNacional[p.codigo] || 0;
              const pct = (votos / totalNac) * 100;
              return (
                <tr key={p.codigo}>
                  <td style={{ color: 'var(--tx3)', fontFamily: 'DM Mono', fontWeight: 700 }}>{i + 1}</td>
                  <td>
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: colorOfPartido(p.codigo), marginRight: 10, verticalAlign: 'middle', boxShadow: '0 0 0 1px rgba(0,0,0,.06)' }} />
                    <span style={{ fontWeight: 600 }}>{nombreCorto(p.nombre)}</span>
                    <span className="senado-bar">
                      <span className="senado-bar-fill" style={{ width: `${(pct / maxPct) * 100}%`, background: colorOfPartido(p.codigo) }} />
                    </span>
                  </td>
                  <td style={{ fontFamily: 'DM Mono', color: 'var(--tx2)' }}>{votos.toLocaleString('es-PE')}</td>
                  <td className="tr" style={{ fontWeight: 600, color: colorOfPartido(p.codigo) }}>{pct.toFixed(2)}%</td>
                  <td className="tr" style={{ fontWeight: 800, fontSize: 15 }}>{p.escanos || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DistritosTab({ data, onSelect }: { data: DiputadosData; onSelect: (d: DistritoDiputados) => void }) {
  const sorted = [...data.distritos].sort((a, b) => b.escanos - a.escanos);

  // Adaptar DistritoDiputados a DistritoRegional para MapPartidos
  const mapData = data.distritos.map(d => ({
    codigo: d.codigo,
    nombre: d.nombre,
    pctActas: d.pctActas,
    escanos: d.escanos,
    totalVotosValidos: d.totalVotosValidos,
    partidos: d.partidos.map(p => ({
      codigo: p.codigo,
      nombre: p.nombre,
      votos: p.votos,
      pct: p.pct,
      candidatos: p.totalCandidatos,
    })),
    asignacion: Object.fromEntries(d.partidos.map(p => [p.codigo, p.escanos])),
    ganador: d.ganador,
  }));

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Mapa del Perú — partido ganador por distrito</div>
        <div className="card-sub">Etiquetas: escaños del ganador · % de voto · click abre el detalle</div>
        <MapPartidos
          distritos={mapData as any}
          onSelect={(d: any) => {
            const orig = data.distritos.find(x => x.codigo === d.codigo);
            if (orig) onSelect(orig);
          }}
        />
      </div>

      <div className="card">
        <div className="card-title">Distritos electorales</div>
        <div className="card-sub">Click para ver los diputados electos</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 14 }}>
          {sorted.map(d => {
            const gan = d.ganador ? d.partidos.find(p => p.codigo === d.ganador) : null;
            const ganColor = gan ? colorOfPartido(gan.codigo) : '#888';
            const seatColors: string[] = [];
            [...d.partidos].filter(p => p.escanos > 0)
              .sort((a, b) => b.escanos - a.escanos)
              .forEach(p => { for (let i = 0; i < p.escanos; i++) seatColors.push(colorOfPartido(p.codigo)); });
            return (
              <button
                key={d.codigo}
                onClick={() => onSelect(d)}
                className="distrito-card"
                style={{ borderLeftColor: ganColor }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <div className="distrito-name">{d.nombre}</div>
                  <div style={{ fontFamily: 'DM Mono', fontWeight: 800, fontSize: 18, color: 'var(--tx1)' }}>{d.escanos}</div>
                </div>
                <div className="distrito-meta">actas {d.pctActas.toFixed(1)}% · {d.totalVotosValidos.toLocaleString('es-PE')} votos</div>
                <div className="distrito-seats-row">
                  {seatColors.map((c, i) => (
                    <span key={i} className="distrito-seat" style={{ background: c }} />
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

function DistritoModal({
  distrito: d, onClose, onSeatClick, onDrillProvincias,
}: {
  distrito: DistritoDiputados;
  onClose: () => void;
  onSeatClick: (s: SeatInfo) => void;
  onDrillProvincias?: () => void;
}) {
  const partidosConEscanos = d.partidos.filter(p => p.escanos > 0);
  const seats = useMemo(() => buildSeatsFromDistrito(d), [d]);
  const hasDrill = !!(DEPT_UBIGEO[d.nombre.toUpperCase()] && onDrillProvincias);

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 680, width: '95%' }}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h3 style={{ fontSize: 20 }}>{d.nombre}</h3>
        <div className="region-sub" style={{ marginBottom: 10 }}>
          {d.escanos} diputados · actas {d.pctActas.toFixed(2)}% · {d.totalVotosValidos.toLocaleString('es-PE')} votos válidos · click en un asiento para ver al electo
        </div>

        <div style={{ margin: '8px 0 16px' }}>
          <Hemicycle seats={seats} total={d.escanos} size="sm" onSeatClick={onSeatClick} />
        </div>

        {hasDrill && (
          <button
            onClick={onDrillProvincias}
            className="goberna-btn"
            style={{
              width: '100%',
              marginBottom: 16,
              padding: '10px 14px',
              background: 'linear-gradient(90deg, #d4a017, #c9a44a)',
              color: '#1a1a1a',
              border: 'none',
              borderRadius: 8,
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              fontSize: 12,
              letterSpacing: 1.5,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx3)', letterSpacing: 1.5, marginBottom: 10 }}>
          DIPUTADOS ELECTOS
        </div>

        {partidosConEscanos.map(p => (
          <PartyElectosBlock key={p.codigo} partido={p} onSeatClick={onSeatClick} distritoNombre={d.nombre} />
        ))}
      </div>
    </div>
  );
}

function PartyElectosBlock({
  partido: p, onSeatClick, distritoNombre,
}: {
  partido: { codigo: string; nombre: string; pct: number; votos: number; escanos: number; candidatos: CandidatoElecto[] };
  onSeatClick: (s: SeatInfo) => void;
  distritoNombre: string;
}) {
  const color = colorOfPartido(p.codigo);
  const electos = p.candidatos.filter(c => c.electo);

  return (
    <div style={{ marginBottom: 14, padding: '10px 12px', background: 'var(--bg-alt)', borderRadius: 8, borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <span style={{ fontWeight: 700, color: 'var(--tx1)' }}>{nombreCorto(p.nombre)}</span>
          <span style={{ marginLeft: 8, fontSize: 12, color }}>{p.pct.toFixed(2)}%</span>
        </div>
        <span style={{
          fontFamily: 'DM Mono', fontWeight: 800, fontSize: 16,
          color: '#fff', background: color, padding: '3px 10px', borderRadius: 12,
        }}>
          {p.escanos}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 8 }}>
        {electos.map((c, i) => (
          <button
            key={c.dni || i}
            onClick={() => onSeatClick({
              color, partyCodigo: p.codigo, partyName: p.nombre,
              candidatoNombre: c.nombre, candidatoDni: c.dni,
              votosPreferenciales: c.votosPreferenciales,
              distrito: distritoNombre, orderInParty: i,
              partidoPct: p.pct, partidoVotos: p.votos, partidoEscanos: p.escanos,
            })}
            className="electo-row"
            style={{ ['--c' as any]: color }}
          >
            <CandidatePhoto dni={c.dni} nombre={c.nombre} color={color} size={36} ring={false} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="electo-nombre">{c.nombre.split(' ').slice(0, 3).join(' ')}</div>
              <div className="electo-pref">
                <span style={{ color }}>{c.votosPreferenciales.toLocaleString('es-PE')}</span> pref.
              </div>
            </div>
            <div className="electo-rank">{i + 1}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
