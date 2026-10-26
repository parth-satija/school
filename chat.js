// @ts-nocheck
// Firebase loads dynamically so a failure shows a message instead of silently killing the page.
const FB="https://www.gstatic.com/firebasejs/11.10.0/";
let loadErr=null,M={};
try{const [a,au,fs]=await Promise.all([import(FB+"firebase-app.js"),import(FB+"firebase-auth.js"),import(FB+"firebase-firestore.js")]);Object.assign(M,a,au,fs)}catch(e){loadErr=e}
try{Object.assign(M,await import(FB+"firebase-ai.js"))}catch(e){console.warn("firebase-ai failed to load",e)}
try{Object.assign(M,await import(FB+"firebase-app-check.js"))}catch(e){console.warn("app-check failed to load",e)}
const {initializeApp,getAuth,GoogleAuthProvider,signInWithPopup,signOut,onAuthStateChanged,getAI,getGenerativeModel,GoogleAIBackend,initializeAppCheck,ReCaptchaV3Provider,getFirestore,collection,doc,getDoc,setDoc,updateDoc,addDoc,deleteDoc,onSnapshot,query,orderBy,limitToLast,serverTimestamp}=M;
window.__assistantReady=true;
// Firebase chat: Google sign-in, role-based permissions, group room, direct messages.

// 1) Paste your Firebase web app config here (Project settings > Your apps).
const FIREBASE_CONFIG={apiKey:"YOUR_API_KEY",authDomain:"YOUR_PROJECT.firebaseapp.com",projectId:"YOUR_PROJECT",appId:"YOUR_APP_ID"};

// 2) Gemini assistant, served through Firebase AI Logic (no API key in this site).
const CHAT_MODEL="gemini-3.1-flash-lite";
// 3) Recommended: reCAPTCHA v3 site key for Firebase App Check (Firebase console > App Check). Leave "" to skip.
const APPCHECK_SITE_KEY="";
let AI=null;

const css=`
.rc{max-width:760px;margin:26px auto 0;background:var(--ink);border:1px solid var(--line);border-top:4px solid var(--maroon);border-radius:22px;overflow:hidden}
.rc-top{display:flex;align-items:center;gap:10px;padding:14px 16px;background:linear-gradient(135deg,var(--maroon-lo),var(--maroon))}
.rc-top img{width:34px;height:34px;border-radius:50%}.rc-top b{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rc-badge{font-size:.78rem;font-weight:600;background:#000;padding:3px 10px;border-radius:999px}
.rc-top button{background:none;border:1px solid rgba(255,255,255,.5);color:#fff;border-radius:999px;padding:6px 12px;cursor:pointer;font:inherit;font-size:.85rem}
.rc-chips{display:flex;gap:8px;padding:12px;overflow-x:auto;border-bottom:1px solid var(--line)}
.rc-chips button{flex:none;display:flex;align-items:center;gap:7px;font:600 .9rem Figtree,sans-serif;color:var(--text);background:var(--card);border:1px solid var(--line);border-radius:999px;padding:7px 14px;cursor:pointer}
.rc-chips button[aria-pressed=true]{background:var(--maroon);border-color:var(--maroon)}
.rc-chips button:disabled{opacity:.4;cursor:not-allowed}
.rc-chips small{color:var(--muted);font-weight:400}
.rc-msgs{height:min(52vh,460px);overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}
.rc-m{max-width:80%;padding:9px 13px;border-radius:16px;background:var(--card);border:1px solid var(--line);align-self:flex-start;border-bottom-left-radius:4px;white-space:pre-wrap;word-wrap:break-word}
.rc-m.me{background:var(--maroon);border-color:var(--maroon);align-self:flex-end;border-radius:16px 16px 4px 16px}
.rc-m .who{font-size:.78rem;color:#e6a39e;font-weight:600}.rc-m.me .who{color:#f7d6d3}
.rc-m .t{font-size:.7rem;color:var(--muted);margin-left:8px}.rc-m .x{background:none;border:0;color:var(--muted);cursor:pointer;margin-left:6px}
.rc-form{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line)}
.rc-form input{flex:1;min-width:0;background:#0a0606;color:var(--text);border:1px solid var(--line);border-radius:999px;padding:11px 16px;font:inherit}
.rc-form button{border:0;border-radius:999px;background:var(--maroon);color:#fff;font:600 .95rem Figtree,sans-serif;padding:0 20px;cursor:pointer}
.rc-note{padding:30px 20px;text-align:center;color:var(--muted)}
.rc-note button{margin-top:16px;border:0;border-radius:999px;background:var(--maroon);color:#fff;font:600 1rem Figtree,sans-serif;padding:13px 26px;cursor:pointer}
.rc-title{display:flex;gap:8px;padding:10px 12px;border-bottom:1px solid var(--line)}.rc-title input{flex:1;min-width:0;background:#0a0606;color:var(--text);border:1px solid var(--line);border-radius:999px;padding:8px 14px;font:inherit;font-size:.9rem}.rc-title button{border:1px solid var(--maroon);background:none;color:var(--text);border-radius:999px;padding:0 16px;cursor:pointer;font:600 .85rem Figtree,sans-serif}.rc-title button:hover{background:var(--maroon)}
.rc-err{color:#ff9a92;font-size:.85rem;padding:0 16px 10px}`;
document.head.insertAdjacentHTML('beforeend','<style>'+css+'</style>');

const root=document.getElementById('chatApp');
const el=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e};
const note=(msg,btn)=>{root.innerHTML='';const d=el('div','rc rc-note');d.append(el('p',null,msg));if(btn){const b=el('button',null,btn[0]);b.onclick=btn[1];d.append(b)}root.append(d)};

