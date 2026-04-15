import { useEffect, useMemo, useState } from 'react';
import {
  loadDiputados, colorOfPartido, nombreCorto,
  type DiputadosData, type DistritoDiputados,
} from '../data/diputadosSource';
import { Hemicycle, HemicycleLegend, type SeatInfo } from './Hemicycle';
import { SeatCard } from './SeatCard';
import { MapExplorer } from './MapExplorer';

type SubTab = 'nacional' | 'distritos';


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
  const [seatSelected, setSeatSelected] = useState<SeatInfo | null>(null);

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
      {sub === 'distritos' && <MapExplorer data={data} onSeatClick={setSeatSelected} />}

      {seatSelected && <SeatCard seat={seatSelected} onClose={() => setSeatSelected(null)} />}
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
                  <td style={{ color: 'var(--tx3)', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{i + 1}</td>
                  <td>
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: colorOfPartido(p.codigo), marginRight: 10, verticalAlign: 'middle', boxShadow: '0 0 0 1px rgba(0,0,0,.06)' }} />
                    <span style={{ fontWeight: 600 }}>{nombreCorto(p.nombre)}</span>
                    <span className="senado-bar">
                      <span className="senado-bar-fill" style={{ width: `${(pct / maxPct) * 100}%`, background: colorOfPartido(p.codigo) }} />
                    </span>
                  </td>
                  <td style={{ fontFamily: 'JetBrains Mono', color: 'var(--tx2)' }}>{votos.toLocaleString('es-PE')}</td>
                  <td className="tr" style={{ fontWeight: 600, color: colorOfPartido(p.codigo) }}>{pct.toFixed(2)}%</td>
                  <td className="tr" style={{ fontWeight: 600, fontSize: 15 }}>{p.escanos || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
