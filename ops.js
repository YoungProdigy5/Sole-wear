/* YOUNGEST FASHION: ops.js  (admin tools)
   Load after launch.js:  <script src="ops.js"></script>
   1. Sales tab: today / 7 days / 30 days, a 14-day chart, best sellers, low stock, repeat customers.
   2. Deliveries tab: your run sheet for confirmed / on-the-way orders, nearest first, with one-tap Navigate, Call, WhatsApp,
      "On the way" and "Delivered", plus one full Google Maps route for the whole run.
   3. Print slip button on every order.
   4. "Next drop" countdown editor.
   5. Add-product helper: smart suggestions from the name (free, built in, learns from your catalogue)
      and "Read my photo" (free Google AI via the describe-product function, once you add your free key). */
(function(){
"use strict";
const $$=id=>document.getElementById(id);
if(!$$("admTabs")||!$$("panelD"))return;
const gh=p=>{let x=String(p||"").replace(/\D/g,"");if(x.length===10&&x[0]==="0")x="233"+x.slice(1);return x};
const hav=(a,b,c,d)=>{const r=x=>x*Math.PI/180,h=Math.sin(r(c-a)/2)**2+Math.cos(r(a))*Math.cos(r(c))*Math.sin(r(d-b)/2)**2;return 2*6371*Math.asin(Math.sqrt(Math.min(1,h)))};
const hasPin=o=>o.lat!=null&&o.lng!=null;
const dkey=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");

document.head.insertAdjacentHTML("beforeend",`<style>
.salesgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:12px;margin-top:12px}
.salesgrid>div{background:var(--bg);border:2px solid var(--line);border-radius:10px;padding:12px}
.salesgrid h3{font-size:.95rem;margin-bottom:8px}
.chart14{display:flex;align-items:flex-end;gap:3px;height:110px;margin-top:6px}
.chart14 i{flex:1;background:var(--lime);border:1px solid #0a0a0a;min-height:2px;border-radius:2px 2px 0 0}
.chart14 i.zero{background:var(--line);border-color:var(--line)}
.chartlab{display:flex;gap:3px;font-size:.6rem;opacity:.7}.chartlab span{flex:1;text-align:center}
.runbar{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
.runbar .btn{flex:1 1 auto}
.stop .r{display:flex;flex-wrap:wrap;gap:6px}
.stop .btn{padding:8px 12px;font-size:.82rem;text-decoration:none;text-align:center;flex:1 1 auto}
.aibox{border:2px dashed var(--ink);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px}
.aibox .r{display:flex;flex-wrap:wrap;gap:8px}.aibox .btn{flex:1 1 auto}
.aifilled{outline:3px solid #c6ff3d!important;outline-offset:1px}
</style>`);

/* ---------- new tabs ---------- */
$$("admTabs").insertAdjacentHTML("beforeend",'<button class="tab" data-t="sales" type="button">Sales</button><button class="tab" data-t="run" type="button">Deliveries</button>');
$$("omapw").insertAdjacentHTML("afterend",'<div id="salesBox" hidden></div><div id="runBox" hidden></div>');
const prevTab=window.admTab;
window.admTab=function(t){
  prevTab(t);
  $$("salesBox").hidden=t!=="sales";$$("runBox").hidden=t!=="run";
  if(t==="sales")renderSales();
  if(t==="run")renderRun()};

/* ---------- 1. sales ---------- */
function renderSales(){
  const O=lastOrders.filter(o=>o.status!=="cancelled"),now=new Date();
  const byDay=new Map();O.forEach(o=>{const k=dkey(new Date(o.created_at));byDay.set(k,(byDay.get(k)||0)+Number(o.total||0))});
  const days=[...Array(14)].map((_,i)=>{const d=new Date(now);d.setDate(now.getDate()-(13-i));return{d,v:byDay.get(dkey(d))||0}});
  const since=n=>{const d=new Date(now);d.setDate(now.getDate()-(n-1));d.setHours(0,0,0,0);return O.filter(o=>new Date(o.created_at)>=d)};
  const sum=l=>l.reduce((a,o)=>a+Number(o.total||0),0);
  const t=since(1),w=since(7),m=since(30),mx=Math.max(1,...days.map(x=>x.v));
  const sold=new Map();O.forEach(o=>(o.items||[]).forEach(i=>sold.set(i.name,(sold.get(i.name)||0)+(i.qty||1))));
  const top=[...sold].sort((a,b)=>b[1]-a[1]).slice(0,5);
  const cust=new Map();O.forEach(o=>cust.set(o.user_id,(cust.get(o.user_id)||0)+1));
  const repeat=[...cust.values()].filter(n=>n>1).length;
  const low=products.filter(p=>p.stock!=null&&p.stock<=5).sort((a,b)=>a.stock-b.stock);
  const waiting=lastOrders.filter(o=>o.status==="new").length,unpaid=lastOrders.filter(o=>o.payment_method==="online"&&o.payment_status!=="paid"&&o.status!=="cancelled").length;
  $$("salesBox").innerHTML=`<div class="kpi"><div><b>${money(sum(t))}</b>Today (${t.length})</div><div><b>${money(sum(w))}</b>7 days (${w.length})</div><div><b>${money(sum(m))}</b>30 days (${m.length})</div><div><b>${money(O.length?sum(O)/O.length:0)}</b>Avg order</div></div>
   <div class="salesgrid">
    <div style="grid-column:1/-1"><h3>Sales, last 14 days</h3><div class="chart14" role="img" aria-label="Sales for the last 14 days">${days.map(x=>`<i class="${x.v?"":"zero"}" style="height:${Math.max(2,x.v/mx*100)}%" title="${x.d.toDateString()}: ${money(x.v)}"></i>`).join("")}</div><div class="chartlab">${days.map(x=>`<span>${x.d.getDate()}</span>`).join("")}</div></div>
    <div><h3>Best sellers</h3>${bars(top)}</div>
    <div><h3>To do</h3><p>🆕 ${waiting} new order${waiting===1?"":"s"} to confirm</p><p>💳 ${unpaid} online payment${unpaid===1?"":"s"} to check on Paystack</p><p>🔁 ${repeat} repeat customer${repeat===1?"":"s"}</p></div>
    <div style="grid-column:1/-1"><h3>Running low (5 or fewer)</h3>${low.length?low.map(p=>`<p>${p.stock===0?"❌":"⚠️"} <b>${esc(p.name)}</b>: ${p.stock===0?"sold out":p.stock+" left"}</p>`).join(""):'<p class="meta">Nothing is running low.</p>'}</div>
   </div>`}

/* ---------- 2. deliveries (run sheet) ---------- */
let rider=null;
function runStops(){
  const act=lastOrders.filter(o=>["confirmed","on the way"].includes(o.status)),located=act.filter(hasPin),rest=act.filter(o=>!hasPin(o));
  if(!rider)return [...located,...rest];
  const out=[],pool=[...located];let cur=rider;
  while(pool.length){let bi=0,bd=1e9;pool.forEach((o,i)=>{const d=hav(cur.lat,cur.lng,+o.lat,+o.lng);if(d<bd){bd=d;bi=i}});const n=pool.splice(bi,1)[0];out.push(n);cur={lat:+n.lat,lng:+n.lng}}
  return [...out,...rest]}
function renderRun(){
  const stops=runStops(),pts=stops.filter(hasPin).slice(0,9);
  let route="";
  if(pts.length){const o=rider?`${rider.lat},${rider.lng}`:`${pts[0].lat},${pts[0].lng}`,dest=pts[pts.length-1],mid=(rider?pts:pts.slice(1)).slice(0,-1);
    route=`https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${dest.lat},${dest.lng}${mid.length?"&waypoints="+mid.map(p=>p.lat+","+p.lng).join("|"):""}&travelmode=driving`}
  $$("runBox").innerHTML=`<div class="runbar"><button class="btn alt" id="runMe" type="button">📍 Sort from my location</button>${route?`<a class="btn" href="${route}" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">🗺 Open full route (${pts.length} stop${pts.length>1?"s":""})</a>`:""}</div>
   <p class="meta" style="margin-bottom:8px">Confirmed and on-the-way orders${rider?", nearest first":""}. Confirm an order in the Orders tab to add it here.</p>`
   +(stops.map((o,i)=>{
     const d=rider&&hasPin(o)?hav(rider.lat,rider.lng,+o.lat,+o.lng):null,ph=o.phone||"";
     const weak=hasPin(o)&&(o.loc_source==="address"||(o.lat_accuracy!=null&&o.lat_accuracy>150)||/^\[Location estimated/.test(String(o.note||"")));
     const ask=encodeURIComponent(`Hi, this is Youngest Fashion about your order #${1000+o.id}. Please send us your location (WhatsApp > attach > Location) so our rider can find you.`);
     return `<div class="ord stop"><strong>${i+1}. Order #${1000+o.id} · ${money(o.total)} · ${esc(o.status)}</strong>
      <span class="meta">${d!=null?"📏 "+d.toFixed(1)+" km from you · ":""}${o.payment_method==="delivery"?"Collect "+money(o.total)+" on delivery":"Paid online ("+esc(o.payment_status||"")+")"}</span>
      <span>${esc(o.address||"No address")}</span>${o.note?`<span class="meta">${esc(String(o.note).replace(/^\[Location estimated[^\]]*\]\s*/,""))}</span>`:""}
      ${hasPin(o)?(weak?`<span class="meta" style="color:#d6125f;font-weight:800">⚠ Pin may be off${o.lat_accuracy>150?" (GPS ±"+Math.round(o.lat_accuracy)+" m)":o.loc_source==="address"?" (guessed from the address)":""}. Ask the customer to confirm.</span>`:""):'<span class="meta" style="color:#d6125f;font-weight:800">⚠ No map pin yet</span>'}
      <div class="r">${hasPin(o)?`<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lng}&travelmode=driving">Navigate</a>`:""}${!hasPin(o)||weak?`<a class="btn alt" target="_blank" rel="noopener" href="https://wa.me/${gh(ph)}?text=${ask}">${hasPin(o)?"Confirm location (WhatsApp)":"Ask for location"}</a>`:""}
       ${ph?`<a class="btn ghost" href="tel:${esc(ph)}">Call</a><a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/${gh(ph)}">WhatsApp</a>`:""}
       ${o.status==="confirmed"?`<button class="btn alt" data-runst="${o.id}:on the way" type="button">On the way</button>`:""}
       <button class="btn alt" data-runst="${o.id}:delivered" type="button">Delivered ✓</button></div></div>`}).join("")||'<p class="meta">No deliveries to make right now.</p>')}
$$("runBox").addEventListener("click",async e=>{
  if(e.target.closest("#runMe")){
    if(!navigator.geolocation)return alert("This device cannot share GPS.");
    const b=e.target.closest("#runMe");b.disabled=true;b.textContent="Finding you...";
    navigator.geolocation.getCurrentPosition(p=>{rider={lat:p.coords.latitude,lng:p.coords.longitude};renderRun()},
      ()=>{b.disabled=false;b.textContent="📍 Sort from my location";alert("Allow location in your browser to sort by distance.")},{enableHighAccuracy:true,timeout:15000,maximumAge:0});return}
  const b=e.target.closest("[data-runst]");if(!b)return;
  const [id,st]=b.dataset.runst.split(":");
  if(st==="delivered"&&!confirm("Mark order #"+(1000+ +id)+" as delivered?"))return;
  b.disabled=true;
  const {data,error}=await db.from("orders").update({status:st}).eq("id",+id).select("id");
  if(error||!data||!data.length){b.disabled=false;return alert(error?error.message:"Could not update that order.")}
  const o=lastOrders.find(x=>x.id===+id);if(o)o.status=st;
  notify("Order #"+(1000+ +id),st==="delivered"?"marked delivered":"marked on the way");renderRun()});

/* ---------- 3. print slip + panel buttons ---------- */
function slip(o){
  const items=(o.items||[]).map(i=>`<tr><td>${esc(i.name)}<br><small>Size ${esc(i.size||"-")}</small></td><td>x${i.qty||1}</td><td style="text-align:right">${money((i.price||0)*(i.qty||1))}</td></tr>`).join("");
  const pay=o.payment_method==="delivery"?`COLLECT ${money(o.total)} ON DELIVERY`:(o.payment_status==="paid"?"PAID ONLINE":"ONLINE: CHECK PAYSTACK");
  return `<!doctype html><meta charset="utf-8"><title>Order #${1000+o.id}</title><style>body{font:14px/1.4 Arial,sans-serif;margin:16px;max-width:380px}h1{font-size:20px;margin:0}table{width:100%;border-collapse:collapse;margin:8px 0}td{border-bottom:1px dashed #999;padding:5px 0;vertical-align:top}.pay{border:2px solid #000;padding:8px;text-align:center;font-weight:bold;margin:10px 0}small{color:#555}</style>
  <h1>YOUNGEST FASHION</h1><div>Order #${1000+o.id} · ${new Date(o.created_at).toLocaleString()}</div><hr>
  <b>Deliver to</b><br>${esc(o.address||"-")}<br>📞 ${esc(o.phone||"-")}${o.note?`<br><i>${esc(o.note)}</i>`:""}
  ${hasPin(o)?`<br><small>Map: https://www.google.com/maps?q=${o.lat},${o.lng}</small>`:`<br><small>No map pin: call the customer.</small>`}
  <table>${items}</table><div style="text-align:right"><b>Total ${money(o.total)}</b></div><div class="pay">${pay}</div><small>Thank you for shopping with us.</small>
  <script>window.onload=function(){window.print()}<\/script>`}
$$("pList").addEventListener("click",e=>{
  const b=e.target.closest("[data-slip]");if(!b)return;
  const o=lastOrders.find(x=>String(x.id)===b.dataset.slip);if(!o)return;
  const w=window.open("","_blank","width=440,height=700");
  if(!w)return alert("Your browser blocked the pop-up. Allow pop-ups for this site, then try again.");
  w.document.write(slip(o));w.document.close()});

/* ---------- 4. next drop editor ---------- */
const dropD=(function(){
  const d=document.createElement("dialog");d.id="dropD";
  d.innerHTML=`<h2>Next drop</h2><p class="meta" style="margin-bottom:8px">Shows a live countdown at the top of your shop. After the time passes it says the drop is live for 24 hours, then disappears.</p>
   <div class="f"><input id="dropTitle" maxlength="60" placeholder="Title, e.g. Air Force 1 restock"><label class="meta" for="dropAt">Date and time</label><input id="dropAt" type="datetime-local">
   <button class="btn" id="dropSave" type="button">Save countdown</button><button class="btn ghost" id="dropClear" type="button">Remove countdown</button><p class="meta" id="dropMsg" aria-live="polite"></p>
   <button class="btn ghost" data-x type="button">Close</button></div>`;
  d.addEventListener("click",e=>{if(e.target.closest("[data-x]"))d.close()});document.body.append(d);return d})();
async function openDrop(){
  try{$$("panelD").close()}catch(e){}
  dropD.showModal();$$("dropMsg").textContent="";
  const {data}=await db.from("shop_settings").select("drop_title,drop_at").eq("id",1).single();
  $$("dropTitle").value=(data&&data.drop_title)||"";
  if(data&&data.drop_at){const t=new Date(data.drop_at),p=n=>String(n).padStart(2,"0");$$("dropAt").value=t.getFullYear()+"-"+p(t.getMonth()+1)+"-"+p(t.getDate())+"T"+p(t.getHours())+":"+p(t.getMinutes())}else $$("dropAt").value=""}
async function saveDrop(clear){
  const msg=$$("dropMsg"),title=$$("dropTitle").value.trim(),at=$$("dropAt").value;
  if(!clear&&(!title||!at)){msg.textContent="Add a title and a date and time.";return}
  const row=clear?{drop_title:null,drop_at:null}:{drop_title:title,drop_at:new Date(at).toISOString()};
  msg.textContent="Saving...";
  const {data,error}=await db.from("shop_settings").update(row).eq("id",1).select();
  if(error){msg.textContent=error.message;return}
  if(!data||!data.length){msg.textContent="Only admins can change this.";return}
  msg.textContent=clear?"Countdown removed.":"Saved. Your shop now shows the countdown.";
  window.dispatchEvent(new Event("yf:drop"))}
$$("dropSave").onclick=()=>saveDrop(false);$$("dropClear").onclick=()=>saveDrop(true);

const prevPanel=window.openPanel;
window.openPanel=async function(){
  await prevPanel.apply(this,arguments);
  try{
    let db1=$$("dropBtn");
    if(isAdmin()){
      if(!db1){db1=document.createElement("button");db1.id="dropBtn";db1.type="button";db1.className="btn alt";db1.textContent="Next drop (countdown)";db1.onclick=openDrop;$$("logout").before(db1)}
      db1.hidden=false;
      document.querySelectorAll("#pList .ord").forEach(el=>{
        const cb=el.querySelector("[data-chat]");if(cb&&!el.querySelector("[data-slip]"))cb.insertAdjacentHTML("beforebegin",`<button class="btn ghost" data-slip="${cb.dataset.chat}" type="button">🖨 Print slip</button>`)})
    }else if(db1)db1.hidden=true
  }catch(e){console.error(e)}};

/* =========================================================
   5. ADD-PRODUCT HELPER
   ========================================================= */
const cap=s=>s.charAt(0).toUpperCase()+s.slice(1).toLowerCase();
const BRANDS=["New Balance","Under Armour","The North Face","Tommy Hilfiger","Calvin Klein","Ralph Lauren","Louis Vuitton","Fear of God","Off-White","Fashion Nova","Pull&Bear","Hugo Boss","Nike","Adidas","Jordan","Puma","Converse","Vans","Reebok","Asics","Skechers","Fila","Champion","Zara","H&M","Shein","Levi's","Gucci","Balenciaga","Timberland","Crocs","Yeezy","Supreme","Lacoste","Dickies","Carhartt","Stussy","Essentials","Gap","Uniqlo","Bershka"];
const MODELS=[[/air force 1|\baf-?1\b/i,"Air Force 1"],[/air max\s*(\w+)?/i,m=>"Air Max"+(m[1]&&!/^(low|mid|high)$/i.test(m[1])?" "+m[1]:"")],[/dunk/i,"Dunk"],[/jordan\s*(\d{1,2})/i,m=>"Air Jordan "+m[1]],[/samba/i,"Samba"],[/gazelle/i,"Gazelle"],[/superstar/i,"Superstar"],[/stan smith/i,"Stan Smith"],[/campus/i,"Campus"],[/yeezy\s*(\d{3})?/i,m=>"Yeezy"+(m[1]?" "+m[1]:"")],[/\b(550|574|530|2002r|9060|327)\b/i,m=>m[1].toUpperCase()],[/old skool/i,"Old Skool"],[/sk8-?hi/i,"Sk8-Hi"],[/chuck\s*(taylor|70)/i,m=>"Chuck "+cap(m[1])],[/club c/i,"Club C"],[/cortez/i,"Cortez"],[/pegasus/i,"Pegasus"],[/vomero/i,"Vomero"],[/blazer/i,"Blazer"],[/air presto/i,"Air Presto"],[/ultraboost/i,"Ultraboost"],[/forum/i,"Forum"]];
const COLORS=[["triple white","Triple White"],["triple black","Triple Black"],["panda","Black/White"],["white","White"],["black","Black"],["red","Red"],["blue","Blue"],["navy","Navy"],["green","Green"],["olive","Olive"],["grey","Grey"],["gray","Grey"],["pink","Pink"],["purple","Purple"],["brown","Brown"],["tan","Tan"],["cream","Cream"],["beige","Beige"],["orange","Orange"],["yellow","Yellow"],["gold","Gold"],["silver","Silver"],["maroon","Maroon"],["khaki","Khaki"]];
const RX_SNEAKER=/sneaker|shoe|trainer|kicks|slide|sandal|slipper|boot|loafer|runner|crocs|flip.?flop/i,
      RX_ACC=/\b(cap|hat|bag|backpack|belt|socks?|watch|sunglasses|wallet|beanie|scarf|gloves?|bracelet|chain)\b/i,
      RX_WOMEN=/\b(women|woman|ladies|lady|dress|skirt|blouse|crop|leggings?|bra|heels?|gown|girls?)\b/i,
      RX_CLOTH=/hoodie|sweatshirt|tee\b|t-?shirt|shirt|polo|jacket|coat|jeans|trousers|pants|cargo|shorts|joggers?|tracksuit|sweatpants|jersey|top\b|vest|singlet/i;
function smartSuggest(name,brandIn){
  const n=" "+String(name||"").trim()+" ",out={};let brand=String(brandIn||"").trim();
  if(!brand)for(const b of BRANDS){if(new RegExp("(^|[^a-z])"+b.replace(/[.*+?^${}()|[\]\\&']/g,"\\$&")+"([^a-z]|$)","i").test(n)){brand=b;break}}
  if(brand)out.brand=brand;
  let model="",isShoeModel=false;
  for(const [rx,v] of MODELS){const m=n.match(rx);if(m){model=typeof v==="function"?v(m):v;isShoeModel=true;break}}
  const variant=n.match(/\b(low|mid|high)\b/i);
  if(model&&variant&&!/\b(low|mid|high)\b/i.test(model)&&/air force 1|dunk|jordan|blazer|cortez/i.test(model))model+=" "+cap(variant[1]);
  if(model)out.model=model;
  const hits=[];let rest=n.toLowerCase();
  for(const [w,label] of COLORS){if(new RegExp("(^|[^a-z])"+w+"([^a-z]|$)").test(rest)){if(label==="White"&&hits.includes("Triple White"))continue;if(label==="Black"&&hits.includes("Triple Black"))continue;if(!hits.includes(label))hits.push(label)}}
  if(hits.length)out.colorway=hits.some(h=>/Triple|Black\/White/.test(h))?hits.filter(h=>/Triple|Black\/White/.test(h))[0]:hits.slice(0,3).join("/");
  let cat="";
  if(RX_SNEAKER.test(n)||isShoeModel)cat="Sneakers";else if(RX_ACC.test(n))cat="Accessories";else if(RX_CLOTH.test(n)||RX_WOMEN.test(n))cat=RX_WOMEN.test(n)?"Women's wear":"Men's wear";
  if(cat)out.category=cat;
  /* learn from your own catalogue: same brand/category products tell us your usual sizes and prices */
  const same=products.filter(p=>cat&&p.category===cat),sameB=same.filter(p=>brand&&p.brand===brand),pool=sameB.length?sameB:same;
  const freq=new Map();pool.forEach(p=>{if((p.sizes||[]).length){const k=p.sizes.join(",");freq.set(k,(freq.get(k)||0)+1)}});
  const common=[...freq].sort((a,b)=>b[1]-a[1])[0];
  if(cat==="Sneakers")out.sizes=common?common[0]:"40,41,42,43,44,45";
  else if(cat==="Men's wear"||cat==="Women's wear")out.sizes=common?common[0]:"S,M,L,XL";
  const prices=pool.map(p=>+p.price).filter(x=>x>0).sort((a,b)=>a-b);
  if(prices.length)out.priceHint="Similar items in your shop: "+money(prices[0])+(prices.length>1?" to "+money(prices[prices.length-1]):"");
  const nm=[brand,model].filter(Boolean).join(" ")||String(name||"").trim();
  if(nm){let d=nm+(out.colorway?" in "+out.colorway.toLowerCase():"")+".";
    const w=n.match(/\bwith\s+([^()]{3,50})/i);if(w)d+=" Comes with "+w[1].trim().replace(/[.,;]+$/,"")+".";
    d+=cat==="Sneakers"?" A clean pair for everyday wear. Check the size guide for your fit.":cat==="Accessories"?" A simple accessory to finish your look.":cat?" Comfortable everyday streetwear. Check the size guide for your fit.":"";
    out.description=d}
  return out}
window.smartSuggest=smartSuggest;   /* handy for testing */

const box=document.createElement("div");box.className="aibox";box.id="aiBox";
box.innerHTML=`<b>✨ Fill the details for me</b><p class="meta">Type the product name (and brand if you know it), or choose a photo, then tap a button. Check everything before saving.</p>
 <div class="r"><button type="button" class="btn alt" id="aiSmart">✨ Suggest from the name</button><button type="button" class="btn ghost" id="aiPhoto">📷 Read my photo (AI)</button></div><p class="meta" id="aiMsg" aria-live="polite"></p>`;
$$("pName").insertAdjacentElement("beforebegin",box);
const IDS={brand:"pBrand",model:"pModel",colorway:"pColor",category:"pCat",sizes:"pSizes",description:"pDesc",name:"pName"};
const LABEL={brand:"brand",model:"model",colorway:"colour",category:"category",sizes:"sizes",description:"description",name:"name"};
function fill(sug){
  const done=[];
  Object.keys(IDS).forEach(k=>{
    const el=$$(IDS[k]);let v=sug[k];if(v==null||v==="")return;if(Array.isArray(v))v=v.join(",");
    if(!el.value.trim()){el.value=v;el.classList.add("aifilled");setTimeout(()=>el.classList.remove("aifilled"),4000);done.push(LABEL[k])}});
  return done}
function msg(t){$$("aiMsg").textContent=t}
$$("aiSmart").onclick=()=>{
  const name=$$("pName").value.trim();
  if(!name){msg("Type the product name first, for example: Nike Air Force 1 Low white.");return}
  const s=smartSuggest(name,$$("pBrand").value),done=fill(s);
  msg((done.length?"Filled: "+done.join(", ")+". ":"Nothing new to fill, those boxes already have text. ")+(s.priceHint?s.priceHint+". ":"")+"Check it, then save.")};
$$("aiPhoto").onclick=async()=>{
  const f=$$("pImg").files[0];
  if(!f){msg("Choose a photo first (tap Choose file at the top).");return}
  const b=$$("aiPhoto");b.disabled=true;msg("Reading your photo...");
  let note="";
  try{
    const blob=await compress(f);
    const b64=await new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(String(fr.result).split(",")[1]);fr.readAsDataURL(blob)});
    const {data,error}=await db.functions.invoke("describe-product",{body:{image:b64,mime:"image/jpeg",hint:($$("pName").value+" "+$$("pBrand").value).trim()}});
    if(!error&&data&&data.ok){
      const done=fill(data.data),s=smartSuggest($$("pName").value||data.data.name,$$("pBrand").value||data.data.brand),more=fill(s);
      msg("Photo AI filled: "+[...done,...more].join(", ")+". Please check it carefully before saving.");b.disabled=false;return}
    const why=data&&data.error;
    note=why==="not_configured"?"Photo AI is not switched on yet (it needs your free Google key). ":why==="rate_limited"?"The free photo AI limit is reached for now. ":"The photo AI could not read this one. ";
  }catch(e){note="The photo AI could not be reached. "}
  const name=$$("pName").value.trim();
  if(name){const done=fill(smartSuggest(name,$$("pBrand").value));msg(note+"I used the name instead and filled: "+(done.join(", ")||"nothing new")+".")}
  else msg(note+"Type the product name and tap Suggest from the name.");
  b.disabled=false};
})();
