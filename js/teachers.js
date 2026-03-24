(function(){

let teachersCache = []
let filteredTeachers = []

async function init(){
  console.log("Teachers module iniciado")

  bindEvents()

  await loadTeachers()
}

function bindEvents(){
  const searchInput = document.getElementById("teacherSearch")

  if(searchInput){
    searchInput.addEventListener("input", applyFilters)
  }
}

async function loadTeachers(){

 try{

  const res = await apiRequest("/api/v1/teachers")

  if (!res.success) {
    throw new Error(res.message || "Erro ao carregar professores")
  }

  teachersCache = res.data || []

  applyFilters()

}catch(err){

  console.error(err)
  alert("Erro ao carregar professores")

}

}

function applyFilters(){

  const search = document.getElementById("teacherSearch")?.value.toLowerCase() || ""

  filteredTeachers = teachersCache.filter(t => {

    return (
      t.name?.toLowerCase().includes(search) ||
      t.email?.toLowerCase().includes(search) ||
      t.phone?.toLowerCase().includes(search)
    )

  })

  renderTeachers()

}

function renderTeachers(){

  const table = document.getElementById("teachersTable")

  if(!table) return

  if(filteredTeachers.length === 0){

    table.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:20px; color:#666;">
          Nenhum professor encontrado
        </td>
      </tr>
    `

    return
  }

  table.innerHTML = filteredTeachers.map(t => `

    <tr>

      <td>${t.name}</td>
      <td>${t.email ?? "-"}</td>
      <td>${t.phone ?? "-"}</td>
      <td>${formatStatus(t.status)}</td>

      <td>

        <button class="btn-edit" onclick="TeachersModule.editTeacher('${t.id}')">
          Editar
        </button>

        <button class="btn-secondary" onclick="TeachersModule.deleteTeacher('${t.id}')">
          Excluir
        </button>

      </td>

    </tr>

  `).join("")

}

function formatStatus(status){

  if(status === "active"){
    return `<span style="color:green;">Ativo</span>`
  }

  return `<span style="color:#999;">Inativo</span>`
}

function clearSearch(){

  const input = document.getElementById("teacherSearch")

  if(input){
    input.value = ""
  }

  applyFilters()
}

function newTeacher(){

  document.getElementById("editTeacherId").value = ""

  document.getElementById("editTeacherName").value = ""
  document.getElementById("editTeacherEmail").value = ""
  document.getElementById("editTeacherPhone").value = ""
  document.getElementById("editTeacherStatus").value = "active"

  document.querySelector("#teacherModal h3").innerText = "Novo Professor"

  document.getElementById("teacherModal").classList.remove("hidden")

}

function closeTeacherModal(){
  document.getElementById("teacherModal").classList.add("hidden")
}

async function saveTeacher(){

  const id = document.getElementById("editTeacherId").value

  const name = document.getElementById("editTeacherName").value.trim()
  const email = document.getElementById("editTeacherEmail").value.trim()
  const phone = document.getElementById("editTeacherPhone").value.trim()
  const status = document.getElementById("editTeacherStatus").value

  // ✅ VALIDAÇÃO PROFISSIONAL
  if(!name){
    alert("Nome é obrigatório")
    return
  }

  try{

    let res

    if(id){

      res = await apiRequest(
        `/api/v1/teachers/${id}`,
        "PUT",
        { name, email, phone, status }
      )

    }else{

      res = await apiRequest(
        "/api/v1/teachers",
        "POST",
        { name, email, phone, status }
      )

    }

    if(!res.success){
      alert("Erro ao salvar professor")
      return
    }

    alert("Professor salvo com sucesso")

    closeTeacherModal()

    await loadTeachers()

  }catch(err){

    console.error(err)
    alert("Erro na API")

  }

}

async function deleteTeacher(id){

  if(!confirm("Deseja realmente excluir este professor?")){
    return
  }

  try{

    const res = await apiRequest(
      `/api/v1/teachers/${id}`,
      "DELETE"
    )

    if(!res.success){
      alert("Erro ao excluir professor")
      return
    }

    alert("Professor excluído")

    await loadTeachers()

  }catch(err){

    console.error(err)
    alert("Erro na API")

  }

}

window.TeachersModule = {
  init,
  loadTeachers,
  editTeacher,
  deleteTeacher,
  saveTeacher,
  newTeacher,
  clearSearch
};

})();