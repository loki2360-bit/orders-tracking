const SERVICES = [
  { id: 'RASPIL_M2', name: 'Распил', unit: 'м²', price: 65 },
  { id: 'LINEAR_RASPIL', name: 'Линейный распил', unit: 'п.м.', price: 26 },
  { id: 'SKLEIKA_OB', name: 'Склейка с обгонкой', unit: 'м²', price: 210 },
  { id: 'SKLEIKA_NO_OB', name: 'Склейка без обгонки', unit: 'м²', price: 165 },
  { id: 'PAZY', name: 'Пазы', unit: 'п.м.', price: 30 },
  { id: 'FREZER_FASKA', name: 'Фрезеровка фаски', unit: 'п.м.', price: 16 },
  { id: 'TIME', name: 'Время', unit: 'час', price: 330 },
];

let state = JSON.parse(localStorage.getItem('operatorState')) || {
  totalEarnings: 0,
  todayEarnings: 0,
  shiftStart: new Date().toISOString().split('T')[0],
  ordersByDate: {}
};

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

function saveState() {
  localStorage.setItem('operatorState', JSON.stringify(state));
}

function updateUI() {
  const today = getCurrentDate();

  document.getElementById('total-earnings').textContent = formatMoney(state.totalEarnings);
  document.getElementById('today-earnings').textContent = formatMoney(state.todayEarnings);
  document.getElementById('shift-earned').textContent = formatMoney(state.todayEarnings);

  const progress = Math.min(100, (state.todayEarnings / 3000) * 100);
  document.getElementById('progress').style.width = `${progress}%`;

  renderOrdersForDate(today, 'today-orders');
  renderAllDates();
}

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
    <button class="btn" style="margin-top: 12px;" onclick="exportDateToTxt('${date}')">Скачать TXT</button>
  `;
}

function renderAllDates() {
  const container = document.getElementById('all-dates-list');
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
        <button class="btn" style="margin-top: 12px; width: auto;" onclick="exportDateToTxt('${date}')">Скачать TXT</button>
      </div>
    </div>
  `).join('');
}

function toggleDateGroup(header) {
  const list = header.nextElementSibling;
  const isOpen = list.classList.contains('open');
  list.classList.toggle('open');
  header.querySelector('span:last-child').textContent = isOpen ? '▶' : '▼';
}

function addItem() {
  const container = document.getElementById('items-container');
  const idx = container.children.length;

  const div = document.createElement('div');
  div.className = 'item-block';
  div.innerHTML = `
    <button class="remove" type="button" onclick="this.closest('.item-block').remove()">✕</button>
    <div class="form-row"><label>Деталь:</label><input type="text" placeholder="название" data-field="detail" /></div>
    <div class="form-row"><label>Тариф:</label>
      <select data-field="service" onchange="toggleFields(this, ${idx})">
        ${SERVICES.map(s => `<option value="${s.id}">${s.name} (${s.price}₽/${s.unit})</option>`).join('')}
      </select>
    </div>
    <div class="form-row"><label>Количество:</label><input type="number" value="1" min="1" data-field="quantity" /></div>
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

function createOrder() {
  const orderNumber = document.getElementById('order-number').value.trim();
  if (!orderNumber) return alert('Укажите номер заказа!');
  
  const blocks = Array.from(document.querySelectorAll('.item-block'));
  if (blocks.length === 0) return alert('Добавьте хотя бы одну деталь!');

  const items = blocks.map(block => {
    const detail = block.querySelector('[data-field="detail"]').value.trim();
    const serviceId = block.querySelector('[data-field="service"]').value;
    const quantity = parseInt(block.querySelector('[data-field="quantity"]').value) || 1;
    const service = SERVICES.find(s => s.id === serviceId);

    let price = 0;
    if (serviceId === 'TIME') {
      const hours = parseFloat(block.querySelector('[data-field="hours"]')?.value) || 0;
      price = service.price * hours * quantity;
    } else if (['RASPIL_M2', 'SKLEIKA_OB', 'SKLEIKA_NO_OB'].includes(serviceId)) {
      const length = parseFloat(block.querySelector('[data-field="length"]')?.value) || 0;
      const width = parseFloat(block.querySelector('[data-field="width"]')?.value) || 0;
      price = service.price * length * width * quantity;
    } else {
      const length = parseFloat(block.querySelector('[data-field="length"]')?.value) || 0;
      price = service.price * length * quantity;
    }

    return { detail, service: service.name, quantity, price };
  });

  const total = items.reduce((sum, i) => sum + i.price, 0);
  const today = getCurrentDate();

  if (!state.ordersByDate[today]) state.ordersByDate[today] = [];
  state.ordersByDate[today].push({ number: orderNumber, items, total });

  state.todayEarnings += total;
  state.totalEarnings += total;

  saveState();
  updateUI();

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

function exportDateToTxt(dateStr) {
  const orders = state.ordersByDate[dateStr] || [];
  if (orders.length === 0) return;

  let totalDay = 0;
  let content = `Заказы за ${formatDate(dateStr)}\n`;
  content += '='.repeat(40) + '\n\n';

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

document.getElementById('avatar-input').addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    localStorage.setItem('operatorAvatar', event.target.result);
    updateAvatar();
  };
  reader.readAsDataURL(file);
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

document.addEventListener('DOMContentLoaded', () => {
  updateUI();
  updateAvatar();
});
