// =================== GILAM ZAKAZ - SCRIPT v7.0 ===================

var SUPABASE_URL = 'https://qscvtxtgbwbshkrqklgk.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzY3Z0eHRnYndic2hrcnFrbGdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzc3MDcsImV4cCI6MjA5MDgxMzcwN30.usjIv2xDGTcNOMV7rwZMEV7P7f8MmelDqHnDiO4WHAA';

// =================== STATUS CONFIG ===================
var STATUS_CFG = {
    new:     { label: 'Kutilmoqda', emoji: '⏳', color: '#ff9800', bg: '#fff3e0' },
    queue:   { label: 'Kutilmoqda', emoji: '⏳', color: '#ff9800', bg: '#fff3e0' },
    washing: { label: 'Yuvilmoqda', emoji: '🧼', color: '#2196f3', bg: '#e3f2fd' },
    ready:   { label: 'Tayyor',     emoji: '✅', color: '#4caf50', bg: '#e8f5e9' },
    done:    { label: 'Yetkazildi', emoji: '🚚', color: '#9c27b0', bg: '#f3e5f5' }
};

// =================== STATE ===================
var orders = [];
var currentPage = 'home';
var currentImageIndex = 0;
var imageGallery = [];
var currentOrderId = null;
var PRICE_PER_SQM = 80000;
var productItemsList = [];
var productItemCounter = 0;
var selectedLocation = null;
var selectedSource = '';
var currentTodayFilter = 'all';

var PRODUCT_PRICES = {
    gilam:    { emoji:'🧺', name:'Gilam',    pricingType:'sqm',   pricePerSqm:80000,  pricePerMeter:0,     priceSmall:0,     priceLarge:0,     pricePerKg:0 },
    adyol:    { emoji:'🛏️', name:'Adyol',    pricingType:'size',  pricePerSqm:0,      pricePerMeter:0,     priceSmall:40000, priceLarge:70000, pricePerKg:0 },
    yakandoz: { emoji:'🪣', name:'Yakandoz', pricingType:'meter', pricePerSqm:0,      pricePerMeter:50000, priceSmall:0,     priceLarge:0,     pricePerKg:0 },
    parda:    { emoji:'🪟', name:'Parda',    pricingType:'kg',    pricePerSqm:0,      pricePerMeter:0,     priceSmall:0,     priceLarge:0,     pricePerKg:15000 },
    korpa:    { emoji:'🛌', name:"Ko'rpa",   pricingType:'size',  pricePerSqm:0,      pricePerMeter:0,     priceSmall:35000, priceLarge:60000, pricePerKg:0 }
};

// =================== INIT ===================
document.addEventListener('DOMContentLoaded', function() {
    var savedPrice = localStorage.getItem('gilam_global_price');
    if (savedPrice && parseInt(savedPrice) >= 1000) {
        PRICE_PER_SQM = parseInt(savedPrice);
        PRODUCT_PRICES.gilam.pricePerSqm = PRICE_PER_SQM;
    }
    loadProductPricesFromAdmin();

    // Set today's date as default washing date
    var washEl = document.getElementById('fo-washdate');
    if (washEl) washEl.value = todayStr();

    loadOrdersFromDB(function() {
        updateStats();
        displayRecentOrders();
        displayTodayPreview();
        updateTodayBadge();
        updateDateTime();
        updateProfileStats();
        setTimeout(function() {
            var ls = document.getElementById('loadingScreen');
            if (ls) ls.classList.add('hide');
        }, 600);
        startAutoRefresh();
    });
});

function startAutoRefresh() {
    setInterval(function() {
        loadOrdersFromDB(function() {
            updateStats();
            displayRecentOrders();
            displayTodayPreview();
            updateTodayBadge();
            updateProfileStats();
            if (currentPage === 'today')   displayTodayOrders();
            if (currentPage === 'profile') updateProfileStats();
        });
    }, 8000);
}

function todayStr() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
}

// =================== SUPABASE ===================
function supabaseFetch(method, path, data, callback) {
    var url = SUPABASE_URL + '/rest/v1/' + path;
    var headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': 'Bearer ' + SUPABASE_KEY
    };
    if (method === 'POST' || method === 'PATCH') headers['Prefer'] = 'return=representation';
    var opts = { method: method, headers: headers };
    if (data !== null && data !== undefined) opts.body = JSON.stringify(data);
    fetch(url, opts)
        .then(function(r) {
            if (r.status === 204) return null;
            if (!r.ok) return r.text().then(function(t) {
                var msg = t;
                try { var j = JSON.parse(t); msg = j.message || j.hint || j.error || t; } catch(e) {}
                throw new Error(msg);
            });
            var ct = r.headers.get('content-type');
            if (ct && ct.includes('application/json')) return r.json();
            return null;
        })
        .then(function(res) { callback(null, res); })
        .catch(function(e) { callback(e.message || 'Network xato', null); });
}

// =================== DB OPERATIONS ===================
function loadOrdersFromDB(callback) {
    supabaseFetch('GET', 'orders?select=*&order=created_at.desc', null, function(err, data) {
        if (err) {
            showToast('❗ Yuklanmadi: ' + err, 'error');
            orders = [];
            if (callback) callback();
            return;
        }
        if (!data || !Array.isArray(data)) { orders = []; if (callback) callback(); return; }
        orders = data.map(mapRow);
        if (callback) callback();
    });
}

function mapRow(o) {
    return {
        id:           o.id,
        displayId:    o.display_id,
        customerName: o.customer_name || '',
        phone:        o.phone,
        location:     o.location,
        gpsCoords:    o.gps_coords,
        orderSource:  o.order_source,
        width:        o.width,
        height:       o.height,
        price:        o.price,
        pricePerSqm:  o.price_per_sqm,
        totalArea:    o.total_area,
        productType:  o.product_type,
        productEmoji: o.product_emoji,
        productItems: o.product_items,
        comment:      o.comment,
        images:       o.images,
        washingDate:  o.washing_date,
        createdAt:    o.created_at,
        status:       o.status || 'new',
        paymentStatus: o.payment_status || 'unpaid',
        paymentMethod: o.payment_method,
        paidAt:       o.paid_at,
        queueNumber:  o.queue_number
    };
}

function orderToRow(order) {
    var row = {
        id:             order.id,
        display_id:     order.displayId,
        customer_name:  order.customerName || null,
        phone:          order.phone,
        location:       order.location,
        width:          order.width,
        height:         order.height,
        price:          order.price,
        price_per_sqm:  order.pricePerSqm,
        total_area:     order.totalArea,
        product_type:   order.productType,
        product_emoji:  order.productEmoji,
        product_items:  order.productItems,
        comment:        order.comment,
        images:         order.images,
        washing_date:   order.washingDate || null,
        created_at:     order.createdAt,
        status:         order.status,
        payment_status: order.paymentStatus,
        payment_method: order.paymentMethod,
        paid_at:        order.paidAt,
        queue_number:   order.queueNumber
    };
    if (order.gpsCoords) row.gps_coords = order.gpsCoords;
    if (order.orderSource) row.order_source = order.orderSource;
    return row;
}

