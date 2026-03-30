(function(){

let packagesCache  = [];
let sessionsCache  = [];
let paymentsCache  = [];
let activeTab      = "packages";
let editingPkgId   = null;

const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const safe = (v) => v ?? "-";

const locationLabel = (type) =>
  type === "student_home" ? "Residência do aluno" : "Bailado Laranjeiras";

const statusSession = {
  scheduled:  { label: "Agendada",   cls: "blue"   },
  completed:  { label: "Realizada",  cls: "green"  },
  cancelled:  { label: "Cancelada",  cls: "red"    },
  no_show:    { label: "Faltou",     cls: "orange" },
};

const statusPayment = {
  pending: { label: "Pendente", cls: "orange" },
  paid:    { label: "Pago",     cls: "green"  },
};

// ===============================
// INIT
// ===============================

async function init(){
  console.log("Private module iniciado");
  setupTabs();
  attachModals();
  await loadAll();
}

// ===============================
// LOAD
// ===============================

async function loadAll(){
  await Promise.all([
    loadPackages(),
    loadSessions(),
    loadPayments()
  ]);
  updateStats();
}

async function loadPackages(){
  try{
    const res = await apiRequest("/api/v1/private/packages");
    packagesCache = res?.data || [];
    renderPackages(packagesCache);
  }catch(err){
    console.error(err);
  }
}

async function loadSessions(){
  try{
    const res = await apiRequest("/api/v1/private/sessions");
    sessionsCache = res?.data || [];
    renderSessions(sessionsCache);
  }catch(err){
    console.error(err);
  }
}

async function loadPayments(){
  try{
    const res = await apiRequest("/api/v1/private/payments");
    paymentsCache = res?.data || [];
    renderPayments(paymentsCache);
  }catch(err){
    console.error(err);
  }
}

// ===============================
// STATS
// ===============================

function updateStats(){
  const activePackages  = packagesCache.filter(p => p.status === "active").length;
  const pendingSessions = sessionsCache.filter(s => s.status === "scheduled").length;
  const paid    = paymentsCache.filter(p => p.status === "paid").reduce((s,p) => s + Number(p.amount), 0);
  const pending = paymentsCache.filter(p => p.status === "pending").reduce((s,p) => s + Number(p.amount), 0);

  const setText = (id, v) => { const el = document.getElementById(id); if(el) el.innerText = v; };
  setText("statPackages", activePackages);
  setText("statSessions", pendingSessions);
  setText("statPaid",     fmt(paid));
  setText("statPending",  fmt(pending));
}

// ===============================
// RENDER PACOTES
// ===============================

function renderPackages(list){
  const container = document.getElementById("packagesList");
  if(!container) return;

  if(list.length === 0){
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:#6b7280;">
        <div style="font-size:40px; margin-bottom:12px;">📦</div>
        <p>Nenhum pacote cadastrado</p>
      </div>`;
    return;
  }

  container.innerHTML = "";

  list.forEach(pkg => {
    const card = document.createElement("div");
    card.className = "private-card";

    const progress = pkg.total_sessions > 0
      ? Math.round((pkg.sessions_used / pkg.total_sessions) * 100)
      : 0;

    const remaining = pkg.total_sessions - pkg.sessions_used;

    const statusCls = {
      active:    "green",
      completed: "blue",
      expired:   "orange",
      cancelled: "red"
    }[pkg.status] || "gray";

    const statusLbl = {
      active:    "Ativo",
      completed: "Concluído",
      expired:   "Expirado",
      cancelled: "Cancelado"
    }[pkg.status] || pkg.status;

    const teachers = [pkg.teacher_1_name, pkg.teacher_2_name].filter(Boolean).join(" + ");

    card.innerHTML = `
      <div class="private-card-header">
        <div class="private-card-info">
          <div class="private-card-title">${safe(pkg.student_name)}</div>
          <div class="private-card-meta">${teachers} · ${locationLabel(pkg.location_type)}</div>
        </div>
        <div style="display:flex; align-items:center; gap:8px;">
          <span class="enrollment-status-badge ${statusCls}">${statusLbl}</span>
          <button class="btn-icon-edit pkg-edit" data-id="${pkg.id}">✏️</button>
          <button class="btn-icon-delete pkg-delete" data-id="${pkg.id}">✖</button>
        </div>
      </div>

      <div class="private-card-progress">
        <div class="private-progress-bar">
          <div class="private-progress-fill" style="width:${progress}%"></div>
        </div>
        <span class="private-progress-label">${pkg.sessions_used}/${pkg.total_sessions} aulas · ${remaining} restante${remaining !== 1 ? "s" : ""}</span>
      </div>

      <div class="private-card-footer">
        <div class="private-price-info">
          <span>Total: <strong>${fmt(pkg.price_total)}</strong></span>
          <span>Por aula: <strong>${fmt(pkg.price_per_session)}</strong></span>
        </div>
        <button class="btn-secondary btn-sm pkg-add-session" data-id="${pkg.id}" data-student="${pkg.student_id}" data-t1="${pkg.teacher_1_id}" data-t2="${pkg.teacher_2_id || ""}">
          + Agendar aula
        </button>
      </div>
    `;

    card.querySelector(".pkg-edit").onclick   = () => openEditPackage(pkg);
    card.querySelector(".pkg-delete").onclick = () => deletePackage(pkg.id);
    card.querySelector(".pkg-add-session").onclick = () => openSessionFromPackage(pkg);

    container.appendChild(card);
  });
}

// ===============================
// RENDER SESSÕES
// ===============================

function renderSessions(list){
  const container = document.getElementById("sessionsList");
  if(!container) return;

  if(list.length === 0){
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:#6b7280;">
        <div style="font-size:40px; margin-bottom:12px;">📅</div>
        <p>Nenhuma sessão cadastrada</p>
      </div>`;
    return;
  }

  container.innerHTML = "";

  list.forEach(ses => {
    const card = document.createElement("div");
    card.className = "private-session-card";

    const st = statusSession[ses.status] || { label: ses.status, cls: "gray" };
    const teachers = [ses.teacher_1_name, ses.teacher_2_name].filter(Boolean).join(" + ");

    const dateStr = ses.scheduled_at
      ? new Date(ses.scheduled_at).toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit"
        })
      : "-";

    card.innerHTML = `
      <div class="private-session-left">
        <div class="private-session-date">${dateStr}</div>
        <div class="private-session-info">
          <strong>${safe(ses.student_name)}</strong>
          <span>${teachers}</span>
          <span>${locationLabel(ses.location_type)}</span>
          ${ses.package_id ? '<span class="private-badge-pkg">Pacote</span>' : '<span class="private-badge-avulsa">Avulsa</span>'}
        </div>
      </div>
      <div class="private-session-right">
        <span class="enrollment-status-badge ${st.cls}">${st.label}</span>
        ${ses.status === "scheduled" ? `
          <button class="btn-sm btn-success ses-complete" data-id="${ses.id}">✓ Realizada</button>
          <button class="btn-sm btn-danger  ses-cancel"   data-id="${ses.id}">✖ Cancelar</button>
        ` : ""}
      </div>
    `;

    card.querySelector(".ses-complete")?.addEventListener("click", () => updateSession(ses.id, "completed"));
    card.querySelector(".ses-cancel")?.addEventListener("click",   () => updateSession(ses.id, "cancelled"));

    container.appendChild(card);
  });
}

