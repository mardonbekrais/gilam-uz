// =================== DELIVERY LOGIC ===================
let orders = [];
let productCatalog = [];
let currentFilter = 'all';
let currentOrder = null;
let refinedProducts = [];
let PRICE_PER_SQM = 20000;

// State for the product being added in the modal
let activeProduct = null;
let activeCounters = { s: 0, m: 0, l: 0, kg: 0, meter: 0 };
let activeSqmItems = [];

// Stepper values for modal
let modalSqmCount = 1;
let modalKgCount = 1;
let modalMeterCount = 1;

let otherSelectedType = 'sqm';

function updateModalSqmCount(delta) { modalSqmCount = Math.max(1, modalSqmCount + delta); document.getElementById('sqm-modal-count').textContent = modalSqmCount; }
function updateModalKgCount(delta) { modalKgCount = Math.max(1, modalKgCount + delta); document.getElementById('kg-modal-count').textContent = modalKgCount; }
function updateModalMeterCount(delta) { modalMeterCount = Math.max(1, modalMeterCount + delta); document.getElementById('meter-modal-count').textContent = modalMeterCount; }

document.addEventListener('DOMContentLoaded', function() {
    updateDateTime();
    loadInitialData();
    startAutoRefresh();
});

function loadInitialData() {
    supabaseFetch('GET', 'settings?key=eq.global_price', null, function(err, data) {
        if (!err && data && data.length > 0) {
            PRICE_PER_SQM = parseFloat(data[0].value) || 20000;
        }
    });
    loadProductCatalog();
    loadOrders();
}

function loadProductCatalog() {
    supabaseFetch('GET', 'products?select=*&order=created_at.asc', null, function(err, data) {
        if (!err && data) productCatalog = data;
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
    const kutil = orders.filter(o => o.status === 'new' || o.status === 'active').length;
    const tayyor = orders.filter(o => o.status === 'ready').length;
    if (document.getElementById('stat-kutilmoqda')) document.getElementById('stat-kutilmoqda').textContent = kutil;
    if (document.getElementById('stat-tayyor')) document.getElementById('stat-tayyor').textContent = tayyor;
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
        const div = document.createElement('div');
        div.className = `order-card status-${order.status}`;
        div.innerHTML = `
            <div class="order-header">
                <span class="order-id">#${order.displayId}</span>
                <span class="order-status-pill" style="background:${sc.bg};color:${sc.color};padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">
                    ${sc.emoji} ${sc.label}
                </span>
            </div>
            <div class="order-phone">
                <i class="fas fa-user-circle" style="color:var(--primary); font-size:20px;"></i>
                <span>${order.customerName || 'Noma\'lum'}</span>
            </div>
            <div style="font-weight:700; color:var(--primary); margin-bottom:4px; font-size:14px;">
                <i class="fas fa-phone-alt" style="font-size:12px;"></i> ${order.phone}
            </div>
            ${getOrderSummaryHtml(order.productItems)}
            <div class="order-details">
                <span><i class="fas fa-map-marker-alt"></i> ${order.location}</span>
                <span style="font-weight:800; color:var(--success); font-size:15px;">${formatMoney(order.price)}</span>
            </div>
        `;
        div.onclick = () => openDeliveryDetails(order);
        container.appendChild(div);
    });
}

function startRefining(order) {
    currentOrder = order;
    refinedProducts = order.productItems || [];
    if (order.status === 'new') {
        supabaseFetch('PATCH', `orders?id=eq.${order.id}`, { status: 'active' }, () => loadOrders());
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
        btn.innerHTML = `<span style="font-size:24px;">${p.emoji}</span><span>${p.name}</span>`;
        btn.onclick = () => startProductRefinement(p);
        container.appendChild(btn);
    });
    document.getElementById('catalogSection').style.display = 'block';
    document.getElementById('refineSection').style.display = 'none';
    document.getElementById('productModal').classList.add('show');
}

function selectOtherType(type) {
    otherSelectedType = type;
    document.querySelectorAll('[id^="type-"]').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`type-${type}`).classList.add('active');
}

