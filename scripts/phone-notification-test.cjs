// Sends a test through the signed-in customer's debug WebView; never prints tokens.
(async () => {
  const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
  const page = pages.find(p => p.type === 'page');
  if (!page) throw new Error('No app WebView found');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const timer = setTimeout(() => { socket.close(); process.exitCode = 1; }, 25000);
  socket.onmessage = event => {
    const data = JSON.parse(event.data);
    if (data.id !== 1) return;
    console.log(JSON.stringify(data.result));
    clearTimeout(timer);
    socket.close();
  };
  socket.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: {
    expression: `(async()=>{const r=await fetch('https://www.affiliateae.co.in/api/customer/notifications/test',{method:'POST',headers:{Authorization:'Bearer '+localStorage.getItem('ae_access_token')}});return {status:r.status,body:await r.text()}})()`,
    awaitPromise: true, returnByValue: true,
  }}));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
