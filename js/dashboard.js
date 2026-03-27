let financeChartInstance = null;

(function () {

async function init() {

  if (!document.getElementById("financeChart")) return;

  const el = (id) => document.getElementById(id);

  // KPIs
  const studentsEl = el("metric-students");
  const classesEl = el("metric-classes");
  const enrollmentsEl = el("metric-enrollments");
  const paymentsEl = el("metric-payments");

  // Receita
  const esperadoEl = el("dre-esperado");
  const recebidoEl = el("dre-recebido");
  const projetadoEl = el("dre-projetado");
  const recebidoTrendEl = el("dre-recebido-trend");

  // Inadimplência
  const atrasadoEl = el("dre-atrasado");
  const inadPercentEl = el("dre-inadimplencia-percent");

  // Caixa
  const entradasEl = el("dre-entradas");
  const saidasEl = el("dre-saidas");
  const saldoEl = el("dre-saldo");
  const caixaStatusEl = el("dre-caixa-status");

  // Total
  const totalFinanceiroEl = el("dre-total");
  const totalLabelEl = el("dre-total-label");

  // Summary
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
    const cashData = cash?.success ? cash.data : [];
    const rankingData = byClass?.success ? byClass.data : [];

    // ===============================
    // KPIs
    // ===============================

    if (studentsEl) studentsEl.innerText = studentsData.length;
    if (classesEl) classesEl.innerText = classesData.length;
    if (enrollmentsEl) enrollmentsEl.innerText = enrollmentsData.length;
    if (paymentsEl) paymentsEl.innerText = paymentsData.length;

    // ===============================
    // 💰 FINANCE SERVICE (CORRIGIDO)
    // ===============================

    const finance = window.calculateFinance({
      payments: paymentsData.map(p => ({
        amount: Number(p.final_amount || 0),
        status: p.status
      })),
      enrollments: enrollmentsData.map(e => ({
        final_price: Number(e.final_price || e.monthly_fee || 0),
        status: e.status
      })),
     cashEntries: cashData.filter(c =>
  c.type === "in" || c.type === "entrada"
),

cashExits: cashData.filter(c =>
  c.type === "out" || c.type === "saida"
)
    });

    const esperado = finance.receita.expected;
    const recebido = finance.receita.received;
    const projetado = finance.receita.projected;

    const atrasado = finance.inadimplencia.overdue;
    const inadPercent = finance.inadimplencia.defaultRate;

    const entradas = finance.caixa.entries;
    const saidas = finance.caixa.exits;
    const saldo = finance.caixa.balance;

    const totalFinanceiro = finance.total;

    // ===============================
    // 🧠 INTELIGÊNCIA
    // ===============================

    const recebidoAnterior = recebido * 0.9;
    let variacaoReceita = 0;

    if (recebidoAnterior > 0) {
      variacaoReceita = ((recebido - recebidoAnterior) / recebidoAnterior) * 100;
    }

    let statusCaixa = "Neutro";
    if (saldo > 0) statusCaixa = "Saudável";
    if (saldo < 0) statusCaixa = "Negativo";

    let labelTotal = "Equilíbrio";
    if (totalFinanceiro > 1000) labelTotal = "Saudável";
    if (totalFinanceiro < 500) labelTotal = "Atenção";

    // ===============================
    // 🎯 RENDER
    // ===============================

    if (esperadoEl) esperadoEl.innerText = formatCurrency(esperado);
    if (recebidoEl) recebidoEl.innerText = formatCurrency(recebido);
    if (projetadoEl) projetadoEl.innerText = formatCurrency(projetado);

    if (recebidoTrendEl) {
      recebidoTrendEl.innerText =
        `${variacaoReceita >= 0 ? "↗️" : "↘️"} ${Math.abs(variacaoReceita).toFixed(1)}%`;
    }

    if (atrasadoEl) atrasadoEl.innerText = formatCurrency(atrasado);
    if (inadPercentEl) inadPercentEl.innerText = inadPercent.toFixed(1) + "%";

    if (entradasEl) entradasEl.innerText = formatCurrency(entradas);
    if (saidasEl) saidasEl.innerText = formatCurrency(saidas);
    if (saldoEl) saldoEl.innerText = formatCurrency(saldo);

    if (caixaStatusEl) caixaStatusEl.innerText = statusCaixa;

    if (totalFinanceiroEl) {
      totalFinanceiroEl.innerText = formatCurrency(totalFinanceiro);
    }

    if (totalLabelEl) totalLabelEl.innerText = labelTotal;

    if (summaryRecebido) summaryRecebido.innerText = formatCurrency(recebido);
    if (summaryProjetado) summaryProjetado.innerText = formatCurrency(projetado);
    if (summaryInad) summaryInad.innerText = inadPercent.toFixed(1) + "%";

   if (typeof renderChart === "function") {
  renderChart(paymentsData);
}

    if (rankingData.length && rankingContainer && typeof renderRanking === "function") {
  renderRanking(rankingData);
}

  } catch (e) {

    console.error("Erro dashboard:", e);

    if (totalFinanceiroEl) totalFinanceiroEl.innerText = "R$ 0,00";

  }
}

function renderRanking(data) {

  const container = document.getElementById("ranking-classes");
  if (!container) return;

  if (!data.length) {
    container.innerHTML = "<p>Nenhuma turma com faturamento</p>";
    return;
  }

  // ordena por valor desc
  const sorted = [...data].sort((a, b) => b.total - a.total);

  const top = sorted.slice(0, 5);

  container.innerHTML = top.map((item, index) => {

    const efficiency = item.expected > 0
      ? ((item.total / item.expected) * 100).toFixed(0)
      : 0;

    return `
      <div class="ranking-item">
        <strong>${index + 1}. ${item.class_name}</strong><br>
        ${formatCurrency(item.total)}<br>
        <small>${efficiency}% de eficiência</small>
      </div>
    `;

  }).join("");
}

window.DashboardModule = { init };

})();