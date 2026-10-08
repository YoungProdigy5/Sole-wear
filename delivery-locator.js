/* YOUNGEST FASHION: delivery-locator.js
   Load LAST, right before </body>:  <script src="delivery-locator.js"></script>
   1) Checkout: if the customer did not share GPS, the typed address is turned into a map pin automatically.
   2) Admin map: every pin shows the customer's phone, Call and WhatsApp buttons, Navigate and Show route.
   3) Admin map: orders with no pin yet are listed below the map with "Find on map" and "Ask for location". */

const TAG="[Location estimated from address] ";
const DIAL=["233","234","254","256","255","225","221","27","44","1"],CC={233:"gh",234:"ng",254:"ke",256:"ug",255:"tz",225:"ci",221:"sn",27:"za",44:"gb",1:"us"};
function countryOf(phone){const p=String(phone||"").trim();if(!p.startsWith("+"))return "";const d=p.replace(/\D/g,"");const k=DIAL.find(x=>d.startsWith(x));return k?CC[k]:""}
async function geocode(addr,phone){
  const cc=countryOf(phone),base="https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(addr);
  for(const url of cc?[base+"&countrycodes="+cc,base]:[base]){
    try{const r=await(await fetch(url,{headers:{Accept:"application/json"}})).json();
      if(r&&r[0])return{lat:+r[0].lat,lng:+r[0].lon,name:r[0].display_name}}catch(e){}}
  return null}

/* ---------- 1. CHECKOUT ---------- */
let apx=null;
$("oLoc").textContent="📍 Share my location (so we can find you)";
const _place=placeOrder;
$("oGo").onclick=async()=>{
  const addr=$("oAddr").value.trim();
  if(!pos&&addr){
    $("oGo").disabled=true;$("oLocMsg").textContent="Finding your address on the map...";
    const g=await geocode(addr,$("oPhone").value);
    $("oGo").disabled=false;
    if(g){pos=apx={lat:g.lat,lng:g.lng};$("oLocMsg").textContent="Pinned from your address (approximate). Tap Share my location for an exact pin."}
    else $("oLocMsg").textContent="Could not find that address on the map. We will contact you for your location."}
  const old=$("oNote").value;
  if(pos&&pos===apx)$("oNote").value=TAG+old;
  const run=_place();
  $("oNote").value=old;
  return run};
$("ordD").addEventListener("close",()=>{pos=null;apx=null;$("oLocMsg").textContent="Location not shared yet."});

/* ---------- 2. ADMIN MAP: phone on every pin ---------- */
document.head.insertAdjacentHTML("beforeend",`<style>
#noLoc{margin-top:12px;display:flex;flex-direction:column;gap:8px}
#noLoc h3{font-size:.95rem}
.nl{border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px;background:var(--bg)}
.nl .r{display:flex;gap:6px;flex-wrap:wrap}
.nl .btn{padding:8px 12px;font-size:.85rem;text-decoration:none;text-align:center}
</style>`);
const waNum=p=>String(p||"").replace(/\D/g,"");
const isApprox=o=>String(o.note||"").startsWith(TAG);
function pinHtml(o){
  const la=Number(o.lat),ln=Number(o.lng),ph=o.phone||"";
  return `<b>Order #${1000+o.id}</b><br>${money(o.total)} · ${esc(o.status)}${isApprox(o)?" · <i>approx. pin</i>":""}<br>${esc(o.address||"")}<br>`
   +(ph?`📞 <a href="tel:${esc(ph)}">${esc(ph)}</a> · <a href="https://wa.me/${waNum(ph)}" target="_blank" rel="noopener">WhatsApp</a><br>`:"")
   +`<a href="https://www.google.com/maps/dir/?api=1&destination=${la},${ln}&travelmode=driving" target="_blank" rel="noopener">Navigate</a> · <a href="#" data-route="${la},${ln}">Show route</a>`}
function decoratePins(){for(const [id,m] of mk){const o=lastOrders.find(x=>x.id===id);if(o)m.setPopupContent(pinHtml(o))}}

/* ---------- 3. ADMIN MAP: orders with no pin ---------- */
function drawNoLoc(){
  let box=$("noLoc");
  if(!box){box=document.createElement("div");box.id="noLoc";$("mapNote").after(box)}
  const list=lastOrders.filter(o=>(o.lat==null||o.lng==null)&&!["cancelled","delivered"].includes(o.status));
  box.innerHTML=list.length?`<h3>Not on the map yet (${list.length})</h3>`+list.map(o=>{
    const msg=encodeURIComponent(`Hi, this is Youngest Fashion about your order #${1000+o.id}. Please send us your location (WhatsApp > attach > Location) so our rider can find you.`);
    return `<div class="nl"><strong>Order #${1000+o.id} · ${esc(o.status)}</strong><span class="meta">${esc(o.address||"No address")}</span>
     <div class="r">${o.address?`<button class="btn" data-geo="${o.id}">Find on map</button>`:""}
     ${o.phone?`<a class="btn alt" href="https://wa.me/${waNum(o.phone)}?text=${msg}" target="_blank" rel="noopener">Ask for location</a><a class="btn ghost" href="tel:${esc(o.phone)}">Call ${esc(o.phone)}</a>`:""}</div></div>`}).join(""):""}
$("omapw").addEventListener("click",async e=>{
  const id=e.target.dataset.geo;if(!id)return;
  const o=lastOrders.find(x=>String(x.id)===id);if(!o)return;
  e.target.disabled=true;e.target.textContent="Searching...";
  const g=await geocode(o.address,o.phone);
  if(!g){e.target.disabled=false;e.target.textContent="Find on map";$("mapNote").textContent="Could not find that address. Tap Ask for location to get a pin from the customer.";return}
  const note=TAG+String(o.note||"");
  const {error}=await db.from("orders").update({lat:g.lat,lng:g.lng,note}).eq("id",o.id);
  if(error){e.target.disabled=false;e.target.textContent="Find on map";return alert(error.message)}
  Object.assign(o,{lat:g.lat,lng:g.lng,note});
  await renderMap(false);lmap.setView([g.lat,g.lng],15)});

/* wrap the live map so the extras redraw every time it does */
const _rm=renderMap;
renderMap=async function(fit){await _rm(fit);decoratePins();drawNoLoc()};

/* customers should not see the internal "estimated" tag in My orders */
const _op=openPanel;
openPanel=async function(){
  await _op();
  if(isAdmin())return;
  document.querySelectorAll("#pList span").forEach(s=>{if(s.textContent.includes(TAG)){const t=s.textContent.replace(TAG,"").replace(/^Comment:\s*$/,"");if(t.trim())s.textContent=t;else s.remove()}})};
