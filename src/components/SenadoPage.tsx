import { useEffect, useMemo, useState } from 'react';
import { loadSenado, colorOfPartido, nombreCorto, type SenadoData, type CandidatoSenado } from '../data/senadoSource';
import { Hemicycle, HemicycleLegend, type SeatInfo } from './Hemicycle';
import { SeatCard } from './SeatCard';
import { SenadoExplorer } from './SenadoExplorer';

/** Construye seats con candidato real (nombre + DNI) para el Senado Nacional. */
function seatsFromPartyMap(escanos: Record<string, number>, partidos: { codigo: string; nombre: string; candidatos?: number | CandidatoSenado[]; pct?: number; votos?: number }[]): SeatInfo[] {
  const out: SeatInfo[] = [];
  const ordered = partidos
    .map(p => ({ ...p, n: escanos[p.codigo] || 0 }))
    .filter(p => p.n > 0)
    .sort((a, b) => b.n - a.n);
  for (const p of ordered) {
    const clist: CandidatoSenado[] = Array.isArray(p.candidatos) ? p.candidatos : [];
    for (let i = 0; i < p.n; i++) {
      const c = clist[i];
      out.push({
        color: colorOfPartido(p.codigo),
        partyCodigo: p.codigo,
        partyName: p.nombre,
        candidatoNombre: c?.nombre,
        candidatoDni: c?.dni,
        votosPreferenciales: c?.votosPreferenciales,
        orderInParty: i,
        partidoPct: p.pct,
        partidoVotos: p.votos,
        partidoEscanos: p.n,
      });
    }
  }
  return out;
}

type SubTab = 'nacional' | 'regional';

export function SenadoPage() {
  const [data, setData] = useState<SenadoData | null>(null);
  const [sub, setSub] = useState<SubTab>('nacional');
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
      {sub === 'regional' && <SenadoExplorer data={data} onSeatClick={setSeatSelected} />}

      {seatSelected && <SeatCard seat={seatSelected} onClose={() => setSeatSelected(null)} />}
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
