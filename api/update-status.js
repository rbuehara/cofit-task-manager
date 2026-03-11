export default async function handler(req,res){

const notionKey = process.env.NOTION_API_KEY

const {pageId,status} = req.body

await fetch(`https://api.notion.com/v1/pages/${pageId}`,{

method:"PATCH",

headers:{
Authorization:`Bearer ${notionKey}`,
"Notion-Version":"2022-06-28",
"Content-Type":"application/json"
},

body:JSON.stringify({

properties:{
"Status":{
select:{name:status}
}
}

})

})

res.status(200).json({ok:true})

}
