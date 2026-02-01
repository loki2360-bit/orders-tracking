// === ДАННЫЕ ===
let data = JSON.parse(localStorage.getItem('ordersData')) || { orders: [] };
let notifications = JSON.parse(localStorage.getItem('notifications')) || [];

let currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') document.body.classList.add('dark-theme');

let screenHistory = ['mainScreen'];

// === СОХРАНЕНИЕ ===
function saveData() {
  localStorage.setItem('ordersData', JSON.stringify(data));
  localStorage.setItem('notifications', JSON.stringify(notifications));
}

// === РАСЧЁТ ЦЕН ===
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
}

function checkOverdueOrders() {
  const now = new Date();
  data.orders.forEach(order => {
    if (order.status === 'open') {
      let orderDate = new Date(order.createdAt);
      if ((now - orderDate) > 15 * 60 * 1000) {
        const existing = notifications.find(n => n.orderId === order.id && !n.read);
        if (!existing) {
          createNotification(order.id, `Заказ ${order.id} не закрыт`);
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
      <h2>УВЕДОМЛЕНИЯ</h2>
      <button id="btnClearNotifications">очистить все</button>
      <div id="notificationsList"></div>
      <button onclick="goToPrevious()">назад</button>
    `;
    document.body.appendChild(screen);

    document.getElementById("btnClearNotifications").addEventListener("click", () => {
      if (confirm("Очистить все уведомления?")) {
        notifications = [];
        saveData();
        showNotificationsScreen();
      }
    });

    const list = document.getElementById("notificationsList");
    list.innerHTML = "";
    if (notifications.length === 0) {
      list.innerHTML = `<p>Нет уведомлений</p>`;
    } else {
      notifications.forEach(n => {
        const item = document.createElement("div");
        item.className = `notification-item ${n.read ? 'read' : 'unread'}`;
        item.innerHTML = `<span>${n.message}</span>`;
        item.onclick = () => {
          n.read = true;
          saveData();
          showNotificationsScreen();
        };
        list.appendChild(item);
      });
    }
  }
  switchScreen('notificationsScreen');
}

// === НАВИГАЦИЯ ===
function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
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

function addToHistory(id) {
  if (screenHistory[screenHistory.length - 1] !== id) {
    screenHistory.push(id);
  }
}

// === ГРАФИК ===
let earningsChart = null;
function renderEarningsChart() {
  const ctx = document.getElementById('earningsChart').getContext('2d');
  if (earningsChart) earningsChart.destroy();

  const today = new Date();
  const dates = [];
  const earnings = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    dates.push(ds);
    let sum = 0;
    data.orders.forEach(o => {
      if (o.status === 'closed' && o.date === ds) {
        sum += o.price || calculateOrderPrice(o.operations || []);
      }
    });
    earnings.push(Math.round(sum * 100) / 100);
  }

  earningsChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [{
        label: 'Заработок, ₽',
        data: earnings,
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
            color: currentTheme === 'dark' ? '#f0f0f0' : '#333'
          },
          grid: {
            color: currentTheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
          }
        },
        x: {
          ticks: {
            color: currentTheme === 'dark' ? '#f0f0f0' : '#333'
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}

// === ГЛАВНЫЙ ЭКРАН ===
function loadMainScreen() {
  let total = 0, daily = 0;
  const today = new Date().toISOString().split('T')[0];
  data.orders.forEach(o => {
    if (o.status === 'closed') {
      const p = o.price || calculateOrderPrice(o.operations || []);
      total += p;
      if (o.date === today) daily += p;
    }
  });
  total = Math.round(total * 100) / 100;
  daily = Math.round(daily * 100) / 100;
  document.getElementById("totalEarnings").textContent = `${total}₽`;
  document.getElementById("dailyEarnings").textContent = `${daily}₽`;
  renderEarningsChart();
  if (daily >= 3000 && localStorage.getItem('planNotifiedToday') !== today) {
    setTimeout(() => {
      alert('🎉 План на смену выполнен!');
      localStorage.setItem('planNotifiedToday', today);
    }, 1000);
  }
  switchScreen('mainScreen');
}

// === СОХРАНЕНИЕ В TXT ===
function saveReportAsText(date) {
  const orders = data.orders.filter(o => o.date === date);
  if (orders.length === 0) {
    alert(`Нет заказов за ${date}`);
    return;
  }

  let txt = `Отчёт за ${date}\n====================\n\n`;
  let totalSum = 0;

  orders.forEach(o => {
    const price = o.status === 'closed'
      ? (o.price || calculateOrderPrice(o.operations))
      : calculateOrderPrice(o.operations);
    totalSum += price;

    txt += `Заказ №: ${o.id}\n`;
    txt += `Статус: ${o.status === 'closed' ? 'Завершён' : 'Открыт'}\n`;
    txt += `Общая деталь: ${o.detail || '-'}\n`;
    txt += `Операции:\n`;
    o.operations.forEach((op, i) => {
      txt += `  ${i + 1}. ${op.type}\n`;
      txt += `     Деталь: ${op.detail || '-'}\n`;
      txt += `     Кол-во: ${op.quantity || 1}\n`;
      if (op.m2) txt += `     м²: ${op.m2}\n`;
      if (op.pm) txt += `     п.м: ${op.pm}\n`;
      if (op.time) txt += `     Часы: ${op.time}\n`;
      txt += `     Стоимость: ${calculateSingleOperationPrice(op)}₽\n`;
    });
    txt += `Итого по заказу: ${price}₽\n---\n\n`;
  });

  txt += `\nОБЩАЯ СУММА: ${totalSum}₽\n`;
  txt += `\nСформировано: ${new Date().toLocaleString('ru-RU')}`;

  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `отчёт_заказы_${date}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// === ЭКРАН СМЕН ===
function showShiftsScreen() {
  let el = document.getElementById("shiftScreen");
  if (!el) {
    el = document.createElement("div");
    el.className = "screen";
    el.id = "shiftScreen";
    el.innerHTML = `
      <h2>введите дату</h2>
      <input type="date" id="dateInput">
      <button id="showOrdersForDay">показать</button>
      <div id="ordersOfDay"></div>
      <div id="totalOfDay"></div>
      <button id="btnSaveReportTxt">💾 Сохранить отчёт (.txt)</button>
      <button onclick="goToPrevious()">назад</button>
    `;
    document.body.appendChild(el);

    document.getElementById("dateInput").value = new Date().toISOString().split('T')[0];
    document.getElementById("showOrdersForDay").onclick = () => {
      const d = document.getElementById("dateInput").value;
      if (d) showOrdersForDay(d);
    };
    document.getElementById("btnSaveReportTxt").onclick = () => {
      const d = document.getElementById("dateInput").value;
      if (d) saveReportAsText(d);
    };
  }
  switchScreen('shiftScreen');
}

function showOrdersForDay(date) {
  const orders = data.orders.filter(o => o.date === date);
  const cont = document.getElementById("ordersOfDay");
  cont.innerHTML = "";
  let total = 0;
  orders.forEach(o => {
    const p = o.status === 'closed' ? (o.price || calculateOrderPrice(o.operations || [])) : 0;
    if (o.status === 'closed') total += p;
    const disp = o.status === 'closed' ? `${Math.round(p * 100) / 100}₽` : '—';
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `<span>${o.id}</span><span class="price-tag">${disp}</span>`;
    cont.appendChild(item);
  });
  document.getElementById("totalOfDay").innerHTML = `<h3>итого: ${Math.round(total * 100) / 100}₽</h3>`;
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
      <input type="text" id="searchInput" placeholder="поиск по номеру">
      <button id="btnCreateNew">создать новый</button>
      <button id="btnNotifications">✉️ уведомления</button>
      <button id="btnBackToList">назад</button>
      <div id="allOrdersList"></div>
    `;
    document.body.appendChild(screen);

    document.getElementById("searchInput").addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (q) searchOrders(q); else displayOrdersGroupedByDate();
    });

    document.getElementById("btnCreateNew").addEventListener("click", createOrderForm);
    document.getElementById("btnNotifications").addEventListener("click", showNotificationsScreen);
    document.getElementById("btnBackToList").addEventListener("click", goToPrevious);
  }
  displayOrdersGroupedByDate();
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

  Object.keys(grouped).sort((a, b) => new Date(b) - new Date(a)).forEach(date => {
    const title = document.createElement("div");
    title.className = "date-header";
    title.innerHTML = `<div class="date-title" data-date="${date}">${date} <span class="arrow">▼</span></div>`;
    container.appendChild(title);

    const list = document.createElement("div");
    list.id = `list-${date}`;
    list.style.display = "none";
    grouped[date].forEach(order => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<span>${order.id}</span>`;
      item.onclick = () => showOrderDetails(order.id);
      list.appendChild(item);
    });
    container.appendChild(list);

    title.querySelector(".date-title").addEventListener("click", () => {
      const l = document.getElementById(`list-${date}`);
      const arrow = title.querySelector(".arrow");
      if (l.style.display === "none") {
        l.style.display = "block";
        arrow.textContent = "▲";
      } else {
        l.style.display = "none";
        arrow.textContent = "▼";
      }
    });
  });
}

function searchOrders(query) {
  const container = document.getElementById("allOrdersList");
  container.innerHTML = "";
  const results = data.orders.filter(o => o.id.toLowerCase().includes(query));
  if (results.length === 0) {
    container.innerHTML = `<p>Заказ "${query}" не найден.</p>`;
  } else {
    results.forEach(o => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `<span>${o.id}</span>`;
      item.onclick = () => showOrderDetails(o.id);
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
      <input type="text" id="orderNumber" placeholder="номер заказа" required>
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
      <input type="number" id="quantity" placeholder="Количество (мин. 1)" min="1" step="1">
      <input type="number" id="m2" placeholder="м² (например: 2.5)" min="0" step="0.01">
      <input type="number" id="pm" placeholder="п.м (например: 3.2)" min="0" step="0.01">
      <input type="number" id="time" placeholder="Часы (например: 1.5)" min="0" step="0.5">
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
function showAddOperationForm(orderId) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Новая операция</h3>
      <input type="text" id="newOpDetail" placeholder="Деталь">
      <select id="newOpType">
        <option value="Распил">Распил — 65₽/м²</option>
        <option value="Линейный">Линейный — 26₽/п.м</option>
        <option value="Склейка простая">Склейка простая — 165₽/м²</option>
        <option value="Склейка с обгоном">Склейка с обгоном — 210₽/м²</option>
        <option value="Фрезер фаски">Фрезер фаски — 16₽/п.м</option>
        <option value="Пазовка">Пазовка — 30₽/п.м</option>
        <option value="Время">Время — 330₽</option>
      </select>
      <input type="number" id="newOpQuantity" placeholder="Количество (мин. 1)" min="1" step="1">
      <input type="number" id="newOpM2" placeholder="м² (например: 2.5)" min="0" step="0.01">
      <input type="number" id="newOpPM" placeholder="п.м (например: 3.2)" min="0" step="0.01">
      <input type="number" id="newOpTime" placeholder="Часы (например: 1.5)" min="0" step="0.5">
      <button id="saveNewOp">добавить</button>
      <button id="cancelNewOp">отмена</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("saveNewOp").onclick = () => {
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
  };

  document.getElementById("cancelNewOp").onclick = () => {
    document.body.removeChild(modal);
  };
}

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
  let html = `
    <h2>${order.id}</h2>
    <p>Общая деталь: ${order.detail || '-'}</p>
    <label>Дата:</label>
    <input type="date" id="editOrderDate" value="${displayDate}">
    <button id="btnSaveDate">сохранить дату</button>
    <h3>Операции:</h3>
  `;

  order.operations.forEach((op, idx) => {
    html += `
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
  html += `<p>Текущая сумма: ${currentPrice}₽</p>`;

  if (order.status !== 'closed') {
    html += `<button id="btnAddOperation">добавить операцию</button>`;
    html += `<button id="btnFinishOrder">завершить</button>`;
  } else {
    html += `<p>Итоговая цена: ${order.price}₽</p>`;
  }

  html += `<button id="btnDeleteOrder">удалить</button>`;
  html += `<button onclick="goToPrevious()">назад</button>`;

  screen.innerHTML = html;
  switchScreen('orderDetailsScreen');

  document.getElementById("btnSaveDate").onclick = () => {
    const newDate = document.getElementById("editOrderDate").value;
    if (newDate) {
      order.date = newDate;
      saveData();
      alert("Дата обновлена!");
      showOrderDetails(orderId);
    }
  };

  if (order.status !== 'closed') {
    document.getElementById("btnAddOperation").onclick = () => showAddOperationForm(orderId);
    document.getElementById("btnFinishOrder").onclick = () => finishOrder(orderId);
  }

  document.getElementById("btnDeleteOrder").onclick = () => {
    if (confirm("Удалить заказ?")) {
      data.orders = data.orders.filter(o => o.id !== orderId);
      saveData();
      alert("Заказ удалён");
      goToPrevious();
    }
  };
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

// === КАЛЬКУЛЯТОР ===
function openCalculator() {
  const modal = document.createElement('div');
  modal.className = 'calculator-modal';
  modal.innerHTML = `
    <div class="calculator-content">
      <h3>Калькулятор м²</h3>
      <input type="number" id="calcLength" placeholder="Длина (мм)" min="1">
      <input type="number" id="calcWidth" placeholder="Ширина (мм)" min="1">
      <input type="number" id="calcQuantity" placeholder="Количество" min="1">
      <div class="result" id="calcResult">0 м²</div>
      <button id="copyResult">Скопировать</button>
      <button id="closeCalc">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);

  const update = () => {
    const l = parseFloat(document.getElementById('calcLength').value) || 0;
    const w = parseFloat(document.getElementById('calcWidth').value) || 0;
    const q = parseFloat(document.getElementById('calcQuantity').value) || 1;
    const m2 = (l * w / 1_000_000) * q;
    document.getElementById('calcResult').textContent = m2.toFixed(4) + ' м²';
  };

  ['calcLength', 'calcWidth', 'calcQuantity'].forEach(id => {
    document.getElementById(id).addEventListener('input', update);
  });

  document.getElementById('copyResult').onclick = () => {
    navigator.clipboard.writeText(document.getElementById('calcResult').textContent)
      .then(() => alert('Скопировано!'));
  };

  document.getElementById('closeCalc').onclick = () => {
    document.body.removeChild(modal);
  };
}

// === ТАЙМЕР ===
let timerInterval = null;
let timerSeconds = 0;
let isTimerRunning = false;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

function updateTimerDisplay() {
  document.getElementById('timerDisplay').textContent = formatTime(timerSeconds);
}

function startTimer() {
  if (isTimerRunning) return;
  isTimerRunning = true;
  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
  document.getElementById('btnTimerStart').disabled = true;
  document.getElementById('btnTimerPause').disabled = false;
}

function pauseTimer() {
  if (!isTimerRunning) return;
  clearInterval(timerInterval);
  isTimerRunning = false;
  document.getElementById('btnTimerStart').disabled = false;
  document.getElementById('btnTimerPause').disabled = true;
  document.getElementById('btnTimerSave').disabled = false;
}

function resetTimer() {
  pauseTimer();
  timerSeconds = 0;
  updateTimerDisplay();
  document.getElementById('btnTimerSave').disabled = true;
}

function saveTimerEntry() {
  if (timerSeconds === 0) {
    alert('Нет времени для сохранения');
    return;
  }

  const comment = prompt('Введите комментарий к записи (например: "Приборка цеха"):', '');
  if (comment === null) return;

  const entry = {
    id: Date.now(),
    duration: timerSeconds,
    comment: comment.trim() || '(без комментария)',
    timestamp: new Date().toISOString()
  };

  const timerLogs = JSON.parse(localStorage.getItem('timerLogs') || '[]');
  timerLogs.push(entry);
  localStorage.setItem('timerLogs', JSON.stringify(timerLogs));

  alert(`Запись сохранена: ${formatTime(timerSeconds)} — ${entry.comment}`);
  resetTimer();
  showTimerModal();
}

function showTimerModal() {
  const existing = document.querySelector('.timer-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'timer-modal';
  modal.innerHTML = `
    <div class="timer-content">
      <h3>Таймер</h3>
      <div id="timerDisplay" style="font-size:2em; margin:15px 0;">00:00:00</div>
      <div>
        <button id="btnTimerStart">▶ Старт</button>
        <button id="btnTimerPause" disabled>⏸ Пауза</button>
        <button id="btnTimerReset">⏹ Сброс</button>
      </div>
      <button id="btnTimerSave" disabled style="margin-top:10px; background:#4CAF50; color:white;">💾 Сохранить</button>
      
      <h4 style="margin-top:20px;">Сохранённые записи:</h4>
      <div id="timerLogsList" style="max-height:200px; overflow-y:auto; border-top:1px solid #ccc; padding-top:10px;"></div>
      
      <button onclick="this.parentElement.parentElement.remove()" style="margin-top:15px; width:100%; padding:8px; background:#f44336; color:white; border:none; border-radius:4px;">
        Закрыть
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  updateTimerDisplay();

  const logsList = document.getElementById('timerLogsList');
  const logs = JSON.parse(localStorage.getItem('timerLogs') || '[]');
  if (logs.length === 0) {
    logsList.innerHTML = '<p>Нет записей</p>';
  } else {
    logsList.innerHTML = logs.map(log => `
      <div style="padding:6px 0; border-bottom:1px solid #eee;">
        <strong>${formatTime(log.duration)}</strong> — ${log.comment}
        <br><small>${new Date(log.timestamp).toLocaleString('ru-RU')}</small>
      </div>
    `).join('');
  }

  document.getElementById('btnTimerStart').onclick = startTimer;
  document.getElementById('btnTimerPause').onclick = pauseTimer;
  document.getElementById('btnTimerReset').onclick = resetTimer;
  document.getElementById('btnTimerSave').onclick = saveTimerEntry;
}

// === ПЛАН ===
function openPlanModal() {
  const today = new Date().toISOString().split('T')[0];
  let daily = 0;
  data.orders.forEach(o => {
    if (o.status === 'closed' && o.date === today) {
      daily += o.price || calculateOrderPrice(o.operations || []);
    }
  });
  daily = Math.round(daily * 100) / 100;
  const achieved = daily >= 3000;
  const modal = document.createElement('div');
  modal.className = 'plan-modal';
  modal.innerHTML = `
    <div class="plan-content">
      <div>План на смену</div>
      <div class="plan-amount ${achieved ? 'achieved' : 'under'}">${daily}₽ / 3000₽</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(100, (daily / 3000) * 100)}%"></div></div>
      ${achieved ? '<div class="gift-icon" id="giftIcon">🎁</div>' : ''}
      <button onclick="this.parentElement.parentElement.remove()" style="margin-top:16px; width:100%; padding:10px; background:#ffd700; border:none; border-radius:8px; font-weight:bold;">Закрыть</button>
    </div>
  `;
  document.body.appendChild(modal);
  if (achieved) {
    document.getElementById('giftIcon').onclick = () => {
      alert('🎉 План выполнен!');
      modal.remove();
    };
  }
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener("DOMContentLoaded", () => {
  // Миграция старых данных
  let migrated = false;
  data.orders.forEach(o => {
    if (!o.operations) {
      o.operations = [{ detail: o.detail || '-', type: o.type || "Время", quantity: o.quantity || 1, m2: o.m2 || 0, pm: o.pm || 0, time: o.time || 0 }];
      delete o.type; delete o.quantity; delete o.m2; delete o.pm; delete o.time;
      migrated = true;
    }
  });
  if (migrated) saveData();

  checkOverdueOrders();

  loadMainScreen();
  setupEventListeners();

  // Кнопка настроек
  const settingsBtn = document.createElement('button');
  settingsBtn.className = 'settings-btn';
  settingsBtn.innerHTML = '⚙️';
  settingsBtn.onclick = () => {
    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.innerHTML = `
      <div class="settings-content">
        <h3>Тема</h3>
        <div onclick="toggleTheme('light')" style="margin:10px; cursor:pointer;">Светлая</div>
        <div onclick="toggleTheme('dark')" style="margin:10px; cursor:pointer;">Тёмная</div>
        <button onclick="this.parentElement.parentElement.remove()" style="width:100%; margin-top:15px;">Закрыть</button>
      </div>
    `;
    document.body.appendChild(modal);
  };
  document.body.appendChild(settingsBtn);

  // Кнопка калькулятора
  const menuBtn = document.createElement('button');
  menuBtn.className = 'menu-btn-bottom';
  menuBtn.innerHTML = '☰';
  menuBtn.onclick = openCalculator;
  document.body.appendChild(menuBtn);

  // Кнопка таймера
  const timerBtn = document.createElement('button');
  timerBtn.className = 'menu-btn-bottom';
  timerBtn.innerHTML = '⏱️';
  timerBtn.onclick = showTimerModal;
  document.body.appendChild(timerBtn);

  // Аватар → план
  document.getElementById('avatarBtn').onclick = openPlanModal;

  // Позиционирование кнопок
  settingsBtn.style.position = 'fixed';
  settingsBtn.style.bottom = '16px';
  settingsBtn.style.left = '16px';
  settingsBtn.style.zIndex = '1000';

  menuBtn.style.position = 'fixed';
  menuBtn.style.bottom = '16px';
  menuBtn.style.left = '50%';
  menuBtn.style.transform = 'translateX(-50%)';
  menuBtn.style.zIndex = '1000';

  timerBtn.style.position = 'fixed';
  timerBtn.style.bottom = '16px';
  timerBtn.style.right = '16px';
  timerBtn.style.zIndex = '1000';
});

function toggleTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  document.body.classList.toggle('dark-theme', theme === 'dark');
  if (document.getElementById('mainScreen').classList.contains('active')) {
    loadMainScreen();
  }
}

function setupEventListeners() {
  document.getElementById("btnOrders").onclick = () => {
    showOrdersList();
    addToHistory('ordersListScreen');
  };
  document.getElementById("btnShifts").onclick = () => {
    showShiftsScreen();
    addToHistory('shiftScreen');
  };
}
