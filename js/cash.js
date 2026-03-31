(function(){

let allEntries     = [];
let currentEntries = [];
let currentPage    = 1;
const PAGE_SIZE    = 10;

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date)) return "-";
  return date.toLocaleDateString("pt-BR");
}

function fmt(v){
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function safeSetText(id, value){
  const el = document.getElementById(id);
  if(el) el.innerText = value;
}

// ===============================
// INIT
// ===============================

async function init(){
  console.log("Cash module iniciado");

  // 🔥 eventos registrados aqui, não globalmente
  const filterType  = document.getElementById("filter-type");
  const filterText  = document.getElementById("filter-text");
  const clearBtn    = document.getElementById("clear-filters");
  const saveBtn     = document.getElementById("cash-save-btn");
  const clearFormBtn = document.getElementById("cash-clear-btn");

  if(filterType)    filterType.addEventListener("change", applyFilters);
  if(filterText)    filterText.addEventListener("input",  applyFilters);
  if(clearBtn)      clearBtn.onclick    = clearFilters;
  if(saveBtn)       saveBtn.onclick     = createEntry;
  if(clearFormBtn)  clearFormBtn.onclick = clearForm;

  await loadEntries();
}

// ===============================
// LOAD
// ===============================

async function loadEntries() {

  const tbody = document.getElementById("cash-body");
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;

  try {

    const res = await apiRequest("/api/v1/cash", "GET");
    const rawData = res?.data || [];

    allEntries = rawData.filter(e => e.status !== "cancelled");

    // 🔥 Saldo acumulado — tudo histórico
    let totalInAll  = 0;
    let totalOutAll = 0;

    allEntries.forEach(e => {
      const amount = Number(e.amount);
      if (e.type === "in") totalInAll  += amount;
      else                 totalOutAll += amount;
    });

    const saldo = totalInAll - totalOutAll;

    // 🔥 Entradas/Saídas apenas do mês atual
    const now       = new Date();
    const thisYear  = now.getFullYear();
    const thisMonth = now.getMonth(); // 0-indexed

    let totalInMonth  = 0;
    let totalOutMonth = 0;

    allEntries.forEach(e => {
      const entryDate = new Date(e.date || e.created_at);
      const sameMonth = entryDate.getFullYear() === thisYear &&
                        entryDate.getMonth()    === thisMonth;

      if(!sameMonth) return;

      const amount = Number(e.amount);
      if(e.type === "in") totalInMonth  += amount;
      else                totalOutMonth += amount;
    });

    // 🔥 Saldo acumulado
    safeSetText("cash-balance", fmt(saldo));

    // 🔥 Entradas/Saídas do mês corrente
    safeSetText("cash-in",  fmt(totalInMonth));
    safeSetText("cash-out", fmt(totalOutMonth));

    const balanceEl = document.getElementById("cash-balance");
    if(balanceEl) balanceEl.style.color = saldo >= 0 ? "#16a34a" : "#dc2626";

    currentEntries = allEntries;
    currentPage    = 1;
    renderTable(allEntries);

  } catch (err) {
    console.error("Erro ao carregar caixa:", err);
    tbody.innerHTML = `<tr><td colspan="5">Erro ao carregar dados</td></tr>`;
  }
}

// ===============================
// CREATE ENTRY
// ===============================

async function createEntry(){

  const errorDiv = document.getElementById("cash-error");
  if (errorDiv) errorDiv.innerText = "";

  const type        = document.getElementById("cash-type")?.value;
  const amount      = document.getElementById("cash-amount")?.value;
  const description = document.getElementById("cash-description")?.value;
  const date        = document.getElementById("cash-date")?.value;

  if (!type) {
    Toast.warning("Selecione o tipo");
    return;
  }

  if (!date) {
    Toast.warning("Informe a data");
    return;
  }

  if (!amount || Number(amount) <= 0) {
    Toast.warning("Informe um valor válido");
    return;
  }

  if (!description || description.trim() === "") {
    Toast.warning("Informe a descrição");
    return;
  }

  try {

    await apiRequest("/api/v1/cash", "POST", {
      type,
      amount: Number(amount),
      description,
      date
    });

    Toast.success("Lançamento criado!");
    clearForm();
    await loadEntries();

  } catch (err) {
    console.error("ERRO:", err);
    Toast.error(err.message || "Erro ao criar lançamento");
  }
}

// ===============================
// CANCEL ENTRY
// ===============================

async function cancelCashEntry(id) {
  if (!confirm("Cancelar esta movimentação?")) return;

  try {

    await apiRequest("/api/v1/cash/cancel", "POST", { id });

    Toast.success("Movimentação cancelada!");
    await loadEntries();

  } catch (err) {
    console.error(err);
    Toast.error("Erro ao cancelar movimentação");
  }
}

// ===============================
// RENDER TABLE
// ===============================

function renderTable(data) {
  const tbody = document.getElementById("cash-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  if(data.length === 0){
    tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhuma movimentação encontrada</td></tr>`;
    renderPagination(0);
    return;
  }

  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  if(currentPage > totalPages) currentPage = 1;

  const start = (currentPage - 1) * PAGE_SIZE;
  const end   = start + PAGE_SIZE;
  const page  = data.slice(start, end);

  page.forEach(e => {
    const tr = document.createElement("tr");

    const isIn = e.type === "in";

    const typeBadge = isIn
      ? `<span class="cash-type-in">Entrada</span>`
      : `<span class="cash-type-out">Saída</span>`;

    const valueClass = isIn ? "cash-value-in" : "cash-value-out";
    const valueSign  = isIn ? "+" : "-";

    tr.innerHTML = `
      <td>${formatDate(e.date || e.created_at)}</td>
      <td>${typeBadge}</td>
      <td class="${valueClass}">${valueSign} ${fmt(e.amount)}</td>
      <td>${e.description || "-"}</td>
      <td>
        <button class="btn-cancel-entry">Cancelar</button>
      </td>
    `;

    tr.querySelector(".btn-cancel-entry").onclick = () => cancelCashEntry(e.id);
    tbody.appendChild(tr);
  });

  renderPagination(data.length);
}

// ===============================
// PAGINAÇÃO
// ===============================

function renderPagination(total){

  const container = document.getElementById("cash-show-more-container");
  if(!container) return;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if(totalPages <= 1){
    container.innerHTML = "";
    return;
  }

  const start = ((currentPage - 1) * PAGE_SIZE) + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, total);

  container.innerHTML = `
    <div class="pagination">
      <div class="pagination-info">${start}–${end} de ${total} movimentações</div>
      <div class="pagination-controls">
        <button class="pagination-btn" id="cashPrev" ${currentPage === 1 ? "disabled" : ""}>← Anterior</button>
        <span class="pagination-page">${currentPage} / ${totalPages}</span>
        <button class="pagination-btn" id="cashNext" ${currentPage === totalPages ? "disabled" : ""}>Próximo →</button>
      </div>
    </div>
  `;

  document.getElementById("cashPrev").onclick = () => {
    if(currentPage > 1){ currentPage--; renderTable(currentEntries); }
  };

  document.getElementById("cashNext").onclick = () => {
    if(currentPage < totalPages){ currentPage++; renderTable(currentEntries); }
  };
}

// ===============================
// FILTERS
// ===============================

function applyFilters() {

  const type = document.getElementById("filter-type")?.value;
  const text = document.getElementById("filter-text")?.value.toLowerCase();

  const filtered = allEntries.filter(e => {
    const matchType = !type || e.type === type;
    const matchText = !text || (e.description || "").toLowerCase().includes(text);
    return matchType && matchText;
  });

  currentEntries = filtered;
  currentPage    = 1;
  renderTable(filtered);
}

function clearFilters() {
  const typeEl = document.getElementById("filter-type");
  const textEl = document.getElementById("filter-text");
  if (typeEl) typeEl.value = "";
  if (textEl) textEl.value = "";
  applyFilters();
}

// ===============================
// CLEAR FORM
// ===============================

function clearForm() {
  const fields = ["cash-date", "cash-type", "cash-amount", "cash-description"];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const errorDiv = document.getElementById("cash-error");
  if (errorDiv) errorDiv.innerText = "";
}

// ===============================
// EXPORTS
// ===============================

window.CashModule = {
  init,
  createEntry,
  loadEntries
};

window.cancelCashEntry = cancelCashEntry;
window.clearForm = clearForm;

})();