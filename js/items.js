'use strict';

var fs = require('fs');
const es = require('event-stream');
const filter = require('stream-filter');
const uuidv4 = require('uuid/v4');

var materialTypeId = {
   book: "1a54b431-2e4f-452d-9cae-9cee66c9a892",
   dvd: "5ee11d91-f7e8-481d-b079-65d708582ccc",
   sound_recording: "dd0bf600-dbd9-44ab-9ff2-e2a61a6539f1",
   microform_other: "fd6c6515-d470-4561-9c32-3e3290d4ca98",
   unspecified: "71fbd940-1027-40a6-8a48-49b44d795e46",
   video_recording: "30b3e36a-d3b2-415e-98c2-47fbdf878862"
};

var loanTypeId = {
   circulation: "2b94c631-fca9-4892-a730-03ee529ffe27",
   course_resv: "e8b311a6-3b21-43f2-a269-dd9310cb2d0e",
   reading_room: "2e48e713-17f3-4c13-a9f8-23845bb210a4",
   research: "a1dc1ce3-d56f-4d8a-b498-d5d674ccc845"   
};

var delim = "\t";
var percentOut = 0.025;

var reg_doublequote = new RegExp("\"", "g");
var reg_slash = new RegExp("\/", "g");
var reg_isbn = new RegExp("^[0-9]+[X]?");
var reg_soundrec = new RegExp("\\[sound[\ ]?recording\\]", "i");
var reg_videorec = new RegExp("\\[video[\ ]?recording\\]", "i");
var reg_er = new RegExp("\\[electronic[\ ]?resource\\]", "i");
var reg_map = new RegExp("\\[cartographic[\ ]? material\\]", "i");
var reg_microform = new RegExp("\\[microform\\]", "i");
var reg_cd = new RegExp("(cd|disc|compact dis)", "i");
var reg_cassette = new RegExp("(cassette|cass\.|vhs|tape)", "i");
var reg_dvd = new RegExp("(dvd|digital video dis|video dis|disc)", "i");
var reg_downloadable = new RegExp("(downloadable|audio file)", "i");
var reg_microfiche = new RegExp("(microfiche)", "i");

const locations = fs.readFileSync(process.argv[4], 'utf-8').split('\n');

// Create a map of titles to instances. Instance titles are created the same
// way as item item titles, so they should be exact matches. We need to ensure
// that we continue to construct instance and item titles the same way going
// forward (perhaps extract this code into a utility function).
const titleInstanceMap = new Map();
const recordHoldingMap = new Map();
const itemsMap = new Map();

