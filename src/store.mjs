import {readFile} from 'node:fs/promises';
import {validateRecord} from './model.mjs';

export class KnowledgeStore{
  constructor(records=[]){this.records=new Map(records.map(record=>[record.id,record]));}
  static async fromFile(path=new URL('../data/knowledge-base.json',import.meta.url)){
    const payload=JSON.parse(await readFile(path,'utf8'));
    return new KnowledgeStore(payload.records||[]);
  }
  get size(){return this.records.size;}
  get(id){return this.records.get(id)||null;}
  all(){return [...this.records.values()];}
  search({q,producer,vintage,available,limit=25}={}){
    const needle=String(q||'').toLocaleLowerCase('fr');
    return this.all().filter(record=>{
      const text=`${record.identity.producer} ${record.identity.cuvee}`.toLocaleLowerCase('fr');
      return (!needle||text.includes(needle))&&(!producer||record.identity.producer===producer)&&
        (vintage===undefined||String(record.identity.vintage||'NV')===String(vintage))&&
        (available===undefined||record.commerce?.available===available);
    }).slice(0,Math.min(100,Math.max(1,limit)));
  }
  validate(){return this.all().flatMap(record=>validateRecord(record).map(message=>({id:record.id,message})));}
}
