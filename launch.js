/* YOUNGEST FASHION: launch.js
   Load LAST (after shop-features.js):  <script src="launch.js"></script>
   1. TikTok / Instagram / Facebook in-app browser notice (those browsers often block exact location).
   2. "Shop by brand" chips built from your products.
   3. Neater tiles for products that have no photo yet.
   4. Admin: delete cancelled orders (one by one, or all at once).
   5. Privacy line at checkout. */
(function(){
"use strict";
const $$=id=>document.getElementById(id);

/* ---------- styles ---------- */
document.head.insertAdjacentHTML("beforeend",`<style>
.iab{display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;background:#0a0a0a;color:#f5f3ee;padding:10px var(--px,4vw);font-size:.85rem;border-bottom:3px solid #c6ff3d}
.iab span{flex:1 1 220px}
.iab button{background:#c6ff3d;color:#0a0a0a;border:2px solid #0a0a0a;border-radius:6px;font-weight:800;padding:6px 10px;cursor:pointer;min-height:36px}
.iab .x{background:none;color:#f5f3ee;border-color:#f5f3ee}
.brands{display:flex;flex-wrap:wrap;gap:10px}
.brand{border:2px solid var(--ink);background:transparent;color:var(--ink);border-radius:8px;padding:10px 16px;font:900 1rem Archivo,sans-serif;text-transform:uppercase;letter-spacing:.02em;cursor:pointer;min-height:44px}
.brand span{font-weight:600;opacity:.7;font-size:.8rem}
.brand:hover{background:var(--ink);color:var(--bg)}
.pic .ph{display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;padding:10px}
.pic .ph b{font:900 clamp(1.2rem,5vw,1.8rem)/1 Archivo,sans-serif;text-transform:uppercase;letter-spacing:-.02em}
.pic .ph small{font:700 .7rem Instrument Sans,sans-serif;text-transform:uppercase;letter-spacing:.1em;opacity:.85}
.pdesc{margin:8px 0;overflow-wrap:anywhere}
#privNote{font-size:.8rem}
</style>`);

/* ---------- 1. in-app browser notice ---------- */
(function(){
  const ua=navigator.userAgent||"";
  if(!/TikTok|musical_ly|Bytedance|Instagram|FBAN|FBAV|Snapchat/i.test(ua))return;
  try{if(sessionStorage.getItem("yf_iab"))return}catch(e){}
  const b=document.createElement("div");b.className="iab";b.setAttribute("role","note");
  b.innerHTML='<span>📍 For your exact delivery location, tap <b>⋯</b> and choose <b>Open in browser</b>.</span><button type="button" data-cp>Copy link</button><button type="button" class="x" aria-label="Dismiss">✕</button>';
  b.addEventListener("click",e=>{
    if(e.target.closest("[data-cp]")){try{navigator.clipboard.writeText(location.href.split("#")[0]);e.target.textContent="Copied"}catch(x){prompt("Copy this link and open it in your browser:",location.href)}}
    if(e.target.closest(".x")){b.remove();try{sessionStorage.setItem("yf_iab","1")}catch(x){}}});
  document.body.prepend(b)})();

/* ---------- 2. shop by brand ---------- */
$$("tiles").closest("section").insertAdjacentHTML("afterend",'<section class="sec" id="brandSec" hidden><h2>Shop by brand</h2><div class="brands" id="brandRow"></div></section>');
function drawBrands(){
  const m=new Map();products.forEach(p=>{if(p.brand)m.set(p.brand,(m.get(p.brand)||0)+1)});
  $$("brandSec").hidden=m.size<2;
  $$("brandRow").innerHTML=[...m].map(([b,n])=>`<button class="brand" type="button" data-b="${esc(b)}">${esc(b)} <span>(${n})</span></button>`).join("")}
$$("brandRow").addEventListener("click",e=>{
  const b=e.target.closest("[data-b]");if(!b)return;
  $$("type").value=b.dataset.b;$$("type").dispatchEvent(new Event("input"));
  document.querySelector(".allh").scrollIntoView({behavior:"smooth"})});
const prevHome=window.renderHome;
window.renderHome=function(){prevHome.apply(this,arguments);try{drawBrands()}catch(e){}};

/* ---------- 3. tiles for products without a photo ---------- */
const prevRender=window.render;
window.render=function(){
  prevRender.apply(this,arguments);
  try{document.querySelectorAll("#grid div.pic[data-det]").forEach(d=>{
    const p=products.find(x=>String(x.id)===String(d.dataset.det));
    if(p)d.innerHTML=`<span class="ph"><b>${esc(p.brand||p.name.slice(0,12))}</b><small>Photo coming soon</small></span>`})}catch(e){}};

/* ---------- 4. admin: delete cancelled orders ---------- */
const prevPanel=window.openPanel;
window.openPanel=async function(){
  await prevPanel.apply(this,arguments);
  try{
    if(!isAdmin())return;
    let n=0;
    document.querySelectorAll("#pList .ord").forEach(el=>{
      const cb=el.querySelector("[data-chat]"),o=cb&&lastOrders.find(x=>String(x.id)===cb.dataset.chat);
      if(o&&o.status==="cancelled"){n++;cb.insertAdjacentHTML("beforebegin",`<button class="btn ghost" data-delord="${o.id}" type="button">🗑 Delete this order</button>`)}});
    if(n>0)$$("pList").insertAdjacentHTML("afterbegin",`<button class="btn ghost" id="delAll" type="button">🗑 Delete all ${n} cancelled order${n>1?"s":""}</button>`)
  }catch(e){console.error(e)}};
$$("pList").addEventListener("click",async e=>{
  const one=e.target.closest("[data-delord]"),all=e.target.closest("#delAll");
  if(!one&&!all)return;
  const ids=one?[+one.dataset.delord]:lastOrders.filter(o=>o.status==="cancelled").map(o=>o.id);
  if(!ids.length)return;
  if(!confirm(one?"Delete this cancelled order for good?":"Delete all "+ids.length+" cancelled orders for good? This cannot be undone."))return;
  const {data,error}=await db.from("orders").delete().in("id",ids).select("id");
  if(error)return alert(error.message);
  if(!data||!data.length)return alert("Nothing was deleted. Only cancelled orders can be deleted.");
  lastOrders=lastOrders.filter(o=>!data.some(d=>d.id===o.id));
  $$("panelD").close();openPanel()});

/* ---------- 5. privacy line at checkout ---------- */
($$("radStat")||$$("pickBox")||$$("oLocMsg")).after(Object.assign(document.createElement("p"),{id:"privNote",className:"meta",textContent:"🔒 We use your location and phone number only to deliver this order."}));

/* ---------- on slow connections the products can arrive before these scripts: redraw once so everything shows ---------- */
if(typeof products!=="undefined"&&products.length){renderTabs();render()}
})();
