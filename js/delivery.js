// =================== DELIVERY LOGIC ===================
let orders = [];
let productCatalog = [];
let currentFilter = 'all';
let currentOrder = null;
let refinedProducts = [];
let PRICE_PER_SQM = 20000;

// State for the product being added in the modal
let activeProduct = null;
let activeCounters = { s: 0, m: 0, l: 0, kg: 0 };
let activeSqmItems = [];

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
    loadProductCatalog();

    // 3. Orderlarni yuklash
    loadOrders();
}

function loadProductCatalog() {
    supabaseFetch('GET', 'products?select=*&order=created_at.asc', null, function(err, data) {
        if (!err && data) {
            productCatalog = data;
        }
    });
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

    const elK = document.getElementById('stat-kutilmoqda');
    const elY = document.getElementById('stat-yuvilmoqda');
    const elT = document.getElementById('stat-tayyor');
    
    if (elK) elK.textContent = kutil;
    if (elY) elY.textContent = yuvil;
    if (elT) elT.textContent = tayyor;
}

function displayOrders() {
    const container = document.getElementById('ordersList');
    if (!container) return;
    
    let filtered = orders;
    if (currentFilter === 'all') filtered = orders.filter(o => ['new', 'active', 'ready', 'done'].includes(o.status));
    else if (currentFilter === 'new') filtered = orders.filter(o => o.status === 'new' || o.status === 'active');
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
    
    // Auto-activate order if it's new
    if (order.status === 'new') {
        supabaseFetch('PATCH', `orders?id=eq.${order.id}`, { status: 'active' }, err => {
            if (!err) {
                order.status = 'active';
                loadOrders(); // Refresh in background
            }
        });
    }

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
        btn.style.flexDirection = 'column';
        btn.style.height = 'auto';
        btn.style.padding = '15px';
        btn.innerHTML = `
            <span style="font-size:30px; margin-bottom:5px;">${p.emoji}</span>
            <span style="font-weight:700;">${p.name}</span>
        `;
        btn.onclick = () => startProductRefinement(p);
        container.appendChild(btn);
    });
    
    document.getElementById('catalogSection').style.display = 'block';
    document.getElementById('refineSection').style.display = 'none';
    document.getElementById('modalTitle').textContent = 'Mahsulot qo\'shish';
    document.getElementById('productModal').classList.add('show');
}

function startProductRefinement(p) {
    activeProduct = p;
    activeCounters = { s: 0, m: 0, l: 0, kg: 0 };
    activeSqmItems = [];

    document.getElementById('catalogSection').style.display = 'none';
    document.getElementById('refineSection').style.display = 'block';
    document.getElementById('modalTitle').textContent = 'Miqdorini belgilang';
    
    document.getElementById('sel-emoji').textContent = p.emoji;
    document.getElementById('sel-name').textContent = p.name;

    // Show/Hide buttons based on product capabilities
    document.getElementById('btn-s').style.display = p.has_fixed && p.price_s > 0 ? 'block' : 'none';
    document.getElementById('btn-m').style.display = p.has_fixed && p.price_m > 0 ? 'block' : 'none';
    document.getElementById('btn-l').style.display = p.has_fixed && p.price_l > 0 ? 'block' : 'none';
    document.getElementById('btn-kg').style.display = p.has_kg && p.price_kg > 0 ? 'block' : 'none';
    
    document.getElementById('sqmInputArea').style.display = p.has_sqm ? 'block' : 'none';
    
    updateCounterUI();
    document.getElementById('sqmRows').innerHTML = '';
    if (p.has_sqm) addSqmRow();
}

function increment(type) {
    activeCounters[type]++;
    updateCounterUI();
}

function updateCounterUI() {
    ['s', 'm', 'l', 'kg'].forEach(type => {
        const val = activeCounters[type];
        const valEl = document.getElementById(`val-${type}`);
        const badgeEl = document.getElementById(`badge-${type}`);
        const btnEl = document.getElementById(`btn-${type}`);
        
        if (valEl) valEl.textContent = val > 0 ? val : '0';
        if (badgeEl) {
            badgeEl.textContent = val;
            badgeEl.style.display = val > 0 ? 'flex' : 'none';
        }
        if (btnEl) {
            if (val > 0) btnEl.classList.add('active');
            else btnEl.classList.remove('active');
        }
    });
}

