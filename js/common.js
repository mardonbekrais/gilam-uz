// =================== COMMON CONFIG & UTILS ===================
const SUPABASE_URL = 'https://qscvtxtgbwbshkrqklgk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzY3Z0eHRnYndic2hrcnFrbGdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMzc3MDcsImV4cCI6MjA5MDgxMzcwN30.usjIv2xDGTcNOMV7rwZMEV7P7f8MmelDqHnDiO4WHAA';

const STATUS_CFG = {
    new:     { label: 'Kutilmoqda', emoji: '⏳', color: '#ff9800', bg: '#fff3e0' },
    queue:   { label: 'Kutilmoqda', emoji: '⏳', color: '#ff9800', bg: '#fff3e0' },
    washing: { label: 'Yuvilmoqda', emoji: '🧼', color: '#2196f3', bg: '#e3f2fd' },
    ready:   { label: 'Tayyor',     emoji: '✅', color: '#4caf50', bg: '#e8f5e9' },
    done:    { label: 'Yetkazildi', emoji: '🚚', color: '#9c27b0', bg: '#f3e5f5' }
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
