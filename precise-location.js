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
let loc=null,map=null,circle=null,watchId=null,stopT=null,prog=false,armed=false,osm=null,sat=null,onSat=false;
const fmt=n=>Math.round(Number(n)||0);
const lab=a=>a<=30?"excellent":a<=100?"good":"weak";
const nav=o=>`https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}&travelmode=driving`;
/* Android's "approximate location" snaps coordinates to a ~1 km grid and reports ~2000 m accuracy: recognise it, even on old orders */
const gridSnap=(la,ln)=>{la=+la;ln=+ln;const a=la*111,b=ln*111*Math.cos(la*Math.PI/180);return Math.abs(a-Math.round(a))<0.003&&Math.abs(b-Math.round(b))<0.003};
const isApprox=o=>o.lat!=null&&o.lng!=null&&o.loc_source!=="pin"&&((o.lat_accuracy!=null&&Number(o.lat_accuracy)>=500)||gridSnap(o.lat,o.lng));
const isEst=o=>o.loc_source==="address"||isApprox(o)||(!o.loc_source&&String(o.note||"").startsWith("[Location estimated"));

/* ---------- styles ---------- */
document.head.insertAdjacentHTML("beforeend",`<style>
#pickBox{display:flex;flex-direction:column;gap:6px}
#pickMap{height:230px;border-radius:10px;border:2px solid var(--ink);background:var(--card)}
#locStat{font-weight:700;opacity:1}
#locStat[data-k=gps]{color:var(--ink)}
#locStat[data-k=address]{color:#d6125f}
.yfpin i{display:block;width:24px;height:24px;margin:3px;background:#c6ff3d;border:3px solid #0a0a0a;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:3px 3px 0 #ff2e88}
</style>`);