// ===============================
// RENDER PAGAMENTOS
// ===============================

function renderPayments(list){
  const container = document.getElementById("privatePaymentsList");
  if(!container) return;

  if(list.length === 0){
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:#6b7280;">
        <div style="font-size:40px; margin-bottom:12px;">💰</div>
        <p>Nenhum pagamento encontrado</p>
      </div>`;
    return;
  }

  container.innerHTML = `
  <div class="private-table-container">
    <table class="private-payments-table">
      <thead>
        <tr>
          <th>Aluno</th>
          <th>Tipo</th>
          <th>Valor</th>
          <th>Status</th>
          <th>Pago em</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody id="privatePaymentsBody"></tbody>
    </table>
  </div>
`;

  const tbody = document.getElementById("privatePaymentsBody");

  list.forEach(p => {
    const st  = statusPayment[p.status] || { label: p.status, cls: "gray" };
    const tipo = p.origin_type === "package" ? "Pacote" : "Avulsa";
    const paidAt = p.paid_at
      ? new Date(p.paid_at).toLocaleDateString("pt-BR")
      : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${safe(p.student_name)}</td>
      <td><span class="private-badge-${p.origin_type}">${tipo}</span></td>
      <td><strong>${fmt(p.amount)}</strong></td>
      <td><span class="enrollment-status-badge ${st.cls}">${st.label}</span></td>
      <td>${paidAt}</td>
      <td>
        ${p.status === "pending" ? `
          <button class="btn-sm btn-success pay-mark" data-id="${p.id}">✓ Marcar pago</button>
        ` : ""}
      </td>
    `;

    tr.querySelector(".pay-mark")?.addEventListener("click", () => markPaymentPaid(p.id));
    tbody.appendChild(tr);
  });
}

