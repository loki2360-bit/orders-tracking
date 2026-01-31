// === ДАННЫЕ ===
let data = JSON.parse(localStorage.getItem('ordersData')) || { orders: [] };
let notifications = JSON.parse(localStorage.getItem('notifications')) || [];
let sentReports = JSON.parse(localStorage.getItem('sentReports')) || [];

// === ТЕМА ===
let currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
  document.body.classList.add('dark-theme');
}

let screenHistory = ['mainScreen'];

// === GOOGLE SHEETS ===
const GOOGLE_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/ТВОЙ_УНИКАЛЬНЫЙ_URL/exec';

function saveData() {
  localStorage.setItem('ordersData', JSON.stringify(data));
  localStorage.setItem('notifications', JSON.stringify(notifications));
  localStorage.setItem('sentReports', JSON.stringify(sentReports));
}

function calculateOrderPrice(operations) {
  const rates = {
    "Распил": 65,
    "Линейный": 26,
    "Склейка простая": 165,
    "Склейка с обгоном": 210,
    "Фрезер фаски": 16,
    "Пазовка": 30,
    "Время": 330
  };

  let total = 0;
  operations.forEach(op => {
    const qty = op.quantity || 1;
    if (["Распил", "Склейка простая", "Склейка с обгоном"].includes(op.type)) {
      total += op.m2 * rates[op.type] * qty;
    }
    if (["Линейный", "Фрезер фаски", "Пазовка"].includes(op.type)) {
      total += op.pm * rates[op.type] * qty;
    }
    if (op.type === "Время") {
      total += op.time * rates[op.type] * qty;
    }
  });
  return Math.round(total * 100) / 100;
}

// === УВЕДОМЛЕНИЯ ===
function createNotification(orderId, message) {
  const now = new Date().toISOString();
  const notification = {
    id: `notif-${Date.now()}`,
    orderId: orderId,
    message: message,
    timestamp: now,
    read: false
  };
  notifications.push(notification);
  saveData();
  updateNotificationBadge();
}

function updateNotificationBadge() {
  const unreadCount = notifications.filter(n => !n.read).length;
  const badge = document.getElementById('notificationBadgeInList');
  if (badge) {
    badge.textContent = unreadCount > 0 ? unreadCount : '';
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }
}

// === НАВИГАЦИЯ ===
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  let screen = document.getElementById(id);
  if (!screen) {
    console.error(`Screen '${id}' not found.`);
    return;
  }
  screen.classList.add('active');
}

function goToPrevious() {
  if (screenHistory.length > 1) {
    screenHistory.pop();
    switchScreen(screenHistory[screenHistory.length - 1]);
  } else {
    screenHistory = ['mainScreen'];
    switchScreen('mainScreen');
    loadMainScreen();
  }
}

// === ГЛАВНЫЙ ЭКРАН ===
function loadMainScreen() {
  let total = 0;
  let today = new Date().toISOString().split('T')[0];
  let daily = 0;

  data.orders.forEach(order => {
    if (order.status === 'closed') {
      const price = order.price || calculateOrderPrice(order.operations || []);
      total += price;
      if (order.date === today) {
        daily += price;
      }
    }
  });

  total = Math.round(total * 100) / 100;
  daily = Math.round(daily * 100) / 100;

  document.getElementById("totalEarnings").textContent = `${total}₽`;
  document.getElementById("dailyEarnings").textContent = `${daily}₽`;

  // Автоуведомление о плане
  const planNotified = localStorage.getItem('planNotifiedToday') === today;
  if (daily >= 3000 && !planNotified) {
    setTimeout(() => {
      alert('🎉 План на смену выполнен!');
      localStorage.setItem('planNotifiedToday', today);
    }, 1000);
  }

  switchScreen('mainScreen');
}

