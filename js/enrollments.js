(function(){

let enrollmentsCache  = [];
let editingEnrollmentId = null;
let editingScholarshipId = null;
let initDone   = false;
let activeTab  = "regular";
let currentList = [];
const PAGE_SIZE = 15;

const fmt = (v) =>
  Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// ===============================
// INIT
// ===============================

async function init(){

  if(initDone){
    await loadEnrollments();
    attachAll();
    setupTabs(); // 🔥 re-registra as abas ao voltar
    return;
  }
  initDone = true;

  console.log("Enrollments module iniciado");

  attachAll();
  setupTabs();

  await loadEnrollments();
}

// ===============================
// ATTACH
// ===============================

function attachAll(){
  attachEnrollmentModal();
  attachScholarshipModal();
  attachSearch();
}

function attachEnrollmentModal(){
  const newBtn    = document.getElementById("newEnrollmentBtn");
  const cancelBtn = document.getElementById("cancelEnrollmentBtn");
  const saveBtn   = document.getElementById("saveEnrollmentBtn");
  const modal     = document.getElementById("enrollmentModal");

  if(newBtn){
    newBtn.onclick = async () => {
      editingEnrollmentId = null;
      resetEnrollmentForm();
      await loadEnrollmentFormData();
      if(modal) modal.classList.remove("hidden");
    };
  }

  if(cancelBtn) cancelBtn.onclick = closeEnrollmentModal;
  if(saveBtn)   saveBtn.onclick   = saveEnrollment;

  if(modal){
    modal.addEventListener("click", (e) => {
      if(e.target === modal) closeEnrollmentModal();
    });
  }
}

function attachScholarshipModal(){
  const newBtn    = document.getElementById("newScholarshipBtn");
  const cancelBtn = document.getElementById("cancelScholarshipBtn");
  const saveBtn   = document.getElementById("saveScholarshipBtn");
  const modal     = document.getElementById("scholarshipModal");

  if(newBtn){
    newBtn.onclick = async () => {
      editingScholarshipId = null;
      resetScholarshipForm();
      await loadScholarshipFormData();
      if(modal) modal.classList.remove("hidden");
    };
  }

  if(cancelBtn) cancelBtn.onclick = closeScholarshipModal;
  if(saveBtn)   saveBtn.onclick   = saveScholarship;

  if(modal){
    modal.addEventListener("click", (e) => {
      if(e.target === modal) closeScholarshipModal();
    });
  }

  // live preview do impacto
  document.getElementById("editScholarshipFee")?.addEventListener("input", updateScholarshipImpact);
  document.getElementById("editScholarshipDiscount")?.addEventListener("input", updateScholarshipImpact);
  document.getElementById("editScholarshipType")?.addEventListener("change", updateScholarshipType);
}

function attachSearch(){
  const searchInput = document.getElementById("searchEnrollments");
  if(searchInput){
    searchInput.addEventListener("input", () => {
      filterEnrollments();
    });
  }
}

// ===============================
// TABS
// ===============================

function setupTabs(){
  document.querySelectorAll(".enrollment-tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".enrollment-tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeTab = btn.dataset.tab;

      document.getElementById("tabRegular").style.display     = activeTab === "regular"     ? "" : "none";
      document.getElementById("tabScholarship").style.display = activeTab === "scholarship" ? "" : "none";
    };
  });
}

// ===============================
// LOAD
// ===============================

async function loadEnrollments(){

  try{
    const res = await apiRequest("/api/v1/enrollments");

    if(!res || !res.success){
      renderRegular([]);
      renderScholarships([]);
      return;
    }

    enrollmentsCache = res.data || [];

    const selectedStudentId = localStorage.getItem("selectedStudentId");
    if(selectedStudentId){
      const filtered = enrollmentsCache.filter(e =>
        String(e.student_id) === String(selectedStudentId)
      );
      localStorage.removeItem("selectedStudentId");
      renderAll(filtered);
    } else {
      renderAll(enrollmentsCache);
    }

  }catch(err){
    console.error(err);
    renderRegular([]);
    renderScholarships([]);
  }
}

