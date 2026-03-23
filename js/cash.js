(function(){

let cashEntries = [];
let allEntries = [];

async function createEntry(){
   

  const errorDiv = document.getElementById("cash-error");
  if (errorDiv) errorDiv.innerText = "";

  try {
const type = document.getElementById("cash-type").value;
    const amount = document.getElementById("cash-amount").value;
    const description = document.getElementById("cash-description").value;
    const date = document.getElementById("cash-date").value;

    await apiRequest(
      '/api/v1/cash',
      'POST',
      {
        type,
        amount: Number(amount),
        description,
        date
      }
    );

    if (errorDiv) errorDiv.innerText = "";

    alert("Lançamento criado com sucesso");

    await loadEntries();

  } catch (err) {

    console.error("ERRO:", err);

    if (errorDiv) {
      errorDiv.innerText = err.message || "Erro ao criar lançamento";
    }

  }

 
}

async function loadEntries() {

  const tbody = document.getElementById("cash-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  // 🔥 BUSCA DADOS DA API (FALTAVA ISSO)
  const res = await apiRequest('/api/v1/cash');
  const data = res.data || [];
  allEntries = data;

  let totalIn = 0;
  let totalOut = 0;
  let saldo = 0;

  // 🔥 CÁLCULO
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

  // 🔥 ELEMENTOS
  const inEl = document.getElementById("cash-in");
  const outEl = document.getElementById("cash-out");
  const balanceEl = document.getElementById("cash-balance");

  // 🔥 ENTRADAS
  if (inEl) {
    inEl.innerText = "Entradas: " + totalIn.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  // 🔥 SAÍDAS
  if (outEl) {
    outEl.innerText = "Saídas: " + totalOut.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  // 🔥 SALDO
  if (balanceEl) {

    const valorFormatado = saldo.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

    balanceEl.innerText = "Saldo atual: " + valorFormatado;

    balanceEl.style.color = saldo >= 0 ? "green" : "red";
  }

  console.log("LISTA CASH:", data);

  // 🔥 TABELA
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
    <button class="btn-cancel" onclick="cancelCashEntry(${e.id})">
      Cancelar
    </button>
  </td>
`;

    tbody.appendChild(tr);

  });

}
async function init(){

await loadEntries();

}

document.addEventListener("DOMContentLoaded", () => {
  if (window.location.hash.includes("cash") || document.getElementById("cash-body")) {
    loadEntries();
  }
});

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
    `;

    tbody.appendChild(tr);

  });
}

document.addEventListener("input", (e) => {
  if (e.target.id === "filter-text") applyFilters();
});

document.addEventListener("change", (e) => {
  if (e.target.id === "filter-type") applyFilters();
});

async function cancelEntry(id) {

  const confirmacao = confirm("Deseja cancelar este lançamento?");
  if (!confirmacao) return;

  try {

    // 👉 FUTURO: endpoint real
    // await apiRequest(`/api/v1/cash/${id}`, 'PATCH', { status: 'cancelled' });

    alert("Cancelamento simulado (backend ainda não implementado)");

    // reload lista
    await loadEntries();

  } catch (err) {
    alert("Erro ao cancelar");
    console.error(err);
  }
}

async function cancelCashEntry(id) {
  if (!confirm("Tem certeza que deseja cancelar este lançamento?")) return;

  try {
    const res = await fetch(`${API_BASE}/cash`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + localStorage.getItem("bc_token")
      },
      body: JSON.stringify({ id })
    });

    const data = await res.json();

    if (data.success) {
      loadCashEntries(); // recarrega lista
    } else {
      alert("Erro ao cancelar");
    }

  } catch (err) {
    console.error(err);
    alert("Erro na requisição");
  }
}

window.CashModule = {
init,
createEntry,
loadEntries
};

})();