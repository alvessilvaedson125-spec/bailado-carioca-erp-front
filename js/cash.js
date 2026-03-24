(function(){

 

let allEntries = [];

async function createEntry(){

  const errorDiv = document.getElementById("cash-error");
  if (errorDiv) errorDiv.innerText = "";

  try {
    let type = document.getElementById("cash-type").value;
    type = type === "Entrada" ? "in" : "out";

    const amount = document.getElementById("cash-amount").value;
    const description = document.getElementById("cash-description").value;
    const date = document.getElementById("cash-date").value;
await apiRequest(`/api/v1/cash`, 'POST',
      {
        type,
        amount: Number(amount),
        description,
        date
      }
    );

    alert("Lançamento criado com sucesso");

    clearForm();

    await loadEntries();

  } catch (err) {
    console.error("ERRO:", err);

    if (errorDiv) {
      errorDiv.innerText = err.message || "Erro ao criar lançamento";
    }
  }
}

function clearForm() {
  const dateEl = document.getElementById("cash-date");
  const typeEl = document.getElementById("cash-type");
  const amountEl = document.getElementById("cash-amount");
  const descEl = document.getElementById("cash-description");

  if (dateEl) dateEl.value = "";
  if (typeEl) typeEl.value = "in"; // padrão
  if (amountEl) amountEl.value = "";
  if (descEl) descEl.value = "";
}

async function loadEntries() {

  const tbody = document.getElementById("cash-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  try {

    // ✅ GET CORRETO
  const res = await  apiRequest(`/api/v1/cash`, 'GET')

    const rawData = res?.data || [];

    // ✅ REMOVE CANCELADOS
    const data = rawData.filter(e => e.status !== "cancelled");

    allEntries = data;

    let totalIn = 0;
    let totalOut = 0;
    let saldo = 0;

    data.forEach(e => {
      const amount = Number(e.amount);

      if (e.type === "in") {
        totalIn += amount;
        saldo += amount;
      } else if (e.type === "out") {
        totalOut += amount;
        saldo -= amount;
      }
    });

    // 🔢 ATUALIZA CARDS
    const inEl = document.getElementById("cash-in");
    const outEl = document.getElementById("cash-out");
    const balanceEl = document.getElementById("cash-balance");

    if (inEl) {
      inEl.innerText = totalIn.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    }

    if (outEl) {
      outEl.innerText = totalOut.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });
    }

    if (balanceEl) {
      const valorFormatado = saldo.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
      });

      balanceEl.innerText = valorFormatado;
      balanceEl.style.color = saldo >= 0 ? "green" : "red";
    }

    // 📋 TABELA
    data.forEach(e => {

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${new Date(e.created_at).toLocaleDateString()}</td>
        <td>${e.type === "in" ? "Entrada" : "Saída"}</td>
        <td>${Number(e.amount).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL"
        })}</td>
        <td>${e.description || ""}</td>
        <td>
          <button class="btn-cancel" onclick="cancelCashEntry('${e.id}')">
            Cancelar
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });

  } catch (err) {
    console.error("Erro ao carregar caixa:", err);

    const errorMsg = document.getElementById("cash-error");
    if (errorMsg) {
      errorMsg.innerText = "Erro ao carregar dados";
    }
  }
}

async function init(){
  await loadEntries();
}

// 🔁 AUTO LOAD
document.addEventListener("DOMContentLoaded", () => {
  if (window.location.hash.includes("cash") || document.getElementById("cash-body")) {
    loadEntries();
  }
});

document.addEventListener("click", (e) => {
  if (e.target.id === "clear-filters") {
    clearFilters();
  }
});

// 🔍 FILTROS
function applyFilters() {

  const type = document.getElementById("filter-type")?.value;
  const text = document.getElementById("filter-text")?.value.toLowerCase();

  const tbody = document.getElementById("cash-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  const filtered = allEntries.filter(e => {

    const matchType = !type || e.type === type;

    const matchText =
      !text ||
      (e.description || "").toLowerCase().includes(text);

    return matchType && matchText;
  });

  if (filtered.length === 0) {
  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center; padding:16px; color:#888;">
        Nenhuma movimentação encontrada
      </td>
    </tr>
  `;
  return;
}
  filtered.forEach(e => {

    const tr = document.createElement("tr");
tr.innerHTML = `
  <td>${new Date(e.created_at).toLocaleDateString()}</td>
  <td>${e.type === "in" ? "Entrada" : "Saída"}</td>
  <td>${Number(e.amount).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  })}</td>
  <td>${e.description || ""}</td>
  <td>
    <button class="btn-cancel" onclick="cancelCashEntry('${e.id}')">
      Cancelar
    </button>
  </td>
`;

    tbody.appendChild(tr);
  });
}

// 🎯 LISTENERS
document.addEventListener("input", (e) => {
  if (e.target.id === "filter-text") applyFilters();
});

document.addEventListener("change", (e) => {
  if (e.target.id === "filter-type") applyFilters();
});

// ❌ CANCELAR
async function cancelCashEntry(id) {
  if (!confirm("Cancelar esta movimentação?")) return;

  try {
   const res = await fetch(`https://bailado-carioca-escola-api.alvessilvaedson125.workers.dev/api/v1/cash/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("bc_token")}`
      },
      body: JSON.stringify({ id })
    });

    if (!res.ok) {
      throw new Error("Erro na requisição");
    }

    try { await res.json(); } catch (e) {}

    alert("Movimentação cancelada");

    await window.CashModule.loadEntries();

  } catch (err) {
    console.error(err);
    alert("Erro ao cancelar");
  }
}

function clearFilters() {
  const typeEl = document.getElementById("filter-type");
  const textEl = document.getElementById("filter-text");

  if (typeEl) typeEl.value = "";
  if (textEl) textEl.value = "";

  applyFilters();
}

// ✅ REGISTRO DO MÓDULO (CRÍTICO)
window.CashModule = {
  init,
  createEntry,
  loadEntries
};

window.cancelCashEntry = cancelCashEntry;
window.clearForm = clearForm;

})();