/* ---------- checkout: Uber-style pin picker. The pin stays in the middle; the customer moves the MAP under it ---------- */
document.head.insertAdjacentHTML("beforeend",`<style>
#pickWrap{position:relative}
#pickPin{position:absolute;left:50%;top:50%;width:34px;height:44px;margin:-34px 0 0 -17px;z-index:1001;pointer-events:none}
#pickPin i{position:absolute;left:3px;top:0;width:28px;height:28px;background:#c6ff3d;border:3px solid #0a0a0a;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:3px 3px 0 #ff2e88}
#pickPin b{position:absolute;left:12px;top:9px;width:10px;height:10px;border-radius:50%;background:#0a0a0a}
#pickPin u{position:absolute;left:14px;top:31px;width:6px;height:6px;border-radius:50%;background:rgba(0,0,0,.45)}
.pickbtn{position:absolute;z-index:1002;right:8px;width:44px;height:44px;border-radius:8px;border:2px solid #0a0a0a;background:#fff;color:#0a0a0a;font-size:1.3rem;cursor:pointer;display:grid;place-items:center;padding:0}
.pickbtn[aria-pressed=true]{background:#c6ff3d}
#myLoc{bottom:30px}#satBtn{top:8px}
#locStat[data-k=warn]{color:#d6125f}
#locPlace{font-weight:700;opacity:1}
#approxHelp{border:2px solid #d6125f;border-radius:10px;padding:10px}
#approxHelp ul{margin:6px 0}
#approxHelp li{margin:6px 0 6px 18px;font-size:.9rem}
#waLoc{text-align:center;text-decoration:none}
#locOk{animation:okpulse 1.4s ease-in-out infinite}
@keyframes okpulse{50%{box-shadow:0 0 0 6px rgba(198,255,61,.55)}}
@media (prefers-reduced-motion:reduce){#locOk{animation:none}}
#findBox summary{cursor:pointer;font-weight:800}
#findList button{text-align:left;text-transform:none;margin-top:6px;font-weight:600}
</style>`);
const box=document.createElement("div");box.id="pickBox";
box.innerHTML=`<p class="meta" id="locStat">Getting your exact location...</p>
 <p class="meta" id="locPlace" hidden></p>
 <div id="approxHelp" hidden role="alert"><b>📵 Your phone is sharing only an approximate area</b>
  <p class="meta">That is a phone privacy setting, not a fault. To share your exact spot (menus differ a little by phone):</p>
  <ul>
   <li><b>Chrome on Android:</b> tap the lock icon next to the web address, then Permissions, then Location, and choose <b>Precise</b>. If you do not see it: Settings, Apps, Chrome, Permissions, Location, and turn on <b>Use precise location</b>.</li>
   <li><b>iPhone:</b> Settings, Privacy &amp; Security, Location Services, Safari Websites, and turn on <b>Precise Location</b>.</li>
   <li>Opened from TikTok or Instagram? Tap <b>⋯</b> and choose <b>Open in browser</b> first.</li></ul>
  <button type="button" class="btn alt" id="approxRetry">🔄 I changed it, try again</button>
  <p class="meta" style="margin-top:6px">Or move the map so the pin sits on your door, or send your location on WhatsApp below.</p></div>
 <div id="pickWrap"><div id="pickMap" aria-label="Map. Move the map so the pin sits on your door"></div>
  <div id="pickPin" aria-hidden="true"><i></i><b></b><u></u></div>
  <button type="button" class="pickbtn" id="satBtn" aria-label="Switch to satellite view" aria-pressed="false" title="Satellite view">🛰</button>
  <button type="button" class="pickbtn" id="myLoc" aria-label="Use my exact location" title="My location">◎</button></div>
 <button type="button" class="btn" id="locOk" hidden>✔ Yes, the pin is on my door</button>
 <button type="button" class="btn ghost" id="locGo">📍 Use my exact location</button>
 <p class="meta">Move the map so the pin sits exactly on your door. Zoom in, and tap 🛰 for the satellite view to spot your roof. This is where we deliver.</p>
 <a id="waLoc" class="btn ghost" hidden target="_blank" rel="noopener">📲 Send my location on WhatsApp instead</a>
 <details id="findBox"><summary>Cannot use GPS? Search your address</summary>
  <div class="f" style="margin-top:8px"><span id="findCityWrap"></span><input id="findQ" placeholder="Street or area, e.g. East Legon" autocomplete="off"><button type="button" class="btn ghost" id="findGo">Find on the map</button><div id="findList" aria-live="polite"></div></div></details>`;
$$("oLocMsg").after(box);
$$("oLoc").hidden=true;$$("oLocMsg").hidden=true;

const hav=(a,b,c,d)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 2*6371*Math.asin(Math.sqrt(Math.min(1,h)))};
const zones=()=>(window.YF&&window.YF.zones())||[];
function zoneAt(lat,lng){let best=null;zones().forEach(z=>{const d=hav(+z.lat,+z.lng,lat,lng);if(d<=+z.radius_km&&(!best||d<best.d))best={d,name:z.name}});return best?best.name:""}
function mismatch(){
  if(!loc||loc.override)return "";
  const t=($$("oAddr").value+" "+$$("findQ").value).toLowerCase();
  const named=zones().filter(z=>z.name&&t.includes(String(z.name).toLowerCase())).map(z=>z.name);
  if(!named.length)return "";
  return named.includes(zoneAt(loc.lat,loc.lng))?"":named.join(" / ")}

function updateWa(){
  const a=$$("waLoc"),n=window.YF&&window.YF.whatsapp&&window.YF.whatsapp();
  if(!n){a.hidden=true;return}
  const ph=$$("oPhone").value.trim();
  a.href="https://wa.me/"+n+"?text="+encodeURIComponent("Hi Youngest Fashion, I am placing an order"+(ph?" (my phone: "+ph+")":"")+". I am sending my exact location now.");
  a.hidden=false}

