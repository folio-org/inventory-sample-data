/**
 * Add notes to random users in the database.
 */

'use strict';

const fs = require('fs');
const uuidv4 = require('uuid/v4');

const users = fs.readFileSync(process.argv[2], 'utf-8').split('\n').filter(Boolean);
// See comment below about notes support in Folio
// const items = fs.readFileSync(process.argv[3], 'utf-8').split('\n').filter(Boolean);

const delim = '\t';
const adminGroupUUID = '"patronGroup":"5464cbd9-2c7d-4286-8e89-20c75980884b"';
const adminUserUUID = getAdminUserUUID();

const minPercentage = .10;
const maxPercentage = .25;

// Currently (9/21/2017), the UI only creates notes for users. There is a
// object specific name in the link. In the users case it is "users", so the
// note link looks like "users/<User-UUID>". Notes should be able to be added
// to whatever objects that make sense, like items. The assumption would be
// that a note link to an item would be "items/<Item-UUID>", but it is not
// clear if that will be the case.

// Notes can apply to any user, even admins, so we'll use the whole list.
addRandomNotes(users, "users");
// addRandomNotes(items, "items");

function addRandomNotes(objects, linkName) {
	const numObjects = getRandomInt(minPercentage * objects.length,
			maxPercentage * objects.length + 1);
	const objectIndexes = generateRandomArray(numObjects, 0, objects.length);

	for (let i = 0; i < objectIndexes.length; i++) {
		const numNotes = getRandomInt(1, 11);
		const objectJSON = JSON.parse(objects[i].split(delim)[1]);

		for (let j = 0; j < numNotes; j++) {
			let json = {
					id: uuidv4(),
					link: linkName + '/' + objectJSON.id,
					text: "Note number " + (j + 1) + " for " + objectJSON.id,
					metadata: {
						createdDate: new Date().toISOString(),
						createdByUserId: adminUserUUID
					}
			};

			console.log(json.id + delim + JSON.stringify(json));
		}
	}
}

function getAdminUserUUID() {
	for (let i = 0; i < users.length; i++) {
		if (users[i].includes('"active":true') &&
				users[i].includes(adminGroupUUID)) {
			return users[i].split(delim)[0];
		}
	}

	return null;
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