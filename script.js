// Укажите ваш URL из Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbznPs8QNbUqFHwgci7msTMTk04K0uNBMc6U9sqY20MPcYm6JTFpdF5bCa-DruKTWVFCfA/exec';
let data = {
  orders: []
};
let notifications = [];

// История экранов
let screenHistory = ['mainScreen'];

// Загрузка данных при запуске
document.addEventListener("DOMContentLoaded", () => {
  loadAllData();
  setupEventListeners();
  setupBackButtonHandler();
});

// Загрузка всех данных из Google Таблиц
async function loadAllData() {
  try {
    const [ordersRes, notifRes] = await Promise.all([
      fetch(`${API_URL}?action=getOrders`),
      fetch(`${API_URL}?action=getNotifications`)
    ]);

    data.orders = await ordersRes.json();
    notifications = await notifRes.json();

    // Обновляем значки
    updateNotificationBadge();
    updateNotificationIcon();

    // Проверяем просроченные заказы
    checkOverdueOrders();

    loadMainScreen();
  } catch (e) {
    console.error('Ошибка загрузки данных:', e);
  }
}

function updateNotificationBadge() {
  const unreadCount = notifications.filter(n => !n.Read || n.Read === 'FALSE').length;
  const badge = document.getElementById('notificationBadge');
  if (badge) {
    badge.textContent = unreadCount > 0 ? unreadCount : '';
    badge.style.display = unreadCount > 0 ? 'block' : 'none';
  }
}

function updateNotificationIcon() {
  const icon = document.getElementById('notificationIcon');
  if (icon) {
    if (notifications.length > 0) {
      icon.style.color = 'red';
    } else {
      icon.style.color = 'black';
    }
  }
}

function createNotification(orderId, message) {
  const now = new Date().toISOString();
  const notification = {
    id: `notif-${Date.now()}`,
    orderId: orderId,
    message: message,
    timestamp: now,
    read: false
  };
  // Добавляем в локальный массив
  notifications.push(notification);
  // Отправляем в Google Таблицы
  fetch(`${API_URL}?action=createNotification&data=${JSON.stringify(notification)}`)
    .then(() => {
      updateNotificationBadge();
      updateNotificationIcon();
    });
}

function checkOverdueOrders() {
  const now = new Date();
  data.orders.forEach(order => {
    if (order.Status === 'open') {
      let orderDate = new Date(order.CreatedAt);
      if ((now - orderDate) > 15 * 60 * 1000) { // 15 минут
        const existing = notifications.find(n => n.OrderID === order.ID && n.Read === 'FALSE');
        if (!existing) {
          createNotification(order.ID, `Ваш заказ ${order.ID}, не закрыт`);
        }
      }
    }
  });
}

function showNotificationsScreen() {
  let screen = document.getElementById("notificationsScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "notificationsScreen";
    screen.innerHTML = `
      <h2>Уведомления</h2>
      <button onclick="clearAllNotifications()" style="padding: 8px 16px; background: #ffd700; border: none; border-radius: 4px; font-weight: bold; margin-bottom: 10px;">очистить все</button>
      <div id="notificationsList"></div>
      <button onclick="goToPrevious()">назад</button>
    `;
    document.body.appendChild(screen);

    const list = document.getElementById("notificationsList");
    list.innerHTML = "";

    if (notifications.length === 0) {
      list.innerHTML = `<p>Нет уведомлений</p>`;
    } else {
      notifications.forEach(notification => {
        const item = document.createElement("div");
        item.className = `notification-item ${notification.Read === 'TRUE' ? 'read' : 'unread'}`;
        item.innerHTML = `<span>${notification.Message}</span>`;
        item.onclick = () => markAsRead(notification.ID);
        list.appendChild(item);
      });
    }
  }
  switchScreen('notificationsScreen');
}

function markAsRead(notificationId) {
  // Обновляем локально
  const notification = notifications.find(n => n.ID === notificationId);
  if (notification) {
    notification.Read = 'TRUE';
    // Отправляем в Google Таблицы
    fetch(`${API_URL}`, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `action=markNotificationAsRead&id=${notificationId}`
    }).then(() => {
      updateNotificationBadge();
      updateNotificationIcon();
      showNotificationsScreen();
    });
  }
}

function clearAllNotifications() {
  if (confirm("Вы уверены, что хотите очистить все уведомления?")) {
    notifications = [];
    updateNotificationBadge();
    updateNotificationIcon();
    showNotificationsScreen();
  }
}