function status(){
  const s=$$("locStat");if(!loc||!s)return;
  let t;
  if(loc.approx)t="⚠ Your phone shared only an APPROXIMATE area (±"+loc.acc+" m). Move the map so the pin sits exactly on your door.";
  else if(loc.src==="gps")t="📡 GPS found you, accuracy ±"+loc.acc+" m ("+lab(loc.acc)+")."+(loc.acc>100?" Check the pin and place name, then confirm.":"");
  else if(loc.src==="pin")t="📌 Pin set. We will deliver to this exact spot.";
  else t="⚠ This pin comes from a search. Check the place name, move the map so the pin is on your door, then confirm.";
  const z=zoneAt(loc.lat,loc.lng);if(z&&loc.src!=="pin"&&!loc.approx)t+=" (In "+z+")";
  const mm=mismatch();
  if(mm){t="⚠ You wrote "+mm+" but the pin is "+(z?"in "+z:"outside our delivery zones")+". Move the map or fix your address, then confirm.";loc.confirmed=false}
  s.dataset.k=(!loc.approx&&!mm&&(loc.src==="pin"||(loc.src==="gps"&&loc.acc<=100)))?"gps":"warn";
  s.textContent=t;
  $$("locOk").hidden=!!loc.confirmed||!!loc.approx;
  $$("approxHelp").hidden=!loc.approx;
  updateWa()}

/* the place name under the pin: lets the customer (and you) catch "Accra vs Kumasi" mistakes at a glance */
const rcache=new Map();let rT=null;
async function reverse(lat,lng){
  try{
    const ctl=new AbortController(),tm=setTimeout(()=>ctl.abort(),8000);
    const r=await fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&addressdetails=1&lat="+lat+"&lon="+lng,{headers:{Accept:"application/json"},signal:ctl.signal});
    clearTimeout(tm);
    const j=await r.json(),a=j.address||{};
    const parts=[a.road||a.pedestrian||a.footway,a.neighbourhood||a.suburb||a.quarter||a.residential,a.city||a.town||a.village||a.municipality||a.county,a.state].filter(Boolean);
    return [...new Set(parts)].slice(0,3).join(", ")||String(j.display_name||"").split(",").slice(0,3).join(",").trim()
  }catch(e){return ""}}
function showPlace(){const e=$$("locPlace");if(!e)return;e.hidden=!(loc&&loc.place);if(loc&&loc.place)e.textContent="📍 The pin is near: "+loc.place}
function schedulePlace(){
  clearTimeout(rT);if(!loc)return;const my=loc;
  rT=setTimeout(async()=>{
    const k=my.lat.toFixed(4)+","+my.lng.toFixed(4);let p=rcache.get(k);
    if(p===undefined){p=await reverse(my.lat,my.lng);rcache.set(k,p)}
    if(loc&&loc.lat===my.lat&&loc.lng===my.lng){loc.place=p;showPlace()}},900)}

/* map moves made by the app itself must not be mistaken for the customer moving the pin */
function inMove(fn){prog=true;try{fn()}finally{prog=false}}
function centerOn(lat,lng,z){if(map)inMove(()=>map.setView([lat,lng],z,{animate:false}))}
const zoomFor=(src,acc)=>src==="gps"?(acc>=500?15:acc>100?16:18):17;

function setLoc(lat,lng,acc,src,fit,fromMap){
  const approx=src==="gps"&&acc!=null&&acc>=500;
  loc={lat,lng,acc:acc==null?null:fmt(acc),src,approx,confirmed:src==="pin"||(src==="gps"&&acc!=null&&acc<=100),override:false,place:""};
  pos={lat,lng};
  if(map){
    if(circle){map.removeLayer(circle);circle=null}
    if(!fromMap){
      if(src==="gps"&&acc&&acc>10&&acc<5000)circle=L.circle([lat,lng],{radius:acc,color:"#c6ff3d",weight:2,fillOpacity:.15}).addTo(map);
      if(fit!==false)centerOn(lat,lng,zoomFor(src,acc))}}
  armed=true;
  status();showPlace();schedulePlace()}

