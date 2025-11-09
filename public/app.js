const api = {
  products: '/api/products',
  settings: '/api/settings',
  orders: '/api/orders',
  backupExport: '/api/backup/export',
  backupPush: '/api/backup/push',
};

const state = {
  products: [],
  cart: [],
  settings: {
    store_name: 'Pawon Ika',
    store_address: '',
    store_phone: '',
    invoice_prefix: 'INV',
    paper_width: '58',
    logo_url: '',
  },
  orders: [],
  visibleProducts: [],
};

function formatRupiah(n) {
  const v = Number(n || 0);
  return v.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 });
}

function byId(id) { return document.getElementById(id); }

async function loadSettings() {
  const res = await fetch(api.settings);
  const s = await res.json();
  Object.assign(state.settings, s);
  byId('set-store-name').value = state.settings.store_name || '';
  byId('set-store-address').value = state.settings.store_address || '';
  byId('set-store-phone').value = state.settings.store_phone || '';
  byId('set-invoice-prefix').value = state.settings.invoice_prefix || 'INV';
  byId('set-paper-width').value = state.settings.paper_width || '58';
  const prev = byId('set-logo-preview');
  if (state.settings.logo_url) {
    prev.src = state.settings.logo_url;
    prev.classList.remove('hidden');
  } else {
    prev.src = '';
    prev.classList.add('hidden');
  }
}

