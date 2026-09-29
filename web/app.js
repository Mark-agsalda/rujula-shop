const API_BASE = localStorage.getItem('rujula_api') || window.RUJULA_API_BASE || 'http://127.0.0.1:8000';
let token = localStorage.getItem('token') || '';
let user = JSON.parse(localStorage.getItem('user') || 'null');
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let productsCache = [];
let addressesCache = [];
let currentPage = 'dashboard';
let searchTimer;

const $ = (id) => document.getElementById(id);
const money = (n) => `₱${Number(n || 0).toLocaleString('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const placeholder = 'https://via.placeholder.com/700x520?text=Rujula+Shop';

async function api(path, options={}) {
  const headers = {...(options.headers || {})};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && typeof options.body !== 'string') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const response = await fetch(API_BASE + path, {...options, headers});
  let data = {};
  try { data = await response.json(); } catch (_) {}
  if (!response.ok) {
    if (response.status === 401) clearSession(false);
    throw new Error(data.detail || 'Something went wrong.');
  }
  return data;
}

function showToast(message, type='normal') {
  const toast = $('toast');
  toast.textContent = message;
  toast.style.background = type === 'error' ? '#b52f3a' : 'var(--navy)';
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function switchAuth(mode) {
  $('loginForm').classList.toggle('hidden', mode !== 'login');
  $('registerForm').classList.toggle('hidden', mode !== 'register');
  $('loginTab').classList.toggle('active', mode === 'login');
  $('registerTab').classList.toggle('active', mode === 'register');
}

async function submitLogin(event) {
  event.preventDefault();
  try {
    const result = await api('/api/auth/login', {method:'POST', body:{email:$('loginEmail').value.trim(), password:$('loginPassword').value}});
    setSession(result);
    showToast('Welcome back!');
    startApp();
  } catch (e) { showToast(e.message, 'error'); }
}

async function submitRegister(event) {
  event.preventDefault();
  try {
    const result = await api('/api/auth/register', {method:'POST', body:{name:$('registerName').value.trim(), email:$('registerEmail').value.trim(), phone:$('registerPhone').value.trim(), password:$('registerPassword').value}});
    setSession(result);
    showToast('Account created successfully!');
    startApp();
  } catch (e) { showToast(e.message, 'error'); }
}

function setSession(result) {
  token = result.token;
  user = result.user;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}
function clearSession(clearCart=true) {
  token=''; user=null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  if (clearCart) { cart=[]; saveCart(); }
}
function logout() {
  clearSession();
  $('appView').classList.add('hidden');
  $('authView').classList.remove('hidden');
  switchAuth('login');
  showToast('You have been logged out.');
}

function startApp() {
  if (!token || !user) {
    $('authView').classList.remove('hidden');
    $('appView').classList.add('hidden');
    return;
  }
  $('authView').classList.add('hidden');
  $('appView').classList.remove('hidden');
  $('userNameTop').textContent = user.name?.split(' ')[0] || 'Account';
  $('userInitial').textContent = (user.name || 'U').charAt(0).toUpperCase();
  $('sellerNav').classList.toggle('hidden', user.role !== 'seller');
  saveCart();
  navigate(user.role === 'seller' ? 'dashboard' : 'dashboard');
}

function navigate(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  const target = $(`page-${page}`);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('[data-nav]').forEach(b => b.classList.toggle('active', b.dataset.nav === page));
  if (page === 'dashboard') renderDashboard();
  if (page === 'shop') renderShop();
  if (page === 'cart') renderCart();
  if (page === 'orders') renderOrders();
  if (page === 'profile') renderProfile();
  if (page === 'products') renderProductsAdmin();
  if (page === 'seller-orders') renderSellerOrders();
  if (page === 'shipping') renderShipping();
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  $('cartCount').textContent = count;
  $('sideCartCount').textContent = count;
}

function debouncedShop() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { if (currentPage !== 'shop') navigate('shop'); else renderShop(); }, 250);
}

async function getProducts(force=false) {
  if (!force && productsCache.length) return productsCache;
  productsCache = await api('/api/products');
  return productsCache;
}

async function renderDashboard() {
  const page = $('page-dashboard');
  page.innerHTML = `<div class="loading">Loading dashboard...</div>`;
  try {
    const [products, orders] = await Promise.all([api('/api/products'), api(user.role === 'seller' ? '/api/seller/orders' : '/api/orders')]);
    productsCache = products;
    if (user.role === 'seller') {
      page.innerHTML = `
        <div class="page-head"><div><h1>Seller Dashboard</h1><p class="muted">Manage your Rujula Shop business.</p></div><button class="primary" onclick="navigate('products')">+ Add Product</button></div>
        <div class="stats"><div class="stat"><small>Products</small><strong>${products.length}</strong></div><div class="stat"><small>Orders</small><strong>${orders.length}</strong></div><div class="stat"><small>Pending</small><strong>${orders.filter(o=>o.status==='Pending').length}</strong></div><div class="stat"><small>Sales</small><strong>${money(orders.filter(o=>o.status!=='Cancelled').reduce((s,o)=>s+Number(o.total),0))}</strong></div></div>
        <div class="two-col"><div class="panel"><div class="panel-title"><h3>Recent orders</h3><button class="ghost" onclick="navigate('seller-orders')">View all</button></div>${orders.slice(0,5).map(orderRow).join('') || empty('No orders yet.')}</div><div class="panel"><div class="panel-title"><h3>Quick actions</h3></div><button class="secondary wide" onclick="navigate('products')">Manage products</button><button class="secondary wide" onclick="navigate('shipping')">Set shipping fees</button><button class="secondary wide" onclick="navigate('seller-orders')">Update order status</button></div></div>`;
    } else {
      page.innerHTML = `
        <div class="hero"><div><span class="eyebrow">RUJULA SHOP</span><h1>Hello, ${esc(user.name?.split(' ')[0] || 'there')} 👋</h1><p>Discover products from your local shop and check out when you're ready.</p><br><button class="primary" onclick="navigate('shop')">Start shopping</button></div><img src="rujula-icon.png" alt="Rujula Shop"></div>
        <div class="stats"><div class="stat"><small>Products available</small><strong>${products.length}</strong></div><div class="stat"><small>My orders</small><strong>${orders.length}</strong></div><div class="stat"><small>Cart items</small><strong>${cart.reduce((s,x)=>s+x.qty,0)}</strong></div><div class="stat"><small>Shipping</small><strong>Diffun ₱0</strong></div></div>
        <div class="panel"><div class="panel-title"><h3>Featured products</h3><button class="ghost" onclick="navigate('shop')">View shop →</button></div><div class="grid">${products.slice(0,4).map(productCard).join('') || empty('No products available yet.')}</div></div>`;
    }
  } catch(e) { page.innerHTML = `<div class="panel">Unable to load dashboard. ${esc(e.message)}</div>`; }
}

async function renderShop() {
  const page = $('page-shop');
  page.innerHTML = `<div class="loading">Loading products...</div>`;
  try {
    const all = await getProducts(true);
    const q = $('searchInput').value.trim().toLowerCase();
    const filtered = all.filter(p => !q || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q));
    const categories = [...new Set(all.map(p=>p.category).filter(Boolean))];
    page.innerHTML = `<div class="page-head"><div><h1>Shop</h1><p class="muted">Browse available products.</p></div><div class="toolbar"><select id="categoryFilter" onchange="filterShop()"><option value="">All categories</option>${categories.map(c=>`<option>${esc(c)}</option>`).join('')}</select></div></div><div id="shopGrid" class="grid">${filtered.map(productCard).join('') || empty('No products match your search.')}</div>`;
  } catch(e) { page.innerHTML = `<div class="panel">${esc(e.message)}</div>`; }
}
function filterShop() {
  const category = $('categoryFilter').value;
  const q = $('searchInput').value.trim().toLowerCase();
  const list = productsCache.filter(p => (!category || p.category === category) && (!q || `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(q)));
  $('shopGrid').innerHTML = list.map(productCard).join('') || empty('No products match your filters.');
}
function productCard(p) {
  return `<article class="product-card"><img class="product-img" src="${esc(p.image_url || placeholder)}" alt="${esc(p.name)}" onerror="this.src='${placeholder}'"><div class="product-body"><div class="category">${esc(p.category || 'Product')}</div><h3>${esc(p.name)}</h3><p>${esc(p.description || 'Available from Rujula Shop.')}</p><div class="product-bottom"><div><div class="price">${money(p.price)}</div><div class="stock">${p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</div></div><button class="primary" ${p.stock<1?'disabled':''} onclick="addToCart(${p.id})">Add</button></div></div></article>`;
}
function empty(message) { return `<div class="empty" style="grid-column:1/-1"><strong>${esc(message)}</strong><span>Try another option or check back later.</span></div>`; }

