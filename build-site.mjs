/**
 * build-site.mjs — Génère le site statique multi-pages pour le SEO.
 *
 * Lit index.html (le sélecteur interactif) pour réutiliser son CSS et ses données,
 * puis produit un dossier dist/ avec :
 *   /                       page d'accueil statique (contenu + liens réels)
 *   /selecteur/             le sélecteur interactif (quiz)
 *   /champagnes/            la liste de la sélection
 *   /champagne/<slug>/      une page par champagne (fiche détaillée, indexable)
 *   /blog/                  la liste des articles
 *   /blog/<slug>/           une page par article (indexable)
 *   /sitemap.xml, /robots.txt
 *
 * Chaque page a sa propre URL, son <title>, sa meta description et son contenu
 * DANS le code source (pas seulement en JS) : c'est ce que Google indexe.
 *
 * Lancer :  node build-site.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';

const BASE = 'https://quelchampagne.fr';
const HERO = 'https://images.unsplash.com/photo-1609421141185-8a4f37a5d063?auto=format&fit=crop&w=1200&q=72';
const OG   = HERO;
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8.4 5H15.6L14.2 12.3A2.7 2.7 0 0 1 9.8 12.3Z' fill='%23F3E7C9' stroke='%239C7A34' stroke-width='1.2'/%3E%3Cline x1='12' y1='15' x2='12' y2='20.2' stroke='%239C7A34' stroke-width='1.3'/%3E%3Cline x1='9' y1='20.6' x2='15' y2='20.6' stroke='%239C7A34' stroke-width='1.3'/%3E%3C/svg%3E";

// ---------- lire index.html : CSS + données ----------
const HTML = readFileSync('index.html', 'utf8');
const CSS = HTML.split('<style>')[1].split('</style>')[0];
const SCRIPT = HTML.split('<script>')[1].split('</script>')[0];

const ctx = {};
global.document = { getElementById:()=>({set innerHTML(v){}, get innerHTML(){return '';}}), createElement:()=>({set innerHTML(v){}, appendChild(){}, remove(){}, querySelector(){return {set innerHTML(v){}};}, style:{}}), body:{appendChild(){}}, documentElement:{lang:'', style:{setProperty(){}}} };
global.window = { scrollTo(){}, open(){} };
global.localStorage = { getItem(){return null;}, setItem(){} };
global.fetch = () => Promise.reject('x');
eval(SCRIPT + '; Object.assign(ctx,{products,articles,prod,art,detail,coverBg,PHOTOS,photoSrc,buyLink,bottleViz,logoMark,BRAND,AMAZON_TAG});');

const { products, articles, prod, detail, coverBg, buyLink, bottleViz, logoMark, BRAND } = ctx;
const MAISONS = ['Dom Pérignon','Ruinart','Bollinger','Veuve Clicquot','Moët & Chandon','Laurent-Perrier','Perrier-Jouët','Nicolas Feuillatte'];

// ---------- gabarits partagés ----------
function header(active){
  const L=(href,label,key)=>`<a class="nlink${active===key?' on':''}" href="${href}">${label}</a>`;
  return `<div class="nav"><div class="container nav-in">
    <a class="logo" href="/">${logoMark()}<span class="logo-txt">Quel<b>Champagne</b></span></a>
    <div class="nav-links">${L('/selecteur/','Le sélecteur','selecteur')}${L('/champagnes/','La sélection','shop')}${L('/blog/','Blog','blog')}</div>
  </div></div>`;
}
function footer(){
  return `<footer><div class="container">
    <div class="foot-in">
      <div class="foot-brand"><span class="foot-brand-name">${logoMark()}${BRAND}</span><p>Le sélecteur de champagne qui vous oriente vers la cuvée juste, en six questions.</p></div>
      <div class="foot-links"><a href="/selecteur/">Le sélecteur</a><a href="/champagnes/">La sélection</a><a href="/blog/">Blog</a></div>
    </div>
    <div class="foot-health">L'abus d'alcool est dangereux pour la santé. À consommer avec modération.</div>
    <div class="foot-disc">Site réservé aux personnes majeures. ${BRAND} présente une sélection éditoriale indépendante à visée informative. En tant que Partenaire Amazon, ${BRAND} réalise un bénéfice sur les achats remplissant les conditions requises, sans surcoût pour vous. Prix indicatifs.</div>
  </div></footer>`;
}
const AGEGATE = `<script>
(function(){
  try{ if(localStorage.getItem('qc_age_ok')==='1') return; }catch(e){}
  var w=document.createElement('div'); w.className='agegate'; w.id='agegate';
  var b=document.createElement('div'); b.className='agegate-box';
  b.innerHTML='<div class="g"></div><h2>Vous avez 18 ans ou plus ?</h2><p>QuelChampagne est un site sur le champagne, r&eacute;serv&eacute; aux personnes majeures.</p>';
  var r=document.createElement('div'); r.className='btns';
  var y=document.createElement('button'); y.className='btn btn-primary'; y.textContent='Oui, je suis majeur'; y.onclick=function(){try{localStorage.setItem('qc_age_ok','1');}catch(e){} w.remove();};
  var n=document.createElement('button'); n.className='btn btn-ghost'; n.textContent='Non'; n.onclick=function(){b.innerHTML='<div class="g"></div><h2>&Agrave; bient&ocirc;t</h2><p>Ce site est r&eacute;serv&eacute; aux personnes majeures.</p>';};
  r.appendChild(y); r.appendChild(n); b.appendChild(r);
  var h=document.createElement('div'); h.className='health'; h.textContent="L'abus d'alcool est dangereux pour la sant\\u00e9. \\u00c0 consommer avec mod\\u00e9ration."; b.appendChild(h);
  w.appendChild(b); document.body.appendChild(w);
})();
</script>`;

function page({title, desc, canonical, ogImage, active, main}){
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<meta name="description" content="${desc.replace(/"/g,'&quot;')}">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc.replace(/"/g,'&quot;')}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${ogImage||OG}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;450;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
${header(active)}
${main}
${footer()}
${AGEGATE}
</body>
</html>`;
}

// ---------- cartes ----------
function productCard(p){
  const d = detail(p) || {};
  return `<a class="pcard" href="/champagne/${p.id}/">
    <div class="pcard-img">${bottleViz(p,'card')}${d.score?`<span class="pscore">${d.score}<small>/100</small></span>`:''}</div>
    <div class="pcard-b"><div class="pcard-house">${p.house}</div><div class="pcard-name">${p.short}</div><div class="pcard-note">${p.note}</div><div class="pcard-foot"><span class="pcard-price">${p.price} €</span><span class="chev">Découvrir</span></div></div>
  </a>`;
}
function articleCard(a){
  return `<a class="acard" href="/blog/${a.id}/"><div class="acard-cover" style="background:${coverBg(a)}"><span class="acard-cat">${a.cat}</span></div><div class="acard-b"><h3>${a.title}</h3><p>${a.excerpt}</p><div class="acard-meta">${a.date} · ${a.read} de lecture</div></div></a>`;
}
function fixLinks(body){
  return body.replace(/href="#" onclick="return openAff\('([^']+)'\)"/g, (m,id)=>`href="${buyLink(prod(id))}" target="_blank" rel="sponsored noopener"`);
}

// ---------- pages ----------
function homeMain(){
  const sel = products().slice(0,3).map(productCard).join('');
  const arts = articles().filter(a=>!a.soon).slice(0,3).map(articleCard).join('');
  const maisons = MAISONS.map(m=>`<span class="maison-name">${m}</span>`).join('');
  return `
  <section class="hero"><div class="container">
    <h1>Le champagne<br>fait pour vous.</h1>
    <p class="lead">Six questions suffisent. Nous trouvons la cuvée juste.</p>
    <div class="hero-cta"><a class="btn btn-primary" href="/selecteur/">Commencer</a><a class="chev" href="/blog/">Découvrir le blog</a></div>
    <div class="hero-visual"><img class="pimg" src="${HERO}" alt="Deux coupes de champagne" loading="eager"></div>
  </div></section>
  <section class="section gray"><div class="container">
    <div class="sec-head"><div class="h2">Comment ça marche</div><p>Trois étapes, une petite minute.</p></div>
    <div class="steps">
      <div class="step"><div class="n">01</div><h3>Répondez</h3><p>Six questions sur l'occasion, le goût, les bulles, l'accord et le budget.</p></div>
      <div class="step"><div class="n">02</div><h3>Recevez</h3><p>Notre moteur classe la sélection et fait remonter votre coup de cœur, plus trois alternatives.</p></div>
      <div class="step"><div class="n">03</div><h3>Découvrez</h3><p>Chaque cuvée a sa fiche détaillée et son lien d'achat.</p></div>
    </div>
  </div></section>
  <section class="band"><div class="container">
    <div class="eyebrow-l">Six questions, soixante secondes</div>
    <h2>Le bon champagne ne se devine pas. Il se trouve.</h2>
    <p>Occasion, goût, budget : notre sélecteur fait le tri pour vous, parmi les grandes maisons et les pépites confidentielles.</p>
    <a class="btn btn-accent" href="/selecteur/">Lancer le sélecteur</a>
  </div></section>
  <section class="section"><div class="container">
    <div class="sec-head"><div class="h2">La sélection</div><p>Onze cuvées passées au crible, chacune avec sa fiche détaillée et son lien d'achat.</p></div>
    <div class="pgrid">${sel}</div>
    <div class="center-cta"><a class="chev" href="/champagnes/">Voir toute la sélection</a></div>
    <div class="maisons" style="margin-top:clamp(40px,5vw,60px)">${maisons}</div>
  </div></section>
  <section class="section gray"><div class="container">
    <div class="sec-head"><div class="h2">Nos conseils</div><p>Guides, décryptages et sélections pour choisir sans fausse note.</p></div>
    <div class="cards">${arts}</div>
    <div class="center-cta"><a class="chev" href="/blog/">Voir tous les articles</a></div>
  </div></section>`;
}

function champagnesMain(){
  const cards = products().map(productCard).join('');
  return `
  <section class="section-lead"><div class="container"><div class="lead-head"><div class="h2">La sélection</div><p>Onze cuvées passées au crible, des grandes maisons aux pépites confidentielles. Cliquez sur une bouteille pour sa fiche complète et son lien d'achat.</p></div></div></section>
  <section class="section" style="padding-top:0"><div class="container"><div class="pgrid">${cards}</div></div></section>`;
}

function blogMain(){
  const cards = articles().map(articleCard).join('');
  return `<section class="blogpage"><div class="container">
    <div class="sec-head" style="text-align:left;margin-left:0"><div class="h2">Le journal</div><p>Guides pratiques, décryptages et sélections pour profiter du champagne sans fausse note.</p></div>
    <div class="cards">${cards}</div>
  </div></section>`;
}

function productMain(p){
  const d = detail(p) || {};
  const axes = d.profil ? [['Fraîcheur',d.profil.fraicheur],['Rondeur',d.profil.rondeur],['Puissance',d.profil.puissance],['Longueur',d.profil.longueur]].map(([t,x])=>`<div class="axe"><div class="axe-t">${t}</div><p>${x}</p></div>`).join('') : '';
  const accords = d.accords ? d.accords.map(a=>`<div class="acc"><div class="acc-t">${a.t}</div><p>${a.d}</p></div>`).join('') : '';
  const tags = p.tags.map(t=>`<span class="tag">${t}</span>`).join('');
  const others = products().filter(x=>x.id!==p.id).slice(0,3).map(productCard).join('');
  return `<section class="product"><div class="container">
    <a class="a-back" href="/champagnes/">‹ La sélection</a>
    <div class="phero">
      <div class="phero-img">${d.score?`<span class="pscore big">${d.score}<small>/100</small></span>`:''}${bottleViz(p,'big')}</div>
      <div class="phero-b">
        <div class="rmaison">${p.house}</div>
        <h1 class="phero-name">${p.name}</h1>
        <div class="rsub">${p.region} · À servir avec ${p.pair}</div>
        <p class="phero-note">${d.dego || p.note}</p>
        <div class="rtags">${tags}</div>
        <div class="pbuy"><div class="rprice">${p.price} €</div><a class="btn btn-accent" href="${buyLink(p)}" target="_blank" rel="sponsored noopener">Voir sur Amazon</a></div>
        <div class="aff-note">Lien Amazon partenaire · En tant que Partenaire Amazon, ${BRAND} réalise un bénéfice sur les achats remplissant les conditions requises, sans surcoût pour vous.</div>
      </div>
    </div>
    ${d.profil?`<div class="pblock"><div class="pblock-eyebrow">Profil aromatique</div><h2 class="pblock-h">La structure de ce champagne</h2><div class="axes">${axes}</div></div>`:''}
    ${d.dego?`<div class="pblock alt"><div class="pblock-eyebrow">La dégustation</div><h2 class="pblock-h">Dans le verre</h2><p class="pblock-p">${d.dego}</p></div>`:''}
    ${d.dosage?`<div class="pblock"><div class="pblock-eyebrow">Assemblage & terroir</div><h2 class="pblock-h">La composition</h2><div class="compo"><div class="compo-i"><div class="compo-v">${d.dosage}</div><div class="compo-l">Dosage</div></div><div class="compo-i"><div class="compo-v">${d.cepages}</div><div class="compo-l">Cépages</div></div></div><p class="pblock-p" style="margin-top:18px">${d.terroir}</p></div>`:''}
    ${d.accords?`<div class="pblock alt"><div class="pblock-eyebrow">À table</div><h2 class="pblock-h">L'accord parfait</h2><div class="accs">${accords}</div></div>`:''}
    ${d.maison?`<div class="pblock"><div class="pblock-eyebrow">La maison</div><h2 class="pblock-h">${p.house}</h2><p class="pblock-p">${d.maison}</p></div>`:''}
    <div class="pblock"><h2 class="pblock-h" style="text-align:center">Vous aimerez aussi</h2><div class="pgrid" style="margin-top:26px">${others}</div></div>
  </div></section>`;
}

function articleMain(a){
  const rel = (a.related||[]).map(prod).filter(Boolean);
  const relBlock = rel.length ? `<div class="article-cta"><h3>La cuvée du moment</h3><p>${rel[0].house} — ${rel[0].name}, ${rel[0].price} €</p><a class="btn btn-accent" href="${buyLink(rel[0])}" target="_blank" rel="sponsored noopener">Voir sur Amazon</a></div>` : '';
  return `<section class="article"><div class="narrow">
    <a class="a-back" href="/blog/">‹ Retour au blog</a>
    <div class="a-cat">${a.cat}</div>
    <h1 class="a-title">${a.title}</h1>
    <div class="a-meta">${a.date} · ${a.read} de lecture</div>
    <div class="a-cover" style="background:${coverBg(a)}"></div>
    <div class="prose">${fixLinks(a.body)}</div>
    ${relBlock}
    <div style="margin-top:40px"><a class="btn btn-primary" href="/selecteur/">Trouver mon champagne</a></div>
  </div></section>`;
}

// Le sélecteur interactif : on réutilise index.html, mais on fait pointer les
// liens produit/article et la nav vers les pages statiques.
function selecteurHTML(){
  let h = HTML;
  h = h.replace("function openProduct(id){ state.product=id; state.view='product'; render(); }", "function openProduct(id){ location.href='/champagne/'+id+'/'; }");
  h = h.replace("function openArticle(id){ state.article=id; state.view='article'; render(); }", "function openArticle(id){ location.href='/blog/'+id+'/'; }");
  h = h.split(`onclick="go('shop')"`).join(`href="/champagnes/"`);
  h = h.split(`onclick="go('blog')"`).join(`href="/blog/"`);
  h = h.split(`onclick="go('home')"`).join(`href="/"`);
  // canonical
  h = h.replace('<link rel="canonical" href="https://quelchampagne.fr">', '<link rel="canonical" href="https://quelchampagne.fr/selecteur/">');
  return h;
}

// ---------- écriture ----------
try { rmSync('dist', { recursive:true, force:true }); } catch(e) { /* dossier absent ou verrouillé : sans importance */ }
function write(path, content){
  const full = 'dist/' + path;
  mkdirSync(full.split('/').slice(0,-1).join('/'), { recursive:true });
  writeFileSync(full, content, 'utf8');
}