async function saveSettings() {
  const body = {
    store_name: byId('set-store-name').value,
    store_address: byId('set-store-address').value,
    store_phone: byId('set-store-phone').value,
    invoice_prefix: byId('set-invoice-prefix').value,
    paper_width: byId('set-paper-width').value,
  };
  await fetch(api.settings, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  await loadSettings();
}

async function loadProducts() {
  const res = await fetch(api.products);
  state.products = await res.json();
  // populate category filter
  const sel = document.getElementById('category-filter');
  if (sel) {
    const cats = Array.from(new Set(state.products.map(p => (p.category || '').trim()).filter(Boolean))).sort();
    // reset options (keep first "Semua Kategori")
    sel.innerHTML = '<option value="">Semua Kategori</option>' + cats.map(c => `<option value="${c}">${c}</option>`).join('');
  }
  renderProducts();
}

function renderProducts(filter = '') {
  const list = byId('product-list');
  const tbody = byId('prod-tbody');
  const f = filter.toLowerCase();
  const catSel = document.getElementById('category-filter');
  const cat = catSel ? (catSel.value || '') : '';
  const items = state.products.filter(p => p.name.toLowerCase().includes(f) && (!cat || (p.category || '') === cat));
  state.visibleProducts = items;
  list.innerHTML = items.map((p, idx) => `
    <button class="text-left bg-white border rounded-lg p-3 hover:shadow-sm transition flex flex-col gap-1 relative" data-act="add-to-cart" data-id="${p.id}" data-idx="${idx}">
      <div class="flex items-start justify-between gap-2">
        <div class="font-medium leading-tight">${p.name}</div>
        <span class="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 border text-gray-700 whitespace-nowrap">${formatRupiah(p.price)}</span>
      </div>
      ${(p.category||p.unit) ? `<div class="text-xs text-gray-500">${[p.category||'', p.unit||''].filter(Boolean).join(' · ')}</div>` : ''}
      ${idx < 9 ? `<div class="absolute -top-2 -left-2 bg-indigo-600 text-white text-[10px] rounded-full w-5 h-5 grid place-items-center">${idx+1}</div>` : ''}
    </button>
  `).join('');
  tbody.innerHTML = state.products.map(p => `
    <tr class="border-b">
      <td class="py-2">${p.name}</td>
      <td class="text-right">${formatRupiah(p.price)}</td>
      <td>${p.unit || ''}</td>
      <td>${p.category || ''}</td>
      <td class="text-right">
        <button class="text-indigo-600" data-act="edit-prod" data-id="${p.id}">Ubah</button>
        <span class="mx-1">·</span>
        <button class="text-red-600" data-act="del-prod" data-id="${p.id}">Hapus</button>
      </td>
    </tr>
  `).join('');
}

function addToCart(item) {
  const existing = state.cart.find(c => c.name === item.name && Number(c.price) === Number(item.price));
  if (existing) existing.qty += 1; else state.cart.push({ ...item, qty: 1 });
  renderCart();
}

function renderCart() {
  const wrap = byId('cart');
  let subtotal = 0;
  wrap.innerHTML = state.cart.map((c, idx) => {
    const sub = c.qty * c.price; subtotal += sub;
    return `
      <div class="flex items-center justify-between gap-2">
        <div class="text-sm">
          <div class="font-medium">${c.name}</div>
          <div class="text-gray-600">${c.qty} × ${formatRupiah(c.price)}</div>
        </div>
        <div class="flex items-center gap-2">
          <button data-act="dec" data-idx="${idx}" class="px-2 border rounded">-</button>
          <button data-act="inc" data-idx="${idx}" class="px-2 border rounded">+</button>
          <button data-act="rm" data-idx="${idx}" class="px-2 border rounded text-red-600">x</button>
          <div class="w-20 text-right">${formatRupiah(sub)}</div>
        </div>
      </div>
    `;
  }).join('');
  byId('subtotal').textContent = formatRupiah(subtotal);
  const discount = Number(byId('discount').value || 0);
  const tax = Number(byId('tax').value || 0);
  const total = Math.max(0, Math.round(subtotal - discount + tax));
  byId('total').textContent = formatRupiah(total);
  const mbar = document.getElementById('mobile-bar');
  const mtotal = document.getElementById('mobile-total');
  if (mtotal) mtotal.textContent = formatRupiah(total);
  if (mbar) mbar.style.display = state.cart.length > 0 ? 'block' : 'none';
}

function resetCart() {
  state.cart = [];
  byId('discount').value = 0;
  byId('tax').value = 0;
  byId('customer_name').value = '';
  byId('payment_method').value = 'CASH';
  byId('paid_amount').value = '';
  byId('note').value = '';
  renderCart();
}

async function checkout() {
  if (state.cart.length === 0) return alert('Keranjang kosong');
  const items = state.cart.map(c => ({ name: c.name, price: Number(c.price), qty: Number(c.qty), product_id: c.id || null }));
  const body = {
    items,
    discount: Number(byId('discount').value || 0),
    tax: Number(byId('tax').value || 0),
    payment_method: byId('payment_method').value,
    paid_amount: Number(byId('paid_amount').value || 0),
    customer_name: byId('customer_name').value,
    note: byId('note').value,
  };
  const res = await fetch(api.orders, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) return alert('Gagal menyimpan transaksi');
  const data = await res.json();
  printReceipt(data.order, data.items);
  resetCart();
}

function printReceipt(order, items) {
  const s = state.settings;
  const width = (s.paper_width || '58') === '80' ? 80 : 58; // mm
  const wpx = Math.round(width * 3.78); // mm to px approx
  const win = window.open('', 'PRINT', `width=${wpx},height=800`);
  const styles = `
    <style>
      @media print { @page { size: ${width}mm auto; margin: 4mm; } }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#000; font-variant-numeric: tabular-nums; -webkit-font-smoothing: none; }
      .wrap { width: ${width}mm; }
      .center { text-align:center }
      .right { text-align:right }
      .sep { border-top: 1px solid #000; margin: 6px 0; }
      table { width:100%; border-collapse: collapse; }
      td { vertical-align: top; font-size: 12px; }
      .small { font-size: 11px; }
      .total { font-weight: 700; }
      .twocol { table-layout: fixed; }
      .twocol col:first-child { width: 60%; }
      .twocol col:last-child { width: 40%; }
    </style>
  `;
  const header = `
    <div class="center">
      ${s.logo_url ? `<div style=\"margin-bottom:6px\"><img src=\"${s.logo_url}\" style=\"max-height:60px; display:block; margin:0 auto;\"/></div>` : ''}
      <div style="font-weight:700">${s.store_name || 'Pawon Ika'}</div>
      ${s.store_address ? `<div class="small">${s.store_address}</div>` : ''}
      ${s.store_phone ? `<div class="small">Telp/WA: ${s.store_phone}</div>` : ''}
    </div>
  `;
  const meta = `
    <div class="small">No: ${order.invoice_no}<br/>Tanggal: ${new Date(order.created_at).toLocaleString('id-ID')}</div>
    ${order.customer_name ? `<div class="small">Pelanggan: ${order.customer_name}</div>` : ''}
  `;
  const rows = items.map(it => `
    <tr>
      <td>${it.name}<br/><span class="small">${it.qty} x ${formatRupiah(it.price)}</span></td>
      <td class="right" style="white-space:nowrap">${formatRupiah(it.subtotal)}</td>
    </tr>
  `).join('');
  const totals = `
    <div class="sep"></div>
    <table class="twocol">
      <col/><col/>
      <tr><td>Subtotal</td><td class="right" style="white-space:nowrap">${formatRupiah(order.subtotal)}</td></tr>
      ${order.discount ? `<tr><td>Diskon</td><td class="right" style="white-space:nowrap">-${formatRupiah(order.discount)}</td></tr>` : ''}
      ${order.tax ? `<tr><td>Pajak</td><td class="right" style="white-space:nowrap">${formatRupiah(order.tax)}</td></tr>` : ''}
      <tr><td class="total">Total</td><td class="right total" style="white-space:nowrap">${formatRupiah(order.total)}</td></tr>
      <tr><td>Bayar (${order.payment_method})</td><td class="right" style="white-space:nowrap">${formatRupiah(order.paid_amount)}</td></tr>
      <tr><td>Kembali</td><td class="right" style="white-space:nowrap">${formatRupiah(order.paid_amount - order.total)}</td></tr>
    </table>
    <div class="center small" style="margin-top:8px">Terima kasih telah berbelanja!</div>
  `;
  win.document.write(`
    <html><head><title>${order.invoice_no}</title>${styles}</head>
    <body onload="window.print(); setTimeout(()=>window.close(), 300)">
      <div class="wrap">
        ${header}
        <div class="sep"></div>
        ${meta}
        <div class="sep"></div>
        <table class="twocol"><col/><col/>${rows}</table>
        ${totals}
      </div>
    </body></html>
  `);
  win.document.close();
  win.focus();
}

async function loadOrders() {
  const res = await fetch('/api/orders');
  const rows = await res.json();
  state.orders = Array.isArray(rows) ? rows : [];
  const tbody = byId('orders-tbody');
  tbody.innerHTML = state.orders.map(o => `
    <tr class="border-b">
      <td class="py-2">${o.created_at ? new Date(o.created_at).toLocaleString('id-ID') : ''}</td>
      <td>${o.invoice_no || ''}</td>
      <td>${o.customer_name || ''}</td>
      <td class="text-right">${formatRupiah(o.total || 0)}</td>
      <td>${o.payment_method || ''}</td>
      <td class="text-right flex gap-2 justify-end">
        <button data-act="reprint" data-id="${o.id}" class="text-indigo-600">Cetak</button>
        <button data-act="png" data-id="${o.id}" class="text-emerald-600">PNG</button>
        <button data-act="pdf" data-id="${o.id}" class="text-rose-600">PDF</button>
        <button data-act="edit" data-id="${o.id}" class="text-gray-700">Edit</button>
        <button data-act="del" data-id="${o.id}" class="text-red-600">Hapus</button>
      </td>
    </tr>
  `).join('');
}

async function reprintOrder(id) {
  const res = await fetch(`/api/orders/${id}`);
  if (!res.ok) return alert('Order tidak ditemukan');
  const data = await res.json();
  printReceipt(data.order, data.items);
}

function buildReceiptElement(order, items) {
  const s = state.settings;
  const width = (s.paper_width || '58') === '80' ? 80 : 58; // mm
  const el = document.createElement('div');
  el.style.width = width + 'mm';
  el.style.padding = '4mm';
  el.style.background = '#fff';
  el.style.color = '#000';
  el.style.fontVariantNumeric = 'tabular-nums';
  el.style.boxSizing = 'border-box';
  el.innerHTML = `
    <div style="text-align:center">
      ${s.logo_url ? `<div style="margin-bottom:6px; display:flex; justify-content:center; width:100%"><img src="${s.logo_url}" style="max-height:60px; display:block;" crossorigin="anonymous"/></div>` : ''}
      <div style="font-weight:700">${s.store_name || 'Pawon Ika'}</div>
      ${s.store_address ? `<div style="font-size:11px">${s.store_address}</div>` : ''}
      ${s.store_phone ? `<div style="font-size:11px">Telp/WA: ${s.store_phone}</div>` : ''}
    </div>
    <div style="border-top:1px solid #000; margin:6px 0"></div>
    <div style="font-size:11px">No: ${order.invoice_no}<br/>Tanggal: ${new Date(order.created_at).toLocaleString('id-ID')}</div>
    ${order.customer_name ? `<div style="font-size:11px">Pelanggan: ${order.customer_name}</div>` : ''}
    <div style="border-top:1px solid #000; margin:6px 0"></div>
    <table style="width:100%; border-collapse:collapse; table-layout:fixed">
      <col style="width:60%"/><col style="width:40%"/>
      ${items.map(it => `
        <tr>
          <td style="vertical-align:top; font-size:12px">${it.name}<br/><span style="font-size:11px">${it.qty} x ${formatRupiah(it.price)}</span></td>
          <td style="vertical-align:top; text-align:right; font-size:12px; white-space:nowrap">${formatRupiah(it.subtotal)}</td>
        </tr>
      `).join('')}
    </table>
    <div style="border-top:1px solid #000; margin:6px 0"></div>
    <table style="width:100%; table-layout:fixed">
      <col style="width:60%"/><col style="width:40%"/>
      <tr><td>Subtotal</td><td style="text-align:right; white-space:nowrap">${formatRupiah(order.subtotal)}</td></tr>
      ${order.discount ? `<tr><td>Diskon</td><td style="text-align:right; white-space:nowrap">-${formatRupiah(order.discount)}</td></tr>` : ''}
      ${order.tax ? `<tr><td>Pajak</td><td style="text-align:right; white-space:nowrap">${formatRupiah(order.tax)}</td></tr>` : ''}
      <tr><td style="font-weight:700">Total</td><td style="text-align:right; font-weight:700; white-space:nowrap">${formatRupiah(order.total)}</td></tr>
      <tr><td>Bayar (${order.payment_method})</td><td style="text-align:right; white-space:nowrap">${formatRupiah(order.paid_amount)}</td></tr>
      <tr><td>Kembali</td><td style="text-align:right; white-space:nowrap">${formatRupiah(order.paid_amount - order.total)}</td></tr>
    </table>
    <div style="text-align:center; font-size:11px; margin-top:8px">Terima kasih telah berbelanja!</div>
  `;
  return el;
}

async function exportReceipt(id, type) {
  const res = await fetch(`/api/orders/${id}`);
  if (!res.ok) return alert('Order tidak ditemukan');
  const data = await res.json();
  const el = buildReceiptElement(data.order, data.items);
  // offscreen container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.background = '#fff';
  container.appendChild(el);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(el, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const filename = `${data.order.invoice_no}.${type === 'png' ? 'png' : 'pdf'}`;
    if (type === 'png') {
      const a = document.createElement('a');
      a.href = imgData;
      a.download = filename;
      a.click();
    } else {
      const s = state.settings;
      const widthMm = (s.paper_width || '58') === '80' ? 80 : 58;
      // precise px-per-mm using a probe element
      const probe = document.createElement('div');
      probe.style.width = '1mm';
      probe.style.height = '1mm';
      probe.style.position = 'absolute';
      probe.style.left = '-10000px';
      document.body.appendChild(probe);
      const pxPerMm = probe.getBoundingClientRect().width || (canvas.width / el.offsetWidth);
      document.body.removeChild(probe);
      const heightMm = Math.max(10, Math.round((canvas.height / pxPerMm) * 100) / 100);
      const { jsPDF } = window.jspdf;
      // No extra padding: fit image exactly to page
      const pdf = new jsPDF({ unit: 'mm', format: [widthMm, heightMm] });
      const x = 0, y = 0, w = widthMm, h = (canvas.height * w) / canvas.width;
      pdf.addImage(imgData, 'PNG', x, y, w, h, undefined, 'FAST');
      pdf.save(filename);
    }
  } catch (e) {
    alert('Gagal membuat file: ' + e.message);
  } finally {
    document.body.removeChild(container);
  }
}

function setupTabs() {
  const buttons = document.querySelectorAll('nav [data-tab]');
  const sections = {
    pos: byId('tab-pos'),
    products: byId('tab-products'),
    orders: byId('tab-orders')
  };
  buttons.forEach(btn => btn.addEventListener('click', () => {
    buttons.forEach(b => {
      b.classList.remove('tab-active');
      b.classList.remove('text-gray-900','border-indigo-600');
      b.classList.add('text-gray-600','border-transparent');
    });
    btn.classList.add('tab-active','text-gray-900','border-indigo-600');
    btn.classList.remove('text-gray-600','border-transparent');
    const tab = btn.getAttribute('data-tab');
    Object.entries(sections).forEach(([k, el]) => {
      el.classList.toggle('hidden', k !== tab);
    });
    if (tab === 'orders') loadOrders();
  }));
  if (buttons[0]) {
    buttons[0].classList.add('tab-active','text-gray-900','border-indigo-600');
    buttons[0].classList.remove('text-gray-600','border-transparent');
  }
}

function setupEvents() {
  // product search
  byId('search').addEventListener('input', (e) => renderProducts(e.target.value));
  const catSel = document.getElementById('category-filter');
  if (catSel) catSel.addEventListener('change', () => renderProducts(byId('search').value || ''));

  // add manual item
  byId('btn-add-custom').addEventListener('click', () => {
    const name = prompt('Nama item');
    if (!name) return;
    const price = Number(prompt('Harga satuan (angka)') || '0');
    addToCart({ name, price });
  });

  // product grid click
  byId('product-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="add-to-cart"]');
    if (!btn) return;
    const id = Number(btn.getAttribute('data-id'));
    const p = state.products.find(x => x.id === id);
    if (p) addToCart(p);
  });

  // quick keys 1-9 to add visible product when POS tab active
  document.addEventListener('keydown', (e) => {
    // ignore when typing in inputs/textareas/selects or modal open
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if (['INPUT','TEXTAREA','SELECT'].includes(tag)) return;
    const posTab = document.getElementById('tab-pos');
    if (!posTab || posTab.classList.contains('hidden')) return;
    if (e.key >= '1' && e.key <= '9') {
      const idx = Number(e.key) - 1;
      const item = state.visibleProducts[idx];
      if (item) { addToCart(item); }
    }
  });

  // cart events
  byId('cart').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const idx = Number(btn.getAttribute('data-idx'));
    const act = btn.getAttribute('data-act');
    if (act === 'inc') state.cart[idx].qty += 1;
    else if (act === 'dec') { state.cart[idx].qty -= 1; if (state.cart[idx].qty <= 0) state.cart.splice(idx,1); }
    else if (act === 'rm') state.cart.splice(idx,1);
    renderCart();
  });

  byId('discount').addEventListener('input', renderCart);
  byId('tax').addEventListener('input', renderCart);

  byId('btn-checkout').addEventListener('click', checkout);

  // products add
  byId('prod-add').addEventListener('click', async () => {
    const name = byId('prod-name').value.trim();
    const price = Number(byId('prod-price').value || 0);
    const unit = byId('prod-unit').value.trim();
    const category = byId('prod-category').value.trim();
    if (!name) return alert('Nama wajib');
    const res = await fetch(api.products, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, unit, category }) });
    if (!res.ok) return alert('Gagal menambah produk');
    byId('prod-name').value = '';
    byId('prod-price').value = '';
    byId('prod-unit').value = '';
    byId('prod-category').value = '';
    await loadProducts();
  });

  // products table actions
  byId('tab-products').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.getAttribute('data-id'));
    const act = btn.getAttribute('data-act');
    const prod = state.products.find(p => p.id === id);
    if (!prod) return;
    if (act === 'del-prod') {
      if (!confirm('Hapus produk?')) return;
      await fetch(`${api.products}/${id}`, { method: 'DELETE' });
      await loadProducts();
    } else if (act === 'edit-prod') {
      const name = prompt('Nama', prod.name) || prod.name;
      const price = Number(prompt('Harga', String(prod.price)) || prod.price);
      const unit = prompt('Satuan', prod.unit || '') || '';
      const category = prompt('Kategori', prod.category || '') || '';
      await fetch(`${api.products}/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, price, unit, category }) });
      await loadProducts();
    }
  });

  // orders actions
  byId('tab-orders').addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = Number(btn.getAttribute('data-id'));
    const act = btn.getAttribute('data-act');
    if (act === 'reprint') await reprintOrder(id);
    else if (act === 'png') await exportReceipt(id, 'png');
    else if (act === 'pdf') await exportReceipt(id, 'pdf');
    else if (act === 'edit') await openOrderModal(id);
    else if (act === 'del') await deleteOrder(id);
  });

