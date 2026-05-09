// =================== COMMON CONFIG & UTILS ===================
const SUPABASE_URL = 'https://qscvtxtgbwbshkrqklgk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzY3Z0eHRnYndic2hrcnFrbGdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzc3MDcsImV4cCI6MjA5MDgxMzcwN30.usjIv2xDGTcNOMV7rwZMEV7P7f8MmelDqHnDiO4WHAA';

const STATUS_CFG = {
    new:           { label: 'Kutilmoqda',      emoji: '⏳', color: '#ff9800', bg: '#fff3e0' },
    active:        { label: 'Faollashtirildi', emoji: '🚀', color: '#e91e63', bg: '#fce4ec' },
    ready_to_wash: { label: 'Yuvishga tayyor', emoji: '🛁', color: '#3f51b5', bg: '#e8eaf6' },
    washing:       { label: 'Yuvilmoqda',      emoji: '🧼', color: '#2196f3', bg: '#e3f2fd' },
    packing:       { label: 'Upakovka',        emoji: '📦', color: '#795548', bg: '#efebe9' },
    ready:         { label: 'Tayyor',          emoji: '✅', color: '#4caf50', bg: '#e8f5e9' },
    done:          { label: 'Yetkazildi',      emoji: '🚚', color: '#9c27b0', bg: '#f3e5f5' }
};

function supabaseFetch(method, path, data, callback) {
    const url = `${SUPABASE_URL}/rest/v1/${path}`;
    const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
    };
    if (method === 'POST' || method === 'PATCH') headers['Prefer'] = 'return=representation';
    const opts = { method, headers };
    if (data) opts.body = JSON.stringify(data);
    
    fetch(url, opts)
        .then(r => {
            if (r.status === 204) return null;
            if (!r.ok) return r.text().then(t => { throw new Error(t); });
            return r.headers.get('content-type')?.includes('application/json') ? r.json() : null;
        })
        .then(res => callback(null, res))
        .catch(e => callback(e.message || 'Network error', null));
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 3500);
}

function todayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatMoney(n) {
    return Number(n).toLocaleString() + " so'm";
}

function translateType(type) {
    const types = {
        'S': 'Kichik',
        'M': 'O\'rtacha',
        'L': 'Katta',
        'kg': 'kg',
        'KG': 'kg',
        'sqm': 'm²',
        'meter': 'm'
    };
    return types[type] || type;
}

function getOrderSummaryHtml(productItems) {
    if (!productItems || !Array.isArray(productItems) || productItems.length === 0) return '';
    
    let html = '<div class="order-items-summary">';
    productItems.forEach(group => {
        let totalCount = 0;
        let totalArea = 0;
        let hasSqm = false, hasKg = false, hasMeter = false;
        
        if (group.items) {
            group.items.forEach(item => {
                totalCount += (item.count || 0);
                if (item.type === 'sqm') { totalArea += (item.area || 0); hasSqm = true; }
                else if (item.type === 'KG') { totalArea += (item.area || item.count || 0); hasKg = true; }
                else if (item.type === 'meter') { totalArea += (item.value || 0); hasMeter = true; }
            });
        }

        let label = `${totalCount} ta ${group.name}`;
        if (hasSqm) label += ` (${totalArea.toFixed(1)} m²)`;
        else if (hasKg) label += ` (${totalArea.toFixed(1)} kg)`;
        else if (hasMeter) label += ` (${totalArea.toFixed(1)} m)`;
        
        html += `<span class="summary-item">${label}</span>`;
    });
    html += '</div>';
    return html;
}

function formatDateTime(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Map database row to app object
function mapOrder(o) {
    return {
        id:           o.id,
        displayId:    o.display_id,
        customerName: o.customer_name || '',
        phone:        o.phone,
        location:     o.location,
        gpsCoords:    o.gps_coords,
        orderSource:  o.order_source,
        price:        o.price || 0,
        totalArea:    o.total_area || 0,
        productItems: o.product_items ? JSON.parse(o.product_items) : [],
        comment:      o.comment,
        images:       o.images ? JSON.parse(o.images) : [],
        washingDate:  o.washing_date,
        createdAt:    o.created_at,
        status:       o.status || 'new',
        paymentStatus: o.payment_status || 'unpaid',
        queueNumber:  o.queue_number
    };
}

// Database'dan yangi Order ID olish (RPC call)
function getNextOrderId(callback) {
    const url = `${SUPABASE_URL}/rest/v1/rpc/get_next_order_id`;
    const headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
    };
    
    fetch(url, { method: 'POST', headers })
        .then(r => r.json())
        .then(res => callback(null, res))
        .catch(e => callback(e.message || 'Network error', null));
}