function renderAll(list){
  const regular      = list.filter(e => !e.scholarship || Number(e.scholarship) === 0);
  const scholarships = list.filter(e => Number(e.scholarship) === 1);

  updateStats(list);
  renderRegular(regular);
  renderScholarships(scholarships);
}

// ===============================
// STATS
// ===============================

function updateStats(list){
  const total       = list.length;
  const active      = list.filter(e => e.status === "active").length;
  const inactive    = total - active;
 const scholarship = list.filter(e => Number(e.scholarship) === 1).length;

  // Impacto financeiro das bolsas
  const impact = list
    .filter(e => e.scholarship === 1)
    .reduce((sum, e) => {
      const fee      = Number(e.monthly_fee || 0);
      const discount = Number(e.discount    || 0);
      return sum + (fee * discount / 100);
    }, 0);

  const setText = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };

  setText("statTotal",      total);
  setText("statActive",     active);
  setText("statInactive",   inactive);
  setText("statScholarship", scholarship);
  setText("statImpact",     "- " + fmt(impact));
}

// ===============================
// RENDER MATRÍCULAS (por turma)
// ===============================

function renderRegular(list){
  const container = document.getElementById("enrollmentsByClass");
  if(!container) return;

  if(list.length === 0){
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:#6b7280;">
        <div style="font-size:40px; margin-bottom:12px;">📋</div>
        <p>Nenhuma matrícula encontrada</p>
      </div>
    `;
    return;
  }

  const byClass = {};
  list.forEach(e => {
    const key = e.class_id;
    if(!byClass[key]){
      byClass[key] = {
        class_id:    key,
        class_name:  e.class_name   || "Sem turma",
        day:         e.day_of_week  || "",
        time:        e.start_time   || "",
        unit:        e.unit_name    || "",
        enrollments: []
      };
    }
    byClass[key].enrollments.push(e);
  });

  container.innerHTML = "";

  Object.values(byClass).forEach(cls => {
    const card  = document.createElement("div");
    card.className = "enrollment-class-card";

    const meta  = [cls.day, cls.time, cls.unit].filter(Boolean).join(" · ");
    const count = cls.enrollments.length;

    const rows = cls.enrollments.map(e => {
      const initials = (e.student_name || "?").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
      const roleBadge = getRoleBadge(e.role);
      const statusClass = e.status === "active" ? "green" : e.status === "paused" ? "orange" : "red";
      const statusLabel = e.status === "active" ? "Ativo" : e.status === "paused" ? "Pausado" : "Cancelado";

      return `
        <div class="enrollment-aluno-row" data-id="${e.id}">
          <div class="enrollment-aluno-left">
            <div class="enrollment-avatar">${initials}</div>
            <span class="enrollment-aluno-nome">${safe(e.student_name)}</span>
            ${roleBadge}
            <span class="enrollment-status-badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="enrollment-aluno-actions">
            <button class="btn-enrollment-edit">✏️</button>
            <button class="btn-enrollment-cancel">✖</button>
          </div>
        </div>
      `;
    }).join("");

    card.innerHTML = `
      <div class="enrollment-class-header">
        <div class="enrollment-class-info">
          <h3>${safe(cls.class_name)}</h3>
          ${meta ? `<p>${meta}</p>` : ""}
        </div>
        <span class="enrollment-class-count">${count} aluno${count !== 1 ? "s" : ""}</span>
      </div>
      <div class="enrollment-alunos">${rows}</div>
    `;

    card.querySelectorAll(".btn-enrollment-edit").forEach((btn, i) => {
      btn.onclick = () => openEditEnrollment(cls.enrollments[i]);
    });

    card.querySelectorAll(".btn-enrollment-cancel").forEach((btn, i) => {
      btn.onclick = () => cancelEnrollment(cls.enrollments[i].id);
    });

    container.appendChild(card);
  });
}

// ===============================
// RENDER BOLSISTAS
// ===============================

function renderScholarships(list){
  const container = document.getElementById("scholarshipsList");
  if(!container) return;

  if(list.length === 0){
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:#6b7280;">
        <div style="font-size:40px; margin-bottom:12px;">🎓</div>
        <p>Nenhum bolsista cadastrado</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";

  list.forEach(e => {
    const card = document.createElement("div");
    const isIntegral = Number(e.discount) === 100;
    card.className = `scholarship-item-card ${isIntegral ? "integral" : "parcial"}`;

    const initials = (e.student_name || "?").split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase();
    const roleBadge = getRoleBadge(e.role);

    const fee      = Number(e.monthly_fee || 0);
    const discount = Number(e.discount    || 0);
    const impact   = fee * discount / 100;
    const final    = fee - impact;

    const tipoBadge = isIntegral
      ? `<span class="scholarship-tipo integral">Integral</span>`
      : `<span class="scholarship-tipo parcial">Parcial ${discount}%</span>`;

    const statusClass = e.status === "active" ? "green" : e.status === "paused" ? "orange" : "red";
    const statusLabel = e.status === "active" ? "Ativo" : e.status === "paused" ? "Pausado" : "Cancelado";

    card.innerHTML = `
      <div class="scholarship-card-header">
        <div class="scholarship-card-left">
          <div class="enrollment-avatar">${initials}</div>
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="enrollment-aluno-nome">${safe(e.student_name)}</span>
              ${tipoBadge}
              ${roleBadge}
              <span class="enrollment-status-badge ${statusClass}">${statusLabel}</span>
            </div>
            <div style="font-size:12px; color:#6b7280; margin-top:2px;">${safe(e.class_name)}</div>
          </div>
        </div>
        <div class="scholarship-card-actions">
          <button class="btn-enrollment-edit sc-edit">✏️ Editar</button>
          <button class="btn-enrollment-cancel sc-cancel">✖ Remover</button>
        </div>
      </div>
      <div class="scholarship-card-impact">
        <div class="impact-item">
          <span>Mensalidade original</span>
          <strong>${fmt(fee)}</strong>
        </div>
        <div class="impact-item">
          <span>Desconto</span>
          <strong>${discount}%</strong>
        </div>
        <div class="impact-item">
          <span>Paga</span>
          <strong>${fmt(final)}</strong>
        </div>
        <div class="impact-item red">
          <span>Impacto mensal</span>
          <strong>- ${fmt(impact)}</strong>
        </div>
      </div>
    `;

    card.querySelector(".sc-edit").onclick   = () => openEditScholarship(e);
    card.querySelector(".sc-cancel").onclick = () => cancelEnrollment(e.id);

    container.appendChild(card);
  });
}

// ===============================
// SAVE MATRÍCULA
// ===============================

async function saveEnrollment(){
  const studentId = document.getElementById("editEnrollmentStudent").value;
  const classId   = document.getElementById("editEnrollmentClass").value;
  const role      = document.getElementById("editEnrollmentRole").value;
  const type      = document.getElementById("editEnrollmentType").value;
  const fee       = Number(document.getElementById("editEnrollmentFee").value || 0);
  const discount  = Number(document.getElementById("editEnrollmentDiscount").value || 0);
  const status    = document.getElementById("editEnrollmentStatus").value;

  if(!studentId || !classId){ Toast.warning("Selecione aluno e turma"); return; }
  if(discount > 100){ Toast.warning("Desconto não pode ser maior que 100%"); return; }

  const finalPrice = Math.max(0, fee - (fee * discount / 100));

  const duplicate = enrollmentsCache.find(e =>
    e.student_id === studentId &&
    e.class_id   === classId   &&
    e.id !== editingEnrollmentId
  );
  if(duplicate){ Toast.warning("Este aluno já está matriculado nesta turma"); return; }

  try{
    const endpoint = editingEnrollmentId
      ? `/api/v1/enrollments/${editingEnrollmentId}`
      : "/api/v1/enrollments";
    const method = editingEnrollmentId ? "PUT" : "POST";

    const res = await apiRequest(endpoint, method, {
      student_id:  studentId,
      class_id:    classId,
      role, type,
      monthly_fee: fee,
      discount,
      final_price: finalPrice,
      status,
      scholarship: 0
    });

    if(!res || !res.success){ Toast.error("Erro ao salvar matrícula"); return; }

    Toast.success(editingEnrollmentId ? "Matrícula atualizada!" : "Matrícula criada!");
    editingEnrollmentId = null;
    closeEnrollmentModal();
    await loadEnrollments();

  }catch(err){
    console.error(err);
    Toast.error("Erro na API");
  }
}

// ===============================
// SAVE BOLSA
// ===============================

async function saveScholarship(){
  const studentId = document.getElementById("editScholarshipStudent").value;
  const classId   = document.getElementById("editScholarshipClass").value;
  const role      = document.getElementById("editScholarshipRole").value;
  const type      = document.getElementById("editScholarshipType").value;
  const fee       = Number(document.getElementById("editScholarshipFee").value || 0);
  const status    = document.getElementById("editScholarshipStatus").value;

  const discount = type === "100" ? 100 : Number(document.getElementById("editScholarshipDiscount").value || 0);

  if(!studentId || !classId){
    Toast.warning("Selecione aluno e turma");
    return;
  }

  // 🔥 Mensalidade obrigatória sempre
  if(!fee || fee <= 0){
    Toast.warning(
      type === "100"
        ? "Informe a mensalidade original — usada para calcular o impacto da bolsa"
        : "Informe a mensalidade original"
    );
    // 🔥 Destaca o campo
    const feeEl = document.getElementById("editScholarshipFee");
    if(feeEl){
      feeEl.focus();
      feeEl.style.borderColor = "#dc2626";
      setTimeout(() => feeEl.style.borderColor = "", 2000);
    }
    return;
  }

  if(type !== "100" && (!discount || discount <= 0 || discount >= 100)){
    Toast.warning("Informe um desconto entre 1% e 99% para bolsa parcial");
    return;
  }
  
  const duplicate = enrollmentsCache.find(e =>
    e.student_id === studentId &&
    e.class_id   === classId   &&
    e.id !== editingScholarshipId
  );
  if(duplicate){ Toast.warning("Este aluno já está matriculado nesta turma"); return; }

  const finalPrice = Math.max(0, fee - (fee * discount / 100));

  if(discount === 100){
    const ok = confirm(
      "Bolsa integral — este aluno não entrará nos recebimentos financeiros.\nConfirmar?"
    );
    if(!ok) return;
  }

  try{
    const endpoint = editingScholarshipId
      ? `/api/v1/enrollments/${editingScholarshipId}`
      : "/api/v1/enrollments";
    const method = editingScholarshipId ? "PUT" : "POST";

    const res = await apiRequest(endpoint, method, {
      student_id:  studentId,
      class_id:    classId,
      role,
      type:        "individual",
      monthly_fee: fee,
      discount,
      final_price: finalPrice,
      status,
      scholarship: 1
    });

    if(!res || !res.success){ Toast.error("Erro ao salvar bolsa"); return; }

    Toast.success(editingScholarshipId ? "Bolsa atualizada!" : "Bolsa criada!");
    editingScholarshipId = null;
    closeScholarshipModal();
    await loadEnrollments();

    // Muda para aba bolsistas após criar
    document.querySelector('[data-tab="scholarship"]')?.click();

  }catch(err){
    console.error(err);
    Toast.error("Erro na API");
  }
}

// ===============================
// CANCEL ENROLLMENT
// ===============================

async function cancelEnrollment(id){
  if(!confirm("Deseja cancelar esta matrícula?")) return;

  try{
    const res = await apiRequest(`/api/v1/enrollments/${id}`, "DELETE");
    if(!res || !res.success){ Toast.error("Erro ao cancelar matrícula"); return; }
    Toast.success("Matrícula cancelada!");
    await loadEnrollments();
  }catch(err){
    console.error(err);
    Toast.error("Erro na API");
  }
}

// ===============================
// OPEN EDIT MATRÍCULA
// ===============================

async function openEditEnrollment(enrollment){
  editingEnrollmentId = enrollment.id;
  await loadEnrollmentFormData();

  document.getElementById("editEnrollmentStudent").value  = enrollment.student_id;
  document.getElementById("editEnrollmentClass").value    = enrollment.class_id;
  document.getElementById("editEnrollmentRole").value     = enrollment.role     || "conductor_m";
  document.getElementById("editEnrollmentType").value     = enrollment.type     || "individual";
  document.getElementById("editEnrollmentFee").value      = enrollment.monthly_fee || 0;
  document.getElementById("editEnrollmentDiscount").value = enrollment.discount || 0;
  document.getElementById("editEnrollmentStatus").value   = enrollment.status   || "active";

  const title = document.getElementById("enrollmentModalTitle");
  if(title) title.innerText = "Editar Matrícula";

  document.getElementById("enrollmentModal").classList.remove("hidden");
}

// ===============================
// OPEN EDIT BOLSA
// ===============================

async function openEditScholarship(enrollment){
  editingScholarshipId = enrollment.id;
  await loadScholarshipFormData();

  document.getElementById("editScholarshipStudent").value = enrollment.student_id;
  document.getElementById("editScholarshipClass").value   = enrollment.class_id;
  document.getElementById("editScholarshipRole").value    = enrollment.role   || "conductor_m";
  document.getElementById("editScholarshipStatus").value  = enrollment.status || "active";
  document.getElementById("editScholarshipFee").value     = enrollment.monthly_fee || 0;

  const discount = Number(enrollment.discount || 0);
  if(discount === 100){
    document.getElementById("editScholarshipType").value = "100";
    document.getElementById("scholarshipDiscountGroup").style.display = "none";
  } else {
    document.getElementById("editScholarshipType").value     = "partial";
    document.getElementById("editScholarshipDiscount").value = discount;
    document.getElementById("scholarshipDiscountGroup").style.display = "";
  }

  const title = document.getElementById("scholarshipModalTitle");
  if(title) title.innerText = "Editar Bolsa";

  updateScholarshipImpact();
  document.getElementById("scholarshipModal").classList.remove("hidden");
}

// ===============================
// SCHOLARSHIP IMPACT PREVIEW
// ===============================

function updateScholarshipType(){
  const type = document.getElementById("editScholarshipType")?.value;
  const group = document.getElementById("scholarshipDiscountGroup");
  if(group) group.style.display = type === "partial" ? "" : "none";
  updateScholarshipImpact();
}

function updateScholarshipImpact(){
  const fee      = Number(document.getElementById("editScholarshipFee")?.value || 0);
  const type     = document.getElementById("editScholarshipType")?.value;
  const discount = type === "100" ? 100 : Number(document.getElementById("editScholarshipDiscount")?.value || 0);

  const impact    = fee * discount / 100;
  const final     = fee - impact;
  const impactEl  = document.getElementById("scholarshipImpact");
  const impactTxt = document.getElementById("scholarshipImpactText");

  if(fee > 0 && discount > 0){
    if(impactEl)  impactEl.style.display = "";
    if(impactTxt) impactTxt.innerText =
      `Mensalidade original: ${fmt(fee)} → Paga: ${fmt(final)} → Impacto: - ${fmt(impact)}`;
  } else {
    if(impactEl) impactEl.style.display = "none";
  }
}

// ===============================
// FORM DATA
// ===============================

async function loadEnrollmentFormData(){
  await populateSelect("editEnrollmentStudent", "/api/v1/students");
  await populateSelect("editEnrollmentClass",   "/api/v1/classes");
}

async function loadScholarshipFormData(){
  await populateSelect("editScholarshipStudent", "/api/v1/students");
  await populateSelect("editScholarshipClass",   "/api/v1/classes");
}

async function populateSelect(id, endpoint){
  const select = document.getElementById(id);
  if(!select) return;

  try{
    const res  = await apiRequest(endpoint);
    const list = res?.data || [];
    select.innerHTML = `<option value="">Selecione...</option>`;
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
// CLOSE MODALS
// ===============================

function closeEnrollmentModal(){
  document.getElementById("enrollmentModal")?.classList.add("hidden");
  resetEnrollmentForm();
  editingEnrollmentId = null;
}

function closeScholarshipModal(){
  document.getElementById("scholarshipModal")?.classList.add("hidden");
  resetScholarshipForm();
  editingScholarshipId = null;
}

// ===============================
// RESET FORMS
// ===============================

function resetEnrollmentForm(){
  const ids = ["editEnrollmentStudent","editEnrollmentClass","editEnrollmentFee","editEnrollmentDiscount"];
  ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
  const role = document.getElementById("editEnrollmentRole");     if(role)   role.value   = "conductor_m";
  const type = document.getElementById("editEnrollmentType");     if(type)   type.value   = "individual";
  const stat = document.getElementById("editEnrollmentStatus");   if(stat)   stat.value   = "active";
  const title = document.getElementById("enrollmentModalTitle");  if(title)  title.innerText = "Nova Matrícula";
}

function resetScholarshipForm(){
  const ids = ["editScholarshipStudent","editScholarshipClass","editScholarshipFee","editScholarshipDiscount"];
  ids.forEach(id => { const el = document.getElementById(id); if(el) el.value = ""; });
  const role  = document.getElementById("editScholarshipRole");   if(role)  role.value  = "conductor_m";
  const type  = document.getElementById("editScholarshipType");   if(type)  type.value  = "100";
  const stat  = document.getElementById("editScholarshipStatus"); if(stat)  stat.value  = "active";
  const title = document.getElementById("scholarshipModalTitle"); if(title) title.innerText = "Nova Bolsa";
  const group = document.getElementById("scholarshipDiscountGroup"); if(group) group.style.display = "none";
  const impact = document.getElementById("scholarshipImpact");    if(impact) impact.style.display = "none";
}

// ===============================
// FILTER
// ===============================

function filterEnrollments(){
  const search = document.getElementById("searchEnrollments");
  if(!search) return;

  const term = search.value.toLowerCase();

  if(term === ""){
    renderAll(enrollmentsCache);
    return;
  }

  const filtered = enrollmentsCache.filter(e =>
    (e.student_name || "").toLowerCase().includes(term) ||
    (e.class_name   || "").toLowerCase().includes(term)
  );

  renderAll(filtered);
}

// ===============================
// HELPERS
// ===============================

function getRoleBadge(role){
  const map = {
    conductor_m: { label: "Condutor",  cls: "blue"   },
    conductor:   { label: "Condutor",  cls: "blue"   },
    conductor_f: { label: "Condutora", cls: "pink"   },
    follower_f:  { label: "Conduzida", cls: "green"  },
    follower:    { label: "Conduzida", cls: "green"  },
    follower_m:  { label: "Conduzido", cls: "orange" },
  };
  const r = map[role];
  if(!r) return `<span class="enrollment-role-badge gray">${role || "-"}</span>`;
  return `<span class="enrollment-role-badge ${r.cls}">${r.label}</span>`;
}

function safe(value){
  if(value === null || value === undefined) return "-";
  return value;
}

// ===============================
// EXPORTS
// ===============================

window.EnrollmentsModule = {
  init,
  loadEnrollments,
  saveEnrollment,
  saveScholarship,
  updateScholarshipType
};

})();