function addToCart(id) {
  const product = productsCache.find(p=>p.id===id);
  if (!product || product.stock < 1) return showToast('This product is out of stock.', 'error');
  const existing = cart.find(x=>x.id===id);
  if (existing) {
    if (existing.qty >= product.stock) return showToast('You reached the available stock.', 'error');
    existing.qty++;
  } else cart.push({id,qty:1});
  saveCart(); showToast(`${product.name} added to cart.`);
}

async function renderCart() {
  const page = $('page-cart');
  page.innerHTML = `<div class="loading">Loading cart...</div>`;
  try {
    const products = await getProducts(true);
    const map = Object.fromEntries(products.map(p=>[p.id,p]));
    cart = cart.filter(x=>map[x.id] && map[x.id].stock > 0);
    saveCart();
    const subtotal = cart.reduce((sum,x)=>sum + Number(map[x.id].price)*x.qty,0);
    page.innerHTML = `<div class="page-head"><div><h1>Your Cart</h1><p class="muted">Review your items before checkout.</p></div></div><div class="two-col"><div class="panel"><div class="panel-title"><h3>${cart.length ? `${cart.length} product${cart.length>1?'s':''}` : 'Your cart is empty'}</h3></div>${cart.length ? cart.map(x=>cartRow(x,map[x.id])).join('') : empty('Your cart is empty.')}</div><div class="panel"><div class="panel-title"><h3>Order summary</h3></div><div class="summary-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div class="summary-line"><span>Shipping</span><span class="muted">Calculated at checkout</span></div><hr><div class="summary-line total"><span>Total</span><strong>${money(subtotal)}</strong></div>${cart.length ? `<button class="primary wide" onclick="openCheckout()">Proceed to checkout</button>` : `<button class="secondary wide" onclick="navigate('shop')">Continue shopping</button>`}</div></div>`;
  } catch(e) { page.innerHTML = `<div class="panel">${esc(e.message)}</div>`; }
}
function cartRow(item,p) {
  return `<div class="cart-row"><div><strong>${esc(p.name)}</strong><div class="muted">${esc(p.category)} • ${money(p.price)} each</div></div><div class="qty"><button onclick="changeQty(${p.id},-1)">−</button><b>${item.qty}</b><button onclick="changeQty(${p.id},1)">+</button></div><div class="row-price"><strong>${money(p.price*item.qty)}</strong><button class="ghost danger-text" onclick="removeCart(${p.id})">Remove</button></div></div>`;
}
function changeQty(id,delta) { const item=cart.find(x=>x.id===id), p=productsCache.find(x=>x.id===id); if(!item||!p)return; item.qty+=delta; if(item.qty>p.stock)item.qty=p.stock; if(item.qty<1)cart=cart.filter(x=>x.id!==id); saveCart(); renderCart(); }
function removeCart(id){cart=cart.filter(x=>x.id!==id);saveCart();renderCart();}

