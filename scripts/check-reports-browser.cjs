const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const service = require('../backend/services/financialReportService');
const user = { _id: 'auditor', id: 'auditor', firstName: 'Test', lastName: 'Auditor', role: 'auditor', isVerified: true, isApproved: true, isActive: true, twoFactorEnabled: true };
const proposal = { _id: '111111111111111111111111', proposalNumber: 'BP-FIXTURE', items: [{ itemId: 'a', name: 'Materials', estimatedAmountCentavos: 10000000 }], totalAmountCentavos: 10000000 };
const rows = Array.from({ length: 90 }, (_, i) => ({ _id: String(i).padStart(24, '0'), budgetProposalId: proposal._id, allocationId: 'a', amountCentavos: 10000, reviewStatus: 'verified', input: { timestamp: '2026-10-26T00:00:00Z', description: 'Materials <script>escaped</script> ' + 'Long purpose '.repeat(i === 0 ? 250 : 4), toAddress: 'Fixture payee' }, evidence: [] }));
let allowed = true;
function json(res, data, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }
const server = http.createServer((req, res) => {
 const url = new URL(req.url, 'http://localhost');
 if (url.pathname.startsWith('/api/')) {
  if (url.pathname === '/api/auth/profile') return json(res, user);
  if (url.pathname === '/api/auth/csrf-token') return json(res, { csrfToken: 'fixture' });
  if (url.pathname === '/api/reports/access') return json(res, { enabled: true, reportTypes: allowed ? ['summary', 'register', 'audit'] : [] });
  if (url.pathname === '/api/reports/options') return json(res, { fiscalYears: [2026], proposals: [{ id: proposal._id, proposalNumber: 'BP-FIXTURE', fiscalYear: 2026, title: 'Fixture', allocations: [{ id: 'a', name: 'Materials' }] }], page: 1, pages: 1 });
  if (url.pathname === '/api/reports/preview') { let body = ''; req.on('data', c => body += c); req.on('end', () => { try { json(res, service.construct([proposal], rows, [], [], service.normalize(JSON.parse(body)), user)); } catch(e) { json(res, { error: e.message }, e.status || 500); } }); return; }
  return json(res, {});
 }
 let file = path.join(root, 'frontend/dist', url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
 if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'frontend/dist/index.html');
 res.writeHead(200, { 'Content-Type': ({ '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png' })[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const profile=fs.mkdtempSync('/tmp/chainshield-firefox-');
 fs.writeFileSync(path.join(profile,'user.js'),'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("browser.tabs.warnOnClose", false);\n');
 const firefox=spawn('firefox',['--headless','--no-remote','--profile',profile,'--remote-debugging-port','9225'],{stdio:['ignore','pipe','pipe']});
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

  await navigate('/dashboard/reports');
  await wait('document.querySelectorAll("form select").length >= 4');
  const select = async (index, value) => evaluate(`(() => { const e = document.querySelectorAll('form select')[${index}]; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(e, ${JSON.stringify(value)}); e.dispatchEvent(new Event('change', { bubbles:true })); })()`);
  await wait('[...document.querySelectorAll("form select")[1].options].some(o => o.value === "2026")');
  await select(1, '2026');
  await wait('!document.querySelector("form button").disabled');
  await evaluate('document.querySelector("form").requestSubmit()');
  await wait('!!document.querySelector(".financial-report")');
  const printDisabled = '[...document.querySelectorAll("button")].find(b => b.textContent === "Print / Save as PDF").disabled';
  assert.equal(await evaluate(printDisabled), false);
  await evaluate('document.body.classList.add("financial-print-ready")');
  const summaryPdf = await send('browsingContext.print', { context, background: false, orientation: 'portrait', page: { width: 21, height: 29.7 } });
  fs.writeFileSync('/tmp/chainshield-report-summary.pdf', Buffer.from(summaryPdf.data, 'base64'));
  await select(0, 'register');
  assert.equal(await evaluate(printDisabled), true);
  await evaluate('document.querySelector("form").requestSubmit()');
  await wait('document.querySelectorAll(".financial-report tbody tr").length === 90');
  assert.equal(await evaluate('document.querySelectorAll(".financial-report script").length'), 0);
  await evaluate('document.body.classList.add("financial-print-ready")');
  const registerPdf = await send('browsingContext.print', { context, background: false, orientation: 'landscape', page: { width: 29.7, height: 21 } });
  fs.writeFileSync('/tmp/chainshield-report-register.pdf', Buffer.from(registerPdf.data, 'base64'));
  await select(0, 'audit');
  await evaluate('document.querySelector("form").requestSubmit()');
  await wait('document.querySelector(".financial-report")?.textContent.includes("Evidence inventory")');
  assert.equal(await evaluate('document.querySelector(".financial-report").textContent.includes("Assessment: Unavailable")'), true);
  await select(4, 'rejected');
  await evaluate('document.querySelector("form").requestSubmit()');
  await wait('document.querySelector(".financial-report")?.textContent.includes("No matching records")');
  await evaluate('window.__prints = 0; window.print = () => { window.__prints++; window.dispatchEvent(new Event("afterprint")); }; [...document.querySelectorAll("button")].find(b => b.textContent === "Print / Save as PDF").click()');
  await wait('window.__prints === 1');
  allowed = false;
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Print / Save as PDF").click()');
  await wait('!document.querySelector(".financial-report")');
  assert.deepEqual(errors, []);
  console.log('PASS report navigation, snapshot preview, stale filters, escaped content, revoked access, portrait and multipage landscape PDFs');
  await send('session.end');
 } finally { if (socket) socket.close(); firefox.kill(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
