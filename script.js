let data = JSON.parse(localStorage.getItem('orders')) || { list: [] };
let screen = 'main';

const RATES = {
  "Распил": 65, "Линейный": 26, "Склейка простая": 165,
  "Склейка с обгоном": 210, "Фрезер фаски": 16, "Пазовка": 30, "Время": 330
};

function save() {
  localStorage.setItem('orders', JSON.stringify(data));
}

function calcPrice(ops) {
  return (ops || []).reduce((sum, op) => {
    const q = op.quantity || 1;
    if (["Распил","Склейка простая","Склейка с обгоном"].includes(op.type))
      return sum + (op.m2 || 0) * RATES[op.type] * q;
    if (["Линейный","Фрезер фаски","Пазовка"].includes(op.type))
      return sum + (op.pm || 0) * RATES[op.type] * q;
    if (op.type === "Время")
      return sum + (op.time || 0) * RATES[op.type] * q;
    return sum;
  }, 0);
}

function show(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  screen = id;
}

function goBack() {
  if (screen === 'create' || screen === 'reports') {
    show('main');
  }
}

function showCreate() {
  document.getElementById('odate').value = new Date().toISOString().split('T')[0];
  show('create');
}

function saveOrder() {
  const id = document.getElementById('oid').value.trim();
  if (!id) { alert('Введите № заказа'); return; }

  data.list.push({
    id,
    date: document.getElementById('odate').value,
    status: 'open',
    operations: [{
      type: document.getElementById('otype').value,
      quantity: +document.getElementById('oqty').value || 1,
      m2: +document.getElementById('om2').value || 0,
      pm: +document.getElementById('opm').value || 0,
      time: +document.getElementById('otime').value || 0
    }]
  });
  save();
  alert('Заказ сохранён');
  goBack();
}

function loadDay() {
  const d = document.getElementById('rdate').value;
  if (!d) { alert('Выберите дату'); return; }
  const list = data.list.filter(o => o.date === d);
  const el = document.getElementById('report-list');
  if (list.length === 0) {
    el.innerHTML = '<i>Заказов нет</i>';
    return;
  }
  el.innerHTML = list.map(o => {
    const p = calcPrice(o.operations);
    return `<div><b>${o.id}</b> — ${p} ₽</div>`;
  }).join('');
}

function updateStats() {
  const today = new Date().toISOString().split('T')[0];
  const total = data.list.reduce((s, o) => s + calcPrice(o.operations), 0);
  const todaySum = data.list
    .filter(o => o.date === today)
    .reduce((s, o) => s + calcPrice(o.operations), 0);

  document.getElementById('total').textContent = total.toFixed(0) + ' ₽';
  document.getElementById('today').textContent = todaySum.toFixed(0) + ' ₽';
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  updateStats();
  show('main');

  // Регистрация SW (опционально, но безопасно)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/-tracking/service-worker.js')
      .catch(() => {}); // игнорируем ошибки — не критично для работы
  }
});
