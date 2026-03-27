let financeChartInstance = null;

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

  const totalFinanceiroEl = el("dre-total-financeiro");

  const summaryRecebido = el("summary-recebido");
  const summaryProjetado = el("summary-projetado");
  const summaryInad = el("summary-inadimplencia");

  const rankingContainer = el("ranking-classes");

  const formatCurrency = (v) =>
    Number(v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  try {

    const [
      students,
      classes,
      enrollments,
      payments,
      cash,
      byClass
    ] = await Promise.all([
      apiRequest("/api/v1/students"),
      apiRequest("/api/v1/classes"),
      apiRequest("/api/v1/enrollments"),
      apiRequest("/api/v1/payments"),
      apiRequest("/api/v1/cash"),
      apiRequest("/api/v1/payments/by-class")
    ]);

    const studentsData = students?.success ? students.data : [];
    const classesData = classes?.success ? classes.data : [];
    const enrollmentsData = enrollments?.success ? enrollments.data : [];
    const paymentsData = payments?.success ? payments.data : [];
    const cashEntries = cash?.success ? cash.data : [];
    const rankingData = byClass?.success ? byClass.data : [];

    cashData = cashEntries;

    if (studentsEl) studentsEl.innerText = studentsData.length;
    if (classesEl) classesEl.innerText = classesData.length;
    if (enrollmentsEl) enrollmentsEl.innerText = enrollmentsData.length;
    if (paymentsEl) paymentsEl.innerText = paymentsData.length;

    let esperado = 0;
    let recebido = 0;
    let pendente = 0;
    let atrasado = 0;

    const today = new Date();

    paymentsData.forEach(p => {

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

    // 🔥 NOVO KPI CONSOLIDADO
    const totalFinanceiro = recebido + saldo;

    // 🔽 RENDER SEGURO

    if (esperadoEl) esperadoEl.innerText = formatCurrency(esperado);
    if (recebidoEl) recebidoEl.innerText = formatCurrency(recebido);
    if (projetadoEl) projetadoEl.innerText = formatCurrency(projetado);

    if (atrasadoEl) atrasadoEl.innerText = formatCurrency(atrasado);
    if (inadPercentEl) inadPercentEl.innerText = inadPercent.toFixed(1) + "%";

    if (entradasEl) entradasEl.innerText = formatCurrency(entradas);
    if (saidasEl) saidasEl.innerText = formatCurrency(saidas);
    if (saldoEl) saldoEl.innerText = formatCurrency(saldo);

    if (totalFinanceiroEl) {
      totalFinanceiroEl.innerText = formatCurrency(totalFinanceiro);
    }

    if (summaryRecebido) summaryRecebido.innerText = formatCurrency(recebido);
    if (summaryProjetado) summaryProjetado.innerText = formatCurrency(projetado);
    if (summaryInad) summaryInad.innerText = inadPercent.toFixed(1) + "%";

    renderChart(paymentsData);

    if (rankingData.length && rankingContainer) {
      renderRanking(rankingData);
    }

  } catch (e) {

    console.error("Erro dashboard:", e);

    // fallback seguro
    if (totalFinanceiroEl) totalFinanceiroEl.innerText = "R$ 0,00";

  }
}

function renderChart(payments = []) {

  const ctx = document.getElementById("financeChart");
  if (!ctx) return;

  if (financeChartInstance) {
    financeChartInstance.destroy();
  }

  const monthly = {};

  payments.forEach(p => {

   const year = Number(p.competence_year);

// 🔥 sanity check
const safeYear = (year > 2000 && year < 2100) ? year : new Date().getFullYear();

const key = `${safeYear}-${String(p.competence_month).padStart(2, "0")}`;

    if (!monthly[key]) {
      monthly[key] = { esperado: 0, recebido: 0 };
    }

    const v = Number(p.final_amount || 0);

    monthly[key].esperado += v;

    if (p.status === "paid") {
      monthly[key].recebido += v;
    }

  });

  const labels = Object.keys(monthly).sort().slice(-6);

  const esperado = labels.map(m => monthly[m].esperado);
  const recebido = labels.map(m => monthly[m].recebido);

  financeChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Esperado",
          data: esperado,
          backgroundColor: "#3b82f6",
          barThickness: 18
        },
        {
          label: "Recebido",
          data: recebido,
          backgroundColor: "#22c55e",
          barThickness: 18
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { boxWidth: 12 }
        }
      },
      scales: {
        x: { grid: { display: false }},
        y: { beginAtZero: true }
      }
    }
  });
}

function renderRanking(data = []) {

  const container = document.getElementById("ranking-classes");
  if (!container) return;

  const f = (v) =>
    Number(v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });

  const sorted = [...data].sort((a, b) => b.total_received - a.total_received);

  const max = sorted[0]?.total_received || 1;

  container.innerHTML = sorted.map(c => {

    const eficiencia = c.total_expected > 0
      ? (c.total_received / c.total_expected) * 100
      : 0;

    const width = (c.total_received / max) * 100;

    return `
      <div class="ranking-item">
        <div class="ranking-header">
          <span>${c.class_name}</span>
          <strong>${f(c.total_received)}</strong>
        </div>

        <div class="ranking-bar">
          <div class="ranking-fill" style="width:${width}%"></div>
        </div>

        <small>${eficiencia.toFixed(0)}% de eficiência</small>
      </div>
    `;
  }).join("");
}

window.DashboardModule = { init };

})();