const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),base=require('i18next');
const en=require('../../backend/locales/en.json'),ml=require('../../backend/locales/ml.json');
const storage=new Map([['ae_language','en'],['ae-language-pack-v1-ml',JSON.stringify({'ui.How we use AE?':'How we use AE?'})]]);
const i18n=base.createInstance();const document={hidden:false,documentElement:{lang:'en'},addEventListener(){}};
const scope={exports:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document,window:{location:{hostname:'localhost'},setInterval(){return 0;}},fetch:async url=>({ok:true,json:async()=>({locale:String(url).endsWith('/ml')?'ml':'en',schemaVersion:1,translations:{'ui.How we use AE?':'How we use AE?'}})}),AbortSignal,Map};
const envCode=fs.readFileSync('src/i18n.ts','utf8').replaceAll('import.meta.env','({})');
scope.require=name=>name==='i18next'?{default:i18n}:name==='react-i18next'?{initReactI18next:{type:'3rdParty',init(){}}}:name==='@capacitor/core'?{Capacitor:{isNativePlatform:()=>false}}:name.endsWith('/en.json')?{default:en}:{default:ml};
vm.runInNewContext(ts.transpileModule(envCode,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,scope);
const helper={exports:{},require:()=>({default:i18n})};vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/uiText.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,helper);
async function run(){await i18n.changeLanguage('ml');await scope.exports.refreshLanguagePack('ml');
for(const phrase of ['How we use AE?','Set Pickup Time','In 1 hour','Counter Staff Login','Owner checkout rules','Checkout confirmed','Return for correction','Cancel claim','Nearby Best Offers','Daily merchant reminders']){assert.match(helper.exports.uiText(phrase),/[\u0d00-\u0d7f]/,phrase);}
assert.equal(document.documentElement.lang,'ml');assert.equal(storage.get('ae_language'),'ml');assert.equal(helper.exports.uiText('Demo Store'),'Demo Store');assert.match(helper.exports.uiText('This shop requires a bill of at least ₹100 for redemption.'),/₹100/);
for(const[key,value]of Object.entries(ml)){const source=en[key];if(!source)continue;assert.deepEqual((value.match(/\{\{[^}]+\}\}/g)||[]).sort(),(source.match(/\{\{[^}]+\}\}/g)||[]).sort(),'Placeholder mismatch: '+key);}
await i18n.changeLanguage('en');for(const phrase of ['Counter Staff Login','Set Pickup Time','How we use AE?'])assert.equal(helper.exports.uiText(phrase),phrase);assert.equal(storage.get('ae_language'),'en');assert.equal(document.documentElement.lang,'en');
console.log('PASS: real English/Malayalam switching, saved preference, document language, offline bundle, stale English pack protection, checkout interpolation, identity preservation and translation placeholders');}
run().catch(e=>{console.error(e);process.exitCode=1;});
