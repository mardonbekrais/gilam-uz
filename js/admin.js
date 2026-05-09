// =================== ADMIN LOGIC ===================
let orders = [];
let productCatalog = [];
let enteredPin = "";

document.addEventListener('DOMContentLoaded', function() {
    if (localStorage.getItem('admin_logged_in') === 'true') {
        document.getElementById('loginOverlay').style.display = 'none';
        loadAdminData();
    }
    
    // Checkbox event listeners for product form (ADD)
    const checkFixed = document.getElementById('check-fixed');
    const checkSqm = document.getElementById('check-sqm');
    const checkKg = document.getElementById('check-kg');
    const checkMeter = document.getElementById('check-meter');
    
    if (checkFixed) {
        checkFixed.onchange = (e) => {
            document.getElementById('fixed-prices-input').style.display = e.target.checked ? 'grid' : 'none';
        };
    }
    
    if (checkSqm) {
        checkSqm.onchange = (e) => {
            document.getElementById('sqm-price-input').style.display = e.target.checked ? 'block' : 'none';
        };
    }

    if (checkKg) {
        checkKg.onchange = (e) => {
            document.getElementById('kg-price-input').style.display = e.target.checked ? 'block' : 'none';
        };
    }

    if (checkMeter) {
        checkMeter.onchange = (e) => {
            document.getElementById('meter-price-input').style.display = e.target.checked ? 'block' : 'none';
        };
    }

    // Checkbox event listeners for product form (EDIT)
    const editCheckFixed = document.getElementById('edit-check-fixed');
    const editCheckSqm = document.getElementById('edit-check-sqm');
    const editCheckKg = document.getElementById('edit-check-kg');
    const editCheckMeter = document.getElementById('edit-check-meter');
    
    if (editCheckFixed) {
        editCheckFixed.onchange = (e) => {
            document.getElementById('edit-fixed-prices-input').style.display = e.target.checked ? 'grid' : 'none';
        };
    }
    
    if (editCheckSqm) {
        editCheckSqm.onchange = (e) => {
            document.getElementById('edit-sqm-price-input').style.display = e.target.checked ? 'block' : 'none';
        };
    }

    if (editCheckKg) {
        editCheckKg.onchange = (e) => {
            document.getElementById('edit-kg-price-input').style.display = e.target.checked ? 'block' : 'none';
        };
    }

    if (editCheckMeter) {
        editCheckMeter.onchange = (e) => {
            document.getElementById('edit-meter-price-input').style.display = e.target.checked ? 'block' : 'none';
        };
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
    // 1. Orderlarni yuklash
    supabaseFetch('GET', 'orders?select=*&order=created_at.desc', null, function(err, data) {
        if (err) { showToast('❗ Xato: ' + err, 'error'); return; }
        orders = data.map(mapOrder);
        updateAdminUI();
    });

    // 2. Global narxni yuklash
    supabaseFetch('GET', 'settings?key=eq.global_price', null, function(err, data) {
        if (!err && data && data.length > 0) {
            document.getElementById('global-price').value = data[0].value;
        }
    });

    // 3. Mahsulotlar katalogini yuklash
    loadProductCatalog();
}

function loadProductCatalog() {
    supabaseFetch('GET', 'products?select=*&order=created_at.asc', null, function(err, data) {
        if (err) { showToast('❗ Katalog xatosi: ' + err, 'error'); return; }
        productCatalog = data;
        renderProductCatalog();
    });
}

function renderProductCatalog() {
    const body = document.getElementById('product-catalog-body');
    if (!body) return;
    body.innerHTML = '';

    if (productCatalog.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--gray);">Katalog bo\'sh</td></tr>';
        return;
    }

    productCatalog.forEach((p) => {
        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.onclick = (e) => {
            if (e.target.closest('button')) return;
            openEditProductModal(p.id);
        };
        
        let fixedInfo = p.has_fixed ? 
            `<div style="font-size:12px; line-height: 1.4;">
                <span style="color:var(--gray);">${translateType('S')}:</span> ${formatMoney(p.price_s)}<br>
                <span style="color:var(--gray);">${translateType('M')}:</span> ${formatMoney(p.price_m)}<br>
                <span style="color:var(--gray);">${translateType('L')}:</span> ${formatMoney(p.price_l)}
            </div>` : 
            '<span style="color:var(--gray-light);">—</span>';
            
        let sqmInfo = p.has_sqm ? 
            `<strong>${formatMoney(p.price_sqm)}</strong>` : 
            '<span style="color:var(--gray-light);">—</span>';

        let kgInfo = p.has_kg ? 
            `<strong>${formatMoney(p.price_kg)}</strong>` : 
            '<span style="color:var(--gray-light);">—</span>';

        let meterInfo = p.has_meter ? 
            `<strong>${formatMoney(p.price_meter)}</strong>` : 
            '<span style="color:var(--gray-light);">—</span>';

        tr.innerHTML = `
            <td data-label="Emoji" style="font-size:24px;">${p.emoji}</td>
            <td data-label="Nomi"><strong>${p.name}</strong></td>
            <td data-label="O'lchamli">${fixedInfo}</td>
            <td data-label="Kv. Metr">${sqmInfo}</td>
            <td data-label="KG">${kgInfo}</td>
            <td data-label="Metr">${meterInfo}</td>
            <td style="text-align:right;">
                <div style="display:flex; gap:5px; justify-content:flex-end;">
                    <button class="btn-action" style="color:var(--primary); background:var(--bg);" onclick="openEditProductModal(${p.id})"><i class="fas fa-edit"></i></button>
                    <button class="btn-action" style="color:var(--danger); background:var(--bg);" onclick="deleteFromCatalog(${p.id})"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        `;
        body.appendChild(tr);
    });
}

function openEditProductModal(id) {
    const p = productCatalog.find(item => item.id == id);
    if (!p) return;

    document.getElementById('edit-p-id').value = p.id;
    document.getElementById('edit-p-emoji').value = p.emoji;
    document.getElementById('edit-p-name').value = p.name;
    
    const checkFixed = document.getElementById('edit-check-fixed');
    const checkSqm = document.getElementById('edit-check-sqm');
    const checkKg = document.getElementById('edit-check-kg');
    const checkMeter = document.getElementById('edit-check-meter');
    
    checkFixed.checked = p.has_fixed;
    checkSqm.checked = p.has_sqm;
    checkKg.checked = p.has_kg;
    checkMeter.checked = p.has_meter || false;
    
    document.getElementById('edit-p-s').value = p.price_s || '';
    document.getElementById('edit-p-m').value = p.price_m || '';
    document.getElementById('edit-p-l').value = p.price_l || '';
    document.getElementById('edit-p-sqm').value = p.price_sqm || '';
    document.getElementById('edit-p-kg').value = p.price_kg || '';
    document.getElementById('edit-p-meter').value = p.price_meter || '';
    
    document.getElementById('edit-fixed-prices-input').style.display = p.has_fixed ? 'grid' : 'none';
    document.getElementById('edit-sqm-price-input').style.display = p.has_sqm ? 'block' : 'none';
    document.getElementById('edit-kg-price-input').style.display = p.has_kg ? 'block' : 'none';
    document.getElementById('edit-meter-price-input').style.display = p.has_meter ? 'block' : 'none';
    
    document.getElementById('productEditModal').classList.add('show');
}

function closeProductEditModal() {
    document.getElementById('productEditModal').classList.remove('show');
}

function saveProductUpdate() {
    const id = document.getElementById('edit-p-id').value;
    const emoji = document.getElementById('edit-p-emoji').value.trim() || '📦';
    const name = document.getElementById('edit-p-name').value.trim();
    
    const hasFixed = document.getElementById('edit-check-fixed').checked;
    const hasSqm = document.getElementById('edit-check-sqm').checked;
    const hasKg = document.getElementById('edit-check-kg').checked;
    const hasMeter = document.getElementById('edit-check-meter').checked;

    if (!name) { showToast('❌ Mahsulot nomini kiriting', 'error'); return; }
    if (!hasFixed && !hasSqm && !hasKg && !hasMeter) { showToast('❌ Kamida bitta hisoblash turini tanlang', 'error'); return; }

    const updatedData = { 
        emoji, 
        name,
        has_fixed: hasFixed,
        has_sqm: hasSqm,
        has_kg: hasKg,
        has_meter: hasMeter,
        price_s: hasFixed ? (parseFloat(document.getElementById('edit-p-s').value) || 0) : 0,
        price_m: hasFixed ? (parseFloat(document.getElementById('edit-p-m').value) || 0) : 0,
        price_l: hasFixed ? (parseFloat(document.getElementById('edit-p-l').value) || 0) : 0,
        price_sqm: hasSqm ? (parseFloat(document.getElementById('edit-p-sqm').value) || 0) : 0,
        price_kg: hasKg ? (parseFloat(document.getElementById('edit-p-kg').value) || 0) : 0,
        price_meter: hasMeter ? (parseFloat(document.getElementById('edit-p-meter').value) || 0) : 0
    };
    
    supabaseFetch('PATCH', `products?id=eq.${id}`, updatedData, (err) => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('✅ Mahsulot yangilandi', 'success');
        closeProductEditModal();
        loadProductCatalog();
    });
}

