// =================== DISPATCHER LOGIC ===================
let orders = [];
let currentPage = 'home';
let currentTodayFilter = 'all';

document.addEventListener('DOMContentLoaded', function() {
    updateDateTime();
    loadOrders();
    startAutoRefresh();
});

function loadOrders() {
    supabaseFetch('GET', 'orders?select=*&order=created_at.desc', null, function(err, data) {
        if (err) {
            showToast('❗ Yuklanmadi: ' + err, 'error');
            hideLoading();
            return;
        }
        orders = data.map(mapOrder);
        updateUI();
        hideLoading();
    });
}

function updateUI() {
    updateStats();
    displayRecentOrders();
    if (currentPage === 'today') displayTodayOrders();
    updateTodayBadge();
}

function updateStats() {
    const today = todayStr();
    const todayOrders = orders.filter(o => o.createdAt.startsWith(today));
    const todayRevenue = todayOrders.reduce((s, o) => s + (o.price || 0), 0);

    document.getElementById('totalOrdersStat').textContent = orders.length;
    document.getElementById('todayOrdersStat').textContent = todayOrders.length;
    document.getElementById('todayRevenueStat').textContent = todayRevenue >= 1000000 ? (todayRevenue/1000000).toFixed(1) + 'M' : (todayRevenue/1000).toFixed(0) + 'k';
}

function displayRecentOrders() {
    const container = document.getElementById('recentOrders');
    if (!container) return;
    const recent = orders.slice(0, 10);
    container.innerHTML = recent.length ? '' : '<p class="empty-state">Buyurtmalar yo\'q</p>';
    recent.forEach(order => container.appendChild(makeOrderCard(order)));
}

function displayTodayOrders() {
    const container = document.getElementById('todayOrdersList');
    if (!container) return;
    const today = todayStr();
    let filtered = orders.filter(o => o.createdAt.startsWith(today));
    
    if (currentTodayFilter !== 'all') {
        filtered = filtered.filter(o => currentTodayFilter === 'new' ? (o.status === 'new' || o.status === 'queue') : o.status === currentTodayFilter);
    }

    document.getElementById('todayTotal').textContent = filtered.length + ' ta';
    container.innerHTML = filtered.length ? '' : '<p class="empty-state">Bugungi zakazlar yo\'q</p>';
    filtered.forEach(order => container.appendChild(makeOrderCard(order)));
}

function makeOrderCard(order) {
    const sc = STATUS_CFG[order.status] || STATUS_CFG.new;
    const div = document.createElement('div');
    div.className = `order-card status-${order.status}`;
    div.innerHTML = `
        <div class="order-header">
            <span class="order-id">#${order.displayId || String(order.id).slice(-6)}</span>
            <span class="order-status-pill" style="background:${sc.bg};color:${sc.color};padding:4px 10px;border-radius:12px;font-size:12px;font-weight:700;">
                ${sc.emoji} ${sc.label}
            </span>
        </div>
        <div class="order-phone">👤 ${order.customerName || 'Noma\'lum'}</div>
        <div class="order-phone">📞 ${order.phone}</div>
        <div style="font-size:11px; color:var(--gray); margin-top:5px;"><i class="far fa-clock"></i> ${formatDateTime(order.createdAt)}</div>
        <div class="order-details">
            <span>📍 ${order.location}</span>
            <span>💰 ${formatMoney(order.price)}</span>
        </div>
    `;
    div.onclick = () => openDetailsModal(order);
    return div;
}

function switchPage(page) {
    // Modal'ni o'chir (agar ochiq bo'lsa)
    const modal = document.getElementById('detailsModal');
    if (modal && modal.classList.contains('show')) {
        modal.classList.remove('show');
    }
    
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`${page}Page`)?.classList.add('active');
    currentPage = page;
    if (page === 'home') loadOrders();
    if (page === 'today') displayTodayOrders();
    if (page === 'stats') updateDispatcherStats();
}

