// === ВАЖНО: НИКАКИХ ОШИБОК — только чистый JS ===
let data = JSON.parse(localStorage.getItem('ordersData')) || { orders: [] };
let currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') document.body.classList.add('dark-theme');

let screenHistory = ['mainScreen'];

const RATES = {
  "Распил": 65,
  "Линейный": 26,
  "Склейка простая": 165,
  "Склейка с обгоном": 210,
  "Фрезер фаски": 16,
  "Пазовка": 30,
  "Время": 330
};

function saveData() {
  localStorage.setItem('ordersData', JSON.stringify(data));
}

function calculateOrderPrice(ops) {
  if (!Array.isArray(ops)) return 0;
  return ops.reduce((sum, op) => {
    const qty = op.quantity || 1;
    if (["Распил","Склейка простая","Склейка с обгоном"].includes(op.type))
      return sum + (op.m2 || 0) * RATES[op.type] * qty;
    if (["Линейный","Фрезер фаски","Пазовка"].includes(op.type))
      return sum + (op.pm || 0) * RATES[op.type] * qty;
    if (op.type === "Время")
      return sum + (op.time || 0) * RATES[op.type] * qty;
    return sum;
  }, 0);
}

function switchScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
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
  if (screenHistory[screenHistory.length - 1] !== id) screenHistory.push(id);
}

function loadMainScreen() {
  const today = new Date().toISOString().split('T')[0];
  const ym = new Date().toISOString().slice(0, 7);
  let total = 0, daily = 0, m2 = 0, pm = 0;

  data.orders.forEach(o => {
    if (o.status === 'closed') {
      const price = o.price || calculateOrderPrice(o.operations || []);
      total += price;
      if (o.date === today) daily += price;
      if (o.date?.startsWith(ym)) {
        (o.operations || []).forEach(op => {
          if (["Распил","Склейка простая","Склейка с обгоном"].includes(op.type))
            m2 += (op.m2 || 0) * (op.quantity || 1);
          if (["Линейный","Фрезер фаски","Пазовка"].includes(op.type))
            pm += (op.pm || 0) * (op.quantity || 1);
        });
      }
    }
  });

  document.getElementById("totalEarnings")?.textContent = `${Math.round(total)}₽`;
  document.getElementById("dailyEarnings")?.textContent = `${Math.round(daily)}₽`;
  document.getElementById("monthlyM2")?.textContent = `${Math.round(m2 * 100) / 100} м²`;
  document.getElementById("monthlyPm")?.textContent = `${Math.round(pm * 100) / 100} п.м`;

  renderChart();
  if (daily >= 3000 && localStorage.getItem('planNotifiedToday') !== today) {
    setTimeout(() => {
      alert('🎉 План выполнен!');
      localStorage.setItem('planNotifiedToday', today);
    }, 500);
  }
  switchScreen('mainScreen');
}

let chartInst = null;
function renderChart() {
  const ctx = document.getElementById('earningsChart');
  if (!ctx) return;
  const c = ctx.getContext('2d');
  if (chartInst) chartInst.destroy();

  const dates = [];
  const vals = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    dates.push(ds);
    vals.push(Math.round(data.orders
      .filter(o => o.status === 'closed' && o.date === ds)
      .reduce((s, o) => s + (o.price || calculateOrderPrice(o.operations || [])), 0)
    ));
  }

  chartInst = new Chart(c, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [{
        label: '₽',
        data: vals,
        backgroundColor: currentTheme === 'dark' ? '#4a90e2' : '#ffd700',
        borderColor: '#000',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true },
        x: { grid: { display: false } }
      }
    }
  });
}

