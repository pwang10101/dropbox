let fs = require('pn/fs')
let path = require('path')
let express = require('express')
let mime = require('mime-types')
let archiver = require('archiver')
let mkdir = require('mkdirp')
let rimraf = require('rimraf')
let argv = require('yargs').argv

let rootDir = __dirname;

if (argv.dir){
	rootDir += argv.dir
}

console.log(`root directory: ${rootDir}`)

const PORT = process.env.PORT || 8000

let app = express()
app.listen(PORT, () => console.log(`Listening @ http://127.0.0.1:${PORT}`))

let sendHeaders = async (req, res, next) => {

	console.log(`request: ${req.method}`)

	let filePath = req.filePath = path.join(rootDir, req.url)

	console.log(`filePath: ${req.filePath}`)

	req.isDir = !!filePath.match(/\/$/)

	console.log(`is directory: ${req.isDir}`)

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
		res.status(405).send("file/dir already exist\n")
		return;
	}

	let stat = req.stat

	if (stat && stat.isDirectory()){
		if (req.method === 'GET'
			|| req.method === 'HEAD'){

			req.files = await fs.readdir(filePath)

			res.setHeader('Content-Type', mime.contentType('application.json'))
			res.setHeader('Content-Length', stat.size)

			next()
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
	try {
		let filePath = req.filePath
		if (req.stat.isDirectory()){
			if (req.headers['accept'] === 'application/x-gtar'){
				let archive = archiver('zip')
			    archive.pipe(res);
			    archive.bulk([{
		        	expand: true, 
		        	cwd: filePath, 
		        	src: ['**'], 
		        	dest: filePath
		        }])
			    archive.finalize()
			}
			else {
				res.json(req.files);
			}		
		}
		else {
			fs.createReadStream(filePath).pipe(res)
		}
	}
	catch(e){
		console.log(e.stack)
	}
})

// HEAD
app.head('*', sendHeaders, (req, res, next) => {
})

// PUT
app.put('*', sendHeaders, (req, res) => {
	let filePath = req.filePath;

	if (req.isDir){
		mkdir(filePath)
	}
	else {
		req.pipe(fs.createWriteStream(filePath))
	}

	res.end()
})

// POST
app.post('*', sendHeaders, (req, res) => {
	let filePath = req.filePath;
	if (req.isDir){
		res.status(405).send("cannot post a dir\n")
	}
	else {
		fs.truncate(filePath)
		req.pipe(fs.createWriteStream(filePath))
	}
})

// DELETE
app.delete('*', sendHeaders, (req, res) => { 
	let filePath = req.filePath;
	if (req.isDir){
		console.log('deleting ' + filePath)
		rimraf(filePath, {}, () => console.log(`deleted directory: ${filePath}`));
	}
	else {
		fs.unlink(filePath)
	}
	res.end()
})
