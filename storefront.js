/* YOUNGEST FASHION: storefront.js  (customer extras)
   Load after ops.js:  <script src="storefront.js"></script>
   1. Drop countdown banner at the top (you set it in Admin > Orders > "Next drop").
   2. "Landmark / directions" box at checkout, saved with the order so the rider can find the door.
   3. "I'm outside" button on orders that are on the way (sends a chat message to you).
   4. "Order on WhatsApp" button on every product.
   5. Install-as-an-app support (Add to Home screen). */
(function(){
"use strict";
const $$=id=>document.getElementById(id);
if(typeof db==="undefined"||!db||!$$("ordD"))return;
const gh=p=>{let x=String(p||"").replace(/\D/g,"");if(x.length===10&&x[0]==="0")x="233"+x.slice(1);return x};
const p2=n=>String(n).padStart(2,"0");
let drop=null,timer=null,wa="";

document.head.insertAdjacentHTML("beforeend",`<style>
#dropBar{background:#0a0a0a;color:#f5f3ee;text-align:center;padding:9px var(--px,4vw);font-size:.9rem;border-bottom:3px solid #c6ff3d}
#dropBar .cd{display:inline-block;background:#c6ff3d;color:#0a0a0a;font-weight:900;padding:2px 8px;border-radius:4px;font-variant-numeric:tabular-nums;margin-left:4px}
#dropBar a{color:#c6ff3d;font-weight:800}
#oLandmark,#oGhPost{width:100%}
.wabtn{display:block;text-align:center;text-decoration:none;margin-top:8px}
</style>`);

/* ---------- 1. drop countdown ---------- */
const bar=document.createElement("div");bar.id="dropBar";bar.hidden=true;bar.setAttribute("role","status");
document.querySelector(".ann").after(bar);
bar.addEventListener("click",e=>{if(e.target.closest("[data-shop]")){e.preventDefault();document.querySelector(".allh").scrollIntoView({behavior:"smooth"})}});
function tick(){
  clearInterval(timer);
  if(!drop){bar.hidden=true;return}
  const render=()=>{
    const ms=drop.at-Date.now();
    if(ms>0){
      const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;
      bar.innerHTML=`🔥 <b>${esc(drop.title)}</b> drops in <span class="cd">${d?d+"d ":""}${p2(h)}:${p2(m)}:${p2(x)}</span>`;bar.hidden=false;return true}
    if(ms>-864e5){bar.innerHTML=`🔥 <b>${esc(drop.title)}</b> is LIVE now. <a href="#" data-shop>Shop the drop</a>`;bar.hidden=false;return false}
    bar.hidden=true;return false};
  if(render())timer=setInterval(()=>{if(!render())clearInterval(timer)},1000)}
async function loadSettings(){
  try{
    const {data}=await db.from("shop_settings").select("drop_title,drop_at,whatsapp").eq("id",1).single();
    wa=(data&&data.whatsapp)||"";
    drop=data&&data.drop_at?{title:data.drop_title||"New drop",at:new Date(data.drop_at)}:null
  }catch(e){}
  tick()}
window.addEventListener("yf:drop",loadSettings);

/* ---------- 2. landmark at checkout ---------- */
const lm=document.createElement("input");lm.id="oLandmark";lm.maxLength=140;lm.autocomplete="off";
lm.placeholder="Landmark / directions, e.g. blue gate opposite the pharmacy";lm.setAttribute("aria-label","Landmark or directions");
$$("oNote").insertAdjacentElement("beforebegin",lm);
const gp=document.createElement("input");gp.id="oGhPost";gp.maxLength=16;gp.autocomplete="off";gp.setAttribute("aria-label","GhanaPost GPS code");
gp.placeholder="GhanaPost GPS code (optional), e.g. GA-123-4567";
lm.insertAdjacentElement("beforebegin",gp);
const prevRpc=db.rpc;
db.rpc=function(name,args,opts){
  if(name==="place_order"){
    const t=lm.value.trim(),g=gp.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,"");
    const bits=[g?"GhanaPost: "+g:"",t?"Landmark: "+t:"",args.p_note].filter(Boolean);
    if(bits.length)args={...args,p_note:bits.join(" | ")}}
  return prevRpc.call(db,name,args,opts)};
$$("ordD").addEventListener("close",()=>{lm.value="";gp.value=""});

/* ---------- 3. "I'm outside" ---------- */
const prevPanel=window.openPanel;
window.openPanel=async function(){
  await prevPanel.apply(this,arguments);
  try{
    if(isAdmin())return;
    document.querySelectorAll("#pList .ord").forEach(el=>{
      const cb=el.querySelector("[data-chat]"),o=cb&&lastOrders.find(x=>String(x.id)===cb.dataset.chat);
      if(o&&o.status==="on the way")cb.insertAdjacentHTML("beforebegin",`<button class="btn" data-here="${o.id}" type="button">📍 I am outside</button>`)})
  }catch(e){console.error(e)}};
$$("pList").addEventListener("click",async e=>{
  const b=e.target.closest("[data-here]");if(!b)return;
  b.disabled=true;
  const {error}=await db.from("messages").insert({order_id:+b.dataset.here,sender_id:user.id,body:"📍 I am outside at the delivery spot."});
  if(error){b.disabled=false;return alert(error.message)}
  notify("Sent","We told the rider you are outside");b.textContent="✓ Rider told"});

/* ---------- 4. order on WhatsApp ---------- */
const prevShow=window.showDet;
window.showDet=function(id){
  prevShow(id);
  try{
    if(!wa)return;
    const p=products.find(x=>x.id==id);if(!p)return;
    const sz=chosen[p.id],txt=`Hi Youngest Fashion, I want to order:\n${p.name}${p.brand?" ("+p.brand+")":""}\nSize: ${sz||"please tell me the sizes you have"}\nPrice: ${money(p.price)}`;
    $$("detBody").querySelector(".buy")?.insertAdjacentHTML("afterend",`<a class="btn ghost wabtn" target="_blank" rel="noopener" href="https://wa.me/${gh(wa)}?text=${encodeURIComponent(txt)}">💬 Order on WhatsApp</a>`)
  }catch(e){console.error(e)}};

/* ---------- 5. install as an app ---------- */
let installEv=null;
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();installEv=e;
  const col=document.querySelectorAll(".foot > div")[2];
  if(col&&!$$("installLink"))col.insertAdjacentHTML("beforeend",'<a href="#" id="installLink">📲 Install the app</a>')});
