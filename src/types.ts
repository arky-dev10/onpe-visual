export type CandKey = 'fujimori' | 'rla' | 'nieto' | 'belmont' | 'sanchez';

export interface CandConfig {
  key: CandKey;
  name: string;
  short: string;
  color: string;
  bg: string;
  photo: string;
  initials: string;
}

export interface RegionResult {
  name: string;
  pct: number;
  fujimori: number;
  rla: number;
  nieto: number;
  belmont: number;
  sanchez: number;
  actasRevisadas?: number;
  actasTotal?: number;
}

export interface ProjectionRow {
  key: CandKey;
  current: number;
  final: number;
}

export interface SeriesPoint {
  pct: number;
  fujimori: number;
  rla: number;
  nieto: number;
  belmont: number;
  sanchez: number;
}

export interface DashboardData {
  pctActas: number;
  actasRevisadas: number;
  actasTotal: number;
  votosEmitidos: number;
  votosFaltantes: number;
  proximoRefresh: string;
  fechaActualizacion: string;
  jeeStatus: string;
  regions: RegionResult[];
  extranjero: RegionResult;
  series: SeriesPoint[];
  projection: Record<CandKey, number>;
  probabilities: Record<CandKey, number>;
}