async function openCheckout() {
  try {
    addressesCache = await api('/api/me/addresses');
    if (!addressesCache.length) {
      showToast('Please add a shipping address first.', 'error');
      navigate('profile');
      return;
    }
    const products = await getProducts(true);
    const map = Object.fromEntries(products.map(p=>[p.id,p]));
    const subtotal = cart.reduce((s,x)=>s+Number(map[x.id]?.price||0)*x.qty,0);
    $('modal').innerHTML = `<div class="modal-card"><div class="modal-head"><div><h2>Checkout</h2><p class="muted">Choose where your order should be delivered.</p></div><button class="close" onclick="closeModal()">×</button></div><label>Shipping address</label><select id="checkoutAddress">${addressesCache.map(a=>`<option value="${a.id}">${esc(a.label)} — ${esc(a.address_line)}, ${esc(a.barangay)}, ${esc(a.municipality)}, ${esc(a.province)}</option>`).join('')}</select><div class="panel" style="margin-top:18px;background:#f8fafc;box-shadow:none"><div class="summary-line"><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div class="summary-line"><span>Shipping</span><span>Calculated by seller rules</span></div><div class="summary-line total"><span>Estimated total</span><strong>${money(subtotal)}</strong></div></div><button class="primary wide" onclick="placeOrder()">Place order</button></div>`;
    $('modal').classList.remove('hidden');
  } catch(e) { showToast(e.message,'error'); }
}
function closeModal(){$('modal').classList.add('hidden');$('modal').innerHTML='';}
async function placeOrder(){
  try {
    const addressId = Number($('checkoutAddress').value);
    const result = await api('/api/orders',{method:'POST',body:{address_id:addressId,items:cart.map(x=>({product_id:x.id,quantity:x.qty}))}});
    cart=[];saveCart();productsCache=[];closeModal();showToast(`Order #${result.order_id} placed successfully!`);navigate('orders');
  } catch(e){showToast(e.message,'error');}
}