// === СМЕНЫ ===
function showShiftsScreen() {
  let screen = document.getElementById("shiftScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "shiftScreen";
    screen.innerHTML = `
      <h2>Смена</h2>
      <input type="date" id="dateInput">
      <button id="showOrdersForDay">Показать</button>
      <div id="ordersOfDay"></div>
      <div id="totalOfDay"></div>
      <button id="btnExportShift">Сохранить смену</button>
      <button id="btnImportShift">Загрузить смену</button>
      <button onclick="goToPrevious()">Назад</button>
    `;
    document.body.appendChild(screen);

    document.getElementById("dateInput").value = new Date().toISOString().split('T')[0];

    document.getElementById("showOrdersForDay").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      showOrdersForDay(date);
    });

    document.getElementById("btnExportShift").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      if (date) exportShiftData(date);
    });

    document.getElementById("btnImportShift").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      if (date) importShiftData(date);
    });
  }
  switchScreen('shiftScreen');
}

function showOrdersForDay(date) {
  const orders = data.orders.filter(o => o.date === date);
  const container = document.getElementById("ordersOfDay");
  container.innerHTML = "";
  let total = 0;

  orders.forEach(order => {
    const price = order.status === 'closed'
      ? (order.price || calculateOrderPrice(order.operations || []))
      : 0;
    if (order.status === 'closed') total += price;
    const priceDisplay = order.status === 'closed' ? `${Math.round(price * 100) / 100}₽` : '—';
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `<span>${order.id}</span><span class="price-tag">${priceDisplay}</span>`;
    container.appendChild(item);
  });

  total = Math.round(total * 100) / 100;
  document.getElementById("totalOfDay").innerHTML = `<h3>итого: ${total}₽</h3>`;
}

// === ЭКСПОРТ/ИМПОРТ СМЕНЫ ===
function exportShiftData(date) {
  const orders = data.orders.filter(o => o.date === date);
  if (orders.length === 0) {
    alert("Нет заказов за эту дату");
    return;
  }

  const jsonStr = JSON.stringify({ date, orders }, null, 2);
  navigator.clipboard.writeText(jsonStr).then(() => {
    alert(`✅ Смена ${date} скопирована!`);
  }).catch(() => {
    alert('Скопируйте вручную:\n\n' + jsonStr);
  });
}

function importShiftData(targetDate) {
  navigator.clipboard.readText().then(text => {
    try {
      const shiftData = JSON.parse(text);
      if (!shiftData.orders) throw new Error('Нет заказов');

      data.orders = data.orders.filter(o => o.date !== targetDate);
      const newOrders = shiftData.orders.map(order => ({ ...order, date: targetDate }));
      data.orders = [...data.orders, ...newOrders];
      saveData();
      alert(`✅ Смена загружена за ${targetDate}`);
      showOrdersForDay(targetDate);
    } catch (err) {
      alert('❌ Ошибка: ' + err.message);
    }
  }).catch(() => {
    alert('Не удалось прочитать буфер');
  });
}

// === СПИСОК ЗАКАЗОВ ===
function showOrdersList() {
  let screen = document.getElementById("ordersListScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "ordersListScreen";
    screen.innerHTML = `
      <h2>СПИСОК ЗАКАЗОВ</h2>
      <input type="text" id="searchInput" placeholder="поиск по номеру заказа">
      <button id="btnCreateNew">создать новый</button>
      <button id="btnBack">назад</button>
      <div id="allOrdersList"></div>
    `;
    document.body.appendChild(screen);

    document.getElementById("searchInput").addEventListener("input", function() {
      const query = this.value.trim().toLowerCase();
      if (query) searchOrders(query); else displayOrdersGroupedByDate();
    });

    document.getElementById("btnCreateNew").addEventListener("click", createOrderForm);
    document.getElementById("btnBack").addEventListener("click", goToPrevious);

    displayOrdersGroupedByDate();
  } else {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();
    if (query) searchOrders(query); else displayOrdersGroupedByDate();
  }
  switchScreen('ordersListScreen');
}

