var MongoClient = require('mongodb').MongoClient;
var fs = require('fs');
var mongodb;


const url = "mongodb://localhost:27017/";

/* 
This class handles DB logging, as well as detailed logs to both debug and output files
*/
module.exports = class Logger {

	constructor(){
		this.streams = {};
	}

	async initDB(){
		var that = this;
		return new Promise((resolve, reject) => {
			MongoClient.connect(url, {  
	 			poolSize: 5
	  			// other options can go here
			}, function(err, client) {
	   			that.mongodb=client.db('chainwatch');
	   			console.log("Connected to MongoDB");
	   			resolve();
	    	});
	    });
	}


	createOutputStreams(network){
		console.log("Created output streams for network: " + network);
		// create output streams
		var dStream = fs.createWriteStream(__dirname + '/log/' + network + '_debug.log', {flags : 'a'});
		var oStream = fs.createWriteStream(__dirname + '/log/' + network + '_out.log', {flags : 'a'});

		this.streams[network] = {"debug": dStream, "output": oStream};
	}

	async logReorg(network, oldWindow, newWindow, start, end){
		/* DATA SCHEMA
		* numBlocks
		* start
		* end
		* blocks:{blockNo: {forkHash, canonicalHash}}
		*/
		var logObj = {
			network: network,
			numBlocks: end-start+1,
			detected: this.getTimestring(),
			start: start,
			end: end,
			blocks: {}
		}

		// add blocks to logObj
		for(var i=start; i<=end; i++){
			var b = {
				old: oldWindow.blocks[i],
				new: newWindow.blocks[i]
			};
			logObj.blocks[i] = b;
		}

		await this.mongodb.collection('reorg_events').insertOne(logObj);
	}


	async logMinerDensity(network, window, start, end, maj, miners){
		var logObj = {
			network: network,
			detected: this.getTimestring(),
			majorityMiner: maj,
			numBlocks:end-start+1,
			start: start,
			end: end,
			miners: miners
		}

		// don't relog same event
		var exists = await this.mongodb.collection('density_events').count({end: {$gte: start, $lte: end}}, {limit:1});
		if(exists == 0){
			await this.mongodb.collection('density_events').insertOne(logObj);
		}
	}

	async logStatistics(network, startBlock, endBlock, bt, diff, hashrate, miners){
		var logObj = {
			network: network,
			timestamp: this.getTimestring(),
			startBlock: startBlock,
			endBlock: endBlock,
			blockTime: bt,
			hashrate: hashrate,
			difficulty: diff,
			miners: miners 
		}
		
		await this.mongodb.collection('statistics').insertOne(logObj);
	}


	// prints data to the appropriate output stream
	outputToStream(network, stream, str){
		this.streams[network][stream].write(str);
	}

	getTimestring(){
		return new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
	}
}
