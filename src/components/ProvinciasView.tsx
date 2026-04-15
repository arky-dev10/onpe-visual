import { useEffect, useState } from 'react';

interface PartidoProv {
  partido: string;
  candidato: string | null;
  codigo: string;
  votos: number;
  pct: number;
}
interface Provincia {
  ubigeo: string;
  nombre: string;
  pctActas: number;
  votosEmitidos: number;
  votosValidos: number;
  ganador: PartidoProv | null;
  partidos: PartidoProv[];
}

// Colores por partido presidencial (reusamos la paleta existente)
const PARTY_COLORS: Record<string, string> = {
  '8':  '#E8943A',  '35': '#4A90D9',  '16': '#2ECDA7',  '10': '#E04848',
  '2':  '#B07CD8',  '14': '#F5D76E',  '23': '#8b5cf6',  '33': '#10b981',
  '28': '#f97316',  '26': '#06b6d4',  '30': '#8b7355',  '5':  '#06b6d4',
};
const colorOf = (codigo: string) => PARTY_COLORS[codigo] || '#6b7280';

const nombreCorto = (s: string) => {
  if (!s) return '';
  const short: Record<string, string> = {
    'FUERZA POPULAR': 'Fuerza Popular',
    'RENOVACIÓN POPULAR': 'Renovación Popular',
    'PARTIDO DEL BUEN GOBIERNO': 'Buen Gobierno',
    'JUNTOS POR EL PERÚ': 'Juntos por el Perú',
    'AHORA NACIÓN - AN': 'Ahora Nación',
    'PARTIDO CÍVICO OBRAS': 'Cívico Obras',
    'PARTIDO PAÍS PARA TODOS': 'País para Todos',
  };
  return short[s] || s.split(' ').slice(0, 3).join(' ');
};

export function ProvinciasView({ deptUbigeo, deptNombre, onClose }: { deptUbigeo: string; deptNombre: string; onClose: () => void }) {
  const [provincias, setProvincias] = useState<Provincia[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(`/api/provincias?dept=${deptUbigeo}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (alive) setProvincias(j.provincias || []);
      } catch (e: any) {
        if (alive) setError(e.message);
      }
    }
    load();
    return () => { alive = false; };
  }, [deptUbigeo]);

  // Stats agregadas
  const partidosAgregados: Record<string, { votos: number; pct: number; nombre: string }> = {};
  provincias?.forEach(p => {
    p.partidos.forEach(pp => {
      if (!partidosAgregados[pp.codigo]) partidosAgregados[pp.codigo] = { votos: 0, pct: 0, nombre: pp.partido };
      partidosAgregados[pp.codigo].votos += pp.votos;
    });
  });
  const totalVotos = Object.values(partidosAgregados).reduce((a, b) => a + b.votos, 0);
  Object.values(partidosAgregados).forEach(p => { p.pct = totalVotos ? (p.votos / totalVotos) * 100 : 0; });
  const topAggr = Object.entries(partidosAgregados).sort(([, a], [, b]) => b.votos - a.votos).slice(0, 5);

  return (
    <div className="modal-overlay open" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 720, width: '95%' }}>
        <button className="modal-close" onClick={onClose} aria-label="Cerrar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="16" height="16">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <h3 style={{ fontSize: 20 }}>Provincias de {deptNombre}</h3>
        <div className="region-sub" style={{ marginBottom: 14 }}>
          Resultados presidenciales por provincia · ONPE en vivo
        </div>

        {!provincias && !error && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>
            Cargando provincias…
          </div>
        )}

        {error && (
          <div style={{ padding: 20, color: 'var(--c-sanch)', fontSize: 13 }}>
            Error cargando provincias: {error}
          </div>
        )}

        {provincias && (
          <>
            {/* Resumen agregado */}
            {topAggr.length > 0 && (
              <div style={{ padding: '10px 12px', background: 'var(--bg-alt)', borderRadius: 8, marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--tx3)', letterSpacing: 1.5, fontWeight: 700, marginBottom: 6 }}>
                  TOP PARTIDOS EN {deptNombre.toUpperCase()}
                </div>
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
                  {topAggr.map(([codigo, info]) => (
                    <span key={codigo} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: colorOf(codigo), display: 'inline-block' }} />
                      <span style={{ fontWeight: 600 }}>{nombreCorto(info.nombre)}</span>
                      <span style={{ fontFamily: 'DM Mono', color: colorOf(codigo), fontWeight: 700 }}>{info.pct.toFixed(1)}%</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {provincias.map(p => {
                const ganColor = p.ganador ? colorOf(p.ganador.codigo) : '#888';
                return (
                  <div
                    key={p.ubigeo}
                    className="distrito-card"
                    style={{ borderLeftColor: ganColor, cursor: 'default' }}
                  >
                    <div className="distrito-name">{p.nombre}</div>
                    <div className="distrito-meta">
                      {p.pctActas.toFixed(1)}% actas · {p.votosEmitidos.toLocaleString('es-PE')} votos
                    </div>

                    {/* Top 3 partidos visuales */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                      {p.partidos.slice(0, 3).map(pp => {
                        const pctMax = p.partidos[0]?.pct || 1;
                        return (
                          <div key={pp.codigo}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                              <span style={{ color: colorOf(pp.codigo), fontWeight: 600 }}>{nombreCorto(pp.partido)}</span>
                              <span style={{ fontFamily: 'DM Mono', color: colorOf(pp.codigo), fontWeight: 700 }}>{pp.pct.toFixed(1)}%</span>
                            </div>
                            <div style={{
                              height: 4,
                              background: 'var(--bg-alt)',
                              borderRadius: 2,
                              overflow: 'hidden',
                            }}>
                              <div style={{
                                height: '100%',
                                width: `${(pp.pct / pctMax) * 100}%`,
                                background: colorOf(pp.codigo),
                                transition: 'width .6s cubic-bezier(.25,.8,.25,1)',
                              }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
