// Vercel serverless function — proxy al backend ONPE en el VPS.
// Evita el bloqueo mixed-content (Vercel es HTTPS, VPS es HTTP).
// URL pública: https://<tu-vercel-app>/api/onpe

// Vercel Node.js serverless (no edge — edge bloquea IPs directas).
import type { VercelRequest, VercelResponse } from '@vercel/node';

const VPS = 'http://161.132.39.165:8088/onpe.json';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch(VPS, { cache: 'no-store' });
    const body = await r.text();
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.setHeader('cache-control', 'public, s-maxage=30, stale-while-revalidate=120');
    res.status(r.status).send(body);
  } catch (e: any) {
    res.status(502).json({ error: 'upstream', message: String(e?.message || e) });
  }
}
