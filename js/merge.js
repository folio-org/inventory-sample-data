'use strict';

const fs = require('fs');
const os = require('os');
const es = require('event-stream');
const filter = require('stream-filter');
const uuidv4 = require('uuid/v4');
const mergeFile = fs.readFileSync(process.argv[3], 'utf-8').split('\n').filter(String);
/*
	This file takes in source ,merge file and 
	key value to be added in the final merged output file.
	Ex:bib file-->source,holdings file-->merge file ,holdings-->key
*/  
function search(id) {
	let list = [];
		mergeFile.forEach((elm) => {
		const element = JSON.parse(elm)
		//This condition is specific to holdings and instance merging
		if (element.bibId === id) {
			if(element.holdingsId){
				element.holdingsId = uuidv4();
			}
			list.push(JSON.stringify(element))
		}
	})
	return list;
}

const stream = fs.createReadStream(process.argv[2])
    .pipe(es.split())
    .pipe(filter(function(line) {
		return line != null;
    })).pipe(es.mapSync(function(line) {
			const sourceObj = JSON.parse(line)
			let mergeObj = search(sourceObj.bibId);
			const finalObj = Object.assign({},sourceObj,{[process.argv[4]]:mergeObj})
			return JSON.stringify(finalObj)+os.EOL;
		}))
		.pipe(fs.createWriteStream('/tmp/items.json'))
		.on('error', function(err) {
		console.error('Error reading ' + process.argv[2], err)
	})