function addOtherProduct() {
    const name = document.getElementById('other-name').value.trim();
    if (!name) { showToast('❌ Mahsulot nomini kiriting', 'error'); return; }

    const newProduct = {
        emoji: '📦',
        name: name,
        has_fixed: otherSelectedType === 'fixed',
        has_sqm: otherSelectedType === 'sqm',
        has_kg: otherSelectedType === 'kg',
        has_meter: otherSelectedType === 'meter',
        price_s: otherSelectedType === 'fixed' ? 15000 : 0,
        price_m: otherSelectedType === 'fixed' ? 25000 : 0,
        price_l: otherSelectedType === 'fixed' ? 35000 : 0,
        price_sqm: otherSelectedType === 'sqm' ? PRICE_PER_SQM : 0,
        price_kg: otherSelectedType === 'kg' ? 10000 : 0,
        price_meter: otherSelectedType === 'meter' ? 5000 : 0,
        created_at: new Date().toISOString()
    };

    showToast('⌛ Katalogga qo\'shilmoqda...', 'info');
    
    supabaseFetch('POST', 'products', newProduct, (err, res) => {
        if (err) { showToast('❌ Katalogga saqlab bo\'lmadi: ' + err, 'error'); return; }
        showToast('✅ Katalogga qo\'shildi', 'success');
        document.getElementById('other-name').value = '';
        loadProductCatalog();
        if (res && res[0]) startProductRefinement(res[0]);
    });
}

function startProductRefinement(p) {
    activeProduct = p;
    activeCounters = { s: 0, m: 0, l: 0, kg: 0, meter: 0 };
    modalSqmCount = 1; modalKgCount = 1; modalMeterCount = 1;
    
    document.getElementById('catalogSection').style.display = 'none';
    document.getElementById('refineSection').style.display = 'block';
    document.getElementById('sel-emoji').textContent = p.emoji;
    document.getElementById('sel-name').textContent = p.name;
    document.getElementById('sel-min-price').textContent = '';

    // Step 1: Hide all optional areas first to prevent leftovers
    document.getElementById('btn-s').style.display = 'none';
    document.getElementById('btn-m').style.display = 'none';
    document.getElementById('btn-l').style.display = 'none';
    document.getElementById('btn-kg').style.display = 'none'; // Always hide KG button from grid
    document.getElementById('sqmInputArea').style.display = 'none';
    document.getElementById('kgInputArea').style.display = 'none';
    document.getElementById('meterInputArea').style.display = 'none';

    // Step 2: Show only authorized areas based on product flags
    if (p.has_fixed) {
        if (p.price_s > 0) {
            document.getElementById('btn-s').style.display = 'flex';
            document.getElementById('btn-s').innerHTML = `<span class="counter-label">Kichik</span><span class="counter-value" id="val-s">0</span><span class="counter-price-sub">${formatMoney(p.price_s)}</span><div class="counter-badge" id="badge-s" style="display:none;">0</div>`;
        }
        if (p.price_m > 0) {
            document.getElementById('btn-m').style.display = 'flex';
            document.getElementById('btn-m').innerHTML = `<span class="counter-label">O'rtacha</span><span class="counter-value" id="val-m">0</span><span class="counter-price-sub">${formatMoney(p.price_m)}</span><div class="counter-badge" id="badge-m" style="display:none;">0</div>`;
        }
        if (p.price_l > 0) {
            document.getElementById('btn-l').style.display = 'flex';
            document.getElementById('btn-l').innerHTML = `<span class="counter-label">Katta</span><span class="counter-value" id="val-l">0</span><span class="counter-price-sub">${formatMoney(p.price_l)}</span><div class="counter-badge" id="badge-l" style="display:none;">0</div>`;
        }
    }

    if (p.has_sqm && p.price_sqm > 0) document.getElementById('sqmInputArea').style.display = 'block';
    if (p.has_kg && p.price_kg > 0) document.getElementById('kgInputArea').style.display = 'block';
    if (p.has_meter && p.price_meter > 0) document.getElementById('meterInputArea').style.display = 'block';
    
    // Step 3: Reset input fields
    if (document.getElementById('sqm-total-val')) document.getElementById('sqm-total-val').value = '';
    if (document.getElementById('kg-total-val')) document.getElementById('kg-total-val').value = '';
    if (document.getElementById('meter-total-val')) document.getElementById('meter-total-val').value = '';
    
    document.getElementById('sqm-modal-count').textContent = '1';
    document.getElementById('kg-modal-count').textContent = '1';
    document.getElementById('meter-modal-count').textContent = '1';

    updateCounterUI();
}

