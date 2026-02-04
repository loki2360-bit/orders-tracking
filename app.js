// --- ВСПОМОГАТЕЛЬНЫЕ ---
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatMoney(num) {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(Math.round(num * 100) / 100);
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function getCurrentDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// --- СОСТОЯНИЕ ---
let state = JSON.parse(localStorage.getItem('operatorState')) || {
  totalEarnings: 0,
  todayEarnings: 0,
  ordersByDate: {}
};

function saveState() {
  localStorage.setItem('operatorState', JSON.stringify(state));
}

// --- ПЕРЕСЧЁТ ---
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

// --- РЕНДЕРИНГ ---
function renderOrdersForDate(date, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const orders = state.ordersByDate[date] || [];
  console.log(`[OK] Рендерим ${orders.length} заказов за ${date}`);

  if (orders.length === 0) {
    container.innerHTML = '<p>Заказов пока нет.</p>';
    return;
  }

  let html = `
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
            ).join('<br>') || '—'}
          </div>
          <button class="btn-delete" type="button" onclick="deleteOrder('${date}', ${idx})">Удалить</button>
        </div>
      `).join('')}
    </div>
    <button class="btn" style="margin-top:12px;" type="button" onclick="exportDateToTxt('${date}')">Скачать TXT</button>
  `;

  container.innerHTML = html;
}

function renderAllDates() {
  const container = document('all-dates-list');
  if (!container) return;

  const dates = Object.keys(state.ordersByDate).sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) {
    container.innerHTML = '<p>Нет заказов ни за одну дату.</p>';
    return;
  }

  let html = dates.map(date => `
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
              ).join('<br>') || '—'}
            </div>
            <button class="btn-delete" type="button" onclick="deleteOrder('${date}', ${idx})">Удалить</button>
          </div>
        `).join('')}
        <button class="btn" style="margin-top:1px;width:auto;" type="button" onclick="exportDateToTxt('${date}')">Скачать TXT</button>
      </div>
    </div>
  `).join('');

  container.innerHTML = html;
}

function toggleDateGroup(el) {
  const list = el.nextElementSibling;
  const isOpen = list.classList.contains('open');
  list.classList.toggle('open');
  el.querySelector('span:last-child').textContent = isOpen ? '▶' : '▼';
}

// --- УДАЛЕНИЕ ---
function deleteOrder(date, index) {
  if (!confirm('Удалить заказ? Это действие нельзя отменить.')) return;

  const orders = state.ordersByDate[date];
  if (!orders || !Array.isArray(orders) || index < 0 || index >= orders.length) {
    console.error('Ошибка удаления: заказ не найден');
    return;
  }

  orders.splice(index, 1);
  if (orders.length === 0) {
    delete state.ordersByDate[date];
  }

  recalculateEarnings();
  updateUI();
}

// --- ТАРИФЫ ---
const SERVICES = [
  { id: 'RASPIL_M2', name: 'Распил', unit: 'м²', price: 65 },
  { id: 'LINEAR_RASPIL', name: 'Линейный распил', unit: 'п.м.', price: 26 },
  { id: 'SKLEIKA_OB', name: 'Склейка с обгонкой', unit: 'м²', price: 210 },
  { id: 'SKLEIKA_NO_OB', name: 'Склейка без обгонки', unit: 'м²', price: 165 },
  { id: 'PAZY', name: 'Пазы', unit: 'п.м.', price: 30 },
  { id: 'FREZER_FASKA', name: 'Фрезеровка фаски', unit: 'п.м.', price: 16 },
  { id: 'TIME', name: 'Время', unit: 'час', price: 330 },
];

// --- СОЗДАНИЕ ЗАКАЗА ---
function createOrder() {
  const num = document.getElementById('order-number').value.trim();
  if (!num) return alert('Укажите номер заказа!');

  const blocks = Array.from(document.querySelectorAll('.item-block'));
  if (blocks.length === 0) return alert('Добавьте хотя бы одну деталь!');

  const items = blocks.map(block => {
    const detail = block.querySelector('[data-field="detail"]')?.value.trim() || '—';
    const serviceId = block.querySelector('[data-field="service"]')?.value;
    const qty = parseInt(block.querySelector('[data-field="quantity"]')?.value) || 1;
    const service = SERVICES.find(s => s.id === serviceId);
    if (!service) throw new Error('Неизвестный тариф');

    let price = 0;
    if (serviceId === 'TIME') {
      const hours = parseFloat(block.querySelector('[data-field="hours"]')?.value) || 0;
      price = service.price * hours * qty;
    } else if (['RASPIL_M2', 'SKLEIKA_OB', 'SKLEIKA_NO_OB'].includes(serviceId)) {
      const length = parseFloat(block.querySelector('[data-field="length"]')?.value) || 0;
      const width = parseFloat(block.querySelector('[data-field="width"]')?.value) || 0;
      price = service.price * length * width * qty;
    } else {
      const length = parseFloat(block.querySelector('[data-field="length"]')?.value) || 0;
      price = service.price * length * qty;
    }

    return { detail, service: service.name, quantity: qty, price };
  });

  const total = items.reduce((sum, i) => sum + i.price, 0);
  const today = getCurrentDate();

  if (!state.ordersByDate[today]) state.ordersByDate[today] = [];
  state.ordersByDate[today].push({ number: num, items, total });

  recalculateEarnings();
  updateUI();

  document.getElementById('order-number').value = '';
  document.getElementById('items-container').innerHTML = '';
}

