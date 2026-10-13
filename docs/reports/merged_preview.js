const RES=['users','orders','inventory','auth','analytics'], METHODS=['GET','POST','PUT','DELETE','PATCH'];
function fmt(ms){return ms>=1000?(ms/1000).toFixed(2)+'s':ms+'ms';}
function build(i){
  const avg=[10090,7880,2250,1500,386,540][i] ?? (90+i*40);
  const isErr=i%4===0, method=METHODS[i%5], res=RES[i%5], endpoint=`/api/v1/${res}/${i+100}`;
  const spans=[
    {name:'Nginx Ingress',dur:8,type:'proxy',meta:'SSL/TLS Termination · Nginx 1.25 · QUIC'},
    {name:'JWT Verify',dur:38,type:'app',meta:'HS256 · Exp 1h · user_id=1024'},
    {name:'Redis: Session Lookup',dur:6,type:'cache',meta:`GET user:session:1024 → ${isErr?'MISS':'HIT'} · TTL 3600s`},
    {name:'PG: SELECT users',dur:Math.max(40,Math.round(avg*0.55)),type:'db',meta:'SELECT id,email,role FROM users WHERE id=$1 · Read Replica'},
    isErr?{name:'PG: Query (failed)',dur:118,type:'db',meta:'deadlock detected · rollback',err:true}
         :{name:'Serialize + Gzip',dur:14,type:'app',meta:'JSON.stringify · gzip → 2.1KB'}
  ];
  const logs=[
    {ts:'14:20:01.102',lvl:'INFO',msg:`→ ${method} ${endpoint}`},
    {ts:'14:20:01.106',lvl:'INFO',msg:'Auth: JWT verified · user_id=1024 · role=user'},
    isErr?{ts:'14:20:01.224',lvl:'ERROR',msg:'PG error: deadlock detected · SQLSTATE 40P01 · rolling back txn'}
         :{ts:'14:20:01.224',lvl:'DEBUG',msg:'Cache HIT: user:session:1024 · skipped DB read'},
    {ts:'14:20:01.240',lvl:isErr?'ERROR':'INFO',msg:`← ${isErr?500:200} · ${fmt(avg)} · gzip 2.1KB`}
  ];
  return { i,method,endpoint,res,status:isErr?500:200,isErr, avg,
    p50:Math.round(avg*0.8),p95:Math.round(avg*1.4),p99:Math.round(avg*2.1),
    calls:[5000,12400,8200,5100,21800,4700][i]??5000, version:'1.0', country:['US','DE','JP','GB','AU'][i%5], spans, logs,
    rum:{lcp:[1.8,2.4,3.1,1.2,0.9,2.0][i]??1.5,fid:[28,64,110,18,12,40][i]??30,cls:[0.04,0.08,0.14,0.02,0.01,0.06][i]??0.05,browser:i%2===0?'Chrome 122':'Safari 17.4',device:i%2===0?'macOS Desktop':'iPhone 15 Pro'},
    rules:isErr?['SQL Injection Suspicion','Rate Limit Warning']:[],
    payload:{headers:{'Content-Type':'application/json','Authorization':'Bearer eyJhbGciOiJIUzI1Ni...','X-Request-ID':`req_${(i*7919).toString(36)}`,'Accept-Encoding':'gzip, deflate, br'},
             body:method==='GET'?null:{action:'update_profile',data:{email:'user@example.com',role:'user'}},
             response:{status:isErr?500:200,success:!isErr,data:{processed_at:'2026-06-04T14:20:01.240Z'},meta:{took_ms:avg}}},
    ai:isErr?'Trace failed at the PG span — deadlock (40P01). Two transactions contended on the users row lock. Recommend retry-with-backoff on the writer and a shorter lock_timeout.'
       :avg>4000?`P99 latency (${fmt(avg*2.1)}) is dominated by the PG SELECT span. EXPLAIN ANALYZE reveals a sequential scan on ~3,200 rows. Immediate fix: partial index on user_id WHERE status='active'.`
       :`Trace is healthy. Cache HIT rate 96.2% · DB P99 under SLO · No WAF events in last 24h.`,
    anomaly:isErr };
}
const T=Array.from({length:6},(_,i)=>build(i));
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');

