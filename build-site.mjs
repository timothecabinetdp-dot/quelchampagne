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
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { buildCatalogue } from './build-catalogue.mjs';
import { buildPriceIndex } from './build-price-index.mjs';

const BASE = 'https://quelchampagne.fr';
const HERO = '/assets/hero-quelchampagne.svg';
const OG   = BASE + '/assets/og-quelchampagne.png';
// Photos libres de droit (licence Unsplash, hotlink autorisé). Voir data/image-rights-register.json.
const HERO_PHOTO      = 'https://images.unsplash.com/photo-1623428454697-08da4a100602?q=80&w=2000&auto=format&fit=crop';
const SELECTION_PHOTO = 'https://images.unsplash.com/photo-1609516142756-7ecef85e76a7?q=80&w=2000&auto=format&fit=crop';
const QUIZ_PHOTO      = 'https://images.unsplash.com/photo-1647905555465-0f9004fbdaed?q=80&w=2000&auto=format&fit=crop';
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M8.4 5H15.6L14.2 12.3A2.7 2.7 0 0 1 9.8 12.3Z' fill='%23F3E7C9' stroke='%239C7A34' stroke-width='1.2'/%3E%3Cline x1='12' y1='15' x2='12' y2='20.2' stroke='%239C7A34' stroke-width='1.3'/%3E%3Cline x1='9' y1='20.6' x2='15' y2='20.6' stroke='%239C7A34' stroke-width='1.3'/%3E%3C/svg%3E";

// ---------- lire index.html : CSS + données ----------
const HTML = readFileSync('index.html', 'utf8');
const CSS = HTML.split('<style>')[1].split('</style>')[0];
const SCRIPT = HTML.split('<script>')[1].split('</script>')[0];

const ctx = {};
global.document = { getElementById:()=>({set innerHTML(v){}, get innerHTML(){return '';}}), querySelector:()=>null, createElement:()=>({set innerHTML(v){}, appendChild(){}, remove(){}, setAttribute(){}, addEventListener(){}, focus(){}, querySelector(){return {set innerHTML(v){}};}, querySelectorAll(){return [];}, style:{}}), body:{appendChild(){},style:{}}, documentElement:{lang:'', style:{setProperty(){}}} };
global.window = { scrollTo(){}, open(){} };
global.localStorage = { getItem(){return null;}, setItem(){} };
global.fetch = () => Promise.reject('x');
eval(SCRIPT + '; Object.assign(ctx,{products,setCatalogue,articles,prod,art,detail,coverBg,PHOTOS,photoSrc,buyLink,priceText,productAction,bottleViz,logoMark,BRAND,AMAZON_TAG});');