async function renderOrders(){
  const page=$('page-orders');page.innerHTML='<div class="loading">Loading orders...</div>';
  try{const orders=await api('/api/orders');page.innerHTML=`<div class="page-head"><div><h1>My Orders</h1><p class="muted">Track your Rujula Shop orders.</p></div></div>${orders.length?orders.map(orderCard).join(''):`<div class="panel">${empty('You have no orders yet.')}<button class="primary" onclick="navigate('shop')">Start shopping</button></div>`}`;}catch(e){page.innerHTML=`<div class="panel">${esc(e.message)}</div>`;}
}
function orderCard(o){return `<div class="order-card panel"><div class="panel-title"><div><h3>Order #${o.id}</h3><span class="muted">${esc(o.created_at || '')}</span></div><span class="status ${esc(o.status)}">${esc(o.status)}</span></div><div class="stats" style="margin-bottom:0"><div class="stat"><small>Subtotal</small><strong>${money(o.subtotal)}</strong></div><div class="stat"><small>Shipping</small><strong>${money(o.shipping_fee)}</strong></div><div class="stat"><small>Total</small><strong>${money(o.total)}</strong></div></div></div>`;}
function orderRow(o){return `<div style="display:flex;justify-content:space-between;gap:10px;align-items:center;padding:11px 0;border-bottom:1px solid var(--line)"><div><strong>#${o.id}</strong><div class="muted">${money(o.total)}</div></div><span class="status ${esc(o.status)}">${esc(o.status)}</span></div>`;}