function addNewProductType() {
    const emoji = document.getElementById('new-p-emoji').value.trim() || '📦';
    const name = document.getElementById('new-p-name').value.trim();
    
    const hasFixed = document.getElementById('check-fixed').checked;
    const hasSqm = document.getElementById('check-sqm').checked;
    const hasKg = document.getElementById('check-kg').checked;
    const hasMeter = document.getElementById('check-meter').checked;

    if (!name) { showToast('❌ Mahsulot nomini kiriting', 'error'); return; }
    if (!hasFixed && !hasSqm && !hasKg && !hasMeter) { showToast('❌ Kamida bitta hisoblash turini tanlang', 'error'); return; }

    const newProduct = { 
        emoji, 
        name,
        has_fixed: hasFixed,
        has_sqm: hasSqm,
        has_kg: hasKg,
        has_meter: hasMeter,
        price_s: hasFixed ? (parseFloat(document.getElementById('new-p-s').value) || 0) : 0,
        price_m: hasFixed ? (parseFloat(document.getElementById('new-p-m').value) || 0) : 0,
        price_l: hasFixed ? (parseFloat(document.getElementById('new-p-l').value) || 0) : 0,
        price_sqm: hasSqm ? (parseFloat(document.getElementById('new-p-sqm').value) || 0) : 0,
        price_kg: hasKg ? (parseFloat(document.getElementById('new-p-kg').value) || 0) : 0,
        price_meter: hasMeter ? (parseFloat(document.getElementById('new-p-meter').value) || 0) : 0
    };
    
    supabaseFetch('POST', 'products', newProduct, (err) => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('✅ Mahsulot katalogga qo\'shildi', 'success');
        
        // Formani tozalash
        document.getElementById('new-p-name').value = '';
        document.getElementById('new-p-s').value = '';
        document.getElementById('new-p-m').value = '';
        document.getElementById('new-p-l').value = '';
        document.getElementById('new-p-sqm').value = '';
        document.getElementById('new-p-kg').value = '';
        document.getElementById('new-p-meter').value = '';
        document.getElementById('check-fixed').checked = false;
        document.getElementById('check-sqm').checked = false;
        document.getElementById('check-kg').checked = false;
        document.getElementById('check-meter').checked = false;
        document.getElementById('fixed-prices-input').style.display = 'none';
        document.getElementById('sqm-price-input').style.display = 'none';
        document.getElementById('kg-price-input').style.display = 'none';
        document.getElementById('meter-price-input').style.display = 'none';
        
        loadProductCatalog();
    });
}

