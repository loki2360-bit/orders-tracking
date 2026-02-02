// === ДАННЫЕ ===
let data = JSON.parse(localStorage.getItem('ordersData')) || { orders: [] };
let currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
  document.body.classList.add('dark-theme');
}

// === ИСТОРИЯ ЭКРАНОВ ===
let screenHistory = ['mainScreen'];

// === ТАРИФЫ ===
const RATES = {
  "Распил": 65,
  "Линейный": 26,
  "Склейка простая": 165,
  "Склейка с обгоном": 210,
  "Фрезер фаски": 16,
  "Пазовка": 30,
  "Время": 330
};

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function saveData() {
  localStorage.setItem('ordersData', JSON.stringify(data));
}

function calculateOrderPrice(operations) {
  let total = 0;
  operations.forEach(op => {
    const qty = op.quantity || 1;
    if (["Распил", "Склейка простая", "Склейка с обгоном"].includes(op.type)) {
      total += (op.m2 || 0) * RATES[op.type] * qty;
    }
    if (["Линейный", "Фрезер фаски", "Пазовка"].includes(op.type)) {
      total += (op.pm || 0) * RATES[op.type] * qty;
    }
    if (op.type === "Время") {
      total += (op.time || 0) * RATES[op.type] * qty;
    }
  });
  return Math.round(total * 100) / 100;
}

function calculateSingleOperationPrice(op) {
  return calculateOrderPrice([op]);
}

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

// === ГЛАВНЫЙ ЭКРАН ===
function loadMainScreen() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, '0');

  let totalEarnings = 0;
  let dailyEarnings = 0;
  let totalM2 = 0;
  let totalPm = 0;

  data.orders.forEach(o => {
    if (o.status === 'closed') {
      const price = o.price || calculateOrderPrice(o.operations || []);
      totalEarnings += price;
      if (o.date === today) dailyEarnings += price;

      if (o.date && o.date.startsWith(`${currentYear}-${currentMonth}`)) {
        o.operations.forEach(op => {
          if (["Распил", "Склейка простая", "Склейка с обгоном"].includes(op.type)) {
            totalM2 += (op.m2 || 0) * (op.quantity || 1);
          }
          if (["Линейный", "Фрезер фаски", "Пазовка"].includes(op.type)) {
            totalPm += (op.pm || 0) * (op.quantity || 1);
          }
        });
      }
    }
  });

  totalEarnings = Math.round(totalEarnings * 100) / 100;
  dailyEarnings = Math.round(dailyEarnings * 100) / 100;
  totalM2 = Math.round(totalM2 * 100) / 100;
  totalPm = Math.round(totalPm * 100) / 100;

  // Обновляем интерфейс
  const totalEl = document.getElementById("totalEarnings");
  const dailyEl = document.getElementById("dailyEarnings");
  const m2El = document.getElementById("monthlyM2");
  const pmEl = document.getElementById("monthlyPm");

  if (totalEl) totalEl.textContent = `${totalEarnings}₽`;
  if (dailyEl) dailyEl.textContent = `${dailyEarnings}₽`;
  if (m2El) m2El.textContent = `${totalM2} м²`;
  if (pmEl) pmEl.textContent = `${totalPm} п.м`;

  renderEarningsChart();

  // Уведомление о плане (3000 ₽)
  if (dailyEarnings >= 3000 && localStorage.getItem('planNotifiedToday') !== today) {
    setTimeout(() => {
      alert('🎉 План на смену выполнен!');
      localStorage.setItem('planNotifiedToday', today);
    }, 1000);
  }

  switchScreen('mainScreen');
}

// === ГРАФИК ЗАРАБОТКА ===
let earningsChart = null;
function renderEarningsChart() {
  const ctx = document.getElementById('earningsChart');
  if (!ctx) return;

  const chartCtx = ctx.getContext('2d');
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

  earningsChart = new Chart(chartCtx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [{
        label: 'Заработок, ₽',
        data: earnings,
        backgroundColor: currentTheme === 'dark' ? '#4a90e2' : '#ffd700',
        borderColor: currentTheme === 'dark' ? '#6ec1e4' : '#000',
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
          grid: { display: false }
        }
      }
    }
  });
}

