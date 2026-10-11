/* YOUNGEST FASHION: shop-features.js
   Load LAST (after precise-location.js):  <script src="shop-features.js"></script>

   1. Delivery area: admin sets the shop pin + radius (Orders panel > "Delivery area").
      Customers outside the circle are told before ordering, and the server refuses the order too.
   2. Size guide + "find my size" helper (clothing and shoes) on every product.
   3. Back-in-stock alerts: "Notify me" on sold-out products, alert shown when you restock.
   4. Track your order page (order number + phone, no login needed).
   5. Reviews and star ratings (only customers whose order was delivered can review).
   6. Help & FAQ, plus footer links.
   Admin also gets: distance from shop on every order and pin, and the delivery circle on the order map.
   (Recently viewed, share links, reorder and in-panel order steps already live in shop-extras.js.) */
(function(){
"use strict";
const $$=id=>document.getElementById(id);
if(!$$("detBody")||!$$("ordD"))return;
const HAS_DB=typeof db!=="undefined"&&!!db;
let S={},reviews=[],alerts=new Set(),bought=new Set(),notifs=[],nch=null;
const dist=(a,b,c,d)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 2*6371*Math.asin(Math.sqrt(Math.min(1,h)))};
const gh=p=>{let x=String(p||"").replace(/\D/g,"");if(x.length===10&&x[0]==="0")x="233"+x.slice(1);return x};
const hasArea=()=>!!S.radius_km&&S.shop_lat!=null&&S.shop_lng!=null;
const stars=n=>{n=Math.round(n);return "★".repeat(n)+"☆".repeat(5-n)};
const isShoe=p=>/sneaker|shoe|slide|boot|trainer/i.test((p.category||"")+" "+(p.type||""))||((p.sizes||[]).length>0&&p.sizes.every(s=>/^\d+(\.\d+)?$/.test(String(s))));
const shopDist=o=>hasArea()&&o.lat!=null&&o.lng!=null?dist(S.shop_lat,S.shop_lng,Number(o.lat),Number(o.lng)):null;

/* ---------- styles ---------- */
document.head.insertAdjacentHTML("beforeend",`<style>
.stars{color:var(--price);font-weight:800;letter-spacing:.08em}
.stars.sm{font-size:.8rem;margin-top:-2px}
.rev{border-top:2px dashed var(--line);padding:10px 0}
.rev p{margin-top:4px;overflow-wrap:anywhere}
.lnk{background:none;border:0;text-decoration:underline;cursor:pointer;color:inherit;font-size:.8rem;margin-left:8px}
.starpick button{font-size:1.7rem;background:none;border:0;cursor:pointer;color:var(--price);min-width:44px;min-height:44px;padding:0}
#yfX{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.yfsz{width:100%;margin-top:8px}
#areaMap{height:240px;border-radius:10px;border:2px solid var(--ink);margin:8px 0;background:var(--card)}
table.szt{width:100%;border-collapse:collapse;font-size:.9rem;margin:8px 0}
.szt th,.szt td{border:2px solid var(--line);padding:6px 8px;text-align:center}
.szt th{background:var(--ink);color:var(--bg);text-transform:uppercase;font-size:.75rem;letter-spacing:.05em}
details.faq{border:2px solid var(--line);border-radius:8px;padding:8px 12px;margin-bottom:8px}
details.faq summary{font-weight:800;cursor:pointer}
details.faq p{margin-top:6px}
.chk{display:flex;gap:8px;align-items:center}
.res{font-weight:800;padding:10px;border:2px solid var(--ink);border-radius:8px;background:var(--lime);color:#0a0a0a;text-align:center}
</style>`);

/* ---------- little dialog factory ---------- */
function dlg(id,html){
  const d=document.createElement("dialog");d.id=id;
  d.innerHTML=html+'<button class="btn ghost" data-x type="button" style="width:100%;margin-top:10px">Close</button>';
  d.addEventListener("click",e=>{if(e.target.closest("[data-x]"))d.close()});
  document.body.append(d);return d}

/* =========================================================
   1. DELIVERY AREA
   ========================================================= */
async function loadSettings(){
  if(!HAS_DB)return;
  try{const {data}=await db.from("shop_settings").select("*").eq("id",1).single();if(data){S=data;applySettings()}}catch(e){}}
function applySettings(){
  if(S.whatsapp&&typeof WHATSAPP!=="undefined"&&!WHATSAPP){
    const w=$$("wa");if(w){w.href="https://wa.me/"+gh(S.whatsapp)+"?text="+encodeURIComponent("Hi, I want to order from Youngest Fashion");w.hidden=false}}
  const al=$$("areaLine");if(al)al.textContent=hasArea()?"We deliver within "+S.radius_km+" km of our shop":"";
  checkRadius()}

/* checkout: tell the customer if their pin is outside the delivery area */
const rad=document.createElement("p");rad.className="meta";rad.id="radStat";rad.hidden=true;rad.style.fontWeight="800";
($$("pickBox")||$$("oLocMsg")).after(rad);
let blocked=false;
function checkRadius(){
  const og=$$("oGo");
  if(!hasArea()||typeof pos==="undefined"||!pos){rad.hidden=true;if(blocked){og.disabled=false;blocked=false}return}
  const d=dist(S.shop_lat,S.shop_lng,pos.lat,pos.lng),r=+S.radius_km;rad.hidden=false;
  if(d>r){rad.textContent="❌ Your pin is "+d.toFixed(1)+" km from our shop. We deliver within "+r+" km, so we cannot deliver here yet. Move the pin if it is in the wrong place.";rad.style.color="#d6125f";og.disabled=true;blocked=true}
  else{rad.textContent="✅ "+d.toFixed(1)+" km from our shop, inside our delivery area.";rad.style.color="";if(blocked){og.disabled=false;blocked=false}}}
if($$("locStat"))new MutationObserver(checkRadius).observe($$("locStat"),{childList:true,characterData:true,subtree:true,attributes:true});
$$("ordD").addEventListener("close",checkRadius);

/* admin: set the shop pin + radius + WhatsApp number */
const areaD=dlg("areaD",`<h2>Delivery area</h2>
 <p class="meta">Drag the pin to your shop. Customers whose pin is outside the circle cannot place an order.</p>
 <div id="areaMap"></div>
 <div class="f">
  <label class="meta" for="areaKm">Delivery radius (km)</label>
  <input id="areaKm" type="number" min="0.5" step="0.5" inputmode="decimal" placeholder="e.g. 10">
  <label class="chk meta"><input type="checkbox" id="areaOff"> No limit: deliver anywhere</label>
  <button class="btn ghost" id="areaMe" type="button">📍 Use my current location as the shop</button>
  <label class="meta" for="areaWa">Shop WhatsApp number (country code, digits only)</label>
  <input id="areaWa" inputmode="numeric" placeholder="233500000000">
  <button class="btn" id="areaSave" type="button">Save delivery area</button>
  <p class="meta" id="areaMsg" aria-live="polite"></p></div>`);
let am=null,apin=null,acirc=null,ap=null;
function drawArea(fit){
  if(!am||!ap)return;
  const ll=[ap.lat,ap.lng];
  if(!apin){apin=L.marker(ll,{draggable:true}).addTo(am);apin.on("dragend",()=>{const p=apin.getLatLng();ap={lat:p.lat,lng:p.lng};drawArea()})}else apin.setLatLng(ll);
  if(acirc){am.removeLayer(acirc);acirc=null}
  const k=parseFloat($$("areaKm").value);
  if(!$$("areaOff").checked&&k>0)acirc=L.circle(ll,{radius:k*1000,color:"#c6ff3d",weight:3,fillOpacity:.12}).addTo(am);
  if(fit)am.setView(ll,k>0?(k>30?9:k>8?11:13):14)}
async function openArea(){
  try{$$("panelD").close()}catch(e){}
  areaD.showModal();$$("areaMsg").textContent="";
  try{await loadLeaflet()}catch(e){$$("areaMsg").textContent="The map could not load. Check your connection.";return}
  if(!am){am=L.map("areaMap").setView([20,0],2);L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(am);
    am.on("click",e=>{ap={lat:e.latlng.lat,lng:e.latlng.lng};drawArea()})}
  $$("areaKm").value=S.radius_km||"";$$("areaOff").checked=!S.radius_km&&S.shop_lat!=null;$$("areaWa").value=S.whatsapp||"";
  ap=S.shop_lat!=null?{lat:S.shop_lat,lng:S.shop_lng}:null;
  setTimeout(()=>{am.invalidateSize();if(ap)drawArea(true);else $$("areaMsg").textContent="Tap the map where your shop is."},200)}
$$("areaKm").addEventListener("input",()=>{if(parseFloat($$("areaKm").value)>0)$$("areaOff").checked=false;drawArea()});
$$("areaOff").addEventListener("change",()=>drawArea());
$$("areaMe").onclick=()=>{
  if(!navigator.geolocation){$$("areaMsg").textContent="This device cannot share GPS.";return}
  $$("areaMsg").textContent="Finding you...";
  navigator.geolocation.getCurrentPosition(p=>{ap={lat:p.coords.latitude,lng:p.coords.longitude};drawArea(true);$$("areaMsg").textContent="Pin moved to you (±"+Math.round(p.coords.accuracy)+" m)."},
   ()=>{$$("areaMsg").textContent="Location blocked. Tap the map to place the pin instead."},{enableHighAccuracy:true,timeout:15000,maximumAge:0})};
$$("areaSave").onclick=async()=>{
  const off=$$("areaOff").checked,k=parseFloat($$("areaKm").value),msg=$$("areaMsg");
  if(!ap){msg.textContent="Tap the map to place your shop first.";return}
  if(!off&&!(k>0)){msg.textContent="Enter a radius in km, or tick No limit.";return}
  const row={shop_lat:ap.lat,shop_lng:ap.lng,radius_km:off?null:k,whatsapp:gh($$("areaWa").value)||null,updated_at:new Date().toISOString()};
  msg.textContent="Saving...";
  const {data,error}=await db.from("shop_settings").update(row).eq("id",1).select();
  if(error){msg.textContent=error.message;return}
  if(!data||!data.length){msg.textContent="Only admins can change the delivery area.";return}
  S={...S,...row};applySettings();msg.textContent=off?"Saved. We deliver anywhere.":"Saved. Orders outside "+k+" km are now blocked."};

/* =========================================================
   2. SIZE GUIDE
   ========================================================= */
const cl=[["S","88–94","73–79"],["M","94–102","79–86"],["L","102–110","86–94"],["XL","110–118","94–102"]];
const euRows=[38,39,40,41,42,43,44,45].map(e=>[e,(e/1.5-1.5).toFixed(1)]);
const sizeD=dlg("sizeD",`<h2>Size guide</h2>
 <div class="admtabs"><button class="tab" data-st="cl" aria-pressed="true" type="button">Clothing</button><button class="tab" data-st="sh" aria-pressed="false" type="button">Shoes</button></div>
 <div id="szCl"><table class="szt"><tr><th>Size</th><th>Chest (cm)</th><th>Waist (cm)</th></tr>${cl.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</table>
  <p class="meta">Measure around the fullest part of your chest, with the tape level and snug, not tight.</p>
  <h3 style="margin:10px 0 6px">Find my size</h3>
  <div class="f"><input id="szChest" type="number" inputmode="decimal" placeholder="Chest in cm (best)">
   <p class="meta" style="text-align:center">or</p>
   <input id="szH" type="number" inputmode="decimal" placeholder="Height in cm"><input id="szW" type="number" inputmode="decimal" placeholder="Weight in kg">
   <button class="btn" id="szGoC" type="button">Find my size</button><div id="szOutC" aria-live="polite"></div></div></div>
 <div id="szSh" hidden><table class="szt"><tr><th>EU size</th><th>Foot length (cm)</th></tr>${euRows.map(r=>`<tr><td><b>${r[0]}</b></td><td>${r[1]}</td></tr>`).join("")}</table>
  <p class="meta">Stand on paper, mark your longest toe and heel, and measure in the evening when feet are biggest.</p>
  <h3 style="margin:10px 0 6px">Find my size</h3>
  <div class="f"><input id="szF" type="number" inputmode="decimal" placeholder="Foot length in cm"><button class="btn" id="szGoS" type="button">Find my size</button><div id="szOutS" aria-live="polite"></div></div></div>
 <p class="meta" style="margin-top:10px">These are typical measurements. Fit can vary by item, so message us if you are unsure.</p>`);
function sizeTab(t){
  sizeD.querySelectorAll("[data-st]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.st===t));
  $$("szCl").hidden=t!=="cl";$$("szSh").hidden=t!=="sh"}
sizeD.addEventListener("click",e=>{const b=e.target.closest("[data-st]");if(b)sizeTab(b.dataset.st)});
$$("szGoC").onclick=()=>{
  const c=parseFloat($$("szChest").value),h=parseFloat($$("szH").value),w=parseFloat($$("szW").value),o=$$("szOutC");let s=null;
  if(c>0)s=c<94?"S":c<102?"M":c<110?"L":"XL";
  else if(w>0){const o4=["S","M","L","XL"];let i=w<60?0:w<72?1:w<85?2:3;if(h>=185)i=Math.min(3,i+1);else if(h>0&&h<160)i=Math.max(0,i-1);s=o4[i]}
  o.innerHTML=s?`<p class="res">You are probably a ${s}</p><p class="meta">Between two sizes? Pick the bigger one for a looser fit.</p>`:'<p class="meta">Enter your chest, or your height and weight.</p>'};
$$("szGoS").onclick=()=>{
  const f=parseFloat($$("szF").value),o=$$("szOutS");
  if(!(f>=15&&f<=35)){o.innerHTML='<p class="meta">Enter your foot length in cm, for example 26.</p>';return}
  const eu=Math.round((f+1.5)*1.5);
  o.innerHTML=`<p class="res">You are probably EU ${eu}</p><p class="meta">Between two sizes? Pick the bigger one.</p>`};
function openSize(t){sizeTab(t||"cl");sizeD.showModal()}

/* =========================================================
   3. BACK-IN-STOCK ALERTS + NOTIFICATIONS
   ========================================================= */
async function loadMine(){
  if(!HAS_DB||!user)return;
  try{
    const [a,o,n]=await Promise.all([
      db.from("stock_alerts").select("product_id"),
      db.from("orders").select("items").eq("user_id",user.id).eq("status","delivered"),
      db.from("notifications").select("*").eq("read",false).order("created_at",{ascending:false})]);
    alerts=new Set((a.data||[]).map(r=>String(r.product_id)));
    bought=new Set();(o.data||[]).forEach(r=>(r.items||[]).forEach(i=>bought.add(String(i.id))));
    notifs=n.data||[];
    if(notifs.length)notify(notifs[0].title,(notifs[0].body||"")+(notifs.length>1?" (+"+(notifs.length-1)+" more)":""));
  }catch(e){}
  if(!nch&&user)nch=db.channel("yf-notif-"+user.id).on("postgres_changes",{event:"INSERT",schema:"public",table:"notifications",filter:"user_id=eq."+user.id},p=>{notifs.unshift(p.new);notify(p.new.title,p.new.body||"")}).subscribe()}
function onAuth(){
  if(!user){alerts=new Set();bought=new Set();notifs=[];if(nch&&HAS_DB){db.removeChannel(nch);nch=null}return}
  loadMine()}
const prevAuth=window.afterAuth;
window.afterAuth=async function(u){await prevAuth(u);onAuth()};

/* =========================================================
   5. REVIEWS (ratings on cards + product popup)
   ========================================================= */
async function loadReviews(){
  if(!HAS_DB)return;
  try{const {data}=await db.from("reviews").select("id,product_id,user_id,rating,body,author,created_at").order("created_at",{ascending:false}).limit(2000);
    reviews=data||[];if(typeof products!=="undefined"&&products.length)render()}catch(e){}}
const ratingOf=id=>{const l=reviews.filter(r=>String(r.product_id)===String(id));return l.length?{avg:l.reduce((a,r)=>a+r.rating,0)/l.length,n:l.length}:null};
function decorateCards(){
  document.querySelectorAll("#grid .card").forEach(c=>{
    const h=c.querySelector("h3[data-det]");if(!h||c.querySelector(".stars"))return;
    const r=ratingOf(h.dataset.det);if(!r)return;
    c.querySelector(".meta")?.insertAdjacentHTML("afterend",`<div class="stars sm" aria-label="${r.avg.toFixed(1)} out of 5">★ ${r.avg.toFixed(1)} <span class="meta">(${r.n})</span></div>`)})}
const prevRender=window.render;
window.render=function(){prevRender();try{decorateCards()}catch(e){}};

function notifyHtml(p){
  if(p.stock!==0)return "";
  return alerts.has(String(p.id))
    ?`<button class="btn" data-notify="${p.id}" data-on="1" type="button">🔔 We will tell you (tap to cancel)</button>`
    :`<button class="btn" data-notify="${p.id}" type="button">🔔 Notify me when it is back</button>`}
function reviewsHtml(p){
  const l=reviews.filter(r=>String(r.product_id)===String(p.id)),rt=ratingOf(p.id);
  let h=`<h3>Reviews</h3>`+(rt?`<p class="stars"><b>${rt.avg.toFixed(1)}</b> ${stars(rt.avg)} <span class="meta">(${rt.n})</span></p>`:`<p class="meta">No reviews yet.</p>`);
  h+=l.slice(0,5).map(r=>`<div class="rev"><span class="stars">${stars(r.rating)}</span> <b>${esc(r.author||"Customer")}</b><span class="meta"> · ${new Date(r.created_at).toLocaleDateString()}</span>${r.body?`<p>${esc(r.body)}</p>`:""}${(isStaff()||(user&&r.user_id===user.id))?`<button class="lnk" data-delrev="${r.id}" type="button">Delete</button>`:""}</div>`).join("");
  if(!user)h+=`<p class="meta">Log in to review items you have bought.</p>`;
  else if(l.some(r=>r.user_id===user.id))h+=`<p class="meta">Thanks, you already reviewed this.</p>`;
  else if(!bought.has(String(p.id)))h+=`<p class="meta">Only customers who received this item can review it.</p>`;
  else h+=`<div class="rev"><b>Rate this product</b><div class="starpick" id="starPick" data-val="0">${[1,2,3,4,5].map(n=>`<button type="button" data-star="${n}" aria-label="${n} star${n>1?"s":""}">☆</button>`).join("")}</div>
   <textarea id="revBody" rows="3" maxlength="500" placeholder="How were the fit and quality?" style="width:100%"></textarea>
   <button class="btn" data-submit="${p.id}" type="button" style="margin-top:6px">Post review</button><p class="meta" id="revMsg" aria-live="polite"></p></div>`;
  return h}

const prevShow=window.showDet;
window.showDet=function(id){
  prevShow(id);
  try{
    const p=products.find(x=>x.id==id);if(!p)return;
    const body=$$("detBody"),rt=ratingOf(p.id);
    body.querySelector(".sizes")?.insertAdjacentHTML("afterend",`<button class="btn ghost yfsz" data-size="${isShoe(p)?"sh":"cl"}" type="button">📏 Size guide &amp; help</button>`);
    if(rt)body.querySelector("h2")?.insertAdjacentHTML("afterend",`<div class="stars">${stars(rt.avg)} <span class="meta">${rt.avg.toFixed(1)} (${rt.n})</span></div>`);
    body.insertAdjacentHTML("beforeend",`<div id="yfX">${notifyHtml(p)}${reviewsHtml(p)}</div>`)
  }catch(e){console.error(e)}};

$$("detBody").addEventListener("click",async e=>{
  const t=e.target,x=t.closest("#yfX,.yfsz");if(!x)return;
  e.stopPropagation();   /* keep the page from redrawing the popup while typing a review */
  const sz=t.closest("[data-size]");if(sz){openSize(sz.dataset.size);return}
  const nb=t.closest("[data-notify]");
  if(nb){
    if(!user){$$("detD").close();$$("authD").showModal();return}
    const id=nb.dataset.notify;nb.disabled=true;
    if(nb.dataset.on){const {error}=await db.from("stock_alerts").delete().eq("product_id",id);if(!error){alerts.delete(String(id));notify("Alert removed","We will not message you about this one")}}
    else{const {error}=await db.from("stock_alerts").insert({product_id:+id});
      if(!error||error.code==="23505"){alerts.add(String(id));notify("Alert set","We will tell you the moment it is back")}else alert(error.message)}
    showDet(id);return}
  const st=t.closest("[data-star]");
  if(st){const pk=$$("starPick"),n=+st.dataset.star;pk.dataset.val=n;pk.querySelectorAll("button").forEach((b,i)=>b.textContent=i<n?"★":"☆");return}
  const sb=t.closest("[data-submit]");
  if(sb){
    const pk=$$("starPick"),rating=+pk.dataset.val,msg=$$("revMsg");
    if(!rating){msg.textContent="Tap the stars to rate first.";return}
    sb.disabled=true;msg.textContent="Posting...";
    const {data,error}=await db.from("reviews").insert({product_id:+sb.dataset.submit,rating,body:$$("revBody").value.trim()||null}).select().single();
    if(error){sb.disabled=false;msg.textContent=error.code==="23505"?"You already reviewed this product.":error.message;return}
    reviews.unshift({...data,user_id:user.id});render();showDet(sb.dataset.submit);return}
  const db2=t.closest("[data-delrev]");
  if(db2&&confirm("Delete this review?")){
    const {error}=await db.from("reviews").delete().eq("id",db2.dataset.delrev);
    if(error)return alert(error.message);
    reviews=reviews.filter(r=>String(r.id)!==db2.dataset.delrev);render();if(curDet!=null)showDet(curDet)}});

/* =========================================================
   4. TRACK YOUR ORDER (public)
   ========================================================= */
const STEPS2=["new","confirmed","on the way","delivered"];
const trackD=dlg("trackD",`<h2>Track your order</h2><p class="meta" style="margin-bottom:10px">Enter your order number and the phone number you used.</p>
 <div class="f"><input id="trN" inputmode="numeric" placeholder="Order number, e.g. 1001"><input id="trP" type="tel" placeholder="Phone number" autocomplete="tel">
 <button class="btn" id="trGo" type="button">Track</button></div><div id="trOut" aria-live="polite" style="margin-top:12px"></div>`);
function openTrack(){
  try{const s=JSON.parse(localStorage.getItem("ship")||"{}");if(!$$("trP").value&&s.phone)$$("trP").value=s.phone}catch(e){}
  trackD.showModal()}
$$("trGo").onclick=async()=>{
  const out=$$("trOut"),n=parseInt($$("trN").value,10);
  if(!n){out.innerHTML='<p class="meta">Enter your order number.</p>';return}
  if(!HAS_DB){out.innerHTML='<p class="meta">Tracking is not available right now.</p>';return}
  out.innerHTML='<p class="meta">Looking...</p>';
  const {data,error}=await db.rpc("track_order",{p_order:n>=1000?n-1000:n,p_phone:$$("trP").value});
  if(error){out.innerHTML=`<p class="meta" style="color:#d6125f;font-weight:800">${esc(error.message)}</p>`;return}
  const at=STEPS2.indexOf(data.status);
  out.innerHTML=`<div class="ord"><strong>Order #${1000+data.id} · ${money(data.total)}</strong>
   <span class="meta">Placed ${new Date(data.created_at).toLocaleString()}</span>
   ${data.status==="cancelled"?'<span class="canc">Order cancelled</span>':`<div class="trk" aria-label="Order progress">${STEPS2.map((s,i)=>`<i class="${i<=at?"on":""} ${i===at?"now":""}">${s==="new"?"Placed":s}</i>`).join("")}</div>`}
   <span class="meta">${(data.items||[]).map(i=>esc(i.name)+(i.size?" ("+esc(i.size)+")":"")+" x"+(i.qty||1)).join(", ")}</span>
   <span class="meta">${data.payment_method==="delivery"?"Pay on delivery":"Card payment"} · ${esc(data.payment_status||"")}</span></div>`};

/* =========================================================
   6. HELP & FAQ + footer links
   ========================================================= */
const helpD=dlg("helpD","<h2>Help &amp; FAQ</h2><div id=\"helpBody\"></div>");
function openHelp(){
  const area=hasArea()?`We deliver within ${S.radius_km} km of our shop. Share your location at checkout and we will check it for you.`:"Share your location at checkout so our rider can find you. Add a phone number we can call or WhatsApp.";
  const wa=S.whatsapp?`<p><a href="https://wa.me/${gh(S.whatsapp)}" target="_blank" rel="noopener" class="btn" style="display:block;text-align:center;text-decoration:none">Chat with us on WhatsApp</a></p>`:"";
  $$("helpBody").innerHTML=`
   <details class="faq" open><summary>How do I order?</summary><p>Pick your size, tap Add to cart, then Checkout. Log in, add your phone number and confirm your location pin, then place the order.</p></details>
   <details class="faq"><summary>Where do you deliver?</summary><p>${esc(area)}</p></details>
   <details class="faq"><summary>How can I pay?</summary><p>Pay on delivery, or online by card at checkout.</p></details>
   <details class="faq"><summary>How do I follow my order?</summary><p>Open your account to see every order and its progress, or use <a href="#" data-open="track">Track my order</a> with your order number and phone.</p></details>
   <details class="faq"><summary>How do I choose my size?</summary><p>Use the <a href="#" data-open="size">size guide</a> and the Find my size helper.</p></details>
   <details class="faq"><summary>An item is sold out</summary><p>Open the product and tap Notify me. We will alert you as soon as it is back.</p></details>
   <details class="faq"><summary>How do you use my information?</summary><p>We keep your name, email, phone number, delivery address and the location pin you share only to process, deliver and talk to you about your order. We do not sell your information.</p></details>
   <details class="faq"><summary>Can I chat with you about an order?</summary><p>Yes. Open the order in your account and tap Messages.</p></details>${wa}`;
  helpD.showModal()}

(function footerLinks(){
  const col=document.querySelectorAll(".foot > div")[2];if(!col)return;
  col.insertAdjacentHTML("beforeend",`<a href="#" data-open="track">Track my order</a><a href="#" data-open="size">Size guide</a><a href="#" data-open="help">Help &amp; FAQ</a><span id="areaLine" style="display:block;margin-top:6px"></span>`)})();
document.addEventListener("click",e=>{
  const o=e.target.closest("[data-open]");if(!o)return;e.preventDefault();
  document.querySelectorAll("dialog[open]").forEach(d=>{if(d.id==="helpD")d.close()});
  ({track:openTrack,size:()=>openSize("cl"),help:openHelp})[o.dataset.open]?.()});

/* =========================================================
   ADMIN: Delivery area button, distances, shop circle on the map
   ========================================================= */
const prevPanel=window.openPanel;
window.openPanel=async function(){
  await prevPanel();
  try{
    let ab=$$("areaBtn");
    if(isAdmin()){
      if(!ab){ab=document.createElement("button");ab.id="areaBtn";ab.type="button";ab.className="btn alt";ab.textContent="Delivery area";ab.onclick=openArea;$$("logout").before(ab)}
      ab.hidden=false;
      if(hasArea())document.querySelectorAll("#pList .ord").forEach(el=>{
        const cb=el.querySelector("[data-chat]");const o=cb&&lastOrders.find(x=>String(x.id)===cb.dataset.chat);const d=o&&shopDist(o);
        if(d!=null)el.querySelector("strong")?.insertAdjacentHTML("afterend",`<span class="meta">📏 ${d.toFixed(1)} km from shop</span>`)})
    }else{
      if(ab)ab.hidden=true;
      const old=$$("notifBox");if(old)old.remove();
      if(notifs.length){
        $$("pList").insertAdjacentHTML("afterbegin",`<div class="ord" id="notifBox"><strong>🔔 Alerts</strong>${notifs.slice(0,5).map(n=>`<span>${esc(n.body||n.title)}</span>`).join("")}</div>`);
        const ids=notifs.map(n=>n.id);notifs=[];
        if(HAS_DB)db.from("notifications").update({read:true}).in("id",ids).then(()=>{},()=>{})}}
  }catch(e){console.error(e)}};

const prevPin=window.pinHtml;
if(prevPin)window.pinHtml=function(o){let h=prevPin(o);const d=shopDist(o);return d!=null?h+`<br>📏 ${d.toFixed(1)} km from shop`:h};

const prevMap=window.renderMap;
window.renderMap=async function(fit){
  await prevMap(fit);
  try{
    if(hasArea()&&typeof L!=="undefined"&&mapLayer){
      L.circle([S.shop_lat,S.shop_lng],{radius:S.radius_km*1000,color:"#c6ff3d",weight:2,dashArray:"8 6",fillOpacity:.04,interactive:false}).addTo(mapLayer);
      L.circleMarker([S.shop_lat,S.shop_lng],{radius:9,color:"#0a0a0a",weight:3,fillColor:"#c6ff3d",fillOpacity:1}).bindTooltip("Our shop").addTo(mapLayer);
      $$("mapNote").insertAdjacentHTML("beforeend"," Green circle = delivery area ("+S.radius_km+" km).")}
  }catch(e){}};

/* ---------- start ---------- */
loadSettings();loadReviews();
if(typeof user!=="undefined"&&user)onAuth();
})();