// ===============================
// ACTIONS
// ===============================

async function updateSession(id, status){
  const labels = { completed: "Marcar como realizada?", cancelled: "Cancelar esta sessão?" };
  if(!confirm(labels[status] || "Confirmar?")) return;

  try{
    await apiRequest(`/api/v1/private/sessions/${id}`, "PATCH", { status });
    Toast.success(status === "completed" ? "Aula marcada como realizada!" : "Sessão cancelada!");
    await loadAll();
  }catch(err){
    Toast.error("Erro ao atualizar sessão");
  }
}

async function markPaymentPaid(id){
  if(!confirm("Confirmar recebimento do pagamento?")) return;
  try{
    await apiRequest(`/api/v1/private/payments/${id}`, "PATCH", { payment_method: "manual" });
    Toast.success("Pagamento confirmado!");
    await loadAll();
  }catch(err){
    Toast.error("Erro ao confirmar pagamento");
  }
}

async function deletePackage(id){
  if(!confirm("Remover este pacote?")) return;
  try{
    await apiRequest(`/api/v1/private/packages/${id}`, "DELETE");
    Toast.success("Pacote removido!");
    await loadPackages();
    updateStats();
  }catch(err){
    Toast.error("Erro ao remover pacote");
  }
}

// ===============================
// SAVE PACOTE
// ===============================

async function savePackage(){
  const studentId     = document.getElementById("pkgStudent")?.value;
  const teacher1Id    = document.getElementById("pkgTeacher1")?.value;
  const teacher2Id    = document.getElementById("pkgTeacher2")?.value;
  const totalSessions = Number(document.getElementById("pkgSessions")?.value || 4);
  const priceTotal    = Number(document.getElementById("pkgPrice")?.value || 0);
  const locationType  = document.getElementById("pkgLocation")?.value;
  const locationNotes = document.getElementById("pkgLocationNotes")?.value;
  const startDate     = document.getElementById("pkgStartDate")?.value;
  const notes         = document.getElementById("pkgNotes")?.value;

  if(!studentId)  { Toast.warning("Selecione o aluno"); return; }
  if(!teacher1Id) { Toast.warning("Selecione o professor"); return; }
  if(!priceTotal) { Toast.warning("Informe o valor total do pacote"); return; }

  try{
    const endpoint = editingPkgId
      ? `/api/v1/private/packages/${editingPkgId}`
      : "/api/v1/private/packages";
    const method = editingPkgId ? "PUT" : "POST";

    await apiRequest(endpoint, method, {
      student_id:     studentId,
      teacher_1_id:   teacher1Id,
      teacher_2_id:   teacher2Id || null,
      total_sessions: totalSessions,
      price_total:    priceTotal,
      location_type:  locationType,
      location_notes: locationNotes || null,
      start_date:     startDate || null,
      notes:          notes || null
    });

    Toast.success(editingPkgId ? "Pacote atualizado!" : "Pacote criado!");
    editingPkgId = null;
    closePackageModal();
    await loadAll();

  }catch(err){
    Toast.error("Erro ao salvar pacote");
  }
}