function setupEventListeners() {
  document.getElementById("btnOrders").addEventListener("click", () => {
    showOrdersList();
    addToHistory('ordersListScreen');
  });
  document.getElementById("btnShifts").addEventListener("click", () => {
    showShiftsScreen();
    addToHistory('shiftScreen');
  });
  document.getElementById("btnNotifications").addEventListener("click", () => {
    showNotificationsScreen();
    addToHistory('notificationsScreen');
  });
}

function setupBackButtonHandler() {
  window.addEventListener('popstate', (event) => {
    if (screenHistory.length > 1) {
      screenHistory.pop();
      const previousScreen = screenHistory[screenHistory.length - 1];
      switchScreen(previousScreen);
    } else {
      switchScreen('mainScreen');
    }
  });
}

function addToHistory(screenId) {
  if (screenHistory[screenHistory.length - 1] !== screenId) {
    screenHistory.push(screenId);
    history.pushState({}, '', '#' + screenId);
  }
}

function loadMainScreen() {
  let total = 0;
  let today = new Date().toISOString().split('T')[0];
  let daily = 0;

  data.orders.forEach(order => {
    if (order.Status === 'closed') {
      total += parseFloat(order.Price) || 0;
      if (order.Date === today) {
        daily += parseFloat(order.Price) || 0;
      }
    }
  });

  total = Math.round(total * 100) / 100;
  daily = Math.round(daily * 100) / 100;

  document.getElementById("totalEarnings").textContent = `${total}₽`;
  document.getElementById("dailyEarnings").textContent = `${daily}₽`;

  switchScreen('mainScreen');
}

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  let screen = document.getElementById(id);
  if (!screen) {
    console.error(`Screen with id '${id}' not found.`);
    return;
  }
  screen.classList.add('active');
}

function showShiftsScreen() {
  let screen = document.getElementById("shiftScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "shiftScreen";
    screen.innerHTML = `
      <h2>введите дату</h2>
      <input type="date" id="dateInput" value="${new Date().toISOString().split('T')[0]}">
      <button id="showOrdersForDay">показать</button>
      <div id="ordersOfDay"></div>
      <div id="totalOfDay"></div>
      <button onclick="goToPrevious()">назад</button>
    `;
    document.body.appendChild(screen);

    document.getElementById("showOrdersForDay").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      showOrdersForDay(date);
    });
  }
  switchScreen('shiftScreen');
}

function showOrdersForDay(date) {
  const orders = data.orders.filter(o => o.Date === date);
  const container = document.getElementById("ordersOfDay");
  container.innerHTML = "";

  let total = 0;

  orders.forEach(order => {
    const item = document.createElement("div");
    item.className = "list-item";
    let priceDisplay = order.Status === 'closed' ? `${Math.round(parseFloat(order.Price) * 100) / 100}₽` : '—';
    if (order.Status === 'closed') {
      total += parseFloat(order.Price) || 0;
    }
    item.innerHTML = `<span>${order.ID}</span><span class="price-tag">${priceDisplay}</span>`;
    container.appendChild(item);
  });

  total = Math.round(total * 100) / 100;
  document.getElementById("totalOfDay").innerHTML = `<h3>итого: ${total}₽</h3>`;
}

