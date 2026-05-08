// =================== ADMIN LOGIC ===================
let orders = [];
let enteredPin = "";

document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('admin_logged_in') === 'true') {
        document.getElementById('loginOverlay').style.display = 'none';
        loadAdminData();
    }
    
    // Klaviaturadan raqamlarni eshitish
    document.addEventListener('keydown', function(e) {
        if (document.getElementById('loginOverlay').style.display === 'none') return;
        if (e.key >= '0' && e.key <= '9') pressNum(parseInt(e.key));
        if (e.key === 'Backspace') backspacePin();
        if (e.key === 'Escape') clearPin();
    });
});

function pressNum(num) {
    if (enteredPin.length < 4) {
        enteredPin += num;
        updateDots();
        if (enteredPin.length === 4) {
            setTimeout(tryLogin, 300);
        }
    }
}

function clearPin() {
    enteredPin = "";
    updateDots();
}

function backspacePin() {
    enteredPin = enteredPin.slice(0, -1);
    updateDots();
}

function updateDots() {
    for (let i = 0; i < 4; i++) {
        const dot = document.getElementById(`dot-${i}`);
        if (i < enteredPin.length) dot.classList.add('active');
        else dot.classList.remove('active');
    }
}

function tryLogin() {
    if (enteredPin === '2026') {
        localStorage.setItem('admin_logged_in', 'true');
        document.getElementById('loginOverlay').style.display = 'none';
        loadAdminData();
    } else {
        const card = document.getElementById('loginCard');
        card.classList.add('error-shake');
        showToast('❌ PIN noto\'g\'ri', 'error');
        setTimeout(() => {
            card.classList.remove('error-shake');
            clearPin();
        }, 400);
    }
}

function loadAdminData() {
    supabaseFetch('GET', 'orders?select=*&order=created_at.desc', null, function(err, data) {
        if (err) { showToast('❗ Xato: ' + err, 'error'); return; }
        orders = data.map(mapOrder);
        updateAdminUI();
        
        const savedPrice = localStorage.getItem('global_price') || 20000;
        document.getElementById('global-price').value = savedPrice;

        renderProductCatalog();
    });
}