function saveOrderToDB(order, callback) {
    var row = orderToRow(order);
    row.id = Number(row.id);
    supabaseFetch('POST', 'orders', row, function(err) {
        if (err) { callback('Saqlash xato: ' + err); return; }
        callback(null);
    });
}

function updateOrderInDB(order, callback) {
    var row = orderToRow(order);
    delete row.id;
    supabaseFetch('PATCH', 'orders?id=eq.' + Number(order.id), row, function(err) {
        if (err) { if (callback) callback('Yangilash xato: ' + err); return; }
        if (callback) callback(null);
    });
}

function deleteOrderFromDB(id, callback) {
    supabaseFetch('DELETE', 'orders?id=eq.' + Number(id), null, function(err) {
        if (err) { if (callback) callback('Ochirish xato: ' + err); return; }
        if (callback) callback(null);
    });
}

// =================== NAVIGATION ===================
function switchPage(page) {
    document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
    var nav = document.querySelector('[data-page="' + page + '"]');
    if (nav) nav.classList.add('active');
    document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
    var pg = document.getElementById(page + 'Page');
    if (pg) pg.classList.add('active');
    currentPage = page;
    if (page === 'home')    { updateStats(); displayRecentOrders(); displayTodayPreview(); }
    if (page === 'neworder') { resetNewOrderForm(); }
    if (page === 'today')   { displayTodayOrders(); updateTodayLabel(); }
    if (page === 'profile') { updateProfileStats(); updateCurrentPriceDisplay(); }
}

function updateDateTime() {
    var el = document.getElementById('currentDate');
    if (!el) return;
    var now = new Date();
    var months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    var days = ['Yakshanba','Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba'];
    el.textContent = days[now.getDay()] + ', ' + now.getDate() + ' ' + months[now.getMonth()];
}

function updateTodayLabel() {
    var el = document.getElementById('todayDateLabel');
    if (!el) return;
    var now = new Date();
    var months = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
    el.textContent = now.getDate() + ' ' + months[now.getMonth()] + ' ' + now.getFullYear();
}

// =================== STATS ===================
function updateStats() {
    var today = todayStr();
    var todayOrders = orders.filter(function(o) {
        var createdDate = o.createdAt ? o.createdAt.split('T')[0] : '';
        return o.washingDate === today || createdDate === today;
    });
    var totalArea = orders.reduce(function(s,o) { return s + (parseFloat(o.totalArea)||0); }, 0);
    
    // Bugun olib kelingan zakazlar summasi
    var todayRevenue = todayOrders.reduce(function(s,o) { return s + (parseFloat(o.price)||0); }, 0);

    var t1 = document.getElementById('totalOrdersStat'); if (t1) t1.textContent = orders.length;
    var t2 = document.getElementById('todayOrdersStat'); if (t2) t2.textContent = todayOrders.length;
    var t3 = document.getElementById('totalAreaStat');   if (t3) t3.textContent = totalArea.toFixed(1);
    var t4 = document.getElementById('todayRevenueStat'); if (t4) {
        if (todayRevenue >= 1000000) t4.textContent = (todayRevenue/1000000).toFixed(1) + 'M';
        else if (todayRevenue >= 1000) t4.textContent = (todayRevenue/1000).toFixed(0) + 'k';
        else t4.textContent = todayRevenue;
    }
}

function updateTodayBadge() {
    var today = todayStr();
    var count = orders.filter(function(o) { return o.washingDate === today && o.status !== 'done'; }).length;
    var badge = document.getElementById('todayBadge');
    if (badge) {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'block' : 'none';
    }
}

// =================== HOME PAGE ===================
function displayRecentOrders() {
    var container = document.getElementById('recentOrders');
    if (!container) return;
    var recent = orders.slice(0, 5);
    if (recent.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>Zakazlar yo\'q</p></div>';
        return;
    }
    container.innerHTML = '';
    recent.forEach(function(order) {
        container.appendChild(makeOrderCard(order));
    });
}

function displayTodayPreview() {
    var container = document.getElementById('todayPreview');
    if (!container) return;
    var today = todayStr();
    var todayOrders = orders.filter(function(o) { return o.washingDate === today; })
        .sort(function(a,b) { return (a.queueNumber||999) - (b.queueNumber||999); })
        .slice(0, 3);
    if (todayOrders.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-day"></i><p>Bugun uchun zakaz yo\'q</p></div>';
        return;
    }
    container.innerHTML = '';
    todayOrders.forEach(function(order, idx) {
        container.appendChild(makeTodayCard(order, idx));
    });
}

// =================== BUGUNGI PAGE ===================
function displayTodayOrders() {
    var container = document.getElementById('todayOrdersList');
    if (!container) return;
    var today = todayStr();
    var todayOrders = orders.filter(function(o) { return o.washingDate === today; });
    if (currentTodayFilter !== 'all') {
        if (currentTodayFilter === 'new') {
            todayOrders = todayOrders.filter(function(o) { return o.status === 'new' || o.status === 'queue'; });
        } else {
            todayOrders = todayOrders.filter(function(o) { return o.status === currentTodayFilter; });
        }
    }
    todayOrders.sort(function(a,b) { return (a.queueNumber||999) - (b.queueNumber||999); });

    var totalEl = document.getElementById('todayTotal');
    if (totalEl) totalEl.textContent = todayOrders.length + ' ta';

    if (todayOrders.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-day"></i><p>Bugungi zakaz yo\'q</p></div>';
        return;
    }
    container.innerHTML = '';
    todayOrders.forEach(function(order, idx) {
        container.appendChild(makeTodayCard(order, idx));
    });
}

