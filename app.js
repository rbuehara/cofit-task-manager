async function loadTasks() {

const res = await fetch("/api/tasks")
const data = await res.json()

const columns = {
"Backlog": document.getElementById("col-backlog"),
"A fazer": document.getElementById("col-todo"),
"Em andamento": document.getElementById("col-progress"),
"Concluído": document.getElementById("col-done")
}

Object.values(columns).forEach(col => col.innerHTML = "")

data.results.forEach(task => {

const titleProp = task.properties["Título"]

let title = "Sem título"

if (titleProp && titleProp.title.length > 0) {
title = titleProp.title[0].plain_text
}

const descricao =
task.properties["Descrição"]?.rich_text?.[0]?.plain_text || ""

const justificativa =
task.properties["Justificativa IA"]?.rich_text?.[0]?.plain_text || ""

const categoria =
task.properties["Categoria"]?.multi_select
?.map(c => c.name)
.join(", ") || ""

const prazo =
task.properties["Prazo"]?.date?.start || ""

const prioridade =
task.properties["Prioridade"]?.number || ""

const status =
task.properties["Status"]?.select?.name || "Backlog"

const card = document.createElement("div")

card.className =
"bg-white rounded-lg shadow border p-4 hover:shadow-md transition w-full"

card.innerHTML = `

<div class="p-4 flex justify-between items-center">

<div>

<div class="font-semibold text-lg">${title}</div>

<div class="text-sm text-gray-500">${categoria}</div>

</div>

<div class="text-right text-sm text-gray-500">

<div>Prazo: ${prazo || "-"}</div>
<div>Prioridade: ${prioridade || "-"}</div>

</div>

</div>

<div class="hidden border-t p-4 text-sm text-gray-700 space-y-3">

<div>
${descricao}
</div>

<div class="bg-indigo-50 text-indigo-800 p-3 rounded">

<strong>IA</strong><br>
${justificativa}

</div>

<div class="flex gap-2 pt-2">

<button class="bg-gray-200 px-3 py-1 rounded text-sm">
Editar
</button>

<button class="bg-indigo-500 text-white px-3 py-1 rounded text-sm">
Melhorar texto
</button>

<button class="bg-green-500 text-white px-3 py-1 rounded text-sm concluir-btn">
Concluir
</button>

</div>

</div>

`

card.addEventListener("click", () => {

const details = card.children[1]
details.classList.toggle("hidden")

})

card.querySelector(".concluir-btn").addEventListener("click", async (e) => {

e.stopPropagation()

await fetch("/api/update-status", {

method: "POST",
headers: { "Content-Type": "application/json" },

body: JSON.stringify({
pageId: task.id,
status: "Concluído"
})

})

loadTasks()

})

if (columns[status]) {
columns[status].appendChild(card)
}

})

}



async function createTask() {

const text = document.getElementById("taskInput").value

if (!text) return

await fetch("/api/tasks", {

method: "POST",

headers: {
"Content-Type": "application/json"
},

body: JSON.stringify({
title: text
})

})

document.getElementById("taskInput").value = ""

loadTasks()

}



document.addEventListener("DOMContentLoaded", () => {
loadTasks()
})