const catalogue = buildCatalogue();
const priceIndex = buildPriceIndex();
ctx.setCatalogue(catalogue);
const { products, articles, prod, detail, coverBg, buyLink, priceText, productAction, bottleViz, logoMark, BRAND } = ctx;
const MAISONS = ['Dom Pérignon','Ruinart','Bollinger','Veuve Clicquot','Moët & Chandon','Laurent-Perrier','Perrier-Jouët','Nicolas Feuillatte'];
const COMPARISONS = [
  {
    id:'bollinger-vs-ruinart',
    a:'bollinger',
    b:'ruinart',
    title:'Bollinger ou Ruinart : lequel choisir ?',
    question:'Un champagne de repas structuré ou un blanc de blancs plus frais ?',
    verdict:'Choisissez Bollinger Special Cuvée pour la table, la puissance et les accords avec la volaille ou le fromage. Préférez Ruinart Blanc de Blancs pour la fraîcheur, les fruits de mer et un cadeau plus aérien.'
  },
  {
    id:'moet-vs-veuve-clicquot',
    a:'moet',
    b:'clicquot',
    title:'Moët ou Veuve Clicquot : lequel choisir ?',
    question:'Deux grandes maisons très connues, mais deux usages différents.',
    verdict:'Moët Impérial est le choix le plus simple pour une célébration ou un apéritif fruité. Veuve Clicquot Carte Jaune est plus cohérent lorsque la bouteille doit accompagner le repas et offrir davantage de structure.'
  },
  {
    id:'dom-perignon-2015-vs-krug-174',
    a:'dom-perignon-vintage-2015',
    b:'krug-grande-cuvee-174',
    title:'Dom Pérignon 2015 ou Krug 174e Édition ?',
    question:'Deux champagnes de prestige désormais comparés par sortie exacte.',
    verdict:'Dom Pérignon 2015 convient à celui qui recherche un millésime identifié et une grande étiquette immédiatement reconnue. Krug Grande Cuvée 174e Édition s’adresse davantage à l’amateur attiré par la complexité d’un assemblage multiannées.'
  },
  {
    id:'taittinger-vs-pol-roger',
    a:'taittinger-brut-reserve',
    b:'pol-roger-brut-reserve',
    title:'Taittinger Brut Réserve ou Pol Roger Brut Réserve ?',
    question:'Deux bruts classiques et polyvalents, avec une différence de registre et de budget.',
    verdict:'Taittinger Brut Réserve est le choix le plus direct pour un apéritif frais, consensuel et contenu en budget. Pol Roger Brut Réserve prend l’avantage pour un cadeau ou un repas lorsque l’on recherche davantage de complexité et un style plus classique.'
  },
  {
    id:'charles-heidsieck-vs-bollinger',
    a:'charles-heidsieck-brut-reserve',
    b:'bollinger',
    title:'Charles Heidsieck Brut Réserve ou Bollinger Special Cuvée ?',
    question:'Deux bruts de repas puissants, l’un porté par les vins de réserve, l’autre par un style résolument vineux.',
    verdict:'Charles Heidsieck Brut Réserve convient à qui privilégie la rondeur, la profondeur et une construction riche en vins de réserve. Bollinger Special Cuvée reste le choix le plus lisible pour un style vineux et des accords de table affirmés.'
  },
  {
    id:'laurent-perrier-rose-vs-billecart-salmon-rose',
    a:'laurentperrier',
    b:'billecart-salmon-brut-rose',
    title:'Laurent-Perrier Cuvée Rosé ou Billecart-Salmon Brut Rosé ?',
    question:'Un rosé expressif de macération ou un rosé plus délicat et raffiné ?',
    verdict:'Laurent-Perrier Cuvée Rosé convient à une célébration fruitée et expressive, notamment autour des fruits rouges. Billecart-Salmon Brut Rosé est plus cohérent pour un cadeau raffiné, les crustacés ou une recherche de finesse.'
  },
  {
    id:'deutz-vs-pol-roger',
    a:'deutz-brut-classic',
    b:'pol-roger-brut-reserve',
    title:'Deutz Brut Classic ou Pol Roger Brut Réserve ?',
    question:'Deux bruts classiques pour l’apéritif ou le cadeau, avec une différence de texture et de structure.',
    verdict:'Deutz Brut Classic est le choix le plus cohérent pour une recherche de finesse, de fraîcheur et de texture soyeuse. Pol Roger Brut Réserve conviendra davantage à un cadeau ou à un repas lorsque l’on souhaite un style plus structuré et complexe.'
  },
  {
    id:'ruinart-rose-vs-bollinger-rose',
    a:'ruinart-rose',
    b:'bollinger-rose',
    title:'Ruinart Rosé ou Bollinger Rosé ?',
    question:'Un rosé équilibré porté par le chardonnay ou une expression plus vineuse et gastronomique ?',
    verdict:'Ruinart Rosé privilégie l’équilibre entre fraîcheur, rondeur et structure, avec une vraie polyvalence sur les produits de la mer. Bollinger Rosé s’adresse plutôt à celui qui recherche davantage de puissance et un rosé construit pour le repas.'
  },
  {
    id:'moet-rose-vs-veuve-clicquot-rose',
    a:'moet-rose-imperial',
    b:'veuve-clicquot-brut-rose',
    title:'Moët Rosé Impérial ou Veuve Clicquot Rosé ?',
    question:'Deux rosés festifs de grandes maisons, l’un plus immédiat, l’autre plus structuré.',
    verdict:'Moët Rosé Impérial est le choix le plus simple pour une célébration fruitée ou un apéritif. Veuve Clicquot Rosé convient mieux lorsque la bouteille doit passer à table et offrir davantage de structure.'
  },
  {
    id:'palmer-la-reserve-vs-laurent-perrier-la-cuvee',
    a:'palmer-co-la-reserve',
    b:'laurent-perrier-la-cuvee',
    title:'Palmer La Réserve ou Laurent-Perrier La Cuvée ?',
    question:'Deux bruts dominés par le chardonnay, entre ampleur équilibrée et fraîcheur plus délicate.',
    verdict:'Palmer & Co La Réserve convient à celui qui souhaite davantage de rondeur et de maturité grâce à une proportion importante de vins de réserve. Laurent-Perrier La Cuvée reste le choix le plus lisible pour la fraîcheur, la finesse et les accords marins.'
  },
  {
    id:'leclerc-briant-vs-laherte-freres',
    a:'leclerc-briant-brut-reserve-base-2020',
    b:'laherte-freres-ultradition-brut',
    title:'Leclerc Briant Brut Réserve ou Laherte Frères Ultradition ?',
    question:'Une maison biologique en extra-brut ou un champagne de vigneron plus rond et expressif ?',
    verdict:'Leclerc Briant Brut Réserve — base 2020 s’adresse à celui qui recherche un dosage bas, de la fraîcheur et une maison certifiée biologique. Laherte Frères Ultradition offre une découverte de vigneron plus ronde, expressive et accessible à l’apéritif.'
  },
  {
    id:'jacquesson-748-vs-roederer-collection-246',
    a:'jacquesson-cuvee-748',
    b:'louis-roederer-collection-246',
    title:'Jacquesson Cuvée n° 748 ou Roederer Collection 246 ?',
    question:'Deux cuvées numérotées multi-vintages, avec une interprétation très différente de la complexité.',
    verdict:'Jacquesson Cuvée n° 748 privilégie la tension, le faible dosage et une construction très lisible autour de la vendange 2020. Roederer Collection 246 est plus ample et consensuelle, tout en conservant une vraie ambition gastronomique.'
  }
];
const SEO_LANDINGS = [
  {
    id:'aperitif',
    title:'Quel champagne pour l’apéritif ?',
    desc:'Découvrez les champagnes vérifiés les plus adaptés à l’apéritif selon leur fraîcheur, leur style et votre budget.',
    intro:'Pour l’apéritif, la priorité va généralement à la fraîcheur, à la lisibilité du fruit et à une structure qui ne fatigue pas le palais. Cette sélection réunit uniquement les cuvées de notre catalogue explicitement recommandées pour ce moment.',
    advice:'Servez le champagne frais, mais pas glacé, dans un verre suffisamment large pour laisser les arômes s’exprimer. Les cuvées les plus vives accompagnent naturellement les gougères, les coquillages et les bouchées peu épicées.',
    filter:p=>p.occ.includes('occ_apero')
  },
  {
    id:'cadeau',
    title:'Quel champagne offrir en cadeau ?',
    desc:'Choisissez un champagne à offrir selon le budget, le prestige recherché et le profil du destinataire.',
    intro:'Un bon champagne à offrir doit être cohérent avec la personne et l’occasion : grande maison immédiatement reconnue, cuvée de vigneron pour un amateur curieux ou sortie précise pour un cadeau majeur. Nos fiches permettent de comparer ces options sans confondre notoriété et adéquation.',
    advice:'Pour un destinataire dont vous connaissez peu les goûts, privilégiez un brut équilibré et polyvalent. Pour un amateur averti, une cuvée numérotée, un millésime exact ou un champagne de vigneron apporte davantage de singularité.',
    filter:p=>p.occ.includes('occ_cadeau')
  },
  {
    id:'repas',
    title:'Quel champagne choisir pour un repas ?',
    desc:'Trouvez un champagne de repas selon la puissance, la fraîcheur et les accords proposés sur chaque fiche vérifiée.',
    intro:'À table, le champagne ne doit pas seulement ouvrir le repas : il doit tenir face au plat. Les cuvées plus vineuses ou complexes conviennent aux volailles, poissons en sauce et fromages, tandis que les profils tendus restent particulièrement adaptés aux produits marins.',
    advice:'L’accord dépend davantage de la structure du vin et de la préparation du plat que du prestige de l’étiquette. Utilisez le comparateur pour mettre en regard puissance, profil et accords avant de choisir.',
    filter:p=>p.occ.includes('occ_diner')
  },
  {
    id:'rose',
    title:'Quel champagne rosé choisir ?',
    desc:'Comparez les champagnes rosés vérifiés : styles délicats, fruités ou gastronomiques, budgets et accords.',
    intro:'Tous les champagnes rosés ne remplissent pas le même rôle. Certains privilégient la finesse et les crustacés, d’autres l’expression des fruits rouges ou une structure suffisante pour accompagner un repas. La méthode d’élaboration et l’assemblage restent indiqués seulement lorsqu’ils sont officiellement documentés.',
    advice:'Ne choisissez pas un rosé uniquement pour sa couleur. Un profil délicat convient au cadeau et à l’apéritif, tandis qu’une cuvée plus vineuse peut accompagner le saumon, le canard ou une cuisine plus structurée.',
    filter:p=>p.tags.some(tag=>tag.toLowerCase().includes('rosé'))
  },
  {
    id:'blanc-de-blancs',
    title:'Quel champagne blanc de blancs choisir ?',
    desc:'Découvrez les champagnes blancs de blancs vérifiés, du profil frais et minéral aux cuvées millésimées de prestige.',
    intro:'Un blanc de blancs est élaboré à partir de raisins blancs, le plus souvent exclusivement de chardonnay en Champagne. Le style peut toutefois aller d’un brut frais et accessible à une cuvée millésimée profonde : le nom de la catégorie ne suffit donc pas à prédire l’usage.',
    advice:'Les profils les plus vifs sont particulièrement cohérents avec les huîtres, crustacés et poissons fins. Les sorties millésimées plus complexes demandent davantage de temps dans le verre et peuvent accompagner tout un repas.',
    filter:p=>p.name.toLowerCase().includes('blanc de blancs') || p.tags.some(tag=>tag.toLowerCase().includes('blanc de blancs'))
  },
  {
    id:'moins-de-50-euros',
    title:'Quel champagne choisir à moins de 50 euros ?',
    desc:'Découvrez les champagnes du catalogue dont la fourchette éditoriale reste sous 50 euros, selon le style et l’occasion.',
    intro:'Un budget inférieur à 50 euros permet déjà de comparer des bruts de grandes maisons et des cuvées plus confidentielles. La sélection ci-dessous repose sur la borne haute de nos fourchettes éditoriales, jamais sur une promotion momentanée.',
    advice:'Comparez d’abord le style et l’usage, puis contrôlez le prix du jour chez le marchand. Une fourchette sert à orienter le choix ; elle ne garantit ni un tarif, ni un stock, ni des frais de livraison.',
    filter:p=>p.priceMax<=50
  },
  {
    id:'fruits-de-mer',
    title:'Quel champagne choisir avec des fruits de mer ?',
    desc:'Trouvez un champagne pour les huîtres, crustacés et fruits de mer parmi les cuvées aux accords officiellement vérifiés.',
    intro:'Avec les fruits de mer, la fraîcheur, la précision et une finale nette comptent davantage que la notoriété de l’étiquette. Cette page retient les cuvées dont les accords vérifiés incluent explicitement les produits de la mer.',
    advice:'Pour les huîtres et coquillages, privilégiez les profils les plus droits et minéraux. Avec des crustacés, une texture plus ronde peut fonctionner, surtout lorsque la préparation comporte du beurre, une sauce ou une cuisson marquée.',
    filter:p=>p.accords.includes('accord_mer')
  }
];

