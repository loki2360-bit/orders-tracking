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
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: currentTheme === 'dark' ? '#f0f0f0' : '#333' } },
        x: { ticks: { color: currentTheme === 'dark' ? '#f0f0f0' : '#333' }, grid: { display: false } }
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

// === СПИСОК ЗАКАЗОВ, СОЗДАНИЕ, ДЕТАЛИ — упрощённая версия для демонстрации ===
// (Вы можете вставить свой полный код ниже, если он нужен)

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

  loadMainScreen();
  setupEventListeners();

  // Кнопки
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

  const menuBtn = document.createElement('button');
  menuBtn.className = 'menu-btn-bottom';
  menuBtn.innerHTML = '☰';
  menuBtn.onclick = () => {
    alert('Калькулятор можно добавить отдельно.');
  };
  document.body.appendChild(menuBtn);

  document.getElementById('avatarBtn').onclick = () => {
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
  };
});

function toggleTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('theme', theme);
  document.body.classList.toggle('dark-theme', theme === 'dark');
  if (document.getElementById('mainScreen').classList.contains('active')) {
    loadMainScreen(); // обновить график
  }
}

function setupEventListeners() {
  document.getElementById("btnOrders").onclick = () => {
    alert('Экран списка заказов можно реализовать отдельно.');
    addToHistory('ordersList');
  };
  document.getElementById("btnShifts").onclick = () => {
    showShiftsScreen();
    addToHistory('shiftScreen');
  };
}