function updateCatalogPrice(id, newPrice) {
    const price = parseFloat(newPrice) || 0;
    supabaseFetch('PATCH', `products?id=eq.${id}`, { price }, (err) => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('✅ Narx yangilandi', 'success');
        loadProductCatalog();
    });
}

function deleteFromCatalog(id) {
    if (!confirm('Ushbu mahsulotni katalogdan o\'chirmoqchimisiz?')) return;
    supabaseFetch('DELETE', `products?id=eq.${id}`, null, (err) => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('🗑️ Katalogdan o\'chirildi', 'info');
        loadProductCatalog();
    });
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
        'new': orders.filter(o => ['new', 'active'].includes(o.status)).length,
        'washing': orders.filter(o => ['ready_to_wash', 'washing', 'packing'].includes(o.status)).length,
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
            o.productItems.forEach(group => {
                const name = group.name || 'Noma\'lum';
                if (!stats[name]) {
                    stats[name] = { name, emoji: group.emoji || '📦', count: 0, area: 0 };
                }
                
                // Backward compatibility: if group.items is missing, it's an old format item
                const items = group.items || [{
                    type: group.type || 'sqm',
                    area: group.area || 0,
                    count: group.count || 0,
                    price: group.price || 0
                }];
                
                items.forEach(item => {
                    if (item.type === 'sqm') {
                        stats[name].area += (parseFloat(item.area) || 0);
                        stats[name].count += 1;
                        totalArea += (parseFloat(item.area) || 0);
                        totalCount += 1;
                    } else {
                        stats[name].count += (parseFloat(item.count) || 0);
                        totalCount += (parseFloat(item.count) || 0);
                        if (item.type === 'KG') {
                            stats[name].area += (parseFloat(item.count) || 0);
                            totalArea += (parseFloat(item.count) || 0);
                        }
                    }
                });
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
        const matchesStatus = status === 'all' || o.status === status;
        
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
                <div style="background:var(--bg); border-radius:15px; padding:5px;">
                    ${order.productItems && order.productItems.length ? order.productItems.map(group => {
                        // Backward compatibility: if group.items is missing, it's an old format item
                        const items = group.items || [{
                            type: group.type || 'sqm',
                            area: group.area || 0,
                            count: group.count || 0,
                            price: group.price || 0
                        }];
                        
                        return `
                            <div style="margin-bottom:10px; padding:10px; background:#fff; border-radius:10px; border:1px solid #eee;">
                                <div style="font-weight:700; margin-bottom:5px; border-bottom:1px solid #f0f0f0; padding-bottom:5px;">${group.emoji || '📦'} ${group.name}</div>
                                ${items.map(item => `
                                    <div style="display:flex; justify-content:space-between; font-size:13px; color:var(--gray); margin-bottom:3px;">
                                        <span>${translateType(item.type)}: ${item.count || 1} ta ${item.type === 'sqm' ? '(' + (item.area || 0).toFixed(2) + ' m²)' : (item.type === 'KG' ? '(' + (item.area || 0).toFixed(1) + ' kg)' : (item.type === 'meter' ? '(' + (item.value || 0).toFixed(1) + ' m)' : ''))}</span>
                                        <strong style="color:var(--dark);">${formatMoney(item.type === 'sqm' || item.type === 'KG' ? (item.area || 0) * (item.price || 0) : (item.type === 'meter' ? (item.value || 0) * (item.price || 0) : (item.count || 0) * (item.price || 0)))}</strong>
                                    </div>
                                `).join('')}
                            </div>
                        `;
                    }).join('') : '<div style="padding:10px; color:var(--gray);">Mahsulotlar qo\'shilmagan</div>'}
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
    supabaseFetch('PATCH', 'settings?key=eq.global_price', { value: p }, (err) => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('✅ Narx saqlandi: ' + p, 'success');
    });
}

function deleteOrder(id) {
    if (!confirm('Ushbu buyurtmani butunlay o\'chirmoqchimisiz?')) return;
    supabaseFetch('DELETE', `orders?id=eq.${id}`, null, err => {
        if (err) { showToast('❌ Xato: ' + err, 'error'); return; }
        showToast('🗑️ O\'chirildi', 'info');
        loadAdminData();
    });
}
