// Cloudflare Pages Function : ne s'exécute que pour les URL /champagne/* qui
// n'ont PAS de page statique (les fiches valides sont servies avant la fonction).
// Les anciennes références retirées renvoient 410 (Gone), les autres 404.
const GONE = new Set([
  'sancerre', 'whisperingangel', 'whispering-angel',
  'cremant', 'rose-de-provence', 'rose-provence', 'provence-rose'
]);
export async function onRequest(context) {
  const slug = (context.params.path || []).join('/').replace(/\/+$/,'').toLowerCase();
  const status = GONE.has(slug) ? 410 : 404;
  const asset = await context.env.ASSETS.fetch(new URL('/404.html', context.request.url));
  return new Response(asset.body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
