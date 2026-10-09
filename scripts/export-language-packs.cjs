const fs=require('node:fs');
const ts=require('typescript');
let resources;
const mock={use(){return this;},init(options){resources=options.resources;return Promise.resolve();},on(){}};
const source=ts.transpileModule(fs.readFileSync('src/i18n.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
new Function('require','exports','module','localStorage','document',source)(name=>name==='i18next'?mock:name==='react-i18next'?{initReactI18next:{}}:require(name),{}, {exports:{}},{getItem(){return 'en';},setItem(){}},{documentElement:{}});
fs.mkdirSync('backend/locales',{recursive:true});
const candidates=JSON.parse(fs.readFileSync('tests/localization/inventory.json','utf8'));
const normalize=s=>s.replace(/\s+/g,' ').trim().toLowerCase();
const existing=new Map(Object.entries(resources.en.translation).map(([key,text])=>[normalize(text),resources.ml.translation[key]]));
for(const language of ['en','ml']) {
 const pack={...resources[language].translation};
 for(const {text} of candidates) {
  if(language==='en') pack['ui.'+text]=text;
  else if(existing.get(normalize(text))) pack['ui.'+text]=existing.get(normalize(text));
 }
 fs.writeFileSync(`backend/locales/${language}.json`,JSON.stringify(pack,null,2)+'\n');
}
console.log('Exported existing translations into English and Malayalam backend packs.');
