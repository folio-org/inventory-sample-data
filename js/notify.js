/**
 * Add notifications to random users in the database.
 */

'use strict';

const fs = require('fs');
const uuidv4 = require('uuid/v4');

const users = fs.readFileSync(process.argv[2], 'utf-8').split('\n').filter(Boolean);
const items = fs.readFileSync(process.argv[3], 'utf-8').split('\n').filter(Boolean);

const delim = '\t';
const adminGroupUUID = '"patronGroup":"11111111-1111-1111-1111-111111111104"';
const adminUserUUID = getAdminUserUUID();

const minPercentage = .50;
const maxPercentage = .75;

// Notifications can apply to any user, even admins, so we'll use the whole list.
addRandomNotifications(users, "items", items);

function addRandomNotifications(objects, linkName, linkObjects) {
	const numObjects = getRandomInt(minPercentage * objects.length,
			maxPercentage * objects.length + 1);
	const objectIndexes = generateRandomArray(numObjects, 0, objects.length);

	for (let i = 0; i < objectIndexes.length; i++) {
		const numNotifications = getRandomInt(1, 11);
		const objectJSON = JSON.parse(objects[i].split(delim)[1]);

		for (let j = 0; j < numNotifications; j++) {
			const json = {
					id: uuidv4(),
					recipientId: objectJSON.id,
					link: linkName + '/' + linkObjects[getRandomInt(0, linkObjects.length)].split(delim)[0],
					text: "You have received a notification for '" + linkName + "'. Follow the link for more details.",
					seen: false,
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