import {KnowledgeStore} from '../src/store.mjs';
import {AXES} from '../src/model.mjs';
const store=await KnowledgeStore.fromFile();const errors=store.validate();
if(store.size<1)errors.push({id:'base',message:'base vide'});
if(Object.keys(AXES).length!==12)errors.push({id:'axes',message:'12 axes attendus'});
if(errors.length){console.error(errors.map(error=>`${error.id}: ${error.message}`).join('\n'));process.exit(1);}
console.log(`Base valide : ${store.size} références · ${Object.keys(AXES).length} axes.`);
