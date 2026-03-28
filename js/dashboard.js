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
async function renderRanking() {
  try {
    const [classesRes, rankingRes] = await Promise.all([
      apiRequest("/api/v1/classes"),
      apiRequest("/api/v1/payments/by-class")
    ]);

    const classes = classesRes.data || [];
    const rankingData = rankingRes.data || [];

    const container = document.getElementById("ranking-container");
    if (!container) return;

    // 🔥 INDEXAR pagamentos por class_id
    const rankingMap = {};
    rankingData.forEach(item => {
      rankingMap[item.class_id] = item;
    });

    // 🔥 GARANTIR TODAS AS TURMAS
    const fullRanking = classes.map(cls => {
      const data = rankingMap[cls.id] || {
        total_received: 0,
        total_expected: 0,
        total_overdue: 0
      };

      return {
        class_name: cls.name,
        total_received: data.total_received,
        total_expected: data.total_expected,
        efficiency:
          data.total_expected > 0
            ? (data.total_received / data.total_expected) * 100
            : 0
      };
    });

    // 🔥 ORDENAR
    fullRanking.sort((a, b) => b.total_received - a.total_received);

    // 🔥 RENDER
    container.innerHTML = "";

    if (fullRanking.length === 0) {
      container.innerHTML = "<p>Nenhuma turma</p>";
      return;
    }

    fullRanking.forEach((item, index) => {
      const div = document.createElement("div");

      div.innerHTML = `
        <strong>${index + 1}. ${item.class_name}</strong><br>
        R$ ${item.total_received.toFixed(2)}<br>
        ${item.efficiency.toFixed(0)}% de eficiência
      `;

      container.appendChild(div);
    });

  } catch (err) {
    console.error("Erro ranking:", err);
  }
}
// =====================
// EXPORT
// =====================

window.DashboardModule = {
  init
};

})();