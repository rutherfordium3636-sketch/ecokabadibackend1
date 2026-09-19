const http=require('http');const fs=require('fs');const path=require('path');const crypto=require('crypto');
let nodemailer=null;try{nodemailer=require('nodemailer')}catch{}
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

function load(){
 if(!fs.existsSync(DB)){const x={materials:seedMaterials,facilities:seedFacilities,users:[],lots:[],handovers:[],events:[]};fs.writeFileSync(DB,JSON.stringify(x,null,2));return x}
 const x=JSON.parse(fs.readFileSync(DB,'utf8'));x.materials??=seedMaterials;x.facilities??=seedFacilities;x.users??=[];x.lots??=[];x.handovers??=[];x.events??=[];x.notifications??=[];x.buyer_needs??=[];
 return x;
}
let db=load();

function persist(){fs.writeFileSync(DB,JSON.stringify(db,null,2))}
function safeText(v){return String(v??'').replace(/[<>]/g,'').slice(0,500)}
async function sendEmail(to,subject,text){
 if(!to||!process.env.SMTP_HOST||!process.env.SMTP_USER||!process.env.SMTP_PASS||!nodemailer)return {sent:false,reason:'SMTP is not configured'};
 try{const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:String(process.env.SMTP_SECURE||'false')==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});await transporter.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to,subject,text});return {sent:true}}
 catch(e){console.error('Notification email failed:',e.message);return {sent:false,reason:e.message}}
}
function notify(userId,type,title,message,meta={}){
 if(!userId)return;const n={id:id('NTF'),user_id:userId,type,title:safeText(title),message:safeText(message),meta,created_at:new Date().toISOString(),read:false,email_status:'pending'};
 db.notifications=db.notifications||[];db.notifications.unshift(n);persist();const user=db.users.find(u=>u.id===userId);
 sendEmail(user?.email,`Urban Mining Connect: ${n.title}`,`${n.message}\n\nSign in to Urban Mining Connect to view details.`).then(result=>{n.email_status=result.sent?'sent':'not_configured_or_failed';persist()});
}
function ensureDemoAdmin(){
 if(!db.users.some(u=>u.role==='admin')){
  const hp=hashPassword('Admin@12345');
  db.users.push({id:'USR-ADMIN',name:'Urban Mining Admin',email:'admin@urbanmining.local',phone:'',role:'admin',password_salt:hp.salt,password_hash:hp.hash,created:new Date().toISOString(),active:true});
  persist();
 }
}
ensureDemoAdmin();