function increment(type) { activeCounters[type]++; updateCounterUI(); }
function updateCounterUI() {
    ['s', 'm', 'l', 'kg'].forEach(t => {
        const valEl = document.getElementById(`val-${t}`);
        const badgeEl = document.getElementById(`badge-${t}`);
        if (valEl) valEl.textContent = activeCounters[t];
        if (badgeEl) { badgeEl.textContent = activeCounters[t]; badgeEl.style.display = activeCounters[t] > 0 ? 'flex' : 'none'; }
    });
}

function confirmProductAdd() {
    const p = activeProduct;
    const items = [];
    if (activeCounters.s > 0) items.push({ type: 'S', count: activeCounters.s, price: p.price_s });
    if (activeCounters.m > 0) items.push({ type: 'M', count: activeCounters.m, price: p.price_m });
    if (activeCounters.l > 0) items.push({ type: 'L', count: activeCounters.l, price: p.price_l });
    const sqmVal = parseFloat(document.getElementById('sqm-total-val').value) || 0;
    if (p.has_sqm && sqmVal > 0) items.push({ type: 'sqm', count: modalSqmCount, area: sqmVal, price: p.price_sqm });
    const kgVal = parseFloat(document.getElementById('kg-total-val').value) || 0;
    if (p.has_kg && kgVal > 0) items.push({ type: 'KG', count: modalKgCount, area: kgVal, price: p.price_kg });
    const meterVal = parseFloat(document.getElementById('meter-total-val').value) || 0;
    if (p.has_meter && meterVal > 0) items.push({ type: 'meter', count: modalMeterCount, value: meterVal, price: p.price_meter });

    if (items.length === 0) { showToast('❌ Miqdor kiriting', 'error'); return; }
    
    let existing = refinedProducts.find(x => x.productId === p.id);
    if (existing) {
        items.forEach(newItem => {
            let found = existing.items.find(i => i.type === newItem.type);
            if (found) {
                found.count += newItem.count;
                if (newItem.area) found.area = (found.area || 0) + newItem.area;
                if (newItem.value) found.value = (found.value || 0) + newItem.value;
            } else { existing.items.push(newItem); }
        });
    } else { refinedProducts.push({ productId: p.id, name: p.name, emoji: p.emoji, items }); }
    closeProductModal();
    renderProducts();
}