const instancesStream = fs.createReadStream(process.argv[3], {encoding: 'utf-8'})
	.pipe(es.split('\n'))
	.pipe(filter(function(line) {
		return line != null;
	})).pipe(es.mapSync(function(line) {
		const instance = JSON.parse(line.toString().split(delim)[1]);
		titleInstanceMap.set(instance.title, instance.id);
	})).on('end', function() {
		const recordHoldingStream = fs.createReadStream(process.argv[5], {encoding: 'utf-8'})
		.pipe(es.split('\n'))
		.pipe(filter(function(line) {
			return line != null;
		})).pipe(es.mapSync(function(line) {
            const recordHolding = JSON.parse(line.toString().split(delim)[1]);
            if(process.argv[6]==="mapWithHoldingId"){
                recordHoldingMap.set(recordHolding.id, recordHolding);
            }else{
				recordHoldingMap.set(recordHolding.instanceId + recordHolding.callNumber, recordHolding);
			}
		})).on('end', function() {
			let count = 0;
			const itemsStream = fs.createReadStream(process.argv[2], {encoding: 'utf-8'})
			.pipe(es.split('\n'))
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

				let title = item.title + (item.subtitle ? " " + item.subtitle : "");
				title = title.replace(reg_doublequote, "'");
				title = title.replace(reg_slash, "");

				// fix error for ERROR: index row size exceeds maximum 2712
				if(title.length > 2600) {
					title = title.substring(0,2600);
				}

				let materialType;
				let loanType;

				if(item.medium) {
					if(reg_videorec.test(item.medium)) {
						if(reg_dvd.test(item.note)) {
							materialType = materialTypeId.dvd;
						} else if(reg_cassette.test(item.note)) {
							materialType = materialTypeId.video_recording;
						} else {
							materialType = materialTypeId.unspecified;
						}
					} else if(reg_soundrec.test(item.medium)) {
						if(reg_cd.test(item.note) || reg_cassette.test(item.note) || reg_downloadable.test(item.note)) {
							materialType = materialTypeId.sound_recording;
						} else {
							materialType = materialTypeId.unspecified;
						}
					} else if(reg_er.test(item.medium)) {
						if(reg_downloadable.test(item.note)) {
							materialType = materialTypeId.sound_recording;
						} else {
							materialType = materialTypeId.unspecified;
						}
					} else if(reg_microform.test(item.medium)) {
						if(reg_microfiche.test(item.note)) {
							materialType = materialTypeId.microform_other;
						} else {
							materialType = materialTypeId.unspecified;
						}
						loanType = loanTypeId.research;
					} else if(reg_map.test(item.medium)) {
						materialType = materialTypeId.unspecified;
						loanType = loanTypeId.research;
					}
				} 

				if(!materialType) {
					materialType = materialTypeId.book;

					let rand = Math.floor(Math.random() * 100);
					if(rand == 42) {
						loanType = loanTypeId.reading_room;
					} else if(rand == 13) {
						loanType = loanTypeId.course_resv;
					}
				}

				// Since we are streaming the items in, it is unclear how many items
				// will be loaded. For simplicity, we will use the instance map size
				// which should be good enough.
				let available;
				let every = Math.floor(titleInstanceMap.size/Math.floor(titleInstanceMap.size*percentOut));
				if(!loanType) {
					loanType = loanTypeId.circulation;
					if(count % every == 0) {
						available = "Checked out";
					} else {
						available = "Available";
					}
				} else {
					available = "Available";
                }
                let json
                if(item.holdings) {
                    let holdingsRecord;
                    item.holdings.forEach(hlds => {
						const h = JSON.parse(hlds)
						
                        holdingsRecord = recordHoldingMap.get(h.holdingsId);
                        let holdingsRecordId = holdingsRecord.id;

                        let location = null;
                        if (Math.random() < 0.10) {
                            location = (Math.random() < 0.95) ? locations[0].split(delim)[0] : locations[getRandomInt(1, locations.length)].split(delim)[0];
                            if (!location) {
                                location = locations[0].split(delim)[0];
                            }
            
                            if (location === holdingsRecord.permanentLocationId) {
                                location = null;
                            }
                        }
                        h.item && h.item.forEach((i)=>{
							let id = uuidv4();
							let enumeration = i;
							enumeration = enumeration.replace(reg_doublequote, "'");
							enumeration = enumeration.replace(reg_slash, "");
							let barcode;
							if(i.barcode) {
								barcode = i.barcode;
							} else {
								barcode = Math.floor(Math.random() * 10000000000);
							}
                             json = {
                                status: {
                                    name: available
                                },
                                holdingsRecordId: holdingsRecordId,
                                barcode: barcode,
                                materialTypeId: materialType,
                                temporaryLoanTypeId: loanType,
                                permanentLoanTypeId: loanType,
                                notes: [],
                                enumeration:enumeration,
                                pieceIdentifiers: [],
                                id: id
                            };
                            if (location) {
                                json.temporaryLocationId = location;
                            }
                            if (item.note) {
                                json.notes = [item.note.replace(reg_doublequote, "'")];
                            }
                            itemsMap.set(id,json)
                        })
                    });
                    
                } else {
                    let instance = titleInstanceMap.get(title);
                    const instanceId = instance == null ? '' + Math.floor(Math.random() * 10000000000) : instance;
					let holdingsRecord;
					let id = uuidv4();
					let barcode;
					if(item.barcode) {
						barcode = item.barcode;
					} else {
						barcode = Math.floor(Math.random() * 10000000000);
					}
                    if (item.callNumber) {
                        holdingsRecord = recordHoldingMap.get(instanceId + item.callNumber.replace(reg_doublequote, "'"));
                    } else {
                        holdingsRecord = recordHoldingMap.get(instanceId + instanceId);
                    }
                    let holdingsRecordId = holdingsRecord.id;

                    let location = null;
                    if (Math.random() < 0.10) {
                        location = (Math.random() < 0.95) ? locations[0].split(delim)[0] : locations[getRandomInt(1, locations.length)].split(delim)[0];
                        if (!location) {
                            location = locations[0].split(delim)[0];
                        }
        
                        if (location === holdingsRecord.permanentLocationId) {
                            location = null;
                        }
                    }

                     json = {
                            status: {
                                name: available
                            },
                            holdingsRecordId: holdingsRecordId,
                            barcode: barcode,
                            materialTypeId: materialType,
                            temporaryLoanTypeId: loanType,
                            permanentLoanTypeId: loanType,
                            notes: [],
                            pieceIdentifiers: [],
                            id: id
                    };
                    if (location) {
                        json.temporaryLocationId = location;
                    }
                    if (item.note) {
                        json.notes = [item.note.replace(reg_doublequote, "'")];
                    }
                    itemsMap.set(id,json)
                }
				count++;
			})).on('end', function() {
				for (let value of itemsMap.values()) {
					console.log(value.id + delim + JSON.stringify(value) + delim + value.temporaryLoanTypeId + delim + value.temporaryLoanTypeId + delim + value.materialTypeId);
				}
			});
		})
	})
	
function getRandomInt(inMin, inMax) {
	const min = Math.ceil(inMin);
	const max = Math.floor(inMax);
	//The maximum is exclusive and the minimum is inclusive
	return Math.floor(Math.random() * (max - min)) + min;
}