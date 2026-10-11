/* YOUNGEST FASHION: precise-location.js
   Load LAST (after delivery-locator.js):  <script src="precise-location.js"></script>

   CUSTOMER
   - Checkout asks the phone for its most accurate GPS reading (best of ~14 seconds) and shows it on a map.
   - The customer can drag the pin or tap the map to put it exactly on their door.
   - If GPS is blocked, the typed address becomes a pin they can drag into place.
   - In "My orders", an "Update my location" button re-sends a fresh GPS fix while the order is open.
   ADMIN
   - Every order shows how its pin was made (GPS +/- metres, pin set by customer, or estimated from address).
   - Map pins get an accuracy circle; approximate pins are dashed. Navigate and Copy coordinates everywhere. */
(function(){
"use strict";
const $$=id=>document.getElementById(id);
if(!$$("ordD")||!$$("oLoc"))return;
const SAVE="yf_last";
let loc=null,map=null,marker=null,circle=null,watchId=null,stopT=null;
const fmt=n=>Math.round(Number(n)||0);
const lab=a=>a<=30?"excellent":a<=100?"good":"weak";
const nav=o=>`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}&travelmode=driving`;
const isEst=o=>o.loc_source==="address"||(!o.loc_source&&String(o.note||"").startsWith("[Location estimated"));

/* ---------- styles ---------- */
document.head.insertAdjacentHTML("beforeend",`<style>
#pickBox{display:flex;flex-direction:column;gap:6px}
#pickMap{height:230px;border-radius:10px;border:2px solid var(--ink);background:var(--card)}
#locStat{font-weight:700;opacity:1}
#locStat[data-k=gps]{color:var(--ink)}
#locStat[data-k=address]{color:#d6125f}
.yfpin i{display:block;width:24px;height:24px;margin:3px;background:#c6ff3d;border:3px solid #0a0a0a;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:3px 3px 0 #ff2e88}
</style>`);

/* ---------- checkout: location box replaces the old share button ---------- */
const box=document.createElement("div");box.id="pickBox";
box.innerHTML=`<p class="meta" id="locStat">Getting your exact location...</p><div id="pickMap" aria-label="Map: drag the pin onto your door"></div>
 <button type="button" class="btn ghost" id="locGo">📍 Use my exact location</button>
 <p class="meta">Drag the pin or tap the map to put it right on your door. This is where we deliver.</p>`;
$$("oLocMsg").after(box);
$$("oLoc").hidden=true;$$("oLocMsg").hidden=true;

function status(){
  const s=$$("locStat");if(!loc||!s)return;s.dataset.k=loc.src;
  if(loc.src==="gps")s.textContent="📡 GPS found you, accuracy ±"+loc.acc+" m ("+lab(loc.acc)+")."+(loc.acc>100?" Weak signal: step outside, or drag the pin onto your door.":"");
  else if(loc.src==="pin")s.textContent="📌 Pin set. We will deliver to this exact spot.";
  else s.textContent="⚠ Pin estimated from your address. Drag it onto your exact spot."}

function setLoc(lat,lng,acc,src,fit){
  loc={lat,lng,acc:acc==null?null:fmt(acc),src};
  pos={lat,lng};
  if(map){
    const ll=[lat,lng];
    if(!marker){
      marker=L.marker(ll,{draggable:true,icon:L.divIcon({className:"yfpin",html:"<i></i>",iconSize:[30,30],iconAnchor:[15,30]})}).addTo(map);
      marker.on("dragend",()=>{stop();const p=marker.getLatLng();setLoc(p.lat,p.lng,null,"pin")})
    }else marker.setLatLng(ll);
    if(circle){map.removeLayer(circle);circle=null}
    if(acc&&acc>10&&acc<5000)circle=L.circle(ll,{radius:acc,color:"#c6ff3d",weight:2,fillOpacity:.15}).addTo(map);
    if(fit)map.setView(ll,acc&&acc>200?15:17)}
  status()}

async function ensureMap(){
  try{await loadLeaflet()}catch(e){$$("locStat").textContent="The map could not load, but we will still use your GPS.";return false}
  if(!map){
    map=L.map("pickMap",{zoomControl:true}).setView([20,0],2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(map);
    map.on("click",e=>{stop();setLoc(e.latlng.lat,e.latlng.lng,null,"pin")})}
  return true}

function stop(){if(watchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(watchId);watchId=null;clearTimeout(stopT)}

async function fromAddress(){
  const a=$$("oAddr").value.trim();if(!a||(loc&&loc.src!=="address"))return;
  const g=await geocode(a,$$("oPhone").value);
  if(g&&(!loc||loc.src==="address")){setLoc(g.lat,g.lng,null,"address",true)}
  else if(!g&&!loc)$$("locStat").textContent="Tap the map to drop your pin on your door."}

function gps(){
  stop();
  if(!navigator.geolocation){$$("locStat").textContent="This device cannot share GPS. Tap the map to drop your pin.";fromAddress();return}
  $$("locStat").dataset.k="";$$("locStat").textContent="Getting your exact location... tap Allow when your phone asks.";
  let best=null;
  watchId=navigator.geolocation.watchPosition(p=>{
    const a=p.coords.accuracy;
    if(!best||a<best.a){best={a};setLoc(p.coords.latitude,p.coords.longitude,a,"gps",true)}
    if(a<=20)stop()},
   err=>{stop();if(!loc){$$("locStat").textContent=(err&&err.code===1?"Location is blocked. Allow it in your browser settings, or ":"We could not get your GPS. ")+"drop the pin on the map.";fromAddress()}},
   {enableHighAccuracy:true,maximumAge:0,timeout:20000});
  stopT=setTimeout(stop,14000)}

$$("locGo").onclick=()=>{loc=null;gps()};
$$("oAddr").addEventListener("change",fromAddress);

async function onOpen(){
  try{const s=JSON.parse(localStorage.getItem(SAVE)||"null");if(s){if(!$$("oPhone").value)$$("oPhone").value=s.phone||"";if(!$$("oAddr").value)$$("oAddr").value=s.addr||""}}catch(e){}
  if(await ensureMap())setTimeout(()=>map.invalidateSize(),200);
  if(!loc)gps()}
new MutationObserver(()=>{if($$("ordD").open)onOpen()}).observe($$("ordD"),{attributes:true,attributeFilter:["open"]});
$$("ordD").addEventListener("close",()=>{
  stop();loc=null;
  if(map){if(marker){map.removeLayer(marker);marker=null}if(circle){map.removeLayer(circle);circle=null}map.setView([20,0],2)}
  $$("locStat").textContent="Getting your exact location...";$$("locStat").dataset.k=""});

/* ask before ordering with no pin at all */
$$("oGo").addEventListener("click",e=>{
  if(loc)return;
  if(!confirm("You have not shared a location, so delivery may be slow. Place the order anyway?")){e.stopImmediatePropagation();e.preventDefault()}},true);

/* save accuracy + source on the order right after it is placed */
if(typeof db!=="undefined"&&db){
  const raw=db.rpc.bind(db);
  db.rpc=function(name,args,opts){
    const snap=loc?{...loc}:null,p=raw(name,args,opts);
    if(name!=="place_order")return p;
    return Promise.resolve(p).then(async res=>{
      if(!res.error&&res.data){
        if(snap)try{await raw("set_order_location",{p_order:res.data,p_lat:snap.lat,p_lng:snap.lng,p_acc:snap.acc,p_src:snap.src})}catch(e){}
        try{localStorage.setItem(SAVE,JSON.stringify({phone:args.p_phone,addr:args.p_address}))}catch(e){}}
      return res})}}

/* ---------- customer: "Update my location" on open orders ---------- */
function bestFix(ms){
  return new Promise((res,rej)=>{
    if(!navigator.geolocation)return rej(new Error("This device cannot share GPS."));
    let best=null,done=false,id,t;
    const fin=()=>{if(done)return;done=true;navigator.geolocation.clearWatch(id);clearTimeout(t);best?res(best):rej(new Error("Could not get your location. Turn on GPS and allow location."))};
    id=navigator.geolocation.watchPosition(p=>{const a=p.coords.accuracy;if(!best||a<best.a)best={lat:p.coords.latitude,lng:p.coords.longitude,a};if(a<=15)fin()},
      e=>{if(best)return fin();done=true;navigator.geolocation.clearWatch(id);clearTimeout(t);rej(new Error(e.code===1?"Location is blocked. Allow it in your browser settings.":"Could not get your location."))},
      {enableHighAccuracy:true,maximumAge:0,timeout:20000});
    t=setTimeout(fin,ms)})}

$$("pList").addEventListener("click",async e=>{
  const b=e.target.closest("[data-loc]");if(!b)return;
  const t0=b.textContent;b.disabled=true;b.textContent="Locating...";
  try{
    const f=await bestFix(12000);
    const {error}=await db.rpc("set_order_location",{p_order:+b.dataset.loc,p_lat:f.lat,p_lng:f.lng,p_acc:f.a,p_src:"gps"});
    if(error)throw error;
    const o=lastOrders.find(x=>String(x.id)===b.dataset.loc);if(o)Object.assign(o,{lat:f.lat,lng:f.lng,lat_accuracy:f.a,loc_source:"gps"});
    notify("Location updated",f.a>150?"Weak signal (±"+fmt(f.a)+" m). Step outside and try again.":"Accuracy ±"+fmt(f.a)+" m. We can find you now.")
  }catch(err){alert(err.message||"Could not update your location.")}
  b.disabled=false;b.textContent=t0});

/* ---------- admin: how accurate is each pin ---------- */
function srcLabel(o){
  if(o.lat==null||o.lng==null)return "⚠ No location shared";
  if(o.loc_source==="gps")return "📡 GPS"+(o.lat_accuracy!=null?" ±"+fmt(o.lat_accuracy)+" m"+(o.lat_accuracy>100?" (weak)":""):"");
  if(o.loc_source==="pin")return "📌 Pin set by customer";
  if(isEst(o))return "⚠ Estimated from address (approx.)";
  return "📍 Location shared"}

window.pinHtml=function(o){
  const la=Number(o.lat),ln=Number(o.lng),ph=o.phone||"",wa=(x=>x.length===10&&x[0]==="0"?"233"+x.slice(1):x)(String(ph).replace(/\D/g,""));
  return `<b>Order #${1000+o.id}</b><br>${money(o.total)} · ${esc(o.status)}<br>${srcLabel(o)}<br>${esc(o.address||"")}<br>`
   +(ph?`📞 <a href="tel:${esc(ph)}">${esc(ph)}</a> · <a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a><br>`:"")
   +`<a href="${nav(o)}" target="_blank" rel="noopener">Navigate</a> · <a href="#" data-route="${la},${ln}">Show route</a> · <a href="#" data-copy="${la},${ln}">Copy</a>`};

document.addEventListener("click",e=>{
  const c=e.target.closest("[data-copy]");if(!c)return;
  e.preventDefault();const v=c.dataset.copy,t=c.textContent;
  const ok=()=>{c.textContent="Copied";setTimeout(()=>c.textContent=t,1500)};
  try{navigator.clipboard.writeText(v).then(ok,()=>prompt("Copy these coordinates:",v))}catch(x){prompt("Copy these coordinates:",v)}});

function decorateOrders(){
  document.querySelectorAll("#pList .ord").forEach(el=>{
    const cb=el.querySelector("[data-chat]");if(!cb)return;
    const o=lastOrders.find(x=>String(x.id)===cb.dataset.chat);if(!o)return;
    if(isAdmin()){
      el.querySelector("strong")?.insertAdjacentHTML("afterend",`<span class="meta">${srcLabel(o)}${o.lat!=null?` · <a href="${nav(o)}" target="_blank" rel="noopener">Navigate</a> · <a href="#" data-copy="${o.lat},${o.lng}">Copy coordinates</a>`:""}</span>`)
    }else if(["new","confirmed","on the way"].includes(o.status)){
      cb.insertAdjacentHTML("beforebegin",`<button class="btn ghost" data-loc="${o.id}">📍 Update my location</button>`)}})}
const prevPanel=window.openPanel;
window.openPanel=async function(){await prevPanel();decorateOrders()};

function mapExtras(){
  if(typeof L==="undefined"||!mapLayer||typeof mk==="undefined")return;
  lastOrders.forEach(o=>{
    if(o.lat==null||o.lng==null)return;
    const m=mk.get(o.id);
    if(m&&isEst(o))m.setStyle({dashArray:"4 3",fillOpacity:.45});
    const a=Number(o.lat_accuracy);
    if(o.loc_source==="gps"&&a>15&&a<3000)L.circle([o.lat,o.lng],{radius:a,color:SC[o.status]||"#ff2e88",weight:1.5,fillOpacity:.1,interactive:false}).addTo(mapLayer)});
  $$("mapNote").insertAdjacentHTML("beforeend"," Dashed pin = approximate (from address). Shaded circle = GPS accuracy.")}
const prevMap=window.renderMap;
window.renderMap=async function(fit){await prevMap(fit);try{mapExtras()}catch(e){}};
})();
