const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let slots=[],cursor=0,tree,selected='',searched='',timer;
const jsx=(type,props)=>({type,props:props||{}});
const context={exports:{},document:{addEventListener(){},removeEventListener(){}},setTimeout(fn){timer=fn;return 1},clearTimeout(){},require(id){
 if(id==='react')return {useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>slots[i]=value]},useEffect(fn){fn()},useRef(){return {current:null}},useId(){return 'picker-test'}};
 if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};
 if(id==='../uiText')return {uiText:x=>x};
 if(id==='lucide-react')return {Search:'search-icon',Store:'store-icon',ChevronDown:'chevron',Check:'check'};
 throw Error(id);
}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/ProductMerchantPicker.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
const props={merchants:Array.from({length:250},(_,i)=>({id:String(i),merchant_name:`Shop ${i}`})),value:'',onChange:id=>selected=id,searchMerchants:q=>searched=q};
function render(extra={}){Object.assign(props,extra);cursor=0;tree=context.exports.ProductMerchantPicker(props)}
function walk(n){if(!n||typeof n!=='object')return [];return Array.isArray(n)?n.flatMap(walk):[n,...walk(n.props?.children)]}
function nodes(){return walk(tree)}
const find=type=>nodes().find(n=>n.type===type);
const trigger=()=>nodes().find(n=>n.props?.className?.includes('ae-product-merchant-trigger'));
const option=id=>nodes().find(n=>n.props?.role==='option'&&n.props.id===`picker-test-option-${id}`);
render();assert.equal(find('input'),undefined,'Closed field has no separate search input');assert.equal(trigger().props['aria-expanded'],false);
trigger().props.onClick();render();assert.equal(trigger().props['aria-expanded'],true);assert.ok(nodes().some(n=>n.props?.role==='dialog'));
find('input').props.onChange({target:{value:'SHOP 249'}});render();timer();assert.equal(searched,'SHOP 249');assert.equal(selected,'');
assert.equal(nodes().filter(n=>n.props?.role==='option').length,1);
option(0).props.onClick();render({value:selected});assert.equal(selected,'249');assert.equal(find('input'),undefined);assert.equal(trigger().props['aria-expanded'],false);
trigger().props.onClick();render();find('input').props.onChange({target:{value:'different'}});render({merchants:[]});
assert.ok(JSON.stringify(trigger()).includes('Shop 249'),'Selected shop stays on trigger when search response excludes it');
assert.ok(nodes().some(n=>n.props?.role==='status'),'No-match message');
render({merchantsLoading:true});assert.ok(!nodes().some(n=>n.props?.children==='No merchants found.'));
let loaded=0;render({hasMoreMerchants:true,merchantsLoading:false,loadMoreMerchants:()=>loaded++});nodes().find(n=>n.props?.className==='ae-product-more').props.onClick();assert.equal(loaded,1);
find('input').props.onChange({target:{value:''}});render({merchants:[{id:'a',merchant_name:'Alpha'},{id:'b',merchant_name:'Beta'}]});
find('input').props.onKeyDown({key:'ArrowDown',preventDefault(){}});render();find('input').props.onKeyDown({key:'Enter',preventDefault(){}});render({value:selected});assert.equal(selected,'b');assert.equal(find('input'),undefined);
trigger().props.onClick();render();nodes().find(n=>n.props?.className==='ae-product-merchant-picker').props.onKeyDown({key:'Escape',preventDefault(){},stopPropagation(){}});render();assert.equal(find('input'),undefined);
const home=fs.readFileSync('src/pages/customer/Home.tsx','utf8');assert.match(home,/product-list-merchants',user.id,merchantSearch/);assert.match(home,/getNextPageParam/);assert.match(home,/search:merchantSearch/);
console.log('PASS: search, no automatic selection, selected shop retained across remote results, loading/no matches, pagination and directory search wiring');
