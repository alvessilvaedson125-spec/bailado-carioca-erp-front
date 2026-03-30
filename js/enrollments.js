(function(){

let enrollmentsCache = []
let editingEnrollmentId = null
let initDone = false;
let currentPage = 1;
let currentList = [];
const PAGE_SIZE = 15;
async function init(){

  if (initDone) {
    await loadEnrollments();
    attach();              // 🔥 re-registra botões ao voltar
    setupScholarshipHint(); // 🔥 re-registra hint ao voltar
    return;
  }
  initDone = true;

  console.log("Enrollments module iniciado")

  attach()
  setupScholarshipHint()

  await loadEnrollments()

  const cancelBtn = document.getElementById("cancelEnrollmentBtn")
  if(cancelBtn) cancelBtn.onclick = closeEnrollmentModal

  const modal = document.getElementById("enrollmentModal")
  if(modal){
    modal.addEventListener("click",(e)=>{
      if(e.target === modal) closeEnrollmentModal()
    })
  }

  const searchInput = document.getElementById("searchEnrollments");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        currentPage = 1;
        filterEnrollments();
      }, 300);
    });
  }

}
/* =========================
SCHOLARSHIP HINT
========================= */

function setupScholarshipHint(){
  const checkbox = document.getElementById("editEnrollmentScholarship");
  const discount = document.getElementById("editEnrollmentDiscount");
  const hint     = document.getElementById("scholarshipHint");

  if(!checkbox) return;

  function updateHint(){
    if(!hint) return;
    if(!checkbox.checked){
      hint.innerText = "";
      return;
    }

    const d = Number(discount?.value || 0);
    if(d === 100){
      hint.innerText = "⚠️ Bolsa integral — não entra nos recebimentos";
      hint.style.color = "#dc2626";
    } else if(d > 0){
      hint.innerText = `✅ Bolsa parcial de ${d}% — entra nos recebimentos com desconto`;
      hint.style.color = "#16a34a";
    } else {
      hint.innerText = "ℹ️ Bolsista sem desconto definido";
      hint.style.color = "#6b7280";
    }
  }

  checkbox.addEventListener("change", updateHint);
  discount?.addEventListener("input", updateHint);
}

/* =========================
EVENTS
========================= */

function attach(){

  const newBtn    = document.getElementById("newEnrollmentBtn")
  const modal     = document.getElementById("enrollmentModal")
  const cancelBtn = document.getElementById("cancelEnrollmentBtn")
  const saveBtn   = document.getElementById("saveEnrollmentBtn")

  if(newBtn){
    newBtn.onclick = async () => {
      editingEnrollmentId = null
      resetEnrollmentForm()
      await loadEnrollmentFormData()
      if(modal) modal.classList.remove("hidden")
    }
  }

  if(cancelBtn){
    cancelBtn.onclick = () => {
      if(modal) modal.classList.add("hidden")
    }
  }

  if(saveBtn){
    saveBtn.onclick = saveEnrollment
  }

}

/* =========================
LOAD DATA
========================= */

async function loadEnrollments(){

  try {

    const res = await apiRequest("/api/v1/enrollments");

    if(!res || !res.success){
      renderEnrollments([]);
      return;
    }

    enrollmentsCache = res.data || [];

    const selectedStudentId = localStorage.getItem("selectedStudentId");

    if(selectedStudentId){
      const filtered = enrollmentsCache.filter(e =>
        String(e.student_id) === String(selectedStudentId)
      );
      currentPage = 1;
      renderEnrollments(filtered);
      localStorage.removeItem("selectedStudentId");
    } else {
      currentPage = 1;
      renderEnrollments();
    }

  } catch (err) {
    console.error(err);
    renderEnrollments([]);
  }

}

/* =========================
FORM DATA
========================= */

async function loadEnrollmentFormData(){
  await populateStudents()
  await populateClasses()
}

async function populateStudents(){
  const select = document.getElementById("editEnrollmentStudent")
  if(!select) return

  try{
    const res = await apiRequest("/api/v1/students")
    const list = res.data || []

    select.innerHTML = `<option value="">Selecione...</option>`

    list.forEach(student=>{
      const option = document.createElement("option")
      option.value = student.id
      option.textContent = student.name
      select.appendChild(option)
    })

  }catch(err){
    console.error("Erro alunos", err)
  }
}

