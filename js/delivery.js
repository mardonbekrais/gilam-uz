// =================== DELIVERY LOGIC ===================
let orders = [];
let productCatalog = [];
let currentFilter = 'all';
let currentOrder = null;
let refinedProducts = [];
let PRICE_PER_SQM = 20000;

document.addEventListener('DOMContentLoaded', function() {
    updateDateTime();
    loadInitialData();
    startAutoRefresh();
});

function loadInitialData() {
    // 1. Global narxni yuklash
    supabaseFetch('GET', 'settings?key=eq.global_price', null, function(err, data) {
        if (!err && data && data.length > 0) {
            PRICE_PER_SQM = parseFloat(data[0].value) || 20000;
        }
    });

    // 2. Mahsulotlar katalogini yuklash
    supabaseFetch('GET', 'products?select=*&order=created_at.asc', null, function(err, data) {
        if (!err && data) {
            productCatalog = data;
        }
    });

    // 3. Orderlarni yuklash
    loadOrders();
}

function loadOrders() {
    supabaseFetch('GET', 'orders?select=*&order=created_at.desc', null, function(err, data) {
        if (err) { showToast('❗ Xato: ' + err, 'error'); hideLoading(); return; }
        orders = data.map(mapOrder);
        updateUI();
        hideLoading();
    });
}

function updateUI() {
    updateStats();
    displayOrders();
}

function updateStats() {
    const kutil = orders.filter(o => o.status === 'new' || o.status === 'queue').length;
    const yuvil = orders.filter(o => o.status === 'washing').length;
    const tayyor = orders.filter(o => o.status === 'ready').length;

    document.getElementById('stat-kutilmoqda').textContent = kutil;
    document.getElementById('stat-yuvilmoqda').textContent = yuvil;
    document.getElementById('stat-tayyor').textContent = tayyor;
}

function displayOrders() {
    const container = document.getElementById('ordersList');
    if (!container) return;
    
    let filtered = orders;
    if (currentFilter === 'all') filtered = orders.filter(o => o.status === 'done');
    else if (currentFilter === 'new') filtered = orders.filter(o => o.status === 'new' || o.status === 'queue');
    else if (currentFilter === 'washing') filtered = orders.filter(o => o.status === 'washing');
    else if (currentFilter === 'ready') filtered = orders.filter(o => o.status === 'ready');
    else if (currentFilter === 'done') filtered = orders.filter(o => o.status === 'done');

    container.innerHTML = filtered.length ? '' : '<p class="empty-state">Buyurtmalar topilmadi</p>';
    filtered.forEach(order => {
        const sc = STATUS_CFG[order.status] || STATUS_CFG.new;
        const hasGPS = order.gpsCoords && String(order.gpsCoords).length > 5;
        
        const div = document.createElement('div');
        div.className = `order-card status-${order.status}`;
        div.innerHTML = `
            <div class="order-header">
                <span class="order-id">#${order.displayId} ${hasGPS ? '<i class="fas fa-location-dot" style="color:var(--primary); font-size:10px;" title="GPS bor"></i>' : ''}</span>
                <span class="order-status-pill" style="background:${sc.bg};color:${sc.color};padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">
                    ${sc.emoji} ${sc.label}
                </span>
            </div>
            <div class="order-phone">👤 ${order.customerName || 'Noma\'lum'}</div>
            <div class="order-phone">📞 ${order.phone}</div>
            <div style="font-size:11px; color:var(--gray); margin-top:5px;"><i class="far fa-clock"></i> ${formatDateTime(order.createdAt)}</div>
            <div class="order-details">📍 ${order.location}</div>
        `;
        div.onclick = () => openDeliveryDetails(order);
        container.appendChild(div);
    });
}

function startRefining(order) {
    currentOrder = order;
    refinedProducts = order.productItems || [];
    switchPage('refine');
    
    const header = document.getElementById('refine-header');
    header.innerHTML = `
        <div style="font-weight:800; font-size:20px;">#${order.displayId} - ${order.customerName}</div>
        <div style="font-size:14px; opacity:0.8;">📍 ${order.location} | 📞 ${order.phone}</div>
    `;
    
    document.getElementById('refine-gps').value = order.gpsCoords || '';
    renderProducts();
}

function openAddProduct() {
    const container = document.getElementById('dynamic-product-buttons');
    if (!container) return;
    
    container.innerHTML = '';
    productCatalog.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'action-btn';
        btn.innerHTML = `<span>${p.emoji} ${p.name}</span>`;
        btn.onclick = () => addProduct(p.name, p.emoji, p.price);
        container.appendChild(btn);
    });
    
    document.getElementById('productModal').classList.add('show');
}

function addProduct(name, emoji, price) {
    const basePrice = price || PRICE_PER_SQM;
    refinedProducts.push({ name, emoji, count: 1, area: 0, pricePerSqm: basePrice });
    renderProducts();
    closeModal('productModal');
}

