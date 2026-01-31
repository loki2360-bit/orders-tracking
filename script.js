// === ДАННЫЕ ===
let data = JSON.parse(localStorage.getItem('ordersData')) || { orders: [] };
let appData = JSON.parse(localStorage.getItem('appData')) || { createdCount: 0, activationKeyUsed: false };
let notifications = JSON.parse(localStorage.getItem('notifications')) || [];
let sentReports = JSON.parse(localStorage.getItem('sentReports')) || [];

// === ТЕМА ===
let currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
  document.body.classList.add('dark-theme');
}

// === ГРАФИК ===
let isChartVisible = false;

// История экранов
let screenHistory = ['mainScreen'];

// === GOOGLE SHEETS ===
const GOOGLE_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/ТВОЙ_УНИКАЛЬНЫЙ_URL/exec';

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

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

function calculateSingleOperationPrice(op) {
  const rates = {
    "Распил": 65,
    "Линейный": 26,
    "Склейка простая": 165,
    "Склейка с обгоном": 210,
    "Фрезер фаски": 16,
    "Пазовка": 30,
    "Время": 330
  };

  let price = 0;
  const qty = op.quantity || 1;
  if (["Распил", "Склейка простая", "Склейка с обгоном"].includes(op.type)) {
    price += op.m2 * rates[op.type] * qty;
  }
  if (["Линейный", "Фрезер фаски", "Пазовка"].includes(op.type)) {
    price += op.pm * rates[op.type] * qty;
  }
  if (op.type === "Время") {
    price += op.time * rates[op.type] * qty;
  }
  return Math.round(price * 100) / 100;
}

function toggleTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  document.body.classList.toggle('dark-theme', theme === 'dark');
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
  updateNotificationIcon();
}

function checkOverdueOrders() {
  const now = new Date();
  data.orders.forEach(order => {
    if (order.status === 'open') {
      let orderDate = new Date(order.createdAt);
      if ((now - orderDate) > 15 * 60 * 1000) {
        const existing = notifications.find(n => n.orderId === order.id && !n.read);
        if (!existing) {
          createNotification(order.id, `Ваш заказ ${order.id}, не закрыт`);
        }
      }
    }
  });
}

function updateNotificationBadge() {
  const unreadCount = notifications.filter(n => !n.read).length;
  const badge = document.getElementById('notificationBadgeInList');
  if (badge) {
    badge.textContent = unreadCount > 0 ? unreadCount : '';
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';
  }
}

function updateNotificationIcon() {
  const icon = document.getElementById('notificationIcon');
  if (icon) {
    icon.style.color = notifications.length > 0 ? 'red' : 'black';
  }
}

function showNotificationsScreen() {
  let screen = document.getElementById("notificationsScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "notificationsScreen";
    screen.innerHTML = `
      <h2>УВЕДОМЛЕНИЯ</h2>
      <button id="btnClearNotifications">очистить все</button>
      <div id="notificationsList"></div>
      <button onclick="goToPrevious()">назад</button>
    `;
    document.body.appendChild(screen);

    document.getElementById("btnClearNotifications").addEventListener("click", clearAllNotifications);

    const list = document.getElementById("notificationsList");
    list.innerHTML = "";

    if (notifications.length === 0) {
      list.innerHTML = `<p>Нет уведомлений</p>`;
    } else {
      notifications.forEach(notification => {
        const item = document.createElement("div");
        item.className = `notification-item ${notification.read ? 'read' : 'unread'}`;
        item.innerHTML = `<span>${notification.message}</span>`;
        item.onclick = () => markAsRead(notification.id);
        list.appendChild(item);
      });
    }
  }
  switchScreen('notificationsScreen');
}

function markAsRead(notificationId) {
  const notification = notifications.find(n => n.id === notificationId);
  if (notification) {
    notification.read = true;
    saveData();
    updateNotificationBadge();
    updateNotificationIcon();
    showNotificationsScreen();
  }
}