function saveDispatcherOrder() {
    const name = document.getElementById('fo-name').value.trim();
    const phone = document.getElementById('fo-phone').value.replace(/\D/g, '');
    const village = document.getElementById('fo-village').value.trim();
    const comment = document.getElementById('fo-comment').value.trim();

    if (!phone || phone.length !== 9) { showToast('❌ Telefon raqamini kiriting (9 ta raqam)', 'error'); return; }
    if (!village) { showToast('❌ Manzilni kiriting', 'error'); return; }

    const saveBtn = document.getElementById('fo-saveBtn');
    saveBtn.disabled = true;
    
    // Database'dan yangi ID olish (atomic operation)
    getNextOrderId(function(err, nextId) {
        if (err || !nextId) {
            saveBtn.disabled = false;
            showToast('❌ Buyurtma ID olishda xato', 'error');
            return;
        }
        
        const orderId = Date.now();
        const order = {
            id: orderId,
            display_id: String(nextId),
            customer_name: name,
            phone: '+998' + phone,
            location: village,
            comment: comment,
            status: 'new',
            created_at: new Date().toISOString()
        };

        supabaseFetch('POST', 'orders', order, function(err) {
            saveBtn.disabled = false;
            if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
            showToast('✅ Buyurtma saqlandi!', 'success');
            resetForm();
            switchPage('home');
            loadOrders();
        });
    });
}

function resetForm() {
    document.getElementById('fo-name').value = '';
    document.getElementById('fo-phone').value = '';
    document.getElementById('fo-village').value = '';
    document.getElementById('fo-comment').value = '';
}

function openDetailsModal(order) {
    const modal = document.getElementById('detailsModal');
    const content = document.getElementById('detailsContent');
    const sc = STATUS_CFG[order.status] || STATUS_CFG.new;

    content.innerHTML = `
        <div class="det-header-card" style="background:${sc.bg};color:${sc.color};border:1px solid ${sc.color}30;padding:20px;border-radius:20px;margin-bottom:20px;">
            <div style="font-size:12px;font-weight:700;opacity:0.8;">BUYURTMA #${order.displayId}</div>
            <div style="font-size:24px;font-weight:800;margin:5px 0;">${sc.emoji} ${sc.label}</div>
            <div style="font-weight:600;">👤 ${order.customerName || 'Noma\'lum'}</div>
            <div style="font-weight:700;color:var(--primary);margin-top:5px;">📞 ${order.phone}</div>
        </div>
        <div class="det-info-grid">
            <div class="det-info-card" style="grid-column: 1/-1;">
                <div class="det-info-label">📍 Manzil</div>
                <div class="det-info-val">${order.location}</div>
            </div>
            <div class="det-info-card" style="grid-column: 1/-1;">
                <div class="det-info-label">📅 Qabul qilingan vaqt</div>
                <div class="det-info-val">${formatDateTime(order.createdAt)}</div>
            </div>
            <div class="det-info-card">
                <div class="det-info-label">💰 Summa</div>
                <div class="det-info-val" style="color:var(--success); font-size:18px;">${formatMoney(order.price)}</div>
            </div>
            <div class="det-info-card">
                <div class="det-info-label">📏 Jami hajm</div>
                <div class="det-info-val">${order.totalArea}</div>
            </div>
        </div>
        ${order.productItems && Array.isArray(order.productItems) && order.productItems.length ? `
            <div style="margin-top:20px; padding:15px; background:var(--light-secondary); border-radius:15px;">
                <div style="font-weight:700; margin-bottom:10px; color:var(--primary);">📦 Mahsulotlar:</div>
                ${order.productItems.map(group => `
                    <div style="margin-bottom:10px; padding:10px; background:#fff; border-radius:10px;">
                        <div style="font-weight:700; margin-bottom:5px;">${group.emoji || '📦'} ${group.name}</div>
                        ${group.items.map(item => `
                            <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--gray);">
                                <span>${item.type}: ${item.type === 'sqm' ? item.area.toFixed(2) + ' m²' : item.count + ' ta'}</span>
                                <span>${formatMoney(item.type === 'sqm' ? item.area * item.price : item.count * item.price)}</span>
                            </div>
                        `).join('')}
                    </div>
                `).join('')}
            </div>
        ` : ''}
        ${order.comment ? `<div style="margin-top:15px;padding:15px;background:#f8f9fa;border-radius:12px;font-size:14px;"><strong>Izoh:</strong> ${order.comment}</div>` : ''}
    `;

    const nav = document.getElementById('detailsNavigation');
    nav.innerHTML = `
        <button class="det-nav-btn det-nav-call" onclick="window.location.href='tel:${order.phone}'">
            <i class="fas fa-phone"></i> Qo'ng'iroq
        </button>
        <button class="det-nav-btn det-nav-status" onclick="openStatusChange('${order.id}')">
            <i class="fas fa-sync"></i> Holat
        </button>
    `;

    modal.classList.add('show');
}

