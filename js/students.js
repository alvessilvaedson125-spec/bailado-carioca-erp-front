(function(){

let studentsCache = []

async function init(){

  console.log("Students module iniciado")

  await checkAuth()

  // 🔥 AGUARDA O HTML EXISTIR
  await new Promise(resolve => setTimeout(resolve, 50))

  const search = document.getElementById("searchStudents")

  if(search){
    search.addEventListener("input", filterStudents)
  }

  const newBtn = document.getElementById("newStudentBtn")

  if(newBtn){
    newBtn.onclick = newStudent
  }

  setupModal()

  await loadStudents()
}

async function loadStudents(){

  const tableBody = document.querySelector("#studentsTable tbody")

  if(!tableBody) return

  tableBody.innerHTML = "<tr><td colspan='3'>Carregando...</td></tr>"

  try{

    const res = await apiRequest("/api/v1/students")

    if(!res.success){
      tableBody.innerHTML = "<tr><td colspan='3'>Erro ao carregar alunos</td></tr>"
      return
    }

    studentsCache = res.data || []

    renderStudents(studentsCache)

  }catch(err){

    console.error(err)
    tableBody.innerHTML = "<tr><td colspan='3'>Erro na API</td></tr>"

  }

}

function renderStudents(list){

  const tableBody = document.querySelector("#studentsTable tbody")
  if(!tableBody) return

  tableBody.innerHTML = ""

  if(list.length === 0){
    tableBody.innerHTML = "<tr><td colspan='3'>Nenhum aluno encontrado</td></tr>"
    return
  }

  list.forEach(student => {

    const tr = document.createElement("tr")

// Nome
const tdName = document.createElement("td")

const wrapper = document.createElement("div")
wrapper.className = "student-cell"

// avatar (iniciais)
const avatar = document.createElement("div")
avatar.className = "student-avatar"
avatar.textContent = student.name
  .split(" ")
  .map(n => n[0])
  .slice(0,2)
  .join("")
  .toUpperCase()

// nome
const name = document.createElement("span")
name.textContent = student.name

wrapper.appendChild(avatar)
wrapper.appendChild(name)

tdName.appendChild(wrapper)
// Email
const tdEmail = document.createElement("td")
tdEmail.textContent = student.email

// Ações
const tdActions = document.createElement("td")

const btn = document.createElement("button")
btn.className = "btn-edit"

// 🔥 conteúdo mais profissional
btn.innerHTML = "✏️ <span>Editar</span>"

btn.onclick = () => StudentsModule.editStudent(student.id)

tdActions.appendChild(btn)

// Monta linha
tr.appendChild(tdName)
tr.appendChild(tdEmail)
tr.appendChild(tdActions)

    tableBody.appendChild(tr)

  })

}

function filterStudents(){

  const search = document.getElementById("searchStudents")
  if(!search) return

  const term = search.value.toLowerCase()

  if(term === ""){
    renderStudents(studentsCache)
    return
  }

  const filtered = studentsCache.filter(student =>
    student.name.toLowerCase().includes(term) ||
    student.email.toLowerCase().includes(term)
  )

  renderStudents(filtered)

}

function editStudent(id){

  const student = studentsCache.find(s => s.id === id)
  if(!student) return

  document.getElementById("editStudentId").value = student.id
  document.getElementById("editStudentName").value = student.name
  document.getElementById("editStudentEmail").value = student.email
  document.getElementById("editStudentPhone").value = student.phone || ""

  document.getElementById("modalTitle").innerText = "Editar aluno"
  document.getElementById("studentModal").classList.remove("hidden")

}

function newStudent(){

  const idInput = document.getElementById("editStudentId")
  const nameInput = document.getElementById("editStudentName")
  const emailInput = document.getElementById("editStudentEmail")
  const phoneInput = document.getElementById("editStudentPhone")
  const modal = document.getElementById("studentModal")
 const title = document.getElementById("modalTitle")

  // 🔴 GUARDA DE SEGURANÇA
  if(!idInput || !nameInput || !emailInput || !phoneInput || !modal || !title){
    console.error("Modal não está disponível no DOM")
    return
  }

  // limpa campos
  idInput.value = ""
  nameInput.value = ""
  emailInput.value = ""
  phoneInput.value = ""

  // título
  title.innerText = "Novo aluno"

  // abre modal
  modal.classList.remove("hidden")
}

function setupModal(){

  const cancelBtn = document.getElementById("cancelStudentBtn")
  const saveBtn = document.getElementById("saveStudentBtn")
  const modal = document.getElementById("studentModal")

  if(cancelBtn){
    cancelBtn.onclick = closeModal
  }

  if(saveBtn){
    saveBtn.onclick = saveStudent
  }

  const emailInput = document.getElementById("editStudentEmail")

  if(emailInput){
    emailInput.addEventListener("keydown",(e)=>{
      if(e.key === "Enter"){
        saveStudent()
      }
    })
  }

  if(modal){
    modal.addEventListener("click",(e)=>{
      if(e.target === modal){
        closeModal()
      }
    })
  }

}

function closeModal(){
  document.getElementById("studentModal").classList.add("hidden")
}

async function saveStudent(){

  const id = document.getElementById("editStudentId").value
  const name = document.getElementById("editStudentName").value
  const email = document.getElementById("editStudentEmail").value
  const phone = document.getElementById("editStudentPhone").value

  if(!name.trim() || !email.trim()){
  showError("Nome e email são obrigatórios")
  return
}

if(!email.includes("@")){
  showError("Email inválido")
  return
}

  try{

    let res

    if(id){

      res = await apiRequest(
        `/api/v1/students/${id}`,
        "PUT",
        {name,email,phone}
      )

    }else{

      res = await apiRequest(
        "/api/v1/students",
        "POST",
        {name,email,phone}
      )

    }

    if(!res.success){
      showError("Erro ao salvar aluno")
      return
    }

    closeModal()
    await loadStudents()

  }catch(err){

    console.error(err)
    showError("Erro na API")

  }

}

// 🔥 erro padrão UI
function showError(msg){
  if(window.Toast){
    Toast.error(msg)
  } else {
    console.error(msg)
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

