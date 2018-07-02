
/**
 * Converts items to instances
 */

'use strict';

const fs = require('fs');
const es = require('event-stream');
const uuidv4 = require('uuid/v4');
const os = require('os');
const filter = require('stream-filter');
const delim = '\t';

const reg_doublequote = new RegExp("\"", "g");
const reg_slash = new RegExp("\/", "g");

const instances = new Map();

const stream = fs.createReadStream(process.argv[2], {encodeing: 'utf-8'})
	.pipe(es.split('\n'))
	.pipe(filter(function(line) {
		return line != null;
    }))
	.pipe(es.mapSync(function(line) {
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


		// This will coalesce items with the same title
		let instance = instances.get(title);
		if (instance == null) {
			instance = {
					id: uuidv4(),
					title: title,
					alternativeTitles:[],
					instanceTypeId: '2b94c631-fca9-a892-c730-03ee529ffe2c',
					source: 'local',
					identifiers: [],
					contributors: [],
					publication: [],
					classifications: [],
					physicalDescriptions:[],
					series:[],
					urls:[],
					languages:[],
					notes:[]

			};
			instances.set(title, instance);
		}
		// Only add a identifier if it is unique, several items can have the
		// same ISBN number. There is no reason to show the same identifier
		// in the UI multiple times.
		if (Array.isArray(item.isbn)) {
			item.isbn.forEach((i)=>{
				instance.identifiers.push({identifierTypeId: '8261054f-be78-422d-bd51-4ed9f33c3422', value: i});
			})
		}else {
			let isbn = item.isbn == null ? `${Math.floor(Math.random() * 10000000000)}` : item.isbn;
			if (instance.identifiers.filter(identifier => (identifier.identifierTypeId === '8261054f-be78-422d-bd51-4ed9f33c3422' && identifier.value === isbn)).length === 0) {
				instance.identifiers.push({identifierTypeId: '8261054f-be78-422d-bd51-4ed9f33c3422', value: isbn});
			}
		}
		if (item.sierraId != null) {
			let systemControlNumber = item.sierraId.substring(0, item.sierraId.length-1).replace(/^\.b/, "");
			instance.identifiers.push({identifierTypeId: '7e591197-f335-4afb-bc6d-a6d76ca3bace', value: systemControlNumber});
		}
		if (item.alternativeTitle) {
			let alternativeTitle = item.alternativeTitle
			alternativeTitle = alternativeTitle && alternativeTitle.replace(reg_doublequote, "'");
			alternativeTitle = alternativeTitle && alternativeTitle.replace(reg_slash, "");
			instance.alternativeTitles.push(alternativeTitle);
		}
		if (item.oclc) {
			item.oclc.forEach((i)=>{
				instance.identifiers.push({identifierTypeId: '439bfbae-75bc-4f74-9fc7-b2a2d47ce3ef', value: i});
			})
		}
		if (item.issn) {
			item.issn.forEach((i)=>{
				instance.identifiers.push({identifierTypeId: '913300b2-03ed-469a-8179-c1092c991227', value: i});
			})
		}
		if (item.lccn) {
			item.lccn.forEach((i)=>{
			instance.identifiers.push({identifierTypeId: 'c858e4f2-2b6b-4385-842b-60732ee14abb', value: i});
			})
		}
		
		if (item.classificationNumber) {
			instance.classifications.push({classificationTypeId: '6a52c832-0b53-4853-80f3-7bf945f0d669', classificationNumber: item.classificationNumber});
		}
		if (item.mainEntryPersonalName) {
			for (let i = 0; i < item.mainEntryPersonalName.length; i++) {
				instance.contributors.push({name: item.mainEntryPersonalName[i].replace(reg_doublequote, "'"), contributorNameTypeId: '2b94c631-fca9-a892-c730-03ee529ffe2a', primary: true});
			}
		}
		if (item.subjectAddedEntryPersonalName) {
			for (let i = 0; i < item.subjectAddedEntryPersonalName.length; i++) {
				instance.contributors.push({name: item.subjectAddedEntryPersonalName[i].replace(reg_doublequote, "'"), contributorNameTypeId: '2b94c631-fca9-a892-c730-03ee529ffe2a'});
			}
		}
		if (item.addedEntryPersonalName) {
			for (let i = 0; i < item.addedEntryPersonalName.length; i++) {
				instance.contributors.push({name: item.addedEntryPersonalName[i].replace(reg_doublequote, "'"), contributorNameTypeId: '2b94c631-fca9-a892-c730-03ee529ffe2a'});
			}
		}
		if (item.seriesAddedEntryPersonalName) {
			for (let i = 0; i < item.seriesAddedEntryPersonalName.length; i++) {
				instance.contributors.push({name: item.seriesAddedEntryPersonalName[i].replace(reg_doublequote, "'"), contributorNameTypeId: '2b94c631-fca9-a892-c730-03ee529ffe2a'});
			}
		}
		if (item.publisher) {
			let publicationObj = {publisher: item.publisher }
			if (item.place) {
				publicationObj= Object.assign({},publicationObj,{place: item.place });
			}
			if (item.dateOfPublication) {
				publicationObj= Object.assign({},publicationObj,{dateOfPublication: item.dateOfPublication });
			}
			instance.publication.push(publicationObj);
		}
		
		if (instance.edition === null) {
			instance.edition = item.edition
		}
		if (instance.seriesStmt === null) {
			 item.seriesStmt.forEach(s=>{
				let seriesStmt = s.replace(reg_doublequote, "'");
				seriesStmt = seriesStmt.replace(reg_slash, "");
				instance.series.push(seriesStmt)
			})
		}
		if (item.description) {
			let description = item.description
			description = description && description.replace(reg_doublequote, "'");
			description = description && description.replace(reg_slash, "");
			instance.physicalDescriptions.push(description)
		}
		if (item.subject) {
			let subject = item.subject.map(s=>{
				let sub = s.replace(reg_doublequote, "'");
				sub = sub.replace(reg_slash, "");
				return sub;
			})
			instance.subjects=subject
		}
		if (item.urls) {
			item.urls.forEach((url)=>{
				instance.urls.push(url)
			})
		}
		if (item.note) {
			let note = item.note
			 note = note.replace(reg_doublequote, "'");
		     note = note.replace(reg_slash, "");
			instance.notes.push(note)
		}
		if (item.lang) {
			instance.languages.push(item.lang)
		}
		//TODO error and endclassifications type recourseidentifiers alternative titles
		
		// cut number of contributors due to index size limit
		let numOfContributors = instance.contributors.length;
		if (numOfContributors > 50) {
			instance.contributors.splice(0, numOfContributors - 50);
		}

		return (instance.id + delim + JSON.stringify(instance)+os.EOL )
	}))
	.on('end', function() {
		for (let value of instances.values()) {
			console.log(value.id + delim + JSON.stringify(value));
		}
	})
