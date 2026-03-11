export default async function handler(req,res){

const notionKey = process.env.NOTION_API_KEY
const databaseId = process.env.NOTION_DATABASE_ID

if(req.method === "GET"){

const response = await fetch(
`https://api.notion.com/v1/databases/${databaseId}/query`,
{
method:"POST",
headers:{
Authorization:`Bearer ${notionKey}`,
"Notion-Version":"2022-06-28",
"Content-Type":"application/json"
},

body:JSON.stringify({

filter:{
property:"Status",
select:{
does_not_equal:"Concluído"
}
}

})

})

const data = await response.json()

return res.status(200).json(data)

}

if(req.method === "POST"){

const {title} = req.body

const response = await fetch(
"https://api.notion.com/v1/pages",
{
method:"POST",
headers:{
Authorization:`Bearer ${notionKey}`,
"Notion-Version":"2022-06-28",
"Content-Type":"application/json"
},
body:JSON.stringify({
parent:{database_id:databaseId},
properties:{
"Título":{
title:[
{
text:{content:title}
}
]
}
}
})
})

const data = await response.json()

return res.status(200).json(data)

}

}