// ---------- gabarits partagés ----------
function header(active){
  const L=(href,label,key)=>`<a class="nlink${active===key?' on':''}" href="${href}"${active===key?' aria-current="page"':''}>${label}</a>`;
  return `<header class="nav"><div class="container nav-in">
    <a class="logo" href="/">${logoMark()}<span class="logo-txt">Quel<b>Champagne</b></span></a>
    <nav class="nav-links" aria-label="Navigation principale">${L('/champagnes/','La sélection','shop')}${L('/comparateur/','Comparer','compare')}${L('/blog/','Blog','blog')}<a class="nlink-cta" href="/selecteur/">Quel champagne me correspond&nbsp;?</a></nav>
  </div></header>`;
}
function footer(){
  return `<footer><div class="container">
    <div class="foot-in">
      <div class="foot-brand"><span class="foot-brand-name">${logoMark()}${BRAND}</span><p>Le sélecteur indépendant qui vous oriente vers la cuvée juste, en quatre questions.</p></div>
      <nav class="foot-links" aria-label="Navigation secondaire"><a href="/selecteur/">Le sélecteur</a><a href="/comparateur/">Comparer</a><a href="/notre-methode/">Notre méthode</a><a href="/a-propos/">À propos</a><a href="/mentions-legales/">Mentions légales</a><a href="/confidentialite/">Confidentialité</a></nav>
    </div>
    <div class="foot-health">L'abus d'alcool est dangereux pour la santé. À consommer avec modération.</div>
    <div class="foot-disc">Site réservé aux personnes majeures. ${BRAND} présente une sélection éditoriale indépendante à visée informative. Les liens partenaires ne sont affichés qu'après contrôle du produit, du prix et de la disponibilité. Les fourchettes non marchandes restent indicatives.</div>
  </div></footer>`;
}
const AGEGATE = `<script>
(function(){
  try{ if(localStorage.getItem('qc_age_ok')==='1') return; }catch(e){}
  var w=document.createElement('div'); w.className='agegate'; w.id='agegate'; w.setAttribute('role','dialog'); w.setAttribute('aria-modal','true'); w.setAttribute('aria-labelledby','agegate-title');
  var b=document.createElement('div'); b.className='agegate-box';
  b.innerHTML='<div class="g"></div><h2 id="agegate-title">Vous avez 18 ans ou plus ?</h2><p>QuelChampagne est un site sur le champagne, r&eacute;serv&eacute; aux personnes majeures.</p>';
  var r=document.createElement('div'); r.className='btns';
  var y=document.createElement('button'); y.type='button'; y.className='btn btn-primary'; y.textContent='Oui, je suis majeur'; y.onclick=function(){try{localStorage.setItem('qc_age_ok','1');}catch(e){} w.remove(); document.body.style.overflow='';};
  var n=document.createElement('button'); n.type='button'; n.className='btn btn-ghost'; n.textContent='Non'; n.onclick=function(){b.innerHTML='<div class="g"></div><h2>&Agrave; bient&ocirc;t</h2><p>Ce site est r&eacute;serv&eacute; aux personnes majeures.</p>';};
  r.appendChild(y); r.appendChild(n); b.appendChild(r);
  var h=document.createElement('div'); h.className='health'; h.textContent="L'abus d'alcool est dangereux pour la sant\\u00e9. \\u00c0 consommer avec mod\\u00e9ration."; b.appendChild(h);
  w.appendChild(b); document.body.appendChild(w); document.body.style.overflow='hidden'; y.focus();
  var controls=[y,n]; w.addEventListener('keydown',function(event){if(event.key!=='Tab')return;if(event.shiftKey&&document.activeElement===y){event.preventDefault();n.focus();}else if(!event.shiftKey&&document.activeElement===n){event.preventDefault();y.focus();}});
})();
</script>`;

const MOTION = `<script>
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var bb=document.getElementById('bubbles');
  if(bb && !reduce){
    for(var i=0;i<28;i++){var b=document.createElement('i');var s=(4+Math.random()*13);b.style.left=(Math.random()*100)+'%';b.style.width=s+'px';b.style.height=s+'px';b.style.animationDuration=(6+Math.random()*7).toFixed(2)+'s';b.style.animationDelay=(Math.random()*9).toFixed(2)+'s';bb.appendChild(b);}
  }
  var els=[].slice.call(document.querySelectorAll('.sec-head, .steps .step, .pgrid > *, .cards > *, .band .container, .trust-item, .duel-col, .article .prose > p'));
  if(reduce || !('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});return;}
  els.forEach(function(e,i){e.classList.add('reveal'); e.style.transitionDelay=((i%3)*0.07).toFixed(2)+'s';});
  var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}});},{threshold:0.1, rootMargin:'0px 0px -6% 0px'});
  els.forEach(function(e){io.observe(e);});
})();
</script>`;

