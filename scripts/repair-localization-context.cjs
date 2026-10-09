const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
function renderedCopy(node) {
 let inExpression=false;
 for(let p=node.parent;p;p=p.parent){
  if(ts.isVariableDeclaration(p)) return false;
  if(ts.isJsxAttribute(p)) return ['placeholder','title','aria-label','alt'].includes(p.name.getText());
  if(ts.isJsxExpression(p)) inExpression=true;
  if(ts.isJsxElement(p)||ts.isJsxSelfClosingElement(p)) return inExpression;
  if(ts.isFunctionDeclaration(p)||ts.isSourceFile(p)) return false;
 }
 return false;
}
function scan(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory()){scan(f);continue;}if(!f.endsWith('.tsx'))continue;let text=fs.readFileSync(f,'utf8');const source=ts.createSourceFile(f,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const edits=[];function walk(n){if(ts.isCallExpression(n)&&n.expression.getText(source)==='uiText'&&!renderedCopy(n)){edits.push({start:n.getStart(source),end:n.end,value:n.arguments[0].getText(source)});return;}ts.forEachChild(n,walk);}walk(source);for(const edit of edits.sort((a,b)=>b.start-a.start))text=text.slice(0,edit.start)+edit.value+text.slice(edit.end);if(edits.length)fs.writeFileSync(f,text);}}
scan('src/pages');scan('src/components');console.log('Removed translation wrappers from non-display values and event handlers.');