async function populateClasses(){
  const select = document.getElementById("editEnrollmentClass")
  if(!select) return

  try{
    const res = await apiRequest("/api/v1/classes")
    const list = res.data || []

    select.innerHTML = `<option value="">Selecione...</option>`

    list.forEach(cls=>{
      const option = document.createElement("option")
      option.value = cls.id
      option.textContent = cls.name
      select.appendChild(option)
    })

  }catch(err){
    console.error("Erro turmas", err)
  }
}

/* =========================
SAVE
========================= */

async function saveEnrollment(){

  const studentId  = document.getElementById("editEnrollmentStudent").value
  const classId    = document.getElementById("editEnrollmentClass").value
  const role       = document.getElementById("editEnrollmentRole").value
  const type       = document.getElementById("editEnrollmentType").value
  const fee        = Number(document.getElementById("editEnrollmentFee").value || 0)
  const discount   = Number(document.getElementById("editEnrollmentDiscount").value || 0)
  const status     = document.getElementById("editEnrollmentStatus").value
  const scholarship = document.getElementById("editEnrollmentScholarship").checked

  if(!studentId || !classId){
    Toast.warning("Selecione aluno e turma")
    return
  }

  if(discount > 100){
    Toast.warning("Desconto não pode ser maior que 100%")
    return
  }

  if(discount > fee && fee > 0){
    Toast.warning("Desconto não pode ser maior que a mensalidade")
    return
  }

  // 🔥 Bolsista integral — aviso
  if(scholarship && discount === 100 && fee > 0){
    const ok = confirm(
      "Este aluno tem bolsa integral (100% de desconto).\n" +
      "Ele não entrará nos recebimentos financeiros.\n\n" +
      "Confirmar?"
    );
    if(!ok) return;
  }

  const finalPrice = Math.max(0, fee - (fee * discount / 100))

  const duplicate = enrollmentsCache.find(e =>
    e.student_id === studentId &&
    e.class_id === classId &&
    e.id !== editingEnrollmentId
  )

  if(duplicate){
    Toast.warning("Este aluno já está matriculado nesta turma")
    return
  }

  try{

    const endpoint = editingEnrollmentId
      ? `/api/v1/enrollments/${editingEnrollmentId}`
      : "/api/v1/enrollments"

    const method = editingEnrollmentId ? "PUT" : "POST"

    const res = await apiRequest(endpoint, method, {
      student_id:  studentId,
      class_id:    classId,
      role,
      type,
      monthly_fee: fee,
      discount,
      final_price: finalPrice,
      status,
      scholarship  // 🔥 NOVO
    })

    if(!res || !res.success){
      Toast.error("Erro ao salvar matrícula")
      return
    }

    Toast.success(editingEnrollmentId ? "Matrícula atualizada!" : "Matrícula criada!")
    editingEnrollmentId = null
    closeEnrollmentModal()
    await loadEnrollments()

  }catch(err){
    console.error(err)
    Toast.error("Erro na API")
  }

}

/* =========================
CANCEL ENROLLMENT
========================= */

async function cancelEnrollment(id){

  if(!confirm("Deseja cancelar esta matrícula?")) return

  try{

    const res = await apiRequest(`/api/v1/enrollments/${id}`, "DELETE")

    if(!res || !res.success){
      Toast.error("Erro ao cancelar matrícula")
      return
    }

    Toast.success("Matrícula cancelada!")
    await loadEnrollments()

  }catch(err){
    console.error(err)
    Toast.error("Erro na API")
  }

}