function page({title, desc, canonical, ogImage, active, main}){
  const schema = JSON.stringify({
    '@context':'https://schema.org',
    '@type':'WebPage',
    name:title,
    url:canonical,
    description:desc,
    inLanguage:'fr-FR',
    isPartOf:{'@type':'WebSite',name:'QuelChampagne',url:BASE+'/'}
  }).replaceAll('<','\\u003c');
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
<meta property="og:locale" content="fr_FR">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index,follow,max-image-preview:large">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="${FAVICON}">
<script type="application/ld+json">${schema}</script>
<style>${CSS}</style>
</head>
<body>
<a class="skip-link" href="#main-content">Aller au contenu</a>
${header(active)}
<main id="main-content">${main}</main>
${footer()}
${MOTION}
${AGEGATE}
</body>
</html>`;
}

// ---------- cartes ----------
function productCard(p, attributes = ''){
  return `<a class="pcard" href="/champagne/${p.id}/"${attributes ? ` ${attributes}` : ''}>
    <div class="pcard-img">${bottleViz(p,'card')}</div>
    <div class="pcard-b"><div class="pcard-house">${p.house}</div><div class="pcard-name">${p.short}</div><div class="pcard-note">${p.note}</div><div class="pcard-foot"><span class="pcard-price">${priceText(p)}</span><span class="chev">Découvrir</span></div></div>
  </a>`;
}
function articleCard(a){
  return `<a class="acard" href="/blog/${a.id}/"><div class="acard-cover" style="background:${coverBg(a)}"><span class="acard-cat">${a.cat}</span></div><div class="acard-b"><h3>${a.title}</h3><p>${a.excerpt}</p><div class="acard-meta">${a.date} · ${a.read} de lecture</div></div></a>`;
}
function fixLinks(body){
  return body.replace(/href="#" onclick="return openAff\('([^']+)'\)"/g, (m,id)=>{
    const p=prod(id); if(!p) return 'href="/champagnes/"';
    const link=buyLink(p)||p.sourceUrl||'/champagnes/';
    return `href="${link}" target="_blank" rel="${p.commerceReady?'sponsored noopener':'noopener'}"`;
  });
}

// ---------- pages ----------
function homeMain(){
  const sel = products().slice(0,3).map(productCard).join('');
  const arts = articles().filter(a=>!a.soon).slice(0,3).map(articleCard).join('');
  const maisons = MAISONS.map(m=>`<span class="maison-name">${m}</span>`).join('');
  return `
  <section class="hero-photo" style="--hero-img:url('${HERO_PHOTO}')">
    <div class="bubbles" id="bubbles" aria-hidden="true"></div>
    <div class="container">
      <h1>Le champagne<br>fait pour vous.</h1>
      <p class="lead">Quatre questions suffisent. Nous trouvons la cuvée juste.</p>
      <div class="hero-cta"><a class="btn btn-primary btn-lg" href="/selecteur/">Quel champagne me correspond&nbsp;?</a><a class="chev" href="/notre-methode/">Comprendre notre méthode</a></div>
    </div>
  </section>
  <section class="section"><div class="container">
    <div class="trust-strip">
      <div class="trust-item"><strong>${products().length} fiches vérifiées</strong><span>Chaque fait produit renvoie vers une source officielle.</span></div>
      <div class="trust-item"><strong>Classement indépendant</strong><span>Aucune maison ne paie pour remonter dans le sélecteur.</span></div>
      <div class="trust-item"><strong>Prix séparés des fiches</strong><span>Une offre n’apparaît qu’après contrôle du format et du stock.</span></div>
    </div>
  </div></section>
  <section class="section gray"><div class="container">
    <div class="sec-head"><div class="h2">Comment ça marche</div><p>Trois étapes, une petite minute.</p></div>
    <div class="steps">
      <div class="step"><div class="n">01</div><h3>Répondez</h3><p>Quatre questions sur l'occasion, le style, le budget et le type de producteur.</p></div>
      <div class="step"><div class="n">02</div><h3>Recevez</h3><p>Notre moteur classe la sélection et fait remonter votre coup de cœur, plus trois alternatives.</p></div>
      <div class="step"><div class="n">03</div><h3>Comprenez</h3><p>Le résultat explique les critères retenus et ouvre une fiche reliée à sa source officielle.</p></div>
    </div>
  </div></section>
  <section class="band"><div class="container">
    <div class="eyebrow-l">Quatre questions, soixante secondes</div>
    <h2>Le bon champagne ne se devine pas. Il se trouve.</h2>
    <p>Occasion, goût, budget : notre sélecteur fait le tri pour vous, parmi les grandes maisons et les pépites confidentielles.</p>
    <a class="btn btn-accent" href="/selecteur/">Lancer le sélecteur</a>
  </div></section>
  <section class="section"><div class="container">
    <div class="sec-head"><div class="h2">La sélection</div><p>${products().length} cuvées vérifiées, chacune reliée à sa source officielle.</p></div>
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
  const cards = products().map(p=>{
    const search = `${p.house} ${p.name} ${p.tags.join(' ')} ${p.pair}`.toLowerCase().replaceAll('"','&quot;');
    const rose = `${p.name} ${p.tags.join(' ')}`.toLowerCase().includes('rosé');
    const blancDeBlancs = `${p.name} ${p.tags.join(' ')}`.toLowerCase().includes('blanc de blancs');
    const lowDosage = p.tags.some(tag=>/extra-brut|brut nature|zéro dosage|sans dosage|faible dosage/i.test(tag));
    const attrs = [
      'data-catalogue-card',
      `data-search="${search}"`,
      `data-price-min="${p.priceMin ?? p.price}"`,
      `data-price-max="${p.priceMax ?? p.price}"`,
      `data-producer="${p.producerType}"`,
      `data-profiles="${p.profil.join(' ')}"`,
      `data-rose="${rose}"`,
      `data-bdb="${blancDeBlancs}"`,
      `data-low-dosage="${lowDosage}"`
    ].join(' ');
    return productCard(p, attrs);
  }).join('');
  const guides = SEO_LANDINGS.map(landing=>`<a class="tag" href="/champagne/${landing.id}/">${landing.title}</a>`).join('');
  return `
  <section class="page-hero" style="--ph-img:url('${SELECTION_PHOTO}')"><div class="container"><div class="lead-head"><h1 class="h2">La sélection</h1><p>${products().length} champagnes éditorialement prêts, des grandes maisons aux vignerons. Les offres marchandes restent masquées jusqu'à leur contrôle.</p><div class="rtags" style="margin-top:22px">${guides}</div></div></div></section>
  <section class="section" style="padding-top:0"><div class="container">
    <form class="catalogue-tools" id="catalogue-tools" role="search">
      <label class="sr-only" for="catalogue-search">Rechercher une maison, une cuvée ou un accord</label>
      <input class="catalogue-search" id="catalogue-search" type="search" placeholder="Maison, cuvée, accord…">
      <div class="catalogue-filters">
        <label class="catalogue-filter">Budget
          <select id="catalogue-budget"><option value="">Tous</option><option value="under40">Moins de 40 €</option><option value="40-60">40 à 60 €</option><option value="60-90">60 à 90 €</option><option value="90plus">90 € et plus</option></select>
        </label>
        <label class="catalogue-filter">Style
          <select id="catalogue-style"><option value="">Tous</option><option value="profil_frais_vif">Frais et vif</option><option value="profil_fruite">Fruité</option><option value="profil_riche_ample">Riche et ample</option><option value="profil_delicat">Délicat</option></select>
        </label>
        <label class="catalogue-filter">Producteur
          <select id="catalogue-producer"><option value="">Tous</option><option value="maison">Maison</option><option value="vigneron">Vigneron</option></select>
        </label>
        <label class="catalogue-filter">Type
          <select id="catalogue-type"><option value="">Tous</option><option value="rose">Rosé</option><option value="bdb">Blanc de blancs</option><option value="low">Extra-brut / nature</option></select>
        </label>
      </div>
      <div class="catalogue-summary"><span id="catalogue-count" aria-live="polite">${products().length} champagnes affichés</span><button class="btn btn-ghost btn-sm" id="catalogue-reset" type="reset">Réinitialiser</button></div>
    </form>
    <div class="pgrid" id="catalogue-grid">${cards}</div>
    <p class="catalogue-empty" id="catalogue-empty" hidden>Aucune cuvée ne correspond à ces critères. Essayez d’élargir le budget ou le style.</p>
  </div></section>
  <script>
  (() => {
    const form=document.getElementById('catalogue-tools');
    const cards=[...document.querySelectorAll('[data-catalogue-card]')];
    const search=document.getElementById('catalogue-search');
    const budget=document.getElementById('catalogue-budget');
    const style=document.getElementById('catalogue-style');
    const producer=document.getElementById('catalogue-producer');
    const type=document.getElementById('catalogue-type');
    const count=document.getElementById('catalogue-count');
    const empty=document.getElementById('catalogue-empty');
    function budgetMatch(card,value){
      const min=Number(card.dataset.priceMin), max=Number(card.dataset.priceMax);
      if(!value) return true;
      if(value==='under40') return max<40;
      if(value==='40-60') return min<=60 && max>=40;
      if(value==='60-90') return min<=90 && max>=60;
      return max>=90;
    }
    function typeMatch(card,value){
      if(!value) return true;
      if(value==='rose') return card.dataset.rose==='true';
      if(value==='bdb') return card.dataset.bdb==='true';
      return card.dataset.lowDosage==='true';
    }
    function apply(){
      const query=search.value.trim().toLocaleLowerCase('fr');
      let visible=0;
      cards.forEach(card=>{
        const show=(!query || card.dataset.search.includes(query))
          && budgetMatch(card,budget.value)
          && (!style.value || card.dataset.profiles.split(' ').includes(style.value))
          && (!producer.value || card.dataset.producer===producer.value)
          && typeMatch(card,type.value);
        card.hidden=!show;
        if(show) visible+=1;
      });
      count.textContent=visible+' champagne'+(visible>1?'s':'')+' affiché'+(visible>1?'s':'');
      empty.hidden=visible!==0;
    }
    form.addEventListener('input',apply);
    form.addEventListener('reset',()=>setTimeout(apply,0));
    apply();
  })();
  </script>`;
}

