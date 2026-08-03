const GRAPE_PATTERNS = [
  ['Meunier', '(?:pinot\\s+meunier|meunier)'],
  ['Pinot Noir', '(?:pinot\\s+noir|pinot\\s+nero)'],
  ['Chardonnay', 'chardonnay'],
  ['Pinot Blanc', '(?:pinot\\s+blanc|pinot\\s+bianco|blanc\\s+vrai)'],
  ['Arbane', '(?:arbane|arbanne)'],
  ['Petit Meslier', 'petit\\s+meslier']
];

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const cap = value => value ? value.charAt(0).toUpperCase() + value.slice(1) : '';

function list(values){
  const items=[...new Set(values.filter(Boolean))];
  if(items.length<2) return items[0] || '';
  return `${items.slice(0,-1).join(', ')} et ${items.at(-1)}`;
}

function findBlend(text){
  const values=[];
  for(const [label,pattern] of GRAPE_PATTERNS){
    const after=text.match(new RegExp(`(\\d{1,3}(?:[,.]\\d+)?)\\s*%\\s*(?:de\\s+|d['’])?${pattern}`,'i'));
    const before=text.match(new RegExp(`${pattern}[^.%]{0,24}?(\\d{1,3}(?:[,.]\\d+)?)\\s*%`,'i'));
    const match=after || before;
    if(match) values.push({grape:label,value:Number(match[1].replace(',','.'))});
  }
  const total=values.reduce((sum,item)=>sum+item.value,0);
  if(values.length>=2 && total>=90 && total<=105) return values;
  if(values.length===1 && values[0].value===100) return values;
  return [];
}

function findAlcohol(tags=[],technical={}){
  if(technical.Gradation) return clean(technical.Gradation).replace(/\s*%?$/,' % vol.');
  const raw=tags.find(tag=>/^custom-gradazione-/i.test(tag));
  if(!raw) return null;
  const number=raw.replace(/^custom-gradazione-/i,'').replace(/-/g,'.');
  return /^\d{1,2}(?:\.\d+)?$/.test(number) ? `${Number(number).toLocaleString('fr-FR')} % vol.` : null;
}

function findTemperature(text, tags, price, technical={}){
  if(technical['Température de service']) return clean(technical['Température de service']).replace(/(\d)\s*-\s*(\d)/,'$1–$2').replace(/°?\s*C?$/i,' °C');
  const range=text.match(/(?:temp[ée]rature|serv(?:ir|i|ie)|service)[^.!?]{0,55}?(\d{1,2})\s*(?:°\s*)?(?:c)?\s*(?:à|et|[-–])\s*(\d{1,2})\s*°?\s*c/i);
  if(range) return `${range[1]}–${range[2]} °C`;
  if(tags.includes('Millésimé') || price>=100) return '10–12 °C';
  if(tags.includes('Blanc de blancs') || tags.includes('Extra-brut / nature')) return '8–10 °C';
  return '8–10 °C';
}

function findAging(text, vintage, technical={}){
  if(technical.Vieillissement) return clean(technical.Vieillissement);
  const direct=text.match(/(?:maturation|vieillissement|affinage|[ée]levage)[^.!?]{0,65}?(\d+)\s*(?:à|et|[-–])?\s*(\d+)?\s*(mois|ans?|ann[ée]es?)[^.!?]{0,35}?(?:lies|levures|bouteille|f[ûu]ts?|ch[êe]ne)/i);
  if(direct){
    const unit=/mois/i.test(direct[3])?'mois':'ans';
    return direct[2] ? `${direct[1]} à ${direct[2]} ${unit}` : `${direct[1]} ${unit}`;
  }
  const simple=text.match(/(?:pendant|durant|minimum|au moins)\s+(\d+)\s*(mois|ans?|ann[ée]es?)[^.!?]{0,35}?(?:lies|levures|bouteille)/i);
  if(simple) return `${simple[1]} ${/mois/i.test(simple[2])?'mois':'ans'}`;
  return vintage ? '36 mois minimum en cave' : '15 mois minimum en cave';
}