function addSqmRow() {
    const container = document.getElementById('sqmRows');
    const rowId = Date.now();
    const div = document.createElement('div');
    div.className = 'sqm-item-row';
    div.id = `sqm-row-${rowId}`;
    div.innerHTML = `
        <input type="number" placeholder="Maydoni (m²)" step="0.1" class="sqm-val" style="flex: 1;">
        <button class="btn-action" style="color:var(--danger);" onclick="removeSqmRow(${rowId})">✕</button>
    `;
    container.appendChild(div);
}

function removeSqmRow(id) {
    const el = document.getElementById(`sqm-row-${id}`);
    if (el) el.remove();
}

function backToCatalog() {
    document.getElementById('catalogSection').style.display = 'block';
    document.getElementById('refineSection').style.display = 'none';
    document.getElementById('modalTitle').textContent = 'Mahsulot qo\'shish';
}

function confirmProductAdd() {
    const product = activeProduct;
    const itemsToAdd = [];

    // 1. Add fixed sizes
    if (activeCounters.s > 0) itemsToAdd.push({ type: 'S', count: activeCounters.s, price: product.price_s });
    if (activeCounters.m > 0) itemsToAdd.push({ type: 'M', count: activeCounters.m, price: product.price_m });
    if (activeCounters.l > 0) itemsToAdd.push({ type: 'L', count: activeCounters.l, price: product.price_l });
    
    // 2. Add KG
    if (activeCounters.kg > 0) itemsToAdd.push({ type: 'KG', count: activeCounters.kg, price: product.price_kg });

    // 3. Add SQM items
    const sqmRows = document.querySelectorAll('.sqm-item-row');
    sqmRows.forEach(row => {
        const input = row.querySelector('.sqm-val');
        if (input) {
            const area = parseFloat(input.value) || 0;
            if (area > 0) {
                itemsToAdd.push({ type: 'sqm', area: area, price: product.price_sqm });
            }
        }
    });

    if (itemsToAdd.length === 0) {
        showToast('❌ Kamida bitta miqdor kiriting', 'error');
        return;
    }

    // Add to refinedProducts
    // Check if this product already exists in refinedProducts to group them
    let existingEntry = refinedProducts.find(p => p.productId === product.id);
    if (!existingEntry) {
        existingEntry = {
            productId: product.id,
            name: product.name,
            emoji: product.emoji,
            items: []
        };
        refinedProducts.push(existingEntry);
    }

    // Append new items
    existingEntry.items.push(...itemsToAdd);

    closeProductModal();
    renderProducts();
}

function addOtherProduct() {
    const name = document.getElementById('other-name').value.trim();
    if (!name) return;

    // Automatic catalog addition
    const newProduct = {
        emoji: '📦',
        name: name,
        has_fixed: false,
        has_sqm: true,
        has_kg: false,
        price_sqm: PRICE_PER_SQM
    };

    supabaseFetch('POST', 'products', newProduct, (err, res) => {
        if (err) {
            // If failed to add to catalog, just add to order locally
            const entry = {
                productId: 'other-' + Date.now(),
                name: name,
                emoji: '📦',
                items: [{ type: 'sqm', area: 0, price: PRICE_PER_SQM }]
            };
            refinedProducts.push(entry);
            renderProducts();
            showToast('✅ Qo\'shildi (Katalogga saqlanmadi)', 'info');
        } else {
            // Added to catalog successfully, reload catalog
            loadProductCatalog();
            const entry = {
                productId: res[0].id,
                name: name,
                emoji: '📦',
                items: [{ type: 'sqm', width: 0, height: 0, area: 0, price: PRICE_PER_SQM }]
            };
            refinedProducts.push(entry);
            renderProducts();
            showToast('✅ Katalogga qo\'shildi va buyurtmaga kiritildi', 'success');
        }
        document.getElementById('other-name').value = '';
        closeProductModal();
    });
}