function addOtherProduct() {
    const name = document.getElementById('other-name').value.trim();
    if (!name) return;
    addProduct(name, '📦', PRICE_PER_SQM);
    document.getElementById('other-name').value = '';
}

function renderProducts() {
    const container = document.getElementById('productList');
    container.innerHTML = '';
    
    refinedProducts.forEach((p, idx) => {
        const currentPricePerSqm = p.pricePerSqm || PRICE_PER_SQM;
        const row = document.createElement('div');
        row.className = 'product-item-row';
        row.innerHTML = `
            <span style="font-size:24px;">${p.emoji || '📦'}</span>
            <div class="p-name">${p.name}</div>
            <div class="p-input-group">
                <label>Soni</label>
                <input type="number" value="${p.count || 1}" oninput="updateProduct(${idx}, 'count', this.value)">
            </div>
            <div class="p-input-group">
                <label>Kv/Metr</label>
                <input type="number" value="${p.area || 0}" step="0.1" oninput="updateProduct(${idx}, 'area', this.value)">
            </div>
            <div class="p-input-group">
                <label>Narxi</label>
                <input type="number" value="${currentPricePerSqm}" oninput="updateProduct(${idx}, 'pricePerSqm', this.value)">
            </div>
            <button class="close-btn" style="width:30px;height:30px;font-size:14px; margin-top:15px;" onclick="removeProduct(${idx})">✕</button>
        `;
        container.appendChild(row);
    });
    updateTotals();
}

function updateTotals() {
    let totalArea = 0;
    let totalPrice = 0;
    let totalCount = 0;
    
    refinedProducts.forEach((p) => {
        const currentPricePerSqm = p.pricePerSqm || PRICE_PER_SQM;
        totalCount += parseFloat(p.count || 0);
        totalArea += parseFloat(p.area || 0);
        totalPrice += (parseFloat(p.area) || 0) * (parseFloat(p.pricePerSqm) || PRICE_PER_SQM);
    });
    
    document.getElementById('total-count').textContent = totalCount + ' ta';
    document.getElementById('total-area').textContent = totalArea.toFixed(1) + ' m²';
    document.getElementById('total-price').textContent = formatMoney(totalPrice);
}

function updateProduct(idx, field, val) {
    refinedProducts[idx][field] = parseFloat(val) || 0;
    updateTotals(); // Only update totals, don't re-render list to keep focus
}

function removeProduct(idx) {
    refinedProducts.splice(idx, 1);
    renderProducts(); // Re-render required when item removed
}

