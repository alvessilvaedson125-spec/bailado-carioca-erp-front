// ===============================
// AUTH MODULE - Bailado Carioca
// ===============================

async function login(email, password) {
  try {
    const response = await apiRequest("/api/v1/auth/login", "POST", {
      email,
      password,
    });

    if (response.success && response.token) {
      localStorage.setItem("token", response.token);
      // 🔥 salva role para controle de UI
      localStorage.setItem("user_role", response.user?.role || "operator");

      window.location.href = "app.html";
    } else {
      showError(response.message || "Credenciais inválidas");
    }

  } catch (error) {
    showError(error.message || "Erro ao realizar login");
  }
}

// ===============================
// CHECK AUTH
// ===============================

async function checkAuth() {
  try {
    const response = await apiRequest("/api/v1/auth/me");

    if (!response.success) {
      throw new Error("Não autenticado");
    }

    // 🔥 atualiza role sempre que valida sessão
    localStorage.setItem("user_role", response.data?.role || "operator");

    return response.data;

  } catch (error) {
    localStorage.removeItem("token");
    localStorage.removeItem("user_role");

    if (!window.location.pathname.endsWith("index.html")) {
      window.location.replace("/index.html");
    }
  }
}

// ===============================
// LOGOUT
// ===============================

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user_role");
  window.location.href = "index.html";
}

// ===============================
// ERROR UI
// ===============================

function showError(message) {
  let el = document.getElementById("error-message");

  if (!el) {
    el = document.createElement("div");
    el.id = "error-message";
    el.style.color = "red";
    el.style.marginTop = "10px";

    const container = document.querySelector(".login-body");
    if (container) container.appendChild(el);
  }

  el.innerText = message;
  el.style.display = "block";
}

// ===============================
// LOGIN BUTTON HANDLER
// ===============================

const loginBtn = document.getElementById("loginBtn");

if (loginBtn) {
  loginBtn.addEventListener("click", () => {
    const email    = document.getElementById("email")?.value;
    const password = document.getElementById("password")?.value;

    if (!email || !password) {
      showError("Preencha email e senha");
      return;
    }

    login(email, password);
  });
}

// ===============================
// ENTER KEY SUPPORT
// ===============================

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const email    = document.getElementById("email")?.value;
    const password = document.getElementById("password")?.value;

    if (email && password) {
      login(email, password);
    }
  }
});

// ===============================
// LOGOUT BUTTON
// ===============================

const logoutBtn = document.getElementById("logout-btn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", logout);
}