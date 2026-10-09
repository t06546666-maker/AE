const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
let changed=0;
function visitDirectory(dir) {
 for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
  const file=path.join(dir,entry.name);
  if(entry.isDirectory()){visitDirectory(file);continue;}
  if(!file.endsWith('.tsx')) continue;
  const text=fs.readFileSync(file,'utf8');
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const edits=[];
  function alreadyTranslated(node) {
    for(let parent=node.parent;parent;parent=parent.parent) {
      if(ts.isCallExpression(parent) && ['t','uiText'].includes(parent.expression.getText(source))) return true;
      if(ts.isJsxAttribute(parent)) return !['placeholder','title','aria-label','alt'].includes(parent.name.getText(source));
      if(ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent)) break;
    }
    return false;
  }
  function translated(value) { return /[A-Za-z]{2}/.test(value) && !value.startsWith('/') && !value.includes('https://') && !/^#[a-f0-9]+$/i.test(value) && !/^[a-z]+\.[a-zA-Z]+$/.test(value); }
  function walk(node) {
   if(alreadyTranslated(node)) return;
   if(ts.isJsxText(node) && translated(node.text.trim())) {
     edits.push({start:node.getFullStart(),end:node.end,value:`{uiText(${JSON.stringify(node.text.replace(/\s+/g,' '))})}`});return;
   }
   if(ts.isJsxAttribute(node) && ['placeholder','title','aria-label','alt'].includes(node.name.getText(source)) && node.initializer && ts.isStringLiteral(node.initializer) && translated(node.initializer.text)) {
     edits.push({start:node.initializer.getStart(source),end:node.initializer.end,value:`{uiText(${JSON.stringify(node.initializer.text)})}`});return;
   }
   if(ts.isStringLiteral(node) && translated(node.text) && (ts.isJsxExpression(node.parent) || ts.isConditionalExpression(node.parent))) {
     edits.push({start:node.getStart(source),end:node.end,value:`uiText(${JSON.stringify(node.text)})`});return;
   }
   if(ts.isJsxExpression(node) && node.expression && (ts.isIdentifier(node.expression) && ['label','dailyGreeting'].includes(node.expression.text) || ts.isPropertyAccessExpression(node.expression) && node.expression.name.text==='label')) {
     const exp=node.expression;edits.push({start:exp.getStart(source),end:exp.end,value:`uiText(${exp.getText(source)})`});return;
   }
   ts.forEachChild(node,walk);
  }
  walk(source);
  if(!edits.length) continue;
  let output=text;
  for(const edit of edits.sort((a,b)=>b.start-a.start)) output=output.slice(0,edit.start)+edit.value+output.slice(edit.end);
  if(!/^import .*uiText.* from /m.test(output)) {
    const relative=path.relative(path.dirname(file),'src/uiText').replaceAll('\\','/');
    output=`import { uiText } from '${relative.startsWith('.')?relative:'./'+relative}';\n`+output;
  }
  fs.writeFileSync(file,output);changed++;
 }
}
visitDirectory('src/pages');visitDirectory('src/components');
console.log(`Connected interface copy to language packs in ${changed} files.`);
