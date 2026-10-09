const fs=require('node:fs');
const en=JSON.parse(fs.readFileSync('backend/locales/en.json','utf8'));
const ml=JSON.parse(fs.readFileSync('backend/locales/ml.json','utf8'));
for(const file of fs.readdirSync('backend/locales').filter(f=>f.startsWith('ml-interface')&&f.endsWith('.json'))) {
 const additions=JSON.parse(fs.readFileSync('backend/locales/'+file,'utf8'));
 for(const [source,translation] of Object.entries(additions)) {en['ui.'+source]=source;ml['ui.'+source]=translation;}
}
fs.writeFileSync('backend/locales/en.json',JSON.stringify(en,null,2)+'\n');
fs.writeFileSync('backend/locales/ml.json',JSON.stringify(ml,null,2)+'\n');
console.log(`Language packs: ${Object.keys(en).length} English entries; ${Object.keys(ml).length} Malayalam entries.`);
