let fs = require('pn/fs')
let path = require('path')
let express = require('express')
let mime = require('mime-types')

const PORT = process.env.PORT || 8000

let app = express()
app.listen(PORT, () => console.log(`Listening @ http://127.0.0.1:${PORT}`))

let rootDir = __dirname;

let sendHeaders = async (req, res, next) => {

	console.log(`request: ${req.method}`)

	let filePath = req.filePath = path.join(rootDir, req.url)

	console.log(`filePath: ${req.filePath}`)

	try {
		req.stat = await fs.stat(filePath);
	}
	catch(e){
		if (req.method === 'GET'
			|| req.method === 'HEAD'
			|| req.method === 'POST'
			|| req.method === 'DELETE'){

			res.status(405).send("file/dir doesn't exist\n")
		}
		else if (req.method === 'PUT'){
			next()
		}

		return;
	}

	if (req.method === 'PUT'){	
		res.send(405, "file/dir already exist\n")
		return;
	}

	let stat = req.stat

	if (stat && stat.isDirectory()){
		if (req.method === 'GET'){
			let files = await fs.readdir(filePath)
			res.json(files);
			return;
		}	
	}

	if (req.method === 'GET'
		|| req.method === 'HEAD'){

		res.setHeader('Content-Type', mime.contentType(path.extname(filePath)))
		res.setHeader('Content-Length', stat.size)
	}

	next();
};

// GET
app.get('*', sendHeaders,(req, res) => {
	let filePath = req.filePath;
	fs.createReadStream(filePath).pipe(res)
})

// HEAD
app.head('*', sendHeaders, (req, res, next) => {
})

// PUT
app.put('*', sendHeaders, (req, res) => {
	let filePath = req.filePath;
	req.pipe(fs.createWriteStream(filePath))
})

// POST
app.post('*', sendHeaders, (req, res) => {
	let filePath = req.filePath;
	fs.truncate(filePath)
	req.pipe(fs.createWriteStream(filePath))
})

// DELETE
app.delete('*', sendHeaders, (req, res) => { 
	let filePath = req.filePath;
	fs.unlink(filePath)
	res.end()
})