function landingMain(landing){
  const selected = products().filter(landing.filter);
  const cards = selected.map(productCard).join('');
  return `<section class="section-lead"><div class="container"><div class="lead-head">
    <div class="eyebrow">Guide de sélection</div>
    <h1 class="a-title" style="margin-top:12px">${landing.title}</h1>
    <p>${landing.intro}</p>
    <div style="margin-top:24px"><a class="btn btn-primary" href="/selecteur/">Obtenir une recommandation personnalisée</a></div>
  </div></div></section>
  <section class="section" style="padding-top:0"><div class="container">
    <div class="sec-head"><div class="h2">${selected.length} cuvées correspondantes</div><p>Chaque fiche est reliée à une source officielle. Les budgets restent indicatifs tant que les offres françaises ne sont pas contrôlées.</p></div>
    <div class="pgrid">${cards}</div>
  </div></section>
  <section class="section gray"><div class="container"><div class="narrow">
    <div class="pblock-eyebrow">Conseil QuelChampagne</div><h2 class="pblock-h">Comment affiner votre choix</h2><p class="pblock-p">${landing.advice}</p>
    <div style="margin-top:28px"><a class="chev" href="/comparateur/">Comparer jusqu’à quatre champagnes</a></div>
  </div></div></section>`;
}

function comparateurMain(){
  const data = products().map(p=>({
    id:p.id, house:p.house, name:p.name, price:priceText(p),
    type:p.tags[0]||'Champagne', style:p.tags.slice(1).join(', ')||p.profil.join(', '),
    occasions:p.occ.map(x=>x.replace('occ_','')).join(', '),
    accords:p.pair, producerType:p.producerType==='vigneron'?'Vigneron':'Maison',
    url:`/champagne/${p.id}/`
  }));
  const encoded = JSON.stringify(data).replaceAll('<','\\u003c');
  const choices = data.map(p=>`<button class="compare-choice" type="button" data-compare="${p.id}" data-search="${`${p.house} ${p.name} ${p.type} ${p.style}`.toLowerCase()}" aria-pressed="false"><strong>${p.house}</strong><span>${p.name} · ${p.price}</span></button>`).join('');
  return `<section class="section"><div class="container">
    <div class="lead-head"><h1 class="h2">Comparer jusqu'à 4 champagnes</h1><p>Choisissez vos bouteilles : le tableau met en regard budget, style, usages et accords. Les prix restent indicatifs tant que les offres marchandes ne sont pas contrôlées.</p></div>
    <div class="compare-tools"><label class="sr-only" for="compare-search">Rechercher une cuvée</label><input class="compare-search" id="compare-search" type="search" placeholder="Rechercher une maison ou une cuvée"><button class="btn btn-ghost btn-sm" id="compare-clear" type="button">Effacer la sélection</button></div>
    <div class="compare-status" id="compare-status" aria-live="polite">Sélectionnez 2 à 4 champagnes.</div>
    <div class="compare-grid">${choices}</div>
    <div class="compare-wrap" id="compare-result"></div>
  </div></section>
  <script>
  (() => {
    const products=${encoded};
    const selected=[];
    const status=document.getElementById('compare-status');
    const result=document.getElementById('compare-result');
    const search=document.getElementById('compare-search');
    const clear=document.getElementById('compare-clear');
    const labels={price:'Budget indicatif',type:'Type',style:'Style et usages',producerType:'Producteur',occasions:'Occasions',accords:'Accords'};
    function render(){
      status.textContent=selected.length<2 ? 'Sélectionnez encore '+(2-selected.length)+' champagne'+(2-selected.length>1?'s':'')+'.' : selected.length+'/4 champagnes sélectionnés.';
      if(selected.length<2){ result.innerHTML=''; return; }
      const picked=selected.map(id=>products.find(p=>p.id===id));
      const head='<tr><th>Critère</th>'+picked.map(p=>'<th><a href="'+p.url+'">'+p.house+'<br>'+p.name+'</a></th>').join('')+'</tr>';
      const rows=Object.keys(labels).map(key=>'<tr><td>'+labels[key]+'</td>'+picked.map(p=>'<td>'+p[key]+'</td>').join('')+'</tr>').join('');
      result.innerHTML='<table class="compare-table"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table>';
    }
    document.querySelectorAll('[data-compare]').forEach(button=>{
      button.addEventListener('click',()=>{
        const id=button.dataset.compare, index=selected.indexOf(id);
        if(index>=0){ selected.splice(index,1); button.classList.remove('on'); button.setAttribute('aria-pressed','false'); }
        else if(selected.length<4){ selected.push(id); button.classList.add('on'); button.setAttribute('aria-pressed','true'); }
        else { status.textContent='Vous pouvez comparer 4 champagnes maximum.'; return; }
        render();
      });
    });
    search.addEventListener('input',()=>{
      const query=search.value.trim().toLowerCase();
      document.querySelectorAll('[data-compare]').forEach(button=>{ button.hidden=Boolean(query && !button.dataset.search.includes(query)); });
    });
    clear.addEventListener('click',()=>{
      selected.splice(0);
      document.querySelectorAll('[data-compare]').forEach(button=>{button.classList.remove('on');button.setAttribute('aria-pressed','false');});
      render();
    });
    render();
  })();
  </script>`;
}

