const API_BASE=(window.UM_API_BASE||'/api').replace(/\/$/,'');
const materials=[{id:'iron',group:'Ferrous',name:'Iron',icon:'🔩',rate:38,unit:'kg',trend:'up',delta:'+₹2'},{id:'steel',group:'Ferrous',name:'Steel',icon:'🏗️',rate:42,unit:'kg',trend:'flat',delta:'steady'},{id:'aluminium',group:'Non-Ferrous',name:'Aluminium',icon:'🥫',rate:155,unit:'kg',trend:'up',delta:'+₹5'},{id:'copper',group:'Non-Ferrous',name:'Copper',icon:'🟠',rate:690,unit:'kg',trend:'up',delta:'+₹12'},{id:'brass',group:'Non-Ferrous',name:'Brass',icon:'🟡',rate:510,unit:'kg',trend:'flat',delta:'steady'},{id:'lithium',group:'Critical Minerals',name:'Lithium-bearing battery',icon:'🔋',rate:125,unit:'kg',trend:'up',delta:'+₹4'},{id:'magnet',group:'Critical Minerals',name:'Magnet / rare-earth bearing',icon:'🧲',rate:180,unit:'kg',trend:'flat',delta:'indicative'},{id:'pcb',group:'E-Waste',name:'PCB',icon:'🟩',rate:310,unit:'kg',trend:'up',delta:'+₹8'},{id:'cable',group:'E-Waste',name:'Copper cable & wire',icon:'🔌',rate:265,unit:'kg',trend:'up',delta:'+₹6'},{id:'panel',group:'E-Waste',name:'LCD / LED panel',icon:'🖥️',rate:72,unit:'kg',trend:'flat',delta:'steady'},{id:'battery',group:'E-Waste',name:'Battery',icon:'🔋',rate:92,unit:'kg',trend:'down',delta:'−₹3'},{id:'mixedmetal',group:'Mixed Scrap',name:'Mixed metal',icon:'🧰',rate:55,unit:'kg',trend:'flat',delta:'steady'}];
const facilities=[];const state={lots:JSON.parse(localStorage.getItem('um_lots')||'[]'),lang:localStorage.getItem('um_lang')||'Hindi',ready:false,user:null};
function save(){localStorage.setItem('um_lots',JSON.stringify(state.lots))}function fmt(n){return '₹'+Number(n||0).toLocaleString('en-IN')}function speak(t){if('speechSynthesis'in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang=state.lang==='Marathi'?'mr-IN':'hi-IN';speechSynthesis.speak(u)}}
async function api(path,options={}){const r=await fetch(API_BASE+path,{credentials:'include',headers:{'Content-Type':'application/json',...(options.headers||{})},...options});if(!r.ok)throw new Error(await r.text()||('HTTP '+r.status));return r.json()}
async function refreshNotificationCount(){if(!state.user)return;try{const d=await api('/notifications');const el=document.getElementById('notificationCount');if(el)el.textContent=d.unread?`(${d.unread})`:''}catch(e){}}
async function hydrate(){try{const d=await api('/bootstrap');if(d.materials?.length)materials.splice(0,materials.length,...d.materials);if(d.facilities?.length)facilities.splice(0,facilities.length,...d.facilities);if(Array.isArray(d.lots)){state.lots=d.lots;save()}state.user=d.user||null;state.ready=true;window.dispatchEvent(new CustomEvent('um:ready',{detail:d}));updateAuthUI();updateNav();refreshNotificationCount()}catch(e){state.ready=false;window.dispatchEvent(new CustomEvent('um:ready',{detail:null}));updateAuthUI()}}
function whenReady(fn){if(state.ready)fn();else window.addEventListener('um:ready',fn,{once:true})}
let shellActive='Home';
function shell(active){shellActive=active;document.write(`<header class="topbar"><a class="brand" href="index.html"><span class="brandmark">♻</span><span>Urban Mining Connect</span></a><div class="profile"><span class="badge blue">SECONDARY RAW MATERIALS</span><a class="btn btn-soft" href="notifications.html" id="notificationBell" aria-label="Notifications">🔔 <span id="notificationCount"></span></a><span id="authArea"><a class="btn btn-soft" href="login.html">Login</a></span></div></header><nav class="nav" id="mainNav"></nav>`);updateNav()}
function updateNav(){
 const u=state.user;let items=[];
 const add=(label,url,key)=>items.push(`<a href="${url}" class="${shellActive===key?'active':''}">${label}</a>`);
 add('⌂ Home','index.html','Home');
 if(u?.role==='buyer'){
   add('▤ Sourcing Hub','buyer-needs.html','Sourcing Hub');
   add('▣ Buyer Console','console.html','Buyer Console');
   add('◈ Materials','materials.html','Materials');
   add('₹ Valuation','prices.html','Valuation');
   add('✉ Messenger','messenger.html','Messenger');
 }else if(u?.role==='collector'){
   add('＋ Capture','capture.html','Capture');
   add('▤ Demand Board','collector-needs.html','Demand Board');
   add('◈ Materials','materials.html','Materials');
   add('₹ Valuation','prices.html','Valuation');
   add('✓ Buyers','matches.html','Buyers');
   add('✉ Messenger','messenger.html','Messenger');
   add('⌁ Traceability','handover.html','Traceability');
   add('◔ Recovery','recovery.html','Recovery');
   add('▣ Ledger','earnings.html','Earnings');
 }else if(u?.role==='admin'){
   add('▦ Admin Dashboard','admin.html','Admin');
 }else{
   add('＋ Capture','capture.html','Capture');
   add('◈ Materials','materials.html','Materials');
   add('₹ Valuation','prices.html','Valuation');
   add('✓ Buyers','matches.html','Buyers');
   add('✉ Messenger','messenger.html','Messenger');
 }
 const nav=document.getElementById('mainNav');if(nav)nav.innerHTML=items.join('');
}
function updateAuthUI(){const el=document.getElementById('authArea');if(!el)return;if(state.user){const label=state.user.role==='admin'?'Admin':(state.user.role==='buyer'?'Buyer':'Collector');const home=state.user.role==='admin'?'admin.html':(state.user.role==='buyer'?'console.html':'index.html');el.innerHTML=`<a class="badge ok" href="${home}">${label}: ${state.user.name}</a> <button class="btn btn-soft" onclick="logout()">Logout</button>`}else el.innerHTML='<a class="btn btn-soft" href="login.html">Login</a> <a class="btn btn-primary" href="signup.html">Sign up</a>';updateNav()}
async function logout(){try{await api('/auth/logout',{method:'POST'})}catch(e){}state.user=null;localStorage.removeItem('um_lots');location.href='login.html'}
async function requireAuth(role){try{const d=await api('/auth/me');state.user=d.user;if(!state.user){location.href='login.html?next='+encodeURIComponent(location.pathname+location.search);return false}if(role&&state.user.role!==role){location.href=state.user.role==='buyer'?'console.html':'index.html';return false}updateAuthUI();updateNav();return true}catch(e){location.href='login.html';return false}}
async function requireMessengerAuth(){try{const d=await api('/auth/me');state.user=d.user;if(!state.user){location.href='login.html?next='+encodeURIComponent(location.pathname+location.search);return false}if(!['buyer','collector'].includes(state.user.role)){location.href=state.user.role==='admin'?'admin.html':'login.html';return false}updateAuthUI();updateNav();return true}catch(e){location.href='login.html';return false}}
hydrate();