function dosage(tags, exact){
  if(exact) return {label:exact,sweetness:/0\s*g|nature|z[ée]ro/i.test(exact)?'Très sec':/extra/i.test(exact)?'Très sec':'Sec'};
  if(tags.includes('Demi-sec')) return {label:'32 à 50 g/L',sweetness:'Doux'};
  if(tags.includes('Extra-brut / nature')){
    const nature=tags.some(tag=>/nature|z[ée]ro/i.test(tag));
    return nature ? {label:'Moins de 3 g/L, sans ajout de sucre',sweetness:'Très sec'} : {label:'0 à 6 g/L',sweetness:'Très sec'};
  }
  return {label:'Moins de 12 g/L',sweetness:'Sec'};
}

function vessels(text){
  const values=[];
  if(/(?:cuve|acier)\s*(?:en\s+)?inox|acier inoxydable/i.test(text)) values.push('Cuves inox');
  if(/f[ûu]ts?\s+(?:de\s+)?ch[êe]ne|sous bois|barrique/i.test(text)) values.push('Passage sous bois');
  return values;
}

function bodyLabel(scores){
  if(scores.power>=4 && scores.roundness>=4) return 'Ample et structuré';
  if(scores.freshness>=4 && scores.power<=3) return 'Vif et précis';
  if(scores.roundness>=4) return 'Rond et généreux';
  if(scores.complexity>=4) return 'Nuancé et persistant';
  return 'Équilibré';
}

function typeLabel(tags){
  const parts=[];
  if(tags.includes('Rosé')) parts.push('Champagne rosé');
  else if(tags.includes('Blanc de blancs')) parts.push('Blanc de blancs');
  else if(tags.includes('Blanc de noirs')) parts.push('Blanc de noirs');
  else parts.push('Champagne blanc');
  if(tags.includes('Extra-brut / nature')) parts.push('extra-brut ou brut nature');
  else if(tags.includes('Demi-sec')) parts.push('demi-sec');
  else parts.push('brut');
  if(tags.includes('Grand Cru')) parts.push('Grand Cru');
  else if(tags.includes('Premier Cru')) parts.push('Premier Cru');
  if(tags.includes('Millésimé')) parts.push('millésimé');
  return parts.join(' · ');
}

function serviceGlass(tags, scores){
  if(tags.includes('Millésimé') || scores.complexity>=4 || scores.power>=4) return 'Verre tulipe ou verre à vin blanc';
  return 'Verre tulipe';
}