async function ensureMap(){
  try{await loadLeaflet()}catch(e){$$("locStat").textContent="The map could not load, but we will still use your GPS.";return false}
  if(!map){
    map=L.map("pickMap");
    inMove(()=>map.setView([20,0],2,{animate:false}));
    osm=L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap"}).addTo(map);
    sat=L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",{maxZoom:19,maxNativeZoom:18,attribution:"Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"});
    map.on("dragstart",()=>{armed=true;stop()});
    map.on("click",e=>{armed=true;stop();map.panTo(e.latlng)});
    map.on("moveend",()=>{
      if(prog||!armed)return;
      const c=map.getCenter();
      if(loc&&hav(c.lat,c.lng,loc.lat,loc.lng)<0.002)return;   /* the centre did not really move (for example a screen resize) */
      stop();setLoc(c.lat,c.lng,null,"pin",false,true)})}
  return true}

function stop(){if(watchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(watchId);watchId=null;clearTimeout(stopT)}

function gps(){
  stop();
  if(!navigator.geolocation){$$("locStat").dataset.k="warn";$$("locStat").textContent="This device cannot share GPS. Move the map so the pin sits on your door, or search your address below.";$$("findBox").open=true;return}
  $$("locStat").dataset.k="";$$("locStat").textContent="Getting your exact location... tap Allow when your phone asks, choose Precise if it asks, and stay still for a few seconds.";
  let best=null;
  watchId=navigator.geolocation.watchPosition(p=>{
    const a=p.coords.accuracy;
    if(!best||a<best.a){best={a};setLoc(p.coords.latitude,p.coords.longitude,a,"gps",true)}
    if(a<=20)stop()},
   err=>{stop();if(!loc){$$("locStat").dataset.k="warn";$$("locStat").textContent=(err&&err.code===1?"Location is blocked. Allow it in your browser settings, or ":"We could not get your GPS. ")+"move the map so the pin sits on your door, or search your address below.";$$("findBox").open=true}},
   {enableHighAccuracy:true,maximumAge:0,timeout:25000});
  stopT=setTimeout(stop,25000)}

function retry(){loc=null;pos=null;armed=false;$$("locOk").hidden=true;$$("approxHelp").hidden=true;gps()}
$$("locGo").onclick=retry;$$("myLoc").onclick=retry;$$("approxRetry").onclick=retry;
$$("satBtn").onclick=()=>{
  if(!map)return;
  onSat=!onSat;
  if(onSat){map.removeLayer(osm);sat.addTo(map)}else{map.removeLayer(sat);osm.addTo(map)}
  $$("satBtn").setAttribute("aria-pressed",String(onSat))};
$$("locOk").onclick=()=>{if(!loc)return;loc.confirmed=true;loc.override=true;status();$$("locOk").hidden=true};
$$("oAddr").addEventListener("input",()=>{if(loc)status()});
$$("oPhone").addEventListener("input",updateWa);

/* address search: stays inside the chosen city, shows the matches, and the customer picks the right one */
let found=[];
function bbox(z){const r=+z.radius_km||30,dLat=r/111,dLon=r/(111*Math.cos(+z.lat*Math.PI/180));return "&viewbox="+(+z.lng-dLon)+","+(+z.lat+dLat)+","+(+z.lng+dLon)+","+(+z.lat-dLat)}
function buildCity(){
  const zs=zones();
  $$("findCityWrap").innerHTML=zs.length?`<select id="findCity" aria-label="City or area">${zs.map(z=>`<option value="${esc(z.name)}">${esc(z.name)}</option>`).join("")}<option value="">Other town</option></select>`:`<input id="findCity" placeholder="Town or city, e.g. Accra" autocomplete="off" aria-label="Town or city">`}
$$("findBox").addEventListener("toggle",()=>{if($$("findBox").open&&!$$("findCity"))buildCity()});
async function find(){
  const list=$$("findList"),q=$$("findQ").value.trim();
  if(!q){list.innerHTML='<p class="meta">Type your street or area first.</p>';return}
  if(!$$("findCity"))buildCity();
  const city=($$("findCity").value||"").trim(),z=zones().find(x=>x.name===city);
  list.innerHTML='<p class="meta">Searching...</p>';
  const url="https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=gh&q="+encodeURIComponent(q+(city?", "+city:"")+", Ghana")+(z?bbox(z)+"&bounded=1":"");
  let res=[];
  try{res=await(await fetch(url,{headers:{Accept:"application/json"}})).json()}
  catch(e){list.innerHTML='<p class="meta">Search is not available right now. Move the map so the pin sits on your door.</p>';return}
  found=(Array.isArray(res)?res:[]).slice(0,6).map(r=>({lat:+r.lat,lng:+r.lon,name:String(r.display_name||"")}));
  list.innerHTML=found.length?'<p class="meta">Tap the right place:</p>'+found.map((r,i)=>`<button type="button" class="btn ghost" data-pick="${i}">${esc(r.name.split(",").slice(0,4).join(","))}</button>`).join(""):`<p class="meta">Nothing found${city?" in "+esc(city):""}. Try just the area name, or move the map so the pin sits on your door.</p>`}
$$("findGo").onclick=find;
$$("findQ").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();find()}});
$$("findList").addEventListener("click",e=>{
  const b=e.target.closest("[data-pick]");if(!b)return;const r=found[+b.dataset.pick];if(!r)return;
  stop();setLoc(r.lat,r.lng,null,"address",true);$$("findList").innerHTML="";$$("findBox").open=false});

