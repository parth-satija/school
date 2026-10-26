// @ts-nocheck
// Firebase loads dynamically so a failure shows a message instead of silently killing the page.
document.getElementById('chatApp').innerHTML='<p class="note">Loading chat…</p>';
const VERSIONS=["11.10.0","11.6.0","10.14.1"]; // tries newest first, falls back if a version can't be loaded
const withTimeout=(p,ms,what)=>Promise.race([p,new Promise((_,rej)=>setTimeout(()=>rej(new Error("timed out loading "+what)),ms))]);
let loadErr=null,M={};
for(const v of VERSIONS){
  const FB="https://www.gstatic.com/firebasejs/"+v+"/";
  try{
    const mods=await withTimeout(Promise.all(["firebase-app.js","firebase-auth.js","firebase-firestore.js"].map(f=>import(FB+f))),12000,"Firebase "+v);
    M={};mods.forEach(m=>Object.assign(M,m));loadErr=null;
    for(const f of ["firebase-ai.js","firebase-app-check.js"]){
      try{Object.assign(M,await withTimeout(import(FB+f),8000,f))}catch(e){console.warn(f+" unavailable in "+v,e)}
    }
    console.info("Firebase SDK "+v+" loaded");break;
  }catch(e){loadErr=e;console.warn("Firebase "+v+" failed",e)}
}
const {initializeApp,getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged,getAI,getGenerativeModel,GoogleAIBackend,initializeAppCheck,ReCaptchaV3Provider,getFirestore,collection,doc,getDoc,setDoc,updateDoc,addDoc,deleteDoc,onSnapshot,query,orderBy,limitToLast,serverTimestamp}=M;
window.__assistantReady=true;
const pill=document.getElementById('authPill');
const setPill=(u,txt)=>{if(!pill)return;pill.classList.toggle('on',!!u);pill.querySelector('span').textContent=txt||(u?'Signed in as '+(u.displayName||u.email):'Not signed in');pill.title=u?(u.email||''):'Open the Chat tab to sign in'};
// Firebase chat: Google sign-in, role-based permissions, group room, direct messages.

// 1) Paste your Firebase web app config here (Project settings > Your apps).
const FIREBASE_CONFIG={apiKey:"AIzaSyDyOxoqlrqLverNeZXYqwrL7V1rhe9iJe4",authDomain:"modernschool-e22fd.firebaseapp.com",projectId:"modernschool-e22fd",storageBucket:"modernschool-e22fd.firebasestorage.app",messagingSenderId:"479379818353",appId:"1:479379818353:web:a53e9001e4a9a05eb958d0"};

// 2) Gemini assistant, served through Firebase AI Logic (no API key in this site).
const CHAT_MODEL="gemini-3.1-flash-lite";
// 3) Recommended: reCAPTCHA v3 site key for Firebase App Check (Firebase console > App Check). Leave "" to skip.
const APPCHECK_SITE_KEY="";
// Firestore database ID. The console's standard database is "(default)" (with parentheses).
// Use "(default)" for the standard database.
const FIRESTORE_DB_ID="(default)";
let AI=null;

