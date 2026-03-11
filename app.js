async function loadTasks(){

const res = await fetch("/api/tasks")

const data = await res.json()

const container = document.getElementById("tasks")

container.innerHTML = ""

data.results.forEach(task => {

const title = task.properties.Name.title[0]?.plain_text || "Sem título"

const div = document.createElement("div")

div.className = "task"

div.innerHTML = `<strong>${title}</strong>`

container.appendChild(div)

})

}



async function createTask(){

const text = document.getElementById("taskInput").value

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