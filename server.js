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

const dir = path.join(process.cwd(), "file"); //这里可以自定义下载的地址
rimraf.sync(dir, {});  //在下载前需要保证路径下没有同名文件
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



app.get("/jimapi/", (req, res) => res.send("Hello World!"));
app.get("/jimapi/build/:id",  async(req, res) => {

    try {
        const db=await getDb()
        const list = db.list.find(v=>v.id===parseInt(req.params.id))

        if(!list){
            return  res.status(404).end()
        }
        let githubStr = "direct:" + list.githubUrl + "#main"

        download(
            githubStr,
            dir,
            { clone: true },
            function (err) {
                if( err ){
                    res.json({
                        code:'200',
                        msg:'github下载失败'
                    });
                    // console.log( "github下载失败" );
                }else {
                    const codeList = db.webCode.find(v=>v.id===parseInt(list.codeId))
                    let headerCode = codeList.headerCode.replace(new RegExp(/(pixel)/g), list.pixel);
                    let footerCode = codeList.footerCode

                    let btag = list.url.slice(list.url.indexOf('btag'))
                    let code = codeList.code.replace(/pixel/, list.pixel.toString() )
                        .replace(/tokens/, list.token.toString())
                        .replace(/btag=/, btag);

                    // deleteFolderRecursive('./file');
                    // compressing.zip.uncompress('./wheel5.zip', './file')
                    //     .then(() => {

                    // 异步读文件方法
                    fs.readFile( "./file/index.html", "utf-8", function( err, data ){
                        if( err ){
                            console.log( "文件读取错误" );
                        }else {
                            let str = data.replace(/<\/head>/, headerCode + '</head>').replace(/<\/html>/, footerCode + '</html>');
                            // 发送HTTP响应
                            fs.writeFile('./file/index.html', str, 'utf8', function(err) {
                                if (err) throw err;
                                console.log('index HTML file has been updated!');

                                const output = fs.createWriteStream(__dirname + '/lander.zip');
                                const archive = archiver('zip', {
                                    zlib: { level: 9 }
                                });

                                // // 第三步，建立管道连接
                                archive.pipe(output);

                                // 第四步，压缩目录到压缩包中
                                archive.directory('./file/', 'lander');

                                // 第五步，完成压缩
                                archive.finalize();

                            });

                            fs.writeFile('./file/offer.html', code, 'utf8', function(err) {
                                if (err) throw err;
                                console.log('offer HTML file has been updated!');
                            });

                            const output = fs.createWriteStream(__dirname + '/offer.zip');
                            const archive = archiver('zip', {
                                zlib: { level: 9 }
                            });
                            // // 第三步，建立管道连接
                            archive.pipe(output);
                            // 第四步，压缩目录到压缩包中
                            archive.append(code, {name: 'offer.html'});// 文件路径
                            // 第五步，完成压缩
                            archive.finalize();

                            res.json({
                                code:'200',
                                msg:'构建成功'
                            });
                        }
                    } )
                    // })
                    // .catch(err => {
                    //     console.log(err);
                    // });
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
        list.id=lastList.length === 0 ? 1 : lastList.length + 1,
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
        res.status(200).json(ret)
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
        res.status(200).send("删除成功")
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
        res.status(200).json(ret)
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
        res.status(200).send("删除成功")
    }catch (err){

    }
})

// app.use("/jimapi/webTable",  (req, res) => {
//     var params = req.body
//
//     console.log(params)
//     fs.readFile('./db.json', function (err, data) {
//         let json = JSON.parse(data);
//
//         json.list[0] = params
//
//         fs.writeFile('./db.json', JSON.stringify(json), 'utf8', function(err) {
//             if (err) throw err;
//         })
//     })
//     res.json({
//         code:'200',
//         msg:'添加成功'
//     });
// })

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
app.use("/jimapi/lander",(req,response,next)=>{
    const fs = require('fs')
    const fileName = 'lander'
    const filePath = __dirname + '/lander.zip'
    var f = fs.createReadStream(filePath);
    response.writeHead(200, {
        'Content-Type': 'application/force-download',
        'Content-Disposition': 'attachment; filename=' + fileName
    });
    f.pipe(response);
})

app.use("/jimapi/offer",(req,response,next)=>{
    const fs = require('fs')
    const fileName = 'offer'
    const filePath = __dirname + '/offer.zip'
    var f = fs.createReadStream(filePath);
    response.writeHead(200, {
        'Content-Type': 'application/force-download',
        'Content-Disposition': 'attachment; filename=' + fileName
    });
    f.pipe(response);

})

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