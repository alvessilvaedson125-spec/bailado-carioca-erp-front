
let cashData = [];

(function(){

async function init() {
if (!document.getElementById("financeChart")) {
  return;
}
    // =============================
    // MÉTRICAS (LOADING)
    // =============================
   const studentsEl = document.getElementById("metric-students");
const classesEl = document.getElementById("metric-classes");
const enrollmentsEl = document.getElementById("metric-enrollments");
const paymentsEl = document.getElementById("metric-payments");

if (studentsEl) studentsEl.innerText = "...";
if (classesEl) classesEl.innerText = "...";
if (enrollmentsEl) enrollmentsEl.innerText = "...";
if (paymentsEl) paymentsEl.innerText = "...";

    // DRE placeholders (caso existam)
    const receitaEl = document.getElementById("dre-receita");
    const despesaEl = document.getElementById("dre-despesa");
    const resultadoEl = document.getElementById("dre-resultado");

    if (receitaEl) receitaEl.innerText = "...";
    if (despesaEl) despesaEl.innerText = "...";
    if (resultadoEl) resultadoEl.innerText = "...";

    try{

        // =============================
        // REQUESTS
        // =============================
        const students = await apiRequest("/api/v1/students");
        const classes = await apiRequest("/api/v1/classes");
        const enrollments = await apiRequest("/api/v1/enrollments");
        const payments = await apiRequest("/api/v1/payments");
        const cash = await apiRequest("/api/v1/cash"); // 🔥 DRE vem daqui
          cashData = cash.data || [];
        // =============================
        // MÉTRICAS
        // =============================
        if(students.success){
            document.getElementById("metric-students").innerText = students.data.length;
        }

        if(classes.success){
            document.getElementById("metric-classes").innerText = classes.data.length;
        }

        if(enrollments.success){
            document.getElementById("metric-enrollments").innerText = enrollments.data.length;
        }

        if(payments.success){
            document.getElementById("metric-payments").innerText = payments.data.length;
        }

        // =============================
        // DRE (CAIXA)
        // =============================
        let totalIn = 0;
        let totalOut = 0;

        if (cash.success && Array.isArray(cash.data)) {

            cash.data.forEach(e => {

                const amount = Number(e.amount) || 0;

                if (e.type === "in") {
                    totalIn += amount;
                } else if (e.type === "out") {
                    totalOut += amount;
                }

            });

        }

        const resultado = totalIn - totalOut;

        // =============================
        // RENDER DRE
        // =============================
        const formatCurrency = (value) =>
            value.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL"
            });

function calcGrowth(data) {
  if (data.length < 2) return 0;

  const last = data[data.length - 1];
  const prev = data[data.length - 2];

  if (prev === 0) return 0;

  return ((last - prev) / prev) * 100;
}

let receitaGrowth = 0;
let despesaGrowth = 0;

        if (receitaEl) {
  receitaEl.innerText =
    "Receitas: " + formatCurrency(totalIn) +
    (typeof receitaGrowth !== "undefined"
      ? " (" + receitaGrowth.toFixed(1) + "%)"
      : "");
}

       if (despesaEl) {
  despesaEl.innerText =
    "Despesas: " + formatCurrency(totalOut) +
    (typeof despesaGrowth !== "undefined"
      ? " (" + despesaGrowth.toFixed(1) + "%)"
      : "");
}

        if (resultadoEl) {
            resultadoEl.innerText = "Resultado: " + formatCurrency(resultado);

            // cor dinâmica
            if (resultado >= 0) {
                resultadoEl.style.color = "green";
            } else {
                resultadoEl.style.color = "red";
            }
        }

        console.log("DRE:", {
            receitas: totalIn,
            despesas: totalOut,
            resultado
        });




    }
    
    
    
    
    catch(e){
        console.error("Erro ao carregar dashboard", e);

        if (receitaEl) receitaEl.innerText = "Erro";
        if (despesaEl) despesaEl.innerText = "Erro";
        if (resultadoEl) resultadoEl.innerText = "Erro";
    }

    const ctx = document.getElementById('financeChart');

if (ctx && cashData.length) {

  // =============================
  // AGRUPAMENTO REAL POR MÊS (YYYY-MM)
  // =============================
  const monthly = {};

  cashData.forEach(e => {
    const date = new Date(e.created_at);
    const monthKey = date.toISOString().slice(0, 7); // YYYY-MM

    if (!monthly[monthKey]) {
      monthly[monthKey] = { in: 0, out: 0 };
    }

    const amount = Number(e.amount) || 0;

    if (e.type === "in") monthly[monthKey].in += amount;
    if (e.type === "out") monthly[monthKey].out += amount;
  });

  // =============================
  // ORDENAÇÃO CORRETA
  // =============================
  const labels = Object.keys(monthly).sort();

  // =============================
  // FORMATAR LABEL (jan, fev...)
  // =============================
  const monthNames = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  const labelsFormatted = labels.map(m => {
    const [year, month] = m.split("-");
    return monthNames[parseInt(month, 10) - 1];
  });

  // =============================
  // DATASETS
  // =============================
  const receitasData = labels.map(m => monthly[m].in);
  const despesasData = labels.map(m => monthly[m].out);

  // =============================
  // GROWTH (AGORA CORRETO)
  // =============================
  const receitaGrowth = calcGrowth(receitasData);
  const despesaGrowth = calcGrowth(despesasData);

  // =============================
  // GRADIENTES
  // =============================
  const ctx2d = ctx.getContext("2d");

  const gradientReceita = ctx2d.createLinearGradient(0, 0, 0, 300);
  gradientReceita.addColorStop(0, "rgba(34,197,94,0.4)");
  gradientReceita.addColorStop(1, "rgba(34,197,94,0)");

  const gradientDespesa = ctx2d.createLinearGradient(0, 0, 0, 300);
  gradientDespesa.addColorStop(0, "rgba(239,68,68,0.4)");
  gradientDespesa.addColorStop(1, "rgba(239,68,68,0)");

  // =============================
  // CHART
  // =============================
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: labelsFormatted,
      datasets: [
        {
          label: 'Receitas',
          data: receitasData,
          borderColor: "#22c55e",
          backgroundColor: gradientReceita,
          fill: true,
          tension: 0.4
        },
        {
          label: 'Despesas',
          data: despesasData,
          borderColor: "#ef4444",
          backgroundColor: gradientDespesa,
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          labels: {
            font: {
              size: 12,
              weight: "bold"
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.dataset.label + ": " +
                context.raw.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                });
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return "R$ " + value;
            }
          }
        }
      }
    }
  });

}
}



window.DashboardModule = {
    init
};

})();