function renderProducts() {
    const container = document.getElementById('productList');
    if (!container) return;
    container.innerHTML = '';
    
    refinedProducts.forEach((group, gIdx) => {
        const card = document.createElement('div');
        card.className = 'product-item-row';
        card.style.display = 'block';
        card.style.background = 'var(--white)';
        card.style.padding = '15px';
        card.style.borderRadius = '18px';
        card.style.marginBottom = '12px';
        card.style.boxShadow = 'var(--shadow)';

        let itemsHtml = '';
        group.items.forEach((item, iIdx) => {
            if (item.type === 'sqm') {
                itemsHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-top:1px solid #eee;">
                        <div style="font-size:14px;">
                            <span style="color:var(--gray);">Maydoni:</span> 
                            <input type="number" value="${item.area}" step="0.1" style="width:70px; border:none; border-bottom:1px solid #ccc; text-align:center; font-weight:700;" oninput="updateItem(${gIdx}, ${iIdx}, 'area', this.value)"> 
                            <strong>m²</strong>
                        </div>
                        <button style="color:var(--danger); background:none; border:none;" onclick="removeItem(${gIdx}, ${iIdx})"><i class="fas fa-times"></i></button>
                    </div>
                `;
            } else {
                itemsHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-top:1px solid #eee;">
                        <div style="font-size:14px;">
                            <span style="color:var(--gray); font-weight:700;">${item.type}:</span> 
                            <input type="number" value="${item.count}" style="width:50px; border:none; border-bottom:1px solid #ccc; text-align:center; font-weight:700;" oninput="updateItem(${gIdx}, ${iIdx}, 'count', this.value)"> ta 
                            <span style="color:var(--gray); margin-left:10px;">@ ${formatMoney(item.price)}</span>
                        </div>
                        <button style="color:var(--danger); background:none; border:none;" onclick="removeItem(${gIdx}, ${iIdx})"><i class="fas fa-times"></i></button>
                    </div>
                `;
            }
        });

        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                <span style="font-size:24px;">${group.emoji || '📦'}</span>
                <div style="font-weight:800; font-size:18px; color:var(--dark);">${group.name}</div>
                <button class="close-btn" style="margin-left:auto; width:32px; height:32px; background:var(--bg); border-radius:50%; display:flex; align-items:center; justify-content:center; border:none; color:var(--danger);" onclick="removeGroup(${gIdx})">✕</button>
            </div>
            <div class="group-items">
                ${itemsHtml}
            </div>
        `;
        container.appendChild(card);
    });
    updateTotals();
}

function updateItem(gIdx, iIdx, field, val) {
    const item = refinedProducts[gIdx].items[iIdx];
    item[field] = parseFloat(val) || 0;
    updateTotals();
}

function removeItem(gIdx, iIdx) {
    refinedProducts[gIdx].items.splice(iIdx, 1);
    if (refinedProducts[gIdx].items.length === 0) {
        refinedProducts.splice(gIdx, 1);
    }
    renderProducts();
}

function removeGroup(idx) {
    refinedProducts.splice(idx, 1);
    renderProducts();
}

function updateTotals() {
    let totalArea = 0;
    let totalPrice = 0;
    let totalCount = 0;
    
    refinedProducts.forEach((group) => {
        group.items.forEach(item => {
            if (item.type === 'sqm') {
                totalArea += item.area;
                totalPrice += item.area * item.price;
                totalCount += 1;
            } else {
                totalCount += item.count;
                totalPrice += item.count * item.price;
                // For non-sqm, we don't necessarily add to "area" unless it's KG
                if (item.type === 'KG') {
                    totalArea += item.count; // Treat KG as area for display
                }
            }
        });
    });
    
    const elCount = document.getElementById('total-count');
    const elArea = document.getElementById('total-area');
    const elPrice = document.getElementById('total-price');

    if (elCount) elCount.textContent = totalCount + ' ta';
    if (elArea) elArea.textContent = totalArea.toFixed(1);
    if (elPrice) elPrice.textContent = formatMoney(totalPrice);
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
    
    let totalArea = 0;
    let totalPrice = 0;
    
    refinedProducts.forEach((group) => {
        group.items.forEach(item => {
            if (item.type === 'sqm') {
                totalArea += item.area;
                totalPrice += item.area * item.price;
            } else {
                totalPrice += item.count * item.price;
                if (item.type === 'KG') totalArea += item.count;
            }
        });
    });

    const gps = document.getElementById('refine-gps').value;

    const data = {
        product_items: JSON.stringify(refinedProducts),
        total_area: totalArea,
        price: totalPrice,
        gps_coords: gps,
        status: 'ready_to_wash'
    };

    supabaseFetch('PATCH', `orders?id=eq.${currentOrder.id}`, data, err => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('✅ Saqlandi va Yuvishga tayyorlandi!', 'success');
        switchPage('home');
        loadOrders();
    });
}

function openDeliveryDetails(order) {
    const modal = document.getElementById('detailsModal');
    const content = document.getElementById('detailsContent');
    if (!content) return;

    const sc = STATUS_CFG[order.status] || STATUS_CFG.new;
    const hasGPS = order.gpsCoords && String(order.gpsCoords).length > 5;

    let itemsHtml = '';
    if (Array.isArray(order.productItems)) {
        order.productItems.forEach(group => {
            const items = group.items || [{
                type: group.type || 'sqm',
                area: group.area || 0,
                count: group.count || 0,
                price: group.price || 0
            }];

            itemsHtml += `
                <div style="margin-bottom:10px; padding:10px; background:#fff; border-radius:10px;">
                    <div style="font-weight:700; margin-bottom:5px;">${group.emoji || '📦'} ${group.name}</div>
                    ${items.map(item => `
                        <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--gray);">
                            <span>${item.type}: ${item.type === 'sqm' ? (item.area || 0).toFixed(2) + ' m²' : (item.count || 0) + ' ta'}</span>
                            <span>${formatMoney(item.type === 'sqm' ? (item.area || 0) * (item.price || 0) : (item.count || 0) * (item.price || 0))}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        });
    }

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
                <div class="det-info-label">📏 Jami hajm</div>
                <div class="det-info-val">${order.totalArea}</div>
            </div>
        </div>
        <div style="margin-top:20px; padding:15px; background:var(--light-secondary); border-radius:15px;">
            <div style="font-weight:700; margin-bottom:10px; color:var(--primary);">📦 Mahsulotlar:</div>
            ${itemsHtml || '<div style="color:var(--gray);">Ro\'yxat bo\'sh</div>'}
        </div>
    `;

    const nav = document.getElementById('detailsNavigation');
    if (nav) {
        nav.innerHTML = '';
        
        const callBtn = document.createElement('button');
        callBtn.className = 'det-nav-btn det-nav-call';
        callBtn.innerHTML = '<i class="fas fa-phone"></i>';
        callBtn.onclick = () => window.location.href = `tel:${order.phone}`;
        nav.appendChild(callBtn);

        if (hasGPS) {
            const routeBtn = document.createElement('button');
            routeBtn.className = 'det-nav-btn det-nav-route';
            routeBtn.innerHTML = '<i class="fas fa-route"></i> Yo\'lga chiqish';
            routeBtn.onclick = () => {
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${order.gpsCoords}`, '_blank');
            };
            nav.appendChild(routeBtn);
        }

        if (order.status === 'new' || order.status === 'active') {
            const refBtn = document.createElement('button');
            refBtn.className = 'det-nav-btn';
            refBtn.style.background = 'var(--warning)';
            refBtn.innerHTML = '<i class="fas fa-edit"></i> Aniqlashtirish';
            refBtn.onclick = () => { closeDetailsModal(); startRefining(order); };
            nav.appendChild(refBtn);
        }

        if (order.status === 'ready') {
            const doneBtn = document.createElement('button');
            doneBtn.className = 'det-nav-btn';
            doneBtn.style.background = 'var(--success)';
            doneBtn.innerHTML = '<i class="fas fa-truck"></i> Yetkazildi';
            doneBtn.onclick = () => markAsDone(order.id);
            nav.appendChild(doneBtn);
        }
    }

    modal.classList.add('show');
}

function updateOrderStatus(id, newStatus) {
    const order = orders.find(o => o.id == id);
    if (order.status === 'done') {
        showToast('❌ Yetkazildi holatidagi buyurtmalarni o\'zgartirib bo\'lmaydi', 'error');
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
    const el = document.getElementById(`${page}Page`);
    if (el) el.classList.add('active');
}
function setFilter(btn, filter) {
    currentFilter = filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    displayOrders();
}
function closeProductModal() { document.getElementById('productModal').classList.remove('show'); }
function closeDetailsModal() { document.getElementById('detailsModal').classList.remove('show'); }
function hideLoading() { 
    const el = document.getElementById('loadingScreen');
    if (el) el.classList.add('hide'); 
}
function updateDateTime() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' });
}
function startAutoRefresh() { setInterval(loadOrders, 20000); }
