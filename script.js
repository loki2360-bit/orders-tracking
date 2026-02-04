// --- Вспомогательные функции ---
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function formatMoney(num) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Math.round(num * 100) / 100);
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

// --- Состояние ---
let state = JSON.parse(localStorage.getItem('operatorState')) || {
  totalEarnings: 0,
  todayEarnings: 0,
  ordersByDate: {}
};

function saveState() {
  localStorage.setItem('operatorState', JSON.stringify(state));
}

// --- Пересчёт сумм ---
function recalculateEarnings() {
  let totalAll = 0;
  const today = getCurrentDate();
  let todayTotal = 0;

  for (const [date, orders] of Object.entries(state.ordersByDate)) {
    if (!Array.isArray(orders)) continue;
    const sum = orders.reduce((s, o) => s + (o.total || 0), 0);
    totalAll += sum;
    if (date === today) todayTotal = sum;
  }

  state.totalEarnings = totalAll;
  state.todayEarnings = todayTotal;
  saveState();
}

// --- Рендеринг ---
function renderOrdersForDate(date, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const orders = state.ordersByDate[date] || [];
  let html = '';

  if (orders.length === 0) {
    html = '<p>Заказов пока нет.</p>';
  } else {
    html = `
      <div class="orders-list open">
        ${orders.map((order, idx) => `
          <div class="order-item">
            <div class="order-header">
              <span>№${escapeHtml(order.number)}</span>
              <span>${formatMoney(order.total)}</span>
            </div>
            <div class="order-details">
              ${order.items?.map(i => 
                `${escapeHtml(i.detail)} • ${i.service} • ×${i.quantity} • ${formatMoney(i.price)}`
              ).join('<br>') || ''}
            </div>
            <button class="btn-delete" type="button" onclick="deleteOrder('${date}', ${idx})">Удалить</button>
          </div>
        `).join('')}
      </div>
      <button class="btn" style="margin-top:12px;" type="button" onclick="exportDateToTxt('${date}')">Скачать TXT</button>
    `;
  }

  container.innerHTML = html;
}

function renderAllDates() {
  const container = document.getElementById('all-dates-list');
  if (!container) return;

  const dates = Object.keys(state.ordersByDate).sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) {
    container.innerHTML = '<p>Нет заказов ни за одну дату.</p>';
    return;
  }

  container.innerHTML = dates.map(date => `
    <div class="date-group">
      <div class="date-header" onclick="toggleDateGroup(this)">
        <span>${formatDate(date)}</span>
        <span>▶</span>
      </div>
      <div class="orders-list">
        ${(state.ordersByDate[date] || []).map((order, idx) => `
          <div class="order-item">
            <div class="order-header">
              <span>№${escapeHtml(order.number)}</span>
              <span>${formatMoney(order.total)}</span>
            </div>
            <div class="order-details">
              ${order.items?.map(i => 
                `${escapeHtml(i.detail)} • ${i.service} • ×${i.quantity} • ${formatMoney(i.price)}`
              ).join('<br>') || ''}
            </div>
            <button class="btn-delete" type="button" onclick="deleteOrder('${date}', ${idx})">Удалить</button>
          </div>
        `).join('')}
        <button class="btn" style="margin-top:12px;width:auto;" type="button" onclick="exportDateToTxt('${date}')">Скачать TXT</button>
      </div>
    </div>
  `).join('');
}

function toggleDateGroup(el) {
  const list = el.nextElementSibling;
  const isOpen = list.classList.contains('open');
  list.classList.toggle('open');
  el.querySelector('span:last-child').textContent = isOpen ? '▶' : '▼';
}

// --- Удаление ---
function deleteOrder(date, index) {
  if (!confirm('Удалить заказ?')) return;
  const orders = state.ordersByDate[date];
  if (!orders || !Array.isArray(orders) || index < 0 || index >= orders.length) return;
  
  orders.splice(index, 1);
  if (orders.length === 0) delete state.ordersByDate[date];
  
  recalculateEarnings();
  updateUI();
}

// --- Создание заказа ---
const SERVICES = [
  { id: 'RASPIL_M2', name: 'Распил', unit: 'м²', price: 65 },
  { id: 'LINEAR_RASPIL', name: 'Линейный распил', unit: 'п.м.', price: 26 },
  { id: 'SKLEIKA_OB', name: 'Склейка с обгонкой', unit: 'м²', price: 210 },
  { id: 'SKLEIKA_NO_OB', name: 'Склейка без обгонки', unit: 'м²', price: 165 },
  { id: 'PAZY', name: 'Пазы', unit: 'п.м.', price: 30 },
  { id: 'FREZER_FASKA', name: 'Фрезеровка фаски', unit: 'п.м.', price: 16 },
  { id: 'TIME', name: 'Время', unit: 'час', price: 330 },
];

