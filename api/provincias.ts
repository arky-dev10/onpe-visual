// Vercel Node serverless — devuelve provincias de un departamento con resultados ONPE presidenciales.
// Uso:  /api/provincias?dept=140000
import type { VercelRequest, VercelResponse } from '@vercel/node';

const BASE = 'https://resultadoelectoral.onpe.gob.pe/presentacion-backend';

const HDRS = {
  'Content-Type': 'application/json',
  'Accept': '*/*',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Dest': 'empty',
  'Referer': 'https://resultadoelectoral.onpe.gob.pe/main/presidenciales',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

async function j(url: string) {
  const r = await fetch(url, { headers: HDRS, cache: 'no-store' });
  if (r.status === 204) return null;
  if (!r.ok) return null;
  const t = await r.text();
  if (t.startsWith('<')) return null;
  try { return JSON.parse(t); } catch { return null; }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const dept = String(req.query.dept || '');
  if (!/^\d{6}$/.test(dept)) return res.status(400).json({ error: 'bad dept ubigeo' });

  try {
    const lista = await j(`${BASE}/ubigeos/provincias?idEleccion=10&idAmbitoGeografico=1&idUbigeoDepartamento=${dept}`);
    const provincias = lista?.data || [];
    if (!provincias.length) return res.status(404).json({ error: 'no provincias' });

    // Por cada provincia: totales + participantes (chunked 5 en paralelo)
    const resultados: any[] = [];
    for (let i = 0; i < provincias.length; i += 5) {
      const chunk = provincias.slice(i, i + 5);
      const out = await Promise.all(chunk.map(async (p: any) => {
        const tot = await j(`${BASE}/resumen-general/totales?tipoFiltro=ubigeo_nivel_02&idAmbitoGeografico=1&idUbigeoDepartamento=${dept}&idUbigeoProvincia=${p.ubigeo}&idEleccion=10`);
        const par = await j(`${BASE}/eleccion-presidencial/participantes-ubicacion-geografica-nombre?tipoFiltro=ubigeo_nivel_02&idAmbitoGeografico=1&ubigeoNivel1=${dept}&ubigeoNivel2=${p.ubigeo}&idEleccion=10`);
        const partidos = (par?.data || [])
          .filter((x: any) => x.totalVotosValidos > 0 && x.porcentajeVotosValidos != null)
          .sort((a: any, b: any) => b.totalVotosValidos - a.totalVotosValidos)
          .slice(0, 6)
          .map((x: any) => ({
            partido: x.nombreAgrupacionPolitica,
            candidato: x.nombreCandidato || null,
            codigo: String(x.codigoAgrupacionPolitica ?? ''),
            votos: x.totalVotosValidos,
            pct: x.porcentajeVotosValidos,
          }));
        return {
          ubigeo: p.ubigeo,
          nombre: p.nombre,
          pctActas: tot?.data?.actasContabilizadas ?? 0,
          votosEmitidos: tot?.data?.totalVotosEmitidos ?? 0,
          votosValidos: tot?.data?.totalVotosValidos ?? 0,
          ganador: partidos[0] || null,
          partidos,
        };
      }));
      resultados.push(...out);
    }

    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.status(200).json({ dept, provincias: resultados });
  } catch (e: any) {
    res.status(502).json({ error: 'upstream', message: String(e?.message || e) });
  }
}