async function renderProfile(){
  const page=$('page-profile');page.innerHTML='<div class="loading">Loading profile...</div>';
  try{addressesCache=await api('/api/me/addresses');page.innerHTML=`<div class="page-head"><div><h1>Profile</h1><p class="muted">Your account and shipping addresses.</p></div></div><div class="two-col"><div class="panel"><div class="panel-title"><h3>Account details</h3></div><div class="address-card"><strong>${esc(user.name)}</strong><p class="muted">${esc(user.email)}</p><p class="muted">${esc(user.phone || 'No phone number added')}</p><span class="status">${esc(user.role)}</span></div></div><div class="panel"><div class="panel-title"><h3>Shipping addresses</h3><button class="primary" onclick="openAddressForm()">+ Add</button></div>${addressesCache.map(addressCard).join('')||empty('No shipping address yet.')}</div></div>`;}catch(e){page.innerHTML=`<div class="panel">${esc(e.message)}</div>`;}
}
function addressCard(a){return `<div class="address-card"><strong>${esc(a.label)}</strong><p>${esc(a.full_name)} • ${esc(a.phone)}</p><p class="muted">${esc(a.address_line)}, ${esc(a.barangay)}, ${esc(a.municipality)}, ${esc(a.province)} ${esc(a.postal_code)}</p></div>`;}
function openAddressForm(){ $('modal').innerHTML=`<div class="modal-card"><div class="modal-head"><h2>Add shipping address</h2><button class="close" onclick="closeModal()">×</button></div><div class="form-grid"><div><label>Label</label><input id="aLabel" value="Home"></div><div><label>Full name</label><input id="aName"></div><div><label>Phone</label><input id="aPhone"></div><div><label>Barangay</label><input id="aBarangay"></div><div class="full"><label>Address line</label><input id="aLine" placeholder="House/Unit, Street"></div><div><label>Municipality</label><input id="aMunicipality" placeholder="Diffun"></div><div><label>Province</label><input id="aProvince" placeholder="Quirino"></div><div><label>Postal code</label><input id="aPostal"></div></div><button class="primary wide" onclick="saveAddress()">Save address</button></div>`;$('modal').classList.remove('hidden');}
async function saveAddress(){try{await api('/api/me/addresses',{method:'POST',body:{label:$('aLabel').value||'Home',full_name:$('aName').value,phone:$('aPhone').value,address_line:$('aLine').value,barangay:$('aBarangay').value,municipality:$('aMunicipality').value,province:$('aProvince').value,postal_code:$('aPostal').value}});closeModal();showToast('Address saved.');renderProfile();}catch(e){showToast(e.message,'error');}}

async function renderProductsAdmin(){
  if(user.role!=='seller'){navigate('dashboard');return;}
  const page=$('page-products');page.innerHTML='<div class="loading">Loading products...</div>';
  try{const ps=await getProducts(true);page.innerHTML=`<div class="page-head"><div><h1>Products</h1><p class="muted">Create, edit, and manage your catalog.</p></div><button class="primary" onclick="openProductForm()">+ Add product</button></div><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th></tr></thead><tbody>${ps.map(p=>`<tr><td><strong>${esc(p.name)}</strong></td><td>${esc(p.category)}</td><td>${money(p.price)}</td><td>${p.stock}</td><td><button class="secondary" onclick="openProductForm(${p.id})">Edit</button><button class="danger" onclick="deleteProduct(${p.id})">Delete</button></td></tr>`).join('')}</tbody></table></div></div>`;}catch(e){page.innerHTML=`<div class="panel">${esc(e.message)}</div>`;}
}
function openProductForm(id=null){const p=id?productsCache.find(x=>x.id===id):null;$('modal').innerHTML=`<div class="modal-card"><div class="modal-head"><h2>${p?'Edit product':'Add product'}</h2><button class="close" onclick="closeModal()">×</button></div><div class="form-grid"><div class="full"><label>Product name</label><input id="pName" value="${esc(p?.name||'')}"></div><div><label>Category</label><input id="pCategory" value="${esc(p?.category||'')}"></div><div><label>Price</label><input id="pPrice" type="number" step="0.01" value="${p?.price??''}"></div><div><label>Stock</label><input id="pStock" type="number" min="0" value="${p?.stock??0}"></div><div><label>Image URL</label><input id="pImage" value="${esc(p?.image_url||'')}"></div><div class="full"><label>Description</label><textarea id="pDescription">${esc(p?.description||'')}</textarea></div></div><button class="primary wide" onclick="saveProduct(${id||'null'})">${p?'Save changes':'Add product'}</button></div>`;$('modal').classList.remove('hidden');}
async function saveProduct(id){try{const body={name:$('pName').value.trim(),category:$('pCategory').value.trim(),price:Number($('pPrice').value),description:$('pDescription').value,image_url:$('pImage').value,stock:Number($('pStock').value)};if(!body.name||!body.category||body.price<0)throw Error('Please enter valid product details.');await api(id?`/api/products/${id}`:'/api/products',{method:id?'PUT':'POST',body});productsCache=[];closeModal();showToast(id?'Product updated.':'Product added.');renderProductsAdmin();}catch(e){showToast(e.message,'error');}}
async function deleteProduct(id){if(!confirm('Delete this product from the active catalog?'))return;try{await api(`/api/products/${id}`,{method:'DELETE'});productsCache=[];showToast('Product deleted.');renderProductsAdmin();}catch(e){showToast(e.message,'error');}}