function createOrder() {
  const num = document.getElementById('order-number').value.trim();
  if (!num) return alert('Номер заказа обязателен!');
  
  const blocks = [...document.querySelectorAll('.item-block')];
  if (blocks.length === 0) return alert('Добавьте деталь!');

  const items = blocks.map(block => {
    const detail = block.querySelector('[data-field="detail"]')?.value.trim() || '—';
    const serviceId = block.querySelector('[data-field="service"]')?.value;
    const qty = parseInt(block.querySelector('[data-field="quantity"]')?.value) || 1;
    const service = SERVICES.find(s => s.id === serviceId);
    if (!service) throw new Error('Неизвестный тариф');

    let price = 0;
    if (serviceId === 'TIME') {
      const h = parseFloat(block.querySelector('[data-field="hours"]')?.value) || 0;
      price = service.price * h * qty;
    } else if (['RASPIL_M2','SKLEIKA_OB','SKLEIKA_NO_OB'].includes(serviceId)) {
      const l = parseFloat(block.querySelector('[data-field="length"]')?.value) || 0;
      const w = parseFloat(block.querySelector('[data-field="width"]')?.value) || 0;
      price = service.price * l * w * qty;
    } else {
      const l = parseFloat(block.querySelector('[data-field="length"]')?.value) || 0;
      price = service.price * l * qty;
    }

    return { detail, service: service.name, quantity: qty, price };
  });

  const total = items.reduce((s, i) => s + i.price, 0);
  const today = getCurrentDate();

  if (!state.ordersByDate[today]) state.ordersByDate[today] = [];
  state.ordersByDate[today].push({ number: num, items, total });

  recalculateEarnings();
  updateUI();

  // Очистка
  document.getElementById('order-number').value = '';
  document.getElementById('items-container').innerHTML = '';
}

// --- Прочее ---
function addItem() {
  const c = document.getElementById('items-container');
  const i = c.children.length;
  c.insertAdjacentHTML('beforeend', `
    <div class="item-block">
      <button class="remove" type="button" onclick="this.closest('.item-block').remove()">✕</button>
      <div class="form-row"><label>Деталь:</label><input type="text" placeholder="название" data-field="detail" /></div>
      <div class="form-row"><label>Тариф:</label>
        <select data-field="service" onchange="toggleFields(this, ${i})">
          ${SERVICES.map(s => `<option value="${s.id}">${s.name} (${s.price}₽/${s.unit})</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Количество:</label><input type="number" value="1" min="1" data-field="quantity" /></div>
      <div class="fields" id="fields-${i}"></div>
    </div>
  `);
  toggleFields(c.lastElementChild.querySelector('select'), i);
}

function toggleFields(sel, i) {
  const f = document.getElementById(`fields-${i}`);
  const v = sel.value;
  if (v === 'TIME') {
    f.innerHTML = '<div class="form-row"><label>Часы:</label><input type="number" step="0.1" min="0.1" data-field="hours" /></div>';
  } else if (['RASPIL_M2','SKLEIKA_OB','SKLEIKA_NO_OB'].includes(v)) {
    f.innerHTML = `
      <div class="form-row"><label>Длина (м):</label><input type="number" step="0.01" min="0.01" data-field="length" /></div>
      <div class="form-row"><label>Ширина (м):</label><input type="number" step="0.01" min="0.01" data-field="width" /></div>
    `;
  } else {
    f.innerHTML = '<div class="form-row"><label>Длина (м):</label><input type="number" step="0.01" min="0.01" data-field="length" /></div>';
  }
}

function resetShift() {
  if (confirm('Начать новую смену?')) {
    state.todayEarnings = 0;
    saveState();
    updateUI();
  }
}

function exportDateToTxt(date) {
  const orders = state.ordersByDate[date] || [];
  if (orders.length === 0) return;
  let txt = `Заказы за ${formatDate(date)}\n${'='.repeat(40)}\n\n`;
  let total = 0;
  orders.forEach(o => {
    total += o.total;
    txt += `Заказ №${o.number}\n`;
    o.items.forEach(i => {
      txt += `- ${i.detail} | ${i.service} | ×${i.quantity} | ${formatMoney(i.price)}\n`;
    });
    txt += `Итого: ${formatMoney(o.total)}\n\n`;
  });
  txt += `${'='.repeat(40)}\nОбщая сумма: ${formatMoney(total)}\n`;

  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([txt], {type: 'text/plain'}));
  a.download = `заказы_${date}.txt`;
  a.click();
}

// --- Аватарка ---
document.getElementById('avatar-input')?.addEventListener('change', e => {
  const file = e.target.files[0];
  if (file && file.type.startsWith('image/')) {
    const r = new FileReader();
    r.onload = ev => {
      localStorage.setItem('operatorAvatar', ev.target.result);
      updateAvatar();
    };
    r.readAsDataURL(file);
  }
});

function updateAvatar() {
  const el = document.getElementById('avatar');
  const img = localStorage.getItem('operatorAvatar');
  el.innerHTML = img ? `<img src="${img}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : 'О';
}

// --- Инициализация ---
function updateUI() {
  const today = getCurrentDate();
  document.getElementById('total-earnings').textContent = formatMoney(state.totalEarnings);
  document.getElementById('today-earnings').textContent = formatMoney(state.todayEarnings);
  document.getElementById('shift-earned').textContent = formatMoney(state.todayEarnings);
  document.getElementById('progress').style.width = `${Math.min(100, (state.todayEarnings / 3000) * 100)}%`;
  renderOrdersForDate(today, 'today-orders');
  renderAllDates();
}

document.addEventListener('DOMContentLoaded', () => {
  updateUI();
  updateAvatar();
});