const urls = [];
function add(loc, prio, freq){ urls.push({loc, prio, freq}); }

// home
write('index.html', page({ title:'QuelChampagne — Trouvez le champagne fait pour vous', desc:'Le sélecteur de champagne qui vous oriente vers la cuvée juste en six questions, plus des guides et des fiches détaillées pour bien choisir.', canonical:BASE+'/', active:'home', main:homeMain() }));
add(BASE+'/', '1.0', 'weekly');

// selecteur
write('selecteur/index.html', selecteurHTML());
add(BASE+'/selecteur/', '0.8', 'monthly');

// champagnes list
write('champagnes/index.html', page({ title:'La sélection — QuelChampagne', desc:'Notre sélection de champagnes et effervescents, avec fiche détaillée, profil aromatique et lien d\'achat pour chaque cuvée.', canonical:BASE+'/champagnes/', active:'shop', main:champagnesMain() }));
add(BASE+'/champagnes/', '0.9', 'weekly');

// product pages
for(const p of products()){
  const d = detail(p) || {};
  const desc = (d.dego || p.note).slice(0,155);
  write(`champagne/${p.id}/index.html`, page({ title:`${p.house} ${p.name} — Avis, dégustation et prix | QuelChampagne`, desc, canonical:`${BASE}/champagne/${p.id}/`, ogImage:ctx.photoSrc(ctx.PHOTOS[p.id]||OG,1200), active:'shop', main:productMain(p) }));
  add(`${BASE}/champagne/${p.id}/`, '0.8', 'monthly');
}

// blog list
write('blog/index.html', page({ title:'Le journal du champagne — QuelChampagne', desc:'Guides, décryptages et sélections pour bien choisir, accorder et servir le champagne.', canonical:BASE+'/blog/', active:'blog', main:blogMain() }));
add(BASE+'/blog/', '0.9', 'weekly');

// article pages
for(const a of articles().filter(a=>!a.soon)){
  write(`blog/${a.id}/index.html`, page({ title:`${a.title} | QuelChampagne`, desc:a.excerpt.slice(0,155), canonical:`${BASE}/blog/${a.id}/`, active:'blog', main:articleMain(a) }));
  add(`${BASE}/blog/${a.id}/`, '0.7', 'monthly');
}

// sitemap + robots
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u=>`  <url><loc>${u.loc}</loc><changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`).join('\n')}
</urlset>`;
write('sitemap.xml', sitemap);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);

console.log(`✅ Site statique généré dans dist/`);
console.log(`   ${products().length} fiches champagne · ${articles().filter(a=>!a.soon).length} articles · ${urls.length} URLs au sitemap`);
