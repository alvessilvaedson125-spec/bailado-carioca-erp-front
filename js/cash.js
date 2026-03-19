(function(){

let cashEntries = [];

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

window.CashModule = {
init,
createEntry,
loadEntries
};

})();