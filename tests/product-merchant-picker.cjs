const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let slots=[],cursor=0,tree,selected='',searched='',timer;
const jsx=(type,props)=>({type,props:props||{}});
const context={exports:{},setTimeout(fn){timer=fn;return 1},clearTimeout(){},require(id){
 if(id==='react')return {useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>slots[i]=value]},useEffect(fn){fn()}};
 if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
 if(id==='../uiText')return {uiText:x=>x};
 if(id==='lucide-react')return {Search:'search-icon',Store:'store-icon'};
 throw Error(id);
}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ProductMerchantPicker.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
const props={merchants:Array.from({length:250},(_,i)=>({id:String(i),merchant_name:`Shop ${i}`})),value:'',onChange:id=>selected=id,searchMerchants:q=>searched=q};
function render(extra={}){Object.assign(props,extra);cursor=0;tree=context.exports.ProductMerchantPicker(props)}
function walk(n){if(!n||typeof n!=='object')return [];return Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)]}
function nodes(){return walk(tree)}
const find=type=>nodes().find(n=>n.type===type);
render();find('input').props.onChange({target:{value:'SHOP 249'}});render();timer();assert.equal(searched,'SHOP 249');assert.equal(selected,'');
assert.equal(nodes().filter(n=>n.type==='option').length,2);
find('select').props.onChange({target:{value:'249'}});render({value:selected});
find('input').props.onChange({target:{value:'different'}});render({merchants:[]});
assert.ok(nodes().some(n=>n.type==='option'&&n.props.value==='249'),'Selection survives a search response that excludes it');
assert.ok(nodes().some(n=>n.props?.role==='status'),'No-match message');
render({merchantsLoading:true});assert.ok(!nodes().some(n=>n.props?.children==='No merchants found.'));
let loaded=0;render({hasMoreMerchants:true,merchantsLoading:false,loadMoreMerchants:()=>loaded++});find('button').props.onClick();assert.equal(loaded,1);
const home=fs.readFileSync('src/pages/customer/Home.tsx','utf8');assert.match(home,/product-list-merchants',user.id,merchantSearch/);assert.match(home,/getNextPageParam/);assert.match(home,/search:merchantSearch/);
console.log('PASS: search, no automatic selection, selected shop retained across remote results, loading/no matches, pagination and directory search wiring');