function renderProducts() {
    const container = document.getElementById('productList');
    if (!container) return;
    container.innerHTML = '';
    refinedProducts.forEach((group, gIdx) => {
        const card = document.createElement('div');
        card.className = 'product-item-row';
        let itemsHtml = '';
        group.items.forEach((item, iIdx) => {
            const isFixed = ['S', 'M', 'L'].includes(item.type);
            const unitPrice = item.price || 0;
            let itemTotal = 0;
            if (item.type === 'sqm' || item.type === 'KG') itemTotal = (item.area || 0) * unitPrice;
            else if (item.type === 'meter') itemTotal = (item.value || 0) * unitPrice;
            else itemTotal = (item.count || 0) * unitPrice;

            itemsHtml += `
                <div style="display:flex; flex-direction:column; gap:12px; padding:15px 0; border-top:1px solid var(--border);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:700; color:var(--dark); font-size:14px;">${translateType(item.type)}</span>
                            <span style="font-size:11px; color:var(--gray); font-weight:600;">Narxi: ${formatMoney(unitPrice)}</span>
                        </div>
                        <button style="color:var(--danger); border:none; background:var(--bg); width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center;" onclick="removeItem(${gIdx}, ${iIdx})"><i class="fas fa-trash-alt" style="font-size:12px;"></i></button>
                    </div>
                    <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                        <div class="stepper-control">
                            <button class="stepper-btn" onclick="updateItemVal(${gIdx}, ${iIdx}, 'count', -1)">-</button>
                            <span class="stepper-val">${item.count || 0}</span>
                            <button class="stepper-btn" onclick="updateItemVal(${gIdx}, ${iIdx}, 'count', 1)">+</button>
                        </div>
                        ${!isFixed ? `
                            <div style="display:flex; align-items:center; gap:8px; background:var(--bg); padding:6px 12px; border-radius:12px; border:1px solid var(--border);">
                                <input type="number" value="${item.type === 'meter' ? item.value : item.area}" step="0.1" 
                                    style="width:65px; border:none; background:none; font-weight:800; font-size:16px; text-align:center; color:var(--primary);"
                                    oninput="updateItemVal(${gIdx}, ${iIdx}, '${item.type === 'meter' ? 'value' : 'area'}', this.value, true)">
                                <span style="font-weight:700; color:var(--gray); font-size:12px;">${item.type === 'sqm' ? 'm²' : (item.type === 'KG' ? 'kg' : 'm')}</span>
                            </div>
                        ` : ''}
                        <div style="font-weight:800; color:var(--success); font-size:15px; margin-left:auto;">${formatMoney(itemTotal)}</div>
                    </div>
                </div>
            `;
        });
        card.innerHTML = `<div style="display:flex; align-items:center; gap:12px; margin-bottom:12px;"><div style="width:40px; height:40px; background:var(--bg); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:22px;">${group.emoji || '📦'}</div><span style="font-weight:800; font-size:18px; color:var(--dark);">${group.name}</span></div>${itemsHtml}`;
        container.appendChild(card);
    });
    updateTotals();
}

function updateItemVal(gIdx, iIdx, field, delta, isDirect = false) {
    const item = refinedProducts[gIdx].items[iIdx];
    if (isDirect) item[field] = parseFloat(delta) || 0;
    else { item[field] = (item[field] || 0) + delta; if (item[field] < 0) item[field] = 0; }
    renderProducts();
}

function removeItem(gIdx, iIdx) {
    refinedProducts[gIdx].items.splice(iIdx, 1);
    if (refinedProducts[gIdx].items.length === 0) refinedProducts.splice(gIdx, 1);
    renderProducts();
}

function updateTotals() {
    let totalCount = 0, totalArea = 0, totalPrice = 0;
    const summaryCards = document.getElementById('summary-cards');
    if (!summaryCards) return;
    summaryCards.innerHTML = '';
    refinedProducts.forEach(group => {
        let groupPrice = 0;
        group.items.forEach(item => {
            const count = item.count || 0;
            const price = item.price || 0;
            let itemTotal = 0;
            if (item.type === 'sqm' || item.type === 'KG') { const val = (item.area || 0); itemTotal = val * price; totalArea += val; }
            else if (item.type === 'meter') { itemTotal = (item.value || 0) * price; }
            else { itemTotal = count * price; }
            groupPrice += itemTotal; totalCount += count; totalPrice += itemTotal;
        });
        summaryCards.innerHTML += `<div class="summary-small-card"><div class="summary-label">${group.emoji} ${group.name}</div><div class="summary-value">${formatMoney(groupPrice)}</div></div>`;
    });
    document.getElementById('total-price').textContent = formatMoney(totalPrice);
}

function saveRefinedOrder() {
    if (refinedProducts.length === 0) { showToast('❌ Mahsulot qo\'shing', 'error'); return; }
    let totalArea = 0, totalPrice = 0;
    refinedProducts.forEach(g => g.items.forEach(item => {
        const price = item.price || 0;
        if (item.type === 'sqm' || item.type === 'KG') { totalArea += (item.area || 0); totalPrice += (item.area || 0) * price; }
        else { totalPrice += (item.count || 0) * price; }
    }));
    const data = { product_items: JSON.stringify(refinedProducts), total_area: totalArea.toFixed(1), price: totalPrice, gps_coords: document.getElementById('refine-gps').value, status: 'ready_to_wash' };
    supabaseFetch('PATCH', `orders?id=eq.${currentOrder.id}`, data, err => {
        if (err) showToast('❌ Xato: ' + err, 'error');
        else { showToast('✅ Saqlandi!', 'success'); switchPage('home'); loadOrders(); }
    });
}