/* =========================
RENDER
========================= */
function renderEnrollments(list = enrollmentsCache){

  const container = document.getElementById("enrollmentsByClass");
  if(!container) return;

  currentList = list;

  // Stats
  const total       = list.length;
  const active      = list.filter(e => e.status === "active").length;
  const inactive    = total - active;
  const scholarship = list.filter(e => e.scholarship === 1).length;

  const statTotal       = document.getElementById("statTotal");
  const statActive      = document.getElementById("statActive");
  const statInactive    = document.getElementById("statInactive");
  const statScholarship = document.getElementById("statScholarship");

  if(statTotal)       statTotal.innerText       = total;
  if(statActive)      statActive.innerText      = active;
  if(statInactive)    statInactive.innerText    = inactive;
  if(statScholarship) statScholarship.innerText = scholarship;

  if(list.length === 0){
    container.innerHTML = `
      <div style="text-align:center; padding:60px 20px; color:#6b7280;">
        <div style="font-size:40px; margin-bottom:12px;">📋</div>
        <p>Nenhuma matrícula encontrada</p>
      </div>
    `;
    return;
  }

  // 🔥 Agrupa por turma
  const byClass = {};

  list.forEach(e => {
    const key  = e.class_id;
    const name = e.class_name || "Sem turma";

    if(!byClass[key]){
      byClass[key] = {
        class_id:   key,
        class_name: name,
        day:        e.day_of_week  || "",
        time:       e.start_time   || "",
        unit:       e.unit_name    || "",
        enrollments: []
      };
    }

    byClass[key].enrollments.push(e);
  });

  // 🔥 Busca turmas sem alunos também — via cache de turmas
  // (apenas turmas que aparecem nas matrículas filtradas)

  container.innerHTML = "";

  Object.values(byClass).forEach(cls => {

    const card = document.createElement("div");
    card.className = "enrollment-class-card";

    const meta = [cls.day, cls.time, cls.unit].filter(Boolean).join(" · ");
    const count = cls.enrollments.length;

    const alunosRows = cls.enrollments.map(enrollment => {

      const initials = (enrollment.student_name || "?")
        .split(" ")
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      const roleBadge = getRoleBadge(enrollment.role);

      const scholarshipBadge = enrollment.scholarship === 1
        ? Number(enrollment.discount) === 100
          ? `<span class="enrollment-badge-scholarship red">Integral</span>`
          : `<span class="enrollment-badge-scholarship blue">Parcial ${enrollment.discount}%</span>`
        : "";

      const statusClass = enrollment.status === "active" ? "green"
        : enrollment.status === "paused" ? "orange"
        : "red";

      const statusLabel = enrollment.status === "active" ? "Ativo"
        : enrollment.status === "paused" ? "Pausado"
        : "Cancelado";

      return `
        <div class="enrollment-aluno-row" data-id="${enrollment.id}">
          <div class="enrollment-aluno-left">
            <div class="enrollment-avatar">${initials}</div>
            <span class="enrollment-aluno-nome">${safe(enrollment.student_name)}</span>
            ${roleBadge}
            ${scholarshipBadge}
            <span class="enrollment-status-badge ${statusClass}">${statusLabel}</span>
          </div>
          <div class="enrollment-aluno-actions">
            <button class="btn-enrollment-edit" title="Editar">✏️</button>
            <button class="btn-enrollment-cancel" title="Cancelar matrícula">✖</button>
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
      <div class="enrollment-alunos">
        ${alunosRows || `<div class="enrollment-empty">Nenhum aluno matriculado</div>`}
      </div>
    `;

    // Eventos
    card.querySelectorAll(".btn-enrollment-edit").forEach((btn, i) => {
      btn.onclick = () => openEditEnrollment(cls.enrollments[i]);
    });

    card.querySelectorAll(".btn-enrollment-cancel").forEach((btn, i) => {
      btn.onclick = () => cancelEnrollment(cls.enrollments[i].id);
    });

    container.appendChild(card);
  });
}

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
/* =========================
PAGINAÇÃO
========================= */

function renderPagination(total){

  let container = document.getElementById("enrollmentsPagination");

  if(!container){
    container = document.createElement("div");
    container.id = "enrollmentsPagination";
    container.className = "pagination";
    const table = document.getElementById("enrollmentsTable");
    if(table) table.after(container);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if(totalPages <= 1){
    container.innerHTML = "";
    return;
  }

  const start = ((currentPage - 1) * PAGE_SIZE) + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, total);

  container.innerHTML = `
    <div class="pagination-info">${start}–${end} de ${total} matrículas</div>
    <div class="pagination-controls">
      <button class="pagination-btn" id="enrollmentsPrev" ${currentPage === 1 ? "disabled" : ""}>← Anterior</button>
      <span class="pagination-page">${currentPage} / ${totalPages}</span>
      <button class="pagination-btn" id="enrollmentsNext" ${currentPage === totalPages ? "disabled" : ""}>Próximo →</button>
    </div>
  `;

  document.getElementById("enrollmentsPrev").onclick = () => {
    if(currentPage > 1){ currentPage--; renderEnrollments(currentList); }
  };

  document.getElementById("enrollmentsNext").onclick = () => {
    if(currentPage < totalPages){ currentPage++; renderEnrollments(currentList); }
  };

}

/* =========================
EDIT ENROLLMENT
========================= */

async function openEditEnrollment(enrollment){

  editingEnrollmentId = enrollment.id

  await loadEnrollmentFormData()

  document.getElementById("editEnrollmentStudent").value    = enrollment.student_id
  document.getElementById("editEnrollmentClass").value      = enrollment.class_id
  document.getElementById("editEnrollmentRole").value       = enrollment.role       || "conductor"
  document.getElementById("editEnrollmentType").value       = enrollment.type       || "individual"
  document.getElementById("editEnrollmentFee").value        = enrollment.monthly_fee || 0
  document.getElementById("editEnrollmentDiscount").value   = enrollment.discount   || 0
  document.getElementById("editEnrollmentStatus").value     = enrollment.status     || "active"

  // 🔥 Bolsista
  const scholarshipEl = document.getElementById("editEnrollmentScholarship")
  if(scholarshipEl) scholarshipEl.checked = enrollment.scholarship === 1

  // Atualiza hint
  const hint = document.getElementById("scholarshipHint")
  if(hint && enrollment.scholarship === 1){
    const d = Number(enrollment.discount || 0);
    if(d === 100){
      hint.innerText = "⚠️ Bolsa integral — não entra nos recebimentos";
      hint.style.color = "#dc2626";
    } else {
      hint.innerText = `✅ Bolsa parcial de ${d}%`;
      hint.style.color = "#16a34a";
    }
  }

  // Título do modal
  const title = document.getElementById("enrollmentModalTitle")
  if(title) title.innerText = "Editar Matrícula"

  document.getElementById("enrollmentModal").classList.remove("hidden")

}

/* =========================
HELPERS
========================= */

function closeEnrollmentModal(){
  const modal = document.getElementById("enrollmentModal")
  if(modal) modal.classList.add("hidden")
  resetEnrollmentForm()
  editingEnrollmentId = null
}

function formatRole(role){
  if(role === "conductor_m" || role === "conductor") return "Condutor";
  if(role === "conductor_f") return "Condutora";
  if(role === "follower_f"  || role === "follower")  return "Conduzida";
  if(role === "follower_m")  return "Conduzido";
  return role || "-";
}

function formatDate(date){
  if(!date) return "-"
  return new Date(date).toLocaleDateString("pt-BR")
}

function safe(value){
  if(value === null || value === undefined) return "-"
  return value
}
function resetEnrollmentForm(){
  document.getElementById("editEnrollmentStudent").value  = ""
  document.getElementById("editEnrollmentClass").value    = ""
  document.getElementById("editEnrollmentRole").value     = "conductor_m" // 🔥 padrão atualizado
  document.getElementById("editEnrollmentType").value     = "individual"
  document.getElementById("editEnrollmentFee").value      = ""
  document.getElementById("editEnrollmentDiscount").value = 0
  document.getElementById("editEnrollmentStatus").value   = "active"

  const scholarshipEl = document.getElementById("editEnrollmentScholarship")
  if(scholarshipEl) scholarshipEl.checked = false

  const hint = document.getElementById("scholarshipHint")
  if(hint) hint.innerText = ""

  const title = document.getElementById("enrollmentModalTitle")
  if(title) title.innerText = "Nova Matrícula"
}

let searchTimeout = null;

function filterEnrollments(){
  const search = document.getElementById("searchEnrollments")
  if(!search) return

  const term = search.value.toLowerCase()

  if(term === ""){
    renderEnrollments(enrollmentsCache)
    return
  }

  const filtered = enrollmentsCache.filter(e =>
    e.student_name.toLowerCase().includes(term) ||
    e.class_name.toLowerCase().includes(term)
  )

  renderEnrollments(filtered)
}

window.EnrollmentsModule = {
  init,
  loadEnrollments,
  saveEnrollment
};

})();