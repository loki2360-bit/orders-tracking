// Укажите ваш URL из Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbzxLfXzKbsIQIUsUWytSHrTNsC9SSkmqsYIUkvjbi8Oao7YlRPvMNp-pRz4T6lggLwnQg/exec';
let data = {
  orders: []
};

// Загрузка данных при запуске
document.addEventListener("DOMContentLoaded", async () => {
  await loadData();
  showMainScreen();
});

async function loadData() {
  try {
    const res = await fetch(`${API_URL}?action=getOrders`);
    data.orders = await res.json();
  } catch (e) {
    console.error('Ошибка загрузки данных:', e);
  }
}

function showMainScreen() {
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

  document.body.innerHTML = `
    <div class="screen">
      <div class="profile">
        <div class="avatar">👤</div>
        <div class="info">
          <h2>Александр</h2>
          <p>folder оператор №1Е2 352726 030</p>
        </div>
      </div>
      <div class="earnings">
        <p>за все время</p>
        <h1>${total}₽</h1>
      </div>
      <div class="today-earnings">
        <p>заработано за смену:</p>
        <h2>${daily}₽</h2>
      </div>
      <button onclick="showOrdersList()">список заказов</button>
      <button onclick="showShiftsScreen()">смены</button>
    </div>
  `;
}

function showOrdersList() {
  document.body.innerHTML = `
    <div class="screen">
      <h2>список заказов</h2>
      <input type="text" id="searchInput" placeholder="поиск по номеру заказа" style="padding: 10px; width: 100%; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px;">
      <div id="allOrdersList"></div>
      <button onclick="createOrderForm()">создать новый</button>
      <button onclick="showMainScreen()">назад</button>
    </div>
  `;

  // Поиск
  document.getElementById("searchInput").addEventListener("input", function() {
    const query = this.value.trim().toLowerCase();
    if (query) {
      searchOrders(query);
    } else {
      displayOrdersGroupedByDate();
    }
  });

  displayOrdersGroupedByDate();
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
      item.onclick = () => showOrderDetails(order.ID);
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
      item.onclick = () => showOrderDetails(order.ID);
      container.appendChild(item);
    });
  }
}

function createOrderForm() {
  document.body.innerHTML = `
    <div class="screen">
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
      <button onclick="saveOrder()">создать</button>
      <button onclick="showOrdersList()">назад</button>
    </div>
  `;
}

async function saveOrder() {
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
    await loadData();
    showOrdersList();
  } catch (e) {
    alert('Ошибка сохранения заказа');
  }
}

function showOrderDetails(orderId) {
  const order = data.orders.find(o => o.ID === orderId);
  if (!order) return;

  document.body.innerHTML = `
    <div class="screen">
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
    document.body.innerHTML += `<p>цена: ${Math.round(parseFloat(order.Price) * 100) / 100}₽</p>`;
  } else {
    document.body.innerHTML += `<button onclick="finishOrder('${orderId}')">завершить</button>`;
  }

  document.body.innerHTML += `
      <button onclick="deleteOrder('${orderId}')">удалить</button>
      <button onclick="showOrdersList()">назад</button>
    </div>
  `;
}

async function deleteOrder(orderId) {
  if (confirm("Вы уверены, что хотите удалить этот заказ?")) {
    try {
      await fetch(`${API_URL}?action=deleteOrder&id=${orderId}`, {
        method: 'POST'
      });
      alert("Заказ удалён");
      await loadData();
      showOrdersList();
    } catch (e) {
      alert('Ошибка удаления');
    }
  }
}

async function finishOrder(orderId) {
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

  try {
    await fetch(`${API_URL}?action=updateOrderStatus&id=${orderId}&status=closed`, {
      method: 'POST'
    });
    alert(`Заказ завершён. Цена: ${price}₽`);
    await loadData();
    showOrderDetails(orderId);
  } catch (e) {
    alert('Ошибка завершения заказа');
  }
}

function showShiftsScreen() {
  document.body.innerHTML = `
    <div class="screen">
      <h2>введите дату</h2>
      <input type="date" id="dateInput" value="${new Date().toISOString().split('T')[0]}">
      <button onclick="showOrdersForDay()">показать</button>
      <div id="ordersOfDay"></div>
      <div id="totalOfDay"></div>
      <button onclick="showMainScreen()">назад</button>
    </div>
  `;
}

function showOrdersForDay() {
  const date = document.getElementById("dateInput").value;
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
