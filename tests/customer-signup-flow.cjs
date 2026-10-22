const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
const controllerScope={exports:{},setTimeout,clearTimeout};vm.runInNewContext(transpile('src/nativePhoneReset.ts'),controllerScope);
async function run(automatic,retryBackend=false){
 let cursor=0,slots=[],effects=[],tree;const listeners=new Map();let verified=0,apiCalls=0,loginCalls=0,phone='+919000000001';
 const hooks={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],v=>slots[i]=typeof v==='function'?v(slots[i]):v]},useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},useEffect(fn,deps){const i=cursor++;if(!(i in slots)){slots[i]=deps;effects.push(fn)}}};
 const native={async addListener(name,fn){listeners.set(name,fn);return {async remove(){listeners.delete(name)}}},async signInWithPhoneNumber(){},async confirmVerificationCode(){verified++},async getCurrentUser(){return {user:{phoneNumber:phone}}},async getIdToken(options){assert.equal(options.forceRefresh,true);return {token:'verified-native-id-token'}},async signOut(){}};
 const jsx=(type,props)=>({type,props:props||{}});
 const scope={exports:{},window:{setInterval(){return 1},clearInterval(){},recaptchaVerifier:null},require(id){if(id==='react')return hooks;if(id==='react/jsx-runtime')return {jsx,jsxs:jsx};if(id==='@capacitor/core')return {Capacitor:{isNativePlatform:()=>true}};if(id==='@capacitor-firebase/authentication')return {FirebaseAuthentication:native};if(id==='../../nativePhoneReset')return controllerScope.exports;if(id==='../../uiText')return {uiText:x=>x};if(id==='../../toast')return {useToast:()=>({showToast(){}})};if(id==='../../api')return {setAccessToken(){},async apiFetch(path,init){apiCalls++;assert.equal(path,'/api/auth/customer/signup');assert.equal(JSON.parse(init.body).idToken,'verified-native-id-token');if(retryBackend&&apiCalls===1)throw Error('Temporary save failure');return {accessToken:'app-token',user:{id:'test-customer'},welcomeBonusAwarded:true}}};if(id==='../../firebase')return {auth:{}};if(id==='react-router-dom')return {Link:'a'};if(id==='firebase/auth')return {};if(id.endsWith('.css'))return {};return new Proxy({},{get:()=>()=>null})}};
 vm.createContext(scope);vm.runInContext(transpile('src/pages/customer/CustomerSignup.tsx'),scope);
 function render(){cursor=0;tree=scope.exports.CustomerSignup({onLogin(){loginCalls++}});for(const fn of effects.splice(0)){const cleanup=fn();if(cleanup)cleanups.push(cleanup)}}const cleanups=[];
 function nodes(n=tree){if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(x=>nodes(x));return [n,...nodes(n.props?.children??null)]}
 const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
 try{
  render();
  for(const [label,value] of [['Full name','Test Customer'],['Mobile number','9000000001'],['Create password','Password8'],['Confirm password','Password8']]){nodes().find(n=>n.props?.['aria-label']===label).props.onChange({target:{value}});render()}
  nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush();
  assert.ok(listeners.has('phoneCodeSent'));listeners.get(automatic?'phoneVerificationCompleted':'phoneCodeSent')(automatic?{}:{verificationId:'fresh-verification'});await flush();render();
  if(!automatic){nodes().find(n=>n.props?.['aria-label']==='6-digit OTP').props.onChange({target:{value:'123456'}});render()}
  const form=nodes().find(n=>n.type==='form');await form.props.onSubmit({preventDefault(){}});await flush();render();
  if(retryBackend){assert.equal(loginCalls,0);assert.ok(nodes().some(n=>n.props?.role==='alert'));await nodes().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});await flush()}
  assert.equal(loginCalls,1);assert.equal(verified,automatic?0:1,'Backend retry must not consume the OTP twice');assert.equal(apiCalls,retryBackend?2:1);
 }finally{for(const cleanup of cleanups)cleanup();await flush()}
}
(async()=>{await run(false);await run(true);await run(false,true);await run(true,true);console.log('PASS: real signup component handlers for manual OTP, instant native verification, and backend retry without second OTP');})().catch(e=>{console.error(e);process.exitCode=1});
