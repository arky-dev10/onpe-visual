import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  colorOfPartido, nombreCorto,
  type DiputadosData, type DistritoDiputados,
} from '../data/diputadosSource';
import { MapPartidos } from './MapPartidos';
import { MapProvincias } from './MapProvincias';
import { Hemicycle, type SeatInfo } from './Hemicycle';
import { CandidatePhoto } from './CandidatePhoto';

type Level = 'pais' | 'distrito' | 'provincia';

interface ProvinciaPartido { partido: string; candidato: string | null; codigo: string; votos: number; pct: number; }
interface Provincia { ubigeo: string; nombre: string; pctActas: number; votosEmitidos: number; votosValidos: number; ganador: ProvinciaPartido | null; partidos: ProvinciaPartido[]; }

// ubigeo por nombre de distrito (para fetch de provincias)
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

interface Props {
  data: DiputadosData;
  onSeatClick: (s: SeatInfo) => void;
}

export function MapExplorer({ data, onSeatClick }: Props) {
  const [level, setLevel] = useState<Level>('pais');
  const [dept, setDept] = useState<DistritoDiputados | null>(null);
  const [provincias, setProvincias] = useState<Provincia[] | null>(null);
  const [selProv, setSelProv] = useState<Provincia | null>(null);
  const [hoverDept, setHoverDept] = useState<DistritoDiputados | null>(null);
  const [loadingProv, setLoadingProv] = useState(false);

  // Carga de provincias cuando se entra a nivel distrito
  useEffect(() => {
    if (level !== 'distrito' || !dept) return;
    const ubigeo = DEPT_UBIGEO[dept.nombre.toUpperCase()];
    if (!ubigeo) return;
    let alive = true;
    setLoadingProv(true);
    setProvincias(null);
    (async () => {
      try {
        const r = await fetch(`/api/provincias?dept=${ubigeo}`);
        if (!r.ok) throw 0;
        const j = await r.json();
        if (alive) { setProvincias(j.provincias || []); setLoadingProv(false); }
      } catch { if (alive) setLoadingProv(false); }
    })();
    return () => { alive = false; };
  }, [level, dept]);

  // Distritos adaptados a MapPartidos — memoizados para no redibujar el mapa
  const distritosForMap = useMemo(() => data.distritos.map(d => ({
    codigo: d.codigo,
    nombre: d.nombre,
    pctActas: d.pctActas,
    escanos: d.escanos,
    totalVotosValidos: d.totalVotosValidos,
    partidos: d.partidos.map(p => ({ codigo: p.codigo, nombre: p.nombre, votos: p.votos, pct: p.pct, candidatos: p.totalCandidatos })),
    asignacion: Object.fromEntries(d.partidos.map(p => [p.codigo, p.escanos])),
    ganador: d.ganador,
  })), [data]);

  const goToPais = useCallback(() => {
    setLevel('pais'); setDept(null); setProvincias(null); setSelProv(null);
  }, []);

  const goToDistrito = useCallback((d: DistritoDiputados) => {
    setLevel('distrito');
    setDept(d);
    setSelProv(null);
  }, []);

  // Handlers estables para el mapa país
  const distritoById = useMemo(() => new Map(data.distritos.map(d => [d.codigo, d])), [data]);
  const handleMapSelect = useCallback((d: any) => {
    const orig = distritoById.get(d.codigo);
    if (orig) goToDistrito(orig);
  }, [distritoById, goToDistrito]);
  const handleMapHover = useCallback((d: any) => {
    setHoverDept(d ? (distritoById.get(d.codigo) || null) : null);
  }, [distritoById]);

  // Color presidencial (ref estable)
  const presidencialColorOf = useCallback((cod: string) => PRESIDENCIAL_COLORS[cod] || '#6b7280', []);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Breadcrumb */}
      <div className="explorer-crumbs">
        <button className={`crumb ${level === 'pais' ? 'active' : ''}`} onClick={goToPais}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          Perú
        </button>
        {dept && (
          <>
            <span className="crumb-sep">›</span>
            <button className={`crumb ${level === 'distrito' ? 'active' : ''}`} onClick={() => { setLevel('distrito'); setSelProv(null); }}>
              {dept.nombre}
            </button>
          </>
        )}
        {selProv && (
          <>
            <span className="crumb-sep">›</span>
            <span className="crumb active" style={{ cursor: 'default' }}>{selProv.nombre}</span>
          </>
        )}

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>
          {level === 'pais' && `${data.distritos.length} distritos · ${data.totalEscanos} escaños`}
          {level === 'distrito' && dept && `${dept.escanos} escaños · ${dept.pctActas.toFixed(1)}% actas`}
        </div>
      </div>

      <div className="explorer-grid">
        {/* MAPA */}
        <div className="explorer-map">
          {level === 'pais' && (
            <MapPartidos
              distritos={distritosForMap as any}
              onSelect={handleMapSelect}
              onHover={handleMapHover}
            />
          )}
          {level === 'distrito' && dept && (
            <>
              {loadingProv && (
                <div style={{ padding: 50, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>
                  Cargando provincias de {dept.nombre}…
                </div>
              )}
              {!loadingProv && provincias && (
                <MapProvincias
                  deptNombre={dept.nombre}
                  provincias={provincias}
                  colorOf={presidencialColorOf}
                  onHover={() => {}}
                />
              )}
              {!loadingProv && !provincias && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>
                  No hay datos de provincias disponibles.
                </div>
              )}
            </>
          )}
        </div>

        {/* PANEL DERECHO DINÁMICO */}
        <div className="explorer-panel">
          {level === 'pais' && (
            <PaisPanel data={data} hoverDept={hoverDept} onPick={goToDistrito} />
          )}
          {level === 'distrito' && dept && (
            <DistritoPanel
              distrito={dept}
              provincias={provincias}
              onSeatClick={onSeatClick}
              onBack={goToPais}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// Paleta presidencial (códigos de partido presidencial distintos a los de diputados)
const PRESIDENCIAL_COLORS: Record<string, string> = {
  '8': '#E8943A',  '35': '#4A90D9',  '16': '#2ECDA7',  '10': '#E04848',
  '2': '#B07CD8',  '14': '#F5D76E',  '23': '#8b5cf6',  '33': '#10b981',
  '28': '#f97316', '26': '#06b6d4',  '30': '#8b7355',
};

// ───────────────── Panel nivel país ─────────────────
const PaisPanel = memo(function PaisPanel({ data, hoverDept, onPick }: { data: DiputadosData; hoverDept: DistritoDiputados | null; onPick: (d: DistritoDiputados) => void }) {
  const top = data.resumenPartidos.slice(0, 6);
  const totSeats = data.totalEscanos;

  return (
    <div className="panel-wrap">
      {hoverDept ? (
        <>
          <div className="panel-kicker" style={{ color: colorOfPartido(hoverDept.ganador || '') }}>DISTRITO RESALTADO</div>
          <div className="panel-title">{hoverDept.nombre}</div>
          <div className="panel-sub">{hoverDept.escanos} escaños · actas {hoverDept.pctActas.toFixed(1)}% · {hoverDept.totalVotosValidos.toLocaleString('es-PE')} votos</div>

          <div style={{ marginTop: 14 }}>
            {hoverDept.partidos.filter(p => p.escanos > 0).slice(0, 5).map(p => (
              <div key={p.codigo} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, color: colorOfPartido(p.codigo) }}>{nombreCorto(p.nombre)}</span>
                  <span style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color: 'var(--tx1)' }}>{p.escanos} · {p.pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 6, background: 'var(--bg-alt)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, p.pct * 2.5)}%`, background: colorOfPartido(p.codigo), borderRadius: 3, transition: 'width .4s' }} />
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => onPick(hoverDept)} className="panel-cta">
            Ver provincias de {hoverDept.nombre}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        </>
      ) : (
        <>
          <div className="panel-kicker">PANORAMA NACIONAL</div>
          <div className="panel-title">{totSeats} Diputados</div>
          <div className="panel-sub">Proyección en los {data.distritos.length} distritos electorales del Perú</div>

          <div style={{ marginTop: 16 }}>
            {top.map((p, i) => (
              <div key={p.codigo} style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, color: 'var(--tx3)', width: 18, fontSize: 12 }}>#{i + 1}</div>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: colorOfPartido(p.codigo), flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {nombreCorto(p.nombre)}
                  </div>
                  <div style={{ height: 5, background: 'var(--bg-alt)', borderRadius: 3, marginTop: 3, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(p.escanos / totSeats) * 100 * 4}%`, background: colorOfPartido(p.codigo), borderRadius: 3 }} />
                  </div>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 16, color: 'var(--tx1)', minWidth: 30, textAlign: 'right' }}>
                  {p.escanos}
                </div>
              </div>
            ))}
          </div>

          <div className="panel-hint">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Click en un departamento del mapa para ver sus distritos electorales y drill a provincias.
          </div>
        </>
      )}
    </div>
  );
});

// ───────────────── Panel nivel distrito ─────────────────
const DistritoPanel = memo(function DistritoPanel({ distrito: d, provincias, onSeatClick, onBack }: {
  distrito: DistritoDiputados;
  provincias: Provincia[] | null;
  onSeatClick: (s: SeatInfo) => void;
  onBack: () => void;
}) {
  const partidosConEscanos = d.partidos.filter(p => p.escanos > 0);
  const asignacion = Object.fromEntries(d.partidos.map(p => [p.codigo, p.escanos]));

  // Panel siempre muestra info del distrito de diputados (presidencial va en otra página)
  return (
    <div className="panel-wrap">
      <button onClick={onBack} className="panel-back">‹ Perú</button>
      <div className="panel-kicker">DISTRITO ELECTORAL</div>
      <div className="panel-title">{d.nombre}</div>
      <div className="panel-sub">{d.escanos} escaños · actas {d.pctActas.toFixed(2)}%</div>

      <div style={{ margin: '10px -6px 0' }}>
        <Hemicycle
          seats={partidosConEscanos.flatMap(p => p.candidatos.filter(c => c.electo).map((c, i) => ({
            color: colorOfPartido(p.codigo),
            partyCodigo: p.codigo, partyName: p.nombre,
            candidatoNombre: c.nombre, candidatoDni: c.dni,
            votosPreferenciales: c.votosPreferenciales,
            distrito: d.nombre, orderInParty: i,
            partidoPct: p.pct, partidoVotos: p.votos, partidoEscanos: p.escanos,
          })))}
          total={d.escanos}
          size="sm"
          onSeatClick={onSeatClick}
          escanos={asignacion}
          partidos={d.partidos}
        />
      </div>

      <div className="panel-subtitle">Diputados electos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
        {partidosConEscanos.flatMap(p => p.candidatos.filter(c => c.electo).map((c, i) => ({ p, c, i })))
          .sort((a, b) => b.c.votosPreferenciales - a.c.votosPreferenciales)
          .slice(0, 8)
          .map(({ p, c, i }) => {
            const color = colorOfPartido(p.codigo);
            return (
              <button
                key={`${p.codigo}-${c.dni || i}`}
                onClick={() => onSeatClick({
                  color, partyCodigo: p.codigo, partyName: p.nombre,
                  candidatoNombre: c.nombre, candidatoDni: c.dni,
                  votosPreferenciales: c.votosPreferenciales,
                  distrito: d.nombre, orderInParty: i,
                  partidoPct: p.pct, partidoVotos: p.votos, partidoEscanos: p.escanos,
                })}
                className="electo-row"
                style={{ ['--c' as any]: color }}
              >
                <CandidatePhoto dni={c.dni} nombre={c.nombre} color={color} size={32} ring={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="electo-nombre">{c.nombre.split(' ').slice(0, 3).join(' ')}</div>
                  <div className="electo-pref" style={{ color }}>{nombreCorto(p.nombre)}</div>
                </div>
                <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 600, fontSize: 11, color: 'var(--tx3)' }}>
                  {(c.votosPreferenciales / 1000).toFixed(1)}k
                </div>
              </button>
            );
          })
        }
        {partidosConEscanos.flatMap(p => p.candidatos.filter(c => c.electo)).length > 8 && (
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--tx3)', marginTop: 4 }}>
            + {partidosConEscanos.flatMap(p => p.candidatos.filter(c => c.electo)).length - 8} más
          </div>
        )}
      </div>

      {provincias && (
        <div className="panel-hint" style={{ marginTop: 14 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
          Pasa el cursor sobre las provincias del mapa para ver detalle presidencial.
        </div>
      )}
    </div>
  );
});