function setTodayFilter(btn, filter) {
    currentTodayFilter = filter;
    document.querySelectorAll('#todayPage .chip').forEach(function(c) { c.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    displayTodayOrders();
}

function makeTodayCard(order, idx) {
    var sc = STATUS_CFG[order.status] || STATUS_CFG.new;
    var showId = order.displayId || String(order.id).slice(-6);
    var area = (parseFloat(order.totalArea)||0).toFixed(1);
    var div = document.createElement('div');
    div.className = 'queue-item status-' + order.status;

    var qNum = order.queueNumber || (idx + 1);
    var nameOrPhone = order.customerName ? order.customerName : (order.phone || '');

    div.innerHTML =
        '<div class="queue-number" style="background:' + sc.color + ';">' + qNum + '</div>' +
        '<div class="queue-info">' +
            '<div class="queue-phone"><strong>' + sc.emoji + ' ' + nameOrPhone + '</strong></div>' +
            '<div class="queue-time">📍 ' + (order.location||'—') + ' · ' + area + ' m²</div>' +
            '<div class="queue-time">' +
                '<span class="order-status-pill status-' + order.status + '">' + sc.label + '</span>' +
                ' · ' + Number(order.price||0).toLocaleString() + " so'm" +
            '</div>' +
        '</div>';
    div.onclick = function() { openDetailsModal(order); };
    return div;
}

function makeOrderCard(order) {
    var sc = STATUS_CFG[order.status] || STATUS_CFG.new;
    var showId = order.displayId || String(order.id).slice(-6);
    var div = document.createElement('div');
    div.className = 'order-card status-' + order.status;
    var nameOrPhone = order.customerName ? (order.customerName + ' · ' + (order.phone||'')) : (order.phone||'');
    div.innerHTML =
        '<div class="order-header">' +
            '<span class="order-id">#' + showId + '</span>' +
            '<span class="order-status-pill status-' + order.status + '">' + sc.emoji + ' ' + sc.label + '</span>' +
        '</div>' +
        '<div class="order-phone">' + (order.productEmoji||'🧺') + ' ' + nameOrPhone + '</div>' +
        '<div class="order-details">' +
            '<span>📍 ' + (order.location||'') + '</span>' +
            '<span>' + Number(order.price||0).toLocaleString() + " so'm</span>" +
        '</div>' +
        (order.washingDate ? '<div class="order-details"><span>📅 Yuvish: ' + order.washingDate + '</span></div>' : '');
    div.onclick = function() { openDetailsModal(order); };
    return div;
}

// =================== PROFIL PAGE ===================
function updateProfileStats() {
    var today = todayStr();
    var now = new Date();
    var weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
    var monthStart = new Date(); monthStart.setMonth(monthStart.getMonth() - 1);

    var todayO = orders.filter(function(o) { 
        var createdDate = o.createdAt ? o.createdAt.split('T')[0] : '';
        return o.washingDate === today || createdDate === today; 
    });
    
    var weekO = orders.filter(function(o) {
        if(!o.createdAt) return false;
        var d = new Date(o.createdAt);
        return d >= weekStart;
    });
    
    var monthO = orders.filter(function(o) {
        if(!o.createdAt) return false;
        var d = new Date(o.createdAt);
        return d >= monthStart;
    });

    var paidRev = orders.filter(function(o) { return o.paymentStatus === 'paid'; }).reduce(function(s,o) { return s + (parseFloat(o.price)||0); }, 0);
    var readyCount = orders.filter(function(o) { return o.status === 'ready' || o.status === 'done'; }).length;

    var el1 = document.getElementById('profJami');    if (el1) el1.textContent = orders.length;
    var el2 = document.getElementById('profTayyor');  if (el2) el2.textContent = readyCount;
    var el3 = document.getElementById('profDaromad'); if (el3) el3.textContent = (paidRev >= 1000000 ? (paidRev/1000000).toFixed(1) + 'M' : (paidRev/1000).toFixed(0) + 'k');

    var todayRev  = todayO.filter(function(o){ return o.paymentStatus==='paid'; }).reduce(function(s,o){ return s+(parseFloat(o.price)||0); }, 0);
    var weekRev   = weekO.filter(function(o){ return o.paymentStatus==='paid'; }).reduce(function(s,o){ return s+(parseFloat(o.price)||0); }, 0);
    var monthRev  = monthO.filter(function(o){ return o.paymentStatus==='paid'; }).reduce(function(s,o){ return s+(parseFloat(o.price)||0); }, 0);

    var paid = orders.filter(function(o){ return o.paymentStatus==='paid'; }).length;
    var qCount = orders.filter(function(o){ return ['new','queue','washing'].indexOf(o.status) >= 0; }).length;

    var box = document.getElementById('profStatsBox');
    if (box) {
        box.innerHTML =
            '<div class="stat-row"><span class="stat-row-label">📅 Bugungi zakazlar (jami)</span><span class="stat-row-value">' + todayO.length + '</span></div>' +
            '<div class="stat-row"><span class="stat-row-label">💰 Bugungi daromad</span><span class="stat-row-value">' + todayRev.toLocaleString() + " so'm</span></div>" +
            '<div class="stat-row"><span class="stat-row-label">📈 Haftalik daromad</span><span class="stat-row-value">' + weekRev.toLocaleString() + " so'm</span></div>" +
            '<div class="stat-row"><span class="stat-row-label">📊 Oylik daromad</span><span class="stat-row-value">' + monthRev.toLocaleString() + " so'm</span></div>" +
            '<div class="stat-row"><span class="stat-row-label">✅ To\'langan</span><span class="stat-row-value">' + paid + '</span></div>' +
            '<div class="stat-row"><span class="stat-row-label">❌ To\'lanmagan</span><span class="stat-row-value">' + (orders.length - paid) + '</span></div>' +
            '<div class="stat-row"><span class="stat-row-label">⏳ Jarayonda</span><span class="stat-row-value">' + qCount + '</span></div>';
    }
}

function updateCurrentPriceDisplay() {
    var el = document.getElementById('profCurrentPrice');
    if (el) el.textContent = 'Hozir: ' + PRICE_PER_SQM.toLocaleString() + " so'm/m²";
}

function openPriceSettings() {
    var modal = document.getElementById('priceModal');
    var input = document.getElementById('priceInput');
    if (input) input.value = PRICE_PER_SQM;
    updatePricePreview();
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function updatePricePreview() {
    var val = parseInt(document.getElementById('priceInput').value) || 80000;
    var el1 = document.getElementById('pricePreviewVal');
    var el2 = document.getElementById('pricePreviewTotal');
    if (el1) el1.textContent = val.toLocaleString();
    if (el2) el2.textContent = (6 * val).toLocaleString();
}

function savePriceSettings() {
    var val = parseInt(document.getElementById('priceInput').value);
    if (!val || val < 1000) { showToast('❌ Kamida 1,000 so\'m kiriting', 'error'); return; }
    PRICE_PER_SQM = val;
    PRODUCT_PRICES.gilam.pricePerSqm = val;
    localStorage.setItem('gilam_global_price', val);
    var savedPrices = JSON.parse(localStorage.getItem('gilam_product_prices_v2') || '{}');
    savedPrices.gilam = { pricePerSqm: val };
    localStorage.setItem('gilam_product_prices_v2', JSON.stringify(savedPrices));
    closeModal(document.getElementById('priceModal'));
    updateCurrentPriceDisplay();
    showToast('✅ Narx saqlandi: ' + val.toLocaleString() + " so'm/m²", 'success');
}

// =================== LOAD PRODUCT PRICES ===================
function loadProductPricesFromAdmin() {
    var saved = localStorage.getItem('gilam_product_prices_v2');
    if (saved) {
        try {
            var parsed = JSON.parse(saved);
            Object.keys(parsed).forEach(function(key) {
                if (PRODUCT_PRICES[key]) Object.assign(PRODUCT_PRICES[key], parsed[key]);
            });
            if (parsed.gilam && parsed.gilam.pricePerSqm) {
                PRICE_PER_SQM = parsed.gilam.pricePerSqm;
            }
        } catch(e) {}
    }
}

// =================== GPS LOCATION CAPTURE ===================
function captureGPSLocation() {
    var btn = document.getElementById('fo-gps-btn');
    if (!btn) return;
    
    btn.disabled = true;
    btn.textContent = '⏳ Uzilmoqda...';
    
    if (!navigator.geolocation) {
        showToast('❌ GPS qo\'llab-quvvatlanmadi', 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-location-arrow"></i> GPS';
        return;
    }
    
    navigator.geolocation.getCurrentPosition(function(position) {
        var lat = position.coords.latitude;
        var lng = position.coords.longitude;
        var coords = lat.toFixed(6) + ',' + lng.toFixed(6);
        
        document.getElementById('fo-gps-coords').value = coords;
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> GPS';
        btn.style.background = '#4caf50';
        
        showToast('✅ Lokatsiya qabul qilindi', 'success');
        
        setTimeout(function() {
            btn.innerHTML = '<i class="fas fa-location-arrow"></i> GPS';
            btn.style.background = '#667eea';
        }, 2000);
    }, function(error) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-location-arrow"></i> GPS';
        
        var msg = 'GPS xato';
        if (error.code === error.PERMISSION_DENIED) msg = 'GPS ruxsati rad etildi';
        else if (error.code === error.POSITION_UNAVAILABLE) msg = 'GPS mavjud emas';
        else if (error.code === error.TIMEOUT) msg = 'GPS timeout';
        
        showToast('❌ ' + msg, 'error');
    });
}

// =================== NEW ORDER FORM ===================
function resetNewOrderForm() {
    var ids = ['fo-name', 'fo-phone', 'fo-village', 'fo-comment', 'fo-gps-coords'];
    ids.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    var washEl = document.getElementById('fo-washdate');
    if (washEl) washEl.value = todayStr();
    productItemsList = [];
    productItemCounter = 0;
    renderProductItems('fo-productItemsList', 'fo-totalCalcBox', 'fo-livePrice', 'fo-liveItemCount');
    selectedLocation = null;
    selectedSource = '';
}

function saveOrderFull() {
    var nameEl   = document.getElementById('fo-name');
    var phoneEl  = document.getElementById('fo-phone');
    var villageEl= document.getElementById('fo-village');
    var washEl   = document.getElementById('fo-washdate');
    var commentEl= document.getElementById('fo-comment');

    var name    = nameEl   ? nameEl.value.trim()   : '';
    var phone   = phoneEl  ? getRawPhone(phoneEl)  : '';
    var village = villageEl? villageEl.value.trim() : '';
    var washDate= washEl   ? washEl.value          : '';
    var comment = commentEl? commentEl.value.trim() : '';

    if (!phone)    { showToast('❌ Telefon kiriting', 'error'); return; }
    if (phone.length !== 9) { showToast('❌ 9 raqamli bo\'lishi kerak', 'error'); return; }
    if (!village)  { showToast('❌ Manzil kiriting', 'error'); return; }
    if (productItemsList.length === 0) { showToast("❌ Kamida 1 ta mahsulot qo'shing", 'error'); return; }

    var saveBtn = document.getElementById('fo-saveBtn');
    if (saveBtn) saveBtn.disabled = true;
    showToast('Saqlanmoqda...', 'info');

    var fullPhone    = '+998' + phone;
    var totalPrice   = productItemsList.reduce(function(s,i) { return s + (i.price||0); }, 0);
    var totalArea    = productItemsList.reduce(function(s,i) { return s + (i.area||0); }, 0);
    var firstItem    = productItemsList[0];
    var productType  = productItemsList.map(function(i) { return i.name; }).join(', ');
    var productEmoji = firstItem ? firstItem.emoji : '🧺';
    var pricePerSqm  = firstItem ? firstItem.pricePerSqm : PRICE_PER_SQM;

    // Auto queue number
    var maxQ = Math.max.apply(null, [0].concat(
        orders.filter(function(o) { return o.queueNumber; }).map(function(o) { return o.queueNumber; })
    ));
    var queueNum = maxQ + 1;

    var orderId   = Date.now();
    var displayId = String(orderId).slice(-6);

    var order = {
        id:           orderId,
        displayId:    displayId,
        customerName: name,
        phone:        fullPhone,
        location:     village,
        gpsCoords:    document.getElementById('fo-gps-coords').value || '',
        orderSource:  selectedSource,
        width:        firstItem ? firstItem.width  : 0,
        height:       firstItem ? firstItem.height : 0,
        price:        totalPrice,
        pricePerSqm:  pricePerSqm,
        totalArea:    totalArea,
        productType:  productType,
        productEmoji: productEmoji,
        productItems: JSON.stringify(productItemsList),
        comment:      comment,
        images:       '[]',
        washingDate:  washDate || null,
        createdAt:    new Date().toISOString(),
        status:       'new',
        paymentStatus: 'paid',
        paymentMethod: null,
        paidAt:        new Date().toISOString(),
        queueNumber:   queueNum
    };

    saveOrderToDB(order, function(err) {
        if (saveBtn) saveBtn.disabled = false;
        if (err) { showToast('❌ Xatolik: ' + err, 'error'); return; }
        loadOrdersFromDB(function() {
            updateStats();
            displayRecentOrders();
            displayTodayPreview();
            updateTodayBadge();
            resetNewOrderForm();
            switchPage('home');
            showToast('✅ Zakaz saqlandi! #' + displayId, 'success');
        });
    });
}

// =================== PRODUCT ITEMS ===================
function addProductItem(type, emoji, name) {
    productItemCounter++;
    loadProductPricesFromAdmin();
    var priceInfo = PRODUCT_PRICES[type] || { pricingType:'sqm', pricePerSqm: PRICE_PER_SQM };
    var item = {
        id: productItemCounter,
        type: type,
        emoji: emoji,
        name: name,
        pricingType: priceInfo.pricingType || 'sqm',
        width: 3,
        height: 2,
        pricePerSqm: priceInfo.pricePerSqm || PRICE_PER_SQM,
        pricePerMeter: priceInfo.pricePerMeter || 50000,
        meter: 1,
        area: 6,
        sizeVariant: 'large',
        priceSmall: priceInfo.priceSmall || 35000,
        priceLarge: priceInfo.priceLarge || 60000,
        kg: 1,
        pricePerKg: priceInfo.pricePerKg || 15000,
        price: 0
    };
    item.price = calcItemPrice(item);
    productItemsList.push(item);
    renderProductItems('fo-productItemsList', 'fo-totalCalcBox', 'fo-livePrice', 'fo-liveItemCount');
}

function calcItemPrice(item) {
    if (item.pricingType === 'sqm') {
        item.area = (item.width||0) * (item.height||0);
        return item.area * (item.pricePerSqm||0);
    } else if (item.pricingType === 'meter') {
        return (item.meter||0) * (item.pricePerMeter||0);
    } else if (item.pricingType === 'size') {
        return item.sizeVariant === 'small' ? (item.priceSmall||0) : (item.priceLarge||0);
    } else if (item.pricingType === 'kg') {
        return (item.kg||0) * (item.pricePerKg||0);
    }
    return 0;
}

function removeProductItem(itemId) {
    productItemsList = productItemsList.filter(function(i) { return i.id !== itemId; });
    renderProductItems('fo-productItemsList', 'fo-totalCalcBox', 'fo-livePrice', 'fo-liveItemCount');
}

function updateProductItem(itemId, field, value) {
    var item = productItemsList.find(function(i) { return i.id === itemId; });
    if (!item) return;
    if (field === 'sizeVariant') { item.sizeVariant = value; }
    else { item[field] = parseFloat(value) || 0; }
    item.price = calcItemPrice(item);
    var areaEl = document.getElementById('area_' + itemId);
    if (areaEl && item.pricingType === 'sqm') areaEl.textContent = item.area.toFixed(2) + ' m²';
    var priceEl = document.getElementById('price_' + itemId);
    if (priceEl) priceEl.textContent = Number(item.price).toLocaleString() + " so'm";
    updateTotalCalcUI('fo-totalCalcBox', 'fo-livePrice', 'fo-liveItemCount');
}

function selectSizeVariant(itemId, variant, btnEl) {
    var item = productItemsList.find(function(i) { return i.id === itemId; });
    if (!item) return;
    item.sizeVariant = variant;
    item.price = calcItemPrice(item);
    var container = document.getElementById('sizeBtns_' + itemId);
    if (container) container.querySelectorAll('.pic-size-btn').forEach(function(b) { b.classList.remove('active'); });
    if (btnEl) btnEl.classList.add('active');
    var priceEl = document.getElementById('price_' + itemId);
    if (priceEl) priceEl.textContent = Number(item.price).toLocaleString() + " so'm";
    updateTotalCalcUI('fo-totalCalcBox', 'fo-livePrice', 'fo-liveItemCount');
}

function renderProductItems(listId, boxId, priceId, countId) {
    var container = document.getElementById(listId);
    if (!container) return;
    container.innerHTML = '';
    var COLORS = {gilam:'#667eea', adyol:'#f97316', yakandoz:'#22c55e', parda:'#8b5cf6', korpa:'#ec4899'};
    productItemsList.slice().reverse().forEach(function(item) {
        var realIdx = productItemsList.indexOf(item);
        var serialNum = realIdx + 1;
        var color = COLORS[item.type] || '#667eea';
        var bodyHtml = '';
        var card = document.createElement('div');
        card.className = 'product-item-card';
        card.setAttribute('data-item-id', item.id);
        card.style.cssText = 'border:1.5px solid ' + color + '30;border-radius:14px;margin-bottom:10px;overflow:hidden;background:var(--white);box-shadow:0 2px 8px rgba(0,0,0,0.06);';
        if (item.pricingType === 'sqm') {
            bodyHtml = '<div class="pic-dimensions">' +
                '<div class="pic-dim-group"><label>Eni (m)</label>' +
                '<input type="number" class="pic-input" value="' + item.width + '" step="0.1" min="0.1" ' +
                'oninput="updateProductItem(' + item.id + ',\'width\',this.value)"></div>' +
                '<div class="pic-equals">×</div>' +
                '<div class="pic-dim-group"><label>Bo\'yi (m)</label>' +
                '<input type="number" class="pic-input" value="' + item.height + '" step="0.1" min="0.1" ' +
                'oninput="updateProductItem(' + item.id + ',\'height\',this.value)"></div>' +
                '<div class="pic-equals">=</div>' +
                '<div class="pic-area-result">' +
                '<div class="pic-area-val" id="area_' + item.id + '" style="color:' + color + ';">' + item.area.toFixed(2) + ' m²</div>' +
                '<div class="pic-area-label">yuza</div></div></div>' +
                '<div class="pic-price-row">' +
                '<div class="pic-price-per">' + Number(item.pricePerSqm).toLocaleString() + " so'm/m²</div>" +
                '<div class="pic-total-price" id="price_' + item.id + '" style="color:' + color + ';">' + Number(item.price).toLocaleString() + " so'm</div></div>";
        } else if (item.pricingType === 'meter') {
            bodyHtml = '<div class="pic-dimensions">' +
                '<div class="pic-dim-group" style="flex:none;min-width:120px;"><label>Uzunlik (m)</label>' +
                '<input type="number" class="pic-input" value="' + (item.meter||1) + '" step="0.1" min="0.1" ' +
                'oninput="updateProductItem(' + item.id + ',\'meter\',this.value)"></div>' +
                '<div class="pic-equals">×</div>' +
                '<div class="pic-area-result" style="padding-top:12px;min-width:90px;">' +
                '<div class="pic-area-val" style="color:' + color + ';">' + Number(item.pricePerMeter||0).toLocaleString() + '</div>' +
                '<div class="pic-area-label">so\'m/m</div></div></div>' +
                '<div class="pic-price-row"><div class="pic-price-per">Metr bo\'yicha narx</div>' +
                '<div class="pic-total-price" id="price_' + item.id + '" style="color:' + color + ';">' + Number(item.price).toLocaleString() + " so'm</div></div>";
        } else if (item.pricingType === 'size') {
            var isSmall = item.sizeVariant === 'small';
            bodyHtml = '<div id="sizeBtns_' + item.id + '" class="pic-size-buttons" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">' +
                '<button type="button" class="pic-size-btn' + (isSmall?' active':'') + '" onclick="selectSizeVariant(' + item.id + ',\'small\',this)">' +
                '<span class="size-btn-icon">📦</span><span class="size-btn-name">Kichik</span>' +
                '<span class="size-btn-price">' + Number(item.priceSmall).toLocaleString() + " so'm</span></button>" +
                '<button type="button" class="pic-size-btn' + (!isSmall?' active':'') + '" onclick="selectSizeVariant(' + item.id + ',\'large\',this)">' +
                '<span class="size-btn-icon">📦</span><span class="size-btn-name">Katta</span>' +
                '<span class="size-btn-price">' + Number(item.priceLarge).toLocaleString() + " so'm</span></button></div>" +
                '<div class="pic-price-row"><div class="pic-price-per">' + (isSmall?"Kichik o'lcham":"Katta o'lcham") + '</div>' +
                '<div class="pic-total-price" id="price_' + item.id + '" style="color:' + color + ';">' + Number(item.price).toLocaleString() + " so'm</div></div>";
        } else if (item.pricingType === 'kg') {
            bodyHtml = '<div class="pic-dimensions">' +
                '<div class="pic-dim-group" style="flex:none;min-width:100px;"><label>Og\'irlik (kg)</label>' +
                '<input type="number" class="pic-input" value="' + item.kg + '" step="0.1" min="0.1" ' +
                'oninput="updateProductItem(' + item.id + ',\'kg\',this.value)"></div>' +
                '<div class="pic-equals">×</div>' +
                '<div class="pic-area-result" style="padding-top:12px;min-width:80px;">' +
                '<div class="pic-area-val" style="color:' + color + ';">' + Number(item.pricePerKg).toLocaleString() + '</div>' +
                '<div class="pic-area-label">so\'m/kg</div></div></div>' +
                '<div class="pic-price-row"><div class="pic-price-per">Kg bo\'yicha narx</div>' +
                '<div class="pic-total-price" id="price_' + item.id + '" style="color:' + color + ';">' + Number(item.price).toLocaleString() + " so'm</div></div>";
        }
        card.innerHTML =
            '<div class="pic-header" style="border-bottom:2px solid ' + color + '20;display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f8f9ff;">' +
                '<div style="display:flex;align-items:center;gap:10px;">' +
                '<span style="width:36px;height:36px;border-radius:10px;background:' + color + '20;display:flex;align-items:center;justify-content:center;font-size:18px;">' + item.emoji + '</span>' +
                '<div><div style="font-weight:700;font-size:14px;color:' + color + ';">' + item.name + ' #' + serialNum + '</div></div></div>' +
                '<button type="button" class="pic-remove" onclick="removeProductItem(' + item.id + ')" title="O\'chirish">✕</button>' +
            '</div>' +
            '<div class="pic-body" style="padding:12px 14px;">' + bodyHtml + '</div>';
        container.appendChild(card);
    });
    updateTotalCalcUI(boxId, priceId, countId);
}

function updateTotalCalcUI(boxId, priceId, countId) {
    var totalBox = document.getElementById(boxId);
    var priceEl  = document.getElementById(priceId);
    var countEl  = document.getElementById(countId);
    var total = productItemsList.reduce(function(s, i) { return s + (i.price||0); }, 0);
    if (productItemsList.length === 0) {
        if (totalBox) totalBox.style.display = 'none';
    } else {
        if (totalBox) totalBox.style.display = 'block';
        if (priceEl)  priceEl.textContent  = total.toLocaleString() + " so'm";
        if (countEl)  countEl.textContent  = productItemsList.length + ' ta';
    }
}

// =================== DETAILS MODAL ===================
function openDetailsModal(order) {
    if (!order) return;
    var modal   = document.getElementById('detailsModal');
    var content = document.getElementById('detailsContent');
    var navDiv  = document.getElementById('detailsNavigation');
    if (!modal || !content) return;

    currentOrderId = Number(order.id);
    var showId = order.displayId || String(order.id).slice(-6);
    var area = (parseFloat(order.totalArea)||0).toFixed(2);
    var sc = STATUS_CFG[order.status] || STATUS_CFG.new;

    var images = [];
    try { images = JSON.parse(order.images||'[]'); } catch(e) {}
    imageGallery = images;

    var imagesHtml = '';
    if (images.length > 0) {
        imagesHtml = '<div class="details-images">' +
            images.map(function(img, idx) {
                return '<div class="details-img-wrap" onclick="openGallery(' + idx + ')" style="cursor:pointer">' +
                    '<img src="' + img + '" alt="Rasm">' +
                    '<div class="details-img-overlay"><i class="fas fa-expand"></i></div></div>';
            }).join('') + '</div>';
    }

    var ALL_STATUSES = [
        {key:'new',     label:'Kutilmoqda', emoji:'⏳'},
        {key:'washing', label:'Yuvilmoqda', emoji:'🧼'},
        {key:'ready',   label:'Tayyor',     emoji:'✅'},
        {key:'done',    label:'Yetkazildi', emoji:'🚚'}
    ];
    var curIdx = ALL_STATUSES.findIndex(function(s) {
        if (order.status === 'queue') return s.key === 'new';
        return s.key === order.status;
    });
    if (curIdx < 0) curIdx = 0;

    var progressHtml = '<div class="det-progress">' +
        ALL_STATUSES.map(function(s, i) {
            var isActive = i === curIdx, isDone = i < curIdx;
            return '<div class="det-progress-step ' + (isActive?'active':'') + (isDone?' done':'') + '">' +
                '<div class="det-progress-dot">' + (isDone?'✓':s.emoji) + '</div>' +
                '<span>' + s.label + '</span></div>' +
                (i < ALL_STATUSES.length-1 ? '<div class="det-progress-line' + (isDone?' done':'') + '"></div>' : '');
        }).join('') + '</div>';

    var payColor = order.paymentStatus==='paid' ? '#4caf50' : '#f44336';
    var payText  = order.paymentStatus==='paid' ? '✅ To\'langan' : '❌ To\'lanmagan';

    var items = [];
    try { items = JSON.parse(order.productItems||'[]'); } catch(e) {}
    var colorMap = {gilam:'#667eea',adyol:'#f97316',yakandoz:'#22c55e',parda:'#8b5cf6',korpa:'#ec4899'};
    var itemsHtml = '';
    if (items.length > 0) {
        itemsHtml = '<div class="det-items-list" style="margin-bottom:12px;">' +
            '<div class="det-items-title" style="font-size:12px;font-weight:700;color:#667eea;padding:8px 14px;background:#f0f3ff;border-radius:10px;margin-bottom:8px;">📦 Mahsulotlar</div>' +
            items.map(function(it, i) {
                var c = colorMap[it.type] || '#667eea';
                var measHtml = '';
                if (it.pricingType==='sqm'||(!it.pricingType&&it.width)) measHtml = it.width+'m × '+it.height+'m = <strong>'+(it.area||0).toFixed(1)+'m²</strong>';
                else if (it.pricingType==='meter') measHtml = '<strong>'+(it.meter||0)+' m</strong>';
                else if (it.pricingType==='kg')    measHtml = '<strong>'+(it.kg||0)+' kg</strong>';
                else if (it.pricingType==='size')  measHtml = '<strong>'+(it.sizeVariant||'—')+'</strong>';
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;border-left:3px solid '+c+';background:#f8f9ff;border-radius:8px;margin-bottom:6px;">' +
                    '<span style="font-size:13px;font-weight:600;">' + it.emoji + ' ' + it.name + ' #'+(i+1)+'<br><small style="color:#888;">' + measHtml + '</small></span>' +
                    '<span style="color:'+c+';font-weight:700;font-size:13px;">' + Number(it.price||0).toLocaleString() + " so'm</span></div>";
            }).join('') + '</div>';
    }

    content.innerHTML = imagesHtml +
        '<div class="det-header-card" style="background:linear-gradient(135deg,' + sc.color + '15,' + sc.color + '05);border-radius:16px;padding:16px;margin-bottom:12px;border:1px solid ' + sc.color + '30;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                '<div><div style="font-size:10px;font-weight:600;color:#888;">ZAKAZ</div>' +
                '<div style="font-size:22px;font-weight:800;">#' + showId + '</div></div>' +
                '<div style="background:' + sc.bg + ';color:' + sc.color + ';padding:6px 14px;border-radius:20px;font-size:13px;font-weight:700;">' + sc.emoji + ' ' + sc.label + '</div>' +
            '</div>' +
            (order.customerName ? '<div style="font-size:15px;font-weight:700;margin-bottom:4px;">👤 ' + order.customerName + '</div>' : '') +
            '<div style="font-size:14px;color:#667eea;font-weight:600;"><i class="fas fa-phone-alt"></i> ' + (order.phone||'') + '</div>' +
        '</div>' +
        '<div class="det-info-grid">' +
            '<div class="det-info-card"><div class="det-info-icon" style="background:#ebf4ff;color:#667eea;"><i class="fas fa-map-marker-alt"></i></div>' +
            '<div class="det-info-text"><span class="det-info-label">Manzil</span><span class="det-info-val">' + (order.location||'—') + '</span></div></div>' +
            '<div class="det-info-card"><div class="det-info-icon" style="background:#e8f5e9;color:#4caf50;"><i class="fas fa-ruler-combined"></i></div>' +
            '<div class="det-info-text"><span class="det-info-label">O\'lcham</span><span class="det-info-val">' + area + ' m²</span></div></div>' +
            '<div class="det-info-card"><div class="det-info-icon" style="background:#fff3e0;color:#ff9800;"><i class="fas fa-tag"></i></div>' +
            '<div class="det-info-text"><span class="det-info-label">Narx</span><span class="det-info-val" style="color:#4caf50;font-weight:700;">' + Number(order.price||0).toLocaleString() + " so'm</span></div></div>" +
            '<div class="det-info-card"><div class="det-info-icon" style="background:#' + (order.paymentStatus==='paid'?'e8f5e9;color:#4caf50':'fce4ec;color:#f44336') + ';"><i class="fas fa-credit-card"></i></div>' +
            '<div class="det-info-text"><span class="det-info-label">To\'lov</span><span class="det-info-val" style="color:' + payColor + ';font-weight:600;">' + payText + '</span></div></div>' +
            (order.washingDate ? '<div class="det-info-card" style="grid-column:1/-1;"><div class="det-info-icon" style="background:#f3e5f5;color:#9c27b0;"><i class="fas fa-calendar-alt"></i></div>' +
            '<div class="det-info-text"><span class="det-info-label">Yuvish sanasi</span><span class="det-info-val" style="color:#9c27b0;font-weight:700;">' + order.washingDate + '</span></div></div>' : '') +
            (order.queueNumber ? '<div class="det-info-card" style="grid-column:1/-1;"><div class="det-info-icon" style="background:#fff3e0;color:#ff9800;"><i class="fas fa-list-ol"></i></div>' +
            '<div class="det-info-text"><span class="det-info-label">Navbat raqami</span><span class="det-info-val" style="color:#ff9800;font-weight:800;">#' + order.queueNumber + '</span></div></div>' : '') +
        '</div>' +
        itemsHtml +
        progressHtml +
        (order.comment ? '<div class="det-comment-box" style="background:#f8f9fa;border-radius:12px;padding:12px;margin-top:8px;font-size:13px;color:#555;">' + order.comment + '</div>' : '');

    navDiv.innerHTML =
        '<button class="det-nav-btn det-nav-call" onclick="window.location.href=\'tel:' + (order.phone||'') + '\'">' +
            '<i class="fas fa-phone"></i> Qo\'ng\'iroq</button>' +
        (order.gpsCoords || order.location ? '<button class="det-nav-btn det-nav-map" onclick="openMapRoute(' + Number(order.id) + ')">' +
            '<i class="fas fa-map-marked-alt"></i> Yo\'lni ochish</button>' : '') +
        '<button class="det-nav-btn det-nav-status" onclick="openStatusNavigator(' + Number(order.id) + ')">' +
            '<i class="fas fa-exchange-alt"></i> Holat</button>' +
        '<button class="det-nav-btn det-nav-delete" onclick="confirmDeleteOrder(' + Number(order.id) + ')">' +
            '<i class="fas fa-trash"></i></button>';

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function closeDetailsModal() {
    var modal = document.getElementById('detailsModal');
    if (modal) { modal.classList.remove('show'); document.body.style.overflow = ''; }
}

// =================== MAP NAVIGATION ===================
function openMapRoute(orderId) {
    var id = Number(orderId);
    var order = orders.find(function(o) { return o.id === id; });
    if (!order) return;
    
    var mapUrl = '';
    var query = '';
    
    if (order.gpsCoords) {
        query = order.gpsCoords;
    } else if (order.location) {
        query = encodeURIComponent(order.location + ' ' + (order.customerName || ''));
    }
    
    if (!query) {
        showToast('❌ Lokatsiya ma\'lumoti yo\'q', 'error');
        return;
    }
    
    // Try to detect if it's a coordinate or address
    var isCoords = /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(query);
    
    if (isCoords) {
        mapUrl = 'https://www.google.com/maps?q=' + query;
    } else {
        mapUrl = 'https://www.google.com/maps?q=' + query;
    }
    
    window.open(mapUrl, '_blank');
}

// =================== STATUS NAVIGATOR ===================
function openStatusNavigator(orderId) {
    var id = Number(orderId);
    currentOrderId = id;
    var order = orders.find(function(o) { return o.id === id; });
    if (!order) return;
    var content = document.getElementById('detailsContent');
    var navDiv  = document.getElementById('detailsNavigation');

    var STEPS = [
        {status:'new',     label:'⏳ Kutilmoqda', grad:'#ff9800,#f57c00'},
        {status:'washing', label:'🧼 Yuvilmoqda', grad:'#2196f3,#1976d2'},
        {status:'ready',   label:'✅ Tayyor',      grad:'#4caf50,#45a049'},
        {status:'done',    label:'🚚 Yetkazildi',  grad:'#9c27b0,#7b1fa2'}
    ];

    var statusOrder = ['new','queue','washing','ready','done'];
    var curIdx = statusOrder.indexOf(order.status);

    content.innerHTML =
        '<div style="background:#f0f3ff;padding:12px;border-radius:10px;margin-bottom:16px;border-left:4px solid #667eea;">' +
        '<div style="font-weight:600;color:#667eea;">#' + (order.displayId||String(order.id).slice(-6)) +
        (order.customerName ? ' · ' + order.customerName : '') +
        ' · ' + (order.phone||'') + '</div>' +
        '<div style="font-size:12px;color:#888;margin-top:4px;">Hozirgi holat: ' + (STATUS_CFG[order.status]||STATUS_CFG.new).emoji + ' ' + (STATUS_CFG[order.status]||STATUS_CFG.new).label + '</div></div>' +
        '<p style="font-size:13px;color:#888;font-weight:600;margin-bottom:12px;">Yangi holatni tanlang:</p>' +
        STEPS.map(function(s) {
            var sIdx = statusOrder.indexOf(s.status);
            var isCurrent = s.status === order.status || (s.status==='new' && order.status==='queue');
            var isDone = sIdx < curIdx;
            return '<div style="padding:12px;margin-bottom:8px;border-radius:10px;border:2px solid ' +
                (isCurrent?'#667eea':isDone?'#4caf5060':'#eee') + ';background:' +
                (isCurrent?'#f0f3ff':isDone?'#f8fff8':'#fafafa') + ';display:flex;align-items:center;justify-content:space-between;">' +
                '<span style="font-weight:700;color:' + (isCurrent?'#667eea':isDone?'#4caf50':'#555') + ';">' + s.label + (isCurrent?' (Hozir)':isDone?' ✓':'') + '</span>' +
                (!isCurrent && !isDone ? '<button style="background:linear-gradient(135deg,' + s.grad + ');color:#fff;border:none;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;" onclick="changeOrderStatus(\'' + s.status + '\')">' + s.label + '</button>' : '') +
                '</div>';
        }).join('');

    navDiv.innerHTML = '';
    var backBtn = document.createElement('button');
    backBtn.style.cssText = 'flex:1;background:#f5f5f5;color:#666;border:none;padding:12px;border-radius:8px;font-weight:600;cursor:pointer;width:100%;';
    backBtn.textContent = '← Orqaga';
    backBtn.onclick = function() { openDetailsModal(orders.find(function(o){ return o.id===id; })); };
    navDiv.appendChild(backBtn);
}

function changeOrderStatus(status) {
    var order = orders.find(function(o) { return o.id === currentOrderId; });
    if (!order) return;
    order.status = status;
    if ((status === 'queue' || status === 'washing') && !order.queueNumber) {
        var max = Math.max.apply(null, [0].concat(
            orders.filter(function(o){ return o.queueNumber; }).map(function(o){ return o.queueNumber; })
        ));
        order.queueNumber = max + 1;
    }
    updateOrderInDB(order, function(err) {
        if (err) { showToast('❌ Xatolik: ' + err, 'error'); return; }
        loadOrdersFromDB(function() {
            updateStats();
            displayRecentOrders();
            displayTodayPreview();
            displayTodayOrders();
            updateTodayBadge();
            closeDetailsModal();
            showToast('✅ Holat: ' + (STATUS_CFG[status]||STATUS_CFG.new).label, 'success');
        });
    });
}

// =================== DELETE ===================
function confirmDeleteOrder(orderId) {
    if (!confirm('Bu zakazni o\'chirishni xohlaysizmi?')) return;
    deleteOrderFromDB(Number(orderId), function(err) {
        if (err) { showToast('❌ Xatolik: ' + err, 'error'); return; }
        loadOrdersFromDB(function() {
            updateStats();
            displayRecentOrders();
            displayTodayPreview();
            displayTodayOrders();
            updateTodayBadge();
            closeDetailsModal();
            showToast('🗑️ Zakaz o\'chirildi', 'info');
        });
    });
}

// =================== GALLERY ===================
function openGallery(startIndex) {
    currentImageIndex = startIndex;
    var old = document.getElementById('galleryModal'); if (old) old.remove();
    var modal = document.createElement('div');
    modal.className = 'gallery-modal'; modal.id = 'galleryModal';
    var img = document.createElement('img'); img.className = 'gallery-image'; img.src = imageGallery[currentImageIndex];
    var counter = document.createElement('div'); counter.className = 'gallery-counter';
    counter.textContent = (currentImageIndex+1) + ' / ' + imageGallery.length;
    var prevBtn = document.createElement('button'); prevBtn.className = 'gallery-nav prev'; prevBtn.innerHTML = '❮';
    prevBtn.onclick = function(e) { e.stopPropagation(); navigateGallery(-1); };
    var nextBtn = document.createElement('button'); nextBtn.className = 'gallery-nav next'; nextBtn.innerHTML = '❯';
    nextBtn.onclick = function(e) { e.stopPropagation(); navigateGallery(1); };
    var closeBtn = document.createElement('button'); closeBtn.className = 'gallery-close'; closeBtn.innerHTML = '✕';
    closeBtn.onclick = function() { modal.remove(); };
    modal.append(img, counter, prevBtn, nextBtn, closeBtn);
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}

function navigateGallery(dir) {
    var ni = currentImageIndex + dir;
    if (ni >= 0 && ni < imageGallery.length) {
        currentImageIndex = ni;
        var img = document.querySelector('.gallery-image'); if (img) img.src = imageGallery[ni];
        var c = document.querySelector('.gallery-counter'); if (c) c.textContent = (ni+1) + ' / ' + imageGallery.length;
    }
}

// =================== PHONE FORMAT ===================
function formatPhoneInput(input) {
    var digits = input.value.replace(/\D/g, '').slice(0, 9);
    var formatted = '';
    if (digits.length > 0) formatted = digits.slice(0, 2);
    if (digits.length > 2) formatted += ' ' + digits.slice(2, 5);
    if (digits.length > 5) formatted += '-' + digits.slice(5, 7);
    if (digits.length > 7) formatted += '-' + digits.slice(7, 9);
    input.value = formatted;
}

function handlePhoneKey(e, input) {
    if (e.key === 'Backspace') {
        var val = input.value;
        if (val.length > 0 && (val[val.length-1] === ' ' || val[val.length-1] === '-')) {
            e.preventDefault();
            input.value = val.slice(0, -1);
        }
    }
}

function getRawPhone(input) {
    return input.value.replace(/\D/g, '');
}

// =================== MODALS ===================
function openAdminLoginModal() {
    var modal = document.getElementById('adminLoginModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        var pw = document.getElementById('adminPassword');
        if (pw) pw.value = '';
    }
}

function closeAdminLoginModal() {
    var modal = document.getElementById('adminLoginModal');
    if (modal) { modal.classList.remove('show'); document.body.style.overflow = ''; }
}

function closeModal(element) {
    if (element) { element.classList.remove('show'); document.body.style.overflow = ''; }
}

// =================== ADMIN LOGIN ===================
function adminLogin() {
    var pw = document.getElementById('adminPassword');
    if (!pw) return;
    var savedPass = localStorage.getItem('gilam_admin_password') || '2007';
    if (pw.value === savedPass) {
        localStorage.setItem('admin_logged_in', 'true');
        closeAdminLoginModal();
        window.location.href = 'admin.html';
    } else {
        showToast('❌ Parol noto\'g\'ri!', 'error');
        pw.value = ''; pw.focus();
    }
}

// =================== SEARCH ===================
function globalSearch(q){
    var container = document.getElementById('recentOrders');
    var header = document.querySelector('#homePage .section-header h2');
    if(!container) return;

    if(!q.trim()) {
        if(header) header.textContent = 'Oxirgi zakazlar';
        displayRecentOrders();
        return;
    }

    var qLower = q.toLowerCase();
    var qClean = q.replace(/\D/g,'');
    var filtered = orders.filter(function(o){
        var phoneClean = (o.phone||'').replace(/\D/g,'');
        var phoneLast4 = phoneClean.slice(-4);
        return phoneClean.includes(qClean) || 
               phoneLast4 === qClean ||
               phoneClean.endsWith(qClean) ||
               (o.location||'').toLowerCase().includes(qLower) || 
               String(o.displayId || o.id).includes(qLower) || 
               (o.customerName||'').toLowerCase().includes(qLower);
    });

    if(header) header.textContent = 'Qidiruv natijalari (' + filtered.length + ')';
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-search"></i><p>Hech narsa topilmadi</p></div>';
        return;
    }
    
    container.innerHTML = '';
    filtered.slice(0, 20).forEach(function(order) {
        container.appendChild(makeOrderCard(order));
    });
}

// =================== TOAST ===================
function showToast(message, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'toast show ' + (type||'info');
    clearTimeout(toast._t);
    toast._t = setTimeout(function() { toast.classList.remove('show'); }, 3500);
}

// =================== CLOSE ON BACKDROP ===================
window.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) closeModal(e.target);
});

