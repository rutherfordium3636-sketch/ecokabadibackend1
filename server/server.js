const http=require('http');const fs=require('fs');const path=require('path');const crypto=require('crypto');
const ROOT=path.join(__dirname,'..');const DATA=path.join(__dirname,'data');const DB=path.join(DATA,'db.json');const UP=path.join(DATA,'uploads');
fs.mkdirSync(UP,{recursive:true});
const seedMaterials=[
{id:'iron',group:'Ferrous',name:'Iron',icon:'🔩',rate:38,unit:'kg',trend:'up',delta:'+₹2',source_type:'seed'},
{id:'steel',group:'Ferrous',name:'Steel',icon:'🏗️',rate:42,unit:'kg',trend:'flat',delta:'steady',source_type:'seed'},
{id:'aluminium',group:'Non-Ferrous',name:'Aluminium',icon:'🥫',rate:155,unit:'kg',trend:'up',delta:'+₹5',source_type:'seed'},
{id:'copper',group:'Non-Ferrous',name:'Copper',icon:'🟠',rate:690,unit:'kg',trend:'up',delta:'+₹12',source_type:'seed'},
{id:'brass',group:'Non-Ferrous',name:'Brass',icon:'🟡',rate:510,unit:'kg',trend:'flat',delta:'steady',source_type:'seed'},
{id:'lithium',group:'Critical Minerals',name:'Lithium-bearing battery',icon:'🔋',rate:125,unit:'kg',trend:'up',delta:'+₹4',source_type:'seed'},
{id:'magnet',group:'Critical Minerals',name:'Magnet / rare-earth bearing',icon:'🧲',rate:180,unit:'kg',trend:'flat',delta:'indicative',source_type:'seed'},
{id:'pcb',group:'E-Waste',name:'PCB',icon:'🟩',rate:310,unit:'kg',trend:'up',delta:'+₹8',source_type:'seed'},
{id:'cable',group:'E-Waste',name:'Copper cable & wire',icon:'🔌',rate:265,unit:'kg',trend:'up',delta:'+₹6',source_type:'seed'},
{id:'panel',group:'E-Waste',name:'LCD / LED panel',icon:'🖥️',rate:72,unit:'kg',trend:'flat',delta:'steady',source_type:'seed'},
{id:'battery',group:'E-Waste',name:'Battery',icon:'🔋',rate:92,unit:'kg',trend:'down',delta:'−₹3',source_type:'seed'},
{id:'mixedmetal',group:'Mixed Scrap',name:'Mixed metal',icon:'🧰',rate:55,unit:'kg',trend:'flat',delta:'steady',source_type:'seed'}];
const seedFacilities=[
{id:'FAC-GREENLOOP',name:'GreenLoop Materials',type:'Authorized Recycler',dist:'8 km',rate:320,auth:'Authorization verified',score:96,pickup:true,materials:'E-waste • PCB • Cable',authorization_status:'active'},
{id:'FAC-SHAKTI',name:'Shakti Metal Recovery',type:'Authorized Processor',dist:'12 km',rate:48,auth:'Authorization verified',score:92,pickup:true,materials:'Iron • Steel • Aluminium',authorization_status:'active'},
{id:'FAC-URBANMET',name:'UrbanMet Secondarys',type:'Aggregator',dist:'5 km',rate:44,auth:'Registration verified',score:88,pickup:false,materials:'Ferrous • Mixed metal',authorization_status:'active'},
{id:'FAC-CIRCULAR',name:'Circular Minerals Hub',type:'Authorized Processor',dist:'21 km',rate:710,auth:'Authorization verified',score:94,pickup:true,materials:'Copper • Critical mineral streams',authorization_status:'active'}];
function load(){if(!fs.existsSync(DB)){const x={materials:seedMaterials,facilities:seedFacilities,users:[],lots:[],handovers:[],events:[]};fs.writeFileSync(DB,JSON.stringify(x,null,2));return x}const x=JSON.parse(fs.readFileSync(DB,'utf8'));x.materials??=seedMaterials;x.facilities??=seedFacilities;x.users??=[];x.lots??=[];x.handovers??=[];x.events??=[];return x}
let db=load();
function ensureDemoAdmin(){
  if(!db.users.some(u=>u.role==='admin')){
    const hp=hashPassword('Admin@12345');
    db.users.push({
      id:'USR-ADMIN',
      name:'Urban Mining Admin',
      email:'admin@urbanmining.local',
      phone:'',
      role:'admin',
      password_salt:hp.salt,
      password_hash:hp.hash,
      created:new Date().toISOString(),
      active:true
    });
    persist();
  }
}
function persist(){fs.writeFileSync(DB,JSON.stringify(db,null,2))}
ensureDemoAdmin();
const sessions=new Map();
function corsHeaders(req){
 const origin=req.headers.origin||'';
 const allowed=(process.env.FRONTEND_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
 const ok=origin && (allowed.length===0 || allowed.includes(origin));
 return {
  'Access-Control-Allow-Origin': ok?origin:(allowed.length?allowed[0]:'*'),
  'Access-Control-Allow-Credentials':'true',
  'Vary':'Origin'
 };
}
function json(req,res,status,obj,extra={}){const body=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...corsHeaders(req),...extra});res.end(body)}
function csvEscape(v){return '"'+String(v??'').replaceAll('"','""')+'"'}
function body(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>15e6)req.destroy()});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}});req.on('error',reject)})}
function id(prefix='UM'){return prefix+'-'+crypto.randomBytes(4).toString('hex').toUpperCase()}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return {salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}}
function verifyPassword(password,user){return crypto.timingSafeEqual(Buffer.from(hashPassword(password,user.password_salt).hash,'hex'),Buffer.from(user.password_hash,'hex'))}
function cookies(req){const out={};for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out}
function sessionCookie(req,sid,maxAge){
 const cross=req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==`https://${req.headers.host}`;
 const secure=String(req.headers.origin||'').startsWith('https://');
 const sameSite=cross&&secure?'SameSite=None':'SameSite=Lax';
 return `um_session=${sid}; HttpOnly; ${sameSite}; Path=/${secure?'; Secure':''}${maxAge!=null?`; Max-Age=${maxAge}`:''}`;
}
function currentUser(req){const sid=cookies(req).um_session;const uid=sid&&sessions.get(sid);return uid?db.users.find(u=>u.id===uid)||null:null}
function publicUser(u){return u?{id:u.id,name:u.name,email:u.email,phone:u.phone||'',role:u.role,collector_id:u.collector_id||null,facility_id:u.facility_id||null,created:u.created}:null}
function requireUser(req,res,role){const u=currentUser(req);if(!u){json(req,res,401,{error:'Login required'});return null}if(role&&u.role!==role){json(req,res,403,{error:'This account does not have access to this area'});return null}return u}
async function api(req,res,url){
 const p=url.pathname;
 if(req.method==='POST'&&p==='/api/auth/signup'){
  const x=await body(req);const name=String(x.name||'').trim(),email=String(x.email||'').trim().toLowerCase(),password=String(x.password||''),role=x.role==='buyer'?'buyer':'collector';
  if(name.length<2||!email.includes('@')||password.length<6)return json(req,res,400,{error:'Enter a name, valid email and password of at least 6 characters'});
  if(db.users.some(u=>u.email===email))return json(req,res,409,{error:'An account with this email already exists'});
  const hp=hashPassword(password);const u={id:id('USR'),name,email,phone:String(x.phone||'').trim(),role,password_salt:hp.salt,password_hash:hp.hash,created:new Date().toISOString()};
  if(role==='collector')u.collector_id=id('COL');else{const f=db.facilities.find(f=>f.authorization_status==='active');u.facility_id=f?.id||'FAC-GREENLOOP'}
  db.users.push(u);persist();const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,u.id);return json(req,res,201,{user:publicUser(u)},{'Set-Cookie':sessionCookie(req,sid)})
 }
 if(req.method==='POST'&&p==='/api/auth/login'){
  const x=await body(req);const email=String(x.email||'').trim().toLowerCase(),password=String(x.password||'');const u=db.users.find(a=>a.email===email);if(!u||!verifyPassword(password,u))return json(req,res,401,{error:'Invalid email or password'});const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,u.id);return json(req,res,200,{user:publicUser(u)},{'Set-Cookie':sessionCookie(req,sid)})
 }
 if(req.method==='POST'&&p==='/api/auth/logout'){const sid=cookies(req).um_session;if(sid)sessions.delete(sid);return json(req,res,200,{ok:true},{'Set-Cookie':sessionCookie(req,'',0)})}
 if(req.method==='GET'&&p==='/api/auth/me')return json(req,res,200,{user:publicUser(currentUser(req))});
 if(req.method==='GET'&&p==='/api/bootstrap'){const u=currentUser(req);const lots=u&&u.role==='collector'?db.lots.filter(l=>l.user_id===u.id):[];return json(req,res,200,{materials:db.materials,facilities:db.facilities,lots,profile:u&&u.role==='collector'?{collector_id:u.collector_id,name:u.name,preferred_language:u.preferred_language||'Hindi',operating_area:u.operating_area||'Demo area'}:null,user:publicUser(u)});}
 if(req.method==='GET'&&p==='/api/materials')return json(req,res,200,db.materials);
 if(req.method==='GET'&&p==='/api/facilities')return json(req,res,200,db.facilities.filter(f=>f.authorization_status==='active'));
 if(req.method==='GET'&&p==='/api/lots'){const u=requireUser(req,res,'collector');if(!u)return;return json(req,res,200,db.lots.filter(l=>l.user_id===u.id));}
 if(req.method==='POST'&&p==='/api/lots'){
  const u=requireUser(req,res,'collector');if(!u)return;const x=await body(req);const m=db.materials.find(a=>a.id===x.category)||db.materials.find(a=>a.name===x.name);if(!m)return json(req,res,400,{error:'Unknown material'});const weight=Number(x.weight);if(!Number.isFinite(weight)||weight<=0)return json(req,res,400,{error:'Weight must be greater than zero'});const lot={id:x.id||id(),user_id:u.id,collector_id:u.collector_id,category:m.id,group:m.group,name:m.name,weight,rate:Number(x.rate)||m.rate,status:'created',created:x.created||new Date().toISOString(),photo_ref:null,quoted_price:null,facility_id:null,payment_status:'pending',transaction_status:'open',events:[]};if(x.photoData&&typeof x.photoData==='string'&&x.photoData.startsWith('data:image/')){const mt=x.photoData.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i);if(mt){const ext=mt[1]==='jpeg'?'jpg':mt[1];const file=lot.id+'.'+ext;fs.writeFileSync(path.join(UP,file),Buffer.from(x.photoData.split(',')[1],'base64'));lot.photo_ref='/server/data/uploads/'+file}}lot.events.push({type:'captured',at:new Date().toISOString(),by:u.id});db.lots.unshift(lot);persist();return json(req,res,201,lot)}
 if(req.method==='GET'&&p.startsWith('/api/lots/')){const u=requireUser(req,res,'collector');if(!u)return;const lot=db.lots.find(x=>x.id===decodeURIComponent(p.slice(10))&&x.user_id===u.id);if(!lot)return json(req,res,404,{error:'Lot not found'});return json(req,res,200,lot)}
 if(req.method==='POST'&&p==='/api/handovers'){
  const u=requireUser(req,res,'collector');if(!u)return;const x=await body(req);const lot=db.lots.find(l=>l.id===x.lot_id&&l.user_id===u.id)||db.lots.find(l=>l.user_id===u.id);if(!lot)return json(req,res,400,{error:'No lot available'});const buyer=x.facility_id?db.facilities.find(f=>f.name===x.facility_id||f.id===x.facility_id):db.facilities[0];const now=new Date().toISOString();const h={handover_id:id('HO'),lot_id:lot.id,collector_id:u.collector_id,facility_id:buyer?.id||'FAC-GREENLOOP',facility_name:buyer?.name||'GreenLoop Materials',weight:lot.weight,quoted_price:x.quoted_price??lot.rate,final_price:x.final_price??x.quoted_price??lot.rate,confirmed_at:now,payment_status:x.payment_status||'pending',reference:crypto.randomBytes(3).toString('hex').toUpperCase(),append_only:true};db.handovers.push(h);lot.status='confirmed';lot.transaction_status='completed';lot.facility_id=h.facility_id;lot.quoted_price=h.quoted_price;lot.final_price=h.final_price;lot.payment_status=h.payment_status;lot.handover_at=now;lot.events.push({type:'handover_confirmed',at:now,reference:h.reference,by:u.id});persist();return json(req,res,201,h)}
 if(req.method==='GET'&&p==='/api/earnings'){const u=requireUser(req,res,'collector');if(!u)return;const tx=db.lots.filter(l=>l.user_id===u.id&&l.transaction_status==='completed');const paid=tx.filter(l=>l.payment_status==='paid').reduce((a,l)=>a+(l.final_price||l.rate)*l.weight,0);const pending=tx.filter(l=>l.payment_status!=='paid').reduce((a,l)=>a+(l.final_price||l.rate)*l.weight,0);return json(req,res,200,{earned:paid,pending,average:tx.length?tx.reduce((a,l)=>a+(l.final_price||l.rate)*l.weight,0)/tx.length:0,lots:tx})}
 if(req.method==='GET'&&p==='/api/recovery'){const u=requireUser(req,res,'collector');if(!u)return;const lots=db.lots.filter(l=>l.user_id===u.id),captured=lots.reduce((a,l)=>a+l.weight,0),recovered=lots.filter(l=>l.transaction_status==='completed').reduce((a,l)=>a+l.weight,0);const by={};for(const l of lots.filter(l=>l.transaction_status==='completed'))by[l.group]=(by[l.group]||0)+l.weight;return json(req,res,200,{captured,recovered,traceable:lots.length?Math.round(lots.filter(l=>l.transaction_status==='completed').length/lots.length*100):0,authorizedRoute:lots.length?Math.round(lots.filter(l=>l.facility_id).length/lots.length*100):0,by})}
 if(req.method==='GET'&&p==='/api/console'){const u=requireUser(req,res,'buyer');if(!u)return;const facility=db.facilities.find(f=>f.id===u.facility_id)||db.facilities.find(f=>f.authorization_status==='active')||db.facilities[0];const incoming=db.lots.filter(l=>l.transaction_status==='open'||l.transaction_status==='quoted'||l.transaction_status==='accepted');const awaitingQuote=incoming.filter(l=>l.quoted_price==null).length;const acceptedByMe=db.lots.filter(l=>l.buyer_id===u.id&&l.transaction_status==='accepted').length;return json(req,res,200,{incoming,awaitingQuote,acceptedByMe,confirmedToday:db.lots.filter(l=>l.transaction_status==='completed'&&l.facility_id===facility?.id).length,facilities:db.facilities,facility,traceability:db.lots.length?Math.round(db.lots.filter(l=>l.transaction_status==='completed').length/db.lots.length*100):0,buyer:publicUser(u)});}
 if(req.method==='POST'&&p==='/api/console/quote'){const u=requireUser(req,res,'buyer');if(!u)return;const x=await body(req);const rate=Number(x.rate);if(!Number.isFinite(rate)||rate<=0)return json(req,res,400,{error:'Quote rate must be greater than zero'});const lot=db.lots.find(l=>l.id===x.lot_id);if(!lot)return json(req,res,404,{error:'Lot not found'});if(lot.transaction_status==='completed')return json(req,res,409,{error:'Lot is already completed'});const facility=db.facilities.find(f=>f.id===u.facility_id)||db.facilities.find(f=>f.authorization_status==='active')||db.facilities[0];lot.quoted_price=rate;lot.buyer_id=u.id;lot.buyer_name=u.name;lot.facility_id=facility?.id||null;lot.facility_name=facility?.name||null;lot.transaction_status='quoted';lot.events=lot.events||[];lot.events.push({type:'buyer_quote',at:new Date().toISOString(),by:u.id,rate});persist();return json(req,res,200,lot);}
 if(req.method==='POST'&&p==='/api/console/accept'){const u=requireUser(req,res,'buyer');if(!u)return;const x=await body(req);const lot=db.lots.find(l=>l.id===x.lot_id);if(!lot)return json(req,res,404,{error:'Lot not found'});if(lot.transaction_status==='completed')return json(req,res,409,{error:'Lot is already completed'});const facility=db.facilities.find(f=>f.id===u.facility_id)||db.facilities.find(f=>f.authorization_status==='active')||db.facilities[0];lot.buyer_id=u.id;lot.buyer_name=u.name;lot.facility_id=facility?.id||null;lot.facility_name=facility?.name||null;lot.quoted_price=Number(lot.quoted_price||lot.rate);lot.final_price=Number(lot.final_price||lot.quoted_price);lot.transaction_status='accepted';lot.status='accepted';lot.events=lot.events||[];lot.events.push({type:'buyer_accepted',at:new Date().toISOString(),by:u.id});persist();return json(req,res,200,lot);}
 if(req.method==='GET'&&p==='/api/profile'){const u=requireUser(req,res,'collector');if(!u)return;return json(req,res,200,{collector_id:u.collector_id,name:u.name,preferred_language:u.preferred_language||'Hindi',operating_area:u.operating_area||'Demo area'});}
 if(req.method==='PUT'&&p==='/api/profile'){const u=requireUser(req,res,'collector');if(!u)return;const x=await body(req);u.name=String(x.name||u.name).trim();u.preferred_language=x.preferred_language||u.preferred_language||'Hindi';u.operating_area=x.operating_area||u.operating_area||'Demo area';persist();return json(req,res,200,{collector_id:u.collector_id,name:u.name,preferred_language:u.preferred_language,operating_area:u.operating_area});}
 if(req.method==='GET'&&p==='/api/export/custody.csv'){const u=requireUser(req,res,'buyer');if(!u)return;const rows=[['lot_id','stream','material','weight','timestamp','status','facility','buyer_id','quoted_price','payment_status']];for(const l of db.lots)rows.push([l.id,l.group,l.name,l.weight,l.handover_at||l.created,l.transaction_status,l.facility_id||'',l.buyer_id||'',l.quoted_price??'',l.payment_status||'']);const csv=rows.map(r=>r.map(csvEscape).join(',')).join('\n');res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="urban-mining-custody-trail.csv"'});return res.end(csv)}
 if(req.method==='GET'&&p==='/api/admin/dashboard'){
  const u=requireUser(req,res,'admin');if(!u)return;
  return adminDashboard(req,res,u);
 }
 return json(req,res,404,{error:'API route not found'});
}
function safePath(p){const base=path.resolve(ROOT);const target=path.resolve(ROOT,p);return target.startsWith(base+path.sep)||target===base?target:null}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
function adminDashboard(req, res, user) {
  if (!user || user.role !== "admin") {
    return json(req, res, 403, { error: "Admin access required" });
  }

  const users = (db.users || []).map(u => ({
    id: u.id,
    user_id: u.id,
    name: u.name || "",
    email: u.email || "",
    phone: u.phone || "",
    role: u.role || "collector",
    created_at: u.created_at || u.created || null,
    active: u.active !== false
  }));

  const lots = db.lots || [];
  const completed = lots.filter(l => l.status === "completed" || l.transaction_status === "completed");
  const weightKg = lots.reduce((sum, l) => sum + Number(l.weight_kg || l.weight || 0), 0);
  const completedValue = completed.reduce((sum, l) =>
    sum + Number(l.final_price ?? l.quoted_price ?? l.value ?? 0) * Number(l.weight_kg ?? l.weight ?? 0), 0);

  return json(req, res, 200, {
    users,
    lots,
    handovers: db.handovers || [],
    stats: {
      totalUsers: users.length,
      collectors: users.filter(u => u.role === "collector").length,
      buyers: users.filter(u => u.role === "buyer" || u.role === "recycler").length,
      admins: users.filter(u => u.role === "admin").length,
      totalLots: lots.length,
      openLots: lots.length - completed.length,
      completedLots: completed.length,
      totalWeightKg: weightKg,
      completedValue,
      facilities: (db.facilities || []).length
    }
  });
}
const server=http.createServer(async(req,res)=>{try{if(req.method==='OPTIONS'){res.writeHead(204,{...corsHeaders(req),'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end()}const url=new URL(req.url,'http://localhost');if(url.pathname.startsWith('/api/'))return await api(req,res,url);let rel=decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.replace(/^\/+/,''));const file=safePath(rel);if(!file)return json(req,res,403,{error:'Forbidden'});fs.stat(file,(err,st)=>{if(err||!st.isFile())return json(req,res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream'});fs.createReadStream(file).pipe(res)})}catch(e){console.error(e);json(req,res,500,{error:'Server error',detail:e.message})}});
const PORT=process.env.PORT||8000;server.listen(PORT,()=>console.log(`Urban Mining Connect running at http://localhost:${PORT}`));
