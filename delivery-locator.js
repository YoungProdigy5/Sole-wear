/* YOUNGEST FASHION: delivery-locator.js
   Load LAST, right before </body>:  <script src="delivery-locator.js"></script>
   1) Checkout: if the customer did not share GPS, the typed address is turned into a map pin automatically.
   2) Admin map: every pin shows the customer's phone, Call and WhatsApp buttons, Navigate and Show route.
   3) Admin map: orders with no pin yet are listed below the map with "Find on map" and "Ask for location". */

const TAG="[Location estimated from address] ";
const DIAL=["233","234","254","256","255","225","221","27","44","1"],CC={233:"gh",234:"ng",254:"ke",256:"ug",255:"tz",225:"ci",221:"sn",27:"za",44:"gb",1:"us"};
function countryOf(phone){const p=String(phone||"").trim();if(!p.startsWith("+"))return "gh";const d=p.replace(/\D/g,"");const k=DIAL.find(x=>d.startsWith(x));return k?CC[k]:""}
function geoBox(z){const r=+z.radius_km||30,dLat=r/111,dLon=r/(111*Math.cos(+z.lat*Math.PI/180));return "&viewbox="+(+z.lng-dLon)+","+(+z.lat+dLat)+","+(+z.lng+dLon)+","+(+z.lat-dLat)+"&bounded=1"}
/* zone (optional) keeps the search inside one city, so "Atta Mills" in Accra never lands in Kumasi */
async function geocode(addr,phone,zone){
  const cc=countryOf(phone),base="https://nominatim.openstreetmap.org/search?format=json&limit=1&q="+encodeURIComponent(addr+(zone&&zone.name?", "+zone.name:"")+", Ghana")+(zone?geoBox(zone):"");
  for(const url of cc?[base+"&countrycodes="+cc]:[base]){
    try{const r=await(await fetch(url,{headers:{Accept:"application/json"}})).json();
      if(r&&r[0])return{lat:+r[0].lat,lng:+r[0].lon,name:r[0].display_name}}catch(e){}}
  return null}
const hv=(a,b,c,e)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(e-b)/2)**2;return 2*6371*Math.asin(Math.sqrt(Math.min(1,h)))};

/* ---------- 1. CHECKOUT ---------- */
let apx=null;
const _place=placeOrder;
$("oGo").onclick=()=>_place();   /* checkout no longer guesses a pin from the typed address */
$("ordD").addEventListener("close",()=>{pos=null;apx=null;$("oLocMsg").textContent="Location not shared yet."});

/* ---------- 2. ADMIN MAP: phone on every pin ---------- */
document.head.insertAdjacentHTML("beforeend",`<style>
#noLoc{margin-top:12px;display:flex;flex-direction:column;gap:8px}
#noLoc h3{font-size:.95rem}
.nl{border:1px solid var(--line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:6px;background:var(--bg)}
.nl .r{display:flex;gap:6px;flex-wrap:wrap}
.nl .btn{padding:8px 12px;font-size:.85rem;text-decoration:none;text-align:center}
</style>`);
const waNum=p=>{let x=String(p||"").replace(/\D/g,"");if(x.length===10&&x[0]==="0")x="233"+x.slice(1);return x};
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
  const zs=(window.YF&&window.YF.zones())||[],txt=String(o.address||"").toLowerCase(),zone=zs.find(z=>z.name&&txt.includes(String(z.name).toLowerCase()))||null;
  const g=await geocode(o.address,o.phone,zone);
  if(!g){e.target.disabled=false;e.target.textContent="Find on map";$("mapNote").textContent="Could not find that address"+(zone?" in "+zone.name:"")+". Tap Ask for location to get a pin from the customer.";return}
  const inZ=zs.filter(z=>hv(+z.lat,+z.lng,g.lat,g.lng)<=+z.radius_km).map(z=>z.name);
  if(!confirm("Found: "+String(g.name).split(",").slice(0,5).join(",")+"\n"+(zs.length?(inZ.length?"This is inside "+inZ.join(" / ")+".":"This is OUTSIDE your delivery zones."):"")+"\n\nIt is only a guess from the address. Use it as the pin?")){e.target.disabled=false;e.target.textContent="Find on map";return}
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
