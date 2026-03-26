(function(){

let studentsCache = [];

async function init(){

  console.log("Students module iniciado");

  await checkAuth();

  await new Promise(resolve => setTimeout(resolve, 50));

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

    // ALUNO
    const tdName = document.createElement("td");

    const wrapper = document.createElement("div");
    wrapper.className = "student-cell";

    const avatar = document.createElement("div");
    avatar.className = "student-avatar";
    avatar.textContent = student.name
      .split(" ")
      .map(n => n[0])
      .slice(0,2)
      .join("")
      .toUpperCase();

    const name = document.createElement("div");
    name.innerHTML = `
      <strong>${student.name}</strong>
      <div class="student-meta">${student.phone || ""}</div>
    `;

    wrapper.appendChild(avatar);
    wrapper.appendChild(name);
    tdName.appendChild(wrapper);

    // EMAIL
    const tdEmail = document.createElement("td");
    tdEmail.textContent = student.email;

    // STATUS (preparado para futuro)
    const tdStatus = document.createElement("td");
    tdStatus.innerHTML = `
      <span class="badge green">
        Ativo
      </span>
    `;

    // AÇÕES
    const tdActions = document.createElement("td");

    const editBtn = document.createElement("button");
    editBtn.className = "btn-edit";
    editBtn.innerHTML = "✏️ Editar";
    editBtn.onclick = () => editStudent(student.id);

    const viewBtn = document.createElement("button");
    viewBtn.className = "btn-secondary";
    viewBtn.innerHTML = "👁 Ver";
    viewBtn.onclick = () => {
      window.location.hash = `/enrollments?student=${student.id}`;
    };

    tdActions.appendChild(editBtn);
    tdActions.appendChild(viewBtn);

    tr.appendChild(tdName);
    tr.appendChild(tdEmail);
    tr.appendChild(tdStatus);
    tr.appendChild(tdActions);

    tableBody.appendChild(tr);

  });

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
    showError("Nome e email são obrigatórios");
    return;
  }

  if(!/^\S+@\S+\.\S+$/.test(email)){
    showError("Email inválido");
    return;
  }

  try{

    let res;

    if(id){
      res = await apiRequest(`/api/v1/students/${id}`,"PUT",{name,email,phone});
    }else{
      res = await apiRequest("/api/v1/students","POST",{name,email,phone});
    }

    if(!res.success){
      showError("Erro ao salvar aluno");
      return;
    }

    if(window.Toast){
      Toast.success("Aluno salvo com sucesso");
    }

    closeModal();
    await loadStudents();

  }catch(err){

    console.error(err);
    showError("Erro na API");

  }

}

function showError(msg){
  if(window.Toast){
    Toast.error(msg);
  } else {
    console.error(msg);
  }
}

window.StudentsModule = {
  init,
  loadStudents,
  editStudent,
  saveStudent,
  newStudent
};

})();