// =================== WINDOW EXPORTS ===================
window.switchPage          = switchPage;
window.openDetailsModal    = openDetailsModal;
window.closeDetailsModal   = closeDetailsModal;
window.openAdminLoginModal = openAdminLoginModal;
window.closeAdminLoginModal= closeAdminLoginModal;
window.closeModal          = closeModal;
window.adminLogin          = adminLogin;
window.showToast           = showToast;
window.saveOrderFull       = saveOrderFull;
window.resetNewOrderForm   = resetNewOrderForm;
window.addProductItem      = addProductItem;
window.removeProductItem   = removeProductItem;
window.updateProductItem   = updateProductItem;
window.selectSizeVariant   = selectSizeVariant;
window.openGallery         = openGallery;
window.navigateGallery     = navigateGallery;
window.formatPhoneInput    = formatPhoneInput;
window.handlePhoneKey      = handlePhoneKey;
window.getRawPhone         = getRawPhone;
window.openStatusNavigator = openStatusNavigator;
window.changeOrderStatus   = changeOrderStatus;
window.confirmDeleteOrder  = confirmDeleteOrder;
window.setTodayFilter      = setTodayFilter;
window.openPriceSettings   = openPriceSettings;
window.updatePricePreview  = updatePricePreview;
window.savePriceSettings   = savePriceSettings;

console.log('✅ Script v7.0 yuklandi');