function clearAllNotifications() {
  if (confirm("Вы уверены, что хотите очистить все уведомления?")) {
    notifications = [];
    saveData();
    updateNotificationBadge();
    updateNotificationIcon();
    showNotificationsScreen();
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

function addToHistory(screenId) {
  if (screenHistory[screenHistory.length - 1] !== screenId) {
    screenHistory.push(screenId);
    history.pushState({}, '', '#' + screenId);
  }
}

// === ГРАФИК ЗАРАБОТКА ===

function getLast7DaysEarnings() {
  const today = new Date();
  const dates = [];
  const earnings = [];

  for ( let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    dates.push(dateStr);

    let sum = 0;
    data.orders.forEach(order => {
      if (order.status === 'closed' && order.date === dateStr) {
        sum += order.price || calculateOrderPrice(order.operations || []);
      }
    });
    earnings.push(Math.round(sum * 100) / 100);
  }

  return { dates, earnings };
}

let earningsChart = null;

function renderEarningsChart() {
  const ctx = document.getElementById('earningsChart').getContext('2d');

  if (earningsChart) {
    earningsChart.destroy();
  }

  const { dates, earnings } = getLast7DaysEarnings();

  earningsChart = new Chart(ctx, {
    type: 'bar',
     {
      labels: dates,
      datasets: [{
        label: 'Заработок, ₽',
         earnings,
        backgroundColor: '#ffd700',
        borderColor: '#000',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            color: document.body.classList.contains('dark-theme') ? '#f0f0f0' : '#333'
          },
          grid: {
            color: document.body.classList.contains('dark-theme') ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }
        },
        x: {
          ticks: {
            color: document.body.classList.contains('dark-theme') ? '#f0f0f0' : '#333'
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// === ЭКРАНЫ ===

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

  const chartContainer = document.getElementById('chartContainer');
  const toggleBtn = document.getElementById('toggleChart');
  
  if (isChartVisible) {
    chartContainer.style.display = 'block';
    toggleBtn.textContent = 'Скрыть график';
    renderEarningsChart();
  } else {
    chartContainer.style.display = 'none';
    toggleBtn.textContent = 'Показать график';
  }

  const planNotified = localStorage.getItem('planNotifiedToday') === today;
  if (daily >= 3000 && !planNotified) {
    setTimeout(() => {
      alert('🎉 План на смену выполнен!');
      localStorage.setItem('planNotifiedToday', today);
    }, 1000);
  }

  switchScreen('mainScreen');
}

// === ФУНКЦИЯ СБРОСА ОТЧЁТОВ ===
function resetSentReports() {
  if (confirm("Вы уверены? Это позволит отправить отчёты за все даты заново.")) {
    sentReports = [];
    saveData();
    alert("История отправленных отчётов очищена.");
  }
}

// === ЭКСПОРТ/ИМПОРТ СМЕНЫ ===

function exportShiftData(date) {
  const orders = data.orders.filter(o => o.date === date);
  if (orders.length === 0) {
    alert("Нет заказов за эту дату");
    return;
  }

  const shiftData = {
    date: date,
    orders: orders
  };

  const jsonStr = JSON.stringify(shiftData, null, 2);

  if (navigator.clipboard) {
    navigator.clipboard.writeText(jsonStr).then(() => {
      alert(`✅ Смена ${date} скопирована!\nВставьте в заметку или файл.`);
    }).catch(err => {
      alert('Ошибка копирования. Попробуйте вручную.');
      console.error(err);
    });
  } else {
    const textArea = document.createElement('textarea');
    textArea.value = jsonStr;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    alert(`✅ Смена ${date} скопирована!`);
  }
}

function importShiftData(targetDate) {
  if (navigator.clipboard) {
    navigator.clipboard.readText().then(text => {
      try {
        const shiftData = JSON.parse(text);
        
        if (!shiftData.date || !shiftData.orders) {
          alert('❌ Неверный формат данных');
          return;
        }

        data.orders = data.orders.filter(o => o.date !== targetDate);
        const newOrders = shiftData.orders.map(order => ({
          ...order,
          date: targetDate
        }));

        data.orders = [...data.orders, ...newOrders];
        saveData();
        alert(`✅ Смена загружена за ${targetDate}`);
        showOrdersForDay(targetDate);
      } catch (err) {
        alert('❌ Ошибка: ' + err.message);
      }
    }).catch(err => {
      alert('Не удалось прочитать буфер. Убедитесь, что там данные смены.');
    });
  } else {
    const input = prompt('Вставьте сюда JSON-данные смены:');
    if (input) {
      try {
        const shiftData = JSON.parse(input);
        if (shiftData.orders && Array.isArray(shiftData.orders)) {
          data.orders = data.orders.filter(o => o.date !== targetDate);
          const newOrders = shiftData.orders.map(order => ({
            ...order,
            date: targetDate
          }));
          data.orders = [...data.orders, ...newOrders];
          saveData();
          alert(`✅ Смена загружена за ${targetDate}`);
          showOrdersForDay(targetDate);
        }
      } catch (err) {
        alert('❌ Ошибка: ' + err.message);
      }
    }
  }
}

function showShiftsScreen() {
  let screen = document.getElementById("shiftScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "shiftScreen";
    screen.innerHTML = `
      <h2 class="title">Смена</h2>
      <input type="date" id="dateInput">
      <button id="showOrdersForDay">Показать</button>
      <div id="ordersOfDay"></div>
      <div id="totalOfDay"></div>
      
      <button id="btnExportShift">Сохранить смену</button>
      <button id="btnImportShift">Загрузить смену</button>
      
      <button id="btnSaveReport">Сохранить отчёт</button>
      <button id="resetReportsBtn" style="display:none;">Сбросить отчёты</button>
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
      if (!date) {
        alert("Выберите дату");
        return;
      }
      exportShiftData(date);
    });

    document.getElementById("btnImportShift").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      if (!date) {
        alert("Выберите дату");
        return;
      }
      importShiftData(date);
    });

    document.getElementById("btnSaveReport").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      if (!date) {
        alert("Выберите дату");
        return;
      }
      saveReportToGoogleSheet(date);
    });

    document.getElementById("resetReportsBtn").addEventListener("click", resetSentReports);

    let clickCount = 0;
    let lastClickTime = 0;
    document.querySelector("#shiftScreen .title").addEventListener("click", () => {
      const now = Date.now();
      if (now - lastClickTime < 500) {
        clickCount++;
      } else {
        clickCount = 1;
      }
      lastClickTime = now;
      if (clickCount >= 3) {
        document.getElementById("resetReportsBtn").style.display = "block";
        clickCount = 0;
      }
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

// === ОТПРАВКА ОТЧЁТА ===

async function saveReportToGoogleSheet(date) {
  if (sentReports.includes(date)) {
    alert(`Отчёт за ${date} уже отправлен.`);
    return;
  }

  const orders = data.orders.filter(o => o.date === date);
  if (orders.length === 0) {
    alert("Нет заказов за эту дату.");
    return;
  }

  const reportData = [];
  orders.forEach(order => {
    const price = order.status === 'closed'
      ? (order.price || calculateOrderPrice(order.operations))
      : calculateOrderPrice(order.operations);
    order.operations.forEach(op => {
      reportData.push({
        date: order.date,
        orderId: order.id,
        detail: op.detail || '-',
        operationType: op.type,
        quantity: op.quantity,
        m2: op.m2,
        pm: op.pm,
        time: op.time,
        pricePerOperation: calculateSingleOperationPrice(op),
        totalOrderPrice: price
      });
    });
  });

  try {
    await fetch(GOOGLE_SHEET_WEB_APP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report: reportData })
    });
    sentReports.push(date);
    saveData();
    alert(`Отчёт за ${date} отправлен!`);
  } catch (err) {
    console.error('Ошибка:', err);
    alert('Не удалось отправить отчёт.');
  }
}

// === ЗАГРУЗКА ИЗ GOOGLE ТАБЛИЦЫ ===

async function loadOrdersFromGoogle() {
  try {
    const response = await fetch(GOOGLE_SHEET_WEB_APP_URL);
    const text = await response.text();
    console.log("📥 Ответ от Google:", text);

    const result = JSON.parse(text);

    if (result.error) {
      alert("Ошибка: " + result.error);
      return;
    }

    if (!result.orders || result.orders.length === 0) {
      alert("Нет данных.");
      return;
    }

    const normalizedOrders = result.orders.map(order => {
      let dateStr = '';

      if (order.date) {
        dateStr = normalizeDate(order.date);
      } else if (order['Дата']) {
        dateStr = normalizeDate(order['Дата']);
      }

      if (!dateStr || dateStr === 'Invalid date') {
        dateStr = '';
      }

      return {
        ...order,
        date: dateStr,
        id: order.id || order['Заказ №'] || 'NO_ID',
        detail: order.detail || order['Общая деталь'] || '-',
        status: 'closed',
        operations: order.operations || [{
          detail: order.detail || '-',
          type: order.operationType || order['Операция'] || 'Время',
          quantity: order.quantity || 1,
          m2: order.m2 || 0,
          pm: order.pm || 0,
          time: order.time || 0
        }]
      };
    });

    const validOrders = normalizedOrders.filter(o => o.date);
    const existingIds = new Set(data.orders.map(o => o.id));
    const newOrders = validOrders.filter(o => !existingIds.has(o.id));

    data.orders = [...data.orders, ...newOrders];
    saveData();

    if (document.getElementById('ordersListScreen').classList.contains('active')) {
      displayOrdersGroupedByDate();
    }

    alert(`Загружено ${newOrders.length} заказов.`);
  } catch (err) {
    console.error("💥 Ошибка:", err);
    alert("Не удалось загрузить данные. Подробности в консоли (F12).");
  }
}

function normalizeDate(dateVal) {
  if (!dateVal) return '';
  if (typeof dateVal === 'string') {
    if (dateVal.includes('T')) {
      return dateVal.split('T')[0];
    } else if (dateVal.includes('.')) {
      const parts = dateVal.split('.');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    } else {
      return dateVal;
    }
  } else if (typeof dateVal === 'number') {
    const jsDate = new Date((dateVal - 25569) * 86400 * 1000);
    return jsDate.toISOString().split('T')[0];
  }
  return '';
}

// === СПИСОК ЗАКАЗОВ ===

function showOrdersList() {
  let screen = document.getElementById("ordersListScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "ordersListScreen";
    screen.innerHTML = `
      <div class="header-with-notif">
        <h2 class="title">СПИСОК ЗАКАЗОВ</h2>
        <button id="btnNotificationsInList" class="notification-btn">✉️</button>
      </div>
      <input type="text" id="searchInput" placeholder="поиск по номеру заказа">
      <button id="btnCreateNew">создать новый</button>
      <button id="btnLoadFromGoogle">загрузить из google</button>
      <button id="btnBack">назад</button>
      <div id="allOrdersList"></div>
    `;
    document.body.appendChild(screen);

    document.getElementById("searchInput").addEventListener("input", function() {
      const query = this.value.trim().toLowerCase();
      if (query) searchOrders(query); else displayOrdersGroupedByDate();
    });

    document.getElementById("btnCreateNew").addEventListener("click", () => {
      createOrderForm();
      addToHistory('createOrderScreen');
    });

    document.getElementById("btnLoadFromGoogle").addEventListener("click", () => {
      if (confirm("Загрузить заказы из Google Таблицы?")) {
        loadOrdersFromGoogle();
      }
    });

    document.getElementById("btnBack").addEventListener("click", goToPrevious);

    document.getElementById("btnNotificationsInList").addEventListener("click", showNotificationsScreen);

    updateNotificationIcon();
    updateNotificationBadge();
    displayOrdersGroupedByDate();
  } else {
    const query = document.getElementById("searchInput").value.trim().toLowerCase();
    if (query) searchOrders(query); else displayOrdersGroupedByDate();
    updateNotificationIcon();
    updateNotificationBadge();
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
    title.className = "date-header";
    title.innerHTML = `
      <h3 class="date-title" data-date="${date}">${date} <span class="arrow">▼</span></h3>
      <div class="date-list" id="list-${date}" style="display:none;"></div>
    `;
    container.appendChild(title);

    const list = document.getElementById(`list-${date}`);
    grouped[date].forEach(order => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<span>${order.id}</span>`;
      item.onclick = () => {
        showOrderDetails(order.id);
        addToHistory('orderDetailsScreen');
      };
      list.appendChild(item);
    });
  });

  document.querySelectorAll(".date-title").forEach(el => {
    el.addEventListener("click", () => {
      const date = el.dataset.date;
      const list = document.getElementById(`list-${date}`);
      const arrow = el.querySelector(".arrow");
      if (list.style.display === "none") {
        list.style.display = "block";
        arrow.textContent = "▲";
      } else {
        list.style.display = "none";
        arrow.textContent = "▼";
      }
    });
  });
}

function searchOrders(query) {
  const container = document.getElementById("allOrdersList");
  container.innerHTML = "";
  const results = data.orders.filter(order => order.id.toLowerCase().includes(query));
  if (results.length === 0) {
    container.innerHTML = `<p class="no-results">Заказ "${query}" не найден.</p>`;
  } else {
    results.forEach(order => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<span>${order.id}</span>`;
      item.onclick = () => {
        showOrderDetails(order.id);
        addToHistory('orderDetailsScreen');
      };
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
      <h2 class="title">создать заказ</h2>
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
      <input type="number" id="quantity" placeholder="Количество" value="1" min="1" step="1">
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

// === МОДАЛЬНОЕ ОКНО ДОБАВЛЕНИЯ ОПЕРАЦИИ ===

function showAddOperationForm(orderId) {
  const modal = document.createElement("div");
  modal.id = "operationModal";
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Новая операция</h3>
      <input type="text" id="newOpDetail" placeholder="Деталь (например, столешка, ножка)">
      <select id="newOpType">
        <option value="Распил">Распил — 65₽/м²</option>
        <option value="Линейный">Линейный — 26₽/п.м</option>
        <option value="Склейка простая">Склейка простая — 165₽/м²</option>
        <option value="Склейка с обгоном">Склейка с обгоном — 210₽/м²</option>
        <option value="Фрезер фаски">Фрезер фаски — 16₽/п.м</option>
        <option value="Пазовка">Пазовка — 30₽/п.м</option>
        <option value="Время">Время — 330₽</option>
      </select>
      <input type="number" id="newOpQuantity" placeholder="Количество" value="1" min="1" step="1">
      <input type="number" id="newOpM2" placeholder="м²" value="0" min="0" step="0.1">
      <input type="number" id="newOpPM" placeholder="п.м" value="0" min="0" step="0.1">
      <input type="number" id="newOpTime" placeholder="Часы" value="0" min="0" step="0.5">
      <button id="saveNewOp">добавить</button>
      <button id="cancelNewOp">отмена</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("saveNewOp").addEventListener("click", () => {
    const detail = document.getElementById("newOpDetail").value.trim() || '-';
    const type = document.getElementById("newOpType").value;
    const quantity = parseFloat(document.getElementById("newOpQuantity").value) || 1;
    const m2 = parseFloat(document.getElementById("newOpM2").value) || 0;
    const pm = parseFloat(document.getElementById("newOpPM").value) || 0;
    const time = parseFloat(document.getElementById("newOpTime").value) || 0;

    const order = data.orders.find(o => o.id === orderId);
    if (order) {
      order.operations.push({ detail, type, quantity, m2, pm, time });
      saveData();
      showOrderDetails(orderId);
    }
    document.body.removeChild(modal);
  });

  document.getElementById("cancelNewOp").addEventListener("click", () => {
    document.body.removeChild(modal);
  });
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
    <h2 class="title">${order.id}</h2>
    <p>Общая деталь: ${order.detail || '-'}</p>
    
    <label class="field-label">Дата:</label>
    <input type="date" id="editOrderDate" value="${displayDate}">
    
    <h3 class="section-title">Операции:</h3>
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
  detailsHtml += `<p class="price-total">Текущая сумма: ${currentPrice}₽</p>`;

  if (order.status !== 'closed') {
    detailsHtml += `<button id="btnAddOperation">добавить операцию</button>`;
    detailsHtml += `<button id="btnFinishOrder">завершить</button>`;
  } else {
    detailsHtml += `<p class="price-final">Итоговая цена: ${order.price}₽</p>`;
  }

  detailsHtml += `
    <button id="btnSaveDate">сохранить дату</button>
    <button id="btnDeleteOrder">удалить</button>
    <button onclick="goToPrevious()">назад</button>
  `;

  screen.innerHTML = detailsHtml;
  switchScreen('orderDetailsScreen');

  if (order.status !== 'closed') {
    document.getElementById("btnAddOperation").addEventListener("click", () => showAddOperationForm(orderId));
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

// === УПРАВЛЕНИЕ ЗАКАЗАМИ ===

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

// === НАСТРОЙКИ ===

function showSettings() {
  const modal = document.createElement('div');
  modal.className = 'settings-modal';
  modal.innerHTML = `
    <div class="settings-content">
      <h3>Настройки</h3>
      <div class="theme-option" data-theme="light">
        <span>Светлая тема</span>
      </div>
      <div class="theme-option" data-theme="dark">
        <span>Тёмная тема</span>
      </div>
      <button style="width:100%; margin-top:15px;" onclick="this.parentElement.parentElement.remove()">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelectorAll('.theme-option').forEach(option => {
    if (option.dataset.theme === currentTheme) {
      option.classList.add('active');
    }
    option.onclick = () => {
      modal.querySelectorAll('.theme-option').forEach(el => el.classList.remove('active'));
      option.classList.add('active');
      toggleTheme(option.dataset.theme);
    };
  });
}

// === КАЛЬКУЛЯТОР М² ===

function openCalculator() {
  const modal = document.createElement('div');
  modal.className = 'calculator-modal';
  modal.innerHTML = `
    <div class="calculator-content">
      <h3>Калькулятор м²</h3>
      <input type="number" id="calcLength" placeholder="Длина (мм)" min="1">
      <input type="number" id="calcWidth" placeholder="Ширина (мм)" min="1">
      <input type="number" id="calcQuantity" placeholder="Количество" value="1" min="1">
      <div class="result" id="calcResult">0 м²</div>
      <button id="copyResult" class="copy-btn">Скопировать результат</button>
      <button id="closeCalc">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  const updateResult = () => {
    const length = parseFloat(document.getElementById('calcLength').value) || 0;
    const width = parseFloat(document.getElementById('calcWidth').value) || 0;
    const quantity = parseFloat(document.getElementById('calcQuantity').value) || 1;
    const m2 = (length * width / 1_000_000) * quantity;
    document.getElementById('calcResult').textContent = m2.toFixed(4) + ' м²';
  };

  ['calcLength', 'calcWidth', 'calcQuantity'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateResult);
  });

  document.getElementById('copyResult').addEventListener('click', () => {
    const result = document.getElementById('calcResult').textContent;
    navigator.clipboard.writeText(result).then(() => {
      alert('Результат скопирован!');
    });
  });

  document.getElementById('closeCalc').addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}

// === ПЛАН (аватарка) ===
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
  const progressPercent = Math.min(100, (daily / 3000) * 100);

  const modal = document.createElement('div');
  modal.className = 'plan-modal';
  modal.innerHTML = `
    <div class="plan-content">
      <div class="plan-title">План на смену</div>
      <div class="plan-amount ${planAchieved ? 'achieved' : 'under'}">
        ${daily}₽ / 3000₽
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progressPercent}%"></div>
      </div>
      ${planAchieved ? '<div class="gift-icon" id="giftIcon">🎁</div>' : ''}
      <button style="margin-top:16px; width:100%; padding:10px; background:#ffd700; border:none; border-radius:8px; font-weight:bold;" onclick="this.parentElement.parentElement.remove()">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  const progressFill = modal.querySelector('.progress-fill');

  if (planAchieved) {
    progressFill.classList.add('glowing');
    
    document.getElementById('giftIcon').addEventListener('click', () => {
      const gift = document.getElementById('giftIcon');
      gift.classList.add('animate');

      setTimeout(() => {
        alert('🎉 План выполнен! Молодец!');
        modal.remove();
      }, 1200);
    });
  }
}

// === ИНИЦИАЛИЗАЦИЯ ===

document.addEventListener("DOMContentLoaded", () => {
  let migrated = false;
  data.orders.forEach(order => {
    if (!order.operations) {
      const globalDetail = order.detail || '-';
      order.operations = [{
        detail: globalDetail,
        type: order.type || "Время",
        quantity: order.quantity || 1,
        m2: order.m2 || 0,
        pm: order.pm || 0,
        time: order.time || 0
      }];
      delete order.type;
      delete order.quantity;
      delete order.m2;
      delete order.pm;
      delete order.time;
      migrated = true;
    } else {
      order.operations.forEach(op => {
        if (op.detail === undefined) {
          op.detail = order.detail || '-';
          migrated = true;
        }
      });
    }
  });
  if (migrated) saveData();

  checkOverdueOrders();
  updateNotificationBadge();
  updateNotificationIcon();

  loadMainScreen();
  setupEventListeners();

  // Кнопка настроек
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'settings-btn';
  settingsBtn.innerHTML = '⚙️';
  settingsBtn.onclick = () => showSettings();
  document.body.appendChild(settingsBtn);

  // Кнопка калькулятора
  const menuBtn = document.createElement('button');
  menuBtn.className = 'menu-btn-bottom';
  menuBtn.innerHTML = '☰';
  menuBtn.onclick = () => openCalculator();
  document.body.appendChild(menuBtn);

  // Аватарка → план
  document.getElementById('avatarBtn').addEventListener('click', openPlanModal);

  // Переключение графика
  document.getElementById('toggleChart').addEventListener('click', () => {
    isChartVisible = !isChartVisible;
    loadMainScreen();
  });
});

function setupEventListeners() {
  document.getElementById("btnOrders").addEventListener("click", () => {
    showOrdersList();
    addToHistory('ordersListScreen');
  });
  document.getElementById("btnShifts").addEventListener("click", () => {
    showShiftsScreen();
    addToHistory('shiftScreen');
  });
}