function closeDetailsModal() {
    document.getElementById('detailsModal').classList.remove('show');
}

function openStatusChange(id) {
    const order = orders.find(o => o.id == id);
    const nav = document.getElementById('detailsNavigation');
    const content = document.getElementById('detailsContent');
    
    if (order.status === 'done') {
        content.innerHTML = `<h3>⛔ O'zgartirib bo'lmaydi</h3><p>#${order.displayId} Yetgazildi holatida bo'lgani sababli holatni o'zgartirib bo'lmaydi.</p>`;
        nav.innerHTML = '';
        return;
    }
    
    content.innerHTML = `<h3>Holatni o'zgartirish</h3><p>#${order.displayId} uchun yangi holat tanlang:</p>`;
    nav.innerHTML = '';
    
    ['new', 'washing', 'ready', 'done'].forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'det-nav-btn';
        btn.style.margin = '5px 0';
        btn.innerHTML = `${STATUS_CFG[s].emoji} ${STATUS_CFG[s].label}`;
        btn.onclick = () => updateStatus(id, s);
        nav.appendChild(btn);
    });
}

function updateStatus(id, newStatus) {
    const order = orders.find(o => o.id == id);
    if (order.status === 'done') {
        showToast('❌ Yetgazildi holatidagi buyurtmalarni o\'zgartirb bo\'lmaydi', 'error');
        return;
    }
    supabaseFetch('PATCH', `orders?id=eq.${id}`, { status: newStatus }, (err) => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('✅ Holat yangilandi', 'success');
        closeDetailsModal();
        loadOrders();
    });
}

// UTILS
function hideLoading() { document.getElementById('loadingScreen').classList.add('hide'); }
function updateDateTime() {
    const el = document.getElementById('currentDate');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' });
}
function updateTodayBadge() {
    const today = todayStr();
    const count = orders.filter(o => o.createdAt.startsWith(today) && o.status !== 'done').length;
    const badge = document.getElementById('todayBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'block' : 'none';
    }
}
function updateDispatcherStats() {
    const today = todayStr();
    const todayOrders = orders.filter(o => o.createdAt.startsWith(today));
    const sumToday = todayOrders.reduce((s, o) => s + (o.price || 0), 0);
    
    document.getElementById('stats-today-count').textContent = todayOrders.length;
    document.getElementById('stats-today-revenue').textContent = formatMoney(sumToday);
    const avgToday = todayOrders.length > 0 ? sumToday / todayOrders.length : 0;
    document.getElementById('stats-today-avg').textContent = formatMoney(avgToday);
    
    // Holat bo'ylab
    document.getElementById('stats-status-new').textContent = todayOrders.filter(o => o.status === 'new' || o.status === 'queue').length;
    document.getElementById('stats-status-washing').textContent = todayOrders.filter(o => o.status === 'washing').length;
    document.getElementById('stats-status-ready').textContent = todayOrders.filter(o => o.status === 'ready').length;
    document.getElementById('stats-status-done').textContent = todayOrders.filter(o => o.status === 'done').length;
}
function startAutoRefresh() { setInterval(loadOrders, 15000); }
function setTodayFilter(btn, filter) {
    currentTodayFilter = filter;
    document.querySelectorAll('#todayPage .chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    displayTodayOrders();
}
function formatPhoneInput(input) {
    let d = input.value.replace(/\D/g, '').slice(0, 9);
    let f = '';
    if (d.length > 0) f = d.slice(0, 2);
    if (d.length > 2) f += ' ' + d.slice(2, 5);
    if (d.length > 5) f += '-' + d.slice(5, 7);
    if (d.length > 7) f += '-' + d.slice(7, 9);
    input.value = f;
}
function handlePhoneKey(e, input) {
    if (e.key === 'Backspace' && (input.value.endsWith(' ') || input.value.endsWith('-'))) {
        e.preventDefault();
        input.value = input.value.slice(0, -1);
    }
}
function globalSearch(q) {
    const container = document.getElementById('recentOrders');
    if (!q.trim()) { loadOrders(); return; }
    const filtered = orders.filter(o => 
        o.customerName.toLowerCase().includes(q.toLowerCase()) || 
        o.phone.includes(q) || 
        o.displayId.includes(q)
    );
    container.innerHTML = filtered.length ? '' : '<p class="empty-state">Topilmadi</p>';
    filtered.forEach(order => container.appendChild(makeOrderCard(order)));
}
