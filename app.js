async function loadTasks(){

const res = await fetch("/api/tasks")
const data = await res.json()

const container = document.getElementById("tasks")

container.innerHTML = ""

data.results.forEach(task => {

const titleProp = task.properties["Título"]

let title = "Sem título"

if(titleProp && titleProp.title.length > 0){
title = titleProp.title[0].plain_text
}

const categoria = task.properties["Categoria"]?.multi_select
?.map(c => c.name)
.join(", ") || ""

const prazo = task.properties["Prazo"]?.date?.start || ""

const prioridade = task.properties["Prioridade"]?.number || ""

const div = document.createElement("div")

div.className =
"bg-white rounded-lg shadow p-4 border hover:shadow-md transition"

div.innerHTML = `

<div class="flex justify-between items-center">

<div>
<div class="font-semibold text-lg">${title}</div>

<div class="text-sm text-gray-500">
${categoria}
</div>

</div>

<div class="text-right text-sm text-gray-600">

<div>Prazo: ${prazo || "-"}</div>
<div>Prioridade: ${prioridade || "-"}</div>

</div>

</div>

`

container.appendChild(div)

})

}



async function createTask(){

const text = document.getElementById("taskInput").value

if(!text) return

await fetch("/api/tasks",{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({
title:text
})

})

document.getElementById("taskInput").value=""

loadTasks()

}
