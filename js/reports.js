(function(){

  let paymentsCache = [];
  let cashCache = [];
  let rankingCache = [];

  const fmt = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const el = (id) => document.getElementById(id);
  const setText = (id, val) => { if(el(id)) el(id).innerText = val; };

  async function init(){
    console.log("Reports module iniciado");

    await checkAuth();

    el("btnGenerateReport")?.addEventListener("click", loadReport);
    el("rep-filter-status")?.addEventListener("change", renderPaymentsTable);

    await populateClasses();
    await loadReport();
  }

  // ===============================
  // POPULAR TURMAS
  // ===============================

  async function populateClasses(){
    const select = el("report-class");
    if(!select) return;

    try{
      const res = await apiRequest("/api/v1/classes");
      const list = res?.success ? res.data : [];

      list.forEach(c => {
        const option = document.createElement("option");
        option.value = c.id;
        option.textContent = c.name;
        select.appendChild(option);
      });

    }catch(err){
      console.error("Erro ao carregar turmas:", err);
    }
  }

  // ===============================
  // LOAD
  // ===============================

  async function loadReport(){
    const month   = el("report-month")?.value;
    const year    = el("report-year")?.value;
    const classId = el("report-class")?.value;

    setText("rep-esperado", "Carregando...");
    setText("rep-recebido", "—");
    setText("rep-pendente", "—");
    setText("rep-atrasado", "—");
    setText("rep-total",    "—");

    try{

      const params = [];
      if(month)   params.push(`competence_month=${month}`);
      if(year)    params.push(`competence_year=${year}`);
      if(classId) params.push(`class_id=${classId}`);

      const paymentsUrl = params.length
        ? `/api/v1/payments?${params.join("&")}`
        : "/api/v1/payments";

      const [paymentsRes, cashRes, rankingRes] = await Promise.all([
        apiRequest(paymentsUrl),
        apiRequest("/api/v1/cash"),
        apiRequest("/api/v1/payments/by-class")
      ]);

      paymentsCache = paymentsRes?.success ? paymentsRes.data : [];
      cashCache     = cashRes?.success     ? cashRes.data     : [];
      rankingCache  = rankingRes?.success  ? rankingRes.data  : [];

      // 🔥 Se filtrou por turma, filtra ranking também no frontend
      const rankingFiltered = classId
        ? rankingCache.filter(r => r.class_id === classId)
        : rankingCache;

      const finance = calculateFinance({
        payments: paymentsCache,
        cash: cashCache
      });

      renderKPIs(finance);
      renderGauge(finance);
      renderCaixa(finance);
      renderTotal(finance);
      renderRanking(rankingFiltered);
      renderPaymentsTable();

    }catch(err){
      console.error("Erro relatório:", err);
      setText("rep-esperado", "Erro");
    }
  }

  // ===============================
  // RENDER KPIs
  // ===============================

  function renderKPIs(finance){
    setText("rep-esperado", fmt(finance.receita.esperado));
    setText("rep-recebido", fmt(finance.receita.recebido));
    setText("rep-pendente", fmt(finance.receita.pendente));
    setText("rep-atrasado", fmt(finance.inadimplencia.atrasado));
  }

  // ===============================
  // RENDER GAUGE
  // ===============================

  function renderGauge(finance){
    const { esperado, recebido, pendente } = finance.receita;
    const { atrasado } = finance.inadimplencia;

    const base = esperado || 1;

    const pRecebido = Math.min((recebido / base) * 100, 100);
    const pPendente = Math.min((pendente / base) * 100, 100 - pRecebido);
    const pAtrasado = Math.min((atrasado / base) * 100, 100 - pRecebido - pPendente);

    const gR = el("rep-gauge-recebido");
    const gP = el("rep-gauge-pendente");
    const gA = el("rep-gauge-atrasado");

    if(gR) gR.style.width = pRecebido.toFixed(1) + "%";
    if(gP) gP.style.width = pPendente.toFixed(1) + "%";
    if(gA) gA.style.width = pAtrasado.toFixed(1) + "%";

    setText("rep-default-rate", finance.inadimplencia.defaultRate.toFixed(1) + "%");
  }

  // ===============================
  // RENDER CAIXA
  // ===============================

  function renderCaixa(finance){
    const { entries, exits, balance } = finance.caixa;

    setText("rep-entradas", fmt(entries));
    setText("rep-saidas",   fmt(exits));
    setText("rep-saldo",    fmt(balance));

    const saldoEl = el("rep-saldo");
    if(saldoEl){
      saldoEl.className = balance >= 0 ? "green" : "red";
    }
  }

  // ===============================
  // RENDER TOTAL
  // ===============================

  function renderTotal(finance){
    setText("rep-total", fmt(finance.total));

    let label = "Equilíbrio";
    if(finance.total > 1000) label = "✅ Saudável";
    if(finance.total < 0)    label = "⚠️ Atenção";

    setText("rep-total-label", label);
  }

  // ===============================
  // RENDER RANKING
  // ===============================

  function renderRanking(data){
    const container = el("rep-ranking");
    if(!container) return;

    if(!data || !data.length){
      container.innerHTML = `<p class="empty-state">Nenhum dado disponível</p>`;
      return;
    }

    const sorted = [...data].sort((a,b) => b.total_received - a.total_received);
    const max = sorted[0]?.total_received || 1;

    container.innerHTML = sorted.map(c => {
      const eficiencia = c.total_expected > 0
        ? (c.total_received / c.total_expected) * 100
        : 0;
      const width = (c.total_received / max) * 100;

      let cor = "#ef4444";
      if(eficiencia >= 70) cor = "#22c55e";
      else if(eficiencia >= 60) cor = "#f59e0b";

      return `
        <div class="ranking-item">
          <div class="ranking-header">
            <span>${c.class_name}</span>
            <strong>${fmt(c.total_received)}</strong>
          </div>
          <div class="ranking-bar">
            <div class="ranking-fill" style="width:${width}%; background:${cor}"></div>
          </div>
          <small>${eficiencia.toFixed(0)}% de eficiência</small>
        </div>
      `;
    }).join("");
  }

  // ===============================
  // RENDER TABELA PAGAMENTOS
  // ===============================

  function renderPaymentsTable(){
    const tbody = el("rep-payments-body");
    if(!tbody) return;

    const statusFilter = el("rep-filter-status")?.value || "";

    let list = [...paymentsCache];

    // Ordenar por risco: vencido → pendente → pago
    list.sort((a, b) => {
      const order = { overdue: 0, pending: 1, paid: 2 };
      const getOrder = (p) => {
        if(p.status === "paid") return 2;
        if(new Date(p.due_date) < new Date()) return 0;
        return 1;
      };
      return getOrder(a) - getOrder(b);
    });

    if(statusFilter){
      list = list.filter(p => {
        if(statusFilter === "overdue"){
          return p.status === "pending" && new Date(p.due_date) < new Date();
        }
        return p.status === statusFilter;
      });
    }

    if(!list.length){
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhum pagamento encontrado</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    list.forEach(p => {
      const tr = document.createElement("tr");

      const isOverdue = p.status === "pending" && new Date(p.due_date) < new Date();

      const status = p.status === "paid"
        ? `<span class="badge green">Pago</span>`
        : isOverdue
          ? `<span class="badge red">Vencido</span>`
          : `<span class="badge orange">Pendente</span>`;

      tr.innerHTML = `
        <td>${p.student_name || "-"}</td>
        <td>${p.class_name   || "-"}</td>
        <td>${String(p.competence_month).padStart(2,"0")}/${p.competence_year}</td>
        <td>${fmt(p.final_amount)}</td>
        <td>${status}</td>
      `;

      // 🔥 destaca linha vencida
      if(isOverdue) tr.style.background = "#fff5f5";

      tbody.appendChild(tr);
    });
  }

  window.ReportsModule = { init };

})();