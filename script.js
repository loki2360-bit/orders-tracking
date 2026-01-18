let data = JSON.parse(localStorage.getItem('ordersData')) || {
  orders: []
};
let appData = JSON.parse(localStorage.getItem('appData')) || {
  createdCount: 0,
  activationKeyUsed: false
};
let notifications = JSON.parse(localStorage.getItem('notifications')) || [];

// История экранов
let screenHistory = ['mainScreen'];

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
  localStorage.setItem('notifications', JSON.stringify(notifications));
  updateNotificationBadge();
  updateNotificationIcon();
}

function checkOverdueOrders() {
  const now = new Date();
  data.orders.forEach(order => {
    if (order.status === 'open') {
      // Используем точную дату и время создания заказа
      let orderDate = new Date(order.createdAt);
      if ((now - orderDate) > 15 * 60 * 1000) { // 15 минут в миллисекундах
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
    if (notifications.length > 0) {
      icon.style.color = 'red';
    } else {
      icon.style.color = 'black';
    }
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
    list.innerHTML = ""; // Очищаем перед заполнением

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
    localStorage.setItem('notifications', JSON.stringify(notifications));
    updateNotificationBadge();
    updateNotificationIcon();
    showNotificationsScreen(); // Обновляем список
  }
}

function clearAllNotifications() {
  if (confirm("Вы уверены, что хотите очистить все уведомления?")) {
    notifications = [];
    localStorage.setItem('notifications', JSON.stringify(notifications));
    updateNotificationBadge();
    updateNotificationIcon();
    showNotificationsScreen(); // Обновляем список
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Проверяем просроченные заказы при загрузке
  checkOverdueOrders();
  updateNotificationBadge();
  updateNotificationIcon();

  loadMainScreen();
  setupEventListeners();
  setupBackButtonHandler();
});

function saveData() {
  localStorage.setItem('ordersData', JSON.stringify(data));
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
      screenHistory.pop(); // Удаляем текущий экран
      const previousScreen = screenHistory[screenHistory.length - 1]; // Берём предыдущий
      switchScreen(previousScreen);
    } else {
      // Если история пуста — оставляем главный экран
      switchScreen('mainScreen');
    }
  });
}

function addToHistory(screenId) {
  // Если текущий экран не совпадает с последним в истории
  if (screenHistory[screenHistory.length - 1] !== screenId) {
    screenHistory.push(screenId);
    // Обновляем историю браузера
    history.pushState({}, '', '#' + screenId);
  }
}

function loadMainScreen() {
  // Общий заработок
  let total = 0;
  let today = new Date().toISOString().split('T')[0];
  let daily = 0;

  data.orders.forEach(order => {
    if (order.status === 'closed') {
      total += order.price || 0;
      if (order.date === today) {
        daily += order.price || 0;
      }
    }
  });

  // Округляем до 2 знаков
  total = Math.round(total * 100) / 100;
  daily = Math.round(daily * 100) / 100;

  document.getElementById("totalEarnings").textContent = `${total}₽`;
  document.getElementById("dailyEarnings").textContent = `${daily}₽`;

  switchScreen('mainScreen');
}

function switchScreen(id) {
  // Скрываем все экраны
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));

  // Ищем или создаём экран
  let screen = document.getElementById(id);
  if (!screen) {
    console.error(`Screen with id '${id}' not found.`);
    return;
  }

  // Показываем нужный
  screen.classList.add('active');
}

