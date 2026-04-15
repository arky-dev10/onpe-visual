// Vercel serverless function — proxy al backend ONPE en el VPS.
// Evita el bloqueo mixed-content (Vercel es HTTPS, VPS es HTTP).
// URL pública: https://<tu-vercel-app>/api/onpe

export const config = { runtime: 'edge' };

const VPS = 'http://161.132.39.165:8088/onpe.json';

export default async function handler() {
  try {
    const r = await fetch(VPS, { cache: 'no-store' });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, s-maxage=30, stale-while-revalidate=120',
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: 'upstream', message: String(e) }), {
      status: 502,
      headers: { 'content-type': 'application/json' },
    });
  }
}
