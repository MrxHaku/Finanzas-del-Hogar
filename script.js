const storageKey = 'casa-economia';
const months = {
  '2026-08': 'Agosto 2026',
  '2026-09': 'Septiembre 2026',
  '2026-10': 'Octubre 2026',
  '2026-11': 'Noviembre 2026',
  '2026-12': 'Diciembre 2026'
};

let selectedMonth = '2026-08';
let currency = 'COP';
const usdRate = 3150;

const $ = id => document.getElementById(id);
const total = items => items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
const parseMoney = value => Number(String(value).replace(/[^0-9]/g, '')) || 0;
const dayFor = item => Number(item.day) || new Date().getDate();
const money = value => currency === 'COP'
  ? '$' + Math.round(Number(value) || 0).toLocaleString('es-CO')
  : 'US$ ' + Math.round((Number(value) || 0) / usdRate).toLocaleString('en-US');

function readData() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || {};
  } catch (error) {
    return {};
  }
}

function getMonthData() {
  const data = readData();
  data[selectedMonth] ??= { incomes: [], expenses: [], tithePaid: false };
  data[selectedMonth].incomes ??= [];
  data[selectedMonth].expenses ??= [];
  return data;
}

function saveData(data) {
  localStorage.setItem(storageKey, JSON.stringify(data));
}

function escapeHtml(value) {
  const node = document.createElement('div');
  node.textContent = value;
  return node.innerHTML;
}

function formatMoneyInput(input) {
  const amount = parseMoney(input.value);
  input.value = amount ? `$ ${amount.toLocaleString('es-CO')}` : '';
}

function updatePeriodLabels() {
  document.querySelectorAll('.period-copy').forEach(element => {
    element.textContent = months[selectedMonth];
  });
  $('periodLabel').textContent = months[selectedMonth];
  $('flowTitle').textContent = `Resumen de ${months[selectedMonth].split(' ')[0]}`;
}

function render() {
  const data = getMonthData()[selectedMonth];
  const income = total(data.incomes);
  const expenses = total(data.expenses);
  const tithe = income * 0.1;
  const available = Math.max(income - expenses - tithe, 0);
  const used = income ? Math.min((expenses + tithe) / income * 100, 100) : 0;

  updatePeriodLabels();
  $('totalIncome').textContent = money(income);
  $('totalExpenses').textContent = money(expenses);
  $('totalTithe').textContent = money(tithe);
  $('totalAvailable').textContent = money(available);
  $('flowTotal').textContent = money(available);
  $('expenseViewTotal').textContent = money(expenses);
  $('expenseCount').textContent = data.expenses.length;
  $('titheValue').textContent = money(tithe);
  $('tithePaid').checked = Boolean(data.tithePaid);
  $('usageLabel').textContent = `${Math.round(used)}%`;
  $('usageBar').style.width = `${used}%`;
  $('titheNote').textContent = income
    ? 'El diezmo se calcula automáticamente sobre tus ingresos.'
    : 'Registra tus ingresos para calcular el diezmo.';

  renderIncomeList(data.incomes);
  renderExpenseList(data.expenses);
  renderPie([available, expenses, tithe], ['#7296c8', '#e88fa4', '#f5c978']);
  renderCategories(data.expenses);
  renderWave(data.incomes, data.expenses);
}

function renderIncomeList(incomes) {
  $('incomeList').innerHTML = incomes.length
    ? incomes.map((item, index) => `
      <div class="entry">
        <span>💵 ${escapeHtml(item.name)}<small>Día ${dayFor(item)}</small></span>
        <strong>${money(item.amount)}</strong>
        <button class="remove" data-kind="income" data-index="${index}" aria-label="Eliminar ingreso">×</button>
      </div>`).join('')
    : '<div class="empty">Aún no hay ingresos registrados.</div>';
}

function renderExpenseList(expenses) {
  $('expenseList').innerHTML = expenses.length
    ? expenses.slice().reverse().map((item, index) => `
      <div class="expense-row">
        <span>${item.type} ${escapeHtml(item.name)}<small>${item.category} · día ${dayFor(item)}</small></span>
        <strong>${money(item.amount)}</strong>
        <button class="remove" data-kind="expense" data-index="${expenses.length - 1 - index}" aria-label="Eliminar gasto">×</button>
      </div>`).join('')
    : '<div class="empty">Aún no hay gastos registrados este mes.</div>';
}

function piePoint(angle, radius) {
  const radians = (angle - 90) * Math.PI / 180;
  return {
    x: 95 + radius * Math.cos(radians),
    y: 95 + radius * Math.sin(radians)
  };
}