// ===============================
// SAVE SESSÃO
// ===============================

async function saveSession(){
  const studentId     = document.getElementById("sesStudent")?.value;
  const packageId     = document.getElementById("sesPackage")?.value;
  const teacher1Id    = document.getElementById("sesTeacher1")?.value;
  const teacher2Id    = document.getElementById("sesTeacher2")?.value;
  const scheduledAt   = document.getElementById("sesScheduled")?.value;
  const duration      = Number(document.getElementById("sesDuration")?.value || 60);
  const price         = Number(document.getElementById("sesPrice")?.value || 0);
  const locationType  = document.getElementById("sesLocation")?.value;
  const locationNotes = document.getElementById("sesLocationNotes")?.value;
  const notes         = document.getElementById("sesNotes")?.value;

  if(!studentId)   { Toast.warning("Selecione o aluno"); return; }
  if(!teacher1Id)  { Toast.warning("Selecione o professor"); return; }
  if(!scheduledAt) { Toast.warning("Informe a data e hora"); return; }

  try{
    await apiRequest("/api/v1/private/sessions", "POST", {
      student_id:      studentId,
      package_id:      packageId || null,
      teacher_1_id:    teacher1Id,
      teacher_2_id:    teacher2Id || null,
      scheduled_at:    scheduledAt,
      duration_minutes: duration,
      price:           price,
      location_type:   locationType,
      location_notes:  locationNotes || null,
      notes:           notes || null
    });

    Toast.success("Sessão agendada!");
    closeSessionModal();
    await loadAll();

  }catch(err){
    Toast.error("Erro ao agendar sessão");
  }
}

// ===============================
// TABS
// ===============================

function setupTabs(){
  document.querySelectorAll(".private-tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".private-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.dataset.tab;

      document.getElementById("tabPackages").style.display  = activeTab === "packages"  ? "" : "none";
      document.getElementById("tabSessions").style.display  = activeTab === "sessions"  ? "" : "none";
      document.getElementById("tabPayments").style.display  = activeTab === "payments"  ? "" : "none";
    };
  });
}

// ===============================
// MODAIS
// ===============================

function attachModals(){
  // Pacote
  document.getElementById("newPackageBtn").onclick = openNewPackage;
  document.getElementById("cancelPackageBtn").onclick = closePackageModal;
  document.getElementById("savePackageBtn").onclick = savePackage;
  document.getElementById("packageModal").addEventListener("click", e => {
    if(e.target === document.getElementById("packageModal")) closePackageModal();
  });

  // Sessão
  document.getElementById("newSessionBtn").onclick = openNewSession;
  document.getElementById("cancelSessionBtn").onclick = closeSessionModal;
  document.getElementById("saveSessionBtn").onclick = saveSession;
  document.getElementById("sessionModal").addEventListener("click", e => {
    if(e.target === document.getElementById("sessionModal")) closeSessionModal();
  });

  // Location toggle pacote
  document.getElementById("pkgLocation").addEventListener("change", e => {
    const group = document.getElementById("pkgLocationNotesGroup");
    if(group) group.style.display = e.target.value === "student_home" ? "" : "none";
  });

  // Location toggle sessão
  document.getElementById("sesLocation").addEventListener("change", e => {
    const group = document.getElementById("sesLocationNotesGroup");
    if(group) group.style.display = e.target.value === "student_home" ? "" : "none";
  });

  // Preview preço/aula
  document.getElementById("pkgPrice").addEventListener("input", updatePkgPreview);
  document.getElementById("pkgSessions").addEventListener("input", updatePkgPreview);

  // Pacote selecionado na sessão — preenche campos
  document.getElementById("sesPackage").addEventListener("change", onPackageSelected);

  // Aluno selecionado na sessão — filtra pacotes ativos
  document.getElementById("sesStudent").addEventListener("change", onStudentSelectedForSession);
}

