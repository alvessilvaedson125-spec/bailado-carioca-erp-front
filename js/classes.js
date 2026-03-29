(function(){

let classesCache  = [];
let unitsCache    = [];
let teachersCache = [];

// ===============================
// UTILS
// ===============================

function safe(value){
  return value ?? "-";
}

function createTeacherSelect(value = "") {
  const wrapper = document.createElement("div");
  wrapper.style.display = "flex";
  wrapper.style.gap = "8px";
  wrapper.style.marginBottom = "8px";

  const select = document.createElement("select");
  select.className = "editClassTeacher";

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.innerText = "Remover";
  removeBtn.className = "btn-danger";

  removeBtn.onclick = () => {
    wrapper.remove();

    const all = document.querySelectorAll(".editClassTeacher");
    if (all.length === 0) {
      const container = document.getElementById("teachersContainer");
      const { wrapper: w } = createTeacherSelect();
      container.appendChild(w);
      loadTeachersForClasses();
    }
  };

  wrapper.appendChild(select);
  wrapper.appendChild(removeBtn);

  return { wrapper, select };
}

function getSelectedTeachers() {
  const selects = document.querySelectorAll(".editClassTeacher");
  const unique = new Set();
  selects.forEach(select => {
    if (select.value) unique.add(select.value);
  });
  return Array.from(unique);
}

// ===============================
// INIT
// ===============================

async function init(){
  console.log("Classes module iniciado");

  await Promise.all([
    loadClasses(),
    loadUnitsForClasses()
  ]);

  setupClassModal();
}

// ===============================
// LOAD CLASSES
// ===============================

async function loadClasses(){

  const tableBody = document.querySelector("#classesTable tbody");
  if(!tableBody) return;

  tableBody.innerHTML = "<tr><td colspan='8'>Carregando...</td></tr>";

  try{

    const res = await apiRequest("/api/v1/classes");

    if(!res.success){
      tableBody.innerHTML = "<tr><td colspan='8'>Erro ao carregar turmas</td></tr>";
      return;
    }

    classesCache = res.data || [];
    renderClasses(classesCache);

  }catch(err){
    console.error(err);
    tableBody.innerHTML = "<tr><td colspan='8'>Erro na API</td></tr>";
  }

}

// ===============================
// RENDER CLASSES
// ===============================

function renderClasses(list){

  const tableBody = document.querySelector("#classesTable tbody");
  if(!tableBody) return;

  tableBody.innerHTML = "";

  if(list.length === 0){
    tableBody.innerHTML = "<tr><td colspan='8'>Nenhuma turma encontrada</td></tr>";
    return;
  }

  list.forEach(cls => {

    const teacherNames = Array.isArray(cls.teacher_names)
      ? cls.teacher_names.join(", ")
      : (cls.teacher_names || cls.teacher_name || "-");

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${safe(cls.name)}</td>
      <td>${safe(teacherNames)}</td>
      <td>${safe(cls.unit_name)}</td>
      <td>${safe(cls.day_of_week)}</td>
      <td>${safe(cls.start_time)}</td>
      <td>${cls.conductors_count ?? 0}</td>
      <td>${cls.followers_count  ?? 0}</td>
      <td>
        <button class="btn-edit">Editar</button>
      </td>
    `;

    tr.querySelector(".btn-edit").onclick = () => editClass(cls.id);

    tableBody.appendChild(tr);

  });

}

// ===============================
// FILTER
// ===============================

function filterClasses(){

  const search = document.getElementById("searchClasses");
  if(!search) return;

  const term = search.value.toLowerCase();

  if(term === ""){
    renderClasses(classesCache);
    return;
  }

  const filtered = classesCache.filter(cls =>
    (cls.name ?? "").toLowerCase().includes(term)
  );

  renderClasses(filtered);
}

// ===============================
// LOAD UNITS
// ===============================

async function loadUnitsForClasses(){

  try{

    const res = await apiRequest("/api/v1/units");
    unitsCache = res.data || [];

    const select = document.getElementById("editClassUnit");
    if(!select) return;

    select.innerHTML = `<option value="">Selecione a unidade</option>`;

    unitsCache.forEach(unit => {
      const opt = document.createElement("option");
      opt.value = unit.id;
      opt.textContent = unit.name;
      select.appendChild(opt);
    });

  }catch(err){
    console.error("Erro ao carregar unidades", err);
    Toast.error("Erro ao carregar unidades");
  }

}

// ===============================
// LOAD TEACHERS
// ===============================

async function loadTeachersForClasses(){

  try {

    const res = await apiRequest("/api/v1/teachers");
    teachersCache = res.data || [];

    const selects = document.querySelectorAll(".editClassTeacher");

    selects.forEach(select => {
      const currentVal = select.value;

      select.innerHTML = `<option value="">Selecione o professor</option>`;

      teachersCache.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.id;
        opt.textContent = t.name;
        select.appendChild(opt);
      });

      if(currentVal) select.value = currentVal;
    });

  } catch(err){
    console.error("Erro ao carregar professores", err);
    Toast.error("Erro ao carregar professores");
  }

}

// ===============================
// NEW CLASS
// ===============================

async function newClass(){

  document.getElementById("editClassId").value    = "";
  document.getElementById("editClassName").value  = "";
  document.getElementById("editClassUnit").value  = "";
  document.getElementById("editClassDay").value   = "";
  document.getElementById("editClassTime").value  = "";

  const container = document.getElementById("teachersContainer");
  container.innerHTML = "";

  const { wrapper } = createTeacherSelect();
  container.appendChild(wrapper);

  await loadUnitsForClasses();
  await loadTeachersForClasses();

  const title = document.querySelector("#classModal h2");
  if (title) title.innerText = "Nova Turma";

  document.getElementById("classModal").classList.remove("hidden");
}

// ===============================
// EDIT CLASS
// ===============================

async function editClass(id){

  const cls = classesCache.find(c => c.id === id);
  if(!cls) return;

  document.getElementById("editClassId").value   = cls.id;
  document.getElementById("editClassName").value = cls.name ?? "";
  document.getElementById("editClassUnit").value = cls.unit_id ?? "";
  document.getElementById("editClassDay").value  = cls.day_of_week ?? "";
  document.getElementById("editClassTime").value = cls.start_time ?? "";

  const container = document.getElementById("teachersContainer");
  container.innerHTML = "";

  let teacherIds = [];
  if (Array.isArray(cls.teacher_ids)) {
    teacherIds = cls.teacher_ids;
  } else if (typeof cls.teacher_ids === "string") {
    teacherIds = cls.teacher_ids
      .split(",")
      .map(id => id.trim())
      .filter(id => id !== "");
  } else if (cls.teacher_id) {
    teacherIds = [cls.teacher_id];
  }

  if (teacherIds.length === 0) {
    const { wrapper } = createTeacherSelect();
    container.appendChild(wrapper);
  } else {
    teacherIds.forEach(() => {
      const { wrapper } = createTeacherSelect();
      container.appendChild(wrapper);
    });
  }

  await loadUnitsForClasses();
  await loadTeachersForClasses();

  const selects = document.querySelectorAll(".editClassTeacher");
  selects.forEach((select, index) => {
    select.value = teacherIds[index] ?? "";
  });

  const title = document.querySelector("#classModal h2");
  if (title) title.innerText = "Editar Turma";

  document.getElementById("classModal").classList.remove("hidden");
}

// ===============================
// SAVE CLASS
// ===============================

async function saveClass(){

  const id          = document.getElementById("editClassId").value;
  const name        = document.getElementById("editClassName").value.trim();
  const unit_id     = document.getElementById("editClassUnit").value;
  const day_of_week = document.getElementById("editClassDay").value;
  const start_time  = document.getElementById("editClassTime").value;
  const teachers    = getSelectedTeachers();

  if(!name){
    Toast.warning("Informe o nome da turma");
    return;
  }

  if(teachers.length === 0){
    Toast.warning("Selecione pelo menos um professor");
    return;
  }

  if(!unit_id){
    Toast.warning("Selecione a unidade");
    return;
  }

  if(!day_of_week){
    Toast.warning("Selecione o dia da semana");
    return;
  }

  if(!start_time){
    Toast.warning("Informe o horário");
    return;
  }

  try{

    const payload = { name, teachers, unit_id, day_of_week, start_time };

    const endpoint = id ? `/api/v1/classes/${id}` : "/api/v1/classes";
    const method   = id ? "PUT" : "POST";

    const res = await apiRequest(endpoint, method, payload);

    if(!res.success){
      Toast.error("Erro ao salvar turma");
      return;
    }

    Toast.success(id ? "Turma atualizada!" : "Turma criada!");
    closeClassModal();
    await loadClasses();

  }catch(err){
    console.error(err);
    Toast.error("Erro na API");
  }

}

// ===============================
// MODAL
// ===============================

function setupClassModal(){

  const cancelBtn = document.getElementById("cancelClassBtn");
  const saveBtn   = document.getElementById("saveClassBtn");
  const modal     = document.getElementById("classModal");

  if(cancelBtn) cancelBtn.onclick = closeClassModal;

  if(saveBtn){
    saveBtn.addEventListener("click", (e) => {
      e.preventDefault();
      saveClass();
    });
  }

  if(modal){
    modal.addEventListener("click", (e) => {
      if(e.target === modal) closeClassModal();
    });
  }

}

function closeClassModal(){
  const modal = document.getElementById("classModal");
  if(modal){
    modal.classList.remove("active");
    modal.classList.add("hidden");
  }
}

// ===============================
// EVENTS GLOBAIS
// ===============================

document.addEventListener("click", async (e) => {

  if (e.target.closest("#newClassBtn")) {
    newClass();
    return;
  }

  if (e.target.id === "addTeacherBtn") {
    const container = document.getElementById("teachersContainer");
    const { wrapper, select } = createTeacherSelect();
    container.appendChild(wrapper);

    const res = await apiRequest("/api/v1/teachers");
    const teachers = res.data || [];

    select.innerHTML = `<option value="">Selecione o professor</option>`;
    teachers.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      select.appendChild(opt);
    });
  }

});

// ===============================
// EXPORTS
// ===============================

window.ClassesModule = {
  init,
  loadClasses,
  editClass,
  newClass,
  saveClass
};

window.saveClass = saveClass;
window.newClass  = newClass;

})();