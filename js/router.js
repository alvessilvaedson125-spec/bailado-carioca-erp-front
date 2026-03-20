// router.js

const content = document.getElementById("content")

async function checkAuth() {
  try {
    await apiRequest("/api/v1/auth/me")
    return true
 
  } catch {
    localStorage.removeItem("token")
   console.warn("Sessão inválida - aguardando controle do auth boundary")
return false
    return false
 
  }


}


async function loadPage(page) {



if (!localStorage.getItem("token")) {
  console.warn("Sem token - bloqueando carregamento da rota")
  return
}
 
  setActiveMenu(page)

  try {

    content.innerHTML = "<p>Carregando...</p>"

    const response = await fetch(page + ".html")

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

function initModule(page){

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

if(module && typeof module.init === "function"){
module.init()
}else{
  console.warn("Módulo não encontrado ou sem init:", page)
  content.innerHTML += "<p>Erro ao carregar módulo</p>"
}

}

let isLoading = false

function setupNavigation() {

  const links = document.querySelectorAll("[data-page]")

  links.forEach(link => {

link.addEventListener("click", () => {

  if (isLoading) return

  isLoading = true

  const page = link.dataset.page

  loadPage(page).finally(() => {
    isLoading = false
  })

})



  })

}

document.addEventListener("DOMContentLoaded", () => {
  console.log("Router pronto - aguardando auth boundary")
})


function setActiveMenu(page){

const items = document.querySelectorAll(".sidebar li")

items.forEach(li => {
li.classList.remove("active")
})

const target = document.querySelector(`.sidebar li[data-page="${page}"]`)

if(target){
target.classList.add("active")
}

}

