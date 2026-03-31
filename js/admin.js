(function(){

  let usersCache = [];
async function init(){
  console.log("Admin module iniciado");

  // 🔥 removido checkAuth — já executado pelo router

  // 🔥 Bloqueia operador de acessar admin
  const role = localStorage.getItem("user_role");
  if(role !== "admin"){
    const page = document.querySelector(".page");
    if(page){
      page.innerHTML = `
        <div class="page-header">
          <div>
            <h1>Administração</h1>
            <p class="page-subtitle">Acesso restrito</p>
          </div>
        </div>
        <div style="text-align:center; padding:60px 20px;">
          <div style="font-size:48px; margin-bottom:16px;">🔒</div>
          <h3 style="font-size:18px; color:#1e293b; margin-bottom:8px;">Acesso restrito</h3>
          <p style="color:#6b7280;">Esta área é exclusiva para administradores.</p>
        </div>
      `;
    }
    return;
  }

  document.getElementById("newUserBtn")?.addEventListener("click", openUserModal);
  document.getElementById("cancelUserBtn")?.addEventListener("click", closeUserModal);
  document.getElementById("saveUserBtn")?.addEventListener("click", saveUser);
  document.getElementById("changePasswordBtn")?.addEventListener("click", changePassword);

  const modal = document.getElementById("userModal");
  if(modal){
    modal.addEventListener("click", (e) => {
      if(e.target === modal) closeUserModal();
    });
  }

  await loadUsers();
}
  // ===============================
  // LOAD
  // ===============================

  async function loadUsers(){
    const tbody = document.getElementById("usersTable");
    if(!tbody) return;

    tbody.innerHTML = `<tr><td colspan="5">Carregando...</td></tr>`;

    try{
      const res = await apiRequest("/api/v1/admin/users");

      if(!res || !res.success){
        tbody.innerHTML = `<tr><td colspan="5">Erro ao carregar usuários</td></tr>`;
        return;
      }

      usersCache = res.data || [];
      renderUsers(usersCache);

    }catch(err){
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="5">Erro na API</td></tr>`;
    }
  }

  // ===============================
  // RENDER
  // ===============================

  function renderUsers(list){
    const tbody = document.getElementById("usersTable");
    if(!tbody) return;

    if(list.length === 0){
      tbody.innerHTML = `<tr><td colspan="5" class="empty-state">Nenhum usuário encontrado</td></tr>`;
      return;
    }

    tbody.innerHTML = "";

    list.forEach(u => {
      const tr = document.createElement("tr");

      const roleBadge = u.role === "admin"
        ? `<span class="badge blue">Admin</span>`
        : `<span class="badge gray">Operador</span>`;

      tr.innerHTML = `
        <td><strong>${safe(u.name)}</strong></td>
        <td>${safe(u.email)}</td>
        <td>${roleBadge}</td>
        <td>${formatDate(u.created_at)}</td>
        <td>
          <button class="btn-danger">🗑️ Desativar</button>
        </td>
      `;

      tr.querySelector(".btn-danger").onclick = () => deactivateUser(u.id, u.name);

      tbody.appendChild(tr);
    });
  }

  // ===============================
  // MODAL
  // ===============================

  function openUserModal(){
    document.getElementById("newUserName").value    = "";
    document.getElementById("newUserEmail").value   = "";
    document.getElementById("newUserPassword").value = "";
    document.getElementById("newUserRole").value    = "operator";
    document.getElementById("userModal").classList.remove("hidden");
  }

  function closeUserModal(){
    document.getElementById("userModal").classList.add("hidden");
  }

  // ===============================
  // SAVE USER
  // ===============================

  async function saveUser(){
    const name     = document.getElementById("newUserName").value.trim();
    const email    = document.getElementById("newUserEmail").value.trim();
    const password = document.getElementById("newUserPassword").value;
    const role     = document.getElementById("newUserRole").value;

    if(!name || !email || !password){
      Toast.warning("Preencha todos os campos");
      return;
    }

    if(password.length < 6){
      Toast.warning("Senha deve ter ao menos 6 caracteres");
      return;
    }

    try{
      const res = await apiRequest("/api/v1/admin/users", "POST", {
        name, email, password, role
      });

      if(!res || !res.success){
        Toast.error(res?.message || "Erro ao criar usuário");
        return;
      }

      Toast.success("Usuário criado!");
      closeUserModal();
      await loadUsers();

    }catch(err){
      console.error(err);
      Toast.error("Erro na API");
    }
  }

  // ===============================
  // DEACTIVATE USER
  // ===============================

  async function deactivateUser(id, name){
    if(!confirm(`Desativar o usuário "${name}"?`)) return;

    try{
      const res = await apiRequest(`/api/v1/admin/users/${id}`, "DELETE");

      if(!res || !res.success){
        Toast.error(res?.message || "Erro ao desativar usuário");
        return;
      }

      Toast.success("Usuário desativado!");
      await loadUsers();

    }catch(err){
      console.error(err);
      Toast.error("Erro na API");
    }
  }

  // ===============================
  // CHANGE PASSWORD
  // ===============================

  async function changePassword(){
    const current = document.getElementById("currentPassword").value;
    const next    = document.getElementById("newPassword").value;
    const confirm = document.getElementById("confirmPassword").value;

    if(!current || !next || !confirm){
      Toast.warning("Preencha todos os campos");
      return;
    }

    if(next.length < 6){
      Toast.warning("Nova senha deve ter ao menos 6 caracteres");
      return;
    }

    if(next !== confirm){
      Toast.warning("As senhas não coincidem");
      return;
    }

    try{
      const res = await apiRequest("/api/v1/admin/change-password", "POST", {
        current_password: current,
        new_password:     next
      });

      if(!res || !res.success){
        Toast.error(res?.message || "Erro ao alterar senha");
        return;
      }

      Toast.success("Senha alterada com sucesso!");

      document.getElementById("currentPassword").value = "";
      document.getElementById("newPassword").value     = "";
      document.getElementById("confirmPassword").value = "";

    }catch(err){
      console.error(err);
      Toast.error("Erro na API");
    }
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

  window.AdminModule = { init };

})();