function openDeliveryDetails(order) {
    const sc = STATUS_CFG[order.status] || STATUS_CFG.new;
    const content = document.getElementById('detailsContent');
    content.innerHTML = `<div class="det-header-card" style="background:${sc.bg};color:${sc.color};padding:20px;border-radius:20px;margin-bottom:20px;"><div style="font-size:24px;font-weight:900;">#${order.displayId}</div><div style="font-weight:700;margin-top:10px;">👤 ${order.customerName}</div><div style="font-weight:800;color:var(--primary);">${order.phone}</div></div><div class="det-info-grid"><div class="det-info-card" style="grid-column: 1/-1;"><div class="det-info-label">📍 Manzil</div><div class="det-info-val">${order.location}</div></div><div class="det-info-card"><div class="det-info-label">💰 Summa</div><div class="det-info-val" style="color:var(--success);">${formatMoney(order.price)}</div></div><div class="det-info-card"><div class="det-info-label">📏 Hajm</div><div class="det-info-val">${order.totalArea}</div></div></div>`;
    const nav = document.getElementById('detailsNavigation');
    nav.innerHTML = `<button class="det-nav-btn det-nav-call" onclick="window.location.href='tel:${order.phone}'"><i class="fas fa-phone"></i></button>`;
    if (order.status === 'new' || order.status === 'active') {
        const btn = document.createElement('button'); btn.className = 'det-nav-btn'; btn.style.background = 'var(--warning)'; btn.style.color = 'white';
        btn.innerHTML = 'Aniqlashtirish'; btn.onclick = () => { closeDetailsModal(); startRefining(order); };
        nav.appendChild(btn);
    }
    if (order.status === 'ready') {
        const btn = document.createElement('button'); btn.className = 'det-nav-btn'; btn.style.background = 'var(--success)'; btn.style.color = 'white';
        btn.innerHTML = 'Yetkazildi'; btn.onclick = () => markAsDone(order.id);
        nav.appendChild(btn);
    }
    document.getElementById('detailsModal').classList.add('show');
}

function markAsDone(id) {
    if (!confirm('Buyurtma yetkazildimi?')) return;
    supabaseFetch('PATCH', `orders?id=eq.${id}`, { status: 'done' }, err => {
        if (err) showToast('❌ Xato: ' + err, 'error');
        else { showToast('✅ Yakunlandi!', 'success'); closeDetailsModal(); loadOrders(); }
    });
}

function switchPage(page) { document.querySelectorAll('.page').forEach(p => p.classList.remove('active')); document.getElementById(`${page}Page`).classList.add('active'); }
function setFilter(btn, filter) { currentFilter = filter; document.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); btn.classList.add('active'); displayOrders(); }
function closeProductModal() { document.getElementById('productModal').classList.remove('show'); }
function closeDetailsModal() { document.getElementById('detailsModal').classList.remove('show'); }
function backToCatalog() { document.getElementById('catalogSection').style.display='block'; document.getElementById('refineSection').style.display='none'; }
function hideLoading() { document.getElementById('loadingScreen').classList.add('hide'); }
function updateDateTime() { const el = document.getElementById('currentDate'); if (el) el.textContent = new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' }); }
function getGPS() {
    if (!navigator.geolocation) { showToast('❌ GPS yo\'q', 'error'); return; }
    navigator.geolocation.getCurrentPosition(pos => { document.getElementById('refine-gps').value = `${pos.coords.latitude.toFixed(6)},${pos.coords.longitude.toFixed(6)}`; }, err => showToast('❌ Xato: ' + err.message, 'error'));
}
function startAutoRefresh() { setInterval(loadOrders, 20000); }
