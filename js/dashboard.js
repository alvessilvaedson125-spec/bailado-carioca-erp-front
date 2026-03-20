
let cashData = [];

(function(){

async function init() {

    // =============================
    // MÉTRICAS (LOADING)
    // =============================
    document.getElementById("metric-students").innerText = "...";
    document.getElementById("metric-classes").innerText = "...";
    document.getElementById("metric-enrollments").innerText = "...";
    document.getElementById("metric-payments").innerText = "...";

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

        if (receitaEl) {
            receitaEl.innerText = "Receitas: " + formatCurrency(totalIn);
        }

        if (despesaEl) {
            despesaEl.innerText = "Despesas: " + formatCurrency(totalOut);
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

  const receitas = [];
  const despesas = [];

  cashData.forEach(e => {
    if (e.type === "in") receitas.push(Number(e.amount));
    if (e.type === "out") despesas.push(Number(e.amount));
  });

 const monthly = {};

cashData.forEach(e => {
  const date = new Date(e.created_at);
  const month = date.toLocaleString("pt-BR", { month: "short" });

  if (!monthly[month]) {
    monthly[month] = { in: 0, out: 0 };
  }

  const amount = Number(e.amount) || 0;

  if (e.type === "in") monthly[month].in += amount;
  if (e.type === "out") monthly[month].out += amount;
});

const labels = Object.keys(monthly);
const receitasData = labels.map(m => monthly[m].in);
const despesasData = labels.map(m => monthly[m].out);

new Chart(ctx, {
  type: 'line',
  data: {
    labels,
    datasets: [
      {
        label: 'Receitas',
        data: receitasData,
        tension: 0.4,
        borderWidth: 2,
        fill: false
      },
      {
        label: 'Despesas',
        data: despesasData,
        tension: 0.4,
        borderWidth: 2,
        fill: false
      }
    ]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top'
      }
    },
    scales: {
      y: {
        beginAtZero: true
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