const css=`
.rc-box{max-width:760px;margin:26px auto 0;padding:34px 20px;text-align:center;color:var(--muted);background:var(--ink);border:1px solid var(--line);border-top:4px solid var(--maroon);border-radius:22px}
.rc-box button{margin-top:16px;border:0;border-radius:999px;background:var(--maroon);color:#fff;font:600 1rem Figtree,sans-serif;padding:13px 26px;cursor:pointer}
.rc{display:grid;grid-template-columns:320px 1fr;height:min(78vh,680px);margin:22px auto 0;max-width:980px;background:var(--ink);border:1px solid var(--line);border-radius:22px;overflow:hidden;box-shadow:0 24px 60px -30px rgba(135,36,30,.8)}
.rc-side{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line);background:#0a0606}
.rc-me{display:flex;align-items:center;gap:10px;padding:14px;background:linear-gradient(135deg,var(--maroon-lo),var(--maroon))}
.rc-me .nm{flex:1;min-width:0;line-height:1.25}.rc-me .nm b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-me .nm small{display:block;opacity:.85;font-size:.78rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-ib{background:rgba(0,0,0,.28);border:0;color:#fff;border-radius:999px;padding:6px 11px;font:600 .78rem Figtree,sans-serif;cursor:pointer}
.rc-ib:hover{background:rgba(0,0,0,.5)}
.rc-tedit{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line)}
.rc-tedit[hidden]{display:none}
.rc-tedit input,.rc-search{min-width:0;flex:1;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:999px;padding:9px 14px;font:inherit;font-size:.9rem}
.rc-tedit button{border:0;background:var(--maroon);color:#fff;border-radius:999px;padding:0 14px;font:600 .82rem Figtree,sans-serif;cursor:pointer}
.rc-searchwrap{padding:10px 12px}.rc-search{width:100%}
.rc input:focus{outline:2px solid var(--maroon-hi);border-color:transparent}
.rc-list{flex:1;overflow-y:auto;padding:0 6px 10px}
.rc-item{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:10px;border:0;border-radius:14px;background:none;color:var(--text);font:inherit;cursor:pointer}
.rc-item:hover{background:#171010}.rc-item.sel{background:rgba(135,36,30,.35)}
.rc-item:disabled{opacity:.4;cursor:not-allowed;background:none}
.rc-item .tx{min-width:0;flex:1}.rc-item .tx b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-item .tx small{display:block;color:var(--muted);font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-av{flex:none;display:grid;place-items:center;border-radius:50%;overflow:hidden;background:linear-gradient(145deg,var(--maroon-hi),var(--maroon-lo));color:#fff;font-weight:600}
.rc-av img{width:100%;height:100%;object-fit:cover}
.rc-main{display:flex;flex-direction:column;min-width:0;min-height:0;background:#0f0a0a}
.rc-head{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--line);background:var(--ink)}
.rc-head .tx b{display:block}.rc-head .tx small{color:var(--muted);font-size:.8rem}
.rc-back{display:none;background:none;border:0;color:var(--text);font-size:1.6rem;line-height:1;cursor:pointer;padding:0 6px 0 0}
.rc-msgs{flex:1;overflow-y:auto;padding:16px 18px;display:flex;flex-direction:column;gap:3px}
.rc-day{align-self:center;margin:12px 0 8px;font-size:.75rem;color:var(--muted);background:var(--card);padding:4px 12px;border-radius:999px}
.rc-row{display:flex;align-items:flex-end;gap:8px;max-width:100%}.rc-row.me{justify-content:flex-end}.rc-row.first{margin-top:9px}
.rc-av-gap{flex:none;width:28px}
.rc-m{position:relative;max-width:72%;padding:7px 12px 6px;border-radius:16px;background:var(--card);border:1px solid var(--line);word-wrap:break-word;overflow-wrap:anywhere}
.rc-row.me .rc-m{background:var(--maroon);border-color:var(--maroon-hi)}
.rc-row:not(.me).first .rc-m{border-top-left-radius:4px}.rc-row.me.first .rc-m{border-top-right-radius:4px}
.rc-who{font-size:.78rem;font-weight:600;color:#e6a39e;margin-bottom:1px}.rc-who span{color:var(--muted);font-weight:400}
.rc-text{white-space:pre-wrap}
.rc-time{float:right;margin:7px 0 0 12px;font-size:.68rem;color:rgba(243,235,233,.55)}
.rc-x{position:absolute;top:-8px;right:-6px;display:none;width:20px;height:20px;border-radius:50%;border:0;background:#000;color:#fff;cursor:pointer;font-size:.8rem;line-height:1}
.rc-m:hover .rc-x{display:block}
.rc-empty{margin:auto;text-align:center;color:var(--muted)}
.rc-err{color:#ff9a92;font-size:.85rem;padding:0 18px 6px}
.rc-form{display:flex;gap:10px;padding:12px 14px;border-top:1px solid var(--line);background:var(--ink)}
.rc-form input{flex:1;min-width:0;background:var(--card);color:var(--text);border:1px solid var(--line);border-radius:999px;padding:12px 18px;font:inherit}
.rc-form button{flex:none;width:46px;height:46px;border:0;border-radius:50%;background:var(--maroon);color:#fff;cursor:pointer;display:grid;place-items:center;transition:.15s}
.rc-form button:hover{background:var(--maroon-hi)}.rc-form button svg{width:20px;height:20px}
@media(max-width:720px){
 .rc{grid-template-columns:1fr;height:calc(100vh - 190px);min-height:440px;border-radius:16px}
 .rc .rc-main{display:none}.rc.chat-open .rc-side{display:none}.rc.chat-open .rc-main{display:flex}
 .rc-back{display:block}.rc-m{max-width:84%}
}`;
document.head.insertAdjacentHTML('beforeend','<style>'+css+'</style>');

