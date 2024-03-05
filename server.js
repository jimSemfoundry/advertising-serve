const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const fs = require("fs");
const schedule = require('node-schedule');
const archiver = require('archiver');
const compressing = require('compressing');

const download = require("download-git-repo");
const path = require("path");
const rimraf = require("rimraf");
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// const https = require('https');
// const fs = require('fs');
// let options = {
//   key: fs.readFileSync('./keys/server-key.pem'),
//   ca: [fs.readFileSync('./keys/ca-cert.pem')],
//   cert: fs.readFileSync('./keys/server-cert.pem')
// };

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended : true}))

const multer = require('multer');
const {getDb,saveDb} =require('./db')
const FormData = require('form-data');

// 处理application/x-www-form-urlencoded内容格式的请求体
// app.use(bodyParser.urlencoded({extended: false}));
// app.use((req,res,next)=>{
//     //针对跨域进行配置，允许任何源访问
//     // res.header('Access-Control-Allow-Origin', "*")
//     // 允许前端请求中包含Content-Type这个请求头
//     res.header('Access-Control-Allow-Headers', 'Content-Type')
//     next()
// })

const port = 4000;

app.use('/jimapi/loginBinom', async (req, res) => {
    try {
        const response = await axios.post('https://loopfrom.com/api/user/sign_in',{"login":"jim","password":"TPJgu6sFSxq8arzG"});
        console.log(response.headers['set-cookie'])
        let setCookie = response.headers['set-cookie']
        let Authorization = setCookie[0].split(' ')[0]
        let Binom = setCookie[1].split(' ')[0]
        const db = await getDb()
        db.Authorization = Authorization
        db.Binom = Binom

        // const language = await axios.get('https://loopfrom.com/api/language/list',
        //     {
        //         headers:{
        //             'Cookie': db.Authorization+db.Binom,
        //         },
        //     }
        // );
        const groups = await axios.get('https://loopfrom.com/api/groups/landings',
            {
                headers:{
                    'Cookie': db.Authorization+db.Binom,
                },
            }
        );
        const campaigns = await axios.get('https://loopfrom.com/api/groups/campaigns',
            {
                headers:{
                    'Cookie': db.Authorization+db.Binom,
                },
            }
        );

        // console.log(campaigns)

        const domains = await axios.get('https://loopfrom.com/api/domains',
            {
                headers:{
                    'Cookie': db.Authorization+db.Binom,
                },
            }
        )


        // console.log(domains)
            // db.language = language
        db.groupsArr = groups.data
        db.domainsArr = domains.data
        db.campaignsArr = campaigns.data

        await saveDb(db)

        res.json({
            code:'200',
            msg:'Binom登录成功'
        });


    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong!');
    }
});
app.use('/jimapi/getLanguage', async (req, res) => {
    try {
        const db = await getDb()
        const response = await axios.get('https://loopfrom.com/api/language/list',
            {
                headers:{
                    'Cookie': db.Authorization+db.Binom,
                },
            }
        );

        console.log(response)
        res.json({
            code:'200',
            msg:'Binom登录成功'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong!');
    }
})
app.use('/jimapi/getGroups', async (req, res) => {
    try {
        const db = await getDb()
        const response = await axios.get('https://loopfrom.com/api/groups/landings',
            {
                headers:{
                    'Cookie': db.Authorization+db.Binom,
                },
            }
        );
        console.log(response)
        res.json({
            code:'200',
            msg:'Binom登录成功'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong!');
    }
})

app.use('/jimapi/uploadTest', async (req, res) => {
    try {
        const db = await getDb()
        let uuid = uuidv4();

        const readStream = fs.createReadStream( 'lander.zip');
        let formData = new FormData();

        formData.append('file', readStream, {
            filename: 'lander.zip',
            contentType: 'application/zip'
        });

        const response = await axios.post('https://loopfrom.com/api/landing/'+uuid+'/upload',
            formData,
            {
                headers:{
                    'Accept-Encoding':'gzip, deflate, br, zstd',
                    'Content-Type': 'multipart/form-data; boundary=----' + new Date().getTime(),
                    'Cookie': db.Authorization+db.Binom,
                },
            }
        );

        console.log(response)

        res.json({
            code:'200',
            msg:'成功'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong!');
    }
})
async function releaseFun (db,list,zip,id,res) {
    try {
        let uuid = uuidv4();
        let formData = new FormData();
        if (zip === 'offer'){
            const readStream = fs.createReadStream(path.join(process.cwd(), "file/offer.html"));
            formData.append('file', readStream, {
                filename: 'index.html',
                contentType: 'text/html'
            });
        }else {

            const readStream = fs.createReadStream(path.join(process.cwd(), "lander.zip"));

            formData.append('file', readStream, {
                filename: 'lander.zip',
                contentType: 'application/zip'
            });
        }

        const response = await axios.post('https://loopfrom.com/api/landing/'+uuid+'/upload',
            formData,
            {
                headers:{
                    'Accept-Encoding':'gzip, deflate, br, zstd',
                    'Content-Type': 'multipart/form-data; boundary=----' + new Date().getTime(),
                    'Cookie': db.Authorization+db.Binom,
                },
            }
        );

        let obj = {
            groupUuid:list.deliveryTeamNumber,
            languageCode : "",
            name : list.describe + ' - ' + zip,
            path :response.data.landing_file
        }

        const release = await axios.post('https://loopfrom.com/api/landing/integrated',
            obj,
        {
            headers:{
                'Cookie': db.Authorization+db.Binom,
            },
        })

        const db2 = await getDb()
        const list2 = db2.list.find(v=>v.id===parseInt(id))
        list2[zip + '_file'] = response.data.landing_file
        list2[zip + '_id'] = release.data.id

        await saveDb(db2)

        // if (release){
        //     return true
        // }else {
        //     return false
        // }

    } catch (error) {

        return false
    }
}
app.use('/jimapi/landingUpload', async (req, res) => {
    try {

        const db = await getDb()

        let uuid = uuidv4();

        const readStream = fs.createReadStream(path.join(process.cwd(), "lander.zip"));

        let formData = new FormData();

        formData.append('file', readStream, {
            filename: 'lander.zip',
            contentType: 'application/zip'
        });

        const response = await axios.post('https://loopfrom.com/api/landing/'+uuid+'/upload',
            formData,
            {
                headers:{
                    'Accept-Encoding':'gzip, deflate, br, zstd',
                    'Content-Type': 'multipart/form-data; boundary=----' + new Date().getTime(),
                    'Cookie': db.Authorization+db.Binom,
                },
            }
        );

        res.json({
            code:'200',
            msg:'Binom登录成功'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong!');
    }
})
app.use('/jimapi/integrated', async (req, res) => {
    try {
        const db = await getDb()
        const response = await axios.get('https://loopfrom.com/api/landing/integrated',
            {
                headers:{
                    groupUuid: null,
                    languageCode: "",
                    name: "test1",
                    path: "landers/09be6adc-2801-41be-b589-fccb5e1b795d/index.html",
                },
            }
        );

        console.log(response)
        res.json({
            code:'200',
            msg:'Binom登录成功'
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Something went wrong!');
    }
})
app.get("/jimapi/", (req, res) => res.send("Hello World!"));
app.get("/jimapi/build/:id",  async (req, res) => {
    const lander = path.join(process.cwd(), "lander.zip"); //这里可以自定义下载的地址
    await rimraf.sync(lander, {});

    const offer = path.join(process.cwd(), "offer.zip"); //这里可以自定义下载的地址
    await rimraf.sync(offer, {});

    const offerHtml = path.join(process.cwd(), "file/offer.html"); //这里可以自定义下载的地址
    await rimraf.sync(offerHtml, {});  //在下载前需要保证路径下没有同名文件

    const dir = path.join(process.cwd(), "file/wheel"); //这里可以自定义下载的地址
    await rimraf.sync(dir, {});  //在下载前需要保证路径下没有同名文件



    try {
        const db = await getDb()
        const list = db.list.find(v=>v.id===parseInt(req.params.id))

        if(!list){
            res.json({
                code:'400',
                msg:'获取失败'
            });
            return
        }
        let githubStr = "direct:" + list.githubUrl + "#main"

        const codeList = db.webCode.find(v=>v.id===parseInt(list.codeId))
        let headerCode = codeList.headerCode.replace(new RegExp(/(editPixelId)/g), list.pixel);
        let footerCode = codeList.footerCode

        let btag = list.url.slice(list.url.indexOf('btag'))
        let code = codeList.code.replace(/editPixelId/, list.pixel.toString() )
            .replace(/tokens/, list.token.toString())
            .replace(/btag=/, btag);

        let offerPath = path.join(process.cwd(), "file/offer.html")
        let offerIsOk = false
        fs.writeFile( offerPath, code, 'utf8', function(err) {
            if (err) throw err;
            console.log('offer HTML file has been updated!');
            // releaseFun(db,list,'offer')
            // let uuid = uuidv4();
            // let formData = new FormData();
            //
            // const readStream = fs.createReadStream(path.join(process.cwd(), "file/offer.html"));
            // formData.append('file', readStream, {
            //     filename: 'index.html',
            //     contentType: 'text/html'
            // });
            // const response = await axios.post('https://loopfrom.com/api/landing/'+uuid+'/upload',
            //     formData,
            //     {
            //         headers:{
            //             'Accept-Encoding':'gzip, deflate, br, zstd',
            //             'Content-Type': 'multipart/form-data; boundary=----' + Date.now().toString(16),
            //             'Cookie': db.Authorization+db.Binom,
            //         },
            //     }
            // );
            // console.log(response)
            // list['offer_file'] = response.data.landing_file
            //
            // let obj = {
            //     groupUuid:list.deliveryTeamNumber,
            //     languageCode : "",
            //     name : list.describe + ' - offer',
            //     path :response.data.landing_file
            // }
            //
            // const release = await axios.post('https://loopfrom.com/api/landing/integrated',
            //     obj,
            //     {
            //         headers:{
            //             'Cookie': db.Authorization+db.Binom,
            //         },
            //     })

            // const output = fs.createWriteStream(__dirname + '/offer.zip');
            // const archive = archiver('zip', {
            //     zlib: { level: 9 }
            // });
            // // // 第三步，建立管道连接
            // archive.pipe(output);
            // // 第四步，压缩目录到压缩包中
            // archive.append(code, {name: 'offer.html'});// 文件路径
            // // 第五步，完成压缩
            // archive.finalize()
            //
            // archive.on('end', function(res) {
            //     const file = 'offer.zip';
            //     fs.access(file, fs.constants.F_OK, (err) => {
            //
            //         err ? console.log("offer文件不存在") : releaseFun(db,list,'offer')
            //     });
            // });
        })

        download(
            githubStr,
            dir,
            { clone: true },
            function (err) {
                if( err ){
                    res.json({
                        code:'400',
                        msg:'github下载失败'
                    });
                }else {

                    // deleteFolderRecursive('./file');
                    // compressing.zip.uncompress('./wheel5.zip', './file')
                    //     .then(() => {

                    // 异步读文件方法

                    fs.readFile( path.join(process.cwd(), "file/wheel/index.html"), "utf-8", function( err, data ){
                        if( err ){
                            console.log( "文件读取错误" );
                        }else {
                            let str = data.replace(/<\/head>/, headerCode + '</head>').replace(/<\/html>/, footerCode + '</html>');
                            // 发送HTTP响应
                            fs.writeFile(path.join(process.cwd(), "file/wheel/index.html"), str, 'utf8', function(err) {
                                if (err) throw err;
                                console.log('index HTML file has been updated!');

                                const output = fs.createWriteStream(__dirname + '/lander.zip');
                                const archive = archiver('zip', {
                                    zlib: { level: 9 }
                                });
                                // // 第三步，建立管道连接
                                archive.pipe(output);
                                // 第四步，压缩目录到压缩包中
                                archive.directory(path.join(process.cwd(), "file/wheel/"), 'lander');
                                // 第五步，完成压缩

                                archive.finalize()

                                res.json({
                                    code:'200',
                                    msg:'代码生成成功',
                                });
                                // archive.on('end', async function(resArchive) {
                                //     const file = 'lander.zip';
                                //     fs.access(file, fs.constants.F_OK, async (err) => {
                                //         if (err) throw err;
                                //         let uuid = uuidv4();
                                //
                                //         const readStream = fs.createReadStream( path.join(process.cwd(), "lander.zip"));
                                //         let formData = new FormData();
                                //
                                //         formData.append('file', readStream, {
                                //             filename: 'lander.zip',
                                //             contentType: 'application/zip'
                                //         });
                                //
                                //         const response = await axios.post('https://loopfrom.com/api/landing/'+uuid+'/upload',
                                //             formData,
                                //             {
                                //                 headers:{
                                //                     'Accept-Encoding':'gzip, deflate, br, zstd',
                                //                     'Content-Type': 'multipart/form-data; boundary=----' + Date.now().toString(16),
                                //                     'Cookie': db.Authorization+db.Binom,
                                //                 },
                                //             }
                                //         );
                                //         console.log(response)
                                //
                                //         list['lander_file'] = response.data.landing_file
                                //
                                //         await saveDb(db)
                                //
                                //         let obj = {
                                //             groupUuid:list.deliveryTeamNumber,
                                //             languageCode : "",
                                //             name : list.describe + ' - lander',
                                //             path :response.data.landing_file
                                //         }
                                //
                                //         const release = await axios.post('https://loopfrom.com/api/landing/integrated',
                                //             obj,
                                //             {
                                //                 headers:{
                                //                     'Cookie': db.Authorization+db.Binom,
                                //                 },
                                //             })
                                //     });
                                // });
                            });
                        }
                    })

                }
            }
        );

    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }
    // fs.readFile('./db.json', function (err, data) {
    //     if( err ){
    //         console.log( "文件读取错误" );
    //     }else {
    //         let json = JSON.parse(data);
    //         let githubStr = "direct:" + json.list[0].githubUrl + "#main"
    //         download(
    //             githubStr,
    //             dir,
    //             { clone: true },
    //             function (err) {
    //                 if( err ){
    //                     console.log( "github下载失败" );
    //                 }else {
    //                     let headerCode = json.webList[0].headerCode.replace(new RegExp(/(pixel)/g), json.list[0].pixel);
    //                     let footerCode = json.webList[0].footerCode
    //
    //                     let btag = json.list[0].url.slice(json.list[0].url.indexOf('btag'))
    //                     let code = json.webList[1].code.replace(/pixel/, json.list[0].pixel.toString() )
    //                         .replace(/tokens/, json.list[0].token.toString())
    //                         .replace(/btag=/, btag);
    //
    //                     // deleteFolderRecursive('./file');
    //                     // compressing.zip.uncompress('./wheel5.zip', './file')
    //                     //     .then(() => {
    //
    //                         // 异步读文件方法
    //                         fs.readFile( "./file/index.html", "utf-8", function( err, data ){
    //                             if( err ){
    //                                 console.log( "文件读取错误" );
    //                             }else {
    //                                 let str = data.replace(/<\/head>/, headerCode + '</head>').replace(/<\/html>/, footerCode + '</html>');
    //                                 // 发送HTTP响应
    //                                 fs.writeFile('./file/index.html', str, 'utf8', function(err) {
    //                                     if (err) throw err;
    //                                     console.log('index HTML file has been updated!');
    //
    //                                     const output = fs.createWriteStream(__dirname + '/lander.zip');
    //                                     const archive = archiver('zip', {
    //                                         zlib: { level: 9 }
    //                                     });
    //
    //                                     // // 第三步，建立管道连接
    //                                     archive.pipe(output);
    //
    //                                     // 第四步，压缩目录到压缩包中
    //                                     archive.directory('./file/', 'lander');
    //
    //                                     // 第五步，完成压缩
    //                                     archive.finalize();
    //
    //                                 });
    //
    //                                 fs.writeFile('./file/offer.html', code, 'utf8', function(err) {
    //                                     if (err) throw err;
    //                                     console.log('offer HTML file has been updated!');
    //                                 });
    //
    //                                 const output = fs.createWriteStream(__dirname + '/offer.zip');
    //                                 const archive = archiver('zip', {
    //                                     zlib: { level: 9 }
    //                                 });
    //                                 // // 第三步，建立管道连接
    //                                 archive.pipe(output);
    //                                 // 第四步，压缩目录到压缩包中
    //                                 archive.append(code, {name: 'offer.html'});// 文件路径
    //                                 // 第五步，完成压缩
    //                                 archive.finalize();
    //
    //                                 res.json({
    //                                     code:'200',
    //                                     msg:'构建成功'
    //                                 });
    //                             }
    //                         } )
    //                     // })
    //                     // .catch(err => {
    //                     //     console.log(err);
    //                     // });
    //                 }
    //             }
    //         );
    //     }
    // });
});

// 获取列表
app.get("/jimapi/getPlace",async (req,res)=>{
    try {
        const db=await getDb()
        res.json({
            code:'200',
            msg:'查询成功',
            data:db.list
        });
        // res.status(200).json(db.list)
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }
})

// 查
app.get("/jimapi/getPlace/:id",async (req,res)=>{
    try {
        const db=await getDb()
        const list=db.list.find(v=>v.id===parseInt(req.params.id))

        if(!list){
            return  res.status(404).end()
        }
        res.status(200).json(list)
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }
})
//增
app.post("/jimapi/setPlace",async (req,res)=>{
    try {
        const list=req.body
        // if(!list.title){
        //     return res.status(422).json({
        //         error:'title字段必须传入'
        //     })
        // }
        const db=await getDb()
        const lastList= db.list
        list.id = lastList.length === 0 ? 1 : lastList.length + 1
        list.startDate = new Date().getTime()
        db.list.unshift(list)
        await saveDb(db)
        // res.status(200).json(list)
        res.json({
            code:'200',
            msg:'添加成功'
        });
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }

})
// 改
app.post("/jimapi/setPlace/:id",async (req,res)=>{
    try{
        const list=req.body
        const db=await getDb()
        const ret=db.list.find(v=>v.id===parseInt(req.params.id))
        if(!ret){
            res.status(404).end()
        }
        Object.assign(ret,list)
        await saveDb(db)
        res.json({
            code:'200',
            msg:'修改成功'
        });
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }
})
//删
app.delete("/jimapi/deletePlace/:id",async (req,res)=>{
    try{
        const listId=parseInt(req.params.id)
        const db=await getDb()
        const index=db.list.findIndex(v=>v.id===listId)
        if(index===-1){
            return res.status(404).end()
        }
        db.list.splice(index,1)
        await saveDb(db)
        res.json({
            code:'200',
            msg:'删除成功'
        });
    }catch (err){

    }
})


// 获取列表
app.get("/jimapi/getCode",async (req,res)=>{
    try {
        const db=await getDb()
        res.json({
            code:'200',
            msg:'查询成功',
            data:db.webCode
        });
        // res.status(200).json(db.list)
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }
})
// 查
app.get("/jimapi/getCode/:id",async (req,res)=>{
    try {
        const db=await getDb()
        const list=db.webCode.find(v=>v.id===parseInt(req.params.id))

        if(!list){
            return  res.status(404).end()
        }
        res.status(200).json(list)
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }
})
//增
app.post("/jimapi/setCode",async (req,res)=>{
    try {
        const list = req.body
        // if(!list.title){
        //     return res.status(422).json({
        //         error:'title字段必须传入'
        //     })
        // }
        const db = await getDb()
        const lastList= db.webCode
        list.id = lastList.length === 0 ? 1 : lastList.length + 1,
            db.webCode.push(list)
        await saveDb(db)
        // res.status(200).json(list)
        res.json({
            code:'200',
            msg:'添加成功'
        });
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }

})
// 改
app.post("/jimapi/setCode/:id",async (req,res)=>{
    try{
        const list=req.body
        const db=await getDb()
        const ret=db.webCode.find(v=>v.id===parseInt(req.params.id))
        if(!ret){
            res.status(404).end()
        }
        Object.assign(ret,list)
        await saveDb(db)
        res.json({
            code:'200',
            msg:'修改成功'
        });
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }
})
//删
app.delete("/jimapi/deleteCode/:id",async (req,res)=>{
    try{
        const listId=parseInt(req.params.id)
        const db=await getDb()
        const index=db.webCode.findIndex(v=>v.id===listId)
        if(index===-1){
            return res.status(404).end()
        }
        db.webCode.splice(index,1)
        await saveDb(db)
        res.json({
            code:'200',
            msg:'删除成功'
        });
    }catch (err){

    }
})

app.use("/jimapi/groupsArr", async (req, res) => {
    try {
        const db=await getDb()
        res.json({
            code:'200',
            msg:'查询成功',
            data:db.groupsArr
        });
        // res.status(200).json(db.list)
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }
})

app.use("/jimapi/campaignsArr", async (req, res) => {
    try {
        const db=await getDb()
        res.json({
            code:'200',
            msg:'查询成功',
            data:db.campaignsArr
        });
        // res.status(200).json(db.list)
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }
})

app.use("/jimapi/domainsArr", async (req, res) => {
    try {
        const db=await getDb()
        res.json({
            code:'200',
            msg:'查询成功',
            data:db.domainsArr
        });
        // res.status(200).json(db.list)
    }catch (err){
        res.status(500).json({
            error:err.message
        })
    }
})

app.use("/jimapi/webGroup",  (req, res) => {
    var params = req.body

    console.log(params)
    fs.readFile('./db.json', function (err, data) {
        let json = JSON.parse(data);
        let id = json.webGroup.length
        params.id = id
        json.webGroup.push(params)

        fs.writeFile('./db.json', JSON.stringify(json), 'utf8', function(err) {
            if (err) throw err;
        })
    })
    res.json({
        code:'200',
        msg:'添加成功'
    });
})

// 文件上传接口
// 配置路径和文件名
const storage = multer.diskStorage({
    //上传文件到服务器的存储位置
    destination: 'img',
    filename: function (req, file, callback) {
        //上传的文件信息
        console.log('file', file)
        /**
         * file {
         fieldname: 'file',
         originalname: 'JRMW5Y~E5B%UO4$EZ)[)XLR.png',
         encoding: '7bit',
         mimetype: 'image/png'
         }
         */
            // 将字符串分割成为数组，以点.的形式进行分割。返回的是一个数组
        var fileFormat = (file.originalname).split('.')
        // 获取时间戳
        var filename = new Date().getTime()
        // 文件的命名为：时间戳 + 点 + 文件的后缀名
        callback(null, file.originalname)
    }
})
const upload = multer({
    storage
})
app.use('/jimapi/upload', upload.single('file'), (req, res) => {

    res.send({ code:'200', msg:'上传成功',url: 'img/' + req.file.filename})
})
// app.get('/jimapi/:filename', function(req, res){
//
//     console.log(req.params.filename)
//     const filePath = __dirname + '/' + req.params.filename + '.zip';
//     console.log(filePath)
//     res.download(filePath, function(err){
//         if(err){
//             console.log('文件下载出现错误: ' + err);
//         } else {
//             console.log('文件下载成功！');
//         }
//     });
// });
app.use("/jimapi/release/:id",async (req,res,next)=>{
    // const fs = require('fs')
    // const fileName = 'lander'
    // const filePath = __dirname + '/lander.zip'
    // var f = fs.createReadStream(filePath);
    // response.writeHead(200, {
    //     'Content-Type': 'application/force-download',
    //     'Content-Disposition': 'attachment; filename=' + fileName
    // });
    // f.pipe(response);


    // const db = await getDb()
    // const list = db.list.find(v=>v.id===parseInt(req.params.id))
    //
    // let lander = releaseFun(db,list,'lander',req.params.id)
    //
    // if (lander){
    //
    //     let offer = releaseFun(db,list,'offer',req.params.id)
    //
    //     if (offer){
    //         res.json({
    //             code:'200',
    //             msg:'发布成功'
    //         });
    //     }else {
    //         res.json({
    //             code:'200',
    //             msg:'发布失败'
    //         });
    //     }
    // }else {
    //     res.json({
    //         code:'200',
    //         msg:'发布失败'
    //     });
    // }

    // if (lander){
    //     res.json({
    //         code:'200',
    //         msg:'lander添加成功'
    //     });
    // }else {
    //     res.json({
    //         code:'400',
    //         msg:'lander添加失败'
    //     });
    // }
})
app.use("/jimapi/lander/:id",async (req,res,next)=>{
    // const fs = require('fs')
    // const fileName = 'lander'
    // const filePath = __dirname + '/lander.zip'
    // var f = fs.createReadStream(filePath);
    // response.writeHead(200, {
    //     'Content-Type': 'application/force-download',
    //     'Content-Disposition': 'attachment; filename=' + fileName
    // });
    // f.pipe(response);

    // const db = await getDb()
    // const list = db.list.find(v=>v.id===parseInt(req.params.id))
    //
    // let lander = releaseFun(db,list,'lander',req.params.id)
    // if (lander){
    //     res.json({
    //         code:'200',
    //         msg:'lander添加成功'
    //     });
    // }else {
    //     res.json({
    //         code:'400',
    //         msg:'lander添加失败'
    //     });
    // }


    try {
        const lander = path.join(process.cwd(), "lander.zip"); //这里可以自定义下载的地址
        await rimraf.sync(lander, {});

        const dir = path.join(process.cwd(), "file/wheel"); //这里可以自定义下载的地址
        await rimraf.sync(dir, {});  //在下载前需要保证路径下没有同名文件

        const db = await getDb()
        const list = db.list.find(v=>v.id===parseInt(req.params.id))

        if(!list){
            res.json({
                code:'400',
                msg:'获取失败'
            });
            return
        }
        let githubStr = "direct:" + list.githubUrl + "#main"

        const codeList = db.webCode.find(v=>v.id===parseInt(list.codeId))
        let headerCode = codeList.headerCode.replace(new RegExp(/(editPixelId)/g), list.pixel);
        let footerCode = codeList.footerCode

        download(
            githubStr,
            dir,
            { clone: true },
            function (err) {
                if( err ){
                    res.json({
                        code:'400',
                        msg:'github下载失败'
                    });
                }else {

                    fs.readFile( path.join(process.cwd(), "file/wheel/index.html"), "utf-8",  function( err, data ){
                        if( err ){
                            console.log( "文件读取错误" );
                        }else {
                            let str = data.replace(/<\/head>/, headerCode + '</head>').replace(/<\/html>/, footerCode + '</html>');
                            // 发送HTTP响应
                            fs.writeFile(path.join(process.cwd(), "file/wheel/index.html"), str, 'utf8',  function(err) {
                                if (err) throw err;
                                console.log('index HTML file has been updated!');

                                const output = fs.createWriteStream(__dirname + '/lander.zip');
                                const archive = archiver('zip', {
                                    zlib: { level: 9 }
                                });
                                // // 第三步，建立管道连接
                                archive.pipe(output);
                                // 第四步，压缩目录到压缩包中
                                archive.directory(path.join(process.cwd(), "file/wheel/"), 'lander');
                                // 第五步，完成压缩

                                archive.finalize()

                                output.on('close',async () => {
                                    console.log('压缩完成！')

                                    let uuid = uuidv4();
                                    let formData = new FormData();

                                    const readStream = fs.createReadStream(path.join(process.cwd(), "lander.zip"));

                                    formData.append('file', readStream, {
                                        filename: 'lander.zip',
                                        contentType: 'application/zip'
                                    });

                                    const response = await axios.post('https://loopfrom.com/api/landing/'+uuid+'/upload',
                                        formData,
                                        {
                                            headers:{
                                                'Accept-Encoding':'gzip, deflate, br, zstd',
                                                'Content-Type': 'multipart/form-data; boundary=----' + new Date().getTime(),
                                                'Cookie': db.Authorization+db.Binom,
                                            },
                                        }
                                    );

                                    let obj = {
                                        groupUuid:list.deliveryTeamNumber,
                                        languageCode : "",
                                        name : list.landerName + ' ' + list.describe + ' - lander',
                                        path :response.data.landing_file
                                    }

                                    const release = await axios.post('https://loopfrom.com/api/landing/integrated',
                                        obj,
                                        {
                                            headers:{
                                                'Cookie': db.Authorization+db.Binom,
                                            },
                                        })

                                    const db2 = await getDb()
                                    const list2 = db2.list.find(v=>v.id===parseInt(req.params.id))
                                    list2['lander_file'] = response.data.landing_file
                                    list2['lander_id'] = release.data.id

                                    await saveDb(db2)

                                    res.json({
                                        code:'200',
                                        msg:'lander添加成功'
                                    });
                                }).on('error', (err) => {
                                     console.error('压缩失败', err)
                                })
                            });
                        }
                    })

                }
            }
        );

    }catch (err){
        res.json({
            code:'400',
            msg:'lander添加失败'
        });
    }
})

app.use("/jimapi/offer/:id", async(req,res,next)=>{
    // const fs = require('fs')
    // const fileName = 'offer'
    // const filePath = __dirname + '/offer.zip'
    // var f = fs.createReadStream(filePath);
    // response.writeHead(200, {
    //     'Content-Type': 'application/force-download',
    //     'Content-Disposition': 'attachment; filename=' + fileName
    // });
    // f.pipe(response);

    // const db = await getDb()
    // const list = db.list.find(v=>v.id===parseInt(req.params.id))
    //
    // let offer = releaseFun(db,list,'lander',req.params.id)
    // if (offer){
    //     res.json({
    //         code:'200',
    //         msg:'offer添加成功'
    //     });
    // }else {
    //     res.json({
    //         code:'400',
    //         msg:'offer添加失败'
    //     });
    // }

    try {
        const offer = path.join(process.cwd(), "offer.zip"); //这里可以自定义下载的地址
        await rimraf.sync(offer, {});

        const offerHtml = path.join(process.cwd(), "file/offer.html"); //这里可以自定义下载的地址
        await rimraf.sync(offerHtml, {});  //在下载前需要保证路径下没有同名文件

        const db = await getDb()
        const list = db.list.find(v=>v.id===parseInt(req.params.id))

        if(!list){
            res.json({
                code:'400',
                msg:'获取失败'
            });
            return
        }

        const codeList = db.webCode.find(v=>v.id===parseInt(list.codeId))

        let btag = list.url.slice(list.url.indexOf('btag'))
        let code = codeList.code.replace(/editPixelId/, list.pixel.toString() )
            .replace(/tokens/, list.token.toString())
            .replace(/btag=/, btag);

        let offerPath = path.join(process.cwd(), "file/offer.html")

        fs.writeFile( offerPath, code, 'utf8', async function(err) {
            if (err) throw err;
            console.log('offer HTML file has been updated!');
            let uuid = uuidv4();
            let formData = new FormData();

            const readStream = fs.createReadStream(path.join(process.cwd(), "file/offer.html"));
            formData.append('file', readStream, {
                filename: 'index.html',
                contentType: 'text/html'
            });

            const response = await axios.post('https://loopfrom.com/api/landing/'+uuid+'/upload',
                formData,
                {
                    headers:{
                        'Accept-Encoding':'gzip, deflate, br, zstd',
                        'Content-Type': 'multipart/form-data; boundary=----' + new Date().getTime(),
                        'Cookie': db.Authorization+db.Binom,
                    },
                }
            );

            let obj = {
                groupUuid:list.deliveryTeamNumber,
                languageCode : "",
                name : list.landerName + ' ' + list.describe + ' - offer',
                path :response.data.landing_file
            }

            const release = await axios.post('https://loopfrom.com/api/landing/integrated',
                obj,
                {
                    headers:{
                        'Cookie': db.Authorization+db.Binom,
                    },
                })

            const db2 = await getDb()
            const list2 = db2.list.find(v=>v.id===parseInt(req.params.id))
            list2[ 'offer_file'] = response.data.landing_file
            list2[ 'offer_id'] = release.data.id

            await saveDb(db2)

            res.json({
                code:'200',
                msg:'offer添加成功'
            });
        })

    } catch (error) {
        res.json({
            code:'400',
            msg:'offer添加失败'
        });
    }
})

// async function campaign (id) {
app.use("/jimapi/campaign/:id",async(req,res,next)=>{
    try {
        const db = await getDb()
        const list = db.list.find(v=>v.id===parseInt( req.params.id))
        const domainUuid = db.domainsArr.find(v=>v.id===list.domainUuid)

        if(!list){
            res.json({
                code:'400',
                msg:'获取失败'
            });
            return
        }
        let obj = {
            "name":  list.campaignName + ' ' + list.describe,
            "key":  "",
            "costModel":  "CPC",
            "amount":  null,
            "currency":  "USD",
            "isAuto":  true,
            "hideReferrerType":  "NONE",
            "distributionType":  "NORMAL",
            "groupUuid":  list.groupUuid,
            "domainUuid":  list.domainUuid,
            "rotationId":  null,
            "hideReferrerDomainUuid":  null,
            "trafficSourceId":  17,
            "customRotation":  {
                "defaultPaths":  [
                    {
                        "name":  "Path 1",
                        "enabled":  true,
                        "weight":  100,
                        "landings":  [
                            {
                                "id":  list.lander_id,
                                "enabled":  true,
                                "weight":  100
                            }
                        ],
                        "offers":  [
                            {
                                "offerId":  0,
                                "campaignId":  0,
                                "directUrl":  "https://"+ domainUuid.domain +"/"+list.offer_file+"?clickid={clickid}",
                                "enabled":  true,
                                "weight":  100
                            }
                        ]
                    }
                ],
                "rules":  [

                ]
            },
            "campaignSettings":  {
                "s2sPostback":  null,
                "postbackPercent":  100,
                "trafficLossPercent":  0,
                "payoutPercent":  100,
                "ea":  100,
                "lpPixel":  null
            }
        }

        const campaign = await axios.post('https://loopfrom.com/api/campaign',
            obj,
            {
                headers:{
                    'Cookie': db.Authorization+db.Binom,
                },
            })

        const campaignMsg = await axios.get('https://loopfrom.com/api/campaign/'+campaign.data.id,
            {
                headers:{
                    'Cookie': db.Authorization+db.Binom,
                },
            })

        list['campaign_id'] = campaign.data.id
        list['campaign_key'] = campaignMsg.data.key
        list['campaign_link'] = campaignMsg.data.link

        await saveDb(db)

        res.json({
            code:'200',
            msg:'Campaigns发布成功'
        });
    } catch (error) {
        res.json({
            code:'400',
            msg:'Campaigns发布成功'
        });
    }
})
// }
function deleteFolderRecursive(path) {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(file => {
            const curPath = path + '/' + file;
            if (fs.lstatSync(curPath).isDirectory()) {
                deleteFolderRecursive(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
}

app.post("/jimapi/getdefhref",  (req, res) => {
    res.json({ url: "https://tracker.apostarde.com/link?btag=50921004_290207" });
});

const dummyDb = { subscription: null };

const saveToDatabase = async (subscription) => {
    dummyDb.subscription = subscription;
};

// fs.writeFile('./db.json', JSON.stringify([]), function (err) {
//
// });

// const vapidKeys = {
//     publicKey:"BPMR8M4R8tvhMIBgA6I_P7EJHc5OdxDNNEPfkiuLSwE81f872uoPi7fU678zOWUqR3Ze83kdVhozF8xdeX4ZsCU",
//     privateKey: "RuAZd__egeVcAFmVVhbNsQnKqfMgZffTODV0QyyH8nM",
// };

// app.get("/jimapi/getPublicKey", (req, res) => res.send({publicKey:vapidKeys.publicKey}));
//
// // The new /save-subscription endpoint
// app.post("/jimapi/save-subscription", async (req, res) => {
//     const subscription = JSON.parse(req.body.id);
//     console.log("subscription", subscription);
//     if(subscription === '' || subscription === null || typeof subscription === 'undefined' ){
//         res.json({ message: "用户未授权" });
//     } else {
//         fs.readFile('./db.json', function (err, data) {
//             let json = JSON.parse(data);
//             let existedSub = json.find((el) => el?.endpoint === subscription.endpoint);
//             if (existedSub) {
//                 res.json({ message: "已经注册了" });
//             } else {
//                 json.push(subscription);
//
//                 fs.writeFile('./db.json', JSON.stringify(json), function (err) {
//                     if (err) {
//                         res.json({ message: "添加用户失败" });
//                     };
//                 });
//                 res.json({ message: "添加用户成功" });
//             }
//         });
//         // await saveToDatabase(subscription);
//         // res.json({ message: "success" });
//     }
// });

//setting our previously generated VAPID keys
// webpush.setVapidDetails(
//     "mailto:lijianjunlovelin@gmail.com",
//     vapidKeys.publicKey,
//     vapidKeys.privateKey
// );

//function to send the notification to the subscribed device
// const sendNotification = (subscription, dataToSend) => {
//     console.log(subscription, dataToSend)
//     webpush.sendNotification(subscription, dataToSend);
// };

//route to test send notification
// app.get("/jimapi/send-notification", (req, res) => {
//     const subscription = dummyDb.subscription; //get subscription from your databse here.
//     const resId = req.query.id;
//     console.log(resId)
//     if(resId > data.length - 1){
//         res.json({ message: "id输入0-7" });
//     }else{
//         // const message = JSON.stringify(data[resId]);
//         // sendNotification(subscription, message);
//         // res.json({ message: "message sent" });
//         const message = JSON.stringify(data[resId]);
//         fs.readFile('./db.json', function (err, data) {
//             let json = JSON.parse(data);
//
//             json.map((item) => {
//                 // try {
//                 //   sendNotification(item, message);
//                 // } catch (error){
//                 //   errArr.push(item)
//                 // }
//                 webpush.sendNotification(item, message).then(res => {
//                     console.log('发送成功')
//                 }).catch(err => {
//                     console.log('当前错误')
//                     let existedSub = json.find((el) => el?.endpoint === item.endpoint);
//                     json.splice(existedSub,1)
//                     fs.writeFile('./db.json', JSON.stringify(json), function (err) {
//
//                     });
//                 });
//             });
//             res.json({ message: "message sent" });
//         });
//     }
// });


// // 定义规则
// let rule = new schedule.RecurrenceRule();
// rule.second = [0, 10, 20, 30, 40, 50]; // 每隔 10 秒执行一次
//
// // 启动任务
// let job = schedule.scheduleJob(rule, () => {
//  console.log(new Date());
// //  const resId = Math.round(Math.random()*(data.length-1));
//     // console.log(resId)
//     const message = JSON.stringify(data[0]);
//     fs.readFile('./db.json', function (err, data) {
//         let json = JSON.parse(data);
//
//         json.map((item) => {
//             webpush.sendNotification(item, message).then(res => {
//                 console.log('发送成功')
//             }).catch(err => {
//                 console.log('当前错误')
//                 let existedSub = json.find((el) => el?.endpoint === item.endpoint);
//                 json.splice(existedSub,1)
//                 fs.writeFile('./db.json', JSON.stringify(json), function (err) {
//                 });
//             });
//         });
//     });
//
// });

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
// https.createServer(options,app).listen(port,'127.0.0.1');

const data = [
    {
        "body": "This is a year's effort.79 Ibs lost\nbetween these pictures",
        "icon": "https://betfrom.com/img/logos/Favicon.png",
        "msgUrl": "https://betfrom.com/en",
        "image": "https://betfrom.com/img/promotions/993_9df827aeb3474bb6a003a7e1ff937f5f.webp",
        "title": "CICO",
        "badge": "https://betfrom.com/img/logos/Favicon.png",
        "actions": [
            {
                "action": "archiveOne",
                "title": "details",
                "msgUrl": "https://betfrom.com/en"
            },
            {
                "action": "archiveTwo",
                "title": "cancel",
                "msgUrl": "https://betfrom.com/en"
            }
        ]
    }
]