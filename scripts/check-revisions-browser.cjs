const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
if (typeof WebSocket === 'undefined') throw new Error('Browser checks require Node.js 22 or newer.');
let mode = 'anonymous', templateRequests = 0, verifyRequests = 0, listRequests = 0;
const user = { _id: 'official', id: 'official', firstName: 'Test', lastName: 'Official', email: 'test@example.test', role: 'barangay_official', position: 'Kagawad', isVerified: true, isApproved: true, twoFactorEnabled: true };
const records = Array.from({length:30}, (_,i) => ({ _id: String(i+1).padStart(24,'0'), transactionId: `TX-TEST-${i+1}`, timestamp: '2026-10-17T00:00:00Z', amount: 1500+i, description: `Road repair record ${i+1}`, transactionType: 'Procurement', agency: 'Test barangay', programName: 'Road repairs', verificationStatus: 'Verified', verifiedBy: 'Reviewer name', verifiedAt: '2026-10-17T01:00:00Z', riskScore: 20, currency: 'PHP', lineItems: [] }));
function json(res, data, status=200) {res.writeHead(status, {'Content-Type':'application/json'});res.end(JSON.stringify(data));}
const server = http.createServer((req,res)=>{
 const url = new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api/')) {
  if(url.pathname==='/api/auth/profile') return mode==='anonymous' ? json(res,{error:'Not authenticated'},401) : json(res,{...user,isVerified:mode!=='unverified'});
  if(url.pathname==='/api/auth/csrf-token') return json(res,{csrfToken:'test-only'});
  if(url.pathname==='/api/auth/register') {mode='unverified';return json(res,{success:true,user:{...user,isVerified:false}});}
  if(url.pathname==='/api/auth/verify-email') {verifyRequests++;if(verifyRequests===1)return json(res,{error:'Invalid verification code.'},400);mode='official';return json(res,{success:true});}
  if(url.pathname==='/api/auth/resend-otp')return json(res,{success:true});
  if(url.pathname==='/api/transactions/template') {
   templateRequests++;
   if(templateRequests>5){res.setHeader('Retry-After','2');return json(res,{error:'Too many template downloads.',retryAfterSeconds:2},429);}
   return setTimeout(()=>{res.writeHead(200,{'Content-Type':'text/csv'});res.end('record_id,amount\nTEST,100');},150);
  }
  if(url.pathname==='/api/transactions/my-transactions'){listRequests++;return setTimeout(()=>json(res,{transactions:records,total:records.length,totalPages:1}),120);}
  if(url.pathname==='/api/transactions/alerts')return json(res,{alerts:[]});
  if(url.pathname==='/api/transactions/budget-summary')return json(res,{});
  if(/^\/api\/transactions\/[0-9]{24}$/.test(url.pathname))return json(res,records.find(r=>url.pathname.endsWith(r._id))||records[0]);
  return json(res,{});
 }
 const relative=url.pathname==='/'?'index.html':url.pathname.slice(1);
 let file=path.join(root,'frontend/dist',relative);
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())file=path.join(root,'frontend/dist/index.html');
 const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
 res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const profile=fs.mkdtempSync('/tmp/chainshield-firefox-');
 fs.writeFileSync(path.join(profile,'user.js'),'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("browser.tabs.warnOnClose", false);\n');
 const firefox=spawn('firefox',['--headless','--no-remote','--profile',profile,'--remote-debugging-port','9222'],{stdio:['ignore','pipe','pipe']});
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
  await navigate('/register');await wait('!!document.querySelector("[data-field=confirmPassword]")');
  assert.equal(await evaluate('document.querySelectorAll("form").length'),1);
  assert.equal(await evaluate('document.querySelector("[data-field=firstName]").maxLength'),50);
  assert.equal(await evaluate('document.querySelector("[data-field=password]").hasAttribute("maxlength")'),false);
  await evaluate(`document.querySelector('[aria-label="Show password"]').click()`);
  await wait('document.querySelector("[data-field=password]").type === "text"');
  await evaluate(`__fill('firstName','Ana');__fill('lastName','Santos');__fill('email','ana@example.test');__fill('password','Strong1!');__fill('confirmPassword','Strong1!');document.querySelector('[type=checkbox]').click();`);
  await evaluate('document.querySelector("[type=submit]").click()');
  await wait('document.querySelectorAll(".otp-input").length === 6');
  await evaluate(`for(const el of document.querySelectorAll('.otp-input')){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'1');el.dispatchEvent(new Event('input',{bubbles:true}));}document.querySelector('.submit-button').click();`);
  await wait('!!document.querySelector("#verification-error")');
  assert.equal(await evaluate('document.querySelectorAll(".otp-input[aria-invalid=true]").length'),6);
  await evaluate('document.querySelector(".submit-button").click()');
  await wait('document.body.textContent.includes("Email verified successfully!")');
  console.log('PASS single-form registration, visibility controls, and verification states');
  await wait('location.pathname === "/dashboard"');
  await navigate('/dashboard/integrity-checker');await wait('!!document.querySelector(".btn-manual")');
  await evaluate('document.querySelector(".btn-manual").click()');
  await wait('!!document.querySelector(".btn-add-row")');
  assert.equal(await evaluate('document.querySelector(".btn-add-row").disabled'),true);
  await evaluate('document.querySelector(".btn-analyze").click()');
  await wait('!!document.querySelector("[data-field=agency][aria-invalid=true]") && document.activeElement.dataset.field === "agency"');
  assert.equal(await evaluate('document.activeElement.dataset.field'),'agency');
  const fillRow=()=>evaluate(`__fill('agency','Test barangay');__fill('programName','Road repairs');__fill('payerName','Barangay');__fill('payeeName','Supplier');__fill('description','Road repair');__fill('debitAmount','100');`);
  await fillRow();await wait('!document.querySelector(".btn-add-row").disabled');
  await evaluate('const button=document.querySelector(".btn-add-row");button.click();button.click();');
  await wait('document.querySelector(".row-counter").textContent === "Row 2 of 2"');
  await evaluate('document.querySelector(".btn-nav").click()');
  await wait('document.querySelector("[data-field=agency]").value === "Test barangay"');
  await evaluate('document.querySelector(".btn-analyze").click()');
  await wait('document.querySelector(".row-counter").textContent === "Row 2 of 2" && document.activeElement.dataset.field === "agency"');
  for(let i=0;i<10;i++){await fillRow();await evaluate('document.querySelector(".btn-add-row").click()');await wait(`document.querySelector('.row-counter').textContent === 'Row ${i+3} of ${i+3}'`);}
  assert.ok(await evaluate('document.querySelectorAll(".row-page").length <= 5'));
  await evaluate('document.querySelector(".btn-remove-row").click()');
  await wait('document.querySelector(".row-counter").textContent === "Row 11 of 11"');
  await send('browsingContext.setViewport',{context,viewport:{width:390,height:844},devicePixelRatio:1});
  assert.equal(await evaluate('document.querySelector(".integrity-modal .modal-body").scrollWidth <= document.querySelector(".integrity-modal .modal-body").clientWidth'),true);
  assert.equal(await evaluate('new Set([...document.querySelectorAll(".row-page")].map(el=>Math.round(el.getBoundingClientRect().top))).size'),1);
  const manualImage=await send('browsingContext.captureScreenshot',{context});fs.writeFileSync('/tmp/chainshield-manual-mobile.png',Buffer.from(manualImage.data,'base64'));
  await evaluate('document.querySelector(".close-modal").click()');
  await send('browsingContext.setViewport',{context,viewport:{width:1280,height:900},devicePixelRatio:1});
  for(let i=0;i<6;i++){await evaluate('var b=document.querySelector(".btn-link-template");b.click();b.click();');await wait('document.querySelector(".btn-link-template").textContent.includes("Download Sample") || document.querySelector(".btn-link-template").textContent.includes("Retry in")');}
  assert.equal(templateRequests,6);
  assert.equal(await evaluate('window.__downloads'),5);
  assert.equal(await evaluate('document.querySelector(".btn-link-template").disabled'),true);
  await wait('!document.querySelector(".btn-link-template").disabled');
  console.log('PASS manual-row validation, double-click guard, bounded navigation, and template cooldown');
  await navigate('/dashboard/transactions?tab=ledger');await wait('document.querySelectorAll(".transactions-table tbody tr").length === 12');
  assert.equal(await evaluate('[...document.querySelectorAll(".transactions-table th")].some(el=>el.textContent.trim()==="ID")'),false);
  assert.equal(await evaluate('document.querySelector(".transactions-table").textContent.includes("Reviewer name")'),false);
  await evaluate('document.querySelectorAll(".pagination-btn")[1].click()');await wait('document.querySelector(".pagination-info").textContent.includes("Page 2")');
  const before=listRequests;
  await evaluate('document.querySelector(".table-refresh").click()');await wait('!document.querySelector(".table-refresh").disabled');
  assert.ok(listRequests>before);assert.equal(await evaluate('document.querySelector(".pagination-info").textContent'),'Page 2 of 3');
  await evaluate('document.querySelector(".transactions-table tbody tr").click()');await wait('!!document.querySelector(".transaction-reference")');
  await evaluate('[...document.querySelectorAll(".modal-tab-btn")].find(b=>b.textContent.includes("Transaction details")).click()');
  await wait('document.querySelector(".verification-history").textContent.includes("Reviewer name")');
  await evaluate('document.querySelector(".tx-modal-header .close-btn").click()');
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".sidebar .sidebar-logo"),"::before").content'), 'none');
  assert.equal(await evaluate('document.querySelector(".portal-brand-logo").getBoundingClientRect().bottom <= document.querySelector(".sidebar .logo-title").getBoundingClientRect().top'),true);
  const image=await send('browsingContext.captureScreenshot',{context});fs.writeFileSync('/tmp/chainshield-transactions-desktop.png',Buffer.from(image.data,'base64'));
  console.log('PASS table refresh preserves pagination, references are explained, and reviewers remain in details');
  assert.deepEqual(errors,[]);
  await send('session.end');
 }finally{if(socket)socket.close();firefox.kill();server.close();}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
