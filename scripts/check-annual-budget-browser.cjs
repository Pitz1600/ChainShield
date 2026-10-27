const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let role = 'administrator', pool = null;
let dashboardFixture = false, budgetFailure = false;
const user = () => ({ _id: 'admin', id: 'admin', firstName: 'Test', lastName: 'Staff', role, position: 'Barangay Treasurer', isVerified: true, isApproved: true, isActive: true, twoFactorEnabled: true });
function json(res, data) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }
const server = http.createServer((req, res) => {
 const url = new URL(req.url, 'http://localhost');
 if (url.pathname.startsWith('/api/')) {
  if (url.pathname === '/api/transactions/alerts') return json(res, { alerts: [], count: 0 });
  if (url.pathname === '/api/transactions/my-transactions') return json(res, { transactions: [] });
  if (url.pathname === '/api/auth/profile') return json(res, user());
  if (url.pathname === '/api/auth/csrf-token') return json(res, { csrfToken: 'fixture' });
  if (url.pathname === '/api/annual-budgets/access') return json(res, { canRead: true });
  if (url.pathname === '/api/budget-proposals/access') return json(res, { canReview: role === 'administrator' });
  if (url.pathname === '/api/approved-budgets/access') return json(res, { enabled: true, canRead: true });
  if (url.pathname.startsWith('/api/annual-budgets/')) {
   if (req.method === 'GET' && dashboardFixture) {
    if (budgetFailure) { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Budget temporarily unavailable' })); return; }
    const year = Number(url.pathname.split('/').at(-1));
    return json(res, year === 2030 ? { pool: { totalCentavos: 0, reconciled: true }, reservedCentavos: 0, availableCentavos: 0, discrepancies: [] } : year === 2031 ? { pool: null, reservedCentavos: 0, availableCentavos: null, discrepancies: [] } : { pool: { totalCentavos: 100000000, reconciled: true }, reservedCentavos: 70000000, availableCentavos: 30000000, discrepancies: [] });
   }
   if (req.method === 'GET') return json(res, { pool, reservedCentavos: 0, discrepancies: [], availableCentavos: pool?.totalCentavos });
   let body = ''; req.on('data', c => body += c); req.on('end', () => {
    const data = JSON.parse(body);
    if (url.pathname.endsWith('/reconcile')) pool.reconciled = true;
    else {
     const event = { _id: String(Date.now()), action: pool ? 'adjusted' : 'recorded', previousCentavos: pool?.totalCentavos, newCentavos: data.totalCentavos, reference: data.reference, reason: data.reason, actor: user(), at: new Date() };
     pool = { ...pool, ...data, revision: (pool?.revision || 0) + 1, history: [...(pool?.history || []), event] };
    }
    json(res, pool);
   }); return;
  }
  return json(res, {});
 }
 let file = path.join(root, 'frontend/dist', url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
 if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'frontend/dist/index.html');
 res.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const profile=fs.mkdtempSync('/tmp/chainshield-firefox-');
 fs.writeFileSync(path.join(profile,'user.js'),'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("browser.tabs.warnOnClose", false);\n');
 const firefox=spawn('firefox',['--headless','--no-remote','--profile',profile,'--remote-debugging-port','9239'],{stdio:['ignore','pipe','pipe']});
 let socket;
 try {
  const address=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('Firefox did not start its debugging endpoint')),15000);
   const check=data=>{const message=data.toString();const match=message.match(/WebDriver BiDi listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timer);resolve(match[1]);}};
   firefox.stdout.on('data',check);firefox.stderr.on('data',check);firefox.once('exit',code=>reject(new Error(`Firefox exited ${code}`)));
  });
  socket=new WebSocket(address.endsWith('/session')?address:address.replace(/\/$/,'')+'/session');
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  const pending=new Map();let nextId=1;const errors=[];
  socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const cb=pending.get(data.id);if(cb){pending.delete(data.id);data.type==='error'?cb.reject(new Error(JSON.stringify(data))):cb.resolve(data.result);}}else if(data.method==='log.entryAdded'&&data.params?.type==='javascript'&&data.params.level==='error')errors.push(data.params.text);});
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  await send('session.new',{capabilities:{alwaysMatch:{acceptInsecureCerts:true}}});
  await send('session.subscribe',{events:['log.entryAdded']});
  await send('script.addPreloadScript',{functionDeclaration:`() => {
    window.__downloads=0;
    const open=XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open=function(method,url,...rest){return open.call(this,method,String(url).replace('http://localhost:5000/api','/api'),...rest);};
    const click=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){if(this.download){window.__downloads++;return;}return click.call(this);};
    window.__fill=(field,value)=>{const el=document.querySelector('[data-field="'+field+'"]');if(!el)throw Error('Missing '+field);const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));};
  }`});
  const {context}=await send('browsingContext.create',{type:'tab'});
  await send('browsingContext.setViewport',{context,viewport:{width:1280,height:900},devicePixelRatio:1});
  const evaluate=async expression=>{const result=await send('script.evaluate',{expression,target:{context},awaitPromise:true});if(result.type==='exception')throw new Error(result.exceptionDetails.text);return result.result.value;};
  const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Timed out: '+expression);};
  const navigate=async route=>send('browsingContext.navigate',{context,url:`http://127.0.0.1:${port}${route}`,wait:'complete'});

  await navigate('/dashboard/annual-budget');
  await wait('!!document.querySelector("form")');
  assert.ok(await evaluate('document.body.textContent.includes("Approval requires a recorded and reconciled pool")'));
  await evaluate('document.querySelector(".year-picker-trigger").click()');
  await wait('!!document.querySelector("dialog[open]")');
  assert.equal(await evaluate('document.querySelectorAll("dialog input, dialog select").length'), 0);
  await evaluate('document.querySelector(".year-picker-navigation button:last-child").click()');
  await evaluate('[...document.querySelectorAll(".year-picker-grid button")].find(b=>b.textContent==="2030").click()');
  await wait('document.querySelector(".year-picker-trigger").textContent.includes("2030")');
  assert.equal(await evaluate('!!document.querySelector("dialog[open]")'), false);
  await evaluate('document.querySelector(".year-picker-trigger").click()');
  await wait('!!document.querySelector("dialog[open]")');
  await evaluate('[...document.querySelectorAll(".year-picker-dialog button")].find(b=>b.textContent==="Close").click()');
  const fill = async (selector, value) => evaluate(`(() => {const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await fill('form input[inputmode="decimal"]', '1000000');
  assert.equal(await evaluate('document.querySelectorAll("form input").length'), 1);
  await evaluate('document.querySelector("form").requestSubmit()');
  await wait('document.body.textContent.includes("Adjust annual pool")');
  assert.equal(pool.totalCentavos, 100000000);
  await evaluate('[...document.querySelectorAll("button")].find(b=>b.textContent==="Back up and reconcile this year").click()');
  await wait('!document.body.textContent.includes("Approval is blocked")');
  await fill('form input[inputmode="decimal"]', '1100000');
  await fill('form textarea[required]', 'Supported increase');
  await evaluate('document.querySelector("form").requestSubmit()');
  await wait('document.querySelector("ol")?.textContent.includes("Supported increase")');
  assert.equal(pool.totalCentavos, 110000000);
  for (const nextRole of ['auditor', 'barangay_official']) {
    role = nextRole; await navigate('/dashboard/annual-budget');
    await wait('document.body.textContent.includes("Reserved for approved proposals")');
    assert.equal(await evaluate('!!document.querySelector("form")'), false);
    assert.ok(await evaluate('[...document.querySelectorAll(".nav-label")].some(n=>n.textContent==="Annual Budget")'));
  }
  await send('browsingContext.setViewport',{context,viewport:{width:390,height:844},devicePixelRatio:1});
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'));
  dashboardFixture = true;
  for (const nextRole of ['administrator', 'barangay_official']) {
    role = nextRole;
    await navigate('/dashboard');
    await wait('document.querySelector(".proposal-budget-overview")?.textContent.includes("300,000.00")');
    assert.equal(await evaluate('document.body.textContent.includes("Estimated Budget") || document.body.textContent.includes("15,000,000")'), false);
    assert.ok(await evaluate('document.querySelector(".proposal-budget-overview").textContent.includes("700,000.00")'));
    await evaluate('document.querySelector(".year-picker-trigger").click()');
    await evaluate('document.querySelector(".year-picker-navigation button:last-child").click()');
    await evaluate('[...document.querySelectorAll(".year-picker-grid button")].find(b=>b.textContent==="2030").click()');
    await wait('document.querySelectorAll(".proposal-budget-overview .budget-metric-value").length === 3');
    assert.ok(await evaluate('[...document.querySelectorAll(".proposal-budget-overview .budget-metric-value")].every(e=>e.textContent.includes("0.00"))'));
    await evaluate('document.querySelector(".year-picker-trigger").click()');
    await evaluate('[...document.querySelectorAll(".year-picker-grid button")].find(b=>b.textContent==="2031").click()');
    await wait('document.querySelector(".proposal-budget-overview")?.textContent.includes("No annual proposal budget is recorded")');
    budgetFailure = true;
    await evaluate('document.querySelector(".proposal-budget-overview .rt-refresh-btn").click()');
    await wait('document.querySelector(".proposal-budget-overview [role=alert]")?.textContent.includes("Budget temporarily unavailable")');
    assert.equal(await evaluate('document.querySelectorAll(".proposal-budget-overview .budget-metric-value").length'), 0);
    budgetFailure = false;
  }
  assert.deepEqual(errors, []);
  console.log('Annual Budget browser checks passed: record, reconcile, adjust, history, reader roles, mobile layout and proposal-based dashboards (year changes, zero, missing pool and errors).');
 } finally { if (socket) socket.close(); firefox.kill(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
