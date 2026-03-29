(function(){

let studentsCache = [];
let enrollmentsMap = {};
let currentPage = 1;
const PAGE_SIZE = 15;

async function init(){

  console.log("Students module iniciado");

  await checkAuth();

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

async function loadData(){

  const tableBody = document.querySelector("#studentsTable tbody");
  if(!tableBody) return;

  tableBody.innerHTML = "<tr><td colspan='4'>Carregando...</td></tr>";

  try{

    const [studentsRes, enrollmentsRes] = await Promise.all([
      apiRequest("/api/v1/students"),
      apiRequest("/api/v1/enrollments")
    ]);

    if(!studentsRes.success){
      tableBody.innerHTML = "<tr><td colspan='4'>Erro ao carregar alunos</td></tr>";
      return;
    }

    studentsCache = studentsRes.data || [];

    buildEnrollmentsMap(enrollmentsRes);

    currentPage = 1;
    renderStudents(studentsCache);

  }catch(err){

    console.error(err);
    tableBody.innerHTML = "<tr><td colspan='4'>Erro na API</td></tr>";

  }

}

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

function renderStudents(list){

  const tableBody = document.querySelector("#studentsTable tbody");
  if(!tableBody) return;

  tableBody.innerHTML = "";

  if(list.length === 0){
    tableBody.innerHTML = "<tr><td colspan='4'>Nenhum aluno encontrado</td></tr>";
    renderPagination(0);
    return;
  }

  // 🔥 PAGINAÇÃO
  const totalPages = Math.ceil(list.length / PAGE_SIZE);
  if(currentPage > totalPages) currentPage = 1;

  const start = (currentPage - 1) * PAGE_SIZE;
  const end   = start + PAGE_SIZE;
  const page  = list.slice(start, end);

  page.forEach(student => {

    const tr = document.createElement("tr");

    const isActive = isStudentActive(student.id);

    const statusBadge = isActive
      ? `<span class="badge green">Ativo</span>`
      : `<span class="badge gray">Inativo</span>`;

    tr.innerHTML = `
      <td>
        <div class="student-cell">
          <div class="student-avatar">
            ${getInitials(student.name)}
          </div>
          <div>
            <strong>${student.name}</strong>
            <div class="student-meta">${student.phone || ""}</div>
          </div>
        </div>
      </td>
      <td>${student.email}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn-edit">✏️ Editar</button>
        <button class="btn-secondary">👁 Ver</button>
      </td>
    `;

    const editBtn = tr.querySelector(".btn-edit");
    const viewBtn = tr.querySelector(".btn-secondary");

    editBtn.onclick = () => editStudent(student.id);
    viewBtn.onclick = () => goToStudentEnrollments(student.id);

    tableBody.appendChild(tr);

  });

  renderPagination(list.length, list);

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

function goToStudentEnrollments(studentId){
  localStorage.setItem("selectedStudentId", studentId);
  window.location.hash = "enrollments";
}

function getInitials(name){
  return name
    .split(" ")
    .map(n => n[0])
    .slice(0,2)
    .join("")
    .toUpperCase();
}

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

function editStudent(id){

  const student = studentsCache.find(s => s.id === id);
  if(!student) return;

  document.getElementById("editStudentId").value = student.id;
  document.getElementById("editStudentName").value = student.name;
  document.getElementById("editStudentEmail").value = student.email;
  document.getElementById("editStudentPhone").value = student.phone || "";

  document.getElementById("modalTitle").innerText = "Editar aluno";
  document.getElementById("studentModal").classList.remove("hidden");

}

function newStudent(){

  document.getElementById("editStudentId").value = "";
  document.getElementById("editStudentName").value = "";
  document.getElementById("editStudentEmail").value = "";
  document.getElementById("editStudentPhone").value = "";

  document.getElementById("modalTitle").innerText = "Novo aluno";
  document.getElementById("studentModal").classList.remove("hidden");

}

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

}

window.StudentsModule = {
  init
};

})();