const root=document.getElementById('chatApp');
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const note=(msg,btn)=>{root.innerHTML='';const d=el('div','rc-box');d.append(el('p',null,msg));if(btn){const b=el('button',null,btn[0]);b.onclick=btn[1];d.append(b)}root.append(d)};

if(loadErr){
  setPill(null,"Sign-in unavailable");
  console.error(loadErr);note("Couldn't load Firebase ("+(loadErr.message||loadErr)+"). Open the site over http(s), not as a local file, and check the browser console.");
}else if(FIREBASE_CONFIG.apiKey==="YOUR_API_KEY"){
  setPill(null,"Sign-in not set up");
  note("Chat isn't set up yet. Add your Firebase config to chat.js (see README).");
}else{
  const app=initializeApp(FIREBASE_CONFIG),auth=getAuth(app),db=getFirestore(app,FIRESTORE_DB_ID);
  if(APPCHECK_SITE_KEY&&initializeAppCheck)initializeAppCheck(app,{provider:new ReCaptchaV3Provider(APPCHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});
  if(getAI)AI=getAI(app,{backend:new GoogleAIBackend()});
  let me=null,users={},target='room',unsubMsgs=null,unsubUsers=null;
  const canDM=u=>me.role!=='student'||['staff','admin'].includes(u.role); // students can only message staff/admin
  const cid=(a,b)=>a<b?a+'_'+b:b+'_'+a;
  const login=()=>signInWithPopup(auth,new GoogleAuthProvider()).catch(e=>note("Sign-in failed: "+e.code,["Try again",login]));

  onAuthStateChanged(auth,async u=>{
    setPill(u);
    unsubMsgs&&unsubMsgs();unsubUsers&&unsubUsers();
    if(!u){me=null;return note("Sign in with Google to join the Modfest chat.",["Sign in with Google",login])}
    try{
      const ref=doc(db,'users',u.uid);let s=await getDoc(ref);
      if(!s.exists())await setDoc(ref,{name:u.displayName||u.email,email:u.email,photo:u.photoURL||'',role:'student',createdAt:serverTimestamp()});
      else await updateDoc(ref,{name:u.displayName||u.email,photo:u.photoURL||''});
      me={uid:u.uid,...(await getDoc(ref)).data()};
      unsubUsers=onSnapshot(collection(db,'users'),qs=>{users={};qs.forEach(d=>users[d.id]={uid:d.id,...d.data()});me={...me,...users[me.uid]};renderChips()});
      build();open('room',true);
    }catch(e){note(e.code==='unavailable'?"Signed in, but couldn't reach the Firestore database. Create it in the Firebase console (Build > Firestore Database > Create database) and make sure no ad blocker or network filter blocks firestore.googleapis.com.":e.code==='permission-denied'?"Signed in, but Firestore refused access. Publish the rules from firestore.rules (Firestore > Rules).":"Couldn't load chat ("+(e.code||e.message)+").",["Sign out",()=>signOut(auth)])}
  });

  let meSub,sideList,box,input,err,titleForm,titleIn,headEl,searchIn,wrap;
  const initial=s=>(s||'?').trim().charAt(0).toUpperCase();
  function avatar(u,size){
    const a=el('div','rc-av');a.style.width=a.style.height=size+'px';a.style.fontSize=Math.round(size*.42)+'px';
    if(u&&u.photo){const im=el('img');im.src=u.photo;im.alt='';im.referrerPolicy='no-referrer';im.onerror=()=>{im.remove();a.textContent=initial(u.name)};a.append(im)}
    else a.textContent=initial(u&&u.name);
    return a;
  }
  const dayLabel=d=>{const t=new Date(),y=new Date(Date.now()-864e5);return d.toDateString()===t.toDateString()?'Today':d.toDateString()===y.toDateString()?'Yesterday':d.toLocaleDateString([],{day:'numeric',month:'short',year:'numeric'})};
  function build(){
    root.innerHTML='';wrap=el('div','rc');
    // sidebar
    const side=el('div','rc-side'),meRow=el('div','rc-me');
    const nm=el('div','nm');meSub=el('small',null,'');nm.append(el('b',null,me.name),meSub);
    const ed=el('button','rc-ib','Title');ed.onclick=()=>{titleForm.hidden=!titleForm.hidden;if(!titleForm.hidden)titleIn.focus()};
    const out=el('button','rc-ib','Sign out');out.onclick=()=>signOut(auth);
    meRow.append(avatar(me,40),nm,ed,out);
    titleForm=el('form','rc-tedit');titleForm.hidden=true;titleIn=el('input');titleIn.placeholder='Your title, e.g. Class 10-B';titleIn.maxLength=40;titleIn.value=me.title||'';
    const tb=el('button',null,'Save');titleForm.append(titleIn,tb);
    titleForm.onsubmit=async e=>{e.preventDefault();try{await updateDoc(doc(db,'users',me.uid),{title:titleIn.value.trim()});titleForm.hidden=true}catch(x){err.textContent="Couldn't save title."}};
    const sw=el('div','rc-searchwrap');searchIn=el('input','rc-search');searchIn.placeholder='Search people';searchIn.oninput=renderChips;sw.append(searchIn);
    sideList=el('div','rc-list');side.append(meRow,titleForm,sw,sideList);
    // main
    const main=el('div','rc-main');headEl=el('div','rc-head');box=el('div','rc-msgs');err=el('div','rc-err');
    const f=el('form','rc-form');input=el('input');input.placeholder='Type a message';input.maxLength=1000;input.autocomplete='off';
    const sb=el('button');sb.type='submit';sb.setAttribute('aria-label','Send');sb.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>';
    f.append(input,sb);f.onsubmit=send;
    main.append(headEl,box,err,f);wrap.append(side,main);root.append(wrap);
  }
  function renderChips(){
    if(!sideList)return;sideList.innerHTML='';
    const q=(searchIn.value||'').toLowerCase();
    const item=(av,title,sub,key,dis,tip)=>{
      const b=el('button','rc-item'+(target===key?' sel':''));b.type='button';
      const tx=el('div','tx');tx.append(el('b',null,title),el('small',null,sub));b.append(av,tx);
      if(dis){b.disabled=true;b.title=tip}else b.onclick=()=>open(key);
      sideList.append(b);
    };
    const n=Object.keys(users).length;
    if(!q||'group room'.includes(q)){const g=el('div','rc-av');g.style.width=g.style.height='42px';g.textContent='#';g.style.fontSize='1.2rem';item(g,'Group room',n+' member'+(n===1?'':'s'),'room')}
    const rank={admin:0,staff:1,student:2};
    Object.values(users).filter(u=>u.uid!==me.uid&&(!q||(u.name+' '+(u.title||'')).toLowerCase().includes(q)))
      .sort((a,b)=>(rank[a.role]??3)-(rank[b.role]??3)||a.name.localeCompare(b.name))
      .forEach(u=>item(avatar(u,42),u.name,(u.title?u.title+' · ':'')+u.role,u.uid,!canDM(u),'Students can message staff and admins only'));
    if(!sideList.children.length)sideList.append(el('div','rc-empty','No matches'));
    if(meSub)meSub.textContent=(me.title?me.title+' · ':'')+me.role;
    if(headEl&&wrap)renderHead();
  }
  function renderHead(){
    headEl.innerHTML='';
    const back=el('button','rc-back','\u2039');back.type='button';back.setAttribute('aria-label','Back');back.onclick=()=>wrap.classList.remove('chat-open');
    const tx=el('div','tx');
    if(target==='room'){const g=el('div','rc-av');g.style.width=g.style.height='40px';g.textContent='#';headEl.append(back,g);tx.append(el('b',null,'Group room'),el('small',null,'Everyone signed in can read and post'))}
    else{const u=users[target]||{name:'User'};headEl.append(back,avatar(u,40));tx.append(el('b',null,u.name),el('small',null,(u.title?u.title+' · ':'')+(u.role||'')))}
    headEl.append(tx);
  }
  function renderMsgs(docs,isRoom){
    box.innerHTML='';
    if(!docs.length){box.append(el('div','rc-empty',isRoom?'No messages yet. Say hello!':'No messages yet. Start the conversation.'));return}
    let prev=null,prevDay='';
    docs.forEach(d=>{
      const m=d.data(),mine=m.from===me.uid,ts=m.createdAt?m.createdAt.toDate():new Date(),day=ts.toDateString();
      if(day!==prevDay){box.append(el('div','rc-day',dayLabel(ts)));prevDay=day;prev=null}
      const first=!prev||prev.from!==m.from||(ts-prev.ts)>300000;
      const row=el('div','rc-row'+(mine?' me':'')+(first?' first':''));
      if(!mine&&isRoom)row.append(first?avatar(users[m.from]||{name:m.name},28):el('span','rc-av-gap'));
      const b=el('div','rc-m');
      if(!mine&&isRoom&&first){const w=el('div','rc-who',m.name),t=(users[m.from]||{}).title;if(t)w.append(el('span',null,' · '+t));b.append(w)}
      b.append(el('span','rc-text',m.text),el('span','rc-time',ts.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));
      if(isRoom&&me.role==='admin'){const x=el('button','rc-x','\u00d7');x.title='Delete message';x.onclick=()=>deleteDoc(d.ref);b.append(x)}
      row.append(b);box.append(row);prev={from:m.from,ts};
    });
    box.scrollTop=box.scrollHeight;
  }
  function open(t,auto){
    target=t;unsubMsgs&&unsubMsgs();renderChips();renderHead();err.textContent='';if(!auto)wrap.classList.add('chat-open');
    const col=t==='room'?collection(db,'room'):collection(db,'dms',cid(me.uid,t),'messages');
    unsubMsgs=onSnapshot(query(col,orderBy('createdAt'),limitToLast(100)),qs=>renderMsgs(qs.docs,t==='room'),
      e=>{box.innerHTML='';box.append(el('div','rc-empty',"You can't view this chat ("+e.code+")."))});
    input.focus&&innerWidth>720&&input.focus();
  }
  async function send(e){
    e.preventDefault();const text=input.value.trim();if(!text)return;err.textContent='';
    try{
      const base={from:me.uid,name:me.name,text,createdAt:serverTimestamp()};
      if(target==='room')await addDoc(collection(db,'room'),base);
      else await addDoc(collection(db,'dms',cid(me.uid,target),'messages'),{...base,to:target});
      input.value='';
    }catch(x){err.textContent="Message not sent: you don't have permission to message here."}
  }
}

// ---- Modfest Assistant (floating widget) ----
const aChat=document.getElementById('chat'),aMsgs=document.getElementById('msgs'),aIn=document.getElementById('chatIn'),aSend=document.getElementById('chatSend');
const aHist=[];
function aAdd(t,who){const d=document.createElement('div');d.className='m '+who;d.textContent=t;aMsgs.appendChild(d);aMsgs.scrollTop=aMsgs.scrollHeight;return d}
function aContext(){
  const days=[...document.querySelectorAll('section.day')].map(sec=>sec.querySelector('h2').textContent+':\n'+
    [...sec.querySelectorAll('.card')].map(x=>'Act '+x.querySelector('.num').textContent+' - '+x.querySelector('.title').textContent+' (Faculty: '+x.querySelector('.fac b').textContent+')').join('\n')).join('\n\n');
  const ppl=(typeof PEOPLE!=='undefined'?Object.values(PEOPLE).flat():[]).map(p=>p.role+': '+p.name).join('\n');
  return "You are the friendly assistant for Modfest 2026 at Modern School. Answer briefly and only using the information below; if you don't know, say so and suggest asking the school.\n\nSCHEDULE\n"+days+"\n\nPEOPLE\n"+ppl;
}
document.getElementById('chatForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const q=aIn.value.trim();if(!q)return;
  aIn.value='';aAdd(q,'me');
  if(!AI){aAdd("The assistant isn't set up yet. Add your Firebase config in chat.js.",'bot');return}
  aSend.disabled=true;aHist.push({role:'user',parts:[{text:q}]});
  const wait=aAdd('Thinking…','bot');
  try{
    const model=getGenerativeModel(AI,{model:CHAT_MODEL,systemInstruction:aContext()});
    const r=await model.generateContent({contents:aHist});
    const a=r.response.text()||"Sorry, I couldn't answer that.";
    aHist.push({role:'model',parts:[{text:a}]});wait.textContent=a;
  }catch(err){aHist.pop();wait.textContent="Couldn't reach the assistant ("+(err.message||err)+"). Please try again.";}
  aSend.disabled=false;aMsgs.scrollTop=aMsgs.scrollHeight;aIn.focus();
});