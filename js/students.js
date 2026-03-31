(function(){

let studentsCache = [];
let enrollmentsMap = {};
let currentPage = 1;
const PAGE_SIZE = 15;

async function init(){
  console.log("Students module iniciado");
  // 🔥 removido checkAuth() — já executado pelo router.js

  const search = document.getElementById("searchStudents");
  if(search){
    search.addEventListener("input", () => {
      currentPage = 1;
      filterStudents();
    });
  }

  const newBtn = document.getElementById("newStudentBtn");
  if(newBtn){
    newBtn.onclick = newStudent;
  }

  setupModal();
  await loadData();
}

// ===============================
// LOAD DATA
// ===============================

async function loadData(){

  const tableBody = document.querySelector("#studentsTable tbody");
  if(!tableBody) return;

  tableBody.innerHTML = "<tr><td colspan='5'>Carregando...</td></tr>";

  try{

    const [studentsRes, enrollmentsRes] = await Promise.all([
      apiRequest("/api/v1/students"),
      apiRequest("/api/v1/enrollments")
    ]);

    if(!studentsRes.success){
      tableBody.innerHTML = "<tr><td colspan='5'>Erro ao carregar alunos</td></tr>";
      return;
    }

    studentsCache = studentsRes.data || [];

    buildEnrollmentsMap(enrollmentsRes);

    // 🔥 Contador
    const countEl = document.getElementById("studentsCount");
    if(countEl){
      const n = studentsCache.length;
      countEl.innerText = `${n} aluno${n !== 1 ? "s" : ""} cadastrado${n !== 1 ? "s" : ""}`;
    }

    currentPage = 1;
    renderStudents(studentsCache);

  }catch(err){
    console.error(err);
    tableBody.innerHTML = "<tr><td colspan='5'>Erro na API</td></tr>";
  }

}

// ===============================
// ENROLLMENTS MAP
// ===============================

function buildEnrollmentsMap(res){

  enrollmentsMap = {};

  if(!res || !res.success || !res.data){
    console.warn("Enrollments indisponível — mantendo estado neutro");
    return;
  }

  res.data.forEach(enrollment => {
    const studentId = enrollment.student_id;
    if(enrollment.status === "active"){
      enrollmentsMap[studentId] = true;
    }
  });

}

function isStudentActive(studentId){
  return !!enrollmentsMap[studentId];
}

// ===============================
// PERFIL DO ALUNO
// ===============================

async function openStudentProfile(student){
  const modal = document.getElementById("studentProfileModal");
  if(!modal) return;

  // Cabeçalho
  const initials = getInitials(student.name);
  document.getElementById("profileAvatar").innerText    = initials;
  document.getElementById("profileName").innerText      = student.name;
  document.getElementById("profileEmail").innerText     = student.email  || "-";
  document.getElementById("profilePhone").innerText     = student.phone  || "-";

  // Carrega matrículas do aluno
  const profileEnrollments = document.getElementById("profileEnrollments");
  profileEnrollments.innerHTML = `<p style="color:#6b7280; font-size:13px;">Carregando...</p>`;

  modal.classList.remove("hidden");

  try{
    const res = await apiRequest("/api/v1/enrollments");
    const all = res?.data || [];
    const studentEnrollments = all.filter(e =>
      String(e.student_id) === String(student.id)
    );

    if(studentEnrollments.length === 0){
      profileEnrollments.innerHTML = `
        <p style="color:#6b7280; font-size:13px; text-align:center; padding:20px 0;">
          Nenhuma matrícula encontrada
        </p>`;
    } else {
      const roleMap = {
        conductor_m: { label: "Condutor",  cls: "blue"   },
        conductor_f: { label: "Condutora", cls: "pink"   },
        follower_f:  { label: "Conduzida", cls: "green"  },
        follower_m:  { label: "Conduzido", cls: "orange" },
        conductor:   { label: "Condutor",  cls: "blue"   },
        follower:    { label: "Conduzida", cls: "green"  },
      };

      profileEnrollments.innerHTML = studentEnrollments.map(e => {
        const role      = roleMap[e.role] || { label: e.role, cls: "gray" };
        const statusCls = e.status === "active" ? "green" : e.status === "paused" ? "orange" : "red";
        const statusLbl = e.status === "active" ? "Ativo" : e.status === "paused" ? "Pausado" : "Cancelado";
        const fee       = Number(e.monthly_fee || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
        const meta      = [e.day_of_week, e.start_time, e.unit_name].filter(Boolean).join(" · ");

        return `
          <div class="profile-enrollment-card">
            <div class="profile-enrollment-left">
              <div class="profile-enrollment-class">${e.class_name || "-"}</div>
              ${meta ? `<div class="profile-enrollment-meta">${meta}</div>` : ""}
              <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
                <span class="enrollment-role-badge ${role.cls}">${role.label}</span>
                <span class="enrollment-status-badge ${statusCls}">${statusLbl}</span>
                ${Number(e.scholarship) === 1 ? `<span class="scholarship-tipo ${Number(e.discount) === 100 ? "integral" : "parcial"}">${Number(e.discount) === 100 ? "Bolsa integral" : `Bolsa ${e.discount}%`}</span>` : ""}
              </div>
            </div>
            <div class="profile-enrollment-right">
              <strong class="profile-enrollment-fee">${fee}</strong>
              <span style="font-size:11px; color:#6b7280;">por mês</span>
            </div>
          </div>
        `;
      }).join("");
    }

  }catch(err){
    profileEnrollments.innerHTML = `<p style="color:#dc2626; font-size:13px;">Erro ao carregar matrículas</p>`;
  }

  // Botão matricular em nova turma
  const newEnrollBtn = document.getElementById("profileNewEnrollBtn");
  if(newEnrollBtn){
    newEnrollBtn.onclick = () => {
      closeStudentProfile();
      localStorage.setItem("selectedStudentId", student.id);
      localStorage.setItem("openEnrollmentModal", "1");
      window.location.hash = "enrollments";
    };
  }
}

function closeStudentProfile(){
  document.getElementById("studentProfileModal")?.classList.add("hidden");
}
// ===============================
// PAGINAÇÃO
// ===============================

function renderPagination(total, list = []){

  let container = document.getElementById("studentsPagination");

  if(!container){
    container = document.createElement("div");
    container.id = "studentsPagination";
    container.className = "pagination";
    const table = document.getElementById("studentsTable");
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
    <div class="pagination-info">${start}–${end} de ${total} alunos</div>
    <div class="pagination-controls">
      <button class="pagination-btn" id="studentsPrev" ${currentPage === 1 ? "disabled" : ""}>← Anterior</button>
      <span class="pagination-page">${currentPage} / ${totalPages}</span>
      <button class="pagination-btn" id="studentsNext" ${currentPage === totalPages ? "disabled" : ""}>Próximo →</button>
    </div>
  `;

  document.getElementById("studentsPrev").onclick = () => {
    if(currentPage > 1){
      currentPage--;
      renderStudents(list);
    }
  };

  document.getElementById("studentsNext").onclick = () => {
    if(currentPage < totalPages){
      currentPage++;
      renderStudents(list);
    }
  };

}
// ===============================
// NAVIGATION — abre perfil inline
// ===============================

function goToStudentEnrollments(studentId){
  const student = studentsCache.find(s => s.id === studentId);
  if(student) openStudentProfile(student);
}

function getInitials(name){
  return name
    .split(" ")
    .map(n => n[0])
    .slice(0,2)
    .join("")
    .toUpperCase();
}

// ===============================
// FILTER
// ===============================

function filterStudents(){

  const search = document.getElementById("searchStudents");
  if(!search) return;

  const term = search.value.toLowerCase();

  if(term === ""){
    renderStudents(studentsCache);
    return;
  }

  const filtered = studentsCache.filter(student =>
    student.name.toLowerCase().includes(term) ||
    student.email.toLowerCase().includes(term)
  );

  renderStudents(filtered);

}

// ===============================
// EDIT / NEW
// ===============================

function editStudent(id){

  const student = studentsCache.find(s => s.id === id);
  if(!student) return;

  document.getElementById("editStudentId").value    = student.id;
  document.getElementById("editStudentName").value  = student.name;
  document.getElementById("editStudentEmail").value = student.email;
  document.getElementById("editStudentPhone").value = student.phone || "";

  document.getElementById("modalTitle").innerText = "Editar aluno";
  document.getElementById("studentModal").classList.remove("hidden");

}

function newStudent(){

  document.getElementById("editStudentId").value    = "";
  document.getElementById("editStudentName").value  = "";
  document.getElementById("editStudentEmail").value = "";
  document.getElementById("editStudentPhone").value = "";

  document.getElementById("modalTitle").innerText = "Novo aluno";
  document.getElementById("studentModal").classList.remove("hidden");

}

// ===============================
// MODAL
// ===============================

function setupModal(){

  const cancelBtn = document.getElementById("cancelStudentBtn");
  const saveBtn   = document.getElementById("saveStudentBtn");
  const modal     = document.getElementById("studentModal");

  if(cancelBtn) cancelBtn.onclick = closeModal;
  if(saveBtn)   saveBtn.onclick   = saveStudent;

  if(modal){
    modal.addEventListener("click",(e)=>{
      if(e.target === modal) closeModal();
    });
  }

}

function closeModal(){
  document.getElementById("studentModal").classList.add("hidden");
}

// ===============================
// SAVE
// ===============================

async function saveStudent(){

  const id    = document.getElementById("editStudentId").value;
  const name  = document.getElementById("editStudentName").value;
  const email = document.getElementById("editStudentEmail").value;
  const phone = document.getElementById("editStudentPhone").value;

  if(!name.trim() || !email.trim()){
    Toast.warning("Nome e email obrigatórios");
    return;
  }

  try{

    const endpoint = id ? `/api/v1/students/${id}` : "/api/v1/students";
    const method   = id ? "PUT" : "POST";

    const res = await apiRequest(endpoint, method, { name, email, phone });

    if(!res.success){
      Toast.error("Erro ao salvar aluno");
      return;
    }

    Toast.success(id ? "Aluno atualizado!" : "Aluno cadastrado!");
    closeModal();
    await loadData();

  }catch(err){
    console.error(err);
    Toast.error("Erro na API");
  }

  // Modal perfil
const profileModal    = document.getElementById("studentProfileModal");
const profileCloseBtn = document.getElementById("profileCloseBtn");

if(profileCloseBtn) profileCloseBtn.onclick = closeStudentProfile;
if(profileModal){
  profileModal.addEventListener("click", e => {
    if(e.target === profileModal) closeStudentProfile();
  });
}

}

window.StudentsModule = {
  init
};

})();