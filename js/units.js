(function(){

  let unitsCache = [];

  async function init(){
    console.log("Units module iniciado");

    await checkAuth();

    document.getElementById("newUnitBtn")?.addEventListener("click", openNewUnitModal);
    document.getElementById("cancelUnitBtn")?.addEventListener("click", closeUnitModal);
    document.getElementById("saveUnitBtn")?.addEventListener("click", saveUnit);
    document.getElementById("searchUnit")?.addEventListener("input", filterUnits);

    const modal = document.getElementById("unitModal");
    if(modal){
      modal.addEventListener("click", (e) => {
        if(e.target === modal) closeUnitModal();
      });
    }

    await loadUnits();
  }

  // ===============================
  // LOAD
  // ===============================

  async function loadUnits(){
    const tbody = document.getElementById("unitsTable");
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="3">Carregando...</td></tr>`;

    try{
      const res = await apiRequest("/api/v1/units");

      if(!res || !res.success){
        tbody.innerHTML = `<tr><td colspan="3">Erro ao carregar unidades</td></tr>`;
        return;
      }

      unitsCache = res.data || [];
      renderUnits(unitsCache);

    }catch(err){
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="3">Erro na API</td></tr>`;
    }
  }

  // ===============================
  // RENDER
  // ===============================

  function renderUnits(list){
    const tbody = document.getElementById("unitsTable");
    if(!tbody) return;

    if(list.length === 0){
      tbody.innerHTML = `<tr><td colspan="3" class="empty-state">Nenhuma unidade encontrada</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    list.forEach(unit => {
      const tr = document.createElement("tr");

      const initials = unit.name
        .split(" ")
        .map(n => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

      tr.innerHTML = `
        <td>
          <div class="unit-cell">
            <div class="unit-avatar">${initials}</div>
            <strong>${safe(unit.name)}</strong>
          </div>
        </td>
        <td>${formatDate(unit.created_at)}</td>
        <td>
          <button class="btn-edit">✏️ Editar</button>
          <button class="btn-danger">🗑️ Excluir</button>
        </td>
      `;

      tr.querySelector(".btn-edit").onclick = () => editUnit(unit.id);
      tr.querySelector(".btn-danger").onclick = () => deleteUnit(unit.id);

      tbody.appendChild(tr);
    });
  }

  // ===============================
  // MODAL
  // ===============================

  function openNewUnitModal(){
    document.getElementById("unitModalTitle").innerText = "Nova Unidade";
    document.getElementById("editUnitId").value = "";
    document.getElementById("editUnitName").value = "";
    document.getElementById("unitModal").classList.remove("hidden");
  }

  function editUnit(id){
    const unit = unitsCache.find(u => u.id === id);
    if(!unit) return;

    document.getElementById("unitModalTitle").innerText = "Editar Unidade";
    document.getElementById("editUnitId").value = unit.id;
    document.getElementById("editUnitName").value = unit.name;
    document.getElementById("unitModal").classList.remove("hidden");
  }

  function closeUnitModal(){
    document.getElementById("unitModal").classList.add("hidden");
    document.getElementById("editUnitId").value = "";
    document.getElementById("editUnitName").value = "";
  }

  // ===============================
  // SAVE
  // ===============================

  async function saveUnit(){
    const id = document.getElementById("editUnitId").value;
    const name = document.getElementById("editUnitName").value.trim();

    if(!name){
      Toast.warning("Informe o nome da unidade");
      return;
    }

    try{
      const endpoint = id ? `/api/v1/units/${id}` : "/api/v1/units";
      const method = id ? "PUT" : "POST";

      const res = await apiRequest(endpoint, method, { name });

      if(!res || !res.success){
        Toast.error("Erro ao salvar unidade");
        return;
      }

      Toast.success(id ? "Unidade atualizada!" : "Unidade criada!");
      closeUnitModal();
      await loadUnits();

    }catch(err){
      console.error(err);
      Toast.error("Erro na API");
    }
  }

  // ===============================
  // DELETE
  // ===============================

  async function deleteUnit(id){
    if(!confirm("Deseja excluir esta unidade?")) return;

    try{
      const res = await apiRequest(`/api/v1/units/${id}`, "DELETE");

      if(!res || !res.success){
        Toast.error("Erro ao excluir unidade");
        return;
      }

      Toast.success("Unidade excluída!");
      await loadUnits();

    }catch(err){
      console.error(err);
      Toast.error("Erro na API");
    }
  }

  // ===============================
  // FILTER
  // ===============================

  function filterUnits(){
    const term = document.getElementById("searchUnit")?.value.toLowerCase() || "";

    if(term === ""){
      renderUnits(unitsCache);
      return;
    }

    const filtered = unitsCache.filter(unit =>
      unit.name.toLowerCase().includes(term)
    );

    renderUnits(filtered);
  }

  // ===============================
  // UTILS
  // ===============================

  function formatDate(date){
    if(!date) return "-";
    return new Date(date).toLocaleDateString("pt-BR");
  }

  function safe(value){
    if(value === null || value === undefined) return "-";
    return value;
  }

  window.UnitsModule = {
    init,
    loadUnits,
    editUnit,
    deleteUnit,
    saveUnit
  };

})();