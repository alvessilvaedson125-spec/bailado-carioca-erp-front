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

  try {

    const content = document.getElementById("content")

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

    await waitForModule(page)
    initModule(page)

  } catch (err) {
    console.error(err)
    document.getElementById("content").innerHTML = "<h2>Erro ao carregar página</h2>"
  }

}

async function waitForModule(page) {

  const moduleMap = {
    dashboard:   "DashboardModule",
    students:    "StudentsModule",
    classes:     "ClassesModule",
    units:       "UnitsModule",
    teachers:    "TeachersModule",
    enrollments: "EnrollmentsModule",
    payments:    "PaymentsModule",
    cash:        "CashModule",
    reports:     "ReportsModule"
  }

  const moduleName = moduleMap[page]

  if (!moduleName) return

  let attempts = 0
  const maxAttempts = 50 // ~500ms

  while (!window[moduleName] && attempts < maxAttempts) {
    await new Promise(r => setTimeout(r, 10))
    attempts++
  }

  if (!window[moduleName]) {
    console.error(`Módulo ${moduleName} não carregou`)
  }

}

function initModule(page) {

  const modules = {
    dashboard:   window.DashboardModule,
    students:    window.StudentsModule,
    classes:     window.ClassesModule,
    units:       window.UnitsModule,
    teachers:    window.TeachersModule,
    enrollments: window.EnrollmentsModule,
    payments:    window.PaymentsModule,
    cash:        window.CashModule,
    reports:     window.ReportsModule
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

  setActiveMenu(page)

  loadPage(page).finally(() => {
    isLoading = false
  })

}

document.addEventListener("DOMContentLoaded", async () => {

  const ok = await checkAuth()
  if (!ok) return

  setupNavigation()

  window.addEventListener("hashchange", handleRouteChange)

  handleRouteChange()

})