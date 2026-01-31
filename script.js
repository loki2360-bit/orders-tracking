// === БЕЗОПАСНОЕ ПОЛУЧЕНИЕ ДАННЫХ ===
function safeParse(key, defaultValue) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (e) {
    console.error(`Ошибка парсинга ${key}:`, e);
    localStorage.removeItem(key);
    return defaultValue;
  }
}

let data = safeParse('ordersData', { orders: [] });
let notifications = safeParse('notifications', []);
let sentReports = safeParse('sentReports', []);
let appData = safeParse('appData', { createdCount: 0, activationKeyUsed: false });

// === ТЕМА ===
let currentTheme = safeParse('theme', 'light');
if (currentTheme === 'dark') {
  document.body.classList.add('dark-theme');
}

// История экранов
let screenHistory = ['mainScreen'];

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function saveData() {
  localStorage.setItem('ordersData', JSON.stringify(data));
  localStorage.setItem('notifications', JSON.stringify(notifications));
  localStorage.setItem('sentReports', JSON.stringify(sentReports));
  localStorage.setItem('theme', currentTheme);
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

function toggleTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  document.body.classList.toggle('dark-theme', theme === 'dark');
}

// === ПОЛУЧЕНИЕ ЗАРАБОТКА ЗА ПОСЛЕДНИЕ 7 ДНЕЙ ===
function getLast7DaysEarnings() {
  const today = new Date();
  const dates = [];
  const earnings = [];

  for (let i = 6; i >= 0; i--) {
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

// === ОТРИСОВКА ГРАФИКА ===
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
            color: document.body.classList.contains('dark-theme') 
              ? 'rgba(255,255,255,0.1)' 
              : 'rgba(0,0,0,0.1)'
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

  renderEarningsChart();

  // Автоматическое уведомление о плане
  const planNotified = localStorage.getItem('planNotifiedToday') === today;
  if (daily >= 3000 && !planNotified) {
    setTimeout(() => {
      alert('🎉 План на смену выполнен!');
      localStorage.setItem('planNotifiedToday', today);
    }, 1000);
  }

  switchScreen('mainScreen');
}

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  let screen = document.getElementById(id);
  if (!screen) {
    console.error(`Screen '${id}' not found.`);
    return;
  }
  screen.classList.add('active');
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
      </div>
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

    document.getElementById("btnCreateNew").addEventListener("click", () => {
      createOrderForm();
      screenHistory.push('createOrderScreen');
    });

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
        screenHistory.push('orderDetailsScreen');
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
        screenHistory.push('orderDetailsScreen');
      };
      container.appendChild(item);
    });
  }
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

// === СМЕНЫ ===

function showShiftsScreen() {
  let screen = document.getElementById("shiftScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "shiftScreen";
    screen.innerHTML = `
      <h2 class="title">введите дату</h2>
      <input type="date" id="dateInput">
      <button id="showOrdersForDay">показать</button>
      <div id="ordersOfDay"></div>
      <div id="totalOfDay"></div>
      <button id="btnSaveReport">сохранить отчёт</button>
      <button onclick="goToPrevious()">назад</button>
    `;
    document.body.appendChild(screen);

    document.getElementById("dateInput").value = new Date().toISOString().split('T')[0];

    document.getElementById("showOrdersForDay").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      if (!date) {
        alert("Выберите дату");
        return;
      }
      showOrdersForDay(date);
    });

    document.getElementById("btnSaveReport").addEventListener("click", () => {
      const date = document.getElementById("dateInput").value;
      if (!date) {
        alert("Выберите дату");
        return;
      }

      const orders = data.orders.filter(o => o.date === date);
      if (orders.length === 0) {
        alert("Нет заказов за эту дату.");
        return;
      }

      let total = 0;
      let report = `ОТЧЁТ за ${date}\n====================\n\n`;

      orders.forEach(order => {
        const price = order.status === 'closed'
          ? (order.price || calculateOrderPrice(order.operations))
          : calculateOrderPrice(order.operations);
        
        if (order.status === 'closed') total += price;

        report += `Заказ №${order.id}\n`;
        report += `Деталь: ${order.detail || '-'}\n`;
        
        order.operations.forEach((op, idx) => {
          report += `  ${idx + 1}. ${op.type} `;
          if (op.m2 > 0) report += `${op.m2} м² `;
          if (op.pm > 0) report += `${op.pm} п.м `;
          if (op.time > 0) report += `${op.time} ч `;
          if (op.quantity > 1) report += `(×${op.quantity})`;
          report += `\n`;
        });
        
        report += `Итого: ${Math.round(price * 100) / 100}₽\n\n`;
      });

      report += `====================\nОбщая сумма: ${Math.round(total * 100) / 100}₽`;

      const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `отчёт_${date}.txt`;
      document.body.appendChild(a);
      setTimeout(() => a.click(), 100);
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

// === ПЛАН ===

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

// === КАЛЬКУЛЯТОР ===

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

// === ИНИЦИАЛИЗАЦИЯ ===

document.addEventListener("DOMContentLoaded", () => {
  loadMainScreen();

  // Кнопки главного экрана
  document.getElementById("btnOrders").addEventListener("click", () => {
    showOrdersList();
    screenHistory.push('ordersListScreen');
  });
  document.getElementById("btnShifts").addEventListener("click", () => {
    showShiftsScreen();
    screenHistory.push('shiftScreen');
  });

  // Аватарка → план
  document.getElementById('avatarBtn').addEventListener('click', openPlanModal);

  // Кнопки внизу
  document.getElementById('settingsBtn').addEventListener('click', showSettings);
  document.getElementById('calcBtn').addEventListener('click', openCalculator);
});
