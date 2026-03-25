(function(){

let classesCache = []
let unitsCache = []
let teachersCache = []


function getSelectedTeachers() {
  const selects = document.querySelectorAll(".editClassTeacher");
  return Array.from(selects)
    .map(s => s.value)
    .filter(v => v);
}



function safe(value){
  return value ?? "-"
}

async function init(){
  await Promise.all([
    loadClasses(),
    loadUnitsForClasses()
  ])

  setupClassModal();

 
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
<td>${safe(
 (cls.teacher_names || "-")
    ?Array.isArray(cls.teacher_names)
  ? cls.teacher_names.join(", ")
  : (cls.teacher_names || "-")
    : (cls.teacher_names || cls.teacher_name)
)}</td>
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
  try {

    const res = await apiRequest("/api/v1/teachers")

    teachersCache = res.data || []

    const selects = document.querySelectorAll(".editClassTeacher");

    selects.forEach(select => {
      select.innerHTML = `<option value="">Selecione o professor</option>`;

      teachersCache.forEach(t => {
        select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
      });
    });

  } catch(err){
    console.error("Erro ao carregar professores", err)
    alert("Erro ao carregar professores")
  }
}

async function editClass(id){

  await loadUnitsForClasses()

  const cls = classesCache.find(c => c.id === id)
  if(!cls) return

  document.getElementById("editClassId").value = cls.id
  document.getElementById("editClassName").value = cls.name ?? ""

  const container = document.getElementById("teachersContainer");
  container.innerHTML = "";

  // 🔥 CORRETO (string → array)
const teacherIds =
  cls.teacher_ids
    ? cls.teacher_ids.split(",")
    : (cls.teacher_id ? [cls.teacher_id] : []);

  // 🔥 cria selects primeiro
  teacherIds.forEach(tid => {
    const select = document.createElement("select");
    select.className = "editClassTeacher";
    container.appendChild(select);
  });

  // 🔥 depois popula todos de uma vez
  await loadTeachersForClasses();

  // 🔥 agora aplica valores corretamente
  const selects = document.querySelectorAll(".editClassTeacher");

  selects.forEach((select, index) => {
    select.value = teacherIds[index] ?? "";
  });

  document.getElementById("editClassUnit").value = cls.unit_id ?? ""
  document.getElementById("editClassDay").value = cls.day_of_week ?? ""
  document.getElementById("editClassTime").value = cls.start_time ?? ""

  const modal = document.getElementById("classModal")
  modal.classList.remove("hidden")
  modal.classList.add("active")

}

async function newClass(){

  await loadUnitsForClasses()

  document.getElementById("editClassId").value = ""
  document.getElementById("editClassName").value = ""

  const container = document.getElementById("teachersContainer");
  container.innerHTML = "";

  // 🔥 cria o primeiro select
  const select = document.createElement("select");
  select.className = "editClassTeacher";

  container.appendChild(select);

  // 🔥 agora popula corretamente
  await loadTeachersForClasses();

  document.getElementById("editClassUnit").value = ""
  document.getElementById("editClassDay").value = ""
  document.getElementById("editClassTime").value = ""

  const title = document.querySelector("#classModal h2");
  if (title) {
    title.innerText = "Nova turma";
  }

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
  const teachers = getSelectedTeachers(); // 🔥 nome correto
  const unit_id = document.getElementById("editClassUnit").value

  const name = document.getElementById("editClassName").value
  const day_of_week = document.getElementById("editClassDay").value
  const start_time = document.getElementById("editClassTime").value

  if(!name){ alert("Informe o nome da turma"); return }
  if (teachers.length === 0) {
    alert("Selecione pelo menos um professor");
    return;
  }
  if(!unit_id){ alert("Selecione a unidade"); return }
  if(!day_of_week){ alert("Selecione o dia da semana"); return }
  if(!start_time){ alert("Informe o horário"); return }

  try{

    let res

    const payload = {
      name,
      teachers, // 🔥 CORRETO
      unit_id,
      day_of_week,
      start_time
    }

    if(id){
      res = await apiRequest(`/api/v1/classes/${id}`,"PUT", payload)
    }else{
      res = await apiRequest("/api/v1/classes","POST", payload)
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

document.addEventListener("click", async (e) => {

  // botão nova turma
  const btn = e.target.closest("#newClassBtn");
  if (btn) {
    newClass();
    return;
  }

  // botão adicionar professor
  if (e.target.id === "addTeacherBtn") {

    const container = document.getElementById("teachersContainer");

    const select = document.createElement("select");
    select.className = "editClassTeacher";

    container.appendChild(select);

    // agora sim pode usar await
    const res = await apiRequest("/api/v1/teachers");
    const teachers = res.data || [];

    select.innerHTML = `<option value="">Selecione o professor</option>`;

    teachers.forEach(t => {
      select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
    });

  }

});


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

