'use strict';

const fs = require('fs');
const es = require('event-stream');
const filter = require('stream-filter');
const uuidv4 = require('uuid/v4');
const delim = "\t";
const os = require('os')

const reg_doublequote = new RegExp("\"", "g");
const reg_slash = new RegExp("\/", "g");

const locationLibMap = new Map();
const locationsMap = new Map();

const locationsInst = fs.readFileSync(process.argv[2], 'utf-8').split('\n').filter(String);
const locationsCamp = fs.readFileSync(process.argv[3], 'utf-8').split('\n').filter(String);
const locationsLibNameCode = fs.readFileSync(process.argv[4], 'utf-8').split('\n').filter(String);
const locationsNameCode = fs.readFileSync(process.argv[5], 'utf-8').split('\n').filter(String);
const stream = fs.createReadStream(process.argv[6], {encoding: 'utf-8'})
			.pipe(es.split())
			.pipe(filter(function(line) {
				return line != null;
			})).pipe(es.through(function(line) {
				let bib;
				try {
					bib = JSON.parse(line);
				} catch (e) {
					console.error(JSON.stringify(e));
					return;
				}
                bib.holdings.forEach(h => {
                    const holding = JSON.parse(h)
                    if(holding.permanentLocationId){
                        const locData = holding.permanentLocationId.split(',')
                        const locLib = locData && locData[0];
                        const loc = locData && locData[1];
                        if(locLib){
                            let locLibId
                            const campusId = locationsCamp[0].split(delim)[0];
                            const institutionId = locationsInst[0].split(delim)[0]
                            const locationLibname = locationsLibNameCode.map(elm => {
                                const l = elm.split(delim)
                                return {
                                    name:l[0],
                                    code:l[1].slice(0,-1)
                                }
                            }).filter((elm=>elm.code === locLib))[0].name
                            const campusCode = JSON.parse(locationsCamp[0].split(delim)[1]).code;
                            const institutionCode = JSON.parse(locationsInst[0].split(delim)[1]).code;
                            const mainCode = `${institutionCode}/${campusCode}/${locLib}`;
                            if(!locationLibMap.get(locLib)){
                                 locLibId = uuidv4();
                                const locLibJson ={
                                    "id": locLibId,
                                    "name": locationLibname,
                                    "code": locLib,
                                    "campusId": campusId
                                }
                                locationLibMap.set(locLib,locLibJson)
                            }else {
                                locLibId = locationLibMap.get(locLib).id
                            }
                            if(loc){
                                const locId = uuidv4();
                                const locCode = `${mainCode}/${loc}`
                                if(!locationsMap.get(locCode)){
                                    const locName =  locationsNameCode.map(elm => {
                                        const l = elm.split(delim)
                                        return {
                                            name:l[0],
                                            code:l[1].slice(0,-1)
                                        }
                                    }).filter((elm=>elm.code === loc))[0].name;
                                    const json = {
                                        "id": locId,
                                        "name": `${locationLibname} ${locName}`,
                                        "code": locCode,
                                        "isActive": true,
                                        "institutionId": institutionId,
                                        "campusId": campusId,
                                        "libraryId": locLibId
                                    }
                                    locationsMap.set(locCode,json)
                                }
                            } else {
                              const mainLocCode = `${mainCode}/M`
                                const locId = uuidv4();
                                if(!locationsMap.get(mainLocCode)){
                                    const json = {
                                        "id": locId,
                                        "name": `Main ${locationLibname}`,
                                        "code":mainLocCode,
                                        "isActive": true,
                                        "institutionId": institutionId,
                                        "campusId": campusId,
                                        "libraryId": locLibId
                                    }
                                    locationsMap.set(mainLocCode,json)
                                }
                            }
                        }
                    }
                });
			}))
			.on('error', function(err) {
				console.error('Error reading ' + process.argv[4], err)
			})
			.on('end', function() {
				for (let value of locationLibMap.values()) {
                    let logger = fs.createWriteStream(`${process.argv[7]}/locLibraries.tsv`, {
                        flags: 'a'
                      })
					logger.write(value.id + delim + JSON.stringify(value) +os.EOL )
                }
                for (let value of locationsMap.values()) {
                    let logger = fs.createWriteStream(`${process.argv[7]}/locations.tsv`, {
                        flags: 'a'
                      })
					logger.write(value.id + delim + JSON.stringify(value) +os.EOL )
				}
			});
