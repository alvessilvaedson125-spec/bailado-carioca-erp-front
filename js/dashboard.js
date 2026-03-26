let cashData = [];

(function () {
async function init() {

  if (!document.getElementById("financeChart")) return;

  const el = (id) => document.getElementById(id);

  const studentsEl = el("metric-students");
  const classesEl = el("metric-classes");
  const enrollmentsEl = el("metric-enrollments");
  const paymentsEl = el("metric-payments");

  const esperadoEl = el("dre-esperado");
  const recebidoEl = el("dre-recebido");
  const projetadoEl = el("dre-projetado");

  const atrasadoEl = el("dre-atrasado");
  const inadPercentEl = el("dre-inadimplencia-percent");

  const entradasEl = el("dre-entradas");
  const saidasEl = el("dre-saidas");
  const saldoEl = el("dre-saldo");

  const summaryRecebido = el("summary-recebido");
  const summaryProjetado = el("summary-projetado");
  const summaryInad = el("summary-inadimplencia");

  try {

    const [students, classes, enrollments, payments, cash] = await Promise.all([
      apiRequest("/api/v1/students"),
      apiRequest("/api/v1/classes"),
      apiRequest("/api/v1/enrollments"),
      apiRequest("/api/v1/payments"),
      apiRequest("/api/v1/cash")
    ]);

    cashData = cash.data || [];

    if (students.success) studentsEl.innerText = students.data.length;
    if (classes.success) classesEl.innerText = classes.data.length;
    if (enrollments.success) enrollmentsEl.innerText = enrollments.data.length;
    if (payments.success) paymentsEl.innerText = payments.data.length;

    let esperado = 0;
    let recebido = 0;
    let pendente = 0;
    let atrasado = 0;

    const today = new Date();

    payments.data.forEach(p => {

      const value = Number(p.final_amount || 0);
      esperado += value;

      if (p.status === "paid") recebido += value;

      if (p.status === "pending") {
        const due = new Date(p.due_date);
        if (due < today) atrasado += value;
        else pendente += value;
      }
    });

    const projetado = recebido + pendente;

    const inadPercent = esperado > 0
      ? (atrasado / esperado) * 100
      : 0;

    let entradas = 0;
    let saidas = 0;

    cashData.forEach(e => {
      const v = Number(e.amount || 0);
      if (e.type === "in") entradas += v;
      if (e.type === "out") saidas += v;
    });

    const saldo = entradas - saidas;

    const f = (v) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    esperadoEl.innerText = f(esperado);
    recebidoEl.innerText = f(recebido);
    projetadoEl.innerText = f(projetado);

    atrasadoEl.innerText = f(atrasado);
    inadPercentEl.innerText = inadPercent.toFixed(1) + "%";

    entradasEl.innerText = f(entradas);
    saidasEl.innerText = f(saidas);
    saldoEl.innerText = f(saldo);

    // ✅ SUMMARY FIX
    summaryRecebido.innerText = f(recebido);
    summaryProjetado.innerText = f(projetado);
    summaryInad.innerText = inadPercent.toFixed(1) + "%";

    renderChart(payments.data);

  } catch (e) {
    console.error("Erro dashboard:", e);
  }
}

function renderChart(payments = []) {

  const ctx = document.getElementById("financeChart");
  if (!ctx) return;

  const monthly = {};

  payments.forEach(p => {

    const key = `${p.competence_year}-${String(p.competence_month).padStart(2, "0")}`;

    if (!monthly[key]) {
      monthly[key] = { esperado: 0, recebido: 0 };
    }

    const v = Number(p.final_amount || 0);

    monthly[key].esperado += v;
    if (p.status === "paid") monthly[key].recebido += v;

  });

  const labels = Object.keys(monthly).sort();

  const esperado = labels.map(m => monthly[m].esperado);
  const recebido = labels.map(m => monthly[m].recebido);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Esperado",
          data: esperado,
          backgroundColor: "#3b82f6",
          barThickness: 20
        },
        {
          label: "Recebido",
          data: recebido,
          backgroundColor: "#22c55e",
          barThickness: 20
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false }
        },
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

window.DashboardModule = { init };

})();