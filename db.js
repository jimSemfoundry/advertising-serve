const fs=require('fs')
const {promisify}=require('util')
const readFile=promisify(fs.readFile)
const writeFile=promisify(fs.writeFile)
const path=require('path')

const dbPath=path.join(__dirname,'./db.json')

exports.getDb= async()=>{
    const data=await readFile(dbPath,'utf-8')
    return JSON.parse(data)
}
exports.saveDb=async db=>{
    const data= JSON.stringify(db,null,'  ')
    await writeFile(dbPath,data)
}