function comparisonsMain(){
  const cards=COMPARISONS.map(c=>{
    const a=prod(c.a), b=prod(c.b);
    return `<a class="acard" href="/comparatifs/${c.id}/"><div class="acard-b"><div class="a-cat">Comparatif</div><h3>${c.title}</h3><p>${c.question}</p><div class="acard-meta">${a.house} ${a.name} · ${b.house} ${b.name}</div></div></a>`;
  }).join('');
  return `<section class="section"><div class="container"><div class="lead-head"><h1 class="h2">Les comparatifs QuelChampagne</h1><p>Des réponses directes à de vraies hésitations d'achat, fondées sur les fiches vérifiées.</p></div><div class="cards" style="margin-top:36px">${cards}</div></div></section>`;
}

function comparisonMain(c){
  const a=prod(c.a), b=prod(c.b), da=detail(a)||{}, db=detail(b)||{};
  const column=(p,d)=>`<div class="duel-col"><div class="rmaison">${p.house}</div><h2>${p.name}</h2><p class="phero-note">${d.advice||p.note}</p><div class="rtags">${p.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div><p style="margin-top:20px"><strong>${priceText(p)}</strong> · ${p.producerType==='vigneron'?'Vigneron':'Maison'}</p><a class="chev" href="/champagne/${p.id}/" style="margin-top:16px">Voir la fiche vérifiée</a></div>`;
  return `<section class="article"><div class="container"><a class="a-back" href="/comparatifs/">‹ Tous les comparatifs</a><div class="a-cat">Comparatif</div><h1 class="a-title">${c.title}</h1><p class="qhint">${c.question}</p><div class="duel">${column(a,da)}${column(b,db)}</div><div class="duel-verdict"><strong>Le verdict</strong><p style="margin-top:8px">${c.verdict}</p></div><div style="margin-top:34px"><a class="btn btn-primary" href="/comparateur/">Comparer d'autres champagnes</a></div></div></section>`;
}

function decisionGuide(p){
  let avoid="vous recherchez un style très différent de son profil principal.";
  if(p.profil.includes('profil_riche_ample')) avoid="vous cherchez avant tout une expression très légère et délicate.";
  else if(p.profil.includes('profil_delicat')) avoid="vous préférez un champagne puissant et résolument vineux.";
  else if(p.profil.includes('profil_frais_vif')) avoid="vous recherchez surtout la rondeur et la puissance.";
  else if(p.profil.includes('profil_fruite')) avoid="vous préférez un registre austère et peu fruité.";
  return {
    choose:`vous cherchez une cuvée pour ${p.pair}, dans un registre ${p.tags.slice(0,2).join(' et ').toLowerCase()}.`,
    avoid
  };
}

function blogMain(){
  const cards = articles().map(articleCard).join('');
  return `<section class="blogpage"><div class="container">
    <div class="sec-head" style="text-align:left;margin-left:0"><h1 class="h2">Le journal</h1><p>Guides pratiques, décryptages et sélections pour profiter du champagne sans fausse note.</p></div>
    <div class="cards">${cards}</div>
  </div></section>`;
}

