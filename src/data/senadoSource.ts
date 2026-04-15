export interface CandidatoSenado {
  nombre: string;
  dni: string;
  lista: number;
  votosPreferenciales: number;
  electo?: boolean;
}

export interface PartidoVotos {
  codigo: string;
  nombre: string;
  votos: number;
  pct: number;
  candidatos?: number | CandidatoSenado[]; // nacional: array; regional: number
  candidatosList?: CandidatoSenado[];      // regional detallado (si existe)
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

// Colores por partido — ajustados a la identidad visual real de cada partido
// (según sus logos y campañas oficiales). Fallback a gris.
export const PARTY_COLORS: Record<string, string> = {
  '8':  '#F58220',  // FUERZA POPULAR        · naranja fuerte (logo K naranja)
  '35': '#12B3CC',  // RENOVACIÓN POPULAR    · celeste turquesa (marca RP)
  '16': '#F5B300',  // PARTIDO DEL BUEN GOBIERNO · dorado/amarillo-naranja
  '10': '#E30613',  // JUNTOS POR EL PERÚ    · rojo intenso (JP logo)
  '2':  '#800020',  // AHORA NACIÓN          · bordó/vinotinto
  '14': '#F4C300',  // PARTIDO CÍVICO OBRAS  · amarillo oro
  '23': '#FF6B00',  // PAÍS PARA TODOS       · naranja vibrante
  '33': '#138A3E',  // PRIMERO LA GENTE      · verde
  '28': '#D63D2B',  // PERÚ ACCIÓN           · rojo
  '26': '#0A65A7',  // INTEGRIDAD DEMOCRÁTICA · azul institucional
  '30': '#7A1F3D',  // PRIN                  · guinda
  '36': '#1F6FB5',  // SALVEMOS AL PERÚ      · azul
  '31': '#B91F52',  // PARTIDO APRISTA PERUANO · rojo aprista
  '11': '#FFD100',  // PODEMOS PERÚ          · amarillo
  '7':  '#004F9F',  // PARTIDO MORADO        · morado (usamos azul profundo de su logo)
  '5':  '#4A9E3C',  // FE EN EL PERÚ         · verde
  '9':  '#1E4D8C',  // FUERZA Y LIBERTAD     · azul marino
  '18': '#3EA652',  // PARTIDO DEMÓCRATA VERDE · verde
  '19': '#F5C400',  // PARTIDO DEMOCRÁTICO FEDERAL · amarillo
  '15': '#C8161D',  // PTE - PERÚ (Trabajadores) · rojo
  '20': '#0B5FA4',  // AVANZA PAÍS           · azul
  '25': '#74B859',  // PARTIDO DEMÓCRATA UNIDO · verde
  '27': '#2A4B92',  // COOPERACIÓN POPULAR   · azul cooperación
  '29': '#2EA55F',  // PROGRESEMOS           · verde
  '32': '#4F5DB3',  // ALIANZA PARA EL PROGRESO · celeste APP
  '34': '#8D1E39',  // UNIDAD NACIONAL       · guinda
  '17': '#006BA6',  // PERÚ PRIMERO          · azul
  '37': '#BC1F5D',  // UN CAMINO DIFERENTE   · rosa
};

/** Normaliza códigos padded "00000035" → "35" para hacer match con PARTY_COLORS. */
function normCod(codigo: string | number | null | undefined): string {
  if (codigo == null || codigo === '') return '';
  const n = Number(codigo);
  return Number.isFinite(n) ? String(n) : String(codigo);
}

export function colorOfPartido(codigo: string | number): string {
  const k = normCod(codigo);
  return PARTY_COLORS[k] || '#6b7280';
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
