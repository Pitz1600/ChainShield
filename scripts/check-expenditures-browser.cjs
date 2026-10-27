const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
let mode = 'treasurer', submissions = 0, reviews = 0, csvSubmissions = 0;
let imported = [];
const user = { _id: 'treasurer', id: 'treasurer', firstName: 'Test', lastName: 'Treasurer', email: 'test@example.test', role: 'barangay_official', position: 'Barangay Treasurer', isVerified: true, isApproved: true, isActive: true, twoFactorEnabled: true };
const budget = { _id: '111111111111111111111111', proposalNumber: 'BP-FIXTURE', title: 'Approved Road Repairs', barangayId: 'a', reviewedAt: '2026-10-20T10:00:00Z', reviewedBy: 'Approver', totalAmountCentavos: 10000, items: [{ itemId: 'materials', name: 'Materials', description: 'Road materials', estimatedAmountCentavos: 10000 }] };
let expenditure = null;
const totals = () => { const all = [...(expenditure ? [expenditure] : []), ...imported]; const recorded = all.reduce((n, e) => n + e.amountCentavos, 0), verified = all.filter(e => e.reviewStatus === 'verified').reduce((n, e) => n + e.amountCentavos, 0); return { approved: 10000, recorded, pending: recorded - verified, verified, available: 10000 - recorded }; };
function json(res, data, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); }
const server = http.createServer((req, res) => {
 const url = new URL(req.url, 'http://localhost');
 if (url.pathname.startsWith('/api/')) {
  if (url.pathname === '/api/auth/profile') return json(res, mode === 'auditor' ? { ...user, _id: 'auditor', id: 'auditor', role: 'auditor' } : user);
  if (url.pathname === '/api/auth/csrf-token') return json(res, { csrfToken: 'test-only' });
  if (url.pathname === '/api/reports/access') return json(res, { enabled: true, reportTypes: ['summary', 'register'] });
  if (url.pathname === '/api/budget-proposals/access') return json(res, { canSubmit: false, canReview: false });
  if (url.pathname === '/api/approved-budgets/access') return json(res, { enabled: true, canRead: true, canSubmit: mode === 'treasurer', canReview: mode === 'auditor' });
  if (url.pathname === '/api/approved-budgets') return json(res, [{ ...budget, totals: totals() }]);
  if (req.method === 'POST' && url.pathname.endsWith('/preview-csv')) return json(res, { filename: 'expenses.csv', rows: [2, 3].map(rowNumber => ({ rowNumber, recordId: `CSV-${rowNumber}`, payer: 'Office', payee: 'Supplier', input: { amount: 10, description: 'CSV materials', timestamp: '2026-10-20T00:00:00Z' } })) });
  if (req.method === 'POST' && url.pathname.endsWith('/import-csv')) {
    let body = ''; req.on('data', c => { body += c; }); req.on('end', () => {
      assert.ok(body.includes('csvFile') && body.includes('evidenceIndexes') && body.includes('name="evidence"') && !body.includes('name="categories"')); csvSubmissions++;
      imported = [4, 5].map(n => ({ ...expenditure, _id: String(n).repeat(24), amountCentavos: 1000, input: { ...expenditure.input, description: 'CSV materials' }, sourceFilename: 'expenses.csv', sourceRowNumber: n - 2 }));
      json(res, { expenditures: imported }, 201);
    }); return;
  }
  if (req.method === 'POST' && url.pathname.endsWith('/expenditures')) {
   let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
    assert.ok(body.includes('receipt') && body.includes('supporting_document'));
    submissions++;
    expenditure = { _id: '222222222222222222222222', budgetProposalId: budget._id, submittedBy: user._id, amountCentavos: 6000, input: { timestamp: '2026-10-20T02:00:00Z', description: 'Road materials', toAddress: 'Supplier' }, reviewStatus: 'submitted', assessmentStatus: 'complete', assessment: { riskScore: 12, riskLevel: 'LOW', reasons: ['Financial details assessed'] }, evidence: [{ _id: '333333333333333333333333', originalName: 'receipt.pdf', mimeType: 'application/pdf', categories: ['receipt', 'supporting_document'], uploadedBy: 'treasurer', uploadedAt: '2026-10-20T10:00:00Z', version: 1, sha256: 'fixture-hash' }], history: [] };
    json(res, expenditure, 201);
   }); return;
  }
  if (req.method === 'POST' && url.pathname.endsWith('/audit-evidence')) {
    let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
      assert.equal(mode, 'auditor'); assert.ok(body.includes('Inspection confirms completed work'));
      expenditure.auditorEvidence = [{ _id: '666666666666666666666666', originalName: 'inspection.pdf', mimeType: 'application/pdf', bytes: 30, uploaderName: 'Auditor Fixture', uploadedBy: 'auditor', uploadedAt: '2026-10-27T10:00:00Z', explanation: 'Inspection confirms completed work', sha256: 'fixture-checksum' }];
      json(res, { auditorEvidence: expenditure.auditorEvidence }, 201);
    }); return;
  }
  if (url.pathname.includes('/audit-evidence/')) { res.writeHead(200, { 'Content-Type': 'application/pdf' }); res.end('%PDF-1.4 inspection %%EOF'); return; }
  if (req.method === 'POST' && url.pathname.endsWith('/review')) {
   let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => { const data = JSON.parse(body); assert.equal(mode, 'auditor'); expenditure.reviewStatus = data.status; reviews++; json(res, expenditure); }); return;
  }
  if (url.pathname.includes('/evidence/')) {
    const fileId = url.pathname.split('/').at(-1);
    if (fileId === 'image-fixture') { res.writeHead(200, { 'Content-Type': 'image/png' }); res.end(fs.readFileSync(path.join(__dirname, 'fixtures/evidence-preview.png'))); return; }
    if (fileId === 'docx-fixture') { res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }); res.end(fs.readFileSync(path.join(__dirname, 'fixtures/evidence-preview.docx'))); return; }
    res.writeHead(200, { 'Content-Type': 'application/pdf' }); res.end(fs.readFileSync(path.join(__dirname, 'fixtures/evidence-preview.pdf'))); return;
  }
  if (url.pathname === `/api/approved-budgets/${budget._id}`) return json(res, { budget, totals: totals(), allocations: budget.items.map(i => ({ ...i, totals: totals() })), expenditures: [...(expenditure ? [expenditure] : []), ...imported] });
  return json(res, {});
 }
 const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
 let file = path.join(root, 'frontend/dist', relative);
 if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'frontend/dist/index.html');
 const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml' };
 res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' }); fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 const profile=fs.mkdtempSync('/tmp/chainshield-firefox-');
 fs.writeFileSync(path.join(profile,'user.js'),'user_pref("browser.shell.checkDefaultBrowser", false);\nuser_pref("browser.tabs.warnOnClose", false);\n');
 const firefox=spawn('firefox',['--headless','--no-remote','--profile',profile,'--remote-debugging-port','9223'],{stdio:['ignore','pipe','pipe']});
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
  const checkResponsive = async stage => {
    for (const width of [1440, 1024, 768, 390, 320]) {
      await send('browsingContext.setViewport', { context, viewport: { width, height: 900 }, devicePixelRatio: 1 });
      await new Promise(resolve => setTimeout(resolve, 350));
      const overflow = await evaluate(`JSON.stringify([...document.querySelectorAll('.expenditure-page, .expenditure-page input, .expenditure-page button, .expenditure-page .bp-card, .expenditure-page .bp-table')].filter(el => !el.closest('table')).filter(el => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).map(el => el.tagName + '.' + el.className))`);
      assert.deepEqual(JSON.parse(overflow), [], stage + ' overflow at ' + width);
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, stage + ' page overflow at ' + width);
      if (width === 390 || width === 1440) {
        await evaluate(JSON.stringify(stage === 'csv' ? '.expenditure-csv' : stage === 'manual' ? 'form' : '.expenditure-history') + '.split("|").forEach(selector => document.querySelector(selector)?.scrollIntoView({block: "start"}))');
        const shot = await send('browsingContext.captureScreenshot', { context });
        fs.writeFileSync('/tmp/chainshield-' + stage + '-' + width + '.png', Buffer.from(shot.data, 'base64'));
      }
    }
    await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 900 }, devicePixelRatio: 1 });
    console.log('PASS ' + stage + ' spacing/overflow at 320, 390, 768, 1024, 1440px');
  };
  const navigate=async route=>send('browsingContext.navigate',{context,url:`http://127.0.0.1:${port}${route}`,wait:'complete'});

  await navigate('/dashboard/approved-budgets');
  await wait('document.body.textContent.includes("Approved Road Repairs")');
  assert.equal(await evaluate('[...document.querySelectorAll(".nav-label")].some(n => n.textContent === "Integrity Checker" || n.textContent === "Transactions")'), false);
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "View Budget").click()');
  await wait('!!document.querySelector("#expenditure-entry form")');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Cancel expenditure").click()');
  await wait('[...document.querySelectorAll("button")].some(b => b.textContent === "Record Expenditure")');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Record Expenditure").click()');
  await wait('!!document.querySelector("form")');
  assert.equal(await evaluate('document.activeElement?.id'), 'expenditure-entry');
  assert.equal(await evaluate(`document.querySelector('[aria-controls="expenditure-entry"]').getAttribute('aria-expanded')`), 'true');

  assert.equal(await evaluate('document.querySelector("form button.bp-primary").disabled'), true);
  assert.equal(await evaluate('document.querySelector("form").textContent.includes("Approved allocation")'), false);
  await evaluate(`(() => {
    const values = ['60', '2026-10-20T10:00', 'Barangay', 'Supplier', 'LGU', 'Road repairs', 'Road materials'];
    document.querySelectorAll('form input[required]').forEach((el, i) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, values[i]); el.dispatchEvent(new Event('input', { bubbles: true })); });
    const transfer = new DataTransfer(); transfer.items.add(new File(['%PDF-1.4 fixture %%EOF'], 'receipt.pdf', { type: 'application/pdf' }));
    const upload = document.querySelector('form input[type=file]'); upload.files = transfer.files; upload.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await wait('document.querySelectorAll("form input[type=checkbox]").length === 2');
  assert.equal(await evaluate('document.querySelector("form button.bp-primary").disabled'), true);
  assert.equal(await evaluate('document.querySelector("form").textContent.includes("Approved allocation")'), false);
  await evaluate('document.querySelectorAll("form input[type=checkbox]").forEach(c => c.click())');
  await wait('!document.querySelector("form button.bp-primary").disabled');
  await checkResponsive('manual');
  await evaluate('document.querySelector("form").requestSubmit()');
  await wait('document.querySelectorAll("tbody tr").length === 1');
  assert.equal(submissions, 1);
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "View details").click()');
  await wait('document.body.textContent.includes("Financial details assessed")');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Download for manual review").click()');
  await wait('window.__downloads === 1');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b => b.textContent === "Verify")'), false);
  assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b => b.textContent === "Upload Audit Evidence")'), false);
  console.log('PASS Treasurer navigation, embedded form, both evidence requirements, submission, original AI explanations and download');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Record Expenditure").click()');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Upload CSV").click()');
  await wait('!![...document.querySelectorAll("input")].find(i => i.getAttribute("aria-label") === "Expenditure CSV file")');
  assert.equal(await evaluate(`!!document.querySelector('input[aria-label="CSV expenditure evidence"]')`), true);
  await evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File(['%PDF-1.4 shared invoice %%EOF'], 'supporting_document_' + 'long_filename_'.repeat(12) + '.pdf', { type: 'application/pdf' })); const input = document.querySelector('input[aria-label="CSV expenditure evidence"]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File(['invalid'], 'expenses.txt', { type: 'text/plain' })); const input = document.querySelector('input[aria-label="Expenditure CSV file"]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await wait('document.querySelector(".expenditure-csv [role=alert]")?.textContent.includes("Choose a CSV file")');
  assert.equal(await evaluate('document.querySelectorAll(".expenditure-csv tbody tr").length'), 0);
  await evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File(['Date,Agency,Program Name,Payer Name,Payee Name,Debit Amount,Credit Amount,Description\\n2026-10-20,LGU,Repairs,Office,Supplier,10,0,Materials'], 'expenses.csv', { type: 'text/csv' })); const input = document.querySelector('input[aria-label="Expenditure CSV file"]'); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  assert.equal(await evaluate('[...document.querySelectorAll("button")].some(b => b.textContent === "Preview CSV")'), false);
  await wait('document.body.textContent.includes("2 expenditures found")');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.includes("Submit CSV Expenditures")).disabled'), true);
  assert.equal(await evaluate('document.querySelectorAll(".expenditure-csv .expenditure-file").length'), 1);

  assert.equal(await evaluate('document.querySelectorAll(".expenditure-csv fieldset input[type=checkbox]").length'), 0);
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "These documents apply to every row").click()');
  await wait('![...document.querySelectorAll("button")].find(b => b.textContent.includes("Submit CSV Expenditures")).disabled');
  await checkResponsive('csv');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent.includes("Submit CSV Expenditures")).click()');
  await wait('document.querySelectorAll("tbody tr").length === 3');
  assert.equal(csvSubmissions, 1);
  console.log('PASS CSV entry choice, preview, required per-row evidence, shared-document selection and batch submission');
  expenditure.evidence.push(
    { ...expenditure.evidence[0], _id: 'image-fixture', originalName: 'receipt.png', mimeType: 'image/png' },
    { ...expenditure.evidence[0], _id: 'docx-fixture', originalName: 'delivery.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
  );
  mode = 'auditor';
  await navigate('/dashboard/approved-budgets/111111111111111111111111');
  await wait('document.querySelectorAll("tbody tr").length === 3');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "View details").click()');
  await wait('[...document.querySelectorAll("button")].some(b => b.textContent === "Verify")');
  await wait('document.activeElement?.classList.contains("expenditure-details")');
  assert.equal(await evaluate('(() => { const rect = document.querySelector("#expenditure-details-title").getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= innerHeight; })()'), true);
  await evaluate('window.scrollTo(0, 0); [...document.querySelectorAll("button")].find(b => b.textContent === "View details").click()');
  await wait('document.querySelector("#expenditure-details-title").getBoundingClientRect().bottom <= innerHeight');

  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Reject").disabled'), true);
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Request Correction").disabled'), true);
  const downloadsBeforePreview = await evaluate('window.__downloads');
  for (const [filename, loaded] of [
    ['receipt.pdf', 'document.querySelector(".evidence-preview iframe")?.src.startsWith("blob:")'],
    ['receipt.png', 'document.querySelector(".evidence-preview img")?.naturalWidth > 0'],
    ['delivery.docx', 'document.querySelector(".evidence-preview-document")?.textContent.includes("Delivery receipt: road repair materials received.")']
  ]) {
    await evaluate(`(() => { const card = [...document.querySelectorAll('.expenditure-document')].find(el => el.querySelector('strong')?.textContent === ${JSON.stringify(filename)}); [...card.querySelectorAll('button')].find(b => b.textContent === 'View evidence').click(); })()`);
    await wait('!!document.querySelector("dialog[open]")');
    await wait(loaded);
    await send('browsingContext.setViewport', { context, viewport: { width: 390, height: 844 }, devicePixelRatio: 1 });
    assert.equal(await evaluate('(() => { const r = document.querySelector("dialog").getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; })()'), true);
    if (filename === 'delivery.docx') {
      const shot = await send('browsingContext.captureScreenshot', { context });
      fs.writeFileSync('/tmp/chainshield-evidence-preview-mobile.png', Buffer.from(shot.data, 'base64'));
    }
    await send('browsingContext.setViewport', { context, viewport: { width: 1280, height: 900 }, devicePixelRatio: 1 });

    await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Close preview").click()');
    await wait('!document.querySelector(".evidence-preview")');
    assert.equal(await evaluate('document.activeElement?.textContent'), 'View evidence');
  }
  assert.equal(await evaluate('window.__downloads'), downloadsBeforePreview);
  console.log('PASS in-app PDF, image and Word text evidence previews without downloading');
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Verify").click()');
  await wait('document.querySelector("tbody").textContent.includes("verified")');
  assert.equal(reviews, 1);
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Upload Audit Evidence").click()');
  await wait('!!document.querySelector("form textarea")');
  assert.equal(await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Save Audit Evidence").disabled'), true);
  await evaluate(`(() => {
    const input = document.querySelector('form input[type=file]'); const transfer = new DataTransfer(); transfer.items.add(new File(['%PDF-1.4 inspection %%EOF'], 'inspection.pdf', { type: 'application/pdf' })); input.files = transfer.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    const area = document.querySelector('form textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, 'Inspection confirms completed work'); area.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await wait('![...document.querySelectorAll("button")].find(b => b.textContent === "Save Audit Evidence").disabled');
  await evaluate('document.querySelector("form").requestSubmit()');
  await wait('document.body.textContent.includes("Auditor Fixture")');
  assert.equal(expenditure.reviewStatus, 'verified'); assert.equal(submissions, 1); assert.equal(reviews, 1);
  await evaluate('[...document.querySelectorAll("button")].find(b => b.textContent === "Download Auditor evidence").click()');
  await wait('window.__downloads === 1');
  console.log('PASS Auditor evidence upload after verification, explanation, metadata, download and unchanged decision');
  await checkResponsive('review');
  await send('browsingContext.setViewport', { context, viewport: { width: 390, height: 844 }, devicePixelRatio: 1 });
  const screenshot = await send('browsingContext.captureScreenshot', { context }); fs.writeFileSync('/tmp/chainshield-expenditure-mobile.png', Buffer.from(screenshot.data, 'base64'));
  assert.deepEqual(errors, []);
  console.log('PASS auditor review, required adverse reasons, refreshed status and browser error check');
  await send('session.end');
 } finally { if (socket) socket.close(); firefox.kill(); server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; server.close(); });