function productMain(p){
  const d = detail(p) || {};
  const guide = decisionGuide(p);
  const axes = d.profil ? [['Fraîcheur',d.profil.fraicheur],['Rondeur',d.profil.rondeur],['Puissance',d.profil.puissance],['Longueur',d.profil.longueur]].map(([t,x])=>`<div class="axe"><div class="axe-t">${t}</div><p>${x}</p></div>`).join('') : '';
  const accords = d.accords ? d.accords.map(a=>`<div class="acc"><div class="acc-t">${a.t}</div><p>${a.d}</p></div>`).join('') : '';
  const tags = p.tags.map(t=>`<span class="tag">${t}</span>`).join('');
  const others = products().filter(x=>x.id!==p.id).slice(0,3).map(productCard).join('');
  return `<section class="product"><div class="container">
    <a class="a-back" href="/champagnes/">‹ La sélection</a>
    <div class="phero">
      <div class="phero-img">${bottleViz(p,'big')}</div>
      <div class="phero-b">
        <div class="rmaison">${p.house}</div>
        <h1 class="phero-name">${p.name}</h1>
        <div class="rsub">${p.region} · À servir avec ${p.pair}</div>
        <p class="phero-note">${d.advice || p.note}</p>
        <div class="rtags">${tags}</div>
        <div class="pbuy"><div class="rprice">${priceText(p)}</div>${productAction(p)}</div>
        <div class="aff-note">${p.commerceReady ? `Lien partenaire · Prix et disponibilité contrôlés.` : `Fourchette éditoriale indicative · offre marchande en cours de vérification.`}</div>
      </div>
    </div>
    ${d.profil?`<div class="pblock"><div class="pblock-eyebrow">Profil aromatique</div><h2 class="pblock-h">La structure de ce champagne</h2><div class="axes">${axes}</div></div>`:''}
    ${(d.advice||d.dego)?`<div class="pblock alt"><div class="pblock-eyebrow">Notre conseil</div><h2 class="pblock-h">Pourquoi la choisir</h2><p class="pblock-p">${d.advice||d.dego}</p></div>`:''}
    <div class="pblock alt"><div class="pblock-eyebrow">Décision rapide</div><h2 class="pblock-h">Est-ce la bonne cuvée pour vous ?</h2><div class="decision-grid"><div class="decision"><strong>À choisir si…</strong><p>${guide.choose}</p></div><div class="decision"><strong>À éviter si…</strong><p>${guide.avoid}</p></div></div></div>
    ${d.facts?`<div class="pblock"><div class="pblock-eyebrow">Fait vérifié</div><h2 class="pblock-h">Ce qu'il faut retenir</h2><p class="pblock-p">${d.facts}</p><p class="aff-note" style="text-align:center">Source contrôlée le ${p.verifiedAt||'—'}.</p></div>`:''}
    ${d.dosage?`<div class="pblock"><div class="pblock-eyebrow">Assemblage & terroir</div><h2 class="pblock-h">La composition</h2><div class="compo"><div class="compo-i"><div class="compo-v">${d.dosage}</div><div class="compo-l">Dosage</div></div><div class="compo-i"><div class="compo-v">${d.cepages}</div><div class="compo-l">Cépages</div></div></div><p class="pblock-p" style="margin-top:18px">${d.terroir}</p></div>`:''}
    ${d.accords?`<div class="pblock alt"><div class="pblock-eyebrow">À table</div><h2 class="pblock-h">L'accord parfait</h2><div class="accs">${accords}</div></div>`:''}
    ${d.maison?`<div class="pblock"><div class="pblock-eyebrow">La maison</div><h2 class="pblock-h">${p.house}</h2><p class="pblock-p">${d.maison}</p></div>`:''}
    <div class="pblock"><h2 class="pblock-h" style="text-align:center">Vous aimerez aussi</h2><div class="pgrid" style="margin-top:26px">${others}</div></div>
  </div></section>`;
}

function articleMain(a){
  const rel = (a.related||[]).map(prod).filter(Boolean);
  const relBlock = rel.length ? `<div class="article-cta"><h3>La cuvée du moment</h3><p>${rel[0].house} — ${rel[0].name}, ${priceText(rel[0])}</p>${productAction(rel[0])}</div>` : '';
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

function methodMain(){
  return `<section class="article"><div class="narrow">
    <div class="a-cat">Transparence</div><h1 class="a-title">Notre méthode</h1>
    <p class="qhint">Comment QuelChampagne sépare les faits, les conseils et le commerce.</p>
    <div class="prose">
      <h3>1. Les faits viennent des producteurs</h3>
      <p>Assemblage, dosage, millésime, édition et méthode d’élaboration ne sont publiés que lorsqu’une source officielle exploitable est conservée avec sa date de vérification. Une référence imprécise ou une sortie non identifiée reste hors catalogue.</p>
      <h3>2. Le conseil est éditorial</h3>
      <p>QuelChampagne transforme ces faits en critères utiles : occasion, style recherché, budget indicatif, accords et type de producteur. Nous ne prétendons pas avoir dégusté toutes les bouteilles et nous ne recopions pas les descriptions commerciales des marques.</p>
      <h3>3. Le classement n’est pas acheté</h3>
      <p>Le sélecteur classe les cuvées selon les réponses données. Une maison ou un marchand ne peut pas payer pour apparaître devant une recommandation plus pertinente.</p>
      <h3>4. Les prix restent une donnée séparée</h3>
      <p>Les fourchettes visibles servent à orienter un budget. Un prix marchand est volatil : il doit être relié au produit et au format exacts, daté et accompagné d’un état de disponibilité. Aucun lien partenaire n’est affiché avant ce contrôle.</p>
      <h3>5. Les images doivent être exploitables légalement</h3>
      <p>Nous n’utilisons pas de photographie de bouteille sans autorisation, licence ou création originale. Les visuels génériques n’ont pas vocation à reproduire un packaging de marque.</p>
      <h3>Politique de correction</h3>
      <p>Lorsqu’une information devient obsolète ou qu’une édition change, la donnée concernée doit être suspendue, vérifiée à nouveau sur une source primaire, puis redatée avant republication. L’historique des offres commerciales ne remplace jamais la fiche produit.</p>
    </div>
  </div></section>`;
}

function aboutMain(){
  return `<section class="article"><div class="narrow">
    <div class="a-cat">À propos</div><h1 class="a-title">Choisir un champagne sans subir le classement d’un caviste</h1>
    <div class="prose">
      <p>QuelChampagne est un conseiller indépendant consacré uniquement au Champagne. Sa mission est simple : aider chacun à trouver une cuvée cohérente avec un moment, un goût et un budget, sans réduire le choix à une liste de bouteilles sponsorisées.</p>
      <h3>Un produit construit autour des données</h3>
      <p>Chaque cuvée relie une maison, une sortie exacte, des faits officiels, un profil éditorial, des usages et, à terme, des offres datées. Cette structure permet de comparer des champagnes réellement comparables et de distinguer une cuvée permanente d’un millésime ou d’une édition numérotée.</p>
      <h3>Ce que nous refusons</h3>
      <p>Pas de dégustation inventée, pas de photographie récupérée sans droit, pas de prix présenté comme permanent et pas de recommandation achetée. La profondeur de la base et la qualité des liens entre les informations comptent davantage que le volume de pages.</p>
      <div style="margin-top:36px"><a class="btn btn-primary" href="/selecteur/">Essayer le sélecteur</a> <a class="btn btn-ghost" href="/notre-methode/">Lire notre méthode</a></div>
    </div>
  </div></section>`;
}

function legalMain(){
  return `<section class="article"><div class="narrow">
    <div class="a-cat">Informations juridiques</div><h1 class="a-title">Mentions légales</h1>
    <div class="prose">
      <h3>Éditeur du site</h3>
      <p>Le site <strong>quelchampagne.fr</strong> est édité par <strong>CORTEXIA</strong>, société par actions simplifiée (SAS) au capital de 1 000 €.<br>Siège social : 59 rue de Ponthieu, 75008 Paris.<br>SIREN : 107 124 000 — RCS Paris 107 124 000.<br>N° TVA intracommunautaire : FR51107124000.<br>Directeur de la publication : Timothée Michel, président.<br>Contact : timothe.cabinetdp@gmail.com</p>
      <h3>Hébergement</h3>
      <p>Le site est hébergé par <strong>Netlify, Inc.</strong>, 512 2nd Street, Suite 200, San Francisco, CA 94107, États-Unis — support@netlify.com.</p>
      <h3>Contenu et propriété intellectuelle</h3>
      <p>Les textes, données structurées et visuels originaux de QuelChampagne ne peuvent pas être réutilisés sans autorisation. Les marques citées appartiennent à leurs titulaires respectifs. Leur citation sert uniquement à identifier les cuvées présentées.</p>
      <h3>Information et responsabilité</h3>
      <p>Les fourchettes de prix sont indicatives et séparées des offres marchandes. Une information peut évoluer après sa date de vérification ; le site met à disposition les sources officielles utilisées pour les faits produit.</p>
      <h3>Affiliation</h3>
      <p>QuelChampagne participe au Programme Partenaires d’Amazon, un programme d’affiliation permettant de percevoir une rémunération grâce à des liens vers Amazon.fr. Certains boutons « Voir l’offre » sont des liens affiliés, signalés comme tels (attribut <code>rel="sponsored"</code>) à proximité du lien. Cette rémunération éventuelle ne modifie ni le classement éditorial, ni les recommandations du sélecteur. Les prix et disponibilités affichés sur Amazon relèvent d’Amazon et non de QuelChampagne.</p>
    </div>
  </div></section>`;
}

function privacyMain(){
  return `<section class="article"><div class="narrow">
    <div class="a-cat">Données personnelles</div><h1 class="a-title">Politique de confidentialité</h1>
    <div class="prose">
      <h3>Données actuellement traitées</h3>
      <p>Le site statique n’intègre actuellement ni compte utilisateur, ni formulaire, ni newsletter, ni outil de mesure d’audience. Les réponses au sélecteur restent dans le navigateur et ne sont pas envoyées à un serveur.</p>
      <h3>Confirmation de majorité</h3>
      <p>Après confirmation, le navigateur enregistre localement la valeur technique <code>qc_age_ok</code> afin d’éviter de réafficher immédiatement la porte d’âge. Cette valeur ne contient pas l’âge, l’identité ou les réponses au sélecteur.</p>
      <h3>Services tiers</h3>
      <p>Le site n’intègre ni régie publicitaire, ni traceur d’audience, ni police externe. Certaines photographies d’illustration (accueil, en-têtes) sont servies par le réseau de diffusion d’Unsplash (images.unsplash.com) ; comme tout hébergeur d’images, Unsplash peut recevoir des données techniques de connexion (adresse IP, type de navigateur) lors du chargement de ces visuels. Aucun cookie n’est déposé par ce biais. Certains boutons « Voir l’offre » renvoient, à votre initiative, vers Amazon.fr dans le cadre du Programme Partenaires d’Amazon ; c’est alors Amazon qui applique sa propre politique de confidentialité et ses cookies. Toute future activation d’un outil de mesure d’audience ou d’un formulaire fera l’objet d’une mise à jour préalable de cette politique et, si nécessaire, d’un mécanisme de consentement.</p>
      <h3>Vos droits et contact</h3>
      <p>Responsable du traitement : CORTEXIA (SAS), 59 rue de Ponthieu, 75008 Paris. Pour toute demande relative à vos données ou l’exercice de vos droits : timothe.cabinetdp@gmail.com. Vous pouvez également saisir la CNIL (www.cnil.fr).</p>
    </div>
  </div></section>`;
}

// Le sélecteur interactif : on réutilise index.html, mais on fait pointer les
// liens produit/article et la nav vers les pages statiques.
function selecteurHTML(){
  let h = HTML;
  h = h.replace('let CATALOGUE = null;', `let CATALOGUE = ${JSON.stringify(catalogue).replaceAll('<','\\u003c')};`);
  h = h.replace(/function FALLBACK_PRODUCTS\(\)\{[\s\S]*?\n\}\nfunction prod/, "function FALLBACK_PRODUCTS(){ return []; }\nfunction prod");
  h = h.replace(/const DETAILS = \{[\s\S]*?\n\};\nfunction detail/, "const DETAILS = {};\nfunction detail");
  h = h.replace("function openProduct(id){ state.product=id; state.view='product'; render(); }", "function openProduct(id){ location.href='/champagne/'+id+'/'; }");
  h = h.replace("function openArticle(id){ state.article=id; state.view='article'; render(); }", "function openArticle(id){ location.href='/blog/'+id+'/'; }");
  h = h.replace("const state = { view:'home'", "const state = { view:'quiz'");
  h = h.replace('<title>QuelChampagne — Trouvez le champagne fait pour vous</title>', '<title>Sélecteur de champagne — Une recommandation en 4 questions | QuelChampagne</title>');
  h = h.replace('content="Le sélecteur indépendant qui vous oriente vers la cuvée juste en quatre questions, à partir de fiches vérifiées."', 'content="Répondez à quatre questions sur l’occasion, le style, le budget et le producteur pour obtenir une recommandation de champagne argumentée."');
  h = h.replace('content="QuelChampagne — Trouvez le champagne fait pour vous"', 'content="Sélecteur de champagne — Une recommandation en 4 questions | QuelChampagne"');
  h = h.replace('content="Quatre questions, une recommandation sur mesure et des fiches reliées à leurs sources."', 'content="Répondez à quatre questions sur l’occasion, le style, le budget et le producteur pour obtenir une recommandation de champagne argumentée."');
  h = h.replace('content="https://quelchampagne.fr"', 'content="https://quelchampagne.fr/selecteur/"');
  // canonical
  h = h.replace('<link rel="canonical" href="https://quelchampagne.fr">', '<link rel="canonical" href="https://quelchampagne.fr/selecteur/">');
  return h;
}

// ---------- écriture ----------
try { rmSync('dist', { recursive:true, force:true }); } catch(e) { /* dossier absent ou verrouillé : sans importance */ }
cpSync('assets', 'dist/assets', { recursive:true });
function write(path, content){
  const full = 'dist/' + path;
  mkdirSync(full.split('/').slice(0,-1).join('/'), { recursive:true });
  writeFileSync(full, content, 'utf8');
}

const urls = [];
function add(loc, prio, freq){ urls.push({loc, prio, freq}); }

// home
write('index.html', page({ title:'QuelChampagne — Trouvez le champagne fait pour vous', desc:'Le sélecteur indépendant qui vous oriente vers la cuvée juste en quatre questions, à partir de fiches vérifiées.', canonical:BASE+'/', active:'home', main:homeMain() }));
add(BASE+'/', '1.0', 'weekly');

// selecteur
write('selecteur/index.html', selecteurHTML());
add(BASE+'/selecteur/', '0.8', 'monthly');

// champagnes list
write('champagnes/index.html', page({ title:'La sélection — QuelChampagne', desc:'Notre sélection de champagnes vérifiés, avec fiche détaillée, profil, occasions, accords et source officielle.', canonical:BASE+'/champagnes/', active:'shop', main:champagnesMain() }));
add(BASE+'/champagnes/', '0.9', 'weekly');

// comparateur interactif
write('comparateur/index.html', page({ title:'Comparateur de champagnes — Comparez jusqu’à 4 cuvées | QuelChampagne', desc:'Comparez jusqu’à quatre champagnes selon leur budget indicatif, leur style, leurs occasions et leurs accords.', canonical:BASE+'/comparateur/', active:'compare', main:comparateurMain() }));
add(BASE+'/comparateur/', '0.9', 'weekly');

write('notre-methode/index.html', page({ title:'Notre méthode — Sources, indépendance et prix | QuelChampagne', desc:'Découvrez comment QuelChampagne vérifie les faits, construit ses recommandations et sépare les données produit des offres marchandes.', canonical:BASE+'/notre-methode/', active:'method', main:methodMain() }));
add(BASE+'/notre-methode/', '0.7', 'monthly');

write('a-propos/index.html', page({ title:'À propos de QuelChampagne — Le conseiller indépendant', desc:'QuelChampagne aide à choisir une cuvée selon le moment, le style et le budget, à partir de données structurées et de sources officielles.', canonical:BASE+'/a-propos/', active:'about', main:aboutMain() }));
add(BASE+'/a-propos/', '0.6', 'monthly');

write('mentions-legales/index.html', page({ title:'Mentions légales — QuelChampagne', desc:'Informations sur l’éditeur, l’hébergement, les contenus et l’affiliation du site QuelChampagne.', canonical:BASE+'/mentions-legales/', active:'', main:legalMain() }));
add(BASE+'/mentions-legales/', '0.3', 'yearly');

write('confidentialite/index.html', page({ title:'Politique de confidentialité — QuelChampagne', desc:'Traitement des données, stockage local de la confirmation de majorité et services tiers utilisés par QuelChampagne.', canonical:BASE+'/confidentialite/', active:'', main:privacyMain() }));
add(BASE+'/confidentialite/', '0.3', 'yearly');

// comparatifs éditoriaux
write('comparatifs/index.html', page({ title:'Comparatifs de champagnes — QuelChampagne', desc:'Des comparatifs directs pour choisir entre deux champagnes selon le style, l’occasion, les accords et le budget.', canonical:BASE+'/comparatifs/', active:'compare', main:comparisonsMain() }));
add(BASE+'/comparatifs/', '0.8', 'weekly');
for(const comparison of COMPARISONS){
  write(`comparatifs/${comparison.id}/index.html`, page({ title:`${comparison.title} | QuelChampagne`, desc:comparison.verdict.slice(0,155), canonical:`${BASE}/comparatifs/${comparison.id}/`, active:'compare', main:comparisonMain(comparison) }));
  add(`${BASE}/comparatifs/${comparison.id}/`, '0.8', 'monthly');
}

// product pages
for(const p of products()){
  const d = detail(p) || {};
  const desc = (d.advice || p.note).slice(0,155);
  write(`champagne/${p.id}/index.html`, page({ title:`${p.house} ${p.name} — Conseils, profil et budget | QuelChampagne`, desc, canonical:`${BASE}/champagne/${p.id}/`, ogImage:OG, active:'shop', main:productMain(p) }));
  add(`${BASE}/champagne/${p.id}/`, '0.8', 'monthly');
}

// pages SEO par occasion et style
for(const landing of SEO_LANDINGS){
  write(`champagne/${landing.id}/index.html`, page({ title:`${landing.title} | QuelChampagne`, desc:landing.desc, canonical:`${BASE}/champagne/${landing.id}/`, active:'shop', main:landingMain(landing) }));
  add(`${BASE}/champagne/${landing.id}/`, '0.9', 'weekly');
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
write('catalogue.json', `${JSON.stringify(catalogue, null, 2)}\n`);

console.log(`✅ Site statique généré dans dist/`);
console.log(`   ${products().length} fiches champagne · ${articles().filter(a=>!a.soon).length} articles · ${urls.length} URLs au sitemap`);