function showOrdersList() {
  let screen = document.getElementById("ordersListScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "ordersListScreen";
    screen.innerHTML = `
      <h2>список заказов</h2>
      <div style="position: relative; margin-bottom: 10px;">
        <button id="btnNotificationsInList" onclick="showNotificationsScreen()" style="position: absolute; top: 0; right: 0; background: none; border: none; font-size: 20px; cursor: pointer; z-index: 1000;">
          <span id="notificationIcon" style="color: black;">🔔</span>
          <span id="notificationBadgeInList" style="position: absolute; top: -8px; right: -8px; background: red; color: white; border-radius: 50%; width: 18px; height: 18px; display: none; align-items: center; justify-content: center; font-size: 10px; font-weight: bold;"></span>
        </button>
      </div>
      <input type="text" id="searchInput" placeholder="поиск по номеру заказа" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">
      <div id="allOrdersList"></div>
      <button id="btnCreateNew">создать новый</button>
      <button onclick="goToPrevious()">назад</button>
    `;
    document.body.appendChild(screen);

    const searchInput = document.getElementById("searchInput");
    searchInput.addEventListener("input", function() {
      const query = this.value.trim().toLowerCase();
      if (query) {
        searchOrders(query);
      } else {
        displayOrdersGroupedByDate();
      }
    });

    document.getElementById("btnCreateNew").addEventListener("click", () => {
      createOrderForm();
      addToHistory('createOrderScreen');
    });

    updateNotificationIcon();
    updateNotificationBadge();

    displayOrdersGroupedByDate();
  } else {
    const searchInput = document.getElementById("searchInput");
    const query = searchInput.value.trim().toLowerCase();
    if (query) {
      searchOrders(query);
    } else {
      displayOrdersGroupedByDate();
    }
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
    if (!grouped[order.Date]) grouped[order.Date] = [];
    grouped[order.Date].push(order);
  });

  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  sortedDates.forEach(date => {
    const title = document.createElement("div");
    title.className = "date-header";
    title.innerHTML = `
      <h3 style="cursor: pointer;" onclick="toggleDateSection('${date}')">
        ${date} <span id="arrow-${date}" class="arrow">▼</span>
      </h3>
      <div id="list-${date}" class="date-list" style="display:none;">
      </div>
    `;
    container.appendChild(title);

    const list = document.getElementById(`list-${date}`);
    grouped[date].forEach(order => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<span>${order.ID}</span>`;
      item.onclick = () => {
        showOrderDetails(order.ID);
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

  const results = data.orders.filter(order => order.ID.toLowerCase().includes(query));

  if (results.length === 0) {
    container.innerHTML = `<p>Заказ с номером "${query}" не найден.</p>`;
  } else {
    results.forEach(order => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<span>${order.ID}</span>`;
      item.onclick = () => {
        showOrderDetails(order.ID);
        addToHistory('orderDetailsScreen');
      };
      container.appendChild(item);
    });
  }
}

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
      <input type="date" id="orderDate" value="${new Date().toISOString().split('T')[0]}">
      <select id="orderType">
        <option value="Распил">Распил — 65₽/м²</option>
        <option value="Линейный">Линейный — 26₽/п.м</option>
        <option value="Склейка простая">Склейка простая — 165₽/м²</option>
        <option value="Склейка с обгоном">Склейка с обгоном — 210₽/м²</option>
        <option value="Фрезер фаски">Фрезер фаски — 16₽/п.м</option>
        <option value="Пазовка">Пазовка — 30₽/п.м</option>
        <option value="Время">Время — 330₽</option>
      </select>
      <input type="number" id="quantity" placeholder="Количество" step="1" min="1" value="1">
      <input type="number" id="m2" placeholder="м²" step="0.1" min="0" value="0">
      <input type="number" id="pm" placeholder="п.м" step="0.1" min="0" value="0">
      <input type="number" id="time" placeholder="Часы" step="0.5" min="0" value="0">
      <button id="saveOrder">создать</button>
      <button onclick="goToPrevious()">назад</button>
    `;
    document.body.appendChild(screen);

    document.getElementById("saveOrder").addEventListener("click", async () => {
      const id = document.getElementById("orderNumber").value.trim();
      if (!id) {
        alert("Введите номер заказа");
        return;
      }
      const detail = document.getElementById("orderDetail").value.trim();
      const type = document.getElementById("orderType").value;
      const quantity = parseFloat(document.getElementById("quantity").value) || 1;
      const m2 = parseFloat(document.getElementById("m2").value) || 0;
      const pm = parseFloat(document.getElementById("pm").value) || 0;
      const time = parseFloat(document.getElementById("time").value) || 0;
      const date = document.getElementById("orderDate").value;

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
      if (["Распил", "Склейка простая", "Склейка с обгоном"].includes(type)) {
        price += m2 * rates[type];
      }
      if (["Линейный", "Фрезер фаски", "Пазовка"].includes(type)) {
        price += pm * rates[type];
      }
      if (type === "Время") {
        price += time * rates[type];
      }

      price = Math.round(price * 100) / 100;

      const order = {
        id,
        detail,
        date,
        type,
        quantity,
        m2,
        pm,
        time,
        status: 'open',
        price,
        createdAt: new Date().toISOString()
      };

      try {
        await fetch(`${API_URL}?action=createOrder&data=${JSON.stringify(order)}`);
        alert(`Заказ создан: ${id}`);
        // Обновляем локальные данные
        data.orders.push(order);
        goToPrevious();
      } catch (e) {
        alert('Ошибка сохранения заказа');
      }
    });
  }
  switchScreen('createOrderScreen');
}

function showOrderDetails(orderId) {
  let screen = document.getElementById("orderDetailsScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "orderDetailsScreen";
    const order = data.orders.find(o => o.ID === orderId);
    if (!order) return;

    let detailsHtml = `
      <h2>${order.ID}</h2>
      <p>деталь: ${order.Detail || '-'}</p>
      <p>дата: ${order.Date}</p>
      <p>тип: ${order.Type}</p>
      <p>кол-во: ${order.Quantity}</p>
      <p>м²: ${order.M2}</p>
      <p>п.м: ${order.PM}</p>
      <p>время: ${order.Time}</p>
    `;

    if (order.Status === 'closed') {
      detailsHtml += `<p>цена: ${Math.round(parseFloat(order.Price) * 100) / 100}₽</p>`;
    } else {
      detailsHtml += `<button id="btnFinishOrder">завершить</button>`;
    }

    detailsHtml += `
      <button id="btnDeleteOrder">удалить</button>
      <button onclick="goToPrevious()">назад</button>
    `;
    screen.innerHTML = detailsHtml;
    document.body.appendChild(screen);

    if (order.Status !== 'closed') {
      document.getElementById("btnFinishOrder").addEventListener("click", () => finishOrder(order.ID));
    }

    document.getElementById("btnDeleteOrder").addEventListener("click", () => deleteOrder(order.ID));
  } else {
    const order = data.orders.find(o => o.ID === orderId);
    if (!order) return;

    screen.innerHTML = `
      <h2>${order.ID}</h2>
      <p>деталь: ${order.Detail || '-'}</p>
      <p>дата: ${order.Date}</p>
      <p>тип: ${order.Type}</p>
      <p>кол-во: ${order.Quantity}</p>
      <p>м²: ${order.M2}</p>
      <p>п.м: ${order.PM}</p>
      <p>время: ${order.Time}</p>
    `;

    if (order.Status === 'closed') {
      screen.innerHTML += `<p>цена: ${Math.round(parseFloat(order.Price) * 100) / 100}₽</p>`;
    } else {
      screen.innerHTML += `<button id="btnFinishOrder">завершить</button>`;
    }

    screen.innerHTML += `
      <button id="btnDeleteOrder">удалить</button>
      <button onclick="goToPrevious()">назад</button>
    `;

    if (order.Status !== 'closed') {
      document.getElementById("btnFinishOrder").addEventListener("click", () => finishOrder(order.ID));
    }

    document.getElementById("btnDeleteOrder").addEventListener("click", () => deleteOrder(order.ID));
  }
  switchScreen('orderDetailsScreen');
}

function deleteOrder(orderId) {
  if (confirm("Вы уверены, что хотите удалить этот заказ?")) {
    fetch(`${API_URL}`, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `action=deleteOrder&id=${orderId}`
    })
    .then(() => {
      // Обновляем локальные данные
      data.orders = data.orders.filter(order => order.ID !== orderId);
      alert("Заказ удалён");
      goToPrevious();
    })
    .catch(e => {
      alert('Ошибка удаления');
    });
  }
}

function finishOrder(orderId) {
  const order = data.orders.find(o => o.ID === orderId);
  if (!order) return;

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
  if (["Распил", "Склейка простая", "Склейка с обгоном"].includes(order.Type)) {
    price += parseFloat(order.M2) * rates[order.Type];
  }
  if (["Линейный", "Фрезер фаски", "Пазовка"].includes(order.Type)) {
    price += parseFloat(order.PM) * rates[order.Type];
  }
  if (order.Type === "Время") {
    price += parseFloat(order.Time) * rates[order.Type];
  }

  price = Math.round(price * 100) / 100;

  fetch(`${API_URL}`, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `action=updateOrderStatus&id=${orderId}&status=closed`
  })
  .then(() => {
    // Обновляем локальные данные
    order.Status = 'closed';
    order.Price = price;
    alert(`Заказ завершён. Цена: ${price}₽`);
    showOrderDetails(orderId);
  })
  .catch(e => {
    alert('Ошибка завершения заказа');
  });
}

function goToMain() {
  screenHistory = ['mainScreen'];
  switchScreen('mainScreen');
  history.replaceState({}, '', window.location.pathname);
  loadMainScreen();
}

function goToPrevious() {
  if (screenHistory.length > 1) {
    screenHistory.pop();
    const previousScreen = screenHistory[screenHistory.length - 1];
    switchScreen(previousScreen);
  } else {
    goToMain();
  }
}
