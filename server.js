var fs = require('fs');
var path = require('path');
var restify = require('restify');
var bunyan = require('bunyan');
var tmp = require('tmp');
var ffmpeg = require('fluent-ffmpeg');

var log = new bunyan.createLogger({
	name: 'mockingfish-api-server',
	serializers: {
		req: bunyan.stdSerializers.req
	}
});


(function setupFfmpeg() {
	var ffmpegExeName = 'ffmpeg';
	var ffprobeExeName = 'ffprobe';
	if (process.platform === 'win32') {
		ffmpegExeName += '.exe';
		ffprobeExeName += '.exe';
	}
	var ffmpegPath = path.join(__dirname, 'ffmpeg-bin', process.platform, process.arch, ffmpegExeName);
	ffmpeg.setFfmpegPath(ffmpegPath);
	var ffprobePath = path.join(__dirname, 'ffmpeg-bin', process.platform, process.arch, ffprobeExeName);
	ffmpeg.setFfprobePath(ffprobePath);
})();

var server = restify.createServer({
	name: 'mockingfish-api-server',
	version: '0.0.1',
	log: log
});

server.pre(restify.pre.userAgentConnection()); // For curl
server.pre(function(req, res, next) {
	req.log.info({ req: req }, 'Received request');
	next();
});

server.use(restify.acceptParser(server.acceptable));
server.use(restify.requestLogger());

server.get('/', function(req, res, next) {
	res.send('Welcome to the MockingFish API');
	return next();
});

// List editable videos
server.get('/videos', function(req, res, next) {
	fs.readdir(__dirname + '/videos', function(err, files) {
		if (err) {
			res.status(500).send({ msg: 'Error reading file', error: err });
			return next(err);
		}
		var list = files.map(function(fileName) {
			return {
				id: fileName,
				path: '/videos/' + fileName
			};
		});
		res.send(list);
		return next();
	});
});

// Get editable video
server.get('/videos/:id', restify.serveStatic({
	directory: __dirname
}));

// List video mixes
server.get('/mixes', function(req, res, next) {
	fs.readdir(__dirname + '/mixes', function(err, files) {
		if (err) {
			res.status(500).send({ msg: 'Error reading file', error: err });
			return next(err);
		}
		var list = files.map(function(fileName) {
			return {
				id: fileName,
				path: '/mixes/' + fileName
			};
		});
		res.send(list);
		return next();
	});
});

// Get video mix
server.get('/mixes/:id', restify.serveStatic({
	directory: __dirname
}));

// Create mix
server.post('/mixes', restify.jsonBodyParser(), function(req, res, next) {
	var params = JSON.parse(req.body);

	var baseFileName = path.parse(params.video).name;
	var baseVideoFile = path.join(__dirname, 'videos', params.video);
	var baseAudioFile = path.join(__dirname, 'tmp', baseFileName + '.mp3');

	// TODO: Cache audio file to avoid recreation
	ffmpeg(baseVideoFile)
		.audioCodec('libmp3lame')
		.on('error', function(err) {
			console.log('Error processing video: ' + err.message);
			res.status(500).send({ msg: 'Error processing video', error: err });
		})
		.on('end', function() {
			/*** Split ***
			ffmpeg(baseAudioFile)
				.addOptions([
					'-ss ' + params.splices[0].location, // Splice start
					'-t ' + <audio length>, // Splice length
				])
				.save(
			*/

			/*** Concat ***
			ffmpeg(input1).input(input2).input(input3)
				.on('error', function(err) {
					console.log('Error concatenating audio: ' + err.message);
					res.status(500).send({ msg: 'Error concatenating audio', error: err });
				})
				.on('end', function() {
					console.log('Concat complete');
				})
				.mergeToFile(path.join(__dirname, 'mixes', mixName), path.join(__dirname, 'tmp'));
			*/

			/*** File duration ***/
			ffmpeg.ffprobe(baseAudioFile, function(err, metadata) {
				if (err) {
					console.log('Error reading audio file metadata: ' + err.message);
					return res.status(500).send({ msg: 'Error reading audio file metadata', error: err });
				}
				console.log(metadata.format.duration);
				res.send('ok');
			});
			/* */

			/*** Replace audio ***
			var outPath = getRandomFileName('mixes', 'mix-', '.mp4');
			ffmpeg(path.join(__dirname, 'videos', 'omg-i-love-chipotle.mp4'))
				.input(path.join(__dirname, 'tmp', 'omg-i-love-javascript.mp3'))
				.addOptions(['-map 0:0', '-map 1:0', '-c:v copy', '-c:a copy'])
				.on('error', function(err) {
					console.log('Error merging audio into video: ' + err);
					res.status(500).send({ msg: 'Error merging audio into video', error: err });
				})
				.on('end', function() {
					console.log('Success!');
					res.send('ok');
				})
				.save(outPath);
			*/
		})
		.save(baseAudioFile);

	next();
});

// List audio clips
server.get('/clips', function(req, res, next) {
	fs.readdir(__dirname + '/clips', function(err, files) {
		if (err) {
			res.status(500).send({ msg: 'Error reading file', error: err });
			return next(err);
		}
		var list = files.map(function(fileName) {
			return {
				id: fileName,
				path: '/clips/' + fileName
			};
		});
		res.send(list);
		next();
	});
});

// Get audio clip
server.get('/clips/:id', restify.serveStatic({
	directory: __dirname
}));

// Post audio clip
server.post('/clips', function(req, res, next) {
	// TODO: Use hash instead of tmp name
	// TODO: Get audio format (& extension) from request

	req.log.info('Initiating upload to ' + fPath);
	var fPath = getRandomFileName('clips', 'clip-', '.mp3');
	var ws = fs.createWriteStream(fPath);
	var rs = req.pipe(ws);

	rs.on('drain', function() {
		req.log.info('Data segment saved...');
	});

	rs.on('finish', function() {
		req.log.info('Upload complete ' + path.basename(fPath));
		res.send({ id: path.basename(fPath) });
	});

	next();
});

function getRandomFileName(subdir, prefix, ext) {
	return tmp.tmpNameSync({
		dir: path.join(__dirname, subdir),
		prefix: prefix,
		postfix: ext,
		keep: true
	});
}

server.listen(process.env.PORT || 5000, function() {
	console.log(server.name + ' listening at ' + server.url);
});

