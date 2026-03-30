(function(){

let allEntries = [];
let currentEntries = [];
let visibleItems = 5;

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

    // Remove cancelados
    allEntries = rawData.filter(e => e.status !== "cancelled");

    let totalIn  = 0;
    let totalOut = 0;

    allEntries.forEach(e => {
      const amount = Number(e.amount);
      if (e.type === "in") totalIn  += amount;
      else                 totalOut += amount;
    });

    const saldo = totalIn - totalOut;

    safeSetText("cash-balance", fmt(saldo));
    safeSetText("cash-in",      fmt(totalIn));
    safeSetText("cash-out",     fmt(totalOut));

    // Cor do saldo
    const balanceEl = document.getElementById("cash-balance");
    if(balanceEl) balanceEl.style.color = saldo >= 0 ? "#16a34a" : "#dc2626";

    currentEntries = allEntries;
    visibleItems = 5;
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

  const sliced = data.slice(0, visibleItems);

  if (sliced.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">Nenhuma movimentação encontrada</td>
      </tr>
    `;
    renderShowMoreButton(0);
    return;
  }

  sliced.forEach(e => {
    const tr = document.createElement("tr");

    const isIn = e.type === "in";

    // 🔥 Badge colorido para tipo
    const typeBadge = isIn
      ? `<span class="cash-type-in">Entrada</span>`
      : `<span class="cash-type-out">Saída</span>`;

    // 🔥 Valor com cor
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

  renderShowMoreButton(data.length);
}
// ===============================
// SHOW MORE
// ===============================

function renderShowMoreButton(total) {

  const container = document.getElementById("cash-show-more-container");
  if (!container) return;

  container.innerHTML = "";

  if(total === 0) return;

  const btn = document.createElement("button");
  btn.className = "btn-secondary";
  btn.style.marginTop = "10px";

  if (visibleItems >= total) {
    btn.innerText = `Mostrar menos (${total}/${total})`;
    btn.onclick = () => {
      visibleItems = 5;
      renderTable(currentEntries);
    };
  } else {
    btn.innerText = `Mostrar mais (${visibleItems}/${total})`;
    btn.onclick = () => {
      visibleItems += 5;
      renderTable(currentEntries);
    };
  }

  container.appendChild(btn);
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
  visibleItems = 5;
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
// EVENTS
// ===============================

document.addEventListener("input", (e) => {
  if (e.target.id === "filter-text") applyFilters();
});

document.addEventListener("change", (e) => {
  if (e.target.id === "filter-type") applyFilters();
});

document.addEventListener("click", (e) => {
  if (e.target.id === "clear-filters") clearFilters();
});

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