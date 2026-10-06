/* YOUNGEST FASHION: live-map.js
   Load AFTER the main script, right before </body>:  <script src="live-map.js"></script>
   Adds: 1) customer sign-up through the "signup" edge function (no email, no rate limit)
         2) live order map  3) your live position  4) Navigate + Show route */

/* ---------- 1. SIGN UP ---------- */
$("doSignup").onclick=async()=>{
  const email=$("aMail").value.trim(),password=$("aPass").value,full_name=$("aName").value;
  $("aMsg").textContent="Creating account...";
  const {data:r,error:fe}=await db.functions.invoke("signup",{body:{email,password,full_name}});
  if(fe||!r)return $("aMsg").textContent="Could not create account. Try again.";
  if(r.staff){ // admin emails still get real email confirmation
    const {data,error}=await db.auth.signUp({email,password,options:{data:{full_name}}});
    if(error)return $("aMsg").textContent=error.message;
    if(data.session)return afterAuth(data.session.user);
    return $("aMsg").textContent="Check your email and click the confirmation link, then log in."}
  if(r.error)return $("aMsg").textContent=r.error;
  const s=await db.auth.signInWithPassword({email,password});
  if(s.error)$("aMsg").textContent=s.error.message;else afterAuth(s.data.user)};

/* ---------- 2. LIVE MAP ---------- */
const mk=new Map();let me=null,meWatch=null,routeLine=null;
async function renderMap(fit=true){
  try{await loadLeaflet()}catch(e){$("mapNote").textContent="Could not load the map.";return}
  if(!lmap){
    lmap=L.map("omap").setView([20,0],2);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:"&copy; OpenStreetMap contributors"}).addTo(lmap);
    mapLayer=L.layerGroup().addTo(lmap);
    lmap.on("popupopen",e=>{const a=e.popup.getElement().querySelector("[data-route]");
      if(a)a.onclick=ev=>{ev.preventDefault();drawRoute(a.dataset.route.split(",").map(Number))}})}
  const pts=[],seen=new Set();
  lastOrders.filter(o=>o.lat!=null&&o.lng!=null).forEach(o=>{
    const la=Number(o.lat),ln=Number(o.lng),col=SC[o.status]||"#ff2e88";
    const html=`<b>Order #${1000+o.id}</b><br>${money(o.total)} · ${esc(o.status)}<br>${esc(o.address||"")}<br><a href="https://www.google.com/maps/dir/?api=1&destination=${la},${ln}&travelmode=driving" target="_blank" rel="noopener">Navigate</a> · <a href="#" data-route="${la},${ln}">Show route</a>`;
    pts.push([la,ln]);seen.add(o.id);
    let m=mk.get(o.id);
    if(m){m.setLatLng([la,ln]);m.setStyle({fillColor:col});m.setPopupContent(html)}
    else{m=L.circleMarker([la,ln],{radius:10,color:"#fff",weight:2,fillColor:col,fillOpacity:.95}).addTo(mapLayer).bindPopup(html);mk.set(o.id,m)}});
  for(const [id,m] of mk)if(!seen.has(id)){mapLayer.removeLayer(m);mk.delete(id)}
  setTimeout(()=>{lmap.invalidateSize();if(fit)pts.length?lmap.fitBounds(pts,{padding:[30,30],maxZoom:14}):lmap.setView([20,0],2)},80);
  $("mapNote").innerHTML=`🟢 Live · updated ${new Date().toLocaleTimeString()}<br>${pts.length} order${pts.length===1?"":"s"} pinned. ${lastOrders.length-pts.length} without a shared location. Pink = new, purple = confirmed, orange = on the way, green = delivered.`;
  watchMe()}

/* ---------- 3. YOUR POSITION + ROUTE ---------- */
function watchMe(){
  if(meWatch!=null||!navigator.geolocation)return;
  meWatch=navigator.geolocation.watchPosition(p=>{
    const ll=[p.coords.latitude,p.coords.longitude];
    if(me)me.setLatLng(ll);
    else me=L.circleMarker(ll,{radius:8,color:"#fff",weight:3,fillColor:"#2b7fff",fillOpacity:1}).addTo(lmap).bindTooltip("You are here")},
   ()=>{$("mapNote").textContent="Allow location access to see your position."},{enableHighAccuracy:true,maximumAge:5000})}
async function drawRoute(to){
  if(!me)return alert("Waiting for your location. Allow location access first.");
  const a=me.getLatLng();
  try{
    const r=await(await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${to[1]},${to[0]}?overview=full&geometries=geojson`)).json();
    const rt=r.routes[0];if(routeLine)routeLine.remove();
    routeLine=L.geoJSON(rt.geometry,{style:{color:"#7a4dff",weight:5}}).addTo(lmap);
    lmap.fitBounds(routeLine.getBounds(),{padding:[30,30]});
    $("mapNote").textContent=`Route: ${(rt.distance/1000).toFixed(1)} km, about ${Math.round(rt.duration/60)} min.`;
  }catch(e){$("mapNote").textContent="Could not get a route. Use Navigate instead."}}
$("panelD").addEventListener("close",()=>{
  if(meWatch!=null){navigator.geolocation.clearWatch(meWatch);meWatch=null}
  if(me){me.remove();me=null}if(routeLine){routeLine.remove();routeLine=null}});

/* ---------- 4. LIVE UPDATES ---------- */
function syncOrder(row){
  if(!isAdmin())return;
  const i=lastOrders.findIndex(o=>o.id===row.id);
  if(i>=0)lastOrders[i]=row;else lastOrders.unshift(row);
  if($("panelD").open&&!$("omapw").hidden)renderMap(false)}
async function refreshOrders(){
  if(!isAdmin())return;
  const {data}=await db.from("orders").select("*").order("created_at",{ascending:false});
  if(data){lastOrders=data;if($("panelD").open&&!$("omapw").hidden)renderMap(false)}}
function startLive(){
  if(!db||live)return;
  live=db.channel("live")
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"orders"},p=>{syncOrder(p.new);if(isStaff()&&user&&p.new.user_id!==user.id)notify("New order",money(p.new.total)+" from "+(p.new.address||"a customer"))})
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"orders"},p=>{syncOrder(p.new);if(user&&p.new.user_id===user.id)notify("Order update","Your order is now "+p.new.status)})
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},p=>{if(user&&p.new.sender_id!==user.id&&!$("chatD").open)notify("New message",p.new.body.slice(0,60))})
   .subscribe(s=>{if(s==="SUBSCRIBED")refreshOrders()})}
