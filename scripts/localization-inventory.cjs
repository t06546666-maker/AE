const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const found = new Map();
function add(value,file) {
 const text = value.replace(/\s+/g,' ').trim();
 if (!/[A-Za-z]{2}/.test(text) || text.startsWith('/') || text.includes('https://') || text.includes('@') || text.length>240) return;
 if (!found.has(text)) found.set(text,new Set());
 found.get(text).add(file);
}
function scan(dir) {
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()) {scan(file);continue;}
  if(!file.endsWith('.tsx')) continue;
  const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function visit(node) {
   if(ts.isJsxText(node)) add(node.text,file);
   if(ts.isJsxAttribute(node) && ['placeholder','title','aria-label','alt'].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer)) add(node.initializer.text,file);
   if(ts.isStringLiteral(node) && node.parent && (ts.isJsxExpression(node.parent) || ts.isConditionalExpression(node.parent))) add(node.text,file);
   ts.forEachChild(node,visit);
  }
  visit(source);
 }
}
scan('src/pages');scan('src/components');
const entries=[...found].map(([text,files])=>({text,files:[...files]})).sort((a,b)=>a.text.localeCompare(b.text));
fs.mkdirSync('tests/localization',{recursive:true});
fs.writeFileSync('tests/localization/inventory.json',JSON.stringify(entries,null,2));
console.log(JSON.stringify({total:entries.length,strings:entries.map(x=>x.text).slice(0,110)},null,2));