function saveReport(date) {
  const orders = data.orders.filter(o => o.date === date);
  if (!orders.length) return alert(`Нет заказов за ${date}`);
  let txt = `Отчёт ${date}\n`;
  let total = 0;
  orders.forEach(o => {
    const p = o.price || calculateOrderPrice(o.operations || []);
    total += p;
    txt += `\nЗаказ ${o.id}: ${p}₽\n`;
    (o.operations || []).forEach(op => {
      txt += `  • ${op.type} (${op.detail}) → ${calculateOrderPrice([op])}₽\n`;
    });
  });
  txt += `\nИТОГО: ${total}₽`;

  const blob = new Blob([txt], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `report_${date}.txt`;
  a.click();
}

function showShifts() {
  if (!document.getElementById('shiftScreen')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="shiftScreen" class="screen">
        <h2>Отчёты</h2>
        <input type="date" id="dt" value="${new Date().toISOString().split('T')[0]}">
        <button onclick="showDay()">Показать</button>
        <div id="list"></div>
        <button onclick="saveReport(document.getElementById('dt').value)">💾 TXT</button>
        <button onclick="goToPrevious()">←</button>
      </div>`);
  }
  switchScreen('shiftScreen');
  addToHistory('shiftScreen');
}

function showDay() {
  const d = document.getElementById('dt').value;
  const list = document.getElementById('list');
  const orders = data.orders.filter(o => o.date === d);
  list.innerHTML = orders.map(o => {
    const p = o.price || calculateOrderPrice(o.operations || []);
    return `<div><b>${o.id}</b>: ${p}₽</div>`;
  }).join('') || '<i>Нет заказов</i>';
}

function showCreate() {
  if (!document.getElementById('createScreen')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="createScreen" class="screen">
        <h2>Новый заказ</h2>
        <input id="id" placeholder="№">
        <input id="det" placeholder="Деталь">
        <input type="date" id="dt2" value="${new Date().toISOString().split('T')[0]}">
        <select id="type">
          <option>Распил</option><option>Линейный</option>
          <option>Склейка простая</option><option>Склейка с обгоном</option>
          <option>Фрезер фаски</option><option>Пазовка</option><option>Время</option>
        </select>
        <input type="number" id="q" value="1" min="1">
        <input type="number" id="m2" step="0.1"><input type="number" id="pm" step="0.1">
        <input type="number" id="time" step="0.5">
        <button onclick="addOrder()">Создать</button>
        <button onclick="goToPrevious()">←</button>
      </div>`);
  }
  switchScreen('createScreen');
  addToHistory('createScreen');
}

function addOrder() {
  const id = document.getElementById('id').value.trim();
  if (!id) return alert('Укажите № заказа');
  data.orders.push({
    id,
    detail: document.getElementById('det').value || '-',
    date: document.getElementById('dt2').value,
    status: 'open',
    operations: [{
      detail: document.getElementById('det').value || '-',
      type: document.getElementById('type').value,
      quantity: +document.getElementById('q').value || 1,
      m2: +document.getElementById('m2').value || 0,
      pm: +document.getElementById('pm').value || 0,
      time: +document.getElementById('time').value || 0
    }]
  });
  saveData();
  alert('Заказ создан');
  goToPrevious();
}

function init() {
  if (!document.getElementById('mainScreen')) {
    document.body.insertAdjacentHTML('beforeend', `
      <div id="mainScreen" class="screen active">
        <h1>Панель оператора</h1>
        <p>Всего: <span id="totalEarnings">0₽</span></p>
        <p>Сегодня: <span id="dailyEarnings">0₽</span></p>
        <p>М²: <span id="monthlyM2">0</span></p>
        <p>П.м: <span id="monthlyPm">0</span></p>
        <canvas id="earningsChart" height="200"></canvas>
        <br>
        <button onclick="showCreate()">➕</button>
        <button onclick="showShifts()">📅</button>
      </div>
      <button id="themeBtn" style="position:fixed;bottom:10px;right:10px;">🌓</button>
    `);
    document.getElementById('themeBtn').onclick = () => {
      currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
      localStorage.theme = currentTheme;
      document.body.classList.toggle('dark-theme');
      renderChart();
    };
  }
  loadMainScreen();
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    init();
  } catch (e) {
    console.error(e);
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/orders-tracking/service-worker.js')
      .catch(console.warn);
  }
});