const sessions=new Map();
function corsHeaders(req){
 const origin=req.headers.origin||'';const allowed=(process.env.FRONTEND_ORIGIN||'').split(',').map(x=>x.trim()).filter(Boolean);
 const ok=origin&&(allowed.length===0||allowed.includes(origin));
 return {'Access-Control-Allow-Origin':ok?origin:(allowed.length?allowed[0]:'*'),'Access-Control-Allow-Credentials':'true','Vary':'Origin'};
}
function json(req,res,status,obj,extra={}){const body=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...corsHeaders(req),...extra});res.end(body)}
function csvEscape(v){return '"'+String(v??'').replaceAll('"','""')+'"'}
function body(req){return new Promise((resolve,reject)=>{let b='';req.on('data',c=>{b+=c;if(b.length>15e6)req.destroy()});req.on('end',()=>{try{resolve(b?JSON.parse(b):{})}catch(e){reject(e)}});req.on('error',reject)})}
function id(prefix='UM'){return prefix+'-'+crypto.randomBytes(4).toString('hex').toUpperCase()}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){return {salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}}
function verifyPassword(password,user){return crypto.timingSafeEqual(Buffer.from(hashPassword(password,user.password_salt).hash,'hex'),Buffer.from(user.password_hash,'hex'))}
function cookies(req){const out={};for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out}
function sessionCookie(req,sid,maxAge){
 const cross=req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`;
 const secure=String(req.headers.origin||'').startsWith('https://');const sameSite=cross&&secure?'SameSite=None':'SameSite=Lax';
 return `um_session=${sid}; HttpOnly; ${sameSite}; Path=/${secure?'; Secure':''}${maxAge!=null?`; Max-Age=${maxAge}`:''}`;
}
function currentUser(req){const sid=cookies(req).um_session;const uid=sid&&sessions.get(sid);return uid?db.users.find(u=>u.id===uid)||null:null}
function publicUser(u){return u?{id:u.id,name:u.name,email:u.email,phone:u.phone||'',role:u.role,collector_id:u.collector_id||null,facility_id:u.facility_id||null,created:u.created}:null}
function requireUser(req,res,role){const u=currentUser(req);if(!u){json(req,res,401,{error:'Login required'});return null}if(role&&u.role!==role){json(req,res,403,{error:'This account does not have access to this area'});return null}return u}
function facilityForBuyer(u){return db.facilities.find(f=>f.id===u?.facility_id)||db.facilities.find(f=>f.authorization_status==='active')||db.facilities[0]||null}
function collectorForLot(lot){return db.users.find(u=>u.id===lot.user_id)||null}
function normalizeQuotes(lot){
 lot.quotes=Array.isArray(lot.quotes)?lot.quotes:[];
 if(!lot.quotes.length && Array.isArray(lot.events)){
  const events=lot.events.filter(e=>e.type==='buyer_quote');
  for(const e of events){
   const buyer=db.users.find(x=>x.id===e.by);const facility=buyer?db.facilities.find(f=>f.id===buyer.facility_id):null;
   lot.quotes.push({id:id('QT'),buyer_id:e.by,buyer_name:buyer?.name||lot.buyer_name||'Buyer',buyer_email:buyer?.email||'',facility_id:buyer?.facility_id||null,facility_name:facility?.name||'',rate:Number(e.rate||0),status:lot.buyer_id===e.by&&lot.transaction_status==='accepted'?'accepted':'pending',created_at:e.at,updated_at:e.at});
  }
 }
 return lot.quotes;
}
function quoteView(q){
 return {id:q.id,buyer_id:q.buyer_id,buyer_name:q.buyer_name||'Buyer',buyer_email:q.buyer_email||'',facility_id:q.facility_id||null,facility_name:q.facility_name||'',rate:Number(q.rate||0),status:q.status||'pending',created_at:q.created_at,updated_at:q.updated_at,counter_rate:q.counter_rate!=null?Number(q.counter_rate):null};
}
function messageView(m){return {id:m.id,lot_id:m.lot_id,quote_id:m.quote_id||null,sender_id:m.sender_id,sender_role:m.sender_role,message:m.message,created_at:m.created_at}}

async function api(req,res,url){
 const p=url.pathname;

 // Buyer Needs marketplace: buyers publish requirements; collectors quote.
 if(req.method==='GET'&&p==='/api/buyer/needs'){
  const u=requireUser(req,res,'buyer');if(!u)return;
  const needs=(db.buyer_needs||[]).filter(n=>n.buyer_id===u.id).map(n=>({...n,quotes:(n.quotes||[]).map(q=>({...q}))}));
  return json(req,res,200,{needs});
 }
 if(req.method==='POST'&&p==='/api/buyer/needs'){
  const u=requireUser(req,res,'buyer');if(!u)return;
  const x=await body(req);
  const material=db.materials.find(m=>m.id===String(x.material_id||''));
  const quantity=Number(x.quantity_kg);
  if(!material)return json(req,res,400,{error:'Select a valid material'});
  if(!Number.isFinite(quantity)||quantity<=0)return json(req,res,400,{error:'Quantity must be greater than zero'});
  const target=x.target_rate===''||x.target_rate==null?null:Number(x.target_rate);
  if(target!==null&&(!Number.isFinite(target)||target<0))return json(req,res,400,{error:'Target rate must be zero or greater'});
  const need={id:id('NEED'),buyer_id:u.id,buyer_name:u.name,buyer_email:u.email,material_id:material.id,material_name:material.name,group:material.group,quantity_kg:quantity,target_rate:target,condition:safeText(x.condition||''),needed_by:safeText(x.needed_by||''),delivery_area:safeText(x.delivery_area||''),notes:safeText(x.notes||''),status:'open',created_at:new Date().toISOString(),quotes:[]};
  db.buyer_needs=db.buyer_needs||[];db.buyer_needs.unshift(need);persist();
  return json(req,res,201,{need});
 }
 if(req.method==='GET'&&p==='/api/marketplace/buyer-needs'){
  const u=requireUser(req,res,'collector');if(!u)return;
  const needs=(db.buyer_needs||[]).filter(n=>n.status==='open'&&n.buyer_id!==u.id).map(n=>({id:n.id,buyer_name:n.buyer_name,material_id:n.material_id,material_name:n.material_name,group:n.group,quantity_kg:n.quantity_kg,target_rate:n.target_rate,condition:n.condition,needed_by:n.needed_by,delivery_area:n.delivery_area,notes:n.notes,created_at:n.created_at,quote_count:(n.quotes||[]).length,own_quote:(n.quotes||[]).find(q=>q.collector_id===u.id)||null}));
  return json(req,res,200,{needs});
 }
 if(req.method==='POST'&&p==='/api/marketplace/buyer-needs/quote'){
  const u=requireUser(req,res,'collector');if(!u)return;
  const x=await body(req),rate=Number(x.rate),available=Number(x.available_kg);
  if(!x.need_id)return json(req,res,400,{error:'Buyer need ID is required'});
  if(!Number.isFinite(rate)||rate<=0)return json(req,res,400,{error:'Enter a valid quote rate'});
  if(!Number.isFinite(available)||available<=0)return json(req,res,400,{error:'Enter available quantity'});
  const need=(db.buyer_needs||[]).find(n=>n.id===String(x.need_id));
  if(!need)return json(req,res,404,{error:'Buyer need not found'});
  if(need.status!=='open')return json(req,res,409,{error:'This buyer need is no longer open'});
  const data=String(x.photoData||'');
  const match=data.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=]+)$/i);
  if(!match)return json(req,res,400,{error:'Upload a material photo to submit your quote'});
  const bytes=Buffer.from(match[2],'base64');
  if(!bytes.length||bytes.length>7*1024*1024)return json(req,res,400,{error:'Photo must be smaller than 7 MB'});
  const ext=match[1].toLowerCase()==='jpeg'?'jpg':match[1].toLowerCase();
  need.quotes=need.quotes||[];
  let q=need.quotes.find(q=>q.collector_id===u.id);
  const now=new Date().toISOString();
  const quoteId=q?.id||id('NQ');
  const filename=quoteId+'.'+ext;
  fs.writeFileSync(path.join(UP,filename),bytes);
  if(q){q.rate=rate;q.available_kg=available;q.message=safeText(x.message||'');q.image_ref='/server/data/uploads/'+filename;q.status='pending';q.updated_at=now;}
  else {q={id:quoteId,collector_id:u.id,collector_name:u.name,rate,available_kg:available,message:safeText(x.message||''),image_ref:'/server/data/uploads/'+filename,status:'pending',created_at:now,updated_at:now};need.quotes.push(q);}
  need.updated_at=now;persist();
  notify(need.buyer_id,'buyer_need_quote','New quote for your sourcing request',`${u.name||'A collector'} offered ₹${rate}/kg for ${available} kg of ${need.material_name}. View the offer and photo in your Sourcing Hub.`,{need_id:need.id,quote_id:q.id});
  return json(req,res,201,{quote:{id:q.id,rate:q.rate,available_kg:q.available_kg,status:q.status,image_ref:q.image_ref}});
 }

 // A dedicated inbox API keeps Messenger independent from the Buyer Console's
 // {incoming: [...]} dashboard response and includes past/accepted conversations.
 if(req.method==='GET'&&p==='/api/messenger/inbox'){
  const u=currentUser(req);
  if(!u)return json(req,res,401,{error:'Login required'});
  if(!['buyer','collector'].includes(u.role))return json(req,res,403,{error:'Messenger is available to buyer and collector accounts'});
  const conversations=[];
  for(const lot of db.lots){
   normalizeQuotes(lot);
   const collector=collectorForLot(lot);
   const related=u.role==='buyer'
    ? lot.quotes.filter(q=>q.buyer_id===u.id)
    : (lot.user_id===u.id ? lot.quotes : []);
   for(const q of related){
    // Never send other buyers' quote records or any message bodies in the inbox payload.
    const safeLot={...lot,quotes:undefined,messages:undefined};
    const other=u.role==='buyer'
     ? {id:collector?.id||lot.user_id,name:collector?.name||lot.collector_id||'Collector'}
     : {id:q.buyer_id,name:q.buyer_name||'Buyer'};
    conversations.push({lot:safeLot,quote:quoteView(q),other,otherId:other.id,quoteId:q.id});
   }
  }
  persist();
  return json(req,res,200,{conversations});
 }

 if(req.method==='POST'&&p==='/api/auth/signup'){
  const x=await body(req);const name=String(x.name||'').trim(),email=String(x.email||'').trim().toLowerCase(),password=String(x.password||''),role=x.role==='buyer'?'buyer':'collector';
  if(name.length<2||!email.includes('@')||password.length<6)return json(req,res,400,{error:'Enter a name, valid email and password of at least 6 characters'});
  if(db.users.some(u=>u.email===email))return json(req,res,409,{error:'An account with this email already exists'});
  const hp=hashPassword(password);const u={id:id('USR'),name,email,phone:String(x.phone||'').trim(),role,password_salt:hp.salt,password_hash:hp.hash,created:new Date().toISOString()};
  if(role==='collector')u.collector_id=id('COL');else u.facility_id=facilityForBuyer(u)?.id||'FAC-GREENLOOP';
  db.users.push(u);persist();const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,u.id);return json(req,res,201,{user:publicUser(u)},{'Set-Cookie':sessionCookie(req,sid)});
 }
 if(req.method==='POST'&&p==='/api/auth/login'){
  const x=await body(req);const email=String(x.email||'').trim().toLowerCase(),password=String(x.password||'');const u=db.users.find(a=>a.email===email);if(!u||!verifyPassword(password,u))return json(req,res,401,{error:'Invalid email or password'});const sid=crypto.randomBytes(32).toString('hex');sessions.set(sid,u.id);return json(req,res,200,{user:publicUser(u)},{'Set-Cookie':sessionCookie(req,sid)});
 }
 if(req.method==='POST'&&p==='/api/auth/logout'){const sid=cookies(req).um_session;if(sid)sessions.delete(sid);return json(req,res,200,{ok:true},{'Set-Cookie':sessionCookie(req,'',0)})}
 if(req.method==='GET'&&p==='/api/auth/me')return json(req,res,200,{user:publicUser(currentUser(req))});
 if(req.method==='GET'&&p==='/api/notifications'){
  const u=requireUser(req,res);if(!u)return;const items=(db.notifications||[]).filter(n=>n.user_id===u.id).slice(0,100);return json(req,res,200,{notifications:items,unread:items.filter(n=>!n.read).length,emailConfigured:!!(process.env.SMTP_HOST&&process.env.SMTP_USER&&process.env.SMTP_PASS&&nodemailer)});
 }
 if(req.method==='POST'&&p==='/api/notifications/read-all'){
  const u=requireUser(req,res);if(!u)return;for(const n of (db.notifications||[]))if(n.user_id===u.id)n.read=true;persist();return json(req,res,200,{ok:true});
 }
 if(req.method==='POST'&&p==='/api/notifications/read'){
  const u=requireUser(req,res);if(!u)return;const x=await body(req);const n=(db.notifications||[]).find(n=>n.id===x.id&&n.user_id===u.id);if(!n)return json(req,res,404,{error:'Notification not found'});n.read=true;persist();return json(req,res,200,{ok:true});
 }
 if(req.method==='GET'&&p==='/api/bootstrap'){const u=currentUser(req);const lots=u&&u.role==='collector'?db.lots.filter(l=>l.user_id===u.id):[];return json(req,res,200,{materials:db.materials,facilities:db.facilities,lots,profile:u&&u.role==='collector'?{collector_id:u.collector_id,name:u.name,preferred_language:u.preferred_language||'Hindi',operating_area:u.operating_area||'Demo area'}:null,user:publicUser(u)})}
 if(req.method==='GET'&&p==='/api/materials')return json(req,res,200,db.materials);

 if(req.method==='GET'&&p==='/api/buyers'){
  const u=requireUser(req,res,'collector');if(!u)return;
  const buyers=db.users.filter(x=>x.role==='buyer'&&x.active!==false).map(x=>{const facility=db.facilities.find(f=>f.id===x.facility_id);return {id:x.id,name:x.name,email:x.email,phone:x.phone||'',facility_id:x.facility_id||null,facility_name:facility?.name||'Registered Buyer',created:x.created}});
  return json(req,res,200,{buyers});
 }

 if(req.method==='GET'&&p.startsWith('/api/lots/')&&p.endsWith('/quotes')){
  const u=requireUser(req,res,'collector');if(!u)return;
  const lotId=decodeURIComponent(p.slice('/api/lots/'.length,-'/quotes'.length));const lot=db.lots.find(l=>l.id===lotId&&l.user_id===u.id);
  if(!lot)return json(req,res,404,{error:'Lot not found'});normalizeQuotes(lot);persist();
  return json(req,res,200,{lot,quotes:lot.quotes.map(quoteView)});
 }

 if(req.method==='GET'&&p.startsWith('/api/lots/')&&p.endsWith('/messages')){
  const u=currentUser(req);if(!u)return json(req,res,401,{error:'Login required'});
  const rest=p.slice('/api/lots/'.length,-'/messages'.length);const lotId=decodeURIComponent(rest);const lot=db.lots.find(l=>l.id===lotId);
  if(!lot)return json(req,res,404,{error:'Lot not found'});
  normalizeQuotes(lot);const quoteId=url.searchParams.get('quote_id')||null;
  const isCollector=u.role==='collector'&&lot.user_id===u.id;const myQuote=lot.quotes.find(q=>q.buyer_id===u.id);
  const isBuyer=u.role==='buyer'&&!!myQuote;
  if(!isCollector&&!isBuyer)return json(req,res,403,{error:'You are not a participant in this lot'});
  if(!quoteId)return json(req,res,400,{error:'A quote_id is required to open a private conversation'});
  const selectedQuote=lot.quotes.find(q=>q.id===quoteId);
  if(!selectedQuote)return json(req,res,404,{error:'Quote conversation not found'});
  if(isBuyer&&selectedQuote.buyer_id!==u.id)return json(req,res,403,{error:'You can only access your own quote conversation'});
  const messages=(lot.messages||[]).filter(m=>m.quote_id===quoteId);
  return json(req,res,200,{messages:messages.map(messageView)});
 }

 if(req.method==='POST'&&p.startsWith('/api/lots/')&&p.endsWith('/messages')){
  const u=currentUser(req);if(!u)return json(req,res,401,{error:'Login required'});
  const lotId=decodeURIComponent(p.slice('/api/lots/'.length,-'/messages'.length));const lot=db.lots.find(l=>l.id===lotId);
  if(!lot)return json(req,res,404,{error:'Lot not found'});
  normalizeQuotes(lot);const x=await body(req);const msg=String(x.message||'').trim();const quoteId=String(x.quote_id||'').trim();
  if(!msg||msg.length>1000)return json(req,res,400,{error:'Message must be 1–1000 characters'});
  if(!quoteId)return json(req,res,400,{error:'A quote_id is required to send a private message'});
  const q=lot.quotes.find(q=>q.id===quoteId);
  if(!q)return json(req,res,404,{error:'Quote conversation not found'});
  const isCollector=u.role==='collector'&&lot.user_id===u.id;const isBuyer=u.role==='buyer'&&q.buyer_id===u.id;
  if(!isCollector&&!isBuyer)return json(req,res,403,{error:'You are not a participant in this quote'});
  lot.messages=lot.messages||[];const m={id:id('MSG'),lot_id:lot.id,quote_id:quoteId,sender_id:u.id,sender_role:u.role,message:msg,created_at:new Date().toISOString()};lot.messages.push(m);persist();return json(req,res,201,messageView(m));
 }

 if(req.method==='GET'&&p==='/api/lots'){
  const u=requireUser(req,res,'collector');if(!u)return;return json(req,res,200,db.lots.filter(l=>l.user_id===u.id));
 }

 if(req.method==='POST'&&p==='/api/lots'){
  const u=requireUser(req,res,'collector');if(!u)return;const x=await body(req);const m=db.materials.find(a=>a.id===x.category)||db.materials.find(a=>a.name===x.name);if(!m)return json(req,res,400,{error:'Unknown material'});const weight=Number(x.weight);if(!Number.isFinite(weight)||weight<=0)return json(req,res,400,{error:'Weight must be greater than zero'});
  const lot={id:x.id||id(),user_id:u.id,collector_id:u.collector_id,category:m.id,group:m.group,name:m.name,weight,rate:Number(x.rate)||m.rate,status:'created',created:x.created||new Date().toISOString(),photo_ref:null,quoted_price:null,facility_id:null,payment_status:'pending',transaction_status:'open',quotes:[],messages:[],events:[]};
  if(x.photoData&&typeof x.photoData==='string'&&x.photoData.startsWith('data:image/')){const mt=x.photoData.match(/^data:image\/(png|jpeg|jpg|webp);base64,/i);if(mt){const ext=mt[1]==='jpeg'?'jpg':mt[1];const file=lot.id+'.'+ext;fs.writeFileSync(path.join(UP,file),Buffer.from(x.photoData.split(',')[1],'base64'));lot.photo_ref='/server/data/uploads/'+file}}
  lot.events.push({type:'captured',at:new Date().toISOString(),by:u.id});db.lots.unshift(lot);persist();return json(req,res,201,lot);
 }

 if(req.method==='GET'&&p.startsWith('/api/lots/')){
  const u=currentUser(req);if(!u)return json(req,res,401,{error:'Login required'});
  const lot=db.lots.find(x=>x.id===decodeURIComponent(p.slice(10)));if(!lot)return json(req,res,404,{error:'Lot not found'});
  if(u.role==='collector'&&lot.user_id!==u.id)return json(req,res,403,{error:'Not your lot'});
  if(u.role==='buyer'&&!normalizeQuotes(lot).some(q=>q.buyer_id===u.id))return json(req,res,403,{error:'You have not quoted this lot'});
  return json(req,res,200,lot);
 }

 if(req.method==='POST'&&p==='/api/handovers'){
  const u=requireUser(req,res,'collector');if(!u)return;const x=await body(req);const lot=db.lots.find(l=>l.id===x.lot_id&&l.user_id===u.id)||db.lots.find(l=>l.user_id===u.id);if(!lot)return json(req,res,400,{error:'No lot available'});
  normalizeQuotes(lot);const selected=lot.quotes.find(q=>q.id===x.quote_id&&q.status==='accepted');const buyerFacility=selected?db.facilities.find(f=>f.id===selected.facility_id):null;
  const buyer=x.facility_id?db.facilities.find(f=>f.name===x.facility_id||f.id===x.facility_id):buyerFacility||db.facilities[0];const now=new Date().toISOString();
  const price=Number(x.final_price??selected?.rate??x.quoted_price??lot.rate);const h={handover_id:id('HO'),lot_id:lot.id,collector_id:u.collector_id,facility_id:buyer?.id||'FAC-GREENLOOP',facility_name:buyer?.name||'GreenLoop Materials',weight:lot.weight,quoted_price:Number(selected?.rate??x.quoted_price??lot.rate),final_price:price,confirmed_at:now,payment_status:x.payment_status||'pending',reference:crypto.randomBytes(3).toString('hex').toUpperCase(),append_only:true};
  db.handovers.push(h);if(lot.buyer_id)notify(lot.buyer_id,'handover_confirmed','Handover confirmed',`Handover for ${lot.name||'your accepted lot'} has been confirmed.`,{lot_id:lot.id,handover_id:h.handover_id});if(x.scheduled_at){h.scheduled_at=x.scheduled_at;notify(lot.user_id,'handover_scheduled','Handover reminder',`Handover is scheduled for ${new Date(x.scheduled_at).toLocaleString('en-IN')}.`,{lot_id:lot.id,handover_id:h.handover_id});}lot.status='confirmed';lot.transaction_status='completed';lot.facility_id=h.facility_id;lot.quoted_price=h.quoted_price;lot.final_price=h.final_price;lot.payment_status=h.payment_status;lot.handover_at=now;lot.events.push({type:'handover_confirmed',at:now,reference:h.reference,by:u.id});persist();return json(req,res,201,h);
 }

 if(req.method==='GET'&&p==='/api/earnings'){const u=requireUser(req,res,'collector');if(!u)return;const tx=db.lots.filter(l=>l.user_id===u.id&&l.transaction_status==='completed');const paid=tx.filter(l=>l.payment_status==='paid').reduce((a,l)=>a+(l.final_price||l.rate)*l.weight,0);const pending=tx.filter(l=>l.payment_status!=='paid').reduce((a,l)=>a+(l.final_price||l.rate)*l.weight,0);return json(req,res,200,{earned:paid,pending,average:tx.length?tx.reduce((a,l)=>a+(l.final_price||l.rate)*l.weight,0)/tx.length:0,lots:tx})}
 if(req.method==='GET'&&p==='/api/recovery'){const u=requireUser(req,res,'collector');if(!u)return;const lots=db.lots.filter(l=>l.user_id===u.id),captured=lots.reduce((a,l)=>a+l.weight,0),recovered=lots.filter(l=>l.transaction_status==='completed').reduce((a,l)=>a+l.weight,0);const by={};for(const l of lots.filter(l=>l.transaction_status==='completed'))by[l.group]=(by[l.group]||0)+l.weight;return json(req,res,200,{captured,recovered,traceable:lots.length?Math.round(lots.filter(l=>l.transaction_status==='completed').length/lots.length*100):0,authorizedRoute:lots.length?Math.round(lots.filter(l=>l.facility_id).length/lots.length*100):0,by})}

 if(req.method==='GET'&&p==='/api/console'){
  const u=requireUser(req,res,'buyer');if(!u)return;const facility=facilityForBuyer(u);
  const incoming=db.lots.filter(l=>l.transaction_status!=='completed'&&l.transaction_status!=='cancelled');
  const enriched=incoming.map(l=>{normalizeQuotes(l);const collector=collectorForLot(l);const myQuote=l.quotes.find(q=>q.buyer_id===u.id);return {...l,quotes:undefined,myQuote:myQuote?quoteView(myQuote):null,collector:{id:collector?.id||l.user_id,name:collector?.name||l.collector_id||'Collector',email:collector?.email||'',phone:collector?.phone||'',collector_id:collector?.collector_id||l.collector_id||null}}});
  persist();
  const awaitingQuote=enriched.filter(l=>!l.myQuote).length;const acceptedByMe=enriched.filter(l=>l.myQuote?.status==='accepted').length;
  return json(req,res,200,{incoming:enriched,awaitingQuote,acceptedByMe,confirmedToday:db.lots.filter(l=>l.transaction_status==='completed'&&l.facility_id===facility?.id).length,facilities:db.facilities,facility,traceability:db.lots.length?Math.round(db.lots.filter(l=>l.transaction_status==='completed').length/db.lots.length*100):0,buyer:publicUser(u)});
 }

 if(req.method==='POST'&&p==='/api/console/quote'){
  const u=requireUser(req,res,'buyer');if(!u)return;const x=await body(req);const rate=Number(x.rate);if(!Number.isFinite(rate)||rate<=0)return json(req,res,400,{error:'Quote rate must be greater than zero'});
  const lot=db.lots.find(l=>l.id===x.lot_id);if(!lot)return json(req,res,404,{error:'Lot not found'});if(['completed','cancelled'].includes(lot.transaction_status))return json(req,res,409,{error:'Lot is no longer available'});
  normalizeQuotes(lot);const facility=facilityForBuyer(u);let q=lot.quotes.find(q=>q.buyer_id===u.id);
  if(q&&['accepted'].includes(q.status))return json(req,res,409,{error:'Your quote is already accepted'});
  const now=new Date().toISOString();
  if(q){q.rate=rate;q.counter_rate=null;q.status='pending';q.updated_at=now}else{q={id:id('QT'),buyer_id:u.id,buyer_name:u.name,buyer_email:u.email,facility_id:facility?.id||null,facility_name:facility?.name||'',rate,status:'pending',created_at:now,updated_at:now};lot.quotes.push(q)}
  lot.transaction_status=lot.transaction_status==='open'?'negotiating':lot.transaction_status;lot.events=lot.events||[];lot.events.push({type:'buyer_quote',at:now,by:u.id,quote_id:q.id,rate});notify(lot.user_id,'new_quote','New quote received',`${u.name||'A buyer'} offered ₹${rate}/kg for your ${lot.name||'material'} lot.`,{lot_id:lot.id,quote_id:q.id});persist();return json(req,res,200,{lot,quote:quoteView(q)});
 }

 if(req.method==='POST'&&p==='/api/console/quote/withdraw'){
  const u=requireUser(req,res,'buyer');if(!u)return;const x=await body(req);const lot=db.lots.find(l=>l.id===x.lot_id);if(!lot)return json(req,res,404,{error:'Lot not found'});normalizeQuotes(lot);const q=lot.quotes.find(q=>q.id===x.quote_id&&q.buyer_id===u.id);if(!q)return json(req,res,404,{error:'Quote not found'});if(q.status==='accepted')return json(req,res,409,{error:'Accepted quotes cannot be withdrawn'});q.status='withdrawn';q.updated_at=new Date().toISOString();lot.events.push({type:'buyer_quote_withdrawn',at:q.updated_at,by:u.id,quote_id:q.id});persist();return json(req,res,200,{quote:quoteView(q)});
 }

 if(req.method==='POST'&&p==='/api/console/quote/accept'){
  const u=requireUser(req,res,'buyer');if(!u)return;const x=await body(req);const lot=db.lots.find(l=>l.id===x.lot_id);if(!lot)return json(req,res,404,{error:'Lot not found'});normalizeQuotes(lot);const q=lot.quotes.find(q=>q.id===x.quote_id&&q.buyer_id===u.id);if(!q)return json(req,res,404,{error:'Quote not found'});if(q.status!=='countered')return json(req,res,409,{error:'Only a countered quote can be accepted by the buyer'});q.rate=Number(q.counter_rate);q.counter_rate=null;q.status='pending';q.updated_at=new Date().toISOString();lot.events.push({type:'buyer_counter_accepted',at:q.updated_at,by:u.id,quote_id:q.id,rate:q.rate});persist();return json(req,res,200,{quote:quoteView(q)});
 }

 if(req.method==='POST'&&p==='/api/console/accept')return json(req,res,410,{error:'Buyer-side lot acceptance has been replaced. The collector accepts the buyer quote.'});

 if(req.method==='POST'&&p==='/api/lots/quote-action'){
  const u=requireUser(req,res,'collector');if(!u)return;const x=await body(req);const lot=db.lots.find(l=>l.id===x.lot_id&&l.user_id===u.id);if(!lot)return json(req,res,404,{error:'Lot not found'});normalizeQuotes(lot);const q=lot.quotes.find(q=>q.id===x.quote_id);if(!q)return json(req,res,404,{error:'Quote not found'});
  const action=String(x.action||'');const now=new Date().toISOString();
  if(action==='accept'){
   if(!['pending','countered'].includes(q.status))return json(req,res,409,{error:'This quote cannot be accepted'});
   q.status='accepted';q.rate=Number(q.counter_rate??q.rate);q.counter_rate=null;q.updated_at=now;
   for(const other of lot.quotes)if(other.id!==q.id&&['pending','countered'].includes(other.status)){other.status='rejected';other.updated_at=now}
   lot.buyer_id=q.buyer_id;lot.buyer_name=q.buyer_name;lot.facility_id=q.facility_id;lot.facility_name=q.facility_name;lot.quoted_price=q.rate;lot.final_price=q.rate;lot.transaction_status='accepted';lot.status='accepted';
   lot.events.push({type:'collector_quote_accepted',at:now,by:u.id,quote_id:q.id,rate:q.rate});notify(q.buyer_id,'quote_accepted','Quote accepted',`Your ${lot.name||'material'} lot has been accepted at ₹${q.rate}/kg.`,{lot_id:lot.id,quote_id:q.id});
  }else if(action==='reject'){
   if(q.status==='accepted')return json(req,res,409,{error:'An accepted quote cannot be rejected'});
   q.status='rejected';q.updated_at=now;lot.events.push({type:'collector_quote_rejected',at:now,by:u.id,quote_id:q.id});
  }else if(action==='counter'){
   const rate=Number(x.rate);if(!Number.isFinite(rate)||rate<=0)return json(req,res,400,{error:'Counter rate must be greater than zero'});
   if(q.status==='accepted'||q.status==='rejected')return json(req,res,409,{error:'This quote cannot be countered'});
   q.counter_rate=rate;q.status='countered';q.updated_at=now;lot.transaction_status='negotiating';lot.events.push({type:'collector_counter',at:now,by:u.id,quote_id:q.id,rate});notify(q.buyer_id,'counter_offer','New counter-offer',`${u.name||'The collector'} countered ₹${rate}/kg for ${lot.name||'your quoted lot'}.`,{lot_id:lot.id,quote_id:q.id});
  }else return json(req,res,400,{error:'Unknown quote action'});
  persist();return json(req,res,200,{lot,quote:quoteView(q)});
 }

 if(req.method==='GET'&&p==='/api/profile'){const u=requireUser(req,res,'collector');if(!u)return;return json(req,res,200,{collector_id:u.collector_id,name:u.name,preferred_language:u.preferred_language||'Hindi',operating_area:u.operating_area||'Demo area'});}
 if(req.method==='PUT'&&p==='/api/profile'){const u=requireUser(req,res,'collector');if(!u)return;const x=await body(req);u.name=String(x.name||u.name).trim();u.preferred_language=x.preferred_language||u.preferred_language||'Hindi';u.operating_area=x.operating_area||u.operating_area||'Demo area';persist();return json(req,res,200,{collector_id:u.collector_id,name:u.name,preferred_language:u.preferred_language,operating_area:u.operating_area});}

 if(req.method==='GET'&&p==='/api/export/custody.csv'){
  const u=requireUser(req,res,'buyer');if(!u)return;const rows=[['lot_id','stream','material','weight','timestamp','status','facility','buyer_id','quoted_price','payment_status']];
  for(const l of db.lots)rows.push([l.id,l.group,l.name,l.weight,l.handover_at||l.created,l.transaction_status,l.facility_id||'',l.buyer_id||'',l.quoted_price??'',l.payment_status||'']);
  const csv=rows.map(r=>r.map(csvEscape).join(',')).join('\n');res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="urban-mining-custody-trail.csv"'});return res.end(csv)
 }

 if(req.method==='GET'&&p==='/api/admin/dashboard'){const u=requireUser(req,res,'admin');if(!u)return;return adminDashboard(req,res,u)}
 return json(req,res,404,{error:'API route not found'});
}

function safePath(p){const base=path.resolve(ROOT);const target=path.resolve(ROOT,p);return target.startsWith(base+path.sep)||target===base?target:null}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'};
function adminDashboard(req,res,user){
 if(!user||user.role!=='admin')return json(req,res,403,{error:'Admin access required'});
 const users=(db.users||[]).map(u=>({id:u.id,user_id:u.id,name:u.name||'',email:u.email||'',phone:u.phone||'',role:u.role||'collector',created_at:u.created_at||u.created||null,active:u.active!==false}));
 const lots=db.lots||[];const completed=lots.filter(l=>l.status==='completed'||l.transaction_status==='completed');const weightKg=lots.reduce((sum,l)=>sum+Number(l.weight_kg||l.weight||0),0);const completedValue=completed.reduce((sum,l)=>sum+Number(l.final_price??l.quoted_price??l.value??0)*Number(l.weight_kg??l.weight??0),0);
 return json(req,res,200,{users,lots,handovers:db.handovers||[],stats:{totalUsers:users.length,collectors:users.filter(u=>u.role==='collector').length,buyers:users.filter(u=>u.role==='buyer'||u.role==='recycler').length,admins:users.filter(u=>u.role==='admin').length,totalLots:lots.length,openLots:lots.length-completed.length,completedLots:completed.length,totalWeightKg:weightKg,completedValue,facilities:(db.facilities||[]).length}});
}

setInterval(()=>{try{const now=Date.now();for(const h of (db.handovers||[])){if(!h.scheduled_at||h.reminder_sent)continue;const when=Date.parse(h.scheduled_at);if(Number.isFinite(when)&&when>now&&when-now<=24*60*60*1000){const lot=db.lots.find(l=>l.id===h.lot_id);if(lot){notify(lot.user_id,'handover_reminder','Handover reminder','Handover scheduled for tomorrow.',{lot_id:lot.id,handover_id:h.handover_id});h.reminder_sent=true;persist();}}}}catch(e){console.error('Reminder sweep:',e.message)}},60*60*1000).unref();
const server=http.createServer(async(req,res)=>{
 try{
  if(req.method==='OPTIONS'){res.writeHead(204,{...corsHeaders(req),'Access-Control-Allow-Methods':'GET,POST,PUT,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end()}
  const url=new URL(req.url,'http://localhost');
  if(url.pathname.startsWith('/api/'))return await api(req,res,url);
  let rel=decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.replace(/^\/+/,''));
  const file=safePath(rel);if(!file)return json(req,res,403,{error:'Forbidden'});
  fs.stat(file,(err,st)=>{if(err||!st.isFile())return json(req,res,404,{error:'Not found'});res.writeHead(200,{'Content-Type':mime[path.extname(file).toLowerCase()]||'application/octet-stream'});fs.createReadStream(file).pipe(res)})
 }catch(e){console.error(e);json(req,res,500,{error:'Server error',detail:e.message})}
});
const PORT=process.env.PORT||8000;server.listen(PORT,()=>console.log(`Urban Mining Connect running at http://localhost:${PORT}`));