// === СОХРАНЕНИЕ ОТЧЁТА В TXT ===
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

// === ЭКРАН СМЕНЫ ===
function showShiftsScreen() {
  let el = document.getElementById("shiftScreen");
  if (!el) {
    el = document.createElement("div");
    el.className = "screen";
    el.id = "shiftScreen";
    el.innerHTML = `
      <h2>Введите дату</h2>
      <input type="date" id="dateInput">
      <button id="showOrdersForDay">Показать заказы</button>
      <div id="ordersOfDay"></div>
      <div id="totalOfDay"></div>
      <button id="btnSaveReportTxt">💾 Сохранить отчёт (.txt)</button>
      <button onclick="goToPrevious()">Назад</button>
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
  addToHistory('shiftScreen');
}

function showOrdersForDay(date) {
  const orders = data.orders.filter(o => o.date === date);
  const cont = document.getElementById("ordersOfDay");
  const totalCont = document.getElementById("totalOfDay");
  cont.innerHTML = "";
  let total = 0;

  orders.forEach(o => {
    const p = o.status === 'closed' ? (o.price || calculateOrderPrice(o.operations || [])) : 0;
    if (o.status === 'closed') total += p;
    const disp = o.status === 'closed' ? `${Math.round(p * 100) / 100}₽` : '—';
    const item = document.createElement("div");
    item.innerHTML = `<strong>${o.id}</strong>: ${disp}`;
    cont.appendChild(item);
  });

  totalCont.textContent = `Итого за день: ${Math.round(total * 100) / 100}₽`;
}

// === СОЗДАНИЕ ЗАКАЗА ===
function showCreateOrderScreen() {
  let screen = document.getElementById("createOrderScreen");
  if (!screen) {
    screen = document.createElement("div");
    screen.className = "screen";
    screen.id = "createOrderScreen";
    screen.innerHTML = `
      <h2>Создать заказ</h2>
      <input type="text" id="orderNumber" placeholder="Номер заказа">
      <input type="text" id="orderDetail" placeholder="Деталь">
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
      <button id="saveOrder">Создать</button>
      <button onclick="goToPrevious()">Назад</button>
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
  addToHistory('createOrderScreen');
}

// === ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА ===
function initApp() {
  // Создаём основной экран
  if (!document.getElementById('mainScreen')) {
    const mainScreen = document.createElement('div');
    mainScreen.id = 'mainScreen';
    mainScreen.className = 'screen active';
    mainScreen.innerHTML = `
      <h1>Панель оператора</h1>
      <p>Общий заработок: <span id="totalEarnings">0₽</span></p>
      <p>Сегодня: <span id="dailyEarnings">0₽</span></p>
      <p>М² за месяц: <span id="monthlyM2">0 м²</span></p>
      <p>П.м за месяц: <span id="monthlyPm">0 п.м</span></p>
      <canvas id="earningsChart" height="200"></canvas>
      <br>
      <button onclick="showCreateOrderScreen()">➕ Создать заказ</button>
      <button onclick="showShiftsScreen()">📅 Отчёты по дням</button>
    `;
    document.body.appendChild(mainScreen);
  }

  // Кнопка смены темы (например, в header или footer)
  if (!document.getElementById('themeToggle')) {
    const toggle = document.createElement('button');
    toggle.id = 'themeToggle';
    toggle.textContent = '🌓 Тема';
    toggle.style.position = 'fixed';
    toggle.style.bottom = '10px';
    toggle.style.right = '10px';
    toggle.onclick = () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', currentTheme);
      document.body.classList.toggle('dark-theme', currentTheme === 'dark');
      renderEarningsChart(); // обновить цвет графика
    };
    document.body.appendChild(toggle);
  }

  loadMainScreen();
}

// === ЗАГРУЗКА ПРИЛОЖЕНИЯ ===
document.addEventListener('DOMContentLoaded', () => {
  initApp();

  // Регистрация Service Worker (только после загрузки основного функционала)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const swPath = '/orders-tracking/service-worker.js';
      navigator.serviceWorker.register(swPath)
        .then(reg => console.log('SW зарегистрирован:', reg.scope))
        .catch(err => console.warn('SW не зарегистрирован:', err));
    });
  }
});
