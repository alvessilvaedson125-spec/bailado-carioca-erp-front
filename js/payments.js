(function(){

function safeSetText(id, value){
  const el = document.getElementById(id);
  if(el) el.innerText = value;
}

async function generatePayments() {

  const month =
    document.getElementById("competence-month")?.value ||
    new Date().getMonth() + 1;

  const year =
    document.getElementById("competence-year")?.value ||
    new Date().getFullYear();

  try {

    const data = await apiRequest(
      "/api/v1/payments/generate",
      "POST",
      {
        competence_month: Number(month),
        competence_year: Number(year)
      }
    );

    if (data.generated === 0) {
      Toast.warning(`Nenhuma nova mensalidade (${data.skipped})`);
    } else {
      Toast.success(`${data.generated} geradas (${data.skipped} ignoradas)`);
    }

    await loadPayments();

  } catch (err) {
    Toast.error(err.message);
  }
}

function renderStatus(status){

  if(status === "paid"){
    return "<span class='status status-paid'>Pago</span>"
  }

  if(status === "overdue"){
    return "<span class='status status-overdue'>Vencido</span>"
  }

  return "<span class='status status-pending'>Pendente</span>"
}

async function loadPayments() {

  const tbody = document.getElementById("payments-body");
  if(!tbody) return; // 🔒 proteção

  const month = document.getElementById("filter-month")?.value;
  const year = document.getElementById("filter-year")?.value;

  let url = "/api/v1/payments";

  const params = [];

  if (month) params.push(`competence_month=${month}`);
  if (year) params.push(`competence_year=${year}`);

  if (params.length > 0) {
    url += "?" + params.join("&");
  }

  let res;

  try {
    res = await apiRequest(url);
  } catch (err) {
    console.error(err);
    return;
  }

  const data = res.data || [];

  tbody.innerHTML = "";

  const LIMIT = 5;

  data.forEach((p, index) => {

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${p.student_name}</td>
      <td>${p.class_name ?? "-"}</td>
      <td class="col-value">R$ ${Number(p.final_amount).toFixed(2)}</td>
      <td>${String(p.competence_month).padStart(2, '0')}/${p.competence_year}</td>
      <td>${renderStatus(p.computed_status)}</td>
      <td>
        ${
          p.computed_status !== 'paid'
          ? `<button onclick="PaymentsModule.markAsPaid('${p.id}', this)">Marcar pago</button>`
          : `<span style="color: green;">✓ Pago</span>`
        }
      </td>
    `;

    if(index >= LIMIT){
      tr.style.display = 'none';
    }

    tbody.appendChild(tr);
  });

  setupPaymentsToggle();

  await loadFinancialSummary(month, year);
  await loadCashflow();
}

async function markAsPaid(id, button) {

  try {

    button.disabled = true;
    button.innerText = "Processando...";

    await apiRequest(`/api/v1/payments/${id}`, 'PATCH');

    await loadPayments();

  } catch (error) {

    console.error(error);

    button.disabled = false;
    button.innerText = "Marcar pago";

  }
}

async function loadFinancialSummary(month, year) {

  try {

    let url = '/api/v1/payments/summary';

    const params = [];

    if (month) params.push(`competence_month=${month}`);
    if (year) params.push(`competence_year=${year}`);

    if (params.length > 0) {
      url += "?" + params.join("&");
    }

    const res = await apiRequest(url);
    const data = res.data;

    // 🔒 SAFE
    safeSetText('total-expected', `R$ ${data.total_expected}`);
    safeSetText('total-paid', `R$ ${data.total_paid}`);
    safeSetText('total-pending', `R$ ${data.total_pending}`);
    safeSetText('total-overdue', `R$ ${data.total_overdue}`);

  } catch (error) {
    console.error(error);
  }
}

async function loadCashflow(){

  try{

    const res = await apiRequest("/api/v1/payments");
    const list = res.data || [];

    const today = new Date();

    let todayTotal = 0;
    let monthTotal = 0;

    list.forEach(p => {

      if(p.computed_status !== "paid") return;

      const paidDate = new Date(p.updated_at || p.created_at);

      const isToday =
        paidDate.toDateString() === today.toDateString();

      const isThisMonth =
        paidDate.getMonth() === today.getMonth() &&
        paidDate.getFullYear() === today.getFullYear();

      if(isToday){
        todayTotal += Number(p.final_amount || 0);
      }

      if(isThisMonth){
        monthTotal += Number(p.final_amount || 0);
      }

    });

    // 🔒 SAFE
    safeSetText("cash-today", "R$ " + todayTotal.toFixed(2));
    safeSetText("cash-month", "R$ " + monthTotal.toFixed(2));

  }catch(err){
    console.error("Erro no caixa", err);
  }

}

async function init(){

  console.log("Payments module iniciado");

  await loadPayments(); // 🔒 já controla DOM
}

function setupPaymentsToggle() {

  const btn = document.getElementById('toggle-payments');
  const rows = document.querySelectorAll('#payments-body tr');

  if (!btn || rows.length === 0) return;

  const LIMIT = 5;
  let expanded = false;

  if (rows.length <= LIMIT) {
    btn.style.display = "none";
    return;
  }

  function update() {
    rows.forEach((row, index) => {
      row.style.display = (!expanded && index >= LIMIT) ? 'none' : '';
    });

    btn.textContent = expanded ? 'Mostrar menos ▲' : 'Mostrar mais ▼';
  }

  btn.onclick = () => {
    expanded = !expanded;
    update();
  };

  update();
}

window.PaymentsModule = {
  init,
  generatePayments,
  loadPayments,
  markAsPaid
};

})();