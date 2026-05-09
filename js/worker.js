// =================== WORKER LOGIC ===================
let orders = [];
let currentFilter = 'ready_to_wash';

document.addEventListener('DOMContentLoaded', function() {
    updateDateTime();
    loadOrders();
    setInterval(loadOrders, 20000); // Auto refresh
});

function loadOrders() {
    supabaseFetch('GET', 'orders?select=*&order=created_at.desc', null, function(err, data) {
        if (err) { showToast('❗ Xato: ' + err, 'error'); hideLoading(); return; }
        orders = data.map(mapOrder);
        displayOrders();
        hideLoading();
    });
}

function displayOrders() {
    const container = document.getElementById('ordersList');
    if (!container) return;
    
    let filtered = orders.filter(o => o.status === currentFilter);

    container.innerHTML = filtered.length ? '' : '<p class="empty-state">Hozircha buyurtmalar yo\'q</p>';
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
            
            ${getOrderSummaryHtml(order.productItems)}

            <div class="order-details">
                <span><i class="far fa-clock"></i> ${formatDateTime(order.createdAt)}</span>
                <span style="font-weight:800; color:var(--primary);">${order.totalArea} m²/kg</span>
            </div>
        `;
        div.onclick = () => openOrderDetails(order);
        container.appendChild(div);
    });
}

function openOrderDetails(order) {
    const modal = document.getElementById('detailsModal');
    const content = document.getElementById('detailsContent');
    const nav = document.getElementById('detailsNavigation');
    if (!content || !nav) return;

    const sc = STATUS_CFG[order.status];

    let itemsHtml = '';
    if (Array.isArray(order.productItems)) {
        order.productItems.forEach(group => {
            itemsHtml += `
                <div class="product-item-card" style="background:var(--white); border:1px solid var(--border); border-radius:15px; padding:12px; margin-bottom:10px; box-shadow:var(--shadow);">
                    <div style="font-weight:800; margin-bottom:8px; font-size:16px; color:var(--primary);">${group.emoji || '📦'} ${group.name}</div>
                    ${group.items.map(item => `
                        <div style="font-size:15px; color:var(--dark); display:flex; justify-content:space-between;">
                            <span>• ${translateType(item.type)}: ${item.count || 1} ta ${item.type === 'sqm' ? '(' + (item.area || 0).toFixed(2) + ' m²)' : (item.type === 'KG' ? '(' + (item.area || 0).toFixed(1) + ' kg)' : (item.type === 'meter' ? '(' + (item.value || 0).toFixed(1) + ' m)' : ''))}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        });
    }

    content.innerHTML = `
        <div style="background:${sc.bg}; color:${sc.color}; padding:20px; border-radius:20px; margin-bottom:20px; text-align:center; border:1px solid ${sc.color}30;">
            <div style="font-size:24px; font-weight:900;">#${order.displayId}</div>
            <div style="font-size:16px; font-weight:700; margin-top:5px;">${sc.emoji} ${sc.label}</div>
            <div style="font-weight:600; margin-top:5px; color:var(--dark-secondary);">Mijoz: ${order.customerName}</div>
        </div>
        <div style="margin-bottom:20px;">
            <div style="font-weight:800; margin-bottom:12px; color:var(--primary); font-size:16px; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-box-open"></i> Mahsulotlar:
            </div>
            ${itemsHtml || '<div style="color:var(--gray); text-align:center; padding:10px;">Ro\'yxat bo\'sh</div>'}
        </div>
        ${order.comment ? `
            <div style="padding:15px; background:var(--light-secondary); border-radius:15px; font-size:14px; margin-bottom:20px; border-left:4px solid var(--warning);">
                <div style="font-weight:800; color:var(--dark); margin-bottom:4px;">📝 Izoh:</div>
                ${order.comment}
            </div>
        ` : ''}
    `;

    nav.innerHTML = '';
    
    if (order.status === 'ready_to_wash') {
        const btn = createWorkerBtn('Yuvishni boshlash', '#2196f3', 'soap', () => updateStatus(order.id, 'washing'));
        nav.appendChild(btn);
    } else if (order.status === 'washing') {
        const btn = createWorkerBtn('Upakovkaga berish', '#795548', 'box', () => updateStatus(order.id, 'packing'));
        nav.appendChild(btn);
    } else if (order.status === 'packing') {
        const btn = createWorkerBtn('Tayyor bo\'ldi', '#4caf50', 'check-double', () => updateStatus(order.id, 'ready'));
        nav.appendChild(btn);
    } else {
        nav.innerHTML = '<p style="text-align:center; color:var(--gray);">Ushbu buyurtma bo\'yicha ish yakunlangan.</p>';
    }

    modal.classList.add('show');
}

function createWorkerBtn(text, color, icon, action) {
    const btn = document.createElement('button');
    btn.className = 'worker-btn';
    btn.style.background = color;
    btn.innerHTML = `<i class="fas fa-${icon}"></i> ${text}`;
    btn.onclick = action;
    return btn;
}

function updateStatus(id, newStatus) {
    if (!confirm('Holatni o\'zgartirmoqchimisiz?')) return;
    
    supabaseFetch('PATCH', `orders?id=eq.${id}`, { status: newStatus }, err => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('✅ Holat yangilandi!', 'success');
        closeDetailsModal();
        loadOrders();
    });
}

function setFilter(btn, filter) {
    currentFilter = filter;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    displayOrders();
}

function closeDetailsModal() { document.getElementById('detailsModal').classList.remove('show'); }
function hideLoading() { 
    const el = document.getElementById('loadingScreen');
    if (el) el.classList.add('hide'); 
}
function updateDateTime() {
    const el = document.getElementById('currentDate');
    if (el) el.textContent = new Date().toLocaleDateString('uz-UZ', { weekday: 'long', day: 'numeric', month: 'long' });
}
