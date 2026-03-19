(function(){

let units = []

async function init(){

console.log("Units module iniciado")

await loadUnits()

document
.getElementById("newUnitBtn")
?.addEventListener("click", openNewUnitModal)

document
.getElementById("cancelUnitBtn")
?.addEventListener("click", closeUnitModal)

document
.getElementById("saveUnitBtn")
?.addEventListener("click", saveUnit)

document
.getElementById("searchUnit")
?.addEventListener("input", filterUnits)

}

// ===============================
// LOAD
// ===============================

async function loadUnits(){

try{

const res = await apiRequest("/api/v1/units")

units = res.data || []

renderUnits(units)

}catch(err){

console.error(err)

alert("Erro ao carregar unidades")

}

}

// ===============================
// RENDER
// ===============================

function renderUnits(list){

const table = document.getElementById("unitsTable")

if(!table) return

if(list.length === 0){

table.innerHTML = `
<tr>
<td colspan="3" class="empty-state">
Nenhuma unidade encontrada
</td>
</tr>
`

return
}

table.innerHTML = list.map(unit => `

<tr>

<td>${unit.name}</td>

<td>${formatDate(unit.created_at)}</td>

<td>

<button onclick="UnitsModule.editUnit('${unit.id}')">
Editar
</button>

<button onclick="UnitsModule.deleteUnit('${unit.id}')">
Excluir
</button>

</td>

</tr>

`).join("")

}

// ===============================
// MODAL
// ===============================

function openNewUnitModal(){

document.getElementById("unitModalTitle").innerText = "Nova Unidade"

document.getElementById("editUnitId").value = ""

document.getElementById("editUnitName").value = ""

openUnitModal()

}

function editUnit(id){

const unit = units.find(u => u.id === id)

if(!unit) return

document.getElementById("unitModalTitle").innerText = "Editar Unidade"

document.getElementById("editUnitId").value = unit.id

document.getElementById("editUnitName").value = unit.name

openUnitModal()

}

function openUnitModal(){

document
.getElementById("unitModal")
.classList.remove("hidden")

}

function closeUnitModal(){

document
.getElementById("unitModal")
.classList.add("hidden")

}

// ===============================
// SAVE
// ===============================

async function saveUnit(){

const id = document.getElementById("editUnitId").value

const name = document.getElementById("editUnitName").value.trim()

if(!name){

alert("Informe o nome da unidade")

return

}

try{

let res

if(id){

res = await apiRequest(
`/api/v1/units/${id}`,
"PUT",
{ name }
)

}else{

res = await apiRequest(
"/api/v1/units",
"POST",
{ name }
)

}

if(!res.success){

alert("Erro ao salvar unidade")

return

}

closeUnitModal()

await loadUnits()

}catch(err){

console.error(err)

alert("Erro na API")

}

}

// ===============================
// DELETE
// ===============================

async function deleteUnit(id){

if(!confirm("Deseja excluir esta unidade?")) return

try{

const res = await apiRequest(
`/api/v1/units/${id}`,
"DELETE"
)

if(!res.success){

alert("Erro ao excluir")

return

}

await loadUnits()

}catch(err){

console.error(err)

alert("Erro na API")

}

}

// ===============================
// FILTER
// ===============================

function filterUnits(){

const term = document
.getElementById("searchUnit")
.value
.toLowerCase()

const filtered = units.filter(unit =>
unit.name.toLowerCase().includes(term)
)

renderUnits(filtered)

}

// ===============================
// UTIL
// ===============================

function formatDate(date){

if(!date) return ""

const d = new Date(date)

return d.toLocaleDateString()

}

window.UnitsModule = {
init,
loadUnits,
editUnit,
deleteUnit,
saveUnit
};

})();