async function renderSellerOrders(){
  if(user.role!=='seller'){navigate('dashboard');return;}
  const page=$('page-seller-orders');page.innerHTML='<div class="loading">Loading orders...</div>';
  try{const orders=await api('/api/seller/orders');page.innerHTML=`<div class="page-head"><div><h1>Orders</h1><p class="muted">Review customer orders and update their status.</p></div></div><div class="panel"><div class="table-wrap"><table class="table"><thead><tr><th>Order</th><th>Customer</th><th>Total</th><th>Status</th><th>Update</th></tr></thead><tbody>${orders.map(o=>`<tr><td>#${o.id}</td><td>User #${o.user_id}</td><td>${money(o.total)}</td><td><span class="status ${esc(o.status)}">${esc(o.status)}</span></td><td><select onchange="updateOrderStatus(${o.id},this.value)"><option ${o.status==='Pending'?'selected':''}>Pending</option><option ${o.status==='Confirmed'?'selected':''}>Confirmed</option><option ${o.status==='Shipped'?'selected':''}>Shipped</option><option ${o.status==='Delivered'?'selected':''}>Delivered</option><option ${o.status==='Cancelled'?'selected':''}>Cancelled</option></select></td></tr>`).join('')}</tbody></table></div></div>`;}catch(e){page.innerHTML=`<div class="panel">${esc(e.message)}</div>`;}
}
async function updateOrderStatus(id,status){try{await api(`/api/seller/orders/${id}?status=${encodeURIComponent(status)}`,{method:'PATCH'});showToast('Order status updated.');renderSellerOrders();}catch(e){showToast(e.message,'error');}}

async function renderShipping(){
  if(user.role!=='seller'){navigate('dashboard');return;}
  const page=$('page-shipping');page.innerHTML='<div class="loading">Loading shipping rules...</div>';
  try{const rules=await api('/api/shipping');page.innerHTML=`<div class="page-head"><div><h1>Shipping</h1><p class="muted">Diffun is free. Add or update fees for other municipalities.</p></div></div><div class="two-col"><div class="panel"><div class="panel-title"><h3>Add / update fee</h3></div><label>Municipality</label><input id="sMunicipality" placeholder="e.g. Aglipay"><label>Province</label><input id="sProvince" value="Quirino"><label>Shipping fee</label><input id="sFee" type="number" step="0.01" min="0"><button class="primary wide" onclick="saveShipping()">Save shipping rule</button></div><div class="panel"><div class="panel-title"><h3>Current rules</h3></div>${rules.map(r=>`<div class="address-card"><strong>${esc(r.municipality)}, ${esc(r.province)}</strong><span style="float:right;font-weight:800">${money(r.fee)}</span></div>`).join('')}</div></div>`;}catch(e){page.innerHTML=`<div class="panel">${esc(e.message)}</div>`;}
}
async function saveShipping(){try{await api('/api/shipping',{method:'POST',body:{municipality:$('sMunicipality').value.trim(),province:$('sProvince').value.trim(),fee:Number($('sFee').value)}});showToast('Shipping rule saved.');renderShipping();}catch(e){showToast(e.message,'error');}}

window.addToCart=addToCart;window.navigate=navigate;window.switchAuth=switchAuth;window.submitLogin=submitLogin;window.submitRegister=submitRegister;window.logout=logout;window.changeQty=changeQty;window.removeCart=removeCart;window.openCheckout=openCheckout;window.placeOrder=placeOrder;window.closeModal=closeModal;window.openAddressForm=openAddressForm;window.saveAddress=saveAddress;window.openProductForm=openProductForm;window.saveProduct=saveProduct;window.deleteProduct=deleteProduct;window.updateOrderStatus=updateOrderStatus;window.saveShipping=saveShipping;window.debouncedShop=debouncedShop;window.filterShop=filterShop;

saveCart();
if (token && user) startApp(); else { $('authView').classList.remove('hidden'); $('appView').classList.add('hidden'); }
