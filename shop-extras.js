/* YOUNGEST FASHION: shop-extras.js  (batch 1)
   Load AFTER the main script and the other add-ons, before </body>:
   <script src="shop-extras.js"></script>
   Adds: recently viewed row, share/copy link, shareable product links,
   order tracking steps, one-tap reorder, saved phone + address at checkout. */

/* ---------- styles ---------- */
document.head.insertAdjacentHTML("beforeend",`<style>
.trk{display:flex;gap:4px;margin:6px 0}
.trk i{flex:1;text-align:center;font:600 .68rem Archivo,sans-serif;text-transform:uppercase;letter-spacing:.04em;padding:6px 2px;border-radius:99px;border:1px solid var(--line);opacity:.55}
.trk i.on{background:var(--grad);color:var(--on);border-color:transparent;opacity:1}
.trk i.now{box-shadow:0 0 0 3px rgba(255,46,136,.35)}
.canc{color:#ff4d4d;font-weight:600}
.shr{margin-top:10px;width:100%}
.rvs[hidden]{display:none}
</style>`);

/* ---------- recently viewed ---------- */
let rvIds=[];try{rvIds=JSON.parse(localStorage.getItem("rv")||"[]")}catch(e){}
if(!Array.isArray(rvIds))rvIds=[];
$("rail").closest("section").insertAdjacentHTML("afterend",'<section class="sec rvs" id="rvSec" hidden><h2>Recently viewed</h2><div class="rail" id="rvRail"></div></section>');
function drawRV(){
  const list=rvIds.map(i=>products.find(p=>String(p.id)===String(i))).filter(Boolean);
  $("rvSec").hidden=!list.length;
  $("rvRail").innerHTML=list.map(p=>`<div class="rc" data-det="${p.id}">${p.image_url?`<img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy">`:`<div class="t" style="background:${p.color||"#17191e"}">${esc(p.name[0])}</div>`}<div class="i"><b>${esc(p.name)}</b>${money(p.price)}</div></div>`).join("")}
$("rvRail").onclick=e=>{const d=e.target.closest("[data-det]");if(d)showDet(d.dataset.det)};

/* ---------- product detail: share + remember ---------- */
const _showDet=showDet;
showDet=function(id){
  _showDet(id);
  const p=products.find(x=>x.id==id);if(!p)return;
  rvIds=[String(p.id),...rvIds.filter(x=>x!==String(p.id))].slice(0,8);
  try{localStorage.setItem("rv",JSON.stringify(rvIds))}catch(e){}
  drawRV();
  $("detBody").insertAdjacentHTML("beforeend",`<button class="btn ghost shr" data-share="${p.id}">Share this product</button>`)};
$("detD").addEventListener("click",async e=>{
  const id=e.target.dataset.share;if(!id)return;
  const p=products.find(x=>x.id==id),url=location.origin+location.pathname+"?p="+id;
  try{if(navigator.share)await navigator.share({title:p.name,text:p.name+" at Youngest Fashion",url});
      else{await navigator.clipboard.writeText(url);notify("Link copied","Send it to a friend")}}catch(x){}});
(function openShared(){
  const id=new URLSearchParams(location.search).get("p");if(!id)return;
  let n=0;const t=setInterval(()=>{if(products.length){clearInterval(t);showDet(id)}else if(++n>50)clearInterval(t)},100)})();
(function waitRV(){let n=0;const t=setInterval(()=>{if(products.length){clearInterval(t);drawRV()}else if(++n>50)clearInterval(t)},200)})();

/* ---------- orders: tracking steps + reorder ---------- */
const STEPS=["new","confirmed","on the way","delivered"];
const _openPanel2=openPanel;
openPanel=async function(){
  await _openPanel2();
  document.querySelectorAll("#pList [data-chat]").forEach(b=>{
    const o=lastOrders.find(x=>String(x.id)===b.dataset.chat);if(!o)return;
    const at=STEPS.indexOf(o.status);
    b.insertAdjacentHTML("beforebegin",o.status==="cancelled"?'<span class="canc">Order cancelled</span>':
      `<div class="trk" aria-label="Order progress">${STEPS.map((s,i)=>`<i class="${i<=at?"on":""} ${i===at?"now":""}">${s==="new"?"Placed":s}</i>`).join("")}</div>`);
    if(!isAdmin())b.insertAdjacentHTML("beforebegin",`<button class="btn ghost" data-reorder="${o.id}">Order again</button>`)})};
$("pList").addEventListener("click",e=>{
  const id=e.target.dataset.reorder;if(!id)return;
  const o=lastOrders.find(x=>String(x.id)===id);if(!o)return;
  let added=0,skipped=0;
  (o.items||[]).forEach(i=>{
    const p=products.find(x=>String(x.id)===String(i.id));
    if(!p||p.stock===0){skipped++;return}
    const q=Math.min(i.qty||1,p.stock??20),ex=cart.find(c=>c.id===p.id&&c.size===i.size);
    if(ex)ex.qty=Math.min(20,(ex.qty||1)+q);else cart.push({id:p.id,name:p.name,price:p.price,size:i.size,qty:q});added++});
  renderCart();$("panelD").close();$("cart").classList.add("open");
  notify(added?"Added to cart":"Nothing added",added?(skipped?skipped+" item(s) are no longer available":"Review and check out"):"Those items are sold out")});

/* ---------- saved phone + address ---------- */
$("checkout").addEventListener("click",()=>{
  try{const s=JSON.parse(localStorage.getItem("ship")||"{}");
    if(!$("oPhone").value)$("oPhone").value=s.phone||"";if(!$("oAddr").value)$("oAddr").value=s.addr||""}catch(e){}});
$("oGo").addEventListener("click",()=>{
  try{localStorage.setItem("ship",JSON.stringify({phone:$("oPhone").value.trim(),addr:$("oAddr").value.trim()}))}catch(e){}});
