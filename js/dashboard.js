(function(){

function formatCurrency(v){
  return Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function safeSet(id, value){
  const el = document.getElementById(id);
  if(el) el.innerText = value;
}

async function init(){

  try{

    const [
      studentsRes,
      classesRes,
      enrollmentsRes,
      paymentsRes,
      cashRes,
      rankingRes
    ] = await Promise.all([
      apiRequest("/api/v1/students"),
      apiRequest("/api/v1/classes"),
      apiRequest("/api/v1/enrollments"),
      apiRequest("/api/v1/payments"),
      apiRequest("/api/v1/cash"),
      apiRequest("/api/v1/payments/by-class")
    ]);

    const students = studentsRes?.data || [];
    const classes = classesRes?.data || [];
    const enrollments = enrollmentsRes?.data || [];
    const payments = paymentsRes?.data || [];
    const cash = cashRes?.data || [];
    const ranking = rankingRes?.data || [];

    // =====================
    // KPIs
    // =====================
    safeSet("metric-students", students.length);
    safeSet("metric-classes", classes.length);
    safeSet("metric-enrollments", enrollments.length);
    safeSet("metric-payments", payments.length);

    // =====================
    // RECEITA
    // =====================

    const esperado = enrollments.reduce((sum, e) => {
      return sum + Number(e.final_price || e.monthly_fee || 0);
    }, 0);

    const recebido = payments
      .filter(p => p.computed_status === "paid")
      .reduce((sum, p) => sum + Number(p.final_amount || 0), 0);

    const atrasado = payments
      .filter(p => p.computed_status === "overdue")
      .reduce((sum, p) => sum + Number(p.final_amount || 0), 0);

    const projetado = esperado - atrasado;

    const inadPercent = esperado > 0
      ? (atrasado / esperado) * 100
      : 0;

    // =====================
    // CAIXA
    // =====================

    let entradas = 0;
    let saidas = 0;

    cash.forEach(c => {
      const val = Number(c.amount || 0);

      if(c.type === "in" || c.type === "entrada"){
        entradas += val;
      } else {
        saidas += val;
      }
    });

    const saldo = entradas - saidas;

    // =====================
    // TOTAL CONSOLIDADO
    // =====================

    const total = recebido + saldo;

    // =====================
    // RENDER
    // =====================

    safeSet("dre-esperado", formatCurrency(esperado));
    safeSet("dre-recebido", formatCurrency(recebido));
    safeSet("dre-projetado", formatCurrency(projetado));

    safeSet("dre-atrasado", formatCurrency(atrasado));
    safeSet("dre-inadimplencia-percent", inadPercent.toFixed(1) + "%");

    safeSet("dre-entradas", formatCurrency(entradas));
    safeSet("dre-saidas", formatCurrency(saidas));
    safeSet("dre-saldo", formatCurrency(saldo));

    safeSet("dre-total", formatCurrency(total));

    safeSet("summary-recebido", formatCurrency(recebido));
    safeSet("summary-projetado", formatCurrency(projetado));
    safeSet("summary-inadimplencia", inadPercent.toFixed(1) + "%");

    // =====================
    // RANKING (SEGURO)
    // =====================

    renderRanking(ranking);

    // =====================
    // CHART (SEGURO)
    // =====================

    if(typeof renderChart === "function"){
      renderChart(payments);
    }

  }catch(e){
    console.error("Erro dashboard:", e);
  }

}

// =====================
// RANKING
// =====================
function renderRanking(data){

  const container = document.getElementById("ranking-classes");
  if(!container) return;

  if(!data.length){
    container.innerHTML = "<p>Nenhuma turma com faturamento</p>";
    return;
  }

  const normalized = data.map(item => ({
    name: item.class_name || item.name || "Turma",
    total: Number(
      item.total ??
      item.amount ??
      item.sum ??
      item.received ??
      0
    ),
    expected: Number(item.expected ?? 0)
  }));

  const sorted = normalized
    .sort((a,b) => b.total - a.total)
    .slice(0,5);

  container.innerHTML = sorted.map((item, index) => {

    const efficiency = item.expected > 0
      ? ((item.total / item.expected) * 100).toFixed(0)
      : 0;

    return `
      <div class="ranking-item">
        <strong>${index + 1}. ${item.name}</strong><br>
        ${formatCurrency(item.total)}<br>
        <small>${efficiency}% de eficiência</small>
      </div>
    `;
  }).join("");
}
// =====================
// EXPORT
// =====================

window.DashboardModule = {
  init
};

})();