// === ДАННЫЕ ===
let data = JSON.parse(localStorage.getItem('ordersData')) || { orders: [] };
let appData = JSON.parse(localStorage.getItem('appData')) || { createdCount: 0, activationKeyUsed: false };
let notifications = JSON.parse(localStorage.getItem('notifications')) || [];
let sentReports = JSON.parse(localStorage.getItem('sentReports')) || []; // ← ЗАПОМИНАЕМ ОТПРАВЛЕННЫЕ ДАТЫ

// История экранов
let screenHistory = ['mainScreen'];

// === GOOGLE SHEETS ===
// 🔴 ОБЯЗАТЕЛЬНО ЗАМЕНИ НА СВОЙ URL!
const GOOGLE_SHEET_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby4-GbEBZXItc9fP0XF_lhlkTjlm9zucZ4YOT5UX2kuCGSLya-wkUv-ojX5LZMp0OZ7YA/exec';

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function saveData() {
  localStorage.setItem('ordersData', JSON.stringify(data));
  localStorage.setItem('notifications', JSON.stringify(notifications));
  localStorage.setItem('sentReports', JSON.stringify(sentReports)); // ← сохраняем список отправленных
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
      <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">УВЕДОМЛЕНИЯ</h2>
        <button onclick="clearAllNotifications()" style="padding: 8px 16px; background: #ffd700; border: none; border-radius: 4px; font-weight: bold; margin-bottom: 10px;">очистить все</button>
        <div id="notificationsList"></div>
        <button onclick="goToPrevious()" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin-top: 20px; cursor: pointer;">назад</button>
      </div>
    `;
    document.body.appendChild(screen);

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

function showShiftsScreen() {
  let screen = document.getElementById("shiftScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "shiftScreen";
    screen.innerHTML = `
      <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
        <h2 id="shiftTitle" style="font-size: 18px; font-weight: bold; margin-bottom: 20px; cursor: pointer;">введите дату</h2>
        <input type="date" id="dateInput" value="${new Date().toISOString().split('T')[0]}" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <button id="showOrdersForDay" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">показать</button>
        <div id="ordersOfDay"></div>
        <div id="totalOfDay"></div>
        <button id="btnSaveReport" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">сохранить отчёт</button>
        <button id="resetReportsBtn" style="width: 100%; padding: 6px; background: #eee; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; margin-top: 10px; display: none; cursor: pointer;">сбросить отчёты</button>
        <button onclick="goToPrevious()" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">назад</button>
      </div>
    `;
    document.body.appendChild(screen);

    // Обработчики
    document.getElementById("showOrdersForDay").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      showOrdersForDay(date);
    });

    document.getElementById("btnSaveReport").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      if (!date) {
        alert("Выберите дату");
        return;
      }
      saveReportToGoogleSheet(date);
    });

    // Скрытая кнопка — привязываем обработчик
    document.getElementById("resetReportsBtn").addEventListener("click", resetSentReports);

    // === СЕКРЕТНЫЙ ТРИГГЕР: 3 клика на заголовок ===
    let clickCount = 0;
    let lastClickTime = 0;

    document.getElementById("shiftTitle").addEventListener("click", () => {
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
  document.getElementById("totalOfDay").innerHTML = `<h3 style="margin-top: 10px;">итого: ${total}₽</h3>`;
}

// === ОТПРАВКА ОТЧЁТА (С ЗАЩИТОЙ ОТ ПОВТОРОВ) ===

async function saveReportToGoogleSheet(date) {
  // 🔒 Проверка: уже отправляли?
  if (sentReports.includes(date)) {
    alert(`Отчёт за ${date} уже отправлен в Google Таблицу.`);
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

    // ✅ Запоминаем, что отчёт за эту дату отправлен
    sentReports.push(date);
    saveData();

    alert(`Отчёт за ${date} успешно отправлен в Google Таблицу!`);
  } catch (err) {
    console.error('Ошибка отправки:', err);
    alert('Не удалось отправить отчёт.');
  }
}

// === ЗАГРУЗКА ИЗ GOOGLE ТАБЛИЦЫ ===

async function loadOrdersFromGoogle() {
  try {
    const response = await fetch(GOOGLE_SHEET_WEB_APP_URL);
    const result = await response.json();

    if (result.error) {
      alert("Ошибка загрузки: " + result.error);
      return;
    }

    if (result.orders && result.orders.length > 0) {
      // 🔁 Нормализуем дату: из "2026-01-15T21:00:00.000Z" → "2026-01-15"
      const normalizedOrders = result.orders.map(order => {
        if (order.date && typeof order.date === 'string') {
          if (order.date.includes('T')) {
            order.date = order.date.split('T')[0]; // ISO → ГГГГ-ММ-ДД
          } else if (order.date.includes('.')) {
            // Если вдруг формат DD.MM.YYYY
            const parts = order.date.split('.');
            if (parts.length === 3) {
              order.date = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          }
        }
        return order;
      });

      const existingIds = new Set(data.orders.map(o => o.id));
      const newOrders = normalizedOrders.filter(o => !existingIds.has(o.id));
      data.orders = [...data.orders, ...newOrders];
      saveData();

      // Обновляем интерфейс
      if (document.getElementById('ordersListScreen').classList.contains('active')) {
        displayOrdersGroupedByDate();
      }
      if (document.getElementById('shiftScreen').classList.contains('active')) {
        const dateInput = document.getElementById('dateInput');
        if (dateInput) {
          showOrdersForDay(dateInput.value);
        }
      }

      alert(`Загружено ${newOrders.length} заказов.`);
    } else {
      alert("Нет данных для загрузки.");
    }
  } catch (err) {
    console.error("Ошибка:", err);
    alert("Не удалось загрузить данные из Google Таблицы.");
  }
}

// === СПИСОК ЗАКАЗОВ ===

function showOrdersList() {
  let screen = document.getElementById("ordersListScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "ordersListScreen";
    screen.innerHTML = `
      <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="font-size: 18px; font-weight: bold;">СПИСОК ЗАКАЗОВ</h2>
          <button id="btnNotificationsInList" onclick="showNotificationsScreen()" style="background: none; border: none; cursor: pointer; font-size: 20px; position: relative;">
            <span id="notificationIcon" style="color: black;">✉️</span>
            <span id="notificationBadgeInList" style="position: absolute; top: -8px; right: -8px; background: red; color: white; border-radius: 50%; width: 18px; height: 18px; display: none; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;"></span>
          </button>
        </div>
        <input type="text" id="searchInput" placeholder="поиск по номеру заказа" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <button id="btnCreateNew" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">создать новый</button>
        <button id="btnLoadFromGoogle" style="width: 100%; padding: 12px; background: #4CAF50; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer; color: white;">загрузить из google</button>
        <button id="btnBack" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">назад</button>
        <div id="allOrdersList" style="margin-top: 20px;"></div>
      </div>
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
    if (!grouped[order.date]) grouped[order.date] = [];
    grouped[order.date].push(order);
  });

  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  sortedDates.forEach(date => {
    const title = document.createElement("div");
    title.className = "date-header";
    title.innerHTML = `
      <h3 style="cursor: pointer; font-size: 16px; font-weight: bold; margin: 10px 0;" onclick="toggleDateSection('${date}')">
        ${date} <span id="arrow-${date}" class="arrow">▼</span>
      </h3>
      <div id="list-${date}" class="date-list" style="display:none;"></div>
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
}

function toggleDateSection(date) {
  const list = document.getElementById(`list-${date}`);
  const arrow = document.getElementById(`arrow-${date}`);
  if (list.style.display === "none") {
    list.style.display = "block";
    arrow.textContent = "▲";
  } else {
    list.style.display = "none";
    arrow.textContent = "▼";
  }
}

function searchOrders(query) {
  const container = document.getElementById("allOrdersList");
  container.innerHTML = "";
  const results = data.orders.filter(order => order.id.toLowerCase().includes(query));
  if (results.length === 0) {
    container.innerHTML = `<p style="text-align: center;">Заказ "${query}" не найден.</p>`;
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
      <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">создать заказ</h2>
        <input type="text" id="orderNumber" placeholder="номер заказа" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <input type="text" id="orderDetail" placeholder="деталь" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <input type="date" id="orderDate" value="${new Date().toISOString().split('T')[0]}" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <select id="orderType" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <option value="Распил">Распил — 65₽/м²</option>
          <option value="Линейный">Линейный — 26₽/п.м</option>
          <option value="Склейка простая">Склейка простая — 165₽/м²</option>
          <option value="Склейка с обгоном">Склейка с обгоном — 210₽/м²</option>
          <option value="Фрезер фаски">Фрезер фаски — 16₽/п.м</option>
          <option value="Пазовка">Пазовка — 30₽/п.м</option>
          <option value="Время">Время — 330₽</option>
        </select>
        <input type="number" id="quantity" placeholder="Количество" step="1" min="1" value="1" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <input type="number" id="m2" placeholder="м²" step="0.1" min="0" value="0" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <input type="number" id="pm" placeholder="п.м" step="0.1" min="0" value="0" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <input type="number" id="time" placeholder="Часы" step="0.5" min="0" value="0" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <button id="saveOrder" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">создать</button>
        <button onclick="goToPrevious()" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">назад</button>
      </div>
    `;
    document.body.appendChild(screen);

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
  modal.style = `
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  `;
  modal.innerHTML = `
    <div style="background:white; padding:20px; border-radius:12px; width:90%; max-width:400px;">
      <h3 style="margin-bottom:15px;">Новая операция</h3>
      <input type="text" id="newOpDetail" placeholder="Деталь (например, столешка, ножка)" style="width:100%; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:4px;">
      <select id="newOpType" style="width:100%; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:4px;">
        <option value="Распил">Распил — 65₽/м²</option>
        <option value="Линейный">Линейный — 26₽/п.м</option>
        <option value="Склейка простая">Склейка простая — 165₽/м²</option>
        <option value="Склейка с обгоном">Склейка с обгоном — 210₽/м²</option>
        <option value="Фрезер фаски">Фрезер фаски — 16₽/п.м</option>
        <option value="Пазовка">Пазовка — 30₽/п.м</option>
        <option value="Время">Время — 330₽</option>
      </select>
      <input type="number" id="newOpQuantity" placeholder="Количество" value="1" min="1" step="1" style="width:100%; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:4px;">
      <input type="number" id="newOpM2" placeholder="м²" value="0" min="0" step="0.1" style="width:100%; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:4px;">
      <input type="number" id="newOpPM" placeholder="п.м" value="0" min="0" step="0.1" style="width:100%; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:4px;">
      <input type="number" id="newOpTime" placeholder="Часы" value="0" min="0" step="0.5" style="width:100%; padding:10px; margin:5px 0; border:1px solid #ddd; border-radius:4px;">
      <button id="saveNewOp" style="width:100%; padding:12px; background:#ffd700; border:none; border-radius:8px; font-weight:bold; margin:8px 0; cursor:pointer;">добавить</button>
      <button id="cancelNewOp" style="width:100%; padding:12px; background:#ccc; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">отмена</button>
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

  let detailsHtml = `
    <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">${order.id}</h2>
      <p style="margin: 5px 0;">Общая деталь: ${order.detail || '-'}</p>
      <p style="margin: 5px 0;">Дата: ${order.date}</p>
  `;

  detailsHtml += `<h3 style="margin: 15px 0 10px; font-size: 16px;">Операции:</h3>`;
  order.operations.forEach((op, idx) => {
    detailsHtml += `
      <div style="background:#f9f9f9; padding:8px; border-radius:4px; margin:5px 0;">
        <small>${idx + 1}. ${op.type}</small><br>
        <small>Деталь: ${op.detail || '-'}</small><br>
        <small>Кол-во: ${op.quantity} | м²: ${op.m2} | п.м: ${op.pm} | ч: ${op.time}</small>
      </div>
    `;
  });

  const currentPrice = order.status === 'closed'
    ? (order.price || calculateOrderPrice(order.operations))
    : calculateOrderPrice(order.operations);
  detailsHtml += `<p style="margin: 10px 0; font-weight: bold;">Текущая сумма: ${currentPrice}₽</p>`;

  if (order.status !== 'closed') {
    detailsHtml += `<button id="btnAddOperation" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">добавить операцию</button>`;
    detailsHtml += `<button id="btnFinishOrder" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">завершить</button>`;
  } else {
    detailsHtml += `<p style="margin: 10px 0;">Итоговая цена: ${order.price}₽</p>`;
  }

  detailsHtml += `
      <button id="btnDeleteOrder" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">удалить</button>
      <button onclick="goToPrevious()" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">назад</button>
    </div>
  `;

  screen.innerHTML = detailsHtml;
  switchScreen('orderDetailsScreen');

  if (order.status !== 'closed') {
    document.getElementById("btnAddOperation").addEventListener("click", () => showAddOperationForm(orderId));
    document.getElementById("btnFinishOrder").addEventListener("click", () => finishOrder(orderId));
  }

  document.getElementById("btnDeleteOrder").addEventListener("click", () => deleteOrder(orderId));
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

// === ИНИЦИАЛИЗАЦИЯ ===

document.addEventListener("DOMContentLoaded", () => {
  // Миграция старых заказов
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
