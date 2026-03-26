(function(){

let studentsCache = [];

async function init(){

  console.log("Students module iniciado");

  await checkAuth();

  const search = document.getElementById("searchStudents");
  if(search){
    search.addEventListener("input", filterStudents);
  }

  const newBtn = document.getElementById("newStudentBtn");
  if(newBtn){
    newBtn.onclick = newStudent;
  }

  setupModal();

  await loadStudents();
}

async function loadStudents(){

  const tableBody = document.querySelector("#studentsTable tbody");
  if(!tableBody) return;

  tableBody.innerHTML = "<tr><td colspan='4'>Carregando...</td></tr>";

  try{

    const res = await apiRequest("/api/v1/students");

    if(!res.success){
      tableBody.innerHTML = "<tr><td colspan='4'>Erro ao carregar alunos</td></tr>";
      return;
    }

    studentsCache = res.data || [];

    renderStudents(studentsCache);

  }catch(err){

    console.error(err);
    tableBody.innerHTML = "<tr><td colspan='4'>Erro na API</td></tr>";

  }

}

function renderStudents(list){

  const tableBody = document.querySelector("#studentsTable tbody");
  if(!tableBody) return;

  tableBody.innerHTML = "";

  if(list.length === 0){
    tableBody.innerHTML = "<tr><td colspan='4'>Nenhum aluno encontrado</td></tr>";
    return;
  }

  list.forEach(student => {

    const tr = document.createElement("tr");

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

      <td>
        <span class="badge green">Ativo</span>
      </td>

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

}

function goToStudentEnrollments(studentId){

  localStorage.setItem("selectedStudentId", studentId);

  // 🔥 FORÇA RELOAD LIMPO DO MÓDULO
  window.location.href = "/app/#/enrollments";

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
  const saveBtn = document.getElementById("saveStudentBtn");
  const modal = document.getElementById("studentModal");

  if(cancelBtn){
    cancelBtn.onclick = closeModal;
  }

  if(saveBtn){
    saveBtn.onclick = saveStudent;
  }

  if(modal){
    modal.addEventListener("click",(e)=>{
      if(e.target === modal){
        closeModal();
      }
    });
  }

}

function closeModal(){
  document.getElementById("studentModal").classList.add("hidden");
}

async function saveStudent(){

  const id = document.getElementById("editStudentId").value;
  const name = document.getElementById("editStudentName").value;
  const email = document.getElementById("editStudentEmail").value;
  const phone = document.getElementById("editStudentPhone").value;

  if(!name.trim() || !email.trim()){
    alert("Nome e email obrigatórios");
    return;
  }

  try{

    const endpoint = id
      ? `/api/v1/students/${id}`
      : "/api/v1/students";

    const method = id ? "PUT" : "POST";

    const res = await apiRequest(endpoint,method,{name,email,phone});

    if(!res.success){
      alert("Erro ao salvar");
      return;
    }

    closeModal();
    await loadStudents();

  }catch(err){
    console.error(err);
    alert("Erro na API");
  }

}

window.StudentsModule = {
  init
};

})();