function piePath(start, end) {
  const first = piePoint(start, 88);
  const last = piePoint(end, 88);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M 95 95 L ${first.x} ${first.y} A 88 88 0 ${largeArc} 1 ${last.x} ${last.y} Z`;
}

function renderPie(values, colors) {
  const totalValue = values.reduce((sum, value) => sum + value, 0) || 1;
  let cursor = 0;
  $('pieSegments').innerHTML = values.map((value, index) => {
    const end = cursor + value / totalValue * 360;
    const segment = `<path class="pie-segment" fill="${colors[index]}" d="${piePath(cursor, end)}"></path>`;
    cursor = end;
    return segment;
  }).join('');
}

function renderCategories(expenses) {
  const categories = {};
  expenses.forEach(item => {
    categories[item.category] = (categories[item.category] || 0) + Number(item.amount);
  });
  const rows = Object.entries(categories).sort((first, second) => second[1] - first[1]);
  const highest = rows[0]?.[1] || 1;
  $('categoryList').innerHTML = rows.length
    ? rows.map(([category, value]) => `
      <div class="category-row">
        <div><span>${category}</span><strong>${money(value)}</strong></div>
        <div class="category-track"><i style="width:${value / highest * 100}%"></i></div>
      </div>`).join('')
    : '<div class="empty">Las categorías aparecerán al guardar gastos.</div>';
}

function renderWave(incomes, expenses) {
  const svg = $('waveChart');
  const width = 900;
  const height = 250;
  const padding = 34;
  const days = 31;
  const x = day => padding + (day - 1) * (width - padding * 2) / (days - 1);
  const countByDay = items => Array.from({ length: days }, (_, index) => (
    items.filter(item => dayFor(item) === index + 1).length
  ));
  const incomeCounts = countByDay(incomes);
  const expenseCounts = countByDay(expenses);
  const maximum = Math.max(1, ...incomeCounts, ...expenseCounts);
  const y = count => height - 35 - count * (height - 70) / maximum;
  const points = values => values.map((value, index) => `${x(index + 1)},${y(value)}`).join(' ');
  const incomeOn = $('showIncomeWave').checked;
  const expenseOn = $('showExpenseWave').checked;
  const labels = Array.from({ length: days }, (_, index) => `
    <text x="${x(index + 1)}" y="${height - 12}" text-anchor="middle">${index + 1}</text>`).join('');

  svg.innerHTML = `
    <line x1="${padding}" y1="${height - 35}" x2="${width - padding}" y2="${height - 35}" stroke="#d8cfd0"/>
    ${labels}
    ${incomeOn ? `<polyline class="wave-income" points="${points(incomeCounts)}"/>` : ''}
    ${expenseOn ? `<polyline class="wave-expense" points="${points(expenseCounts)}"/>` : ''}`;
}

function openView(view) {
  document.querySelectorAll('.view').forEach(item => {
    item.classList.toggle('active', item.id === `view-${view}`);
  });
  document.querySelectorAll('[data-view]').forEach(item => {
    item.classList.toggle('active', item.dataset.view === view);
  });
  render();
}

document.querySelectorAll('.money-input').forEach(input => {
  input.addEventListener('input', () => formatMoneyInput(input));
});

document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => openView(button.dataset.view));
});

document.querySelectorAll('.month-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    selectedMonth = tab.dataset.month;
    document.querySelectorAll('.month-tab').forEach(item => item.classList.toggle('active', item === tab));
    render();
  });
});

$('incomeForm').addEventListener('submit', event => {
  event.preventDefault();
  const amount = parseMoney($('incomeAmount').value);
  const name = $('incomeName').value.trim();
  if (!amount || !name) {
    alert('Escribe el valor y el origen del ingreso.');
    return;
  }
  const data = getMonthData();
  data[selectedMonth].incomes.push({ name, amount, day: new Date().getDate() });
  saveData(data);
  event.target.reset();
  render();
});

$('expenseForm').addEventListener('submit', event => {
  event.preventDefault();
  const amount = parseMoney($('expenseAmount').value);
  const name = $('expenseName').value.trim();
  if (!amount || !name) {
    alert('Escribe el valor y el nombre del gasto.');
    return;
  }
  const data = getMonthData();
  data[selectedMonth].expenses.push({
    name,
    amount,
    type: $('expenseType').value,
    category: $('expenseCategory').value,
    day: new Date().getDate()
  });
  saveData(data);
  event.target.reset();
  render();
});

document.addEventListener('click', event => {
  const button = event.target.closest('.remove');
  if (!button) return;
  const data = getMonthData();
  data[selectedMonth][`${button.dataset.kind}s`].splice(Number(button.dataset.index), 1);
  saveData(data);
  render();
});

$('tithePaid').addEventListener('change', event => {
  const data = getMonthData();
  data[selectedMonth].tithePaid = event.target.checked;
  saveData(data);
});

$('showIncomeWave').addEventListener('change', render);
$('showExpenseWave').addEventListener('change', render);
$('currencyButton').addEventListener('click', () => {
  currency = currency === 'COP' ? 'USD' : 'COP';
  $('currencyLabel').textContent = currency === 'COP' ? 'COP $' : 'USD $';
  render();
});
$('printButton').addEventListener('click', () => window.print());
$('clearButton').addEventListener('click', () => {
  if (!confirm('¿Borrar todos los datos de este mes?')) return;
  const data = readData();
  delete data[selectedMonth];
  saveData(data);
  render();
});
$('downloadButton').addEventListener('click', () => {
  const data = getMonthData()[selectedMonth];
  const income = total(data.incomes);
  const report = `CASA. · ${months[selectedMonth]}\n\nIngresos: ${money(income)}\nGastos: ${money(total(data.expenses))}\nDiezmo: ${money(income * 0.1)}\nDisponible: ${money(Math.max(income - total(data.expenses) - income * 0.1, 0))}`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([report], { type: 'text/plain' }));
  link.download = `reporte-casa-${selectedMonth}.txt`;
  link.click();
});

render();
