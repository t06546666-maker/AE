const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const english=require('../backend/locales/en.json'),malayalam=require('../backend/locales/ml.json');
const strings=new Set();
function scan(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,entry.name);if(entry.isDirectory()){scan(f);continue;}if(!f.endsWith('.tsx'))continue;const ast=ts.createSourceFile(f,fs.readFileSync(f,'utf8'),99,true,4);function walk(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==='uiText'&&ts.isStringLiteral(n.arguments[0]))strings.add(n.arguments[0].text.replace(/\s+/g,' ').trim());ts.forEachChild(n,walk);}walk(ast);}}
scan('src');
const missing=[...strings].filter(s=>!malayalam['ui.'+s]).sort();
fs.mkdirSync('tests/localization',{recursive:true});fs.writeFileSync('tests/localization/missing.json',JSON.stringify(missing,null,2));
console.log(`Interface phrases: ${strings.size}. Malayalam phrases remaining: ${missing.length}.`);
console.log(missing.slice(0,Number(process.argv[2]||220)).join('\n'));