function updatePkgPreview(){
  const price    = Number(document.getElementById("pkgPrice")?.value || 0);
  const sessions = Number(document.getElementById("pkgSessions")?.value || 4);
  const preview  = document.getElementById("pkgPricePreview");
  if(!preview) return;
  if(price > 0 && sessions > 0){
    preview.style.display = "";
    preview.innerText = `${fmt(price / sessions)} por aula`;
  } else {
    preview.style.display = "none";
  }
}

function onPackageSelected(){
  const pkgId    = document.getElementById("sesPackage")?.value;
  const priceGrp = document.getElementById("sesPriceGroup");
  if(priceGrp) priceGrp.style.display = pkgId ? "none" : "";

  if(pkgId){
    const pkg = packagesCache.find(p => p.id === pkgId);
    if(pkg){
      document.getElementById("sesTeacher1").value = pkg.teacher_1_id || "";
      document.getElementById("sesTeacher2").value = pkg.teacher_2_id || "";
      document.getElementById("sesLocation").value = pkg.location_type || "bailado_laranjeiras";
      const notesGrp = document.getElementById("sesLocationNotesGroup");
      if(notesGrp) notesGrp.style.display = pkg.location_type === "student_home" ? "" : "none";
    }
  }
}

async function onStudentSelectedForSession(){
  const studentId = document.getElementById("sesStudent")?.value;
  const select    = document.getElementById("sesPackage");
  if(!select) return;

  select.innerHTML = `<option value="">Aula avulsa</option>`;

  if(!studentId) return;

  const active = packagesCache.filter(p =>
    p.student_id === studentId && p.status === "active"
  );

  active.forEach(pkg => {
    const opt = document.createElement("option");
    opt.value       = pkg.id;
    opt.textContent = `Pacote ${pkg.sessions_used}/${pkg.total_sessions} aulas — ${fmt(pkg.price_total)}`;
    select.appendChild(opt);
  });
}

// ===============================
// OPEN MODAIS
// ===============================

async function openNewPackage(){
  editingPkgId = null;
  resetPackageForm();
  await populatePrivateSelects();
  document.getElementById("packageModal").classList.remove("hidden");
}

async function openEditPackage(pkg){
  editingPkgId = pkg.id;
  await populatePrivateSelects();

  document.getElementById("pkgStudent").value   = pkg.student_id;
  document.getElementById("pkgTeacher1").value  = pkg.teacher_1_id;
  document.getElementById("pkgTeacher2").value  = pkg.teacher_2_id || "";
  document.getElementById("pkgSessions").value  = pkg.total_sessions;
  document.getElementById("pkgPrice").value     = pkg.price_total;
  document.getElementById("pkgLocation").value  = pkg.location_type;
  document.getElementById("pkgStartDate").value = pkg.start_date || "";
  document.getElementById("pkgNotes").value     = pkg.notes || "";

  const notesGrp = document.getElementById("pkgLocationNotesGroup");
  if(notesGrp) notesGrp.style.display = pkg.location_type === "student_home" ? "" : "none";
  document.getElementById("pkgLocationNotes").value = pkg.location_notes || "";

  document.getElementById("packageModalTitle").innerText = "Editar Pacote";
  updatePkgPreview();
  document.getElementById("packageModal").classList.remove("hidden");
}

