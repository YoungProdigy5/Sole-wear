/* YOUNGEST FASHION: cancel-order.js
   Load AFTER the main script (and after live-map.js / no-maps.js), before </body>:
   <script src="cancel-order.js"></script>
   Customers can cancel while the order is "new" or "confirmed" and unpaid.
   Once it is "on the way" or "delivered", the button disappears and the server refuses. */
const _openPanel=openPanel;
openPanel=async function(){
  await _openPanel();
  if(isAdmin())return;
  document.querySelectorAll("#pList [data-chat]").forEach(b=>{
    const o=lastOrders.find(x=>String(x.id)===b.dataset.chat);
    if(!o)return;
    if(["new","confirmed"].includes(o.status)&&o.payment_status!=="paid"){
      b.insertAdjacentHTML("beforebegin",`<button class="btn ghost" data-cancel="${o.id}">Cancel order</button>`)}
    else if(o.status==="on the way")b.insertAdjacentHTML("beforebegin",'<span class="meta">On its way: can no longer be cancelled.</span>')})};
$("pList").addEventListener("click",async e=>{
  const id=e.target.dataset.cancel;if(!id)return;
  if(!confirm("Cancel order #"+(1000+Number(id))+"? This cannot be undone."))return;
  e.target.disabled=true;
  const {error}=await db.rpc("cancel_order",{p_order:Number(id)});
  if(error){alert(error.message);e.target.disabled=false;return}
  products=await loadProducts();renderTabs();render();
  $("panelD").close();openPanel()});
