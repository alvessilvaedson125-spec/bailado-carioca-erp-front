(function(){

let teachersCache = []

async function init(){

console.log("Teachers module iniciado")

await loadTeachers()

}

async function loadTeachers(){

try{

const res = await apiRequest("/api/v1/teachers")

teachersCache = res.data || res.results || []

renderTeachers()

}catch(err){

console.error(err)

alert("Erro ao carregar professores")

}

}

function renderTeachers(){

const table = document.getElementById("teachersTable")

if(!table) return

if(teachersCache.length === 0){

table.innerHTML = `
<tr>
<td colspan="5">Nenhum professor encontrado</td>
</tr>
`

return

}

table.innerHTML = teachersCache.map(t => `

<tr>

<td>${t.name}</td>
<td>${t.email ?? "-"}</td>
<td>${t.phone ?? "-"}</td>
<td>${t.status}</td>

<td>

<button onclick="TeachersModule.editTeacher('${t.id}')">
Editar
</button>

<button onclick="TeachersModule.deleteTeacher('${t.id}')">
Excluir
</button>

</td>

</tr>

`).join("")

}

function newTeacher(){

document.getElementById("editTeacherId").value = ""

document.getElementById("editTeacherName").value = ""
document.getElementById("editTeacherEmail").value = ""
document.getElementById("editTeacherPhone").value = ""
document.getElementById("editTeacherStatus").value = "active"

document.querySelector("#teacherModal h3").innerText = "Novo Professor"

document.getElementById("teacherModal").classList.remove("hidden")

}

function closeTeacherModal(){

document.getElementById("teacherModal").classList.add("hidden")

}

async function saveTeacher(){

const id = document.getElementById("editTeacherId").value

const name = document.getElementById("editTeacherName").value
const email = document.getElementById("editTeacherEmail").value
const phone = document.getElementById("editTeacherPhone").value
const status = document.getElementById("editTeacherStatus").value

try{

let res

if(id){

res = await apiRequest(
`/api/v1/teachers/${id}`,
"PUT",
{
name,
email,
phone,
status
}
)

}else{

res = await apiRequest(
"/api/v1/teachers",
"POST",
{
name,
email,
phone,
status
}
)

}

if(!res.success){
alert("Erro ao salvar professor")
return
}

alert("Professor salvo com sucesso")

closeTeacherModal()

await loadTeachers()

}catch(err){

console.error(err)

alert("Erro na API")

}

}

function editTeacher(id){

const teacher = teachersCache.find(t => t.id === id)

if(!teacher) return

document.getElementById("editTeacherId").value = teacher.id

document.getElementById("editTeacherName").value = teacher.name ?? ""
document.getElementById("editTeacherEmail").value = teacher.email ?? ""
document.getElementById("editTeacherPhone").value = teacher.phone ?? ""
document.getElementById("editTeacherStatus").value = teacher.status ?? "active"

document.querySelector("#teacherModal h3").innerText = "Editar Professor"

document.getElementById("teacherModal").classList.remove("hidden")

}

async function deleteTeacher(id){

if(!confirm("Deseja realmente excluir este professor?")){
return
}

try{

const res = await apiRequest(
`/api/v1/teachers/${id}`,
"DELETE"
)

if(!res.success){
alert("Erro ao excluir professor")
return
}

alert("Professor excluído")

await loadTeachers()

}catch(err){

console.error(err)

alert("Erro na API")

}

}

window.TeachersModule = {
init,
loadTeachers,
editTeacher,
deleteTeacher,
saveTeacher,
newTeacher
};

})();