function showShiftsScreen() {
  let screen = document.getElementById("shiftScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "shiftScreen";
    screen.innerHTML = `
      <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 20px;">введите дату</h2>
        <input type="date" id="dateInput" value="${new Date().toISOString().split('T')[0]}" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
        <button id="showOrdersForDay" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">показать</button>
        <div id="ordersOfDay"></div>
        <div id="totalOfDay"></div>
        <button onclick="goToPrevious()" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">назад</button>
      </div>
    `;
    document.body.appendChild(screen);

    // Привязываем обработчик события
    document.getElementById("showOrdersForDay").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      showOrdersForDay(date);
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
    const item = document.createElement("div");
    item.className = "list-item";
    let priceDisplay = order.status === 'closed' ? `${Math.round(order.price * 100) / 100}₽` : '—';
    if (order.status === 'closed') {
      total += order.price;
    }
    item.innerHTML = `<span>${order.id}</span><span class="price-tag">${priceDisplay}</span>`;
    container.appendChild(item);
  });

  // Округляем итог
  total = Math.round(total * 100) / 100;
  document.getElementById("totalOfDay").innerHTML = `<h3 style="margin-top: 10px;">итого: ${total}₽</h3>`;
}

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
        <button id="btnBack" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">назад</button>
        <div id="allOrdersList" style="margin-top: 20px;"></div>
      </div>
    `;
    document.body.appendChild(screen);

    // Привязываем обработчик события для поиска
    const searchInput = document.getElementById("searchInput");
    searchInput.addEventListener("input", function() {
      const query = this.value.trim().toLowerCase();
      if (query) {
        searchOrders(query);
      } else {
        displayOrdersGroupedByDate();
      }
    });

    // Привязываем обработчик события для создания нового заказа
    document.getElementById("btnCreateNew").addEventListener("click", () => {
      createOrderForm();
      addToHistory('createOrderScreen');
    });

    // Привязываем обработчик события для кнопки "назад"
    document.getElementById("btnBack").addEventListener("click", goToPrevious);

    // Обновляем значок уведомлений
    updateNotificationIcon();
    updateNotificationBadge();

    // Отображаем заказы по датам
    displayOrdersGroupedByDate();
  } else {
    // Обновляем список при возврате на экран
    const searchInput = document.getElementById("searchInput");
    const query = searchInput.value.trim().toLowerCase();
    if (query) {
      searchOrders(query);
    } else {
      displayOrdersGroupedByDate();
    }

    // Обновляем значок уведомлений
    updateNotificationIcon();
    updateNotificationBadge();
  }

  switchScreen('ordersListScreen');
}

function displayOrdersGroupedByDate() {
  const container = document.getElementById("allOrdersList");
  container.innerHTML = ""; // Очищаем перед заполнением

  const grouped = {};

  data.orders.forEach(order => {
    if (!grouped[order.date]) grouped[order.date] = [];
    grouped[order.date].push(order);
  });

  // Сортируем даты по убыванию (свежие сверху)
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a));

  sortedDates.forEach(date => {
    const title = document.createElement("div");
    title.className = "date-header";
    title.innerHTML = `
      <h3 style="cursor: pointer; font-size: 16px; font-weight: bold; margin: 10px 0;" onclick="toggleDateSection('${date}')">
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
  container.innerHTML = ""; // Очищаем перед заполнением

  const results = data.orders.filter(order => order.id.toLowerCase().includes(query));

  if (results.length === 0) {
    container.innerHTML = `<p style="text-align: center;">Заказ с номером "${query}" не найден.</p>`;
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

    // Привязываем обработчик события
    document.getElementById("saveOrder").addEventListener("click", () => {
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

      // Округляем цену
      price = Math.round(price * 100) / 100;

      data.orders.push({
        id,
        detail,
        date,
        type,
        quantity,
        m2,
        pm,
        time,
        status: 'open',
        price: price,
        createdAt: new Date().toISOString() // Сохраняем точную дату и время создания
      });

      saveData();
      alert(`Заказ создан: ${id}`);

      goToPrevious(); // Возвращаемся к списку заказов
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
    const order = data.orders.find(o => o.id === orderId);
    if (!order) return;

    let detailsHtml = `
      <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">${order.id}</h2>
        <p style="margin: 5px 0;">деталь: ${order.detail || '-'}</p>
        <p style="margin: 5px 0;">дата: ${order.date}</p>
        <p style="margin: 5px 0;">тип: ${order.type}</p>
        <p style="margin: 5px 0;">кол-во: ${order.quantity}</p>
        <p style="margin: 5px 0;">м²: ${order.m2}</p>
        <p style="margin: 5px 0;">п.м: ${order.pm}</p>
        <p style="margin: 5px 0;">время: ${order.time}</p>
    `;

    if (order.status === 'closed') {
      detailsHtml += `<p style="margin: 5px 0;">цена: ${Math.round(order.price * 100) / 100}₽</p>`;
    } else {
      detailsHtml += `<button id="btnFinishOrder" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">завершить</button>`;
    }

    detailsHtml += `
        <button id="btnDeleteOrder" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">удалить</button>
        <button onclick="goToPrevious()" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">назад</button>
      </div>
    `;
    screen.innerHTML = detailsHtml;
    document.body.appendChild(screen);

    if (order.status !== 'closed') {
      document.getElementById("btnFinishOrder").addEventListener("click", () => finishOrder(orderId));
    }

    // Привязываем обработчик удаления
    document.getElementById("btnDeleteOrder").addEventListener("click", () => deleteOrder(orderId));
  } else {
    // Если экран уже существует, обновляем его содержимое
    const order = data.orders.find(o => o.id === orderId);
    if (!order) return;

    screen.innerHTML = `
      <div style="background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); max-width: 400px; margin: 0 auto;">
        <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 10px;">${order.id}</h2>
        <p style="margin: 5px 0;">деталь: ${order.detail || '-'}</p>
        <p style="margin: 5px 0;">дата: ${order.date}</p>
        <p style="margin: 5px 0;">тип: ${order.type}</p>
        <p style="margin: 5px 0;">кол-во: ${order.quantity}</p>
        <p style="margin: 5px 0;">м²: ${order.m2}</p>
        <p style="margin: 5px 0;">п.м: ${order.pm}</p>
        <p style="margin: 5px 0;">время: ${order.time}</p>
    `;

    if (order.status === 'closed') {
      screen.innerHTML += `<p style="margin: 5px 0;">цена: ${Math.round(order.price * 100) / 100}₽</p>`;
    } else {
      screen.innerHTML += `<button id="btnFinishOrder" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">завершить</button>`;
    }

    screen.innerHTML += `
        <button id="btnDeleteOrder" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">удалить</button>
        <button onclick="goToPrevious()" style="width: 100%; padding: 12px; background: #ffd700; border: none; border-radius: 8px; font-weight: bold; margin: 8px 0; cursor: pointer;">назад</button>
      </div>
    `;

    if (order.status !== 'closed') {
      document.getElementById("btnFinishOrder").addEventListener("click", () => finishOrder(orderId));
    }

    // Привязываем обработчик удаления
    document.getElementById("btnDeleteOrder").addEventListener("click", () => deleteOrder(orderId));
  }
  switchScreen('orderDetailsScreen');
}

function deleteOrder(orderId) {
  if (confirm("Вы уверены, что хотите удалить этот заказ?")) {
    data.orders = data.orders.filter(order => order.id !== orderId);
    saveData();
    alert("Заказ удалён");
    goToPrevious(); // Возвращаемся к списку заказов
  }
}

function finishOrder(orderId) {
  const order = data.orders.find(o => o.id === orderId);
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
  if (["Распил", "Склейка простая", "Склейка с обгоном"].includes(order.type)) {
    price += order.m2 * rates[order.type];
  }
  if (["Линейный", "Фрезер фаски", "Пазовка"].includes(order.type)) {
    price += order.pm * rates[order.type];
  }
  if (order.type === "Время") {
    price += order.time * rates[order.type];
  }

  order.price = Math.round(price * 100) / 100;
  order.status = 'closed';
  saveData();
  alert(`Заказ завершён. Цена: ${order.price}₽`);
  showOrderDetails(orderId);
}

function goToMain() {
  screenHistory = ['mainScreen'];
  switchScreen('mainScreen');
  history.replaceState({}, '', window.location.pathname); // Очищаем историю
  loadMainScreen(); // Обновляем главный экран
}

function goToPrevious() {
  if (screenHistory.length > 1) {
    screenHistory.pop(); // Удаляем текущий экран
    const previousScreen = screenHistory[screenHistory.length - 1];
    switchScreen(previousScreen);
  } else {
    goToMain();
  }
}