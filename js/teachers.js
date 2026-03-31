(function(){

let teachersCache    = [];
let filteredTeachers = [];

async function init(){
  console.log("Teachers module iniciado");

  // 🔥 eventos via addEventListener, não onclick inline
  document.getElementById("newTeacherBtn")?.addEventListener("click", newTeacher);
  document.getElementById("clearSearchBtn")?.addEventListener("click", clearSearch);
  document.getElementById("teacherSearch")?.addEventListener("input", applyFilters);

  const modal = document.getElementById("teacherModal");
  if(modal){
    modal.addEventListener("click", (e) => {
      if(e.target === modal) closeTeacherModal();
    });
  }

  // botões do modal
  document.getElementById("cancelTeacherBtn")?.addEventListener("click", closeTeacherModal);
  document.getElementById("saveTeacherBtn")?.addEventListener("click", saveTeacher);

  await loadTeachers();
}

// ===============================
// LOAD
// ===============================

async function loadTeachers(){
  try{
    const res = await apiRequest("/api/v1/teachers");

    if(!res.success){
      throw new Error(res.message || "Erro ao carregar professores");
    }

    teachersCache = res.data || [];
    applyFilters();

  }catch(err){
    console.error(err);
    Toast.error("Erro ao carregar professores");
  }
}

// ===============================
// FILTER
// ===============================

function applyFilters(){
  const search = document.getElementById("teacherSearch")?.value.toLowerCase() || "";

  filteredTeachers = teachersCache.filter(t =>
    t.name?.toLowerCase().includes(search)  ||
    t.email?.toLowerCase().includes(search) ||
    t.phone?.toLowerCase().includes(search)
  );

  renderTeachers();
}

function clearSearch(){
  const input = document.getElementById("teacherSearch");
  if(input) input.value = "";
  applyFilters();
}

// ===============================
// RENDER
// ===============================

function renderTeachers(){
  const tbody = document.getElementById("teachersTable");
  if(!tbody) return;

  if(filteredTeachers.length === 0){
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:20px; color:#666;">
          Nenhum professor encontrado
        </td>
      </tr>`;
    return;
  }

  tbody.innerHTML = "";

  filteredTeachers.forEach(t => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${t.name}</td>
      <td>${t.email ?? "-"}</td>
      <td>${t.phone ?? "-"}</td>
      <td>${formatStatus(t.status)}</td>
      <td>
        <button class="btn-edit">✏️ Editar</button>
        <button class="btn-danger-soft">🗑️ Excluir</button>
      </td>
    `;

    tr.querySelector(".btn-edit").onclick       = () => editTeacher(t.id);
    tr.querySelector(".btn-danger-soft").onclick = () => deleteTeacher(t.id);

    tbody.appendChild(tr);
  });
}

function formatStatus(status){
  return status === "active"
    ? `<span class="enrollment-status-badge green">Ativo</span>`
    : `<span class="enrollment-status-badge red">Inativo</span>`;
}

// ===============================
// MODAL
// ===============================

function newTeacher(){
  document.getElementById("editTeacherId").value    = "";
  document.getElementById("editTeacherName").value  = "";
  document.getElementById("editTeacherEmail").value = "";
  document.getElementById("editTeacherPhone").value = "";
  document.getElementById("editTeacherStatus").value = "active";

  const title = document.getElementById("teacherModalTitle");
  if(title) title.innerText = "Novo Professor";

  document.getElementById("teacherModal").classList.remove("hidden");
}

function editTeacher(id){
  const teacher = teachersCache.find(t => t.id === id);
  if(!teacher){
    Toast.warning("Professor não encontrado");
    return;
  }

  document.getElementById("editTeacherId").value     = teacher.id;
  document.getElementById("editTeacherName").value   = teacher.name  || "";
  document.getElementById("editTeacherEmail").value  = teacher.email || "";
  document.getElementById("editTeacherPhone").value  = teacher.phone || "";
  document.getElementById("editTeacherStatus").value = teacher.status || "active";

  const title = document.getElementById("teacherModalTitle");
  if(title) title.innerText = "Editar Professor";

  document.getElementById("teacherModal").classList.remove("hidden");
}

function closeTeacherModal(){
  document.getElementById("teacherModal").classList.add("hidden");
}

// ===============================
// SAVE
// ===============================

async function saveTeacher(){
  const id     = document.getElementById("editTeacherId").value;
  const name   = document.getElementById("editTeacherName").value.trim();
  const email  = document.getElementById("editTeacherEmail").value.trim();
  const phone  = document.getElementById("editTeacherPhone").value.trim();
  const status = document.getElementById("editTeacherStatus").value;

  if(!name){
    Toast.warning("Nome é obrigatório");
    return;
  }

  try{
    const endpoint = id ? `/api/v1/teachers/${id}` : "/api/v1/teachers";
    const method   = id ? "PUT" : "POST";

    const res = await apiRequest(endpoint, method, { name, email, phone, status });

    if(!res.success){
      Toast.error("Erro ao salvar professor");
      return;
    }

    Toast.success(id ? "Professor atualizado!" : "Professor criado!");
    closeTeacherModal();
    await loadTeachers();

  }catch(err){
    console.error(err);
    Toast.error("Erro na API");
  }
}

// ===============================
// DELETE
// ===============================

async function deleteTeacher(id){
  if(!confirm("Deseja realmente excluir este professor?")) return;

  try{
    const res = await apiRequest(`/api/v1/teachers/${id}`, "DELETE");

    if(!res.success){
      Toast.error("Erro ao excluir professor");
      return;
    }

    Toast.success("Professor excluído!");
    await loadTeachers();

  }catch(err){
    console.error(err);
    Toast.error("Erro na API");
  }
}

window.TeachersModule = {
  init,
  loadTeachers,
  editTeacher,
  deleteTeacher,
  saveTeacher,
  newTeacher,
  clearSearch,
  closeTeacherModal
};

})();