async function openNewSession(){
  resetSessionForm();
  await populatePrivateSelects();
  document.getElementById("sessionModal").classList.remove("hidden");
}

async function openSessionFromPackage(pkg){
  resetSessionForm();
  await populatePrivateSelects();

  document.getElementById("sesStudent").value  = pkg.student_id;
  await onStudentSelectedForSession();
  document.getElementById("sesPackage").value  = pkg.id;
  document.getElementById("sesTeacher1").value = pkg.teacher_1_id;
  document.getElementById("sesTeacher2").value = pkg.teacher_2_id || "";
  document.getElementById("sesLocation").value = pkg.location_type;

  const notesGrp = document.getElementById("sesLocationNotesGroup");
  if(notesGrp) notesGrp.style.display = pkg.location_type === "student_home" ? "" : "none";

  const priceGrp = document.getElementById("sesPriceGroup");
  if(priceGrp) priceGrp.style.display = "none";

  document.getElementById("sessionModalTitle").innerText = "Agendar Aula do Pacote";
  document.getElementById("sessionModal").classList.remove("hidden");
}

// ===============================
// CLOSE MODAIS
// ===============================

function closePackageModal(){
  document.getElementById("packageModal").classList.add("hidden");
  resetPackageForm();
  editingPkgId = null;
}

function closeSessionModal(){
  document.getElementById("sessionModal").classList.add("hidden");
  resetSessionForm();
}

// ===============================
// RESET FORMS
// ===============================

function resetPackageForm(){
  ["pkgStudent","pkgTeacher1","pkgTeacher2","pkgLocationNotes","pkgStartDate","pkgNotes"].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = "";
  });
  document.getElementById("pkgSessions").value  = "4";
  document.getElementById("pkgPrice").value     = "";
  document.getElementById("pkgLocation").value  = "bailado_laranjeiras";
  document.getElementById("pkgLocationNotesGroup").style.display = "none";
  document.getElementById("pkgPricePreview").style.display = "none";
  document.getElementById("packageModalTitle").innerText = "Novo Pacote";
}

function resetSessionForm(){
  ["sesStudent","sesPackage","sesTeacher1","sesTeacher2","sesScheduled","sesLocationNotes","sesNotes","sesPrice"].forEach(id => {
    const el = document.getElementById(id); if(el) el.value = "";
  });
  document.getElementById("sesDuration").value  = "60";
  document.getElementById("sesLocation").value  = "bailado_laranjeiras";
  document.getElementById("sesLocationNotesGroup").style.display = "none";
  document.getElementById("sesPriceGroup").style.display = "";
  document.getElementById("sessionModalTitle").innerText = "Nova Sessão";
}

// ===============================
// POPULATE SELECTS
// ===============================

async function populatePrivateSelects(){
  await Promise.all([
    populateSelect("pkgStudent",  "/api/v1/students"),
    populateSelect("pkgTeacher1", "/api/v1/teachers"),
    populateSelect("pkgTeacher2", "/api/v1/teachers", true),
    populateSelect("sesStudent",  "/api/v1/students"),
    populateSelect("sesTeacher1", "/api/v1/teachers"),
    populateSelect("sesTeacher2", "/api/v1/teachers", true),
  ]);
}

async function populateSelect(id, endpoint, optional = false){
  const select = document.getElementById(id);
  if(!select) return;
  try{
    const res  = await apiRequest(endpoint);
    const list = res?.data || [];
    select.innerHTML = optional
      ? `<option value="">Nenhum</option>`
      : `<option value="">Selecione...</option>`;
    list.forEach(item => {
      const opt = document.createElement("option");
      opt.value       = item.id;
      opt.textContent = item.name;
      select.appendChild(opt);
    });
  }catch(err){
    console.error("Erro ao popular select", id, err);
  }
}

// ===============================
// EXPORTS
// ===============================

window.PrivateModule = { init };

})();