document.addEventListener("click",async e=>{
  if(!e.target.closest("#installLink")||!installEv)return;
  e.preventDefault();installEv.prompt();try{await installEv.userChoice}catch(x){}installEv=null;$$("installLink")?.remove()});
if("serviceWorker" in navigator&&location.protocol==="https:")window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));

loadSettings();
})();
/* YOUNGEST FASHION: storefront.js  (customer extras)
   Load after ops.js:  <script src="storefront.js"></script>
   1. Drop countdown banner at the top (you set it in Admin > Orders > "Next drop").
   2. "Landmark / directions" box at checkout, saved with the order so the rider can find the door.
   3. "I'm outside" button on orders that are on the way (sends a chat message to you).
   4. "Order on WhatsApp" button on every product.
   5. Install-as-an-app support (Add to Home screen). */
(function(){
"use strict";
const $$=id=>document.getElementById(id);
if(typeof db==="undefined"||!db||!$$("ordD"))return;
const gh=p=>{let x=String(p||"").replace(/\D/g,"");if(x.length===10&&x[0]==="0")x="233"+x.slice(1);return x};
const p2=n=>String(n).padStart(2,"0");
let drop=null,timer=null,wa="";

document.head.insertAdjacentHTML("beforeend",`<style>
#dropBar{background:#0a0a0a;color:#f5f3ee;text-align:center;padding:9px var(--px,4vw);font-size:.9rem;border-bottom:3px solid #c6ff3d}
#dropBar .cd{display:inline-block;background:#c6ff3d;color:#0a0a0a;font-weight:900;padding:2px 8px;border-radius:4px;font-variant-numeric:tabular-nums;margin-left:4px}
#dropBar a{color:#c6ff3d;font-weight:800}
#oLandmark,#oGhPost{width:100%}
.wabtn{display:block;text-align:center;text-decoration:none;margin-top:8px}
</style>`);

/* ---------- 1. drop countdown ---------- */
const bar=document.createElement("div");bar.id="dropBar";bar.hidden=true;bar.setAttribute("role","status");
document.querySelector(".ann").after(bar);
bar.addEventListener("click",e=>{if(e.target.closest("[data-shop]")){e.preventDefault();document.querySelector(".allh").scrollIntoView({behavior:"smooth"})}});
function tick(){
  clearInterval(timer);
  if(!drop){bar.hidden=true;return}
  const render=()=>{
    const ms=drop.at-Date.now();
    if(ms>0){
      const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60;
      bar.innerHTML=`🔥 <b>${esc(drop.title)}</b> drops in <span class="cd">${d?d+"d ":""}${p2(h)}:${p2(m)}:${p2(x)}</span>`;bar.hidden=false;return true}
    if(ms>-864e5){bar.innerHTML=`🔥 <b>${esc(drop.title)}</b> is LIVE now. <a href="#" data-shop>Shop the drop</a>`;bar.hidden=false;return false}
    bar.hidden=true;return false};
  if(render())timer=setInterval(()=>{if(!render())clearInterval(timer)},1000)}
async function loadSettings(){
  try{
    const {data}=await db.from("shop_settings").select("drop_title,drop_at,whatsapp").eq("id",1).single();
    wa=(data&&data.whatsapp)||"";
    drop=data&&data.drop_at?{title:data.drop_title||"New drop",at:new Date(data.drop_at)}:null
  }catch(e){}
  tick()}
window.addEventListener("yf:drop",loadSettings);

/* ---------- 2. landmark at checkout ---------- */
const lm=document.createElement("input");lm.id="oLandmark";lm.maxLength=140;lm.autocomplete="off";
lm.placeholder="Landmark / directions, e.g. blue gate opposite the pharmacy";lm.setAttribute("aria-label","Landmark or directions");
$$("oNote").insertAdjacentElement("beforebegin",lm);
const gp=document.createElement("input");gp.id="oGhPost";gp.maxLength=16;gp.autocomplete="off";gp.setAttribute("aria-label","GhanaPost GPS code");
gp.placeholder="GhanaPost GPS code (optional), e.g. GA-123-4567";
lm.insertAdjacentElement("beforebegin",gp);
const prevRpc=db.rpc;
db.rpc=function(name,args,opts){
  if(name==="place_order"){
    const t=lm.value.trim(),g=gp.value.trim().toUpperCase().replace(/[^A-Z0-9-]/g,"");
    const bits=[g?"GhanaPost: "+g:"",t?"Landmark: "+t:"",args.p_note].filter(Boolean);
    if(bits.length)args={...args,p_note:bits.join(" | ")}}
  return prevRpc.call(db,name,args,opts)};
$$("ordD").addEventListener("close",()=>{lm.value="";gp.value=""});

/* ---------- 3. "I'm outside" ---------- */
const prevPanel=window.openPanel;
window.openPanel=async function(){
  await prevPanel.apply(this,arguments);
  try{
    if(isAdmin())return;
    document.querySelectorAll("#pList .ord").forEach(el=>{
      const cb=el.querySelector("[data-chat]"),o=cb&&lastOrders.find(x=>String(x.id)===cb.dataset.chat);
      if(o&&o.status==="on the way")cb.insertAdjacentHTML("beforebegin",`<button class="btn" data-here="${o.id}" type="button">📍 I am outside</button>`)})
  }catch(e){console.error(e)}};
$$("pList").addEventListener("click",async e=>{
  const b=e.target.closest("[data-here]");if(!b)return;
  b.disabled=true;
  const {error}=await db.from("messages").insert({order_id:+b.dataset.here,sender_id:user.id,body:"📍 I am outside at the delivery spot."});
  if(error){b.disabled=false;return alert(error.message)}
  notify("Sent","We told the rider you are outside");b.textContent="✓ Rider told"});

/* ---------- 4. order on WhatsApp ---------- */
const prevShow=window.showDet;
window.showDet=function(id){
  prevShow(id);
  try{
    if(!wa)return;
    const p=products.find(x=>x.id==id);if(!p)return;
    const sz=chosen[p.id],txt=`Hi Youngest Fashion, I want to order:\n${p.name}${p.brand?" ("+p.brand+")":""}\nSize: ${sz||"please tell me the sizes you have"}\nPrice: ${money(p.price)}`;
    $$("detBody").querySelector(".buy")?.insertAdjacentHTML("afterend",`<a class="btn ghost wabtn" target="_blank" rel="noopener" href="https://wa.me/${gh(wa)}?text=${encodeURIComponent(txt)}">💬 Order on WhatsApp</a>`)
  }catch(e){console.error(e)}};

/* ---------- 5. install as an app ---------- */
let installEv=null;
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();installEv=e;
  const col=document.querySelectorAll(".foot > div")[2];
  if(col&&!$$("installLink"))col.insertAdjacentHTML("beforeend",'<a href="#" id="installLink">📲 Install the app</a>')});
document.addEventListener("click",async e=>{
  if(!e.target.closest("#installLink")||!installEv)return;
  e.preventDefault();installEv.prompt();try{await installEv.userChoice}catch(x){}installEv=null;$$("installLink")?.remove()});
if("serviceWorker" in navigator&&location.protocol==="https:")window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));

loadSettings();
})();