function renderProductCatalog() {
    const catalog = JSON.parse(localStorage.getItem('product_catalog') || '[]');
    const body = document.getElementById('product-catalog-body');
    if (!body) return;
    body.innerHTML = '';

    if (catalog.length === 0) {
        // Default products if empty
        const defaults = [
            { emoji: '🧺', name: 'Gilam', price: 20000 },
            { emoji: '🛏️', name: 'Adyol', price: 15000 },
            { emoji: '🪟', name: 'Parda', price: 10000 }
        ];
        localStorage.setItem('product_catalog', JSON.stringify(defaults));
        renderProductCatalog();
        return;
    }

    catalog.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Emoji" style="font-size:24px;">${p.emoji}</td>
            <td data-label="Nomi"><strong>${p.name}</strong></td>
            <td data-label="Narxi (1 m²)"><input type="number" value="${p.price}" onchange="updateCatalogPrice(${idx}, this.value)" style="width:100px; padding:5px; border-radius:8px; border:1px solid var(--border);"></td>
            <td style="text-align:right;">
                <button class="btn-action" style="color:var(--danger); background:var(--bg); margin-left:auto;" onclick="deleteFromCatalog(${idx})"><i class="fas fa-trash"></i></button>
            </td>
        `;
        body.appendChild(tr);
    });
}

function addNewProductType() {
    const emoji = document.getElementById('new-p-emoji').value.trim() || '📦';
    const name = document.getElementById('new-p-name').value.trim();
    const price = parseFloat(document.getElementById('new-p-price').value) || 0;

    if (!name) { showToast('❌ Mahsulot nomini kiriting', 'error'); return; }

    const catalog = JSON.parse(localStorage.getItem('product_catalog') || '[]');
    catalog.push({ emoji, name, price });
    localStorage.setItem('product_catalog', JSON.stringify(catalog));
    
    showToast('✅ Mahsulot katalogga qo\'shildi', 'success');
    document.getElementById('new-p-emoji').value = '';
    document.getElementById('new-p-name').value = '';
    document.getElementById('new-p-price').value = '';
    renderProductCatalog();
}

function updateCatalogPrice(idx, newPrice) {
    const catalog = JSON.parse(localStorage.getItem('product_catalog') || '[]');
    catalog[idx].price = parseFloat(newPrice) || 0;
    localStorage.setItem('product_catalog', JSON.stringify(catalog));
    showToast('✅ Narx yangilandi', 'success');
}

function deleteFromCatalog(idx) {
    if (!confirm('Ushbu mahsulotni katalogdan o\'chirmoqchimisiz?')) return;
    const catalog = JSON.parse(localStorage.getItem('product_catalog') || '[]');
    catalog.splice(idx, 1);
    localStorage.setItem('product_catalog', JSON.stringify(catalog));
    renderProductCatalog();
    showToast('🗑️ Katalogdan o\'chirildi', 'info');
}

function updateAdminUI() {
    updateAdminStats();
    displayAdminOrders();
    updateProductStats();
}

function updateAdminStats() {
    const now = new Date();
    const today = todayStr();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayOrders = orders.filter(o => o.createdAt.startsWith(today));
    const weekOrders = orders.filter(o => new Date(o.createdAt) >= weekAgo);
    const monthOrders = orders.filter(o => new Date(o.createdAt) >= monthAgo);

    const sumToday = todayOrders.reduce((s, o) => s + (o.price || 0), 0);
    const sumWeek = weekOrders.reduce((s, o) => s + (o.price || 0), 0);
    const sumMonth = monthOrders.reduce((s, o) => s + (o.price || 0), 0);

    // Asosiy statistika
    document.getElementById('s-today').textContent = formatMoney(sumToday);
    document.getElementById('s-week').textContent = formatMoney(sumWeek);
    document.getElementById('s-month').textContent = formatMoney(sumMonth);
    document.getElementById('s-total').textContent = orders.length;

    // Kunlik statistika
    document.getElementById('daily-count').textContent = todayOrders.length;
    document.getElementById('daily-sum').textContent = formatMoney(sumToday);
    const dailyAvg = todayOrders.length > 0 ? sumToday / todayOrders.length : 0;
    document.getElementById('daily-avg').textContent = formatMoney(dailyAvg);

    // Haftalik statistika
    document.getElementById('weekly-count').textContent = weekOrders.length;
    document.getElementById('weekly-sum').textContent = formatMoney(sumWeek);
    const weeklyAvg = weekOrders.length > 0 ? sumWeek / weekOrders.length : 0;
    document.getElementById('weekly-avg').textContent = formatMoney(weeklyAvg);

    // Oylik statistika
    document.getElementById('monthly-count').textContent = monthOrders.length;
    document.getElementById('monthly-sum').textContent = formatMoney(sumMonth);
    const monthlyAvg = monthOrders.length > 0 ? sumMonth / monthOrders.length : 0;
    document.getElementById('monthly-avg').textContent = formatMoney(monthlyAvg);

    // Holat bo'ylab statistika
    const statusCounts = {
        'new': orders.filter(o => o.status === 'new' || o.status === 'queue').length,
        'washing': orders.filter(o => o.status === 'washing').length,
        'ready': orders.filter(o => o.status === 'ready').length,
        'done': orders.filter(o => o.status === 'done').length
    };
    
    document.getElementById('status-new-count').textContent = statusCounts.new;
    document.getElementById('status-washing-count').textContent = statusCounts.washing;
    document.getElementById('status-ready-count').textContent = statusCounts.ready;
    document.getElementById('status-done-count').textContent = statusCounts.done;
}

function updateProductStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // 30 kunlik buyurtmalarni olish
    const periodOrders = orders.filter(o => new Date(o.createdAt) >= thirtyDaysAgo);
    
    const stats = {};
    let totalArea = 0;
    let totalCount = 0;

    periodOrders.forEach(o => {
        if (o.productItems && Array.isArray(o.productItems)) {
            o.productItems.forEach(p => {
                const name = p.name || 'Noma\'lum';
                if (!stats[name]) {
                    stats[name] = { name, emoji: p.emoji || '📦', count: 0, area: 0 };
                }
                stats[name].count += (parseFloat(p.count) || 0);
                stats[name].area += (parseFloat(p.area) || 0);
                totalCount += (parseFloat(p.count) || 0);
                totalArea += (parseFloat(p.area) || 0);
            });
        }
    });

    // Summary update
    document.getElementById('p-total-count').textContent = totalCount + ' ta';
    document.getElementById('p-total-area').textContent = totalArea.toFixed(1) + ' m²';
    
    const sorted = Object.values(stats).sort((a, b) => b.count - a.count);
    const top = sorted[0];
    document.getElementById('p-top-product').textContent = top ? `${top.emoji} ${top.name}` : '—';
    
    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${pad(thirtyDaysAgo.getDate())}.${pad(thirtyDaysAgo.getMonth()+1)}`;
    const endStr = `${pad(now.getDate())}.${pad(now.getMonth()+1)}`;
    document.getElementById('p-period').textContent = `${startStr} - ${endStr}`;

    // Table update
    const body = document.getElementById('product-ranking-body');
    if (!body) return;
    body.innerHTML = '';

    sorted.forEach((p, idx) => {
        const percent = totalCount > 0 ? ((p.count / totalCount) * 100).toFixed(1) : 0;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="#" style="font-weight:700; color:var(--gray);">#${idx + 1}</td>
            <td data-label="Mahsulot"><span style="font-size:20px; margin-right:10px;">${p.emoji}</span> <strong>${p.name}</strong></td>
            <td data-label="Soni">${p.count} ta</td>
            <td data-label="Maydoni (m²)">${p.area.toFixed(1)} m²</td>
            <td data-label="Ulushi (%)">
                <div style="display:flex; align-items:center; gap:10px; flex:1; justify-content:flex-end;">
                    <div style="flex:1; height:8px; background:#eee; border-radius:4px; overflow:hidden; max-width:100px;">
                        <div style="width:${percent}%; height:100%; background:var(--primary);"></div>
                    </div>
                    <span style="font-size:12px; font-weight:700; min-width:40px;">${percent}%</span>
                </div>
            </td>
        `;
        body.appendChild(tr);
    });
}

function displayAdminOrders() {
    applyAdminFilters();
}

function applyAdminFilters() {
    const q = document.getElementById('admin-search-input')?.value.toLowerCase() || "";
    const status = document.getElementById('filter-status')?.value || "all";
    const sortBy = document.getElementById('filter-sort')?.value || "newest";
    const dateRange = document.getElementById('filter-date')?.value || "all";

    const now = new Date();
    const today = todayStr();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);

    let filtered = orders.filter(o => {
        // Search filter
        const matchesSearch = 
            o.customerName.toLowerCase().includes(q) || 
            o.phone.includes(q) || 
            (o.displayId && o.displayId.includes(q)) ||
            (o.location && o.location.toLowerCase().includes(q));
        
        // Status filter
        const matchesStatus = status === 'all' || o.status === status || (status === 'new' && o.status === 'queue');
        
        // Date filter
        let matchesDate = true;
        if (dateRange === 'today') matchesDate = o.createdAt.startsWith(today);
        else if (dateRange === 'week') matchesDate = new Date(o.createdAt) >= weekAgo;
        else if (dateRange === 'month') matchesDate = new Date(o.createdAt) >= monthAgo;

        return matchesSearch && matchesStatus && matchesDate;
    });

    // Sorting logic
    filtered.sort((a, b) => {
        if (sortBy === 'newest') return new Date(b.createdAt) - new Date(a.createdAt);
        if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
        if (sortBy === 'expensive') return (b.price || 0) - (a.price || 0);
        if (sortBy === 'cheap') return (a.price || 0) - (b.price || 0);
        return 0;
    });

    renderFilteredOrders(filtered);
}

function renderFilteredOrders(filteredList) {
    const body = document.getElementById('adminOrdersBody');
    if (!body) return;
    body.innerHTML = '';

    if (filteredList.length === 0) {
        body.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--gray);">Buyurtmalar topilmadi</td></tr>`;
        return;
    }

    filteredList.forEach(o => {
        const sc = STATUS_CFG[o.status] || STATUS_CFG.new;
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            if (e.target.closest('button')) return;
            openOrderModal(o.id);
        };
        tr.innerHTML = `
            <td data-label="#ID">#${o.displayId}</td>
            <td data-label="Mijoz">
                <strong>${o.customerName}</strong><br>
                <small style="color:var(--gray);">${formatDateTime(o.createdAt)}</small>
            </td>
            <td data-label="Telefon">${o.phone}</td>
            <td data-label="Manzil">${o.location}</td>
            <td data-label="Summa">${formatMoney(o.price)}</td>
            <td data-label="Holat"><span style="color:${sc.color};font-weight:700;">${sc.label}</span></td>
            <td style="text-align:right;">
                <div style="display:flex; gap:5px; justify-content:flex-end;">
                    <button class="btn-action" onclick="openOrderModal(${o.id})" style="background:var(--light-secondary); color:var(--primary);"><i class="fas fa-eye"></i></button>
                    <button class="btn-action" onclick="deleteOrder(${o.id})" style="color:var(--danger); background:var(--bg);"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        body.appendChild(tr);
    });
}

function resetAdminFilters() {
    const searchInput = document.getElementById('admin-search-input');
    const statusSelect = document.getElementById('filter-status');
    const sortSelect = document.getElementById('filter-sort');
    const dateSelect = document.getElementById('filter-date');
    
    if (searchInput) searchInput.value = '';
    if (statusSelect) statusSelect.value = 'all';
    if (sortSelect) sortSelect.value = 'newest';
    if (dateSelect) dateSelect.value = 'all';
    
    applyAdminFilters();
}

function adminSearch(q) {
    applyAdminFilters();
}

function openOrderModal(id) {
    const order = orders.find(o => o.id == id);
    if (!order) return;

    const modal = document.getElementById('orderModal');
    const content = document.getElementById('orderModalContent');
    const sc = STATUS_CFG[order.status] || STATUS_CFG.new;

    content.innerHTML = `
        <div style="margin-bottom:20px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                <div>
                    <h2 style="margin:0;">Buyurtma #${order.displayId}</h2>
                    <div style="color:var(--gray); font-size:14px;">${formatDateTime(order.createdAt)}</div>
                </div>
                <div style="background:${sc.bg}; color:${sc.color}; padding:8px 15px; border-radius:12px; font-weight:700;">
                    ${sc.emoji} ${sc.label}
                </div>
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                <div style="padding:15px; background:var(--bg); border-radius:15px;">
                    <div style="font-size:12px; color:var(--gray); margin-bottom:5px;">👤 Mijoz</div>
                    <div style="font-weight:700;">${order.customerName || 'Noma\'lum'}</div>
                </div>
                <div style="padding:15px; background:var(--bg); border-radius:15px;">
                    <div style="font-size:12px; color:var(--gray); margin-bottom:5px;">📞 Telefon</div>
                    <div style="font-weight:700;">${order.phone}</div>
                </div>
                <div style="padding:15px; background:var(--bg); border-radius:15px; grid-column:1/-1;">
                    <div style="font-size:12px; color:var(--gray); margin-bottom:5px;">📍 Manzil</div>
                    <div style="font-weight:700;">${order.location}</div>
                </div>
            </div>

            <div style="margin-bottom:20px;">
                <h3 style="margin-bottom:10px; font-size:16px;"><i class="fas fa-boxes-stacked"></i> Mahsulotlar</h3>
                <div style="background:var(--bg); border-radius:15px; padding:10px;">
                    ${order.productItems && order.productItems.length ? order.productItems.map(p => `
                        <div style="display:flex; justify-content:space-between; padding:10px; border-bottom:1px solid #ddd;">
                            <span>${p.emoji || '📦'} ${p.name} (${p.count} ta)</span>
                            <strong>${p.area} m²</strong>
                        </div>
                    `).join('') : '<div style="padding:10px; color:var(--gray);">Mahsulotlar qo\'shilmagan</div>'}
                </div>
            </div>

            <div class="modal-info-grid" style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px;">
                <div style="padding:15px; background:var(--light-secondary); border-radius:15px;">
                    <div style="font-size:12px; color:var(--gray); margin-bottom:5px;">📏 Jami maydon</div>
                    <div style="font-weight:800; font-size:18px;">${order.totalArea || 0} m²</div>
                </div>
                <div style="padding:15px; background:var(--light-secondary); border-radius:15px;">
                    <div style="font-size:12px; color:var(--gray); margin-bottom:5px;">💰 Jami summa</div>
                    <div style="font-weight:800; font-size:18px; color:var(--primary);">${formatMoney(order.price)}</div>
                </div>
            </div>

            ${order.comment ? `
                <div style="padding:15px; background:#fff9c4; border-radius:15px; margin-bottom:20px;">
                    <div style="font-size:12px; color:#f57f17; margin-bottom:5px;">📝 Izoh</div>
                    <div style="font-size:14px;">${order.comment}</div>
                </div>
            ` : ''}

            <div style="display:flex; gap:10px;">
                <button class="btn-save" style="flex:1;" onclick="window.location.href='tel:${order.phone}'"><i class="fas fa-phone"></i> Qo'ng'iroq</button>
                <button class="btn-save" style="flex:1; background:var(--danger);" onclick="deleteOrder(${order.id}); closeOrderModal();"><i class="fas fa-trash"></i> O'chirish</button>
            </div>
        </div>
    `;

    modal.classList.add('show');
}

function closeOrderModal() {
    document.getElementById('orderModal').classList.remove('show');
}

function logoutAdmin() {
    localStorage.removeItem('admin_logged_in');
    window.location.href = 'index.html';
}

function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab').forEach(t => t.style.display = 'none');
    const targetTab = document.getElementById(`${tab}Tab`);
    if (targetTab) targetTab.style.display = 'block';
    
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }

    // Mobile specific: close sidebar if it was open
    const sidebar = document.getElementById('sidebar');
    if (window.innerWidth <= 900 && sidebar.classList.contains('show')) {
        toggleSidebar();
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const closeBtn = document.getElementById('sidebarClose');
    
    if (!sidebar || !overlay) return;

    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
    
    // Update close button visibility based on sidebar state
    if (window.innerWidth <= 900 && closeBtn) {
        closeBtn.style.display = sidebar.classList.contains('show') ? 'flex' : 'none';
    }
}

function savePrice() {
    const p = document.getElementById('global-price').value;
    localStorage.setItem('global_price', p);
    showToast('✅ Narx saqlandi: ' + p, 'success');
}

function deleteOrder(id) {
    if (!confirm('Ushbu buyurtmani butunlay o\'chirmoqchimisiz?')) return;
    supabaseFetch('DELETE', `orders?id=eq.${id}`, null, err => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('🗑️ O\'chirildi', 'info');
        loadAdminData();
    });
}