function getGPS() {
    if (!navigator.geolocation) { showToast('❌ GPS qo\'llanilmadi', 'error'); return; }
    showToast('⌛ Lokatsiya olinmoqda...', 'info');
    navigator.geolocation.getCurrentPosition(pos => {
        const coords = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`;
        document.getElementById('refine-gps').value = coords;
        showToast('✅ Lokatsiya olingandi', 'success');
    }, err => {
        showToast('❌ GPS xatosi: ' + err.message, 'error');
    });
}

function saveRefinedOrder() {
    if (refinedProducts.length === 0) { showToast('❌ Kamida bitta mahsulot qo\'shing', 'error'); return; }
    
    const totalArea = refinedProducts.reduce((s, p) => s + (p.area || 0), 0);
    const totalPrice = refinedProducts.reduce((s, p) => s + (p.area || 0) * (p.pricePerSqm || PRICE_PER_SQM), 0);
    const gps = document.getElementById('refine-gps').value;

    const data = {
        product_items: JSON.stringify(refinedProducts),
        total_area: totalArea,
        price: totalPrice,
        gps_coords: gps,
        status: 'washing'
    };

    supabaseFetch('PATCH', `orders?id=eq.${currentOrder.id}`, data, err => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('✅ Saqlandi va Yuvishga yuborildi!', 'success');
        switchPage('home');
        loadOrders();
    });
}

function openDeliveryDetails(order) {
    const modal = document.getElementById('detailsModal');
    const content = document.getElementById('detailsContent');
    const sc = STATUS_CFG[order.status] || STATUS_CFG.new;
    const hasGPS = order.gpsCoords && String(order.gpsCoords).length > 5;

    content.innerHTML = `
        <div class="det-header-card" style="background:${sc.bg};color:${sc.color};padding:20px;border-radius:20px;margin-bottom:20px;">
            <div style="font-size:22px;font-weight:800;">#${order.displayId} - ${sc.label}</div>
            <div style="font-weight:600;margin-top:5px; font-size:18px;">👤 ${order.customerName}</div>
            <div style="font-weight:700;color:var(--primary); font-size:16px;">📞 ${order.phone}</div>
        </div>
        <div class="det-info-grid">
            <div class="det-info-card" style="grid-column: 1/-1;">
                <div class="det-info-label">📍 Manzil</div>
                <div class="det-info-val" style="font-size:16px;">${order.location}</div>
            </div>
            <div class="det-info-card" style="grid-column: 1/-1;">
                <div class="det-info-label">📅 Qabul qilingan vaqt</div>
                <div class="det-info-val" style="font-size:14px;">${formatDateTime(order.createdAt)}</div>
            </div>
            ${hasGPS ? `
            <div class="det-info-card" style="grid-column: 1/-1; background:#e3f2fd;">
                <div class="det-info-label">🌍 GPS Koordinatalar</div>
                <div class="det-info-val" style="font-size:12px; color:#1976d2;">${order.gpsCoords}</div>
            </div>` : ''}
            <div class="det-info-card">
                <div class="det-info-label">💰 Summa</div>
                <div class="det-info-val" style="color:var(--success); font-size:18px;">${formatMoney(order.price)}</div>
            </div>
            <div class="det-info-card">
                <div class="det-info-label">📏 Umumiy Kv</div>
                <div class="det-info-val">${order.totalArea} m²</div>
            </div>
        </div>
        <div style="margin-top:20px; padding:15px; background:var(--light-secondary); border-radius:15px;">
            <div style="font-weight:700; margin-bottom:10px; color:var(--primary);">📦 Mahsulotlar:</div>
            ${(order.productItems || []).map(p => `
                <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:14px; border-bottom:1px solid #ddd; padding-bottom:4px;">
                    <span>${p.emoji || '📦'} ${p.name} (${p.count} ta)</span>
                    <strong>${p.area} m²</strong>
                </div>
            `).join('')}
        </div>
    `;

    const nav = document.getElementById('detailsNavigation');
    nav.innerHTML = '';
    
    // Call button
    const callBtn = document.createElement('button');
    callBtn.className = 'det-nav-btn det-nav-call';
    callBtn.innerHTML = '<i class="fas fa-phone"></i>';
    callBtn.onclick = () => window.location.href = `tel:${order.phone}`;
    nav.appendChild(callBtn);

    // Route button (ONLY if GPS exists)
    if (hasGPS) {
        const routeBtn = document.createElement('button');
        routeBtn.className = 'det-nav-btn det-nav-route';
        routeBtn.innerHTML = '<i class="fas fa-route"></i> Yo\'lga chiqish';
        routeBtn.onclick = () => {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.gpsCoords}`, '_blank');
        };
        nav.appendChild(routeBtn);
    }

    // Refine button (if new or queue)
    if (order.status === 'new' || order.status === 'queue') {
        const refBtn = document.createElement('button');
        refBtn.className = 'det-nav-btn';
        refBtn.style.background = 'var(--warning)';
        refBtn.innerHTML = '<i class="fas fa-edit"></i> Aniqlashtirish';
        refBtn.onclick = () => { closeDetailsModal(); startRefining(order); };
        nav.appendChild(refBtn);
    }

    // Washing -> Ready button
    if (order.status === 'washing') {
        const readyBtn = document.createElement('button');
        readyBtn.className = 'det-nav-btn';
        readyBtn.style.background = 'var(--info)';
        readyBtn.innerHTML = '<i class="fas fa-check"></i> Tayyor bo\'ldi';
        readyBtn.onclick = () => updateOrderStatus(order.id, 'ready');
        nav.appendChild(readyBtn);
    }

    // Ready -> Done button
    if (order.status === 'ready') {
        const doneBtn = document.createElement('button');
        doneBtn.className = 'det-nav-btn';
        doneBtn.style.background = 'var(--success)';
        doneBtn.innerHTML = '<i class="fas fa-truck"></i> Yetkazildi';
        doneBtn.onclick = () => markAsDone(order.id);
        nav.appendChild(doneBtn);
    }

    modal.classList.add('show');
}

function updateOrderStatus(id, newStatus) {
    const order = orders.find(o => o.id == id);
    if (order.status === 'done') {
        showToast('❌ Yetgazildi holatidagi buyurtmalarni o\'zgartirb bo\'lmaydi', 'error');
        return;
    }
    if (!confirm('Holatni o\'zgartirmoqchimisiz?')) return;
    supabaseFetch('PATCH', `orders?id=eq.${id}`, { status: newStatus }, err => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('✅ Holat yangilandi!', 'success');
        closeDetailsModal();
        loadOrders();
    });
}

function markAsDone(id) {
    const order = orders.find(o => o.id == id);
    if (order.status === 'done') {
        showToast('❌ Ushbu buyurtma allaqachon yetkazilgan', 'error');
        return;
    }
    if (!confirm('Buyurtma yetkazildimi?')) return;
    supabaseFetch('PATCH', `orders?id=eq.${id}`, { status: 'done' }, err => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('✅ Buyurtma yakunlandi!', 'success');
        closeDetailsModal();
        loadOrders();
    });
}

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}Page`).classList.add('active');
}
function setFilter(btn, filter) {
    currentFilter = filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    displayOrders();
}
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
function closeDetailsModal() { document.getElementById('detailsModal').classList.remove('show'); }
function hideLoading() { document.getElementById('loadingScreen').classList.add('hide'); }
function updateDateTime() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' });
}
function startAutoRefresh() { setInterval(loadOrders, 20000); }
