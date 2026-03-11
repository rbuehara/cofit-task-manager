async function loadTasks(){

const res = await fetch("/api/tasks")
const data = await res.json()

const container = document.getElementById("tasks")

container.innerHTML = ""

data.results.forEach(task => {

const titleProperty = task.properties["Título"]

let title = "Sem título"

if(titleProperty && titleProperty.title.length > 0){
title = titleProperty.title[0].plain_text
}

const div = document.createElement("div")

div.style.padding = "10px"
div.style.margin = "10px"
div.style.border = "1px solid #ccc"

div.innerHTML = title

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
