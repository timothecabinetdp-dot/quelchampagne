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
import { boutiqueMain, boutiqueProductMain } from './boutique.mjs';
import { PARTNER_CATALOGUE, AVAILABLE_PARTNER_CATALOGUE } from './build-partner-catalogue.mjs';
import { buildKnowledgeBase } from './expert-engine.mjs';
import { expertMain } from './expert-page.mjs';

const BASE = 'https://quelchampagne.fr';
const HERO = '/assets/hero-quelchampagne.svg';
const OG   = BASE + '/assets/og-quelchampagne.png';
// Photos libres de droit (licence Unsplash, hotlink autorisé). Voir data/image-rights-register.json.
const HERO_PHOTO      = 'https://images.unsplash.com/photo-1623428454697-08da4a100602?q=80&w=2000&auto=format&fit=crop';
const SELECTION_PHOTO = 'https://images.unsplash.com/photo-1609516142756-7ecef85e76a7?q=80&w=2000&auto=format&fit=crop';
const QUIZ_PHOTO      = 'https://images.unsplash.com/photo-1647905555465-0f9004fbdaed?q=80&w=2000&auto=format&fit=crop';
// Couvertures éditoriales du blog (Unsplash, enregistrées dans data/image-rights-register.json).
const BLOG_PHOTOS = {
  'guide-2026':'1446822775955-c34f483b410b', 'dosages':'1653515906764-96bfd5c01141',
  'accords':'1758972574954-ab4b5b5baed5', 'moins-50':'1609516142756-7ecef85e76a7',
  'mariage':'1647905555465-0f9004fbdaed', 'cadeau':'1606728000988-fbbec753b8ce',
  'quantite':'1580657274234-7339717f4541', 'blanc-blancs':'1623428454697-08da4a100602',
  'servir':'1720070827797-d4f03e228dea', 'noel':'1608416026650-66b4e0c0c301',
  'moins-30':'1558001373-7b93ee48ffa0', 'aperitif':'1498429152472-9a433d9ddf3b',
  'huitres':'1679694140422-aecfd3d5dd0b', 'anniversaire':'1514828980084-9462f7d03afc',
  'brut-nature':'1619810856355-c5f4e7f8a90e', 'rose-saignee':'1673872602569-c9a1c1bfe71f',
  'vigneron':'1635715070096-b4655b94edee', 'etiquette':'1628336707631-68131ca720c3'
};
function blogPhoto(a, w){ const id = BLOG_PHOTOS[a.id]; return id ? `https://images.unsplash.com/photo-${id}?q=75&w=${w||800}&auto=format&fit=crop` : null; }
function coverStyle(a, w){ const p = blogPhoto(a, w); return p ? `background:#EFEAE0 url('${p}') center/cover` : `background:${coverBg(a)}`; }
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 64'%3E%3Cpath d='M8 16C8 7.7 14.7 2 24 2s16 5.5 16 14c0 6.3-3.6 10.2-9 13.8-4.4 3-6.2 5.7-6.2 10.2' fill='none' stroke='%239C7A34' stroke-width='4.8' stroke-linecap='round'/%3E%3Cpath d='M16 47h16c-.7 4.4-3.7 6.8-8 6.8s-7.3-2.4-8-6.8Z' fill='%239C7A34'/%3E%3Cpath d='M24 53.3v6.2M19.5 61.5h9' stroke='%239C7A34' stroke-width='2.2' stroke-linecap='round' fill='none'/%3E%3C/svg%3E";

// ---------- lire index.html : CSS + données ----------
const HTML = readFileSync('index.html', 'utf8');
const CSS = HTML.split('<style>')[1].split('</style>')[0];
const SCRIPT = HTML.split('<script>')[1].split('</script>')[0];

const ctx = {};
global.document = { getElementById:()=>({set innerHTML(v){}, get innerHTML(){return '';}}), querySelector:()=>null, createElement:()=>({set innerHTML(v){}, appendChild(){}, remove(){}, setAttribute(){}, addEventListener(){}, focus(){}, querySelector(){return {set innerHTML(v){}};}, querySelectorAll(){return [];}, style:{}}), body:{appendChild(){},style:{}}, documentElement:{lang:'', style:{setProperty(){}}} };
global.window = { scrollTo(){}, open(){} };
global.localStorage = { getItem(){return null;}, setItem(){} };
global.fetch = () => Promise.reject('x');
eval(SCRIPT + '; Object.assign(ctx,{products,setCatalogue,articles,prod,art,detail,coverBg,PHOTOS,photoSrc,buyLink,priceText,productAction,bottleViz,logoMark,BRAND});');

const catalogue = buildCatalogue();
const allPartnerProducts = PARTNER_CATALOGUE;
const partnerProducts = AVAILABLE_PARTNER_CATALOGUE;
const expertKnowledgeBase = buildKnowledgeBase(allPartnerProducts);
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
    desc:'Découvrez les champagnes disponibles les plus adaptés à l’apéritif selon leur fraîcheur, leur style et votre budget.',
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
    desc:'Trouvez un champagne de repas selon la puissance, la fraîcheur et les accords analysés sur chaque fiche.',
    intro:'À table, le champagne ne doit pas seulement ouvrir le repas : il doit tenir face au plat. Les cuvées plus vineuses ou complexes conviennent aux volailles, poissons en sauce et fromages, tandis que les profils tendus restent particulièrement adaptés aux produits marins.',
    advice:'L’accord dépend davantage de la structure du vin et de la préparation du plat que du prestige de l’étiquette. Utilisez le comparateur pour mettre en regard puissance, profil et accords avant de choisir.',
    filter:p=>p.occ.includes('occ_diner')
  },
  {
    id:'rose',
    title:'Quel champagne rosé choisir ?',
    desc:'Comparez les champagnes rosés disponibles : styles délicats, fruités ou gastronomiques, budgets et accords.',
    intro:'Tous les champagnes rosés ne remplissent pas le même rôle. Certains privilégient la finesse et les crustacés, d’autres l’expression des fruits rouges ou une structure suffisante pour accompagner un repas. La méthode d’élaboration et l’assemblage ne sont affirmés que lorsque leur source est indiquée.',
    advice:'Ne choisissez pas un rosé uniquement pour sa couleur. Un profil délicat convient au cadeau et à l’apéritif, tandis qu’une cuvée plus vineuse peut accompagner le saumon, le canard ou une cuisine plus structurée.',
    filter:p=>p.tags.some(tag=>tag.toLowerCase().includes('rosé'))
  },
  {
    id:'blanc-de-blancs',
    title:'Quel champagne blanc de blancs choisir ?',
    desc:'Découvrez les champagnes blancs de blancs disponibles, du profil frais et minéral aux cuvées millésimées de prestige.',
    intro:'Un blanc de blancs est élaboré à partir de raisins blancs, le plus souvent exclusivement de chardonnay en Champagne. Le style peut toutefois aller d’un brut frais et accessible à une cuvée millésimée profonde : le nom de la catégorie ne suffit donc pas à prédire l’usage.',
    advice:'Les profils les plus vifs sont particulièrement cohérents avec les huîtres, crustacés et poissons fins. Les sorties millésimées plus complexes demandent davantage de temps dans le verre et peuvent accompagner tout un repas.',
    filter:p=>p.name.toLowerCase().includes('blanc de blancs') || p.tags.some(tag=>tag.toLowerCase().includes('blanc de blancs'))
  },
  {
    id:'moins-de-50-euros',
    title:'Quel champagne choisir à moins de 50 euros ?',
    desc:'Découvrez les champagnes actuellement proposés à moins de 50 euros, puis comparez leur style, leurs accords et leur usage.',
    intro:'Un budget inférieur à 50 euros permet déjà de comparer des bruts de maisons établies et des cuvées de vignerons plus confidentielles. La sélection ci-dessous retient uniquement les offres dont le dernier prix relevé ne dépasse pas 50 euros.',
    advice:'Comparez d’abord le style et l’usage. La date de contrôle figure sur chaque fiche et le vendeur confirme le prix final, le stock et les frais de livraison.',
    filter:p=>p.priceMax<=50
  },
  {
    id:'fruits-de-mer',
    title:'Quel champagne choisir avec des fruits de mer ?',
    desc:'Trouvez un champagne pour les huîtres, crustacés et fruits de mer parmi les cuvées analysées pour ces accords.',
    intro:'Avec les fruits de mer, la fraîcheur, la précision et une finale nette comptent davantage que la notoriété de l’étiquette. Cette page retient les cuvées dont le profil et les accords conseillés correspondent explicitement aux produits de la mer.',
    advice:'Pour les huîtres et coquillages, privilégiez les profils les plus droits et minéraux. Avec des crustacés, une texture plus ronde peut fonctionner, surtout lorsque la préparation comporte du beurre, une sauce ou une cuisson marquée.',
    filter:p=>p.accords.includes('accord_mer')
  }
];

