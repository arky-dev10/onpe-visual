export interface PartidoVotos {
  codigo: string;
  nombre: string;
  votos: number;
  pct: number;
  candidatos?: number;
}

export interface SenadoNacional {
  pctActas: number;
  actasRevisadas: number;
  actasTotal: number;
  votosEmitidos: number;
  totalVotosValidos: number;
  fechaActualizacion: string;
  escanosTotales: number;
  valla: number;
  partidos: PartidoVotos[];
  escanos: Record<string, number>;
}

export interface DistritoRegional {
  codigo: number;
  nombre: string;
  pctActas: number;
  escanos: number;
  totalVotosValidos: number;
  partidos: PartidoVotos[];
  asignacion: Record<string, number>;
  ganador: string | null;
}

export interface SenadoData {
  _scrapedAt: string;
  nacional: SenadoNacional;
  regional: {
    distritos: DistritoRegional[];
    escanosTotales: number;
    resumenPartidos: { codigo: string; nombre: string; escanos: number }[];
  };
}

export async function loadSenado(): Promise<SenadoData | null> {
  const url = `/api/senadores?t=${Date.now()}`;
  try {
    const r = await fetch(url, { cache: 'no-store', headers: { 'cache-control': 'no-cache' } });
    if (!r.ok) return null;
    return (await r.json()) as SenadoData;
  } catch {
    return null;
  }
}

// Colores por partido (los mayores que hemos visto). Fallback gris.
export const PARTY_COLORS: Record<string, string> = {
  '8':  '#E8943A',  // FUERZA POPULAR  (naranja)
  '35': '#4A90D9',  // RENOVACIÓN POPULAR (azul)
  '16': '#2ECDA7',  // PARTIDO DEL BUEN GOBIERNO (verde)
  '10': '#E04848',  // JUNTOS POR EL PERÚ (rojo)
  '2':  '#B07CD8',  // AHORA NACIÓN (morado)
  '14': '#F5D76E',  // PARTIDO CÍVICO OBRAS (amarillo)
  '23': '#8b5cf6',  // PAÍS PARA TODOS (violeta)
  '33': '#10b981',  // PRIMERO LA GENTE (esmeralda)
  '28': '#f97316',  // PERÚ ACCIÓN (naranja oscuro)
  '26': '#06b6d4',  // INTEGRIDAD DEMOCRÁTICA (cyan)
  '30': '#8b7355',  // PRIN (marrón)
};
export function colorOfPartido(codigo: string): string {
  return PARTY_COLORS[codigo] || '#6b7280';
}

// Nombre corto para tarjetas
const SHORT_NAMES: Record<string, string> = {
  'FUERZA POPULAR': 'Fuerza Popular',
  'RENOVACIÓN POPULAR': 'Renovación Popular',
  'PARTIDO DEL BUEN GOBIERNO': 'Buen Gobierno',
  'JUNTOS POR EL PERÚ': 'Juntos por el Perú',
  'AHORA NACIÓN - AN': 'Ahora Nación',
  'PARTIDO CÍVICO OBRAS': 'Cívico Obras',
  'PARTIDO PAÍS PARA TODOS': 'País para Todos',
  'PRIMERO LA GENTE – COMUNIDAD, ECOLOGÍA, LIBERTAD Y PROGRESO': 'Primero la Gente',
  'ALIANZA PARA EL PROGRESO': 'APP',
  'PARTIDO POLÍTICO PERÚ ACCIÓN': 'Perú Acción',
  'PARTIDO POLÍTICO INTEGRIDAD DEMOCRÁTICA': 'Integridad',
  'PARTIDO POLÍTICO PRIN': 'PRIN',
  'PARTIDO SICREO': 'SICREO',
};
export function nombreCorto(nombre: string): string {
  return SHORT_NAMES[nombre] || nombre.split(' ').slice(0, 3).join(' ');
}
