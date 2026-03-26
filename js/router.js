const content = document.getElementById("content")

async function checkAuth() {
  try {
    await apiRequest("/api/v1/auth/me")
    return true
  } catch {
    localStorage.removeItem("token")
    window.location.href = "index.html"
    return false
  }
}

async function loadPage(page) {

  if (!localStorage.getItem("token")) return

  setActiveMenu(page)

  try {

    content.innerHTML = "<p>Carregando...</p>"

    const response = await fetch(`./${page}.html`, {
      cache: "no-store"
    })

    if (!response.ok) {
      content.innerHTML = "<h2>Página não encontrada</h2>"
      return
    }

    const html = await response.text()

    content.innerHTML = html

    initModule(page)

  } catch {
    content.innerHTML = "<h2>Erro ao carregar página</h2>"
  }
}

function initModule(page) {

  const modules = {
    dashboard: window.DashboardModule,
    students: window.StudentsModule,
    classes: window.ClassesModule,
    units: window.UnitsModule,
    teachers: window.TeachersModule,
    enrollments: window.EnrollmentsModule,
    payments: window.PaymentsModule,
    cash: window.CashModule
  }

  const module = modules[page]

  if (module && typeof module.init === "function") {
    module.init()
  } else {
    console.warn("Módulo não encontrado ou sem init:", page)
  }
}

let isLoading = false

function setupNavigation() {

  const links = document.querySelectorAll("[data-page]")

  links.forEach(link => {

    link.addEventListener("click", () => {

      if (isLoading) return

      const page = link.dataset.page

      // 👉 ATUALIZA URL (AGORA CONTROLADO)
      window.location.hash = page

    })

  })
}

function setActiveMenu(page) {

  const items = document.querySelectorAll(".sidebar li")

  items.forEach(li => li.classList.remove("active"))

  const target = document.querySelector(`.sidebar li[data-page="${page}"]`)

  if (target) target.classList.add("active")
}

function getPageFromHash() {
  const hash = window.location.hash.replace("#", "")
  return hash || "dashboard"
}

function handleRouteChange() {

  if (isLoading) return

  isLoading = true

  const page = getPageFromHash()

  loadPage(page).finally(() => {
    isLoading = false
  })
}

document.addEventListener("DOMContentLoaded", async () => {

  const ok = await checkAuth()
  if (!ok) return

  setupNavigation()

  // 👉 escuta mudança de rota
  window.addEventListener("hashchange", handleRouteChange)

  // 👉 carrega rota inicial correta
  handleRouteChange()

})