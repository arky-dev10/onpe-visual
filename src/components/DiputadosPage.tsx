import { useEffect, useState } from 'react';
import {
  loadDiputados, colorOfPartido, nombreCorto,
  type DiputadosData, type DistritoDiputados, type CandidatoElecto,
} from '../data/diputadosSource';
import { Hemicycle, HemicycleLegend } from './Hemicycle';

type SubTab = 'nacional' | 'distritos';

export function DiputadosPage() {
  const [data, setData] = useState<DiputadosData | null>(null);
  const [sub, setSub] = useState<SubTab>('nacional');
  const [selected, setSelected] = useState<DistritoDiputados | null>(null);

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

  // % actas promedio ponderado (proxy del avance nacional)
  const totActas = data.distritos.reduce((s, d) => s + d.actasTotal, 0);
  const revActas = data.distritos.reduce((s, d) => s + d.actasRevisadas, 0);
  const pctActas = totActas ? (revActas / totActas) * 100 : 0;

  return (
    <div className="container">
      <header className="hero">
        <div className="hero-left">
          <div className="hero-title">Cámara de Diputados · 2026</div>
          <div className="hero-sub">Congreso Bicameral · Voto preferencial · D'Hondt por distrito</div>
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

      {sub === 'nacional' && <NacionalTab data={data} />}
      {sub === 'distritos' && <DistritosTab data={data} onSelect={setSelected} />}

      {selected && <DistritoModal distrito={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function NacionalTab({ data }: { data: DiputadosData }) {
  const top = data.resumenPartidos.slice(0, 12);
  const escanos: Record<string, number> = {};
  data.resumenPartidos.forEach(p => { escanos[p.codigo] = p.escanos; });
  const partidos = data.resumenPartidos.map(p => ({ codigo: p.codigo, nombre: p.nombre }));

  // Votos nacionales agregados por partido
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
        <div className="card-title" style={{ fontSize: 14 }}>Composición proyectada de la Cámara de Diputados</div>
        <div className="card-sub">
          {data.totalEscanos} escaños distribuidos en {data.distritos.length} distritos electorales
        </div>
        <Hemicycle escanos={escanos} partidos={partidos} total={data.totalEscanos} size="lg" />
        <HemicycleLegend escanos={escanos} partidos={partidos} />
      </div>

      <div className="card">
        <div className="card-title">Ranking nacional</div>
        <div className="card-sub">Top partidos por escaños proyectados · suma de votos en los 27 distritos</div>
        <table className="senado-table">
          <thead>
            <tr>
              <th>#</th>
              <th>PARTIDO</th>
              <th>VOTOS TOTALES</th>
              <th className="tr">%</th>
              <th className="tr">ESCAÑOS</th>
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

  return (
    <div className="card">
      <div className="card-title">Distritos electorales</div>
      <div className="card-sub">Click para ver los candidatos electos</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12, marginTop: 14 }}>
        {sorted.map(d => {
          const gan = d.ganador ? d.partidos.find(p => p.codigo === d.ganador) : null;
          const ganColor = gan ? colorOfPartido(gan.codigo) : '#888';
          const seatColors: string[] = [];
          [...d.partidos]
            .filter(p => p.escanos > 0)
            .sort((a, b) => b.escanos - a.escanos)
            .forEach(p => {
              for (let i = 0; i < p.escanos; i++) seatColors.push(colorOfPartido(p.codigo));
            });
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
              <div className="distrito-meta">actas {d.pctActas.toFixed(1)}% · {d.totalVotosValidos.toLocaleString('es-PE')} votos válidos</div>
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
  );
}

function DistritoModal({ distrito: d, onClose }: { distrito: DistritoDiputados; onClose: () => void }) {
  const partidosConEscanos = d.partidos.filter(p => p.escanos > 0);
  const asignacion: Record<string, number> = {};
  d.partidos.forEach(p => { asignacion[p.codigo] = p.escanos; });

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
          {d.escanos} diputados · actas {d.pctActas.toFixed(2)}% · {d.totalVotosValidos.toLocaleString('es-PE')} votos válidos
        </div>

        <div style={{ margin: '8px 0 16px' }}>
          <Hemicycle escanos={asignacion} partidos={d.partidos} total={d.escanos} size="sm" />
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx3)', letterSpacing: 1.5, marginBottom: 10 }}>
          DIPUTADOS ELECTOS
        </div>

        {partidosConEscanos.map(p => (
          <PartyElectosBlock key={p.codigo} partido={p} />
        ))}
      </div>
    </div>
  );
}

function PartyElectosBlock({ partido: p }: { partido: { codigo: string; nombre: string; pct: number; votos: number; escanos: number; candidatos: CandidatoElecto[] } }) {
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
          fontFamily: 'DM Mono',
          fontWeight: 800,
          fontSize: 16,
          color: '#fff',
          background: color,
          padding: '3px 10px',
          borderRadius: 12,
        }}>
          {p.escanos}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
        {electos.map((c, i) => (
          <div key={c.dni || i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 8px',
            background: 'var(--bg-card)',
            borderRadius: 6,
            border: '1px solid var(--border)',
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              background: color, color: '#fff',
              display: 'grid', placeItems: 'center',
              fontSize: 10, fontFamily: 'DM Mono', fontWeight: 700,
              flexShrink: 0,
            }}>
              {i + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.nombre.split(' ').slice(0, 3).join(' ')}
              </div>
              <div style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: 'DM Mono' }}>
                {c.votosPreferenciales.toLocaleString('es-PE')} pref.
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