function rTrace(t){
  const total=t.spans.reduce((a,s)=>a+s.dur,0); let off=0;
  const bars=t.spans.map(s=>{const w=Math.max(4,(s.dur/total)*100),left=(off/total)*100;off+=s.dur;
    return `<div class="span"><div class="sname"><span class="stype t-${s.type}"></span>${esc(s.name)}</div>
      <div><div class="sbar-track"><div class="sbar ${s.err?'err':s.type}" style="left:${left}%;width:${w}%">${fmt(s.dur)}</div></div>
      <div class="smeta">${esc(s.meta)}</div></div></div>`;}).join('');
  const svc=t.spans.map((s,k)=>`<div class="svcnode ${k>0?'ind':''}">${s.name.split(':')[0]}<span class="nd">${fmt(s.dur)}</span></div>`).join('');
  const ai=`<div class="ai"><span>✦</span><div><div class="at">Apex Intelligence <span class="gpt">GPT-4o</span></div><div class="ap">${esc(t.ai)}</div></div>${t.anomaly?'<div class="flag">⚠<br>Anomaly</div>':''}</div>`;
  return ai+`<div class="wf-svc">
      <div class="wfbox"><div class="boxh">Request Waterfall · ${t.spans.length} spans · ${fmt(total)} total</div>${bars}</div>
      <div class="svcbox"><div class="boxh">Service Graph</div>${svc}</div></div>`;
}
function rLogs(t){return t.logs.map(l=>`<div class="logln"><span class="ts">${l.ts}</span><span class="lvl ${l.lvl}">${l.lvl}</span><span class="logmsg">${esc(l.msg)}</span></div>`).join('');}
function jh(o){return JSON.stringify(o,null,2).replace(/"([^"]+)":/g,'<span class="jk">"$1"</span>:').replace(/: "([^"]*)"/g,': <span class="js">"$1"</span>').replace(/: (\d+\.?\d*)/g,': <span class="jn">$1</span>').replace(/: (true|false|null)/g,': <span class="jb">$1</span>');}
function rPay(t){return `<div class="psub">Request Headers</div><pre>${jh(t.payload.headers)}</pre><div class="psub">Request Body</div><pre>${t.payload.body?jh(t.payload.body):'<span style="color:var(--textDim)">— no body (GET) —</span>'}</pre><div class="psub">Response</div><pre>${jh(t.payload.response)}</pre>`;}
function rRum(t){const a=t.rum.lcp<=2.5?'g':'y',b=t.rum.fid<=100?'g':'y',c=t.rum.cls<=0.1?'g':'y';
  return `<div class="rumgrid">
   <div class="rumc"><div class="rl">LCP</div><div class="rv ${a}">${t.rum.lcp}s</div><div class="rmeta">target ≤ 2.5s</div></div>
   <div class="rumc"><div class="rl">FID</div><div class="rv ${b}">${t.rum.fid}ms</div><div class="rmeta">target ≤ 100ms</div></div>
   <div class="rumc"><div class="rl">CLS</div><div class="rv ${c}">${t.rum.cls}</div><div class="rmeta">target ≤ 0.1</div></div>
   <div class="rumc"><div class="rl">Browser</div><div class="rv" style="font-size:15px;color:var(--textMain)">${t.rum.browser}</div></div>
   <div class="rumc"><div class="rl">Device</div><div class="rv" style="font-size:15px;color:var(--textMain)">${t.rum.device}</div></div>
   <div class="rumc"><div class="rl">Geo</div><div class="rv" style="font-size:15px;color:var(--textMain)">${t.country}</div></div></div>`;}
function rSec(t){let r=t.rules.length===0
   ?`<div class="secrow ok"><div class="sic">✓</div><div><div class="st2">No WAF rules triggered</div><div class="ss">Passed all security checks · not blocked</div></div></div>`
   :t.rules.map(x=>`<div class="secrow warn"><div class="sic">⚠</div><div><div class="st2">${esc(x)}</div><div class="ss">Flagged · monitored (not blocked)</div></div></div>`).join('');
  return r+`<div class="audit-note">🛡 <b>Enterprise:</b> opening this detail (payload + JWT claims) is written to the tamper-evident audit log — actor, trace id, timestamp. Tenant-scoped via <code>tenantIsolation</code>.</div>`;}