export function enrichProduct({product,tags,grapes,aromas,pairings,scores,evidence,publicName,price,producerType}){
  const technical=product.technicalData || {};
  const description=clean(`${product.merchantDescription || ''} ${Object.values(technical).join(' ')} ${evidence.facts || ''}`);
  const blend=findBlend(description);
  const blendLabel=blend.length
    ? blend.map(item=>`${item.value.toLocaleString('fr-FR')} % ${item.grape}`).join(' · ')
    : list(grapes);
  const vintage=tags.includes('Millésimé') || /\b(?:19|20)\d{2}\b/.test(publicName);
  const exactDosage=evidence.dosage || technical['Sucres résiduels'] || null;
  const dose=dosage(tags,exactDosage);
  const temperature=findTemperature(description,tags,price,technical);
  const aging=findAging(description,vintage,technical);
  const maturationVessels=vessels(description);
  const type=typeLabel(tags);
  const character=bodyLabel(scores);
  const aromaFallback=tags.includes('Rosé')
    ? ['fruits rouges','agrumes','notes florales']
    : tags.includes('Blanc de blancs')
      ? ['agrumes','fleurs blanches','notes minérales']
      : ['fruits blancs','agrumes','brioche'];
  const aromaList=[...new Set([...aromas,...aromaFallback])].slice(0,6);
  const aromaLabel=list(aromaList) || (tags.includes('Rosé')?'fruits rouges et notes florales':tags.includes('Blanc de blancs')?'agrumes, fleurs blanches et notes minérales':'fruits blancs, agrumes et brioche');
  const pairingFallback=tags.includes('Rosé')
    ? ['saumon','volaille','dessert aux fruits rouges']
    : tags.includes('Blanc de blancs') || tags.includes('Extra-brut / nature')
      ? ['huîtres','crustacés','poisson']
      : ['poisson','volaille','fromage à pâte dure'];
  const pairingLabels=[...new Set([...pairings.map(item=>item.label),...pairingFallback])].slice(0,5).map(item=>cap(item));
  const pairLabel=list(pairingLabels) || 'Poisson, crustacés et entrées légères';
  const merchantMethod=technical['Méthode de vinification'];
  const method=[merchantMethod || 'Méthode traditionnelle','Seconde fermentation en bouteille',technical['Type de fût'],...maturationVessels].filter(Boolean).filter((value,index,array)=>array.indexOf(value)===index).join(' · ');
  const color=technical.Couleur || (tags.includes('Rosé') ? 'Rosé lumineux' : /dor[ée]|giallo dorato|golden/i.test(description) ? 'Jaune doré' : 'Jaune pâle à reflets dorés');
  const bubbles=/fine?s? et persistante?s?|perlage fin/i.test(description)?'fine et persistante':'fine';
  const alcohol=findAlcohol(product.merchantTags,technical);
  const glass=serviceGlass(tags,scores);
  const eye=`${color}, avec une effervescence ${bubbles}.`;
  const nose=`Le nez associe ${aromaLabel}.`;
  const mouth=scores.power>=4
    ? `La bouche est ${scores.roundness>=4?'ample et généreuse':'droite et structurée'}, portée par une fraîcheur ${scores.freshness>=4?'marquée':'équilibrée'}.`
    : scores.freshness>=4
      ? `La bouche est vive et précise, avec une matière ${scores.roundness>=4?'souple':'élancée'} et une effervescence fine.`
      : `La bouche est équilibrée, ${scores.roundness>=4?'ronde et enveloppante':'souple et lisible'}, sans lourdeur.`;
  const finish=scores.complexity>=4
    ? `La finale est longue, avec un retour sur ${list(aromaList.slice(-2)) || 'les notes fruitées et minérales'}.`
    : scores.freshness>=4
      ? 'La finale est nette, fraîche et légèrement saline.'
      : 'La finale est harmonieuse et persistante.';
  const overview=`${type}. ${character}. ${blendLabel?`Assemblage : ${blendLabel}. `:''}Le registre aromatique réunit ${aromaLabel}.`;
  const vinification=`Élaboré selon la méthode traditionnelle, avec une seconde fermentation en bouteille et ${aging.toLowerCase()}${maturationVessels.length?`. ${maturationVessels.join(' et ')}.`:'.'}`;
  const serving=`Servir à ${temperature} dans un ${glass.toLowerCase()}. Les accords les plus naturels sont ${pairLabel.toLowerCase()}.`;

  return {
    type,character,blend,blendLabel,dosage:dose.label,sweetness:dose.sweetness,
    alcohol,format:technical.Format || '75 cl',appellation:'Champagne AOC',region:'Champagne · France',
    temperature,aging,method,color,bubbles,glass,
    aromas:aromaList,pairings:pairingLabels,
    eye,nose,mouth,finish,overview,vinification,serving,
    facts:[
      ['Producteur',evidence.publicBrand || product.brand],
      ['Cuvée',publicName],
      ['Type',type],
      ['Cépages',blendLabel || list(grapes)],
      ['Dosage',dose.label],
      ['Degré',alcohol],
      ['Format',technical.Format || '75 cl'],
      ['Appellation','Champagne AOC'],
      ['Élaboration',method],
      ['Maturation',aging],
      ['Robe',color],
      ['Profil aromatique',aromaLabel],
      ['Accords conseillés',pairLabel],
      ['Température',temperature],
      ['Verre conseillé',glass]
    ].filter(([,value])=>Boolean(value)),
    answers:[
      ['Avec quels plats l’associer ?',pairLabel],
      ['Est-il sec ou plus doux ?',`${dose.sweetness} · ${dose.label}`],
      ['À quelle température le servir ?',temperature],
      ['Dans quel verre ?',glass],
      ['Quel est son style ?',`${character} · ${aromaLabel}`],
      ['Combien de temps a-t-il mûri ?',aging],
      ['De quels cépages est-il composé ?',blendLabel || list(grapes)],
      ['Qui l’élabore ?',producerType==='vigneron'?'Un vigneron indépendant':'Une maison de Champagne']
    ]
  };
}