// --- ДОБАВЛЕНИЕ ДЕТАЛИ ---
function addItem() {
  const container = document.getElementById('items-container');
  const idx = container.children.length;

  container.insertAdjacentHTML('beforeend', `
    <div class="item-block">
      <button class="remove" type="button" onclick="this.closest('.item-block').remove()">✕</button>
      <div class="form-row"><label>Деталь:</label><input type="text" placeholder="название" data-field="detail" /></div>
      <div class="form-row"><label>Тариф:</label>
        <select data-field="service" onchange="toggleFields(this, ${idx})">
          ${SERVICES.map(s => `<option value="${s.id}">${s.name} (${s.price}₽/${s.unit})</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Количество:</label><input type="number" value="1" min="1" data-field="quantity" /></div>
      <div class="fields" id="fields-${idx}"></div>
    </div>
  `);
  toggleFields(container.lastElementChild.querySelector('select'), idx);
}

function toggleFields(select, idx) {
  const fieldsDiv = document.getElementById(`fields-${idx}`);
  const serviceId = select.value;
  let html = '';

  if (serviceId === 'TIME') {
    html = `<div class="form-row"><label>Часы:</label><input type="number" step="0.1" min="0.1" data-field="hours" /></div>`;
  } else if (['RASPIL_M2', 'SKLEIKA_OB', 'SKLEIKA_NO_OB'].includes(serviceId)) {
    html = `
      <div class="form-row"><label>Длина (м):</label><input type="number" step="0.01" min="0.01" data-field="length" /></div>
      <div class="form-row"><label>Ширина (м):</label><input type="number" step="0.01" min="0.01" data-field="width" /></div>
    `;
  } else {
    html = `<div class="form-row"><label>Длина (м):</label><input type="number" step="0.01" min="0.01" data-field="length" /></div>`;
  }
  fieldsDiv.innerHTML = html;
}

// --- ПРОЧЕЕ ---
function resetShift() {
  if (confirm('Начать новую смену? Сегодняшние заказы останутся в истории.')) {
    state.todayEarnings = 0;
    saveState();
    updateUI();
  }
}

function exportDateToTxt(dateStr) {
  const orders = state.ordersByDate[dateStr] || [];
  if (orders.length === 0) return;

  let content = `Заказы за ${formatDate(dateStr)}\n`;
  content += '='.repeat(40) + '\n\n';

  let totalDay = 0;
  orders.forEach(order => {
    totalDay += order.total;
    content += `Заказ №${order.number}\n`;
    order.items.forEach(item => {
      content += `- ${item.detail} | ${item.service} | ×${item.quantity} | ${formatMoney(item.price)}\n`;
    });
    content += `Итого по заказу: ${formatMoney(order.total)}\n\n`;
  });

  content += '='.repeat(40) + '\n';
  content += `Общая сумма за день: ${formatMoney(totalDay)}\n`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `заказы_${dateStr}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- АВАТАРКА ---
document.getElementById('avatar-input')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file && file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = function(event) {
      localStorage.setItem('operatorAvatar', event.target.result);
      updateAvatar();
    };
    reader.readAsDataURL(file);
  }
});

function updateAvatar() {
  const avatarEl = document.getElementById('avatar');
  const saved = localStorage.getItem('operatorAvatar');
  if (saved) {
    avatarEl.innerHTML = `<img src="${saved}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
  } else {
    avatarEl.innerHTML = 'О';
  }
}

// --- ОТЛАДКА ---
function debugState() {
  const data = JSON.parse(localStorage.getItem('operatorState'));
  console.log('Состояние:', data);
  alert(`Всего заказов: ${
    Object.values(data.ordersByDate || {}).reduce((sum, arr) => sum + arr.length, 0)
  }`);
}

// --- ИНИЦИАЛИЗАЦИЯ ---
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
  console.log("✅ Финальная версия загружена — всё как в начале");
  updateUI();
  updateAvatar();
});
