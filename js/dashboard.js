let cashData = [];

(function () {
async function init() {

  if (!document.getElementById("financeChart")) return;

  const el = (id) => document.getElementById(id);

  // =============================
  // ELEMENTOS
  // =============================
  const studentsEl = el("metric-students");
  const classesEl = el("metric-classes");
  const enrollmentsEl = el("metric-enrollments");
  const paymentsEl = el("metric-payments");

  const esperadoEl = el("dre-esperado");
  const recebidoEl = el("dre-recebido");
  const projetadoEl = el("dre-projetado");

  const atrasadoEl = el("dre-atrasado");
  const inadimplenciaPercentEl = el("dre-inadimplencia-percent");

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

    // =============================
    // MÉTRICAS
    // =============================
    if (students.success) studentsEl.innerText = students.data.length;
    if (classes.success) classesEl.innerText = classes.data.length;
    if (enrollments.success) enrollmentsEl.innerText = enrollments.data.length;
    if (payments.success) paymentsEl.innerText = payments.data.length;

    // =============================
    // FINANCEIRO
    // =============================
    let esperado = 0;
    let recebido = 0;
    let pendente = 0;
    let atrasado = 0;

    const today = new Date();

    if (payments.success) {
      payments.data.forEach(p => {

        const value = Number(p.final_amount || 0);
        esperado += value;

        if (p.status === "paid") {
          recebido += value;
        }

        if (p.status === "pending") {
          const due = new Date(p.due_date);
          if (due < today) {
            atrasado += value;
          } else {
            pendente += value;
          }
        }

      });
    }

    const projetado = recebido + pendente;

    const inadPercent = esperado > 0
      ? (atrasado / esperado) * 100
      : 0;

    // =============================
    // CAIXA
    // =============================
    let entradas = 0;
    let saidas = 0;

    cashData.forEach(e => {
      const v = Number(e.amount || 0);
      if (e.type === "in") entradas += v;
      if (e.type === "out") saidas += v;
    });

    const saldo = entradas - saidas;

    // =============================
    // FORMAT
    // =============================
    const f = (v) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // =============================
    // UI PRINCIPAL
    // =============================
    if (esperadoEl) esperadoEl.innerText = f(esperado);
    if (recebidoEl) recebidoEl.innerText = f(recebido);
    if (projetadoEl) projetadoEl.innerText = f(projetado);

    if (atrasadoEl) atrasadoEl.innerText = f(atrasado);
    if (inadimplenciaPercentEl) inadimplenciaPercentEl.innerText = inadPercent.toFixed(1) + "%";

    if (entradasEl) entradasEl.innerText = f(entradas);
    if (saidasEl) saidasEl.innerText = f(saidas);
    if (saldoEl) saldoEl.innerText = f(saldo);

    // =============================
    // SUMMARY
    // =============================
    if (summaryRecebido) summaryRecebido.innerText = f(recebido);
    if (summaryProjetado) summaryProjetado.innerText = f(projetado);
    if (summaryInad) summaryInad.innerText = inadPercent.toFixed(1) + "%";

    // =============================
    // CHART PROFISSIONAL
    // =============================
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

    const date = new Date(p.created_at);
    const key = date.toISOString().slice(0, 7);

    if (!monthly[key]) {
      monthly[key] = {
        esperado: 0,
        recebido: 0
      };
    }

    const v = Number(p.final_amount || 0);
    monthly[key].esperado += v;

    if (p.status === "paid") {
      monthly[key].recebido += v;
    }

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
          backgroundColor: "#3b82f6"
        },
        {
          label: "Recebido",
          data: recebido,
          backgroundColor: "#22c55e"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });
}

  window.DashboardModule = { init };

})();