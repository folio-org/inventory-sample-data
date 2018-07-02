'use strict';

var fs = require('fs');
const es = require('event-stream');
const filter = require('stream-filter');
const uuidv4 = require('uuid/v4');

var delim = '\t';
var adminUUID = '"patronGroup":"5464cbd9-2c7d-4286-8e89-20c75980884b"';
var loanPolicyId = "d9cd0bed-1b49-4b5e-a7bd-064b8d177231";

var names = fs.readFileSync(process.argv[2], 'utf-8').split('\n');
const stream = fs.createReadStream(process.argv[3], {encoding: 'utf-8'})
	.pipe(es.split('\n'))
	.pipe(filter(function(line) {
		return line != null;
	})).pipe(es.mapSync(function(line) {
		let item = JSON.parse(line.toString().split(delim)[1]);

		if(item.status.name == "Checked out") {

			let userId = null;
			while(userId == null) {
				let userIdx = Math.floor(Math.random() * (names.length-1)) + 1;
				if(names[userIdx].includes('"active":true') && !names[userIdx].includes(adminUUID)) {
					userId = names[userIdx].split(delim)[0];
				}
			}

			let json = {
					itemId: item.id,
					status: {
						name: "Open"
					},
					action: "checkedout",
                                        loanDate: "{LOAN_DATE}",
					dueDate: "{DUE_DATE}",
					userId: userId,
					id: uuidv4(),
					loanPolicyId: loanPolicyId,
					metadata: {
						createdDate: new Date().toISOString(),
						createdByUserId: userId,
						updatedDate: new Date().toISOString(),
						updatedByUserId: userId
					}
			};

			console.log(item.id + delim + JSON.stringify(json));
		}
	}));
