let cashData = [];

(function () {

  async function init() {

    if (!document.getElementById("financeChart")) return;

    const el = (id) => document.getElementById(id);

    const studentsEl = el("metric-students");
    const classesEl = el("metric-classes");
    const enrollmentsEl = el("metric-enrollments");
    const paymentsEl = el("metric-payments");

    const receitaEl = el("dre-receita");
    const recebidoEl = el("dre-recebido");
const projetadoEl = el("dre-projetado");

const atrasadoEl = el("dre-atrasado");
const inadimplenciaEl = el("dre-inadimplencia");

const entradasEl = el("dre-entradas");
const saidasEl = el("dre-saidas");
    const despesaEl = el("dre-despesa");
    const resultadoEl = el("dre-resultado");

    try {

      // =============================
      // REQUESTS
      // =============================
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
      // FINANCEIRO (PAYMENTS)
      // =============================
      let totalExpected = 0;
      let totalReceived = 0;
      let totalPending = 0;
      let totalLate = 0;

      let revenueByClass = {};

      const today = new Date();

      if (payments.success && Array.isArray(payments.data)) {

        payments.data.forEach(p => {

          const value = Number(p.final_amount || 0);
          const className = p.class_name || "Sem turma";

          totalExpected += value;

          if (!revenueByClass[className]) {
            revenueByClass[className] = 0;
          }

          revenueByClass[className] += value;

          if (p.status === "paid") {
            totalReceived += value;
          }

          if (p.status === "pending") {
            const due = new Date(p.due_date);

            if (due < today) {
              totalLate += value;
            } else {
              totalPending += value;
            }
          }

        });
      }

      // =============================
      // INADIMPLÊNCIA
      // =============================
      const delinquencyRate = totalExpected > 0
        ? (totalLate / totalExpected) * 100
        : 0;

      // =============================
      // CAIXA
      // =============================
      let totalIn = 0;
      let totalOut = 0;

      cashData.forEach(e => {
        const amount = Number(e.amount || 0);
        if (e.type === "in") totalIn += amount;
        if (e.type === "out") totalOut += amount;
      });

      const balance = totalIn - totalOut;

      // =============================
      // PROJEÇÃO DO MÊS
      // =============================
      const projectedRevenue = totalReceived + totalPending;

      // =============================
      // FORMAT
      // =============================
      const formatCurrency = (v) =>
        v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

     
// RECEITA
// =============================
if (receitaEl) receitaEl.innerText = formatCurrency(totalExpected);
if (recebidoEl) recebidoEl.innerText = formatCurrency(totalReceived);
if (projetadoEl) projetadoEl.innerText = formatCurrency(projectedRevenue);

// =============================
// INADIMPLÊNCIA
// =============================
if (atrasadoEl) atrasadoEl.innerText = formatCurrency(totalLate);
if (inadimplenciaEl) inadimplenciaEl.innerText = delinquencyRate.toFixed(1) + "%";

// =============================
// CAIXA
// =============================
if (entradasEl) entradasEl.innerText = formatCurrency(totalIn);
if (saidasEl) saidasEl.innerText = formatCurrency(totalOut);

if (resultadoEl) {
  resultadoEl.innerText = formatCurrency(balance);
  resultadoEl.style.color = balance >= 0 ? "green" : "red";
}

      // =============================
      // TOP TURMAS
      // =============================
      console.log("Receita por turma:", revenueByClass);

      // =============================
      // CHART (MANTIDO)
      // =============================
      renderChart();

    } catch (e) {
      console.error("Erro dashboard:", e);
    }
  }

  function renderChart() {

    const ctx = document.getElementById("financeChart");
    if (!ctx || !cashData.length) return;

    const monthly = {};

    cashData.forEach(e => {
      const date = new Date(e.created_at);
      const key = date.toISOString().slice(0, 7);

      if (!monthly[key]) monthly[key] = { in: 0, out: 0 };

      const amount = Number(e.amount || 0);

      if (e.type === "in") monthly[key].in += amount;
      if (e.type === "out") monthly[key].out += amount;
    });

    const labels = Object.keys(monthly).sort();

    const receitas = labels.map(m => monthly[m].in);
    const despesas = labels.map(m => monthly[m].out);

    new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Receitas", data: receitas, borderColor: "#22c55e" },
          { label: "Despesas", data: despesas, borderColor: "#ef4444" }
        ]
      }
    });
  }

  window.DashboardModule = { init };

})();