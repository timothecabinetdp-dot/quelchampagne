// Cloudflare Pages Function pour /champagne/*.
// On NE bloque QUE les anciennes références retirées (410 Gone).
// Pour tout le reste, on laisse Cloudflare servir la fiche statique (ou son 404)
// via context.next() : les fiches valides ne sont donc jamais interceptées.
const GONE = new Set([
  'sancerre', 'whisperingangel', 'whispering-angel',
  'cremant', 'rose-de-provence', 'rose-provence', 'provence-rose'
]);
export async function onRequest(context) {
  const slug = (context.params.path || []).join('/').replace(/\/+$/,'').toLowerCase();
  if (GONE.has(slug)) {
    const nf = await context.env.ASSETS.fetch(new URL('/404.html', context.request.url));
    return new Response(nf.body, { status: 410, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }
  return context.next();
}
