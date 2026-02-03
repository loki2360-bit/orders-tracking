// Тарифы
const SERVICES = [
  { id: 'RASPIL_M2', name: 'Распил', unit: 'м²', price: 65 },
  { id: 'LINEAR_RASPIL', name: 'Линейный распил', unit: 'п.м.', price: 26 },
  { id: 'SKLEIKA_OB', name: 'Склейка с обгонкой', unit: 'м²', price: 210 },
  { id: 'SKLEIKA_NO_OB', name: 'Склейка без обгонки', unit: 'м²', price: 165 },
  { id: 'PAZY', name: 'Пазы', unit: 'п.м.', price: 30 },
  { id: 'FREZER_FASKA', name: 'Фрезеровка фаски', unit: 'п.м.', price: 16 },
  { id: 'TIME', name: 'Время', unit: 'час', price: 330 },
];

// Загрузка состояния
let state = JSON.parse(localStorage.getItem('operatorState')) || {
  totalEarnings: 0,
  todayEarnings: 0,
  shiftStart: new Date().toISOString().split('T')[0], // YYYY-MM-DD
  ordersByDate: {} // { "2026-01-21": [order1, order2], ... }
};

// Утилиты
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

// Сохранение
function saveState() {
  localStorage.setItem('operatorState', JSON.stringify(state));
}

// Обновление UI
function updateUI() {
  const today = getCurrentDate();

  // Основные цифры
  document.getElementById('total-earnings').textContent = formatMoney(state.totalEarnings);
  document.getElementById('today-earnings').textContent = formatMoney(state.todayEarnings);
  document.getElementById('shift-earned').textContent = formatMoney(state.todayEarnings);

  const progress = Math.min(100, (state.todayEarnings / 3000) * 100);
  document.getElementById('progress').style.width = `${progress}%`;

  // Сегодняшние заказы
  renderOrdersForDate(today, 'today-orders');

  // Все даты
  renderAllDates();
}

