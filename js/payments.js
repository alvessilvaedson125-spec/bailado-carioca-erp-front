(function(){

async function generatePayments() {

  const month =
    document.getElementById("competence-month").value ||
    new Date().getMonth() + 1;

  const year =
    document.getElementById("competence-year").value ||
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
  Toast.warning(`Nenhuma nova mensalidade gerada (${data.skipped} já existiam)`);
} else {
  Toast.success(`${data.generated} mensalidades geradas (${data.skipped} ignoradas)`);
}
  await loadPayments();
  await loadFinancialSummary();

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

  const month = document.getElementById("filter-month").value;
  const year = document.getElementById("filter-year").value;

  let url = "/api/v1/payments";

  const params = [];

  if (month) params.push(`competence_month=${month}`);
  if (year) params.push(`competence_year=${year}`);

  if (params.length > 0) {
    url += "?" + params.join("&");
  }

  let data;

try {
  data = await apiRequest(url);
} catch (err) {
  alert(err.message);
  return;
}

  const tbody = document.getElementById("payments-body");
  tbody.innerHTML = "";

  data.data.forEach(p => {

    const tr = document.createElement("tr");

    
    tr.innerHTML = `
      <td>${p.student_name}</td>
      <td>${p.class_name ?? "-"}</td>
     <td>R$ ${Number(p.final_amount).toFixed(2)}</td>
      <td>${p.competence_month}/${p.competence_year}</td>
     <td>${renderStatus(p.computed_status)}</td>
      <td>
      ${p.computed_status !== 'paid' ? `
        <button onclick="PaymentsModule.markAsPaid('${p.id}', this)">
          Marcar pago
        </button>
      ` : `
        <span style="color: green; font-weight: bold;">
          ✓ Pago
        </span>
      `}
    </td>
    `;

    tbody.appendChild(tr);
  });

  // 🔥 NOVO: sincroniza summary com filtro
  await loadFinancialSummary(month, year);
}
async function markAsPaid(id, button) {
  try {
    button.disabled = true;
    button.innerText = "Processando...";
    button.style.opacity = "0.6";

    await apiRequest(`/api/v1/payments/${id}`, 'PATCH');

button.innerText = "Pago";
button.style.opacity = "1";

await loadPayments();

  } catch (error) {
  console.error(error);
  alert(error.message);
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

    document.getElementById('total-expected').innerText =
      `R$ ${data.total_expected}`;

    document.getElementById('total-paid').innerText =
      `R$ ${data.total_paid}`;

    document.getElementById('total-pending').innerText =
      `R$ ${data.total_pending}`;

    document.getElementById('total-overdue').innerText =
      `R$ ${data.total_overdue}`;

  } catch (error) {
    console.error('Erro ao carregar resumo financeiro', error);
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
paidDate.getDate() === today.getDate() &&
paidDate.getMonth() === today.getMonth() &&
paidDate.getFullYear() === today.getFullYear();

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

document.getElementById("cash-today").innerText = "R$ " + todayTotal.toFixed(2)
document.getElementById("cash-month").innerText = "R$ " + monthTotal.toFixed(2)

}catch(err){
console.error("Erro no caixa", err);
}

}

async function init() {
  await loadPayments();
  await loadFinancialSummary();
  await loadCashflow();
}

window.PaymentsModule = {
  init,
  generatePayments,
  loadPayments,
  loadFinancialSummary,
  markAsPaid
};

})();
