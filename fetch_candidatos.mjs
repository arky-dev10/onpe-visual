import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await (await b.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
})).newPage();

const capturedByUrl = {};
p.on('response', async r => {
  const u = r.url();
  const ct = r.headers()['content-type'] || '';
  if (u.includes('participantes-por-candidato') && ct.includes('json')) {
    try { capturedByUrl[u] = await r.text(); } catch {}
  }
});

await p.goto('https://resultadoelectoral.onpe.gob.pe/main/diputados', { waitUntil: 'domcontentloaded' });
await p.waitForTimeout(8000);
const byCand = await p.$(':text("Resultado por candidato")');
if (byCand) { await byCand.click(); await p.waitForTimeout(4000); }

const urls = Object.keys(capturedByUrl);
console.log('captured URLs:', urls.length);
if (urls.length) {
  const sample = JSON.parse(capturedByUrl[urls[0]]);
  console.log('keys:', Object.keys(sample));
  const data = sample.data?.content ? sample.data.content : sample.data;
  console.log('pagination:', { totalElements: sample.data?.totalElements, totalPages: sample.data?.totalPages, pageSize: sample.data?.size });
  console.log('first 3:', JSON.stringify(data?.slice(0, 3), null, 2));
}
await b.close();