// ---------- gabarits partagés ----------
function header(active){
  const L=(href,label,key)=>`<a class="nlink${active===key?' on':''}" href="${href}"${active===key?' aria-current="page"':''}>${label}</a>`;
  return `<header class="nav"><div class="container nav-in">
    <a class="logo" href="/">${logoMark()}<span class="logo-txt">Quel<b>Champagne</b></span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-navigation" aria-label="Ouvrir le menu"><span></span><span></span></button>
    <nav class="nav-links" id="primary-navigation" aria-label="Navigation principale">${L('/champagnes/','La sélection','shop')}${L('/comparateur/','Comparer','compare')}${L('/blog/','Blog','blog')}<a class="nlink-cta" href="/expert/">Sélecteur expert</a></nav>
  </div></header>`;
}
function footer(){
  return `<footer><div class="container">
    <div class="foot-in">
      <div class="foot-brand"><span class="foot-brand-name">${BRAND}${logoMark()}</span><p>Un conseil indépendant pour choisir selon le style, l’accord et le budget.</p></div>
      <nav class="foot-links" aria-label="Navigation secondaire"><a href="/expert/">Le sélecteur expert</a><a href="/selecteur/">Le sélecteur rapide</a><a href="/comparateur/">Comparer</a><a href="/notre-methode/">Notre méthode</a><a href="/a-propos/">À propos</a><a href="/partenaires/">Professionnels</a><a href="/mentions-legales/">Mentions légales</a><a href="/confidentialite/">Confidentialité</a><button onclick="window.qcAffiliatePreferences&&window.qcAffiliatePreferences()">Préférence d’affiliation</button></nav>
    </div>
    <div class="foot-health">L'abus d'alcool est dangereux pour la santé. À consommer avec modération.</div>
    <div class="foot-disc">Site réservé aux personnes majeures. ${BRAND} propose des informations et des conseils indépendants. Chaque prix affiché correspond au dernier relevé de l’offre présentée et porte sa date de contrôle.</div>
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

const NAVIGATION = `<script>
(function(){
  var header=document.querySelector('.nav');
  var toggle=header&&header.querySelector('.nav-toggle');
  var links=header&&header.querySelector('.nav-links');
  if(!header||!toggle||!links)return;
  function close(){
    header.classList.remove('is-open');
    toggle.setAttribute('aria-expanded','false');
    toggle.setAttribute('aria-label','Ouvrir le menu');
  }
  toggle.addEventListener('click',function(){
    var open=!header.classList.contains('is-open');
    header.classList.toggle('is-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu');
  });
  links.addEventListener('click',function(event){if(event.target.closest('a'))close();});
  document.addEventListener('keydown',function(event){if(event.key==='Escape')close();});
  document.addEventListener('click',function(event){if(header.classList.contains('is-open')&&!header.contains(event.target))close();});
  var desktop=window.matchMedia&&window.matchMedia('(min-width:701px)');
  if(desktop&&desktop.addEventListener)desktop.addEventListener('change',function(event){if(event.matches)close();});
})();
</script>`;

const MOTION = `<script>
(function(){
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var bb=document.getElementById('bubbles');
  if(bb && !reduce){
    for(var i=0;i<28;i++){var b=document.createElement('i');var s=(4+Math.random()*13);b.style.left=(Math.random()*100)+'%';b.style.width=s+'px';b.style.height=s+'px';b.style.animationDuration=(6+Math.random()*7).toFixed(2)+'s';b.style.animationDelay=(Math.random()*9).toFixed(2)+'s';bb.appendChild(b);}
  }
  var gauges=[].slice.call(document.querySelectorAll('.gauge-fill'));
  var els=[].slice.call(document.querySelectorAll('.sec-head, .steps .step, .pgrid > *, .cards > *, .band .container, .trust-item, .duel-col, .article .prose > p, .product .pblock, .axes > *, .accs > *, .decision-grid > *, .compo'));
  if(reduce || !('IntersectionObserver' in window)){els.forEach(function(e){e.classList.add('in');});gauges.forEach(function(g){g.classList.add('in');});return;}
  els.forEach(function(e,i){e.classList.add('reveal'); e.style.transitionDelay=((i%3)*0.07).toFixed(2)+'s';});
  var io=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');io.unobserve(x.target);}});},{threshold:0.1, rootMargin:'0px 0px -6% 0px'});
  els.forEach(function(e){io.observe(e);});
  var gio=new IntersectionObserver(function(en){en.forEach(function(x){if(x.isIntersecting){x.target.classList.add('in');gio.unobserve(x.target);}});},{threshold:0.35});
  gauges.forEach(function(g){gio.observe(g);});
})();
</script>`;

function page({title, desc, canonical, ogImage, active, main, graph, noindex}){
  const schema = JSON.stringify({
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'WebSite','@id':BASE+'/#website',name:'QuelChampagne',url:BASE+'/',inLanguage:'fr-FR',publisher:{'@id':BASE+'/#org'}},
      {'@type':'Organization','@id':BASE+'/#org',name:'QuelChampagne',url:BASE+'/',description:'Sélecteur et guide de champagne indépendant, des grandes maisons aux vignerons.',parentOrganization:{'@type':'Organization',name:'CORTEXIA',legalName:'CORTEXIA (SAS)'}},
      {'@type':'WebPage','@id':canonical+'#webpage',name:title,url:canonical,description:desc,inLanguage:'fr-FR',isPartOf:{'@id':BASE+'/#website'}},
      ...(graph||[])
    ]
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
<meta name="robots" content="${noindex?'noindex,follow':'index,follow,max-image-preview:large'}">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="${FAVICON}">
<script src="/assets/analytics.js" defer></script>
<script type="application/ld+json">${schema}</script>
<style>${CSS}</style>
</head>
<body>
<a class="skip-link" href="#main-content">Aller au contenu</a>
${header(active)}
<main id="main-content">${main}</main>
${footer()}
${NAVIGATION}
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
function partnerHomeCard(p){
  const price = p.price.toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}) + ' €';
  return `<a class="pcard partner-pcard" href="/champagne/${p.id}/">
    <div class="pcard-img partner-pcard-img"><img loading="lazy" src="${p.image}" alt="${p.brand} ${p.name}"></div>
    <div class="pcard-b"><div class="pcard-house">${p.brand}</div><div class="pcard-name">${p.name}</div><div class="pcard-note">${p.note}</div><div class="pcard-foot"><span class="pcard-price">${price}</span><span class="chev">Voir l’analyse</span></div></div>
  </a>`;
}
const BUILD_DATE = new Date().toISOString().slice(0,10);
function readTime(a){ const w = String(a.body||'').replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length; return Math.max(1, Math.round(w/200)) + ' min'; }
function crumbs(items){ return {'@type':'BreadcrumbList',itemListElement:items.map((it,i)=>({'@type':'ListItem',position:i+1,name:it.name,item:it.url}))}; }
function clip(s,n){ if(!s||s.length<=n) return s||''; return s.slice(0,n).replace(/\s+\S*$/,'')+'…'; } function articleCard(a){
  return `<a class="acard" href="/blog/${a.id}/"><div class="acard-cover" style="${coverStyle(a,700)}"><span class="acard-cat">${a.cat}</span></div><div class="acard-b"><h3>${a.title}</h3><p>${a.excerpt}</p><div class="acard-meta">${a.date} · ${readTime(a)} de lecture</div></div></a>`;
}
function boutiqueAnalysisDescription(p){
  return clip(`Notre analyse du ${p.brand} ${p.name} : ${p.note}`,155);
}
function removeLegacyProductLinks(body){
  const publicIds=new Set([...allPartnerProducts.map(product=>product.id),...SEO_LANDINGS.map(landing=>landing.id)]);
  return body.replace(/href="\/champagne\/([a-z0-9-]+)\/"/g,(match,id)=>
    publicIds.has(id)?match:'href="/champagnes/"'
  );
}
function fixLinks(body){
  const withoutDirectActions=body.replace(/href="#" onclick="return openAff\('[^']+'\)"/g, 'href="/champagnes/"');
  return removeLegacyProductLinks(withoutDirectActions);
}

// ---------- pages ----------
function homeMain(){
  const featuredBrands = ['Nicolas Feuillatte','Veuve Clicquot','Perrier-Jouët'];
  const featured = featuredBrands.map(brand=>partnerProducts.find(p=>p.brand===brand)).filter(Boolean);
  for(const product of [...partnerProducts].sort((a,b)=>(b.popularity||0)-(a.popularity||0))){
    if(featured.length>=3) break;
    if(!featured.some(item=>item.id===product.id)) featured.push(product);
  }
  const sel = featured.map(partnerHomeCard).join('');
  const arts = articles().filter(a=>!a.soon).slice(0,3).map(articleCard).join('');
  const maisons = MAISONS.map(m=>`<span class="maison-name">${m}</span>`).join('');
  return `
  <section class="hero-photo" style="--hero-img:url('${HERO_PHOTO}')">
    <div class="bubbles" id="bubbles" aria-hidden="true"></div>
    <div class="container">
      <h1>Quel champagne<br>choisir ?</h1>
      <p class="lead">Comparez les bouteilles selon leur style, l’accord recherché et votre budget.</p>
      <div class="hero-cta"><a class="btn btn-primary btn-lg" href="/selecteur/">Trouver mon champagne</a><a class="chev" href="/notre-methode/">Comprendre notre méthode</a></div>
    </div>
  </section>
  <section class="section"><div class="container">
    <div class="trust-strip">
      <div class="trust-item"><strong>Des choix expliqués</strong><span>Chaque fiche réunit le style, les accords et le prix du jour.</span></div>
      <div class="trust-item"><strong>Classement indépendant</strong><span>Aucune maison ne paie pour remonter dans le sélecteur.</span></div>
      <div class="trust-item"><strong>Prix datés</strong><span>Le prix affiché correspond au dernier relevé chez notre partenaire.</span></div>
    </div>
  </div></section>
  <section class="section gray"><div class="container">
    <div class="sec-head"><div class="h2">Comment ça marche</div><p>Trois étapes, une petite minute.</p></div>
    <div class="steps">
      <div class="step"><div class="n">01</div><h3>Précisez</h3><p>Le moment, ce que vous servez, le style recherché, le budget et la signature souhaitée.</p></div>
      <div class="step"><div class="n">02</div><h3>Comparez</h3><p>Le sélecteur confronte vos réponses aux caractéristiques des bouteilles disponibles.</p></div>
      <div class="step"><div class="n">03</div><h3>Comprenez</h3><p>Le résultat explique les critères retenus et ouvre une fiche claire avant l’achat.</p></div>
    </div>
  </div></section>
  <section class="band"><div class="container">
    <div class="eyebrow-l">Une minute pour commencer</div>
    <h2>Trouvez les bouteilles qui correspondent à votre moment.</h2>
    <p>Le sélecteur croise le mode de service, le plat, vos préférences et votre budget, puis explique chaque recommandation.</p>
    <a class="btn btn-accent" href="/selecteur/">Lancer le sélecteur</a>
  </div></section>
  <section class="section"><div class="container">
    <div class="sec-head"><div class="h2">La sélection</div><p>${partnerProducts.length} champagnes disponibles, analysés selon leur style, leurs accords et leur positionnement.</p></div>
    <div class="pgrid">${sel}</div>
    <div class="center-cta"><a class="chev" href="/champagnes/">Voir toute la sélection</a></div>
    <div class="maisons" style="margin-top:clamp(40px,5vw,60px)">${maisons}</div>
  </div></section>
  <section class="section gray"><div class="container">
    <div class="sec-head"><div class="h2">Nos conseils</div><p>Des guides pratiques pour comprendre les styles, les dosages et les accords.</p></div>
    <div class="cards">${arts}</div>
    <div class="center-cta"><a class="chev" href="/blog/">Voir tous les articles</a></div>
  </div></section>
  <style>
    .partner-pcard-img{height:360px;background:#fff;overflow:hidden;display:flex;align-items:center;justify-content:center;contain:layout paint}
    .partner-pcard-img img{display:block;position:static!important;width:auto!important;height:auto!important;max-width:82%!important;max-height:300px!important;object-fit:contain!important;object-position:center;mix-blend-mode:multiply;margin:0!important;transform:none!important}
    .partner-pcard .pcard-note{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
    @media(max-width:760px){.partner-pcard-img{height:320px!important}.partner-pcard-img img{max-width:86%!important;max-height:270px!important}}
  </style>`;
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
  <section class="page-hero" style="--ph-img:url('${SELECTION_PHOTO}')"><div class="container"><div class="lead-head"><h1 class="h2">Sélection de champagnes</h1><p>${products().length} champagnes à comparer : brut, rosé, blanc de blancs, grandes maisons et vignerons indépendants, classés par style, accord et budget.</p><div class="rtags" style="margin-top:22px">${guides}</div></div></div></section>
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

function landingPhoto(landing){
  const photos={
    'rose':'https://images.unsplash.com/photo-1673872602569-c9a1c1bfe71f?q=80&w=2000&auto=format&fit=crop',
    'fruits-de-mer':'https://images.unsplash.com/photo-1679694140422-aecfd3d5dd0b?q=80&w=2000&auto=format&fit=crop',
    'aperitif':'https://images.unsplash.com/photo-1498429152472-9a433d9ddf3b?q=80&w=2000&auto=format&fit=crop',
    'cadeau':'https://images.unsplash.com/photo-1606728000988-fbbec753b8ce?q=80&w=2000&auto=format&fit=crop',
    'repas':'https://images.unsplash.com/photo-1720070827797-d4f03e228dea?q=80&w=2000&auto=format&fit=crop',
    'blanc-de-blancs':'https://images.unsplash.com/photo-1720070827797-d4f03e228dea?q=80&w=2000&auto=format&fit=crop',
    'moins-de-50':'https://images.unsplash.com/photo-1609516142756-7ecef85e76a7?q=80&w=2000&auto=format&fit=crop'
  };
  return photos[landing.id]||SELECTION_PHOTO;
}

function landingMain(landing){
  const selected = partnerProducts.filter(landing.filter);
  const cards = selected.map(productCard).join('');
  return `<section class="page-hero" style="--ph-img:url('${landingPhoto(landing)}')"><div class="container"><div class="lead-head">
    <div class="eyebrow">Guide de sélection</div>
    <h1 class="a-title" style="margin-top:12px">${landing.title}</h1>
    <p>${landing.intro}</p>
    <div style="margin-top:24px"><a class="btn btn-primary" href="/selecteur/">Obtenir une recommandation personnalisée</a></div>
  </div></div></section>
  <section class="section" style="padding-top:0"><div class="container">
    <div class="sec-head"><div class="h2">${selected.length} cuvées correspondantes</div><p>Chaque fiche présente une bouteille disponible, sa photo, son analyse et le prix relevé chez notre partenaire.</p></div>
    <div class="pgrid">${cards}</div>
  </div></section>
  <section class="section gray"><div class="container"><div class="narrow">
    <div class="pblock-eyebrow">Conseil QuelChampagne</div><h2 class="pblock-h">Comment affiner votre choix</h2><p class="pblock-p">${landing.advice}</p>
    <div style="margin-top:28px"><a class="chev" href="/comparateur/">Comparer jusqu’à quatre champagnes</a></div>
  </div></div></section>`;
}

function comparateurMain(){
  const profileLabels={
    profil_frais_vif:'Vif et précis',
    profil_fruite:'Fruité et expressif',
    profil_riche_ample:'Ample et structuré',
    profil_delicat:'Fin et délicat'
  };
  const pairingLabels={accord_mer:'Produits de la mer',accord_volaille:'Volaille',accord_fromage:'Fromages',accord_dessert:'Dessert',accord_aperitif:'Apéritif'};
  const humanStyle=p=>{
    const labels=(p.profil||[]).map(token=>profileLabels[token]).filter(Boolean);
    return labels.length?labels.join(' · '):(p.tags||[]).filter(tag=>tag!=='Brut').slice(0,2).join(' · ')||'Équilibré et polyvalent';
  };
  const mainPairing=p=>{
    const detailed=p.details?.accords?.map(item=>item.d).filter(Boolean)||[];
    if(detailed.length)return detailed[0];
    return (p.accords||[]).map(token=>pairingLabels[token]).find(Boolean)||'Service seul ou entrée légère';
  };
  const dosage=p=>p.details?.dosage||(p.tags||[]).find(tag=>/extra-brut|nature|demi-sec|brut/i.test(tag))||'Brut';
  const grapes=p=>p.details?.grapes?.length?p.details.grapes.join(', '):'Non communiqué par le producteur';
  const sorted = [...partnerProducts].sort((a,b)=>(b.popularity||0)-(a.popularity||0));
  const data = sorted.map(p=>{
    const e=p.details?.enrichment||{};
    return { id:p.id, house:p.house, name:p.name, image:p.image, price:priceText(p),
      type:e.type||p.tags[0]||'Champagne', expression:e.character||humanStyle(p),
      dosage:e.dosage||dosage(p), grapes:e.blendLabel||grapes(p),
      aromas:(e.aromas||[]).join(', ')||'Fruits blancs et agrumes',
      pairing:(e.pairings||[]).join(', ')||mainPairing(p),
      temperature:e.temperature||'8–10 °C', aging:e.aging||'15 mois minimum en cave',
      producerType:p.producerType==='vigneron'?'Vigneron indépendant':'Maison de Champagne', url:`/champagne/${p.id}/` };
  });
  const encoded = JSON.stringify(data).replaceAll('<','\\u003c');
  const choices = sorted.map((p,i)=>{
    const search = `${p.house} ${p.name} ${(p.tags||[]).join(' ')}`.toLowerCase().replaceAll('"','&quot;');
    return `<button class="compare-choice${i>=12?' extra':''}" type="button" data-compare="${p.id}" data-search="${search}" data-price="${p.priceMax||p.price}" data-producer="${p.producerType}" data-occ="${p.occ.join(' ')}" aria-pressed="false"><img src="${p.image}" alt="" loading="lazy"><span><strong>${p.house}</strong><small>${p.name} · ${priceText(p)}</small></span></button>`;
  }).join('');
  return `<section class="section"><div class="container">
    <div class="lead-head"><h1 class="h2">Comparer jusqu'à 4 champagnes</h1><p>Filtrez les bouteilles disponibles, puis mettez 2 à 4 cuvées en regard. Chaque prix correspond au dernier relevé de l’offre présentée.</p></div>
    <form class="catalogue-tools" id="compare-tools" role="search">
      <label class="sr-only" for="compare-search">Rechercher une cuvée</label>
      <input class="catalogue-search" id="compare-search" type="search" placeholder="Rechercher une maison ou une cuvée…">
      <div class="catalogue-filters">
        <label class="catalogue-filter">Budget<select id="compare-budget"><option value="">Tous</option><option value="under40">Moins de 40 €</option><option value="40-60">40 à 60 €</option><option value="60-90">60 à 90 €</option><option value="90plus">90 € et plus</option></select></label>
        <label class="catalogue-filter">Service<select id="compare-occ"><option value="">Tous</option><option value="occ_apero">Servi seul</option><option value="occ_diner">À table</option><option value="occ_cadeau">À offrir</option></select></label>
        <label class="catalogue-filter">Producteur<select id="compare-producer"><option value="">Tous</option><option value="maison">Maison</option><option value="vigneron">Vigneron</option></select></label>
      </div>
      <div class="catalogue-summary"><span id="compare-status" aria-live="polite">Sélectionnez 2 à 4 champagnes.</span><button class="btn btn-ghost btn-sm" id="compare-clear" type="button">Effacer la sélection</button></div>
    </form>
    <div class="compare-selected" id="compare-selected"></div>
    <div class="compare-grid" id="compare-grid">${choices}</div>
    <div style="text-align:center; margin-top:20px"><button class="btn btn-ghost btn-sm" id="compare-showall" type="button">Afficher les ${data.length} cuvées</button></div>
    <div class="compare-wrap" id="compare-result"></div>
  </div></section>
  <script>
  (() => {
    const products=${encoded};
    const selected=[];
    const status=document.getElementById('compare-status');
    const result=document.getElementById('compare-result');
    const search=document.getElementById('compare-search');
    const fb=document.getElementById('compare-budget'), fo=document.getElementById('compare-occ'), fp=document.getElementById('compare-producer');
    const showAllBtn=document.getElementById('compare-showall');
    const clear=document.getElementById('compare-clear');
    const selBox=document.getElementById('compare-selected');
    const buttons=[].slice.call(document.querySelectorAll('[data-compare]'));
    let showAll=false;
    const labels={price:'Prix relevé',type:'Catégorie',expression:'Style en bouche',dosage:'Dosage',grapes:'Assemblage',aromas:'Profil aromatique',pairing:'Accords conseillés',temperature:'Service',aging:'Maturation',producerType:'Élaboré par'};
    function budgetOk(v){ const b=fb.value; if(!b) return true; v=+v; if(b==='under40') return v<40; if(b==='40-60') return v>=40&&v<=60; if(b==='60-90') return v>60&&v<=90; if(b==='90plus') return v>90; return true; }
    function filtering(){ return Boolean(search.value.trim()||fb.value||fo.value||fp.value); }
    function applyFilters(){
      const q=search.value.trim().toLowerCase(); const active=filtering();
      buttons.forEach((b,i)=>{
        let ok=(!q||b.dataset.search.includes(q)) && budgetOk(b.dataset.price) && (!fo.value||(' '+b.dataset.occ+' ').includes(' '+fo.value+' ')) && (!fp.value||b.dataset.producer===fp.value);
        if(!active && !showAll && i>=12) ok=false;
        b.hidden=!ok;
      });
      showAllBtn.style.display=(active||showAll)?'none':'';
    }
    function renderSel(){ selBox.innerHTML=selected.length?selected.map(id=>{const p=products.find(x=>x.id===id);return '<span class="tag">'+p.house+' '+p.name+'</span>';}).join(''):''; }
    function render(){
      status.textContent=selected.length<2?'Sélectionnez encore '+(2-selected.length)+' champagne'+(2-selected.length>1?'s':'')+'.':selected.length+'/4 champagnes sélectionnés.';
      renderSel();
      if(selected.length<2){ result.innerHTML=''; return; }
      const picked=selected.map(id=>products.find(p=>p.id===id));
      const head='<tr><th>Critère</th>'+picked.map(p=>'<th><a class="compare-product-head" href="'+p.url+'"><span class="compare-product-image"><img src="'+p.image+'" alt=""></span><span>'+p.house+'<br><strong>'+p.name+'</strong></span></a></th>').join('')+'</tr>';
      const rows=Object.keys(labels).map(key=>'<tr><td>'+labels[key]+'</td>'+picked.map(p=>'<td>'+p[key]+'</td>').join('')+'</tr>').join('');
      result.innerHTML='<table class="compare-table"><thead>'+head+'</thead><tbody>'+rows+'</tbody></table>';
    }
    buttons.forEach(button=>{
      button.addEventListener('click',()=>{
        const id=button.dataset.compare, index=selected.indexOf(id);
        if(index>=0){ selected.splice(index,1); button.classList.remove('on'); button.setAttribute('aria-pressed','false'); }
        else if(selected.length<4){ selected.push(id); button.classList.add('on'); button.setAttribute('aria-pressed','true'); }
        else { status.textContent='Vous pouvez comparer 4 champagnes maximum.'; return; }
        render();
      });
    });
    search.addEventListener('input',applyFilters);
    [fb,fo,fp].forEach(el=>el.addEventListener('change',applyFilters));
    showAllBtn.addEventListener('click',()=>{ showAll=true; applyFilters(); });
    clear.addEventListener('click',()=>{ selected.splice(0); buttons.forEach(b=>{b.classList.remove('on');b.setAttribute('aria-pressed','false');}); render(); });
    applyFilters(); render();
  })();
  </script>
  <style>
    .compare-choice{display:flex!important;align-items:center;gap:12px;text-align:left}.compare-choice>img{width:42px;height:64px;object-fit:contain;background:#fff;flex:0 0 auto}.compare-choice>span{display:grid;gap:3px}.compare-choice small{font-size:13px;color:#6b665e;line-height:1.3}.compare-product-head{display:grid;justify-items:center;gap:10px;text-align:center;text-decoration:none;color:inherit}.compare-product-image{display:grid;place-items:center;width:100%;height:150px;background:#fff}.compare-product-image img{width:100%;height:138px;object-fit:contain}.compare-table tbody td:not(:first-child){line-height:1.45}.compare-table tbody tr:nth-child(even){background:#faf9f6}
    @media(max-width:720px){.compare-product-image{height:110px}.compare-product-image img{height:100px}.compare-table{min-width:720px}}
  </style>`;
}

function comparisonsMain(){
  const cards=COMPARISONS.map(c=>{
    const a=prod(c.a), b=prod(c.b);
    return `<a class="acard" href="/comparatifs/${c.id}/"><div class="acard-b"><div class="a-cat">Comparatif</div><h3>${c.title}</h3><p>${c.question}</p><div class="acard-meta">${a.house} ${a.name} · ${b.house} ${b.name}</div></div></a>`;
  }).join('');
  return `<section class="section"><div class="container"><div class="lead-head"><h1 class="h2">Comparatifs de champagnes</h1><p>Des réponses directes à de vraies hésitations d'achat, fondées sur les fiches vérifiées.</p></div><div class="cards" style="margin-top:36px">${cards}</div></div></section>`;
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
  const cards = articles().filter(article=>!article.soon).map(articleCard).join('');
  return `<section class="blogpage"><div class="container">
    <div class="sec-head" style="text-align:left;margin-left:0"><h1 class="h2">Le blog du champagne</h1><p>Guides pratiques, décryptages et sélections pour mieux comprendre le champagne.</p></div>
    <div class="cards">${cards}</div>
  </div></section>`;
}

function productMain(p){
  const d = detail(p) || {};
  const guide = decisionGuide(p);
  const AXE_LEVELS = {'très douce':1,'douce':2,'équilibrée':3,'fraîche':4,'très fraîche':5,'très droite':1,'droite':2,'ronde':4,'très ronde':5,'très légère':1,'légère':2,'puissante':4,'très puissante':5,'directe':1,'accessible':2,'nuancée':3,'complexe':4,'très complexe':5};
  const axeGauge = (t,x) => {
    const lvl = AXE_LEVELS[String(x).toLowerCase().trim()] || 3;
    return `<div class="axe"><div class="axe-head"><span class="axe-t">${t}</span><span class="axe-v">${x}</span></div><div class="gauge"><span class="gauge-fill" style="--lvl:${lvl*20}%"></span></div></div>`;
  };
  const axes = d.profil ? [['Fraîcheur',d.profil.fraicheur],['Rondeur',d.profil.rondeur],['Puissance',d.profil.puissance],['Longueur',d.profil.longueur]].map(([t,x])=>axeGauge(t,x)).join('') : '';
  const accords = d.accords ? d.accords.map(a=>`<div class="acc"><div class="acc-t">${a.t}</div><p>${a.d}</p></div>`).join('') : '';
  const tags = p.tags.map(t=>`<span class="tag">${t}</span>`).join('');
  const others = products().filter(x=>x.id!==p.id).slice(0,3).map(productCard).join('');
  return `<section class="product"><div class="container">
    <a class="a-back" href="/champagnes/">‹ La sélection</a>
    <div class="phero">
      <div class="phero-img">${bottleViz(p,'big')}</div>
      <div class="phero-b">

        <h1 class="phero-name"><span class="rmaison" style="display:block">${p.house}</span>${p.name}</h1>
        <div class="rsub">${p.region} · À servir avec ${p.pair}</div>
        <p class="phero-note">${d.advice || p.note}</p>
        <div class="rtags">${tags}</div>
        <div class="pbuy"><div class="rprice">${priceText(p)}</div>${productAction(p)}</div>
        <div class="aff-note">${p.commerceReady ? `Lien partenaire · Prix relevé chez le marchand.` : `Offre momentanément indisponible.`}</div>
      </div>
    </div>
    ${d.profil?`<div class="pblock"><div class="pblock-eyebrow">Profil aromatique</div><h2 class="pblock-h">La structure de ce champagne</h2><div class="axes">${axes}</div></div>`:''}
    ${(d.advice||d.dego)?`<div class="pblock alt"><div class="pblock-eyebrow">Notre conseil</div><h2 class="pblock-h">Pourquoi la choisir</h2><p class="pblock-p">${d.advice||d.dego}</p></div>`:''}
    <div class="pblock alt"><div class="pblock-eyebrow">Décision rapide</div><h2 class="pblock-h">Est-ce la bonne cuvée pour vous ?</h2><div class="decision-grid"><div class="decision"><strong>À choisir si…</strong><p>${guide.choose}</p></div><div class="decision"><strong>À éviter si…</strong><p>${guide.avoid}</p></div></div></div>
    ${d.facts?`<div class="pblock"><div class="pblock-eyebrow">Fait vérifié</div><h2 class="pblock-h">Ce qu'il faut retenir</h2><p class="pblock-p">${d.facts}</p><p class="aff-note" style="text-align:center">Source contrôlée le ${p.verifiedAt||'—'}.</p></div>`:''}
    ${d.dosage?`<div class="pblock"><div class="pblock-eyebrow">Assemblage & terroir</div><h2 class="pblock-h">La composition</h2><div class="compo"><div class="compo-i"><div class="compo-v">${d.dosage}</div><div class="compo-l">Dosage</div></div><div class="compo-i"><div class="compo-v">${d.cepages}</div><div class="compo-l">Cépages</div></div></div><p class="pblock-p" style="margin-top:18px">${d.terroir}</p></div>`:''}
    ${d.accords?`<div class="pblock alt"><div class="pblock-eyebrow">À table</div><h2 class="pblock-h">Accords conseillés</h2><div class="accs">${accords}</div></div>`:''}
    ${d.maison?`<div class="pblock"><div class="pblock-eyebrow">La maison</div><h2 class="pblock-h">${p.house}</h2><p class="pblock-p">${d.maison}</p></div>`:''}
    <div class="pblock"><h2 class="pblock-h" style="text-align:center">Vous aimerez aussi</h2><div class="pgrid" style="margin-top:26px">${others}</div></div>
  </div></section>`;
}

function bottleCalculator(){
  return `<div class="calc" id="calc">
    <div class="pblock-eyebrow" style="text-align:left">Outil</div>
    <h2 class="pblock-h" style="text-align:left; margin-top:6px">Calculez vos bouteilles en 10 secondes</h2>
    <div class="calc-grid">
      <div class="calc-field"><label for="c-guests">Nombre d'invités</label><input id="c-guests" type="number" min="1" max="500" step="1" value="10"></div>
      <div class="calc-field"><label for="c-moment">Moment</label><select id="c-moment"><option value="2">Apéritif seul</option><option value="3" selected>Apéritif + repas</option><option value="4.5">Soirée entière</option></select></div>
      <div class="calc-field"><label for="c-hours">Durée (heures)</label><input id="c-hours" type="number" min="1" max="12" step="1" value="3"></div>
      <div class="calc-field"><label for="c-other">Autres boissons servies&nbsp;?</label><select id="c-other"><option value="1">Non, champagne uniquement</option><option value="0.65" selected>Oui, en plus d'autres boissons</option></select></div>
      <div class="calc-field"><label for="c-price">Budget par bouteille</label><select id="c-price"><option value="25">Entrée de gamme (~25 €)</option><option value="40" selected>Milieu de gamme (~40 €)</option><option value="80">Prestige (~80 €)</option></select></div>
    </div>
    <div class="calc-out">
      <div class="calc-card"><div class="calc-num" id="c-bottles">—</div><div class="calc-lbl">bouteilles conseillées (marge incluse)</div></div>
      <div class="calc-card"><div class="calc-num" id="c-budget">—</div><div class="calc-lbl">budget estimatif</div></div>
    </div>
    <p class="calc-note" id="c-detail" aria-live="polite"></p>
    <p class="calc-note">Base de calcul : 6 flûtes par bouteille de 75 cl, environ 2 verres par personne à l'apéritif, 3 sur un repas, davantage selon la durée. Une marge de sécurité de 12 % est ajoutée. Ces chiffres restent indicatifs.</p>
  </div>
  <script>
  (function(){
    var g=document.getElementById('c-guests'),m=document.getElementById('c-moment'),h=document.getElementById('c-hours'),o=document.getElementById('c-other'),p=document.getElementById('c-price');
    if(!g) return;
    var fmt=new Intl.NumberFormat('fr-FR');
    function calc(){
      var guests=Math.max(1,parseInt(g.value,10)||1);
      var base=parseFloat(m.value)||3, hours=Math.max(1,parseFloat(h.value)||2), factor=parseFloat(o.value)||1, price=parseFloat(p.value)||40;
      var perPerson=base+Math.max(0,hours-2)*0.5;
      var glasses=guests*perPerson*factor;
      var bottles=Math.max(1,Math.ceil(glasses/6*1.12));
      document.getElementById('c-bottles').textContent=fmt.format(bottles);
      document.getElementById('c-budget').textContent=fmt.format(bottles*price)+' €';
      document.getElementById('c-detail').textContent='Soit environ '+fmt.format(Math.round(glasses))+' flûtes pour '+fmt.format(guests)+' invités. Prévoyez '+fmt.format(bottles)+' bouteilles pour être tranquille.';
    }
    [g,m,h,o,p].forEach(function(el){el.addEventListener('input',calc);el.addEventListener('change',calc);});
    calc();
  })();
  </script>`;
}
function articleMain(a){
  return `<section class="article"><div class="narrow">
    <a class="a-back" href="/blog/">‹ Retour au blog</a>
    <div class="a-cat">${a.cat}</div>
    <h1 class="a-title">${a.title}</h1>
    <div class="a-meta">${a.date} · ${readTime(a)} de lecture</div>
    <div class="a-cover" style="${coverStyle(a,1200)}"></div>
    <div class="prose">${fixLinks(a.body)}</div>
    ${a.id==='quantite'?bottleCalculator():''}
    <div style="margin-top:40px"><a class="btn btn-primary" href="/selecteur/">Trouver mon champagne</a></div>
  </div></section>`;
}

function methodMain(){
  return `<section class="article"><div class="narrow">
    <div class="a-cat">Comment nous travaillons</div><h1 class="a-title">Notre méthode</h1>
    <p class="qhint">Des données précises, une analyse commune à toutes les cuvées et des prix datés.</p>
    <div class="a-cover" style="background-image:linear-gradient(90deg,rgba(18,14,9,.16),rgba(18,14,9,.04)),url('https://images.unsplash.com/photo-1635715070096-b4655b94edee?q=82&w=1600&auto=format&fit=crop');background-size:cover;background-position:center"></div>
    <div class="prose">
      <h3>1. Identifier la bouteille exacte</h3>
      <p>Maison, cuvée, millésime, format et catégorie forment l’identité du produit. Cette identité relie la fiche technique, la photographie et l’offre du marchand sans mélanger deux éditions proches.</p>
      <h3>2. Lire le style avec la même grille</h3>
      <p>Fraîcheur, rondeur, puissance, cépages, dosage, arômes et accords composent une grille commune à tout le catalogue. Elle permet de comparer une grande maison et un vigneron sur des critères identiques.</p>
      <h3>3. Recommander selon votre usage</h3>
      <p>Le sélecteur croise le moment, l’accord, le style, le budget et votre préférence entre maison, vigneron ou dosage très faible. Le résultat expose les raisons du choix et propose trois alternatives proches.</p>
      <h3>4. Dater chaque offre</h3>
      <p>Le prix affiché correspond à la bouteille et au format présentés sur la fiche. Sa date de relevé apparaît près du bouton d’achat afin de distinguer l’analyse durable de l’offre commerciale du jour.</p>
      <h3>5. Séparer conseil et rémunération</h3>
      <p>Le marchand rémunère QuelChampagne lorsqu’un achat suit un lien partenaire. Cette rémunération ne modifie ni les critères du sélecteur ni l’ordre des recommandations.</p>
    </div>
  </div></section>`;
}

function aboutMain(){
  return `<section class="article"><div class="narrow">
    <div class="a-cat">À propos</div><h1 class="a-title">Choisir un champagne sans subir le classement d’un caviste</h1>
    <div class="prose">
      <p>QuelChampagne est un guide indépendant consacré au Champagne. Il aide à comparer les bouteilles selon leur style, les accords recherchés et le budget, sans confondre conseil éditorial et mise en avant commerciale.</p>
      <h3>Un produit construit autour des données</h3>
      <p>Chaque cuvée relie une maison, une sortie exacte, des faits officiels, un profil éditorial, des usages et, à terme, des offres datées. Cette structure permet de comparer des champagnes réellement comparables et de distinguer une cuvée permanente d’un millésime ou d’une édition numérotée.</p>
      <h3>Nos engagements</h3>
      <p>Sources identifiées, photographies autorisées, prix datés et classement indépendant : chaque information publiée doit être traçable et utile à la décision. La profondeur de la base et la qualité des liens entre les informations comptent davantage que le volume de pages.</p>
      <div style="margin-top:36px"><a class="btn btn-primary" href="/selecteur/">Essayer le sélecteur</a> <a class="btn btn-ghost" href="/notre-methode/">Lire notre méthode</a></div>
    </div>
  </div></section>`;
}

function partnersMain(){
  return `<section class="article"><div class="narrow">
    <div class="a-cat">Professionnels</div><h1 class="a-title">Présenter vos champagnes au bon moment du choix</h1>
    <p class="qhint">QuelChampagne transforme un catalogue marchand en fiches utiles, comparables et reliées à chaque offre exacte.</p>
    <div class="prose">
      <h3>Un clic précédé d’une analyse</h3>
      <p>Le visiteur précise le mode de service, le plat, le style recherché, son budget et le type de producteur qui l’intéresse. Il consulte ensuite une fiche complète avant d’accéder à l’offre du vendeur. La redirection intervient au terme d’un choix expliqué, pas depuis une simple galerie de produits.</p>
      <h3>Les données nécessaires</h3>
      <p>Une intégration fiable demande un flux produit autorisé comprenant le nom exact de la cuvée, le format, le millésime lorsqu’il existe, le prix, le stock, l’URL de vente et une photographie exploitable. Les fiches techniques officielles complètent ces données pour les cépages, le dosage et l’élaboration.</p>
      <h3>Ce que nous contrôlons</h3>
      <p>QuelChampagne rapproche chaque offre de la bonne bouteille, date les prix, vérifie la disponibilité et retire des moteurs de recherche les fiches qui ne disposent pas encore d’une documentation suffisante. Les mises en avant commerciales ne modifient pas l’ordre du sélecteur.</p>
      <h3>Travailler avec QuelChampagne</h3>
      <p>Nous étudions les catalogues de vendeurs livrant la France et capables de fournir des données actualisées, des liens suivis ou directs et les droits nécessaires sur les photographies produit. L’intégration commence par un échantillon contrôlé avant l’ouverture du catalogue complet.</p>
      <div style="margin-top:36px"><a class="btn btn-primary" href="mailto:timothe.cabinetdp@gmail.com?subject=Partenariat%20QuelChampagne">Proposer un partenariat</a> <a class="btn btn-ghost" href="/notre-methode/">Consulter notre méthode</a></div>
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
      <p>Le site est hébergé par <strong>Cloudflare, Inc.</strong>, 101 Townsend Street, San Francisco, CA 94107, États-Unis — www.cloudflare.com.</p>
      <h3>Contenu et propriété intellectuelle</h3>
      <p>Les textes, données structurées et visuels originaux de QuelChampagne ne peuvent pas être réutilisés sans autorisation. Les marques citées appartiennent à leurs titulaires respectifs. Leur citation sert uniquement à identifier les cuvées présentées.</p>
      <h3>Information et responsabilité</h3>
      <p>Les prix et disponibilités peuvent évoluer après leur date de vérification. Les informations techniques distinguent les éléments communiqués par le marchand ou le producteur de l’analyse QuelChampagne.</p>
      <h3>Affiliation</h3>
      <p>QuelChampagne participe au programme d’affiliation de Bottle of Italy par l’intermédiaire du réseau Webgains. Les liens concernés sont signalés à proximité du bouton et portent l’attribut <code>rel="sponsored"</code>. Avant la première redirection, l’utilisateur choisit entre le lien affilié suivi par Webgains et un accès direct au marchand sans suivi d’affiliation. Si un achat est réalisé après un lien suivi, QuelChampagne peut percevoir une commission, sans coût supplémentaire pour l’utilisateur. Cette rémunération ne modifie ni le contenu des analyses, ni le classement des recommandations. Les prix, disponibilités, conditions de vente et livraisons relèvent du marchand.</p>
    </div>
  </div></section>`;
}

function privacyMain(){
  return `<section class="article"><div class="narrow">
    <div class="a-cat">Données personnelles</div><h1 class="a-title">Politique de confidentialité</h1>
    <div class="prose">
      <h3>Données actuellement traitées</h3>
      <p>Le site statique n’intègre actuellement ni compte utilisateur, ni formulaire, ni newsletter. Les réponses détaillées au sélecteur restent dans le navigateur et ne sont pas rattachées à une identité.</p>
      <h3>Confirmation de majorité</h3>
      <p>Après confirmation, le navigateur enregistre localement la valeur technique <code>qc_age_ok</code> afin d’éviter de réafficher immédiatement la porte d’âge. Cette valeur ne contient pas l’âge, l’identité ou les réponses au sélecteur.</p>
      <h3>Mesure d’audience</h3>
      <p>Le code du site peut transmettre à une fonction du même domaine des événements techniques limités : lancement et fin du sélecteur, consultation d’une analyse, utilisation du comparateur et clic affilié accepté. Ces événements ne sont conservés que lorsqu’un dispositif de mesure est activé côté hébergement. Aucun nom, adresse électronique, réponse libre, identifiant publicitaire ou historique individuel n’est inclus dans ces événements.</p>
      <h3>Choix relatif aux liens affiliés</h3>
      <p>Le navigateur conserve localement la préférence <code>qc_affiliate_choice</code>. Le choix « suivi » autorise l’ouverture du lien Webgains ; le choix « sans suivi » ouvre directement la page du marchand. Cette préférence peut être modifiée depuis le pied de page. Les traceurs éventuellement déposés après l’ouverture du lien affilié relèvent des politiques de Webgains et du marchand.</p>
      <h3>Services tiers</h3>
      <p>Le site n’intègre ni régie publicitaire, ni police externe. Certaines photographies d’illustration sont servies par le réseau de diffusion d’Unsplash et les photographies des bouteilles par le réseau de diffusion utilisé par Bottle of Italy. Ces hébergeurs d’images peuvent recevoir des données techniques de connexion, notamment l’adresse IP et le type de navigateur, lors du chargement des visuels. Après acceptation du suivi, les liens d’achat passent par Webgains avant de rediriger vers Bottle of Italy ; le clic et une éventuelle commande sont alors traités selon les politiques de ces services. QuelChampagne ne reçoit pas les données de paiement ni le détail nominatif des commandes.</p>
      <h3>Vos droits et contact</h3>
      <p>Responsable du traitement : CORTEXIA (SAS), 59 rue de Ponthieu, 75008 Paris. Pour toute demande relative à vos données ou l’exercice de vos droits : timothe.cabinetdp@gmail.com. Vous pouvez également saisir la CNIL (www.cnil.fr).</p>
    </div>
  </div></section>`;
}

// Le sélecteur interactif : on réutilise index.html, mais on fait pointer les
// liens produit/article et la nav vers les pages statiques.
function selecteurHTML(){
  let h = HTML;
  const selectorStatic = `<main id="main-content">
    <section class="quiz"><div class="narrow">
      <div class="qlabel">Sélecteur QuelChampagne</div>
      <h1 class="qtitle">Trouvez votre champagne idéal en répondant à 5 questions</h1>
      <p class="qhint">Occasion, goût, budget : on vous recommande la bonne bouteille, avec l’analyse qui explique pourquoi. Sans pub, sans classement acheté.</p>
      <div class="qopts"><div class="qopt"><span class="qe">→</span><span><span class="ql">Trouver mon champagne</span><br><span class="qd">≈ 2 min · sans inscription · classement indépendant</span></span></div></div>
    </div></section>
    <section class="selector-guide" aria-labelledby="selector-static-title"><div class="container">
      <div class="selector-guide-head"><div class="eyebrow-l">Comment le choix est construit</div><h2 id="selector-static-title">Une recommandation fondée sur l’usage, le goût et l’offre disponible.</h2><p>Le sélecteur ne classe pas les maisons dans l’absolu. Il rapproche vos réponses des caractéristiques de chaque cuvée, puis conserve uniquement les bouteilles disponibles chez notre partenaire au moment du dernier relevé.</p></div>
      <div class="selector-guide-grid">
        <article><span>01</span><h3>Le service</h3><p>Servie seule, à table, pour plusieurs convives ou choisie pour être offerte.</p></article>
        <article><span>02</span><h3>L’accord</h3><p>Le plat ou le type de service détermine la structure à privilégier.</p></article>
        <article><span>03</span><h3>Le style</h3><p>Fraîcheur, fruit, ampleur ou finesse florale.</p></article>
        <article><span>04</span><h3>Le budget</h3><p>Le prix relevé pour la bouteille présentée, sans remise reconstituée.</p></article>
        <article><span>05</span><h3>La signature</h3><p>Maison, vigneron, dosage très faible ou sélection libre.</p></article>
      </div>
      <div class="selector-faq">
        <details><summary>Pourquoi plusieurs bouteilles sont-elles proposées ?</summary><p>La première est la combinaison la plus cohérente. Les alternatives permettent de comparer des options proches avant de choisir.</p></details>
        <details><summary>La commission modifie-t-elle le classement ?</summary><p>Non. La rémunération intervient seulement après un clic suivi d’un achat et ne modifie pas le calcul.</p></details>
        <details><summary>Les prix sont-ils à jour ?</summary><p>Chaque fiche indique la date du dernier relevé. Le vendeur confirme le montant final et la disponibilité.</p></details>
      </div>
    </div></section>
  </main>`;
  const selectorSchema = JSON.stringify({
    '@context':'https://schema.org',
    '@graph':[
      {'@type':'WebApplication',name:'Sélecteur QuelChampagne',url:BASE+'/selecteur/',applicationCategory:'LifestyleApplication',operatingSystem:'Web',inLanguage:'fr-FR',description:'Sélection de champagnes selon le moment, l’accord, le style, le budget et le type de producteur recherché.'},
      {'@type':'FAQPage',mainEntity:[
        {'@type':'Question',name:'Pourquoi plusieurs bouteilles sont-elles proposées ?',acceptedAnswer:{'@type':'Answer',text:'La première est la combinaison la plus cohérente. Les alternatives permettent de comparer des options proches avant de choisir.'}},
        {'@type':'Question',name:'La commission modifie-t-elle le classement ?',acceptedAnswer:{'@type':'Answer',text:'Non. La rémunération intervient seulement après un clic suivi d’un achat et ne modifie pas le calcul.'}},
        {'@type':'Question',name:'Les prix sont-ils à jour ?',acceptedAnswer:{'@type':'Answer',text:'Chaque fiche indique la date du dernier relevé. Le vendeur confirme le montant final et la disponibilité.'}}
      ]}
    ]
  }).replaceAll('<','\\u003c');
  h = h.replace('let CATALOGUE = null;', `let CATALOGUE = ${JSON.stringify(partnerProducts).replaceAll('<','\\u003c')};`);
  h = h.replace(/function FALLBACK_PRODUCTS\(\)\{[\s\S]*?\n\}\nfunction prod/, "function FALLBACK_PRODUCTS(){ return []; }\nfunction prod");
  h = h.replace(/const DETAILS = \{[\s\S]*?\n\};\nfunction detail/, "const DETAILS = {};\nfunction detail");
  h = h.replace(/const PUBLISHED_ARTICLE_IDS[\s\S]*?\nfunction art\(id\)\{ return articles\(\)\.find\(a=>a\.id===id\); \}/, "function articles(){ return []; }\nfunction art(){ return null; }");
  h = h.replace("function openProduct(id){ state.product=id; state.view='product'; render(); }", "function openProduct(id){ location.href='/champagne/'+id+'/'; }");
  h = h.replace("function openArticle(id){ state.article=id; state.view='article'; render(); }", "function openArticle(id){ location.href='/blog/'+id+'/'; }");
  h = h.replace('\nloadCatalogue();\nageGate();', '\n// Le catalogue partenaire contrôlé est déjà embarqué dans cette page.\nageGate();');
  h = h.replace("const state = { view:'home'", "const state = { view:'quiz'");
  h = h.replace('<title>QuelChampagne — Choisir un champagne selon vos critères</title>', '<title>Sélecteur de champagne — Une sélection en 5 choix | QuelChampagne</title>');
  h = h.replace('content="Comparez les champagnes selon le moment, le repas, vos goûts et votre budget. Cinq choix donnent accès à une sélection expliquée et à des fiches détaillées."', 'content="Comparez les bouteilles disponibles selon le moment, l’accord, vos goûts, le budget et le type de producteur recherché."');
  h = h.replace('content="QuelChampagne — Choisir un champagne selon vos critères"', 'content="Sélecteur de champagne — Une sélection en 5 choix | QuelChampagne"');
  h = h.replace('content="Cinq choix pour comparer les champagnes selon le moment, le repas, vos goûts et votre budget."', 'content="Cinq critères concrets pour comparer les bouteilles disponibles et comprendre chaque recommandation."');
  h = h.replace('content="https://quelchampagne.fr"', 'content="https://quelchampagne.fr/selecteur/"');
  h = h.replace('<div id="app"></div>', `<div id="app">${selectorStatic}</div>`);
  h = h.replace('</head>', `<script type="application/ld+json">${selectorSchema}</script>\n</head>`);
  // canonical
  h = h.replace('<link rel="canonical" href="https://quelchampagne.fr">', '<link rel="canonical" href="https://quelchampagne.fr/selecteur/">');
  h = removeLegacyProductLinks(h);
  return h;
}

// ---------- écriture ----------
try { rmSync('dist', { recursive:true, force:true }); } catch(e) { /* dossier absent ou verrouillé : sans importance */ }
cpSync('assets', 'dist/assets', { recursive:true });
cpSync('expert-engine.mjs', 'dist/assets/expert-engine.js');
function write(path, content){
  const full = 'dist/' + path;
  mkdirSync(full.split('/').slice(0,-1).join('/'), { recursive:true });
  writeFileSync(full, content, 'utf8');
}

const urls = [];
function add(loc, prio, freq){ urls.push({loc, prio, freq}); }

// home
write('index.html', page({ title:'Quel champagne choisir ? Le guide indépendant | QuelChampagne', desc:'Comparez les champagnes selon leur style, les accords recherchés et votre budget. Le sélecteur présente des bouteilles disponibles et explique chaque recommandation.', canonical:BASE+'/', active:'home', main:homeMain() }));
add(BASE+'/', '1.0', 'weekly');

// selecteur
write('selecteur/index.html', selecteurHTML());
add(BASE+'/selecteur/', '0.8', 'monthly');

// moteur expert autonome : profils multidimensionnels et recommandations explicables
write('expert/index.html', page({
  title:'Sélecteur expert de champagne — Recommandations personnalisées | QuelChampagne',
  desc:'Décrivez le moment, l’accord, le style et le budget recherchés. Le moteur expert compare les cuvées disponibles sur douze dimensions et explique chaque choix.',
  canonical:BASE+'/expert/',
  active:'expert',
  main:expertMain(expertKnowledgeBase),
  graph:[{'@type':'WebApplication',name:'Sélecteur expert QuelChampagne',url:BASE+'/expert/',applicationCategory:'LifestyleApplication',operatingSystem:'Web',inLanguage:'fr-FR',description:'Moteur de recommandation de champagne fondé sur douze dimensions de style, les usages et les contraintes de budget.'}]
}));
add(BASE+'/expert/', '0.9', 'weekly');

// champagnes list
write('champagnes/index.html', page({ title:`Quel champagne choisir ? Notre sélection de ${partnerProducts.length} champagnes | QuelChampagne`, desc:`Analysez ${partnerProducts.length} champagnes disponibles chez notre partenaire : style, cépages, dosage, service et accords avant de consulter l’offre.`, canonical:BASE+'/champagnes/', active:'shop', main:boutiqueMain(partnerProducts) }));
add(BASE+'/champagnes/', '0.9', 'weekly');

// comparateur interactif
write('comparateur/index.html', page({ title:'Comparateur de champagnes — Comparez jusqu’à 4 cuvées | QuelChampagne', desc:'Comparez jusqu’à quatre champagnes selon leur prix, leur style, leur dosage, leurs cépages et leurs accords.', canonical:BASE+'/comparateur/', active:'compare', main:comparateurMain() }));
add(BASE+'/comparateur/', '0.9', 'weekly');

write('notre-methode/index.html', page({ title:'Notre méthode — Sources, indépendance et prix | QuelChampagne', desc:'Découvrez comment QuelChampagne vérifie les faits, construit ses recommandations et sépare les données produit des offres marchandes.', canonical:BASE+'/notre-methode/', active:'method', main:methodMain() }));
add(BASE+'/notre-methode/', '0.7', 'monthly');

write('a-propos/index.html', page({ title:'À propos de QuelChampagne — Le conseiller indépendant', desc:'QuelChampagne aide à choisir une cuvée selon le moment, le style et le budget, à partir de données produit contrôlées et d’analyses structurées.', canonical:BASE+'/a-propos/', active:'about', main:aboutMain() }));
add(BASE+'/a-propos/', '0.6', 'monthly');

write('partenaires/index.html', page({ title:'Professionnels — Proposer un catalogue à QuelChampagne', desc:'Découvrez les conditions d’intégration d’un catalogue marchand dans les analyses et le sélecteur QuelChampagne.', canonical:BASE+'/partenaires/', active:'', main:partnersMain() }));
add(BASE+'/partenaires/', '0.4', 'monthly');

write('mentions-legales/index.html', page({ title:'Mentions légales — QuelChampagne', desc:'Informations sur l’éditeur, l’hébergement, les contenus et l’affiliation du site QuelChampagne.', canonical:BASE+'/mentions-legales/', active:'', main:legalMain() }));
add(BASE+'/mentions-legales/', '0.3', 'yearly');

write('confidentialite/index.html', page({ title:'Politique de confidentialité — QuelChampagne', desc:'Traitement des données, stockage local de la confirmation de majorité et services tiers utilisés par QuelChampagne.', canonical:BASE+'/confidentialite/', active:'', main:privacyMain() }));
add(BASE+'/confidentialite/', '0.3', 'yearly');

// Fiches d'analyse des champagnes disponibles chez le partenaire.
for(const p of allPartnerProducts){
  const slug = p.id;
  const analysis = boutiqueAnalysisDescription(p);
  const enrichment=p.details?.enrichment||{};
  const indexable = (enrichment.facts||[]).length>=12 && !String(p.identityStatus||'').includes('rejected');
  const additionalProperty=(enrichment.facts||[]).map(([name,value])=>({'@type':'PropertyValue',name,value}));
  const faq=(enrichment.answers||[]).map(([name,text])=>({'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}}));
  write(`champagne/${slug}/index.html`, page({
    title:`${p.brand} ${p.name} — Analyse et accords | QuelChampagne`,
    desc:analysis,
    canonical:`${BASE}/champagne/${slug}/`,
    ogImage:p.image,
    active:'shop',
    noindex:!indexable,
    main:boutiqueProductMain(p, BUILD_DATE, partnerProducts),
    graph:[
      {'@type':'Product',name:`${p.brand} ${p.name}`,brand:{'@type':'Brand',name:p.brand},category:'Champagne',description:analysis,image:p.image,additionalProperty,offers:{'@type':'Offer',price:p.price,priceCurrency:'EUR',url:p.merchantSourceUrl||p.productUrl,availability:p.availability==='in_stock'?'https://schema.org/InStock':'https://schema.org/OutOfStock',itemCondition:'https://schema.org/NewCondition',seller:{'@type':'Organization',name:'Bottle of Italy'}}},
      {'@type':'FAQPage',mainEntity:faq},
      crumbs([{name:'Accueil',url:BASE+'/'},{name:'La sélection',url:BASE+'/champagnes/'},{name:`${p.brand} ${p.name}`,url:`${BASE}/champagne/${slug}/`}])
    ]
  }));
  if(indexable) add(`${BASE}/champagne/${slug}/`, '0.8', 'weekly');
}

// pages SEO par occasion et style
for(const landing of SEO_LANDINGS){
  write(`champagne/${landing.id}/index.html`, page({ title:`${landing.title} | QuelChampagne`, desc:landing.desc, canonical:`${BASE}/champagne/${landing.id}/`, active:'shop', main:landingMain(landing) }));
  add(`${BASE}/champagne/${landing.id}/`, '0.9', 'weekly');
}

// blog list
write('blog/index.html', page({ title:'Blog champagne : guides, accords et conseils | QuelChampagne', desc:'Guides, décryptages et sélections pour bien choisir, accorder et servir le champagne.', canonical:BASE+'/blog/', active:'blog', main:blogMain() }));
add(BASE+'/blog/', '0.9', 'weekly');

// article pages
for(const a of articles().filter(a=>!a.soon)){
  write(`blog/${a.id}/index.html`, page({ title:`${a.title} | QuelChampagne`, desc:clip(a.excerpt,155), canonical:`${BASE}/blog/${a.id}/`, active:'blog', main:articleMain(a), graph:[
    {'@type':'Article', headline:a.title, description:a.excerpt, articleSection:a.cat, inLanguage:'fr-FR', image:(blogPhoto(a,1200)||OG), datePublished:'2026-07-01', dateModified:BUILD_DATE, author:{'@id':BASE+'/#org'}, publisher:{'@id':BASE+'/#org'}, mainEntityOfPage:`${BASE}/blog/${a.id}/`},
    crumbs([{name:'Accueil',url:BASE+'/'},{name:'Blog',url:BASE+'/blog/'},{name:a.title,url:`${BASE}/blog/${a.id}/`}])
  ] }));
  add(`${BASE}/blog/${a.id}/`, '0.7', 'monthly');
}

// page 404 habillée (Cloudflare Pages sert /404.html avec un vrai statut 404)
const notFoundMain = () => `<section class="section" style="text-align:center; padding:clamp(70px,12vw,140px) 0">
  <div class="container" style="max-width:640px">
    <div class="sec-head"><h1 class="h2">Page introuvable</h1><p>Cette page n'existe pas ou a été retirée. Le champagne, lui, est toujours là.</p></div>
    <div class="hero-cta" style="justify-content:center; margin-top:30px"><a class="btn btn-primary btn-lg" href="/selecteur/">Trouver mon champagne</a><a class="chev" href="/champagnes/">Voir la sélection</a></div>
  </div></section>`;
write('404.html', page({ title:'Page introuvable — QuelChampagne', desc:'La page demandée est introuvable. Retrouvez le sélecteur et la sélection de champagnes de QuelChampagne.', canonical:BASE+'/404', active:'', noindex:true, main:notFoundMain() }));

// sitemap + robots
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u=>`  <url><loc>${u.loc}</loc><lastmod>${BUILD_DATE}</lastmod><changefreq>${u.freq}</changefreq><priority>${u.prio}</priority></url>`).join('\n')}
</urlset>`;
write('sitemap.xml', sitemap);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`);
write('catalogue.json', `${JSON.stringify(partnerProducts, null, 2)}\n`);
write('data/champagne-knowledge-base.json', `${JSON.stringify(expertKnowledgeBase, null, 2)}\n`);

// Cloudflare Pages : préserver les anciennes URL sans republier les fiches.
const partnerIds=new Set(allPartnerProducts.map(product=>product.id));
const legacyRedirects=products()
  .filter(product=>!partnerIds.has(product.id) && product.region==='Champagne')
  .map(product=>`/champagne/${product.id}/ /champagnes/ 301`);
const comparisonRedirects=[
  '/comparatifs/ /comparateur/ 301',
  ...COMPARISONS.map(comparison=>`/comparatifs/${comparison.id}/ /comparateur/ 301`)
];
write('_redirects', `${[...legacyRedirects,...comparisonRedirects].join('\n')}\n`);

console.log(`✅ Site statique généré dans dist/`);
console.log(`   ${allPartnerProducts.length} fiches d’analyse · ${partnerProducts.length} offres disponibles · ${articles().filter(a=>!a.soon).length} articles · ${urls.length} URLs au sitemap`);
