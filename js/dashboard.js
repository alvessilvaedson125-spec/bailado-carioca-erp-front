let financeChartInstance = null;

(function () {

  const fmt = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const el = (id) => document.getElementById(id);
  const setText = (id, val) => { if (el(id)) el(id).innerText = val; };

  // ==============================
  // INIT
  // ==============================

  async function init() {
    console.log("Dashboard module iniciado");

    if (!el("financeChart")) return;

    const filterBtn = el("dash-filter-btn");
    const clearBtn  = el("dash-clear-btn");

    if (filterBtn) filterBtn.onclick = loadDashboard;
    if (clearBtn)  clearBtn.onclick  = () => {
      const m = el("dash-month");
      const y = el("dash-year");
      if (m) m.value = "";
      if (y) y.value = new Date().getFullYear().toString();
      loadDashboard();
    };

    await loadDashboard();
  }

  // ==============================
  // LOAD DASHBOARD
  // ==============================

  async function loadDashboard() {

    const efCard   = el("dash-eficiencia-card");
    const inadCard = el("dash-inad-card");
    if (efCard)   efCard.classList.remove("kpi-green", "kpi-yellow", "kpi-red");
    if (inadCard) inadCard.classList.remove("kpi-green", "kpi-yellow", "kpi-red");

    try {

      const dashMonth = el("dash-month")?.value;
      const dashYear  = el("dash-year")?.value;

      const periodParams = [];
      if (dashMonth) periodParams.push(`competence_month=${dashMonth}`);
      if (dashYear)  periodParams.push(`competence_year=${dashYear}`);

      const paymentsUrl = periodParams.length
        ? `/api/v1/payments?${periodParams.join("&")}`
        : "/api/v1/payments";

      const [
        studentsRes,
        classesRes,
        enrollmentsRes,
        paymentsRes,
        cashRes,
        byClassRes,
        attendanceRes,
        privateSummaryRes
      ] = await Promise.all([
        apiRequest("/api/v1/students"),
        apiRequest("/api/v1/classes"),
        apiRequest("/api/v1/enrollments"),
        apiRequest(paymentsUrl),
        apiRequest("/api/v1/cash"),
        apiRequest("/api/v1/payments/by-class"),
        apiRequest("/api/v1/attendance/dashboard"),
        apiRequest("/api/v1/private/payments/summary")
      ]);

      const students      = studentsRes?.success      ? studentsRes.data      : [];
      const classes       = classesRes?.success       ? classesRes.data       : [];
      const enrollments   = enrollmentsRes?.success   ? enrollmentsRes.data   : [];
      const payments      = paymentsRes?.success      ? paymentsRes.data      : [];
      const cash          = cashRes?.success          ? cashRes.data          : [];
      const byClass       = byClassRes?.success       ? byClassRes.data       : [];
      const attendance    = attendanceRes?.success    ? attendanceRes.data    : null;
      const privateSummary = privateSummaryRes?.success ? privateSummaryRes.data : null;

      // ONBOARDING
      if (students.length === 0 && classes.length === 0 && payments.length === 0) {
        renderOnboarding();
        return;
      }

      // ==============================
      // CÁLCULO FINANCEIRO
      // ==============================

      const finance = calculateFinance({ payments, cash });

      const { esperado, recebido }      = finance.receita;
      const { atrasado, defaultRate }   = finance.inadimplencia;
      const { entries, exits, balance } = finance.caixa;
      const total                       = finance.total;

      // Aulas particulares
      const privPaid    = Number(privateSummary?.total_paid    || 0);
      const privPending = Number(privateSummary?.total_pending || 0);
      const privTotal   = Number(privateSummary?.total_expected || 0);

      // Receita consolidada (mensalidades + particulares)
      const recebidoTotal  = recebido + privPaid;
      const esperadoTotal  = esperado + privTotal;

      const eficiencia = esperadoTotal > 0
        ? (recebidoTotal / esperadoTotal) * 100
        : 0;

      // ==============================
      // RENDER LINHA 1 — KPIs
      // ==============================

      setText("dash-recebido",      fmt(recebidoTotal));
      setText("dash-esperado",      fmt(esperadoTotal));
      setText("dash-eficiencia",    eficiencia.toFixed(1) + "%");
      setText("dash-inadimplencia", defaultRate.toFixed(1) + "%");
      setText("dash-atrasado",      fmt(atrasado));

      const trendEl = el("dash-recebido-trend");
      if (trendEl) {
        trendEl.innerText = recebidoTotal > 0 ? "↗️ em dia" : "↘️ sem receita";
      }

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

      // Total consolidado = mensalidades recebidas + particulares recebidas + saldo caixa
      const totalConsolidado = recebido + privPaid + balance;
      setText("dash-total", fmt(totalConsolidado));

      // Aulas particulares
      setText("dash-priv-recebido", fmt(privPaid));
      setText("dash-priv-pendente", fmt(privPending));

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

      setText("dash-alunos",     students.length);
      setText("dash-turmas",     classes.length);
      setText("dash-matriculas", enrollments.length);

      // ==============================
      // RENDER FREQUÊNCIA
      // ==============================

      const freqEl    = el("dash-frequencia");
      const freqLabel = el("dash-frequencia-label");

      if (attendance && Number(attendance.total_records) > 0) {
        const freq = Number(attendance.avg_frequency);

        setText("dash-frequencia", freq.toFixed(1) + "%");

        if (freqEl) {
          freqEl.style.color = freq >= 75 ? "#16a34a"
            : freq >= 50 ? "#ca8a04"
            : "#dc2626";
        }

        if (freqLabel) {
          freqLabel.innerText = freq >= 75 ? "✅ Boa frequência"
            : freq >= 50 ? "⚠️ Atenção"
            : "🔴 Frequência baixa";
        }

      } else {
        setText("dash-frequencia", "—");
        if (freqLabel) freqLabel.innerText = "Sem aulas registradas";
      }

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
  // ONBOARDING
  // ==============================

  function renderOnboarding() {

    ["dash-recebido", "dash-esperado", "dash-eficiencia",
     "dash-inadimplencia", "dash-atrasado", "dash-entradas",
     "dash-saidas", "dash-saldo", "dash-total",
     "dash-frequencia", "dash-priv-recebido", "dash-priv-pendente"
    ].forEach(id => setText(id, "—"));

    setText("dash-alunos",     "0");
    setText("dash-turmas",     "0");
    setText("dash-matriculas", "0");

    const freqLabel = el("dash-frequencia-label");
    if (freqLabel) freqLabel.innerText = "Sem aulas registradas";

    const statusEl = el("dash-status");
    if (statusEl) {
      statusEl.innerText = "Novo";
      statusEl.className = "dash-status-badge gray";
    }

    const ranking = el("dash-ranking");
    if (ranking) {
      ranking.innerHTML = `
        <div class="onboarding-empty">
          <div class="onboarding-icon">🏫</div>
          <h3>Bem-vindo ao Bailado Carioca!</h3>
          <p>Para começar a usar o sistema, siga os passos abaixo:</p>
          <div class="onboarding-steps">
            <div class="onboarding-step">
              <span class="onboarding-num">1</span>
              <div>
                <strong>Cadastre uma Unidade</strong>
                <p>Ex: Copacabana, Botafogo</p>
              </div>
            </div>
            <div class="onboarding-step">
              <span class="onboarding-num">2</span>
              <div>
                <strong>Cadastre um Professor</strong>
                <p>Vincule ao professor da turma</p>
              </div>
            </div>
            <div class="onboarding-step">
              <span class="onboarding-num">3</span>
              <div>
                <strong>Crie uma Turma</strong>
                <p>Ex: Forró iniciante, Terça 20h</p>
              </div>
            </div>
            <div class="onboarding-step">
              <span class="onboarding-num">4</span>
              <div>
                <strong>Cadastre Alunos</strong>
                <p>E faça as matrículas nas turmas</p>
              </div>
            </div>
            <div class="onboarding-step">
              <span class="onboarding-num">5</span>
              <div>
                <strong>Gere as Mensalidades</strong>
                <p>Em Pagamentos → Gerar mensalidades</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    renderChart([]);
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