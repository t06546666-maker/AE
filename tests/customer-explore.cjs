const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks, extra = {}) {
  const source = fs.readFileSync(file, 'utf8').replaceAll('import.meta.env', '({})');
  const code = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, require:id => { if (id in mocks) return mocks[id]; throw Error('Unexpected import '+id); }, ...extra});
  return exports;
}
const jsx = {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
for (const location of [null, {area:'GPS',latitude:10.7,longitude:76.7}, {area:'Chittur',routeGroup:'chittur'}, {area:'All',routeGroup:'all'}]) {
  let request, permissionMode;
  const mocks = {
    'react/jsx-runtime':jsx,
    'react':{useState:value=>[typeof value==='function'?value():value,()=>{}],useEffect:()=>{}},
    '../../uiText':{uiText:x=>x},
    '../../components/CustomerShopCard':{},
    'react-router-dom':{Link:'a',useLocation:()=>({key:'test'})},
    'lucide-react':{},
    '../../hooks/useCustomerData':{useCustomerCategories:()=>({data:{categories:[]}}),useCustomerMerchants:(...args)=>{request=args;return {data:{merchants:[]},isLoading:false,isError:false,refetch:()=>{}}}},
    '../../hooks/useCustomerLocation':{useCustomerLocation:(...args)=>{permissionMode=args;return {data:location}}},
    '../../components/CustomerNearbyMap':{},'../../components/CustomerLocationBar':{},'../../api':{},
  };
  const page=load('src/pages/customer/Explore.tsx',mocks,{localStorage:{getItem:()=>null}});
  const tree=page.CustomerExplore();
  assert.ok(tree);
  assert.equal(request[3].routeGroup,location?.routeGroup || 'all');
  assert.notEqual(request[4],false,'Directory must load before location selection');
  assert.deepEqual(Array.from(permissionMode),[true,true],'Only use previously granted GPS');
}
(async()=>{
  for (const granted of [false,true]) {
    let query, prompts=0;
    const hook=load('src/hooks/useCustomerLocation.ts',{
      '@tanstack/react-query':{useQueryClient:()=>({}),useQuery:options=>{if(options.queryKey[1]==='selected-location')return {data:null};query=options;return {data:null}}},
      '@capacitor/core':{Capacitor:{isNativePlatform:()=>true}},
      '@capacitor/geolocation':{Geolocation:{checkPermissions:async()=>({location:granted?'granted':'denied'}),requestPermissions:async()=>{prompts++;throw Error('Must not prompt')},getCurrentPosition:async()=>({coords:{latitude:10,longitude:76}})}},
      '../components/CustomerNearbyMap':{},
    });
    hook.useCustomerLocation(true,true);
    assert.equal(query.enabled,true);
    const result=await query.queryFn();
    assert.equal(prompts,0);
    if(granted)assert.equal(result.latitude,10);else assert.equal(result,null);
  }
  console.log('PASS: Explore loads all shops without selection, preserves area filters/GPS, and never requests location permission for default sorting');
})().catch(error=>{console.error(error);process.exitCode=1});
