import { colorOfPartido, nombreCorto, PARTY_COLORS } from './senadoSource';

export { colorOfPartido, nombreCorto, PARTY_COLORS };

export interface CandidatoElecto {
  nombre: string;
  dni: string;
  lista: number;
  votosPreferenciales: number;
  electo: boolean;
}

export interface PartidoDiputados {
  codigo: string;
  nombre: string;
  votos: number;
  pct: number;
  escanos: number;
  totalCandidatos: number;
  candidatos: CandidatoElecto[];
}

export interface DistritoDiputados {
  codigo: number;
  nombre: string;
  pctActas: number;
  actasRevisadas: number;
  actasTotal: number;
  totalVotosValidos: number;
  votosEmitidos: number;
  escanos: number;
  partidos: PartidoDiputados[];
  ganador: string | null;
}

export interface DiputadosData {
  _scrapedAt: string;
  totalEscanos: number;
  distritos: DistritoDiputados[];
  resumenPartidos: { codigo: string; nombre: string; escanos: number }[];
}

export async function loadDiputados(): Promise<DiputadosData | null> {
  try {
    const r = await fetch(`/api/diputados?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as DiputadosData;
  } catch {
    return null;
  }
}
