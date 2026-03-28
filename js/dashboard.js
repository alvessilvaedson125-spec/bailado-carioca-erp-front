let financeChartInstance = null;

(function () {

  const fmt = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const el = (id) => document.getElementById(id);
  const setText = (id, val) => { if (el(id)) el(id).innerText = val; };

  async function init() {
    console.log("Dashboard module iniciado");

    if (!el("financeChart")) return;

    try {

      const [
        studentsRes,
        classesRes,
        enrollmentsRes,
        paymentsRes,
        cashRes,
        byClassRes
      ] = await Promise.all([
        apiRequest("/api/v1/students"),
        apiRequest("/api/v1/classes"),
        apiRequest("/api/v1/enrollments"),
        apiRequest("/api/v1/payments"),
        apiRequest("/api/v1/cash"),
        apiRequest("/api/v1/payments/by-class")
      ]);

      const students    = studentsRes?.success    ? studentsRes.data    : [];
      const classes     = classesRes?.success     ? classesRes.data     : [];
      const enrollments = enrollmentsRes?.success ? enrollmentsRes.data : [];
      const payments    = paymentsRes?.success    ? paymentsRes.data    : [];
      const cash        = cashRes?.success        ? cashRes.data        : [];
      const byClass     = byClassRes?.success     ? byClassRes.data     : [];

      // ==============================
      // CÁLCULO FINANCEIRO
      // ==============================

      const finance = calculateFinance({ payments, cash });

      const { esperado, recebido }    = finance.receita;
      const { atrasado, defaultRate } = finance.inadimplencia;
      const { entries, exits, balance } = finance.caixa;
      const total                     = finance.total;

      // ==============================
      // EFICIÊNCIA
      // ==============================

      const eficiencia = esperado > 0
        ? (recebido / esperado) * 100
        : 0;

      // ==============================
      // RENDER LINHA 1 — KPIs
      // ==============================

      setText("dash-recebido",     fmt(recebido));
      setText("dash-esperado",     fmt(esperado));
      setText("dash-eficiencia",   eficiencia.toFixed(1) + "%");
      setText("dash-inadimplencia", defaultRate.toFixed(1) + "%");
      setText("dash-atrasado",     fmt(atrasado));

      // Trend recebido
      const trendEl = el("dash-recebido-trend");
      if (trendEl) {
        trendEl.innerText = recebido > 0 ? "↗️ em dia" : "↘️ sem receita";
      }

      // Eficiência — borda + label
      const efCard  = el("dash-eficiencia-card");
      const efLabel = el("dash-eficiencia-label");

      if (eficiencia >= 70) {
        if (efCard)  efCard.classList.add("kpi-green");
        if (efLabel) efLabel.innerText = "✅ Boa performance";
      } else if (eficiencia >= 60) {
        if (efCard)  efCard.classList.add("kpi-yellow");
        if (efLabel) efLabel.innerText = "⚠️ Atenção";
      } else {
        if (efCard)  efCard.classList.add("kpi-red");
        if (efLabel) efLabel.innerText = "🔴 Abaixo do ideal";
      }

      // Inadimplência — borda
      const inadCard = el("dash-inad-card");
      if (inadCard) {
        if (defaultRate >= 20)      inadCard.classList.add("kpi-red");
        else if (defaultRate >= 10) inadCard.classList.add("kpi-yellow");
        else                        inadCard.classList.add("kpi-green");
      }

      // ==============================
      // RENDER LINHA 2 — SAÚDE
      // ==============================

      setText("dash-entradas", fmt(entries));
      setText("dash-saidas",   fmt(exits));
      setText("dash-saldo",    fmt(balance));
      setText("dash-total",    fmt(total));

      // Status geral
      const statusEl = el("dash-status");
      if (statusEl) {
        if (eficiencia >= 70 && defaultRate < 10) {
          statusEl.innerText = "✅ Saudável";
          statusEl.className = "dash-status-badge green";
        } else if (eficiencia >= 50 || defaultRate < 20) {
          statusEl.innerText = "⚠️ Atenção";
          statusEl.className = "dash-status-badge yellow";
        } else {
          statusEl.innerText = "🔴 Crítico";
          statusEl.className = "dash-status-badge red";
        }
      }

      // Operacional
      setText("dash-alunos",     students.length);
      setText("dash-turmas",     classes.length);
      setText("dash-matriculas", enrollments.length);

      // ==============================
      // RENDER LINHA 3 — GRÁFICO
      // ==============================

      renderChart(payments);

      // ==============================
      // RENDER LINHA 4 — RANKING
      // ==============================

      renderRanking(byClass);

    } catch (err) {
      console.error("Erro dashboard:", err);
      setText("dash-total", "R$ 0,00");
    }
  }

  // ==============================
  // GRÁFICO
  // ==============================

  function renderChart(payments = []) {
    const ctx = el("financeChart");
    if (!ctx) return;

    if (financeChartInstance) {
      financeChartInstance.destroy();
    }

    const monthly = {};

    payments.forEach(p => {
      const year = Number(p.competence_year);
      const safeYear = (year > 2000 && year < 2100) ? year : new Date().getFullYear();
      const key = `${safeYear}-${String(p.competence_month).padStart(2, "0")}`;

      if (!monthly[key]) monthly[key] = { esperado: 0, recebido: 0 };

      const v = Number(p.final_amount || 0);
      monthly[key].esperado += v;
      if (p.status === "paid") monthly[key].recebido += v;
    });

    const labels   = Object.keys(monthly).sort().slice(-6);
    const esperado = labels.map(m => monthly[m].esperado);
    const recebido = labels.map(m => monthly[m].recebido);

    financeChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          { label: "Esperado", data: esperado, backgroundColor: "#3b82f6", barThickness: 18 },
          { label: "Recebido", data: recebido, backgroundColor: "#22c55e", barThickness: 18 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { boxWidth: 12 } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true }
        }
      }
    });
  }

  // ==============================
  // RANKING
  // ==============================

  function renderRanking(data = []) {
    const container = el("dash-ranking");
    if (!container) return;

    if (!data.length) {
      container.innerHTML = `<p class="empty-state">Nenhuma turma com dados</p>`;
      return;
    }

    const sorted = [...data].sort((a, b) => b.total_received - a.total_received);
    const max    = sorted[0]?.total_received || 1;

    container.innerHTML = sorted.map((c, i) => {

      const eficiencia = c.total_expected > 0
        ? (c.total_received / c.total_expected) * 100
        : 0;

      const width = (c.total_received / max) * 100;

      let color  = "ranking-fill-red";
      let badge  = "🔴 Crítico";
      let bClass = "red";

      if (eficiencia >= 70) {
        color  = "ranking-fill-green";
        badge  = "✅ Excelente";
        bClass = "green";
      } else if (eficiencia >= 60) {
        color  = "ranking-fill-yellow";
        badge  = "⚠️ Atenção";
        bClass = "yellow";
      }

      return `
        <div class="ranking-item">
          <div class="ranking-header">
            <div class="ranking-name">
              <span class="ranking-pos">#${i + 1}</span>
              <span>${c.class_name}</span>
            </div>
            <div class="ranking-right">
              <strong>${fmt(c.total_received)}</strong>
              <span class="ranking-badge ${bClass}">${badge}</span>
            </div>
          </div>
          <div class="ranking-bar">
            <div class="ranking-fill ${color}" style="width:${width}%"></div>
          </div>
          <small>${eficiencia.toFixed(0)}% de eficiência</small>
        </div>
      `;
    }).join("");
  }

  window.DashboardModule = { init };

})();