// Рендер заказов за конкретную дату
function renderOrdersForDate(date, containerId) {
  const container = document.getElementById(containerId);
  const orders = state.ordersByDate[date] || [];

  if (orders.length === 0) {
    container.innerHTML = '<p>Заказов пока нет.</p>';
    return;
  }

  container.innerHTML = `
    <div class="orders-list open">
      ${orders.map(order => `
        <div class="order-item">
          <div class="order-header">
            <span>№${order.number}</span>
            <span>${formatMoney(order.total)}</span>
          </div>
          <div class="order-details">
            ${order.items.map(i => 
              `${i.detail} • ${i.service} • ×${i.quantity} • ${formatMoney(i.price)}`
            ).join('<br>')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Рендер всех дат
function renderAllDates() {
  const container = document.getElementById('all-dates-list');
  const dates = Object.keys(state.ordersByDate).sort((a, b) => b.localeCompare(a)); // новые сверху

  if (dates.length === 0) {
    container.innerHTML = '<p>Нет заказов ни за одну дату.</p>';
    return;
  }

  container.innerHTML = dates.map(date => `
    <div class="date-group">
      <div class="date-header" onclick="toggleDateGroup(this)">
        <span>${formatDate(date)}</span>
        <span>▼</span>
      </div>
      <div class="orders-list">
        ${state.ordersByDate[date].map(order => `
          <div class="order-item">
            <div class="order-header">
              <span>№${order.number}</span>
              <span>${formatMoney(order.total)}</span>
            </div>
            <div class="order-details">
              ${order.items.map(i => 
                `${i.detail} • ${i.service} • ×${i.quantity} • ${formatMoney(i.price)}`
              ).join('<br>')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// Переключение раскрытия даты
function toggleDateGroup(header) {
  const list = header.nextElementSibling;
  list.classList.toggle('open');
  header.querySelector('span:last-child').textContent = 
    list.classList.contains('open') ? '▲' : '▼';
}

// --- Форма заказа ---

function addItem() {
  const container = document.getElementById('items-container');
  const idx = container.children.length;

  const div = document.createElement('div');
  div.className = 'item-block';
  div.innerHTML = `
    <button class="remove" onclick="this.closest('.item-block').remove()">✕</button>
    <label>Деталь:</label>
    <input type="text" placeholder="название" data-field="detail" />

    <label>Тариф:</label>
    <select data-field="service" onchange="toggleFields(this, ${idx})">
      ${SERVICES.map(s => `<option value="${s.id}">${s.name} (${s.price}₽/${s.unit})</option>`).join('')}
    </select>

    <label>Количество:</label>
    <input type="number" value="1" min="1" data-field="quantity" />

    <div class="fields" id="fields-${idx}"></div>
  `;
  container.appendChild(div);
  toggleFields(div.querySelector('select'), idx);
}

function toggleFields(select, idx) {
  const fieldsDiv = document.getElementById(`fields-${idx}`);
  const serviceId = select.value;
  let html = '';

  if (serviceId === 'TIME') {
    html = `<label>Часы:</label><input type="number" step="0.1" min="0.1" data-field="hours" />`;
  } else if (['RASPIL_M2', 'SKLEIKA_OB', 'SKLEIKA_NO_OB'].includes(serviceId)) {
    html = `
      <label>Длина (м):</label><input type="number" step="0.01" min="0.01" data-field="length" />
      <label>Ширина (м):</label><input type="number" step="0.01" min="0.01" data-field="width" />
    `;
  } else {
    html = `<label>Длина (м):</label><input type="number" step="0.01" min="0.01" data-field="length" />`;
  }
  fieldsDiv.innerHTML = html;
}

function createOrder() {
  const orderNumber = document.getElementById('order-number').value.trim();
  if (!orderNumber) {
    alert('Укажите номер заказа!');
    return;
  }

  const itemsContainer = document.getElementById('items-container');
  const itemBlocks = Array.from(itemsContainer.children);
  if (itemBlocks.length === 0) {
    alert('Добавьте хотя бы одну деталь!');
    return;
  }

  const items = itemBlocks.map(block => {
    const detail = block.querySelector('[data-field="detail"]').value.trim();
    const serviceId = block.querySelector('[data-field="service"]').value;
    const quantity = parseInt(block.querySelector('[data-field="quantity"]').value) || 1;
    const service = SERVICES.find(s => s.id === serviceId);

    let price = 0;
    if (serviceId === 'TIME') {
      const hours = parseFloat(block.querySelector('[data-field="hours"]').value) || 0;
      price = service.price * hours * quantity;
    } else if (['RASPIL_M2', 'SKLEIKA_OB', 'SKLEIKA_NO_OB'].includes(serviceId)) {
      const length = parseFloat(block.querySelector('[data-field="length"]').value) || 0;
      const width = parseFloat(block.querySelector('[data-field="width"]').value) || 0;
      price = service.price * length * width * quantity;
    } else {
      const length = parseFloat(block.querySelector('[data-field="length"]').value) || 0;
      price = service.price * length * quantity;
    }

    return {
      detail,
      service: service.name,
      quantity,
      price
    };
  });

  const total = items.reduce((sum, i) => sum + i.price, 0);
  const today = getCurrentDate();

  const newOrder = {
    id: Date.now(),
    number: orderNumber,
    items,
    total
  };

  // Добавляем в ordersByDate
  if (!state.ordersByDate[today]) state.ordersByDate[today] = [];
  state.ordersByDate[today].push(newOrder);

  // Обновляем финансы
  state.todayEarnings += total;
  state.totalEarnings += total;

  saveState();
  updateUI();

  // Очистка формы
  document.getElementById('order-number').value = '';
  document.getElementById('items-container').innerHTML = '';
}

function resetShift() {
  if (confirm('Начать новую смену? Сегодняшние заказы останутся в истории.')) {
    state.todayEarnings = 0;
    saveState();
    updateUI();
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  updateUI();
});
