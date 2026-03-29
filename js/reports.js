(function(){

  let paymentsCache = [];
  let cashCache     = [];
  let rankingCache  = [];
  let financeCache  = null;

  const fmt = (v) =>
    Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const el      = (id) => document.getElementById(id);
  const setText = (id, val) => { if(el(id)) el(id).innerText = val; };

  async function init(){
    console.log("Reports module iniciado");

    await checkAuth();

    el("btnGenerateReport")?.addEventListener("click", loadReport);
    el("rep-filter-status")?.addEventListener("change", renderPaymentsTable);
    el("btnExportCSV")?.addEventListener("click", exportCSV);
    el("btnExportPDF")?.addEventListener("click", exportPDF);

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

      const rankingFiltered = classId
        ? rankingCache.filter(r => r.class_id === classId)
        : rankingCache;

      financeCache = calculateFinance({
        payments: paymentsCache,
        cash:     cashCache
      });

      renderKPIs(financeCache);
      renderGauge(financeCache);
      renderCaixa(financeCache);
      renderTotal(financeCache);
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

    container.innerHTML = sorted.map((c, i) => {
      const eficiencia = c.total_expected > 0
        ? (c.total_received / c.total_expected) * 100
        : 0;

      const width = Math.min(eficiencia, 100).toFixed(1);

      let cor    = "#ef4444";
      let badge  = "🔴 Crítico";
      let bClass = "red";

      if (eficiencia >= 70) {
        cor    = "#22c55e";
        badge  = "✅ Excelente";
        bClass = "green";
      } else if (eficiencia >= 60) {
        cor    = "#f59e0b";
        badge  = "⚠️ Atenção";
        bClass = "yellow";
      }

      return `
        <div class="ranking-item">
          <div class="ranking-header">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:12px; color:#9ca3af; font-weight:700; width:20px;">#${i+1}</span>
              <span style="font-size:14px; color:#1e293b;">${c.class_name}</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <strong style="font-size:14px;">${fmt(c.total_received)}</strong>
              <span class="badge ${bClass}">${badge}</span>
            </div>
          </div>
          <div class="ranking-bar">
            <div class="ranking-fill" style="width:${width}%; background:${cor};"></div>
          </div>
          <small style="font-size:12px; color:#6b7280;">${eficiencia.toFixed(0)}% de eficiência</small>
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

    list.sort((a, b) => {
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

      const statusLabel = p.status === "paid" ? "Pago"
        : isOverdue ? "Vencido"
        : "Pendente";

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

      if(isOverdue) tr.style.background = "#fff5f5";

      tbody.appendChild(tr);
    });
  }

  // ===============================
  // EXPORTAR CSV
  // ===============================

  function exportCSV(){
    if(!paymentsCache.length){
      Toast.warning("Nenhum dado para exportar");
      return;
    }

    const month   = el("report-month")?.value || "todos";
    const year    = el("report-year")?.value  || "todos";

    // --- RESUMO FINANCEIRO ---
    const finance = financeCache;
    let csv = "RELATÓRIO FINANCEIRO — BAILADO CARIOCA\n";
    csv += `Período:,${month}/${year}\n`;
    csv += `Gerado em:,${new Date().toLocaleDateString("pt-BR")}\n\n`;

    csv += "RESUMO FINANCEIRO\n";
    csv += "Esperado,Recebido,Pendente,Inadimplente,Total Consolidado\n";
    csv += [
      fmtNum(finance.receita.esperado),
      fmtNum(finance.receita.recebido),
      fmtNum(finance.receita.pendente),
      fmtNum(finance.inadimplencia.atrasado),
      fmtNum(finance.total)
    ].join(",") + "\n\n";

    // --- PAGAMENTOS ---
    csv += "PAGAMENTOS DO PERÍODO\n";
    csv += "Aluno,Turma,Competência,Valor,Status\n";

    paymentsCache.forEach(p => {
      const isOverdue = p.status === "pending" && new Date(p.due_date) < new Date();
      const status = p.status === "paid" ? "Pago"
        : isOverdue ? "Vencido"
        : "Pendente";

      csv += [
        `"${p.student_name || ""}"`,
        `"${p.class_name   || ""}"`,
        `${String(p.competence_month).padStart(2,"0")}/${p.competence_year}`,
        fmtNum(p.final_amount),
        status
      ].join(",") + "\n";
    });

    // --- RANKING ---
    if(rankingCache.length){
      csv += "\nRANKING POR TURMA\n";
      csv += "Turma,Recebido,Esperado,Eficiência\n";

      [...rankingCache]
        .sort((a,b) => b.total_received - a.total_received)
        .forEach(c => {
          const ef = c.total_expected > 0
            ? ((c.total_received / c.total_expected) * 100).toFixed(1)
            : "0.0";
          csv += [
            `"${c.class_name}"`,
            fmtNum(c.total_received),
            fmtNum(c.total_expected),
            `${ef}%`
          ].join(",") + "\n";
        });
    }

    downloadFile(csv, `relatorio_${year}_${month}.csv`, "text/csv;charset=utf-8;");
    Toast.success("CSV exportado!");
  }

  // ===============================
  // EXPORTAR PDF
  // ===============================

  function exportPDF(){
    if(!paymentsCache.length){
      Toast.warning("Nenhum dado para exportar");
      return;
    }

    const month = el("report-month")?.value || "Todos";
    const year  = el("report-year")?.value  || "Todos";
    const finance = financeCache;

    const rankingRows = [...rankingCache]
      .sort((a,b) => b.total_received - a.total_received)
      .map((c, i) => {
        const ef = c.total_expected > 0
          ? ((c.total_received / c.total_expected) * 100).toFixed(1)
          : "0.0";
        return `<tr>
          <td>#${i+1} ${c.class_name}</td>
          <td>R$ ${fmtNum(c.total_received)}</td>
          <td>R$ ${fmtNum(c.total_expected)}</td>
          <td>${ef}%</td>
        </tr>`;
      }).join("");

    const paymentRows = paymentsCache.map(p => {
      const isOverdue = p.status === "pending" && new Date(p.due_date) < new Date();
      const status = p.status === "paid" ? "Pago"
        : isOverdue ? "Vencido" : "Pendente";
      const color = p.status === "paid" ? "#16a34a"
        : isOverdue ? "#dc2626" : "#d97706";

      return `<tr>
        <td>${p.student_name || "-"}</td>
        <td>${p.class_name   || "-"}</td>
        <td>${String(p.competence_month).padStart(2,"0")}/${p.competence_year}</td>
        <td>R$ ${fmtNum(p.final_amount)}</td>
        <td style="color:${color}; font-weight:600;">${status}</td>
      </tr>`;
    }).join("");

    const html = `
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Relatório Financeiro — Bailado Carioca</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; font-size: 13px; color: #1e293b; padding: 32px; }
          h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
          h2 { font-size: 14px; font-weight: 700; margin: 24px 0 10px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 4px; }
          .subtitle { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
          .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 8px; }
          .kpi { background: #f9fafb; border-radius: 8px; padding: 12px; border-left: 3px solid #4f46e5; }
          .kpi span { font-size: 11px; color: #6b7280; display: block; }
          .kpi strong { font-size: 16px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { text-align: left; padding: 8px 10px; font-size: 11px; color: #6b7280; text-transform: uppercase; background: #f9fafb; }
          td { padding: 8px 10px; border-top: 1px solid #f1f5f9; font-size: 12px; }
          .footer { margin-top: 32px; font-size: 11px; color: #9ca3af; text-align: center; }
          @media print {
            body { padding: 16px; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>Bailado Carioca — Gestão Escolar</h1>
        <p class="subtitle">Relatório Financeiro — Período: ${month}/${year} — Gerado em ${new Date().toLocaleDateString("pt-BR")}</p>

        <h2>Resumo Financeiro</h2>
        <div class="kpis">
          <div class="kpi"><span>Esperado</span><strong>R$ ${fmtNum(finance.receita.esperado)}</strong></div>
          <div class="kpi"><span>Recebido</span><strong>R$ ${fmtNum(finance.receita.recebido)}</strong></div>
          <div class="kpi"><span>Pendente</span><strong>R$ ${fmtNum(finance.receita.pendente)}</strong></div>
          <div class="kpi"><span>Inadimplente</span><strong>R$ ${fmtNum(finance.inadimplencia.atrasado)}</strong></div>
        </div>

        <h2>Ranking por Turma</h2>
        <table>
          <thead><tr><th>Turma</th><th>Recebido</th><th>Esperado</th><th>Eficiência</th></tr></thead>
          <tbody>${rankingRows}</tbody>
        </table>

        <h2>Pagamentos do Período</h2>
        <table>
          <thead><tr><th>Aluno</th><th>Turma</th><th>Competência</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>${paymentRows}</tbody>
        </table>

        <div class="footer">Bailado Carioca — Gestão Escolar • ${new Date().toLocaleDateString("pt-BR")}</div>
      </body>
      </html>
    `;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
    }, 500);

    Toast.success("PDF aberto para impressão!");
  }

  // ===============================
  // UTILS
  // ===============================

  function fmtNum(v){
    return Number(v || 0).toFixed(2).replace(".", ",");
  }

  function downloadFile(content, filename, mimeType){
    const BOM = "\uFEFF"; // garante acentos no Excel
    const blob = new Blob([BOM + content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  window.ReportsModule = { init };

})();