async function onOpen(){
  try{const s=JSON.parse(localStorage.getItem(SAVE)||"null");if(s){if(!$$("oPhone").value)$$("oPhone").value=s.phone||"";if(!$$("oAddr").value)$$("oAddr").value=s.addr||""}}catch(e){}
  updateWa();
  if(await ensureMap())setTimeout(()=>inMove(()=>map.invalidateSize({pan:false})),200);
  if(!loc)gps()}
new MutationObserver(()=>{if($$("ordD").open)onOpen()}).observe($$("ordD"),{attributes:true,attributeFilter:["open"]});
$$("ordD").addEventListener("close",()=>{
  stop();loc=null;pos=null;armed=false;
  if(map){if(circle){map.removeLayer(circle);circle=null}centerOn(20,0,2)}
  $$("locStat").textContent="Getting your exact location...";$$("locStat").dataset.k="";$$("locPlace").hidden=true;$$("locOk").hidden=true;$$("approxHelp").hidden=true;$$("findList").innerHTML="";$$("findBox").open=false});

/* an unconfirmed, approximate or missing pin never goes through by accident */
$$("oGo").addEventListener("click",e=>{
  if(!loc){
    if(!confirm("You have not shared a location, so delivery may be slow and we may need to call you to find you. Place the order anyway?")){e.stopImmediatePropagation();e.preventDefault()}
    else pos=null;
    return}
  if(!loc.confirmed){
    e.stopImmediatePropagation();e.preventDefault();
    try{$$("pickWrap").scrollIntoView({block:"center"})}catch(x){}
    alert(loc.approx?"Your phone only shared an approximate area. Move the map until the pin sits exactly on your door (zoom in, or tap the satellite button). You can also send your location on WhatsApp.":"Please check the pin on the map and tap \"Yes, the pin is on my door\" first. A correct pin means your order arrives faster.")}},true);

/* save accuracy + source + the place name on the order right after it is placed */
if(typeof db!=="undefined"&&db){
  const raw=db.rpc.bind(db);
  db.rpc=function(name,args,opts){
    const snap=loc?{...loc}:null;
    if(name==="place_order"&&snap&&snap.place)args={...args,p_note:"Pin near: "+snap.place+(args.p_note?" | "+args.p_note:"")};
    const p=raw(name,args,opts);
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
  if(isApprox(o))return "⚠ APPROXIMATE: the phone shared only a rough area"+(o.lat_accuracy!=null?" (±"+fmt(o.lat_accuracy)+" m)":"")+". Ask the customer to resend.";
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
