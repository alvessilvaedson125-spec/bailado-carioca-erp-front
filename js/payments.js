(function(){

let paymentsCache = [];
let currentPage = 1;
const PAGE_SIZE = 15;

function safeSetText(id, value){
  const el = document.getElementById(id);
  if(el) el.innerText = value;
}

async function generatePayments() {

  const monthRaw = document.getElementById("competence-month")?.value;
  const yearRaw  = document.getElementById("competence-year")?.value;

  const month = monthRaw && monthRaw.trim() !== ""
    ? Number(monthRaw)
    : new Date().getMonth() + 1;

  const year = yearRaw && yearRaw.trim() !== ""
    ? Number(yearRaw)
    : new Date().getFullYear();

  if (month < 1 || month > 12) {
    Toast.error("Mês inválido");
    return;
  }

  if (year < 2020 || year > 2100) {
    Toast.error("Ano inválido");
    return;
  }

  try {

    const data = await apiRequest(
      "/api/v1/payments/generate",
      "POST",
      {
        competence_month: month,
        competence_year: year
      }
    );

    if (data.generated === 0) {
      Toast.warning(`Nenhuma nova mensalidade (${data.skipped} já existiam)`);
    } else {
      Toast.success(`${data.generated} geradas, ${data.skipped} ignoradas`);
    }

    await loadPayments();

  } catch (err) {
    Toast.error(err.message);
  }
}

function renderStatus(status){
  if(status === "paid")    return "<span class='status status-paid'>Pago</span>"
  if(status === "overdue") return "<span class='status status-overdue'>Vencido</span>"
  return "<span class='status status-pending'>Pendente</span>"
}

async function loadPayments() {

  const tbody = document.getElementById("payments-body");
  if(!tbody) return;

  const month = document.getElementById("filter-month")?.value;
  const year  = document.getElementById("filter-year")?.value;

  let url = "/api/v1/payments";
  const params = [];

  if (month) params.push(`competence_month=${month}`);
  if (year)  params.push(`competence_year=${year}`);
  if (params.length > 0) url += "?" + params.join("&");

  try {
    const res = await apiRequest(url);
    paymentsCache = res.data || [];
  } catch (err) {
    console.error(err);
    return;
  }

  currentPage = 1;
  renderPaymentsPage();

  await loadFinancialSummary(month, year);
  await loadCashflow();
}

// ===============================
// RENDER PÁGINA
// ===============================

function renderPaymentsPage(){
  const tbody = document.getElementById("payments-body");
  if(!tbody) return;

  tbody.innerHTML = "";

  if(paymentsCache.length === 0){
    tbody.innerHTML = `<tr><td colspan="6">Nenhum pagamento encontrado</td></tr>`;
    renderPagination(0);
    return;
  }

  const totalPages = Math.ceil(paymentsCache.length / PAGE_SIZE);
  if(currentPage > totalPages) currentPage = 1;

  const start = (currentPage - 1) * PAGE_SIZE;
  const end   = start + PAGE_SIZE;
  const page  = paymentsCache.slice(start, end);

  page.forEach(p => {

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
         ? `<button class="btn-mark-paid">Marcar pago</button>`
         : `<span class="paid-label">✓ Pago</span>`
        }
      </td>
    `;

    const markBtn = tr.querySelector(".btn-mark-paid");
    if(markBtn){
      markBtn.onclick = () => markAsPaid(p.id, markBtn);
    }

    tbody.appendChild(tr);
  });

  renderPagination(paymentsCache.length);
}

// ===============================
// PAGINAÇÃO
// ===============================

function renderPagination(total){

  let container = document.getElementById("paymentsPagination");

  if(!container){
    container = document.createElement("div");
    container.id = "paymentsPagination";
    container.className = "pagination";
    const table = document.getElementById("payments-body")?.closest("table");
    if(table) table.after(container);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if(totalPages <= 1){
    container.innerHTML = "";
    return;
  }

  const start = ((currentPage - 1) * PAGE_SIZE) + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, total);

  container.innerHTML = `
    <div class="pagination-info">${start}–${end} de ${total} pagamentos</div>
    <div class="pagination-controls">
      <button class="pagination-btn" id="paymentsPrev" ${currentPage === 1 ? "disabled" : ""}>← Anterior</button>
      <span class="pagination-page">${currentPage} / ${totalPages}</span>
      <button class="pagination-btn" id="paymentsNext" ${currentPage === totalPages ? "disabled" : ""}>Próximo →</button>
    </div>
  `;

  document.getElementById("paymentsPrev").onclick = () => {
    if(currentPage > 1){
      currentPage--;
      renderPaymentsPage();
    }
  };

  document.getElementById("paymentsNext").onclick = () => {
    if(currentPage < totalPages){
      currentPage++;
      renderPaymentsPage();
    }
  };

}

// ===============================
// MARK AS PAID
// ===============================

async function markAsPaid(id, button) {

  try {

    button.disabled = true;
    button.innerText = "Processando...";

    await apiRequest(`/api/v1/payments/${id}`, 'PATCH');

    Toast.success("Pagamento confirmado!");
    await loadPayments();

  } catch (error) {

    console.error(error);
    Toast.error("Erro ao confirmar pagamento");
    button.disabled = false;
    button.innerText = "Marcar pago";

  }
}

// ===============================
// FINANCIAL SUMMARY
// ===============================

async function loadFinancialSummary(month, year) {

  try {

    let url = '/api/v1/payments/summary';
    const params = [];

    if (month) params.push(`competence_month=${month}`);
    if (year)  params.push(`competence_year=${year}`);
    if (params.length > 0) url += "?" + params.join("&");

    const res  = await apiRequest(url);
    const data = res.data;

    safeSetText('total-expected', `R$ ${data.total_expected}`);
    safeSetText('total-paid',     `R$ ${data.total_paid}`);
    safeSetText('total-pending',  `R$ ${data.total_pending}`);
    safeSetText('total-overdue',  `R$ ${data.total_overdue}`);

  } catch (error) {
    console.error(error);
  }
}

// ===============================
// CASHFLOW
// ===============================

async function loadCashflow(){

  try{

    const res  = await apiRequest("/api/v1/payments");
    const list = res.data || [];

    const today = new Date();

    let todayTotal = 0;
    let monthTotal = 0;

    list.forEach(p => {

      if(p.computed_status !== "paid") return;

      const paidDate = new Date(p.updated_at || p.created_at);

      const isToday = paidDate.toDateString() === today.toDateString();

      const isThisMonth =
        paidDate.getMonth() === today.getMonth() &&
        paidDate.getFullYear() === today.getFullYear();

      if(isToday)     todayTotal += Number(p.final_amount || 0);
      if(isThisMonth) monthTotal += Number(p.final_amount || 0);

    });

    safeSetText("cash-today", "R$ " + todayTotal.toFixed(2));
    safeSetText("cash-month", "R$ " + monthTotal.toFixed(2));

  }catch(err){
    console.error("Erro no caixa", err);
  }

}

// ===============================
// INIT
// ===============================

async function init(){
  console.log("Payments module iniciado");
  await loadPayments();
}

window.PaymentsModule = {
  init,
  generatePayments,
  loadPayments,
  markAsPaid
};

})();