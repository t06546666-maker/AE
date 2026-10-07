// Read-only inspection of the app's signed-in debug WebView; never prints credentials.
(async () => {
  const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
  const page = pages.find(p => p.type === 'page' && /localhost|affiliateae/.test(p.url));
  if (!page) throw new Error('No AE WebView found');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const timer = setTimeout(() => { socket.close(); process.exitCode = 1; }, 20000);
  socket.onmessage = event => { const data = JSON.parse(event.data); if (data.id !== 1) return; console.log(JSON.stringify(data.result)); clearTimeout(timer); socket.close(); };
  socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: `(async()=>{const errors=[...document.querySelectorAll('[role=alert],.form-error')].map(e=>e.innerText); const result={path:location.pathname,errors}; const r=await fetch('https://www.affiliateae.co.in/api/field/visits',{headers:{Authorization:'Bearer '+localStorage.getItem('ae_access_token')}}); result.apiStatus=r.status; const b=await r.json();result.apiError=b.error;result.activeVisits=(b.visits||[]).filter(v=>v.status==='active').map(v=>({id:v.id,merchant_id:v.merchant_id,status:v.status}));result.visibleErrorLines=document.body.innerText.split(String.fromCharCode(10)).filter(s=>/column|schema|does not exist|could not find|failed|error/i.test(s));return result})()`, awaitPromise: true, returnByValue: true } }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
