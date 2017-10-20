/**
 * Randomize request data in the Database.
 */

'use strict';

const fs = require('fs');
const uuidv4 = require('uuid/v4');

const names = fs.readFileSync(process.argv[2], 'utf-8').split('\n').filter(Boolean);
const loans = fs.readFileSync(process.argv[3], 'utf-8').split('\n').filter(Boolean);
const items = fs.readFileSync(process.argv[4], 'utf-8').split('\n').filter(Boolean);
const delim = '\t';
const adminGroupUUID = '"patronGroup":"11111111-1111-1111-1111-111111111104"';
const adminUserUUID = getAdminUserUUID();
// Fulfilment preferences are defined in
// the API schema. It is an enum with the following 2 values. It is a
// required field in the request object.
//
// NOTE: "Fulfilment" is a non-US variant of "fulfillment" and is the
//       spelling used for the JSON field. To be consistent, the non-US
//       spelling is used throughout this script.
const FULFILMENT_PREFERENCE_HOLD_SHELF = "Hold Shelf";
const FULFILMENT_PREFERENCE_DELIVERY = "Delivery";
// Request types are defined in the API schema. It is an enum of the following
// 3 values. It is a required field in the request object.
const REQUEST_TYPE_HOLD = "Hold";
const REQUEST_TYPE_RECALL = "Recall";
const REQUEST_TYPE_PAGE = "Page";
const REQUEST_TYPES = [
	REQUEST_TYPE_HOLD,
	REQUEST_TYPE_RECALL,
	REQUEST_TYPE_PAGE
];
// Guarantee some amount of request data relative to the total number of loans
// to be stored. Could simply use a fixed minimum/maximum, but there was little
// effort to generate a proportional amount of demo data. These could be inputs
// as well, but for simplicity, we'll manually set them here.
const minPercentage = .10;
const maxPercentage = .25;
const numRequests = getRandomInt(minPercentage * loans.length,
		maxPercentage * loans.length + 1);
const loanIndexes = generateRandomArray(numRequests, 0, loans.length);

for (let i = 0; i < loanIndexes.length; i++) {
	let loanIndex = loanIndexes[i];
	let loan = JSON.parse(loans[loanIndex].split(delim)[1]);

	// Assign a random user to this request
	let userId = null;
	while (userId === null) {
		let userIndex = getRandomInt(0, names.length);

		// Must be an active user and not in the admin group (for demo data)
		if (names[userIndex].includes('"active":true') &&
				!names[userIndex].includes(adminGroupUUID)) {
			userId = names[userIndex].split(delim)[0];

			// Not sure if it makes sense for the request to be from the
			// user that already has the item checked out. For now, we'll
			// get a different user. Probably OK either way for demo data.
			if (!loan.userId === userId) {
				userId = null;
			}
		}
	}

	// Get a random request type
	let requestType = REQUEST_TYPES[getRandomInt(0, 3)];
	let currentDate = new Date().toISOString();
	let adminUUID = adminUserUUID === null ? userId : adminUserUUID;

	let json = {
			id: uuidv4(),
			itemId: loan.itemId,
			requesterId: userId,
			fulfilmentPreference: Math.random() >= 0.5 ? FULFILMENT_PREFERENCE_HOLD_SHELF : FULFILMENT_PREFERENCE_DELIVERY,
			requestDate: currentDate,
			requestType: requestType,
			// Generate metadata. This will prevent the module from issuing
			// warnings in the log. For now, only adding the required fields.
			// N.B. the name of the metadata field varies by module. For
			// whatever reason it is 'metaData' (capital D) in this module.
			// There is also "metadata" and "meta". Be sure to use the proper
			// metadata field name or else the module will flip out.
			metaData : {
				createdDate: currentDate,
				createdByUserId: adminUUID
			}
	};

	// This is not a required field. We will insert it in the JSON 50% of the
	// time. We can tune this down, by decreasing the comparison float.
	if (Math.random() < 0.5) {
		let requestExpirationDate = new Date();
		requestExpirationDate.setDate(requestExpirationDate.getDate() + getRandomInt(1, 8));
		json['requestExpirationDate'] = requestExpirationDate.toISOString().split('T')[0];
	}

	// This is not a required field. We will insert it in the JSON 50% of the
	// time. We can tune this down, by decreasing the comparison float.
	if (Math.random() < 0.5) {
		let holdShelfExpirationDate = new Date();
		holdShelfExpirationDate.setDate(holdShelfExpirationDate.getDate() + getRandomInt(1, 8));
		json['holdShelfExpirationDate'] = holdShelfExpirationDate.toISOString().split('T')[0];
	}

	// Note: there is also the ability to store item and user metadata,
	// specifically:
	// "item": {
	//    "title": "title of item",
	//    "barcode": "1234567890"
	// }
	// "requester": {
	//    "firstName": "Homer",
	//    "lastName": "Simpson",
	//    "middleName": "Jay",
	//    "barcode": "8675309"
	// }
	//
	// These fields are not required and the vagrant image currently does
	// not have these fields stored in the example data in the DB nor is it
	// stored when executed via the UI. We could easily get this data from
	// the items.tsv/names.tsv files. We may as well add this as the indication
	// is that the metadata will be used for sorting and searching and in the
	// current release (9/20/2017) there is an excessive amount of calls to
	// the user and item APIs that may be eliminated by populating these
	// fields, which is trivial to do.

	for (let i = 0; i < items.length; i++) {
		if (items[i].startsWith(json.itemId)) {
			let item = JSON.parse(items[i].split(delim)[1]);

			json['item'] = {
				'title': item.title,
				'barcode': '' + item.barcode
			};

			break;
		}
	}

	for (let i = 0; i < names.length; i++) {
		if (names[i].startsWith(json.requesterId)) {
			let name = JSON.parse(names[i].split(delim)[1]);

			json['requester'] = {
				'firstName': name.personal.firstName,
				'lastName': name.personal.lastName,
				'middleName': name.personal.middleName,
				'barcode': '' + name.barcode
			};

			break;
		}
	}

	console.log(json.id + delim + JSON.stringify(json));
}

function getRandomInt(inMin, inMax) {
	const min = Math.ceil(inMin);
	const max = Math.floor(inMax);
	//The maximum is exclusive and the minimum is inclusive
	return Math.floor(Math.random() * (max - min)) + min;
}

// start is inclusive, stop is exclusive
function generateRandomArray(count, start, stop) {
	const arr = [];
	const resultArr = [];

	for (let i = start; i < stop; i++) {
		arr.push(i);
	}

	for (let i = 0; i < count; i++) {
		let index = getRandomInt(start, stop - i);
		resultArr.push(arr[index]);
		arr.splice(index, 1);
	}

	return resultArr;
}

function getAdminUserUUID() {
	for (let i = 0; i < names.length; i++) {
		if (names[i].includes('"active":true') &&
				names[i].includes(adminGroupUUID)) {
			return names[i].split(delim)[0];
		}
	}

	return null;
}
