(function(){

let enrollmentsCache = []
let editingEnrollmentId = null

async function init(){

console.log("Enrollments module iniciado")

attach()

await loadEnrollments()

const cancelBtn = document.getElementById("cancelEnrollmentBtn")

if(cancelBtn){
cancelBtn.onclick = closeEnrollmentModal
}

const modal = document.getElementById("enrollmentModal")

if(modal){
modal.addEventListener("click",(e)=>{
if(e.target === modal){
closeEnrollmentModal()
}
})
}

}

/* =========================
   EVENTS
========================= */

function attach(){

const newBtn = document.getElementById("newEnrollmentBtn")
const modal = document.getElementById("enrollmentModal")
const cancelBtn = document.getElementById("cancelEnrollmentBtn")
const saveBtn = document.getElementById("saveEnrollmentBtn")

if(newBtn){
newBtn.onclick = async () => {

editingEnrollmentId = null

resetEnrollmentForm()

await loadEnrollmentFormData()

modal.classList.remove("hidden")

}
}

if(cancelBtn){
cancelBtn.onclick = () => {
modal.classList.add("hidden")
}
}

if(saveBtn){
saveBtn.onclick = saveEnrollment
}

}

/* =========================
   LOAD DATA
========================= */

async function loadEnrollments(){

const tbody = document.querySelector("#enrollmentsTable tbody")
if(!tbody) return

tbody.innerHTML = `<tr><td colspan="6">Carregando...</td></tr>`

try{

const res = await apiRequest("/api/v1/enrollments")

if(!res.success){
tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar matrículas</td></tr>`
return
}

enrollmentsCache = res.data || []

renderEnrollments()

}catch(err){

console.error(err)
tbody.innerHTML = `<tr><td colspan="6">Erro na API</td></tr>`

}

}

/* =========================
   FORM DATA
========================= */

async function loadEnrollmentFormData(){

await populateStudents()
await populateClasses()

}

async function populateStudents(){

const select = document.getElementById("editEnrollmentStudent")
if(!select) return

try{

const res = await apiRequest("/api/v1/students")
const list = res.data || []

select.innerHTML = `<option value="">Selecione...</option>`

list.forEach(student=>{
const option = document.createElement("option")
option.value = student.id
option.textContent = student.name
select.appendChild(option)
})

}catch(err){
console.error("Erro alunos", err)
}

}

async function populateClasses(){

const select = document.getElementById("editEnrollmentClass")
if(!select) return

try{

const res = await apiRequest("/api/v1/classes")
const list = res.data || []

select.innerHTML = `<option value="">Selecione...</option>`

list.forEach(cls=>{
const option = document.createElement("option")
option.value = cls.id
option.textContent = cls.name
select.appendChild(option)
})

}catch(err){
console.error("Erro turmas", err)
}

}

/* =========================
   SAVE
========================= */

async function saveEnrollment(){

const studentId = document.getElementById("editEnrollmentStudent").value
const classId = document.getElementById("editEnrollmentClass").value
const role = document.getElementById("editEnrollmentRole").value
const type = document.getElementById("editEnrollmentType").value
const fee = Number(document.getElementById("editEnrollmentFee").value || 0)
const discount = Number(document.getElementById("editEnrollmentDiscount").value || 0)
const status = document.getElementById("editEnrollmentStatus").value

if(!studentId || !classId){
alert("Selecione aluno e turma")
return
}

try{

const endpoint = editingEnrollmentId
? `/api/v1/enrollments/${editingEnrollmentId}`
: "/api/v1/enrollments"

const method = editingEnrollmentId ? "PUT" : "POST"

const res = await apiRequest(endpoint,method,{
student_id: studentId,
class_id: classId,
role,
type,
monthly_fee: fee,
discount,
status
})

if(!res || !res.success){
alert("Erro ao salvar matrícula")
return
}

editingEnrollmentId = null

closeEnrollmentModal()

await loadEnrollments()

}catch(err){

console.error(err)
alert("Erro na API")

}

}

/* =========================
   RENDER
========================= */

function renderEnrollments(){

const tbody = document.querySelector("#enrollmentsTable tbody")
if(!tbody) return

if(enrollmentsCache.length === 0){
tbody.innerHTML = `<tr><td colspan="6">Nenhuma matrícula</td></tr>`
return
}

tbody.innerHTML = ""

enrollmentsCache.forEach(enrollment=>{

const tr = document.createElement("tr")

tr.innerHTML = `
<td>${safe(enrollment.student_name)}</td>
<td>${safe(enrollment.class_name)}</td>

<td>
  <span class="role-badge">
    ${formatRole(enrollment.role || "-")}
  </span>
</td>

<td>
  <span class="status-badge ${enrollment.status}">
    ${enrollment.status === "active" ? "Ativo" : "Inativo"}
  </span>
</td>

<td>${formatDate(enrollment.created_at)}</td>

<td>
  <button class="btn-edit">
    ✏️ <span>Editar</span>
  </button>
</td>
`

const editBtn = tr.querySelector(".btn-edit")

if(editBtn){
editBtn.onclick = async () => {

editingEnrollmentId = enrollment.id

await loadEnrollmentFormData()

document.getElementById("editEnrollmentStudent").value = enrollment.student_id
document.getElementById("editEnrollmentClass").value = enrollment.class_id
document.getElementById("editEnrollmentRole").value = enrollment.role || "conductor"
document.getElementById("editEnrollmentType").value = enrollment.type || "individual"
document.getElementById("editEnrollmentFee").value = enrollment.monthly_fee ?? ""
document.getElementById("editEnrollmentDiscount").value = enrollment.discount || 0
document.getElementById("editEnrollmentStatus").value = enrollment.status || "active"

document.getElementById("enrollmentModal").classList.remove("hidden")

}
}

tbody.appendChild(tr)

})

}

/* =========================
   HELPERS
========================= */

function closeEnrollmentModal(){

const modal = document.getElementById("enrollmentModal")

if(modal){
modal.classList.add("hidden")
}

resetEnrollmentForm()
editingEnrollmentId = null

}

function formatRole(role){

if(role === "leader" || role === "conductor") return "Condutor"
if(role === "follower") return "Conduzida"

return role || "-"

}

function formatDate(date){

if(!date) return "-"

return new Date(date).toLocaleDateString("pt-BR")

}

function safe(value){

if(value === null || value === undefined) return "-"

return value

}

function resetEnrollmentForm(){

document.getElementById("editEnrollmentStudent").value = ""
document.getElementById("editEnrollmentClass").value = ""
document.getElementById("editEnrollmentRole").value = "conductor"
document.getElementById("editEnrollmentType").value = "individual"
document.getElementById("editEnrollmentFee").value = ""
document.getElementById("editEnrollmentDiscount").value = 0
document.getElementById("editEnrollmentStatus").value = "active"

}

window.EnrollmentsModule = {
init,
loadEnrollments,
saveEnrollment
};

})();