async function openOrderModal(id) {
  const res = await fetch(`/api/orders/${id}`);
  if (!res.ok) return alert('Order tidak ditemukan');
  const data = await res.json();
  const m = byId('order-modal');
  if (!m) { alert('Komponen modal tidak ditemukan di halaman'); return; }
  m.dataset.id = String(id);
  byId('ord-customer').value = data.order.customer_name || '';
  byId('ord-method').value = data.order.payment_method || 'CASH';
  byId('ord-discount').value = data.order.discount || 0;
  byId('ord-tax').value = data.order.tax || 0;
  byId('ord-paid').value = data.order.paid_amount || 0;
  byId('ord-note').value = data.order.note || '';
  m.classList.remove('hidden');
  m.classList.add('flex');
}

async function saveOrderModal() {
  const m = byId('order-modal');
  const id = Number(m.dataset.id);
  const body = {
    customer_name: byId('ord-customer').value,
    payment_method: byId('ord-method').value,
    discount: Number(byId('ord-discount').value || 0),
    tax: Number(byId('ord-tax').value || 0),
    paid_amount: Number(byId('ord-paid').value || 0),
    note: byId('ord-note').value,
  };
  const res = await fetch(`/api/orders/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) return alert('Gagal menyimpan perubahan');
  m.classList.add('hidden');
  m.classList.remove('flex');
  await loadOrders();
}

async function deleteOrder(id) {
  if (!confirm('Hapus transaksi ini?')) return;
  const res = await fetch(`/api/orders/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const txt = await res.text().catch(()=> '');
    return alert('Gagal menghapus: ' + (txt || res.status + ' ' + res.statusText));
  }
  await loadOrders();
}

  // settings modal
  byId('btn-open-settings').addEventListener('click', async () => {
    await loadSettings();
    byId('settings-modal').classList.remove('hidden');
    byId('settings-modal').classList.add('flex');
  });
  byId('btn-close-settings').addEventListener('click', () => {
    byId('settings-modal').classList.add('hidden');
    byId('settings-modal').classList.remove('flex');
  });
  byId('btn-save-settings').addEventListener('click', async () => {
    await saveSettings();
    byId('settings-modal').classList.add('hidden');
    byId('settings-modal').classList.remove('flex');
  });

  // upload logo
  byId('set-logo-file').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    const res = await fetch('/api/upload/logo', { method: 'POST', body: fd });
    if (!res.ok) { alert('Gagal upload logo'); return; }
    await loadSettings();
  });

  // backup export download
  byId('btn-export').addEventListener('click', async () => {
    const res = await fetch(api.backupExport);
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ts = new Date().toISOString().replace(/[:.]/g,'-');
    a.download = `backup-pawonika-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // mobile checkout button mirrors main checkout
  const mbtn = document.getElementById('mobile-checkout');
  if (mbtn) mbtn.addEventListener('click', checkout);

  // order modal buttons
  const ordCancel = document.getElementById('ord-cancel');
  if (ordCancel) ordCancel.addEventListener('click', () => {
    const m = document.getElementById('order-modal');
    if (m) { m.classList.add('hidden'); m.classList.remove('flex'); }
  });
  const ordSave = document.getElementById('ord-save');
  if (ordSave) ordSave.addEventListener('click', saveOrderModal);
}

async function bootstrap() {
  setupTabs();
  setupEvents();
  await loadSettings();
  await loadProducts();
  renderCart();
}

bootstrap();
