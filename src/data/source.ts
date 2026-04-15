import type { DashboardData } from '../types';
import { MOCK_ONPE, MOCK_DATUM } from './mock';

// Swappable data source.
// - Dev/offline: returns MOCK.
// - Prod: intenta fetch de /data/onpe.json (colocar el archivo en public/data/).
// El cron/script externo debe producir un JSON con el mismo shape de DashboardData.

const USE_FETCH = true;
const ONPE_URL = '/data/onpe.json';
const DATUM_URL = '/data/datum.json';

export async function loadData(source: 'onpe' | 'datum'): Promise<DashboardData> {
  if (!USE_FETCH) return source === 'onpe' ? MOCK_ONPE : MOCK_DATUM;
  const url = source === 'onpe' ? ONPE_URL : DATUM_URL;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const json = await r.json();
    return json as DashboardData;
  } catch {
    // fallback a mock si el JSON aún no existe
    return source === 'onpe' ? MOCK_ONPE : MOCK_DATUM;
  }
}
