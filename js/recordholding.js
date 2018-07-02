'use strict';

const fs = require('fs');
const es = require('event-stream');
const filter = require('stream-filter');
const uuidv4 = require('uuid/v4');
const delim = "\t";
const os = require('os')

const reg_doublequote = new RegExp("\"", "g");
const reg_slash = new RegExp("\/", "g");

const titleInstanceMap = new Map();
const holdingsRecordMap = new Map();

const locations = fs.readFileSync(process.argv[3], 'utf-8').split('\n').filter(String);
const stream = fs.createReadStream(process.argv[2], {encoding: 'utf-8'})
    .pipe(es.split('\n'))
    .pipe(filter(function(line) {
		return line != null;
    })).pipe(es.mapSync(function(line) {
		const instance = JSON.parse(line.toString().split(delim)[1]);
		titleInstanceMap.set(instance.title, instance.id);
    }))
    .on('error', function(err) {
		console.error('Error reading ' + process.argv[2], err)
	})
    .on('end', function() {
		fs.createReadStream(process.argv[4], {encoding: 'utf-8'})
			.pipe(es.split())
			.pipe(filter(function(line) {
				return line != null;
			})).pipe(es.through(function(line) {
				let item;
				try {
					item = JSON.parse(line);
				} catch (e) {
					console.error(JSON.stringify(e));
					return;
				}
				const instanceId = getInstanceId(item);
				if (!item.callNumber) {
					item.callNumber = instanceId;
				}
				let json = {}
				if(item.holdings){
					const holdingsArray = item.holdings
					holdingsArray.forEach(holding=>{
						const h = JSON.parse(holding)
						//Map the permenantLoc id in the marc to location tsv code and get the valid uuid
						const permanentLocationId = locations.map(l=>JSON.parse(l.split(delim)[1])).filter(l=>{
							const permLoc = h.permanentLocationId.replace(',','/')
							return l.code.match(permLoc)
						})[0].id
						const id = h.holdingsId ? h.holdingsId : instanceId;
						 json = {
							id: id,
							instanceId: instanceId,
							permanentLocationId: permanentLocationId,
							callNumber: h.callNumber?h.callNumber.replace(reg_doublequote, "'"):item.callNumber
						};
						holdingsRecordMap.set(id, json);
					})
				}else {
					let holdingsRecord = holdingsRecordMap.get(instanceId + item.callNumber);
					const id = uuidv4();
					if (!holdingsRecord) {
						
						const location_id = (Math.random() < 0.95) ? locations[0].split(delim)[0] : locations[getRandomInt(1, locations.length)].split(delim)[0];
						 json = {
							id: id,
							instanceId: instanceId,
							permanentLocationId: location_id,
							callNumber: item.callNumber.replace(reg_doublequote, "'")
						};

						holdingsRecordMap.set(id, json);
					}
				}
			}))
			.on('error', function(err) {
				console.error('Error reading ' + process.argv[4], err)
			})
			.on('end', function() {
				for (let value of holdingsRecordMap.values()) {
					console.log(value.id + delim + JSON.stringify(value) + delim + value.permanentLocationId);
				}
			});
    });

function getInstanceId(item) {
	let title = item.title + (item.subtitle ? " " + item.subtitle : "");
	title = title.replace(reg_doublequote, "'");
	title = title.replace(reg_slash, "");

	// fix error for ERROR: index row size exceeds maximum 2712
	if(title.length > 2600) {
		title = title.substring(0,2600);
	}

	return titleInstanceMap.get(title);
}

function getRandomInt(inMin, inMax) {
	const min = Math.ceil(inMin);
	const max = Math.floor(inMax);
    //The maximum is exclusive and the minimum is inclusive
    return Math.floor(Math.random() * (max - min)) + min;
}
