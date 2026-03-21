(function(){

let classesCache = []
let unitsCache = []
let teachersCache = []


function safe(value){
  return value ?? "-"
}

async function init(){
  await Promise.all([
    loadClasses(),
    loadUnitsForClasses()
  ])

  setupClassModal();

 document.addEventListener("click", (e) => {
  const btn = e.target.closest("#newClassBtn");
  if (btn) {
    newClass();
  }
});
}

async function loadClasses(){

  const tableBody = document.querySelector("#classesTable tbody")
  if(!tableBody) return

  tableBody.innerHTML = "<tr><td colspan='8'>Carregando...</td></tr>"

  try{

    const res = await apiRequest("/api/v1/classes")

    if(!res.success){
      tableBody.innerHTML = "<tr><td colspan='8'>Erro ao carregar turmas</td></tr>"
      return
    }

    classesCache = res.data || []

    renderClasses(classesCache)

  }catch(err){

    console.error(err)

    tableBody.innerHTML = "<tr><td colspan='8'>Erro na API</td></tr>"

  }

}

function renderClasses(list){

const tableBody = document.querySelector("#classesTable tbody")

tableBody.innerHTML = ""

if(list.length === 0){
tableBody.innerHTML = "<tr><td colspan='8'>Nenhuma turma encontrada</td></tr>"
return
}

list.forEach(cls => {

const tr = document.createElement("tr")

tr.innerHTML = `
<td>${cls.name ?? ""}</td>
<td>${safe(cls.teacher_name)}</td>
<td>${safe(cls.unit_name)}</td>
<td>${safe(cls.day_of_week)}</td>
<td>${safe(cls.start_time)}</td>

<td>${cls.conductors_count ?? 0}</td>
<td>${cls.followers_count ?? 0}</td>

<td>
<button class="btn-edit" onclick="ClassesModule.editClass('${cls.id}')">
Editar
</button>
</td>
`

tableBody.appendChild(tr)

})

}

function filterClasses(){

const search = document.getElementById("searchClasses")

if(!search) return

const term = search.value.toLowerCase()

if(term === ""){
renderClasses(classesCache)
return
}

const filtered = classesCache.filter(cls =>
(cls.name ?? "").toLowerCase().includes(term)
)

renderClasses(filtered)

}

async function loadUnitsForClasses(){

try{

const res = await apiRequest("/api/v1/units")

unitsCache = res.data || []

const select = document.getElementById("editClassUnit")

if(!select) return

select.innerHTML = `<option value="">Selecione a unidade</option>`

unitsCache.forEach(unit => {
select.innerHTML += `<option value="${unit.id}">${unit.name}</option>`
})

}catch(err){
console.error(err)
alert("Erro ao carregar unidades")
}

}

async function loadTeachersForClasses(){

const res = await apiRequest("/api/v1/teachers")

teachersCache = res.data || []

const select = document.getElementById("editClassTeacher")

if(!select) return

select.innerHTML = `<option value="">Selecione o professor</option>`

teachersCache.forEach(t => {
select.innerHTML += `<option value="${t.id}">${t.name}</option>`
})

}

async function editClass(id){

await loadTeachersForClasses()
await loadUnitsForClasses()

const cls = classesCache.find(c => c.id === id)
if(!cls) return

document.getElementById("editClassId").value = cls.id
document.getElementById("editClassName").value = cls.name ?? ""
document.getElementById("editClassTeacher").value = cls.teacher_id ?? ""
document.getElementById("editClassUnit").value = cls.unit_id ?? ""
document.getElementById("editClassDay").value = cls.day_of_week ?? ""
document.getElementById("editClassTime").value = cls.start_time ?? ""

const modal = document.getElementById("classModal")
modal.classList.remove("hidden")
modal.classList.add("active")

}

async function newClass(){

await loadTeachersForClasses()
await loadUnitsForClasses()

document.getElementById("editClassId").value = ""

document.getElementById("editClassName").value = ""
document.getElementById("editClassTeacher").value = ""
document.getElementById("editClassUnit").value = ""
document.getElementById("editClassDay").value = ""
document.getElementById("editClassTime").value = ""

document.querySelector("#classModal h2").innerText = "Nova turma"

const modal = document.getElementById("classModal")
modal.classList.remove("hidden")
modal.classList.add("active")


}

function setupClassModal(){

const cancelBtn = document.getElementById("cancelClassBtn")
const saveBtn = document.getElementById("saveClassBtn")
const modal = document.getElementById("classModal")

if(cancelBtn){
cancelBtn.onclick = closeClassModal
}

if(saveBtn){
saveBtn.addEventListener("click", (e) => {
  e.preventDefault();
  console.log("CLICK SAVE DISPARADO");
  saveClass();
});
}

if(modal){
modal.addEventListener("click",(e)=>{
if(e.target === modal){
closeClassModal()
}
})
}

}
function closeClassModal(){
  const modal = document.getElementById("classModal")
  modal.classList.remove("active")
  modal.classList.add("hidden")
}

async function saveClass(){

const id = document.getElementById("editClassId").value
const teacher_id = document.getElementById("editClassTeacher").value
const unit_id = document.getElementById("editClassUnit").value

const name = document.getElementById("editClassName").value
const day_of_week = document.getElementById("editClassDay").value
const start_time = document.getElementById("editClassTime").value

if(!name){ alert("Informe o nome da turma"); return }
if(!teacher_id){ alert("Selecione um professor"); return }
if(!unit_id){ alert("Selecione a unidade"); return }
if(!day_of_week){ alert("Selecione o dia da semana"); return }
if(!start_time){ alert("Informe o horário"); return }

try{

let res

if(id){

res = await apiRequest(`/api/v1/classes/${id}`,"PUT",
{name,teacher_id,unit_id,day_of_week,start_time})

}else{

res = await apiRequest("/api/v1/classes","POST",
{name,teacher_id,unit_id,day_of_week,start_time})

}

if(!res.success){
alert("Erro ao salvar turma")
return
}

alert("Turma salva com sucesso")

closeClassModal()

await loadClasses()

}catch(err){
console.error(err)
alert("Erro na API")
}

}



window.ClassesModule = {
  init,
  loadClasses,
  editClass,
  newClass,
  saveClass
};

// 👇 ADICIONA ISSO
window.saveClass = saveClass;
window.newClass = newClass;

})();