function displayOrdersGroupedByDate() {
  const container = document.getElementById("allOrdersList");
  container.innerHTML = "";
  const grouped = {};

  data.orders.forEach(order => {
    if (order.date && order.date !== 'Invalid date') {
      if (!grouped[order.date]) grouped[order.date] = [];
      grouped[order.date].push(order);
    }
  });

  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  sortedDates.forEach(date => {
    const title = document.createElement("div");
    title.innerHTML = `<h3>${date} <span class="arrow">▼</span></h3><div class="date-list" id="list-${date}" style="display:none;"></div>`;
    container.appendChild(title);

    const list = document.getElementById(`list-${date}`);
    grouped[date].forEach(order => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<span>${order.id}</span>`;
      item.onclick = () => showOrderDetails(order.id);
      list.appendChild(item);
    });

    title.querySelector('h3').onclick = () => {
      const l = document.getElementById(`list-${date}`);
      l.style.display = l.style.display === "none" ? "block" : "none";
      title.querySelector('.arrow').textContent = l.style.display === "none" ? "▼" : "▲";
    };
  });
}

function searchOrders(query) {
  const container = document.getElementById("allOrdersList");
  container.innerHTML = "";
  const results = data.orders.filter(order => order.id.toLowerCase().includes(query));
  if (results.length === 0) {
    container.innerHTML = `<p>Заказ не найден.</p>`;
  } else {
    results.forEach(order => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<span>${order.id}</span>`;
      item.onclick = () => showOrderDetails(order.id);
      container.appendChild(item);
    });
  }
}

// === СОЗДАНИЕ ЗАКАЗА ===
function createOrderForm() {
  let screen = document.getElementById("createOrderScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "createOrderScreen";
    screen.innerHTML = `
      <h2>создать заказ</h2>
      <input type="text" id="orderNumber" placeholder="номер заказа">
      <input type="text" id="orderDetail" placeholder="деталь">
      <input type="date" id="orderDate">
      <select id="orderType">
        <option value="Распил">Распил — 65₽/м²</option>
        <option value="Линейный">Линейный — 26₽/п.м</option>
        <option value="Склейка простая">Склейка простая — 165₽/м²</option>
        <option value="Склейка с обгоном">Склейка с обгоном — 210₽/м²</option>
        <option value="Фрезер фаски">Фрезер фаски — 16₽/п.м</option>
        <option value="Пазовка">Пазовка — 30₽/п.м</option>
        <option value="Время">Время — 330₽</option>
      </select>
      <input type="number" id="quantity" placeholder="Количество" value="1" min="1">
      <input type="number" id="m2" placeholder="м²" value="0" min="0" step="0.1">
      <input type="number" id="pm" placeholder="п.м" value="0" min="0" step="0.1">
      <input type="number" id="time" placeholder="Часы" value="0" min="0" step="0.5">
      <button id="saveOrder">создать</button>
      <button onclick="goToPrevious()">назад</button>
    `;
    document.body.appendChild(screen);

    document.getElementById("orderDate").value = new Date().toISOString().split('T')[0];

    document.getElementById("saveOrder").addEventListener("click", () => {
      const id = document.getElementById("orderNumber").value.trim();
      if (!id) { alert("Введите номер заказа"); return; }
      const detail = document.getElementById("orderDetail").value.trim() || '-';
      const type = document.getElementById("orderType").value;
      const quantity = parseFloat(document.getElementById("quantity").value) || 1;
      const m2 = parseFloat(document.getElementById("m2").value) || 0;
      const pm = parseFloat(document.getElementById("pm").value) || 0;
      const time = parseFloat(document.getElementById("time").value) || 0;
      const date = document.getElementById("orderDate").value;

      data.orders.push({
        id,
        detail,
        date,
        status: 'open',
        operations: [{ detail, type, quantity, m2, pm, time }],
        createdAt: new Date().toISOString()
      });

      saveData();
      alert(`Заказ создан: ${id}`);
      goToPrevious();
    });
  }
  switchScreen('createOrderScreen');
}

