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
  
  // Простой график (без Chart.js если не работает)
  const chart = document.getElementById('earningsChart');
  if (chart) {
    chart.innerHTML = '<div style="text-align:center; padding:40px; color:#999;">График недоступен</div>';
  }
  
  switchScreen('mainScreen');
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

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener("DOMContentLoaded", () => {
  loadMainScreen();
  
  // Кнопки навигации
  if (document.getElementById("btnOrders")) {
    document.getElementById("btnOrders").onclick = () => {
      alert("Функция временно отключена для восстановления");
    };
  }
  if (document.getElementById("btnShifts")) {
    document.getElementById("btnShifts").onclick = () => {
      alert("Функция временно отключена для восстановления");
    };
  }
  
  // Аватар
  const avatar = document.getElementById('avatarBtn');
  if (avatar) {
    avatar.onclick = () => {
      alert("План на смену: 3000₽");
    };
  }
});