function fillPanes(pre,t){
  document.getElementById(pre+'trace').innerHTML=rTrace(t);
  document.getElementById(pre+'logs').innerHTML=rLogs(t);
  document.getElementById(pre+'payload').innerHTML=rPay(t);
  document.getElementById(pre+'rum').innerHTML=rRum(t);
  document.getElementById(pre+'sec').innerHTML=rSec(t);
}

// Layout A
document.getElementById('eplistA').innerHTML=T.map(t=>`<div class="epitem ${t.isErr?'err':''}" data-i="${t.i}" onclick="selA(${t.i})">
  <div class="r1"><span class="meth m-${t.method}">${t.method}</span><span class="ver">v${t.version}</span><span class="stt ${t.isErr?'err':'ok'}">${t.status} ${t.isErr?'⚠':''}</span></div>
  <div class="ep">${t.endpoint}</div><div class="dur">⏱ ${fmt(t.avg)}</div><div class="sparkbar"></div></div>`).join('');
function selA(i){const t=T[i];
  document.querySelectorAll('#eplistA .epitem').forEach(e=>e.classList.toggle('sel',+e.dataset.i===i));
  const m=document.getElementById('aMeth'); m.className='meth m-'+t.method; m.textContent=t.method;
  document.getElementById('aEp').textContent=t.endpoint;
  document.getElementById('aP50v').textContent=fmt(t.p50);document.getElementById('aP95v').textContent=fmt(t.p95);document.getElementById('aP99v').textContent=fmt(t.p99);
  document.getElementById('aChips').innerHTML=`<span class="dchip ${t.isErr?'err':'ok'}">${t.isErr?'⊘':'✓'} ${t.status}</span><span class="dchip">P50 ${fmt(t.p50)}</span><span class="dchip" style="color:var(--warning)">P99 ${fmt(t.p99)}</span><span class="dchip"># ${t.calls.toLocaleString()} CALLS</span><span class="dchip">⑂ v${t.version}</span><span class="dchip">🌐 ${t.country}</span>`;
  fillPanes('A-',t);
}

// Layout B
document.getElementById('rowsB').innerHTML=T.map(t=>`<tr class="trow" data-i="${t.i}" onclick="selB(${t.i})">
  <td><span class="meth m-${t.method}">${t.method}</span></td><td><span class="ep2">${t.endpoint}</span></td>
  <td><span class="st ${t.isErr?'err':'ok'}">${t.status}</span></td><td><span class="dur2">${fmt(t.avg)}</span></td>
  <td><span class="dur2">${fmt(t.p95)}</span></td><td><span class="dur2">${fmt(t.p99)}</span></td><td>${t.calls.toLocaleString()}</td></tr>`).join('');
function selB(i){const t=T[i];
  document.querySelectorAll('#rowsB .trow').forEach(r=>r.classList.toggle('sel',+r.dataset.i===i));
  document.getElementById('bEp').textContent=`${t.method} ${t.endpoint}`;
  document.getElementById('bCrumb').textContent=`${t.method} ${t.res}`;
  fillPanes('B-',t);
  document.getElementById('detailB').classList.add('show');
}
function closeB(){document.getElementById('detailB').classList.remove('show');document.querySelectorAll('#rowsB .trow').forEach(r=>r.classList.remove('sel'));}

function wireDt(barId,pre){document.querySelectorAll('#'+barId+' .dt').forEach(d=>d.addEventListener('click',()=>{
  document.querySelectorAll('#'+barId+' .dt').forEach(x=>x.classList.remove('active')); d.classList.add('active');
  ['trace','logs','payload','rum','sec'].forEach(p=>document.getElementById(pre+p).classList.remove('active'));
  document.getElementById(pre+d.dataset.dt).classList.add('active');
}));}
wireDt('dtA','A-'); wireDt('dtB','B-');

document.querySelectorAll('#themeSeg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#themeSeg button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  document.body.setAttribute('data-theme',b.dataset.th);
}));
document.querySelectorAll('#layoutSeg button').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('#layoutSeg button').forEach(x=>x.classList.remove('on')); b.classList.add('on');
  document.getElementById('layoutA').classList.toggle('show',b.dataset.ly==='A');
  document.getElementById('layoutB').classList.toggle('show',b.dataset.ly==='B');
}));

selA(0); selB(0);