if(loadErr){
  console.error(loadErr);note("Couldn't load Firebase ("+(loadErr.message||loadErr)+"). Open the site over http(s), not as a local file, and check the browser console.");
}else if(FIREBASE_CONFIG.apiKey==="YOUR_API_KEY"){
  note("Chat isn't set up yet. Add your Firebase config to chat.js (see README).");
}else{
  const app=initializeApp(FIREBASE_CONFIG),auth=getAuth(app),db=getFirestore(app);
  if(APPCHECK_SITE_KEY&&initializeAppCheck)initializeAppCheck(app,{provider:new ReCaptchaV3Provider(APPCHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});
  if(getAI)AI=getAI(app,{backend:new GoogleAIBackend()});
  let me=null,users={},target='room',unsubMsgs=null,unsubUsers=null;
  const canDM=u=>me.role!=='student'||['staff','admin'].includes(u.role); // students can only message staff/admin
  const cid=(a,b)=>a<b?a+'_'+b:b+'_'+a;
  const login=()=>signInWithPopup(auth,new GoogleAuthProvider()).catch(e=>note("Sign-in failed: "+e.code,["Try again",login]));

  onAuthStateChanged(auth,async u=>{
    unsubMsgs&&unsubMsgs();unsubUsers&&unsubUsers();
    if(!u){me=null;return note("Sign in with Google to join the Modfest chat.",["Sign in with Google",login])}
    try{
      const ref=doc(db,'users',u.uid);let s=await getDoc(ref);
      if(!s.exists())await setDoc(ref,{name:u.displayName||u.email,email:u.email,photo:u.photoURL||'',role:'student',createdAt:serverTimestamp()});
      else await updateDoc(ref,{name:u.displayName||u.email,photo:u.photoURL||''});
      me={uid:u.uid,...(await getDoc(ref)).data()};
      unsubUsers=onSnapshot(collection(db,'users'),qs=>{users={};qs.forEach(d=>users[d.id]={uid:d.id,...d.data()});me={...me,...users[me.uid]};renderChips()});
      build();open('room');
    }catch(e){note("Couldn't load chat ("+e.code+"). Check the Firestore rules in README.",["Sign out",()=>signOut(auth)])}
  });

  let chips,box,input,err,tinp;
  function build(){
    root.innerHTML='';const w=el('div','rc');
    const top=el('div','rc-top');const im=el('img');im.src=me.photo;im.alt='';
    const out=el('button',null,'Sign out');out.onclick=()=>signOut(auth);
    top.append(im,el('b',null,me.name),el('span','rc-badge',me.role),out);
    const tf=el('form','rc-title');tinp=el('input');tinp.placeholder='Add your title, e.g. Class 10-B or Drama Club';tinp.maxLength=40;tinp.value=me.title||'';
    const tb=el('button',null,'Save title');tf.append(tinp,tb);
    tf.onsubmit=async e=>{e.preventDefault();try{await updateDoc(doc(db,'users',me.uid),{title:tinp.value.trim()});tb.textContent='Saved'}catch(x){err.textContent="Couldn't save title."}setTimeout(()=>tb.textContent='Save title',1500)};
    chips=el('div','rc-chips');box=el('div','rc-msgs');err=el('div','rc-err');
    const f=el('form','rc-form');input=el('input');input.placeholder='Write a message';input.maxLength=1000;input.autocomplete='off';
    f.append(input,el('button',null,'Send'));f.onsubmit=send;
    w.append(top,tf,chips,box,err,f);root.append(w);
  }
  function renderChips(){
    if(!chips)return;chips.innerHTML='';
    const r=el('button',null,'Group room');r.setAttribute('aria-pressed',target==='room');r.onclick=()=>open('room');chips.append(r);
    Object.values(users).filter(u=>u.uid!==me.uid).sort((a,b)=>a.name.localeCompare(b.name)).forEach(u=>{
      const b=el('button',null,u.name);b.append(el('small',null,u.title?u.title+' · '+u.role:u.role));
      b.setAttribute('aria-pressed',target===u.uid);
      if(!canDM(u)){b.disabled=true;b.title='Students can message staff and admins only'}
      b.onclick=()=>open(u.uid);chips.append(b);
    });
  }
  function open(t){
    target=t;unsubMsgs&&unsubMsgs();renderChips();err.textContent='';
    const col=t==='room'?collection(db,'room'):collection(db,'dms',cid(me.uid,t),'messages');
    unsubMsgs=onSnapshot(query(col,orderBy('createdAt'),limitToLast(100)),qs=>{
      box.innerHTML='';
      if(qs.empty)box.append(el('div','rc-note','No messages yet. Say hello!'));
      qs.forEach(d=>{
        const m=d.data(),mine=m.from===me.uid,b=el('div','rc-m'+(mine?' me':''));
        const ttl=(users[m.from]||{}).title,h=el('div','who',(mine?'You':m.name)+(ttl?' · '+ttl:''));
        if(m.createdAt)h.append(el('span','t',m.createdAt.toDate().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})));
        if(t==='room'&&me.role==='admin'){const x=el('button','x','delete');x.onclick=()=>deleteDoc(d.ref);h.append(x)}
        b.append(h,el('div',null,m.text));box.append(b);
      });
      box.scrollTop=box.scrollHeight;
    },e=>{box.innerHTML='';box.append(el('div','rc-note',"You can't view this chat ("+e.code+")."))});
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