// === ДЕТАЛИ ЗАКАЗА ===
function showOrderDetails(orderId) {
  const order = data.orders.find(o => o.id === orderId);
  if (!order) return;

  let screen = document.getElementById("orderDetailsScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "orderDetailsScreen";
    document.body.appendChild(screen);
  }

  const displayDate = order.date || new Date().toISOString().split('T')[0];

  let detailsHtml = `
    <h2>${order.id}</h2>
    <p>Общая деталь: ${order.detail || '-'}</p>
    <label>Дата:</label>
    <input type="date" id="editOrderDate" value="${displayDate}">
    <h3>Операции:</h3>
  `;

  order.operations.forEach((op, idx) => {
    detailsHtml += `
      <div class="operation-item">
        <small>${idx + 1}. ${op.type}</small><br>
        <small>Деталь: ${op.detail || '-'}</small><br>
        <small>Кол-во: ${op.quantity} | м²: ${op.m2} | п.м: ${op.pm} | ч: ${op.time}</small>
      </div>
    `;
  });

  const currentPrice = order.status === 'closed'
    ? (order.price || calculateOrderPrice(order.operations))
    : calculateOrderPrice(order.operations);
  detailsHtml += `<p>Текущая сумма: ${currentPrice}₽</p>`;

  if (order.status !== 'closed') {
    detailsHtml += `<button id="btnFinishOrder">завершить</button>`;
  }

  detailsHtml += `
    <button id="btnSaveDate">сохранить дату</button>
    <button id="btnDeleteOrder">удалить</button>
    <button onclick="goToPrevious()">назад</button>
  `;

  screen.innerHTML = detailsHtml;
  switchScreen('orderDetailsScreen');

  if (order.status !== 'closed') {
    document.getElementById("btnFinishOrder").addEventListener("click", () => finishOrder(orderId));
  }

  document.getElementById("btnDeleteOrder").addEventListener("click", () => deleteOrder(orderId));

  document.getElementById("btnSaveDate").addEventListener("click", () => {
    const newDate = document.getElementById("editOrderDate").value;
    if (!newDate) {
      alert("Выберите дату");
      return;
    }
    order.date = newDate;
    saveData();
    alert("Дата обновлена!");
    showOrderDetails(orderId);
  });
}

function deleteOrder(orderId) {
  if (confirm("Удалить заказ?")) {
    data.orders = data.orders.filter(o => o.id !== orderId);
    saveData();
    alert("Заказ удалён");
    goToPrevious();
  }
}

function finishOrder(orderId) {
  const order = data.orders.find(o => o.id === orderId);
  if (!order) return;

  const price = calculateOrderPrice(order.operations);
  order.price = price;
  order.status = 'closed';
  saveData();
  alert(`Заказ завершён. Цена: ${price}₽`);
  showOrderDetails(orderId);
}

// === АВАТАРКА → ПЛАН ===
function openPlanModal() {
  const today = new Date().toISOString().split('T')[0];
  let daily = 0;

  data.orders.forEach(order => {
    if (order.status === 'closed' && order.date === today) {
      const price = order.price || calculateOrderPrice(order.operations || []);
      daily += price;
    }
  });

  daily = Math.round(daily * 100) / 100;
  const planAchieved = daily >= 3000;

  const modal = document.createElement('div');
  modal.className = 'plan-modal';
  modal.innerHTML = `
    <div class="plan-content">
      <div class="plan-title">План на смену</div>
      <div class="plan-amount" style="color:${planAchieved ? '#4CAF50' : '#ff4444'};">
        ${daily}₽ / 3000₽
      </div>
      ${planAchieved ? '<div class="gift-icon" id="giftIcon">🎁</div>' : ''}
      <button style="margin-top:16px;" onclick="this.parentElement.parentElement.remove()">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  if (planAchieved) {
    document.getElementById('giftIcon').addEventListener('click', () => {
      alert('🎉 План выполнен! Молодец!');
      modal.remove();
    });
  }
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener("DOMContentLoaded", () => {
  loadMainScreen();

  // Клик по аватарке
  const avatar = document.getElementById('avatarBtn');
  if (avatar) {
    avatar.addEventListener('click', openPlanModal);
  }

  // Кнопки главного экрана
  document.getElementById("btnOrders").addEventListener("click", showOrdersList);
  document.getElementById("btnShifts").addEventListener("click", showShiftsScreen);
});
