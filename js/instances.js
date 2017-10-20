/**
 * Converts items to instances
 */

'use strict';

const fs = require('fs');
const uuidv4 = require('uuid/v4');

const items = fs.readFileSync(process.argv[2], 'utf-8').split('\n').filter(Boolean);
const delim = '\t';

const reg_doublequote = new RegExp("\"", "g");
const reg_slash = new RegExp("\/", "g");

const instances = {};

for (let i = 0; i < items.length; i++) {
	   let item;
	   try {
	      item = JSON.parse(items[i]);
	   } catch (e) {
	      console.error(JSON.stringify(e));
	      continue;
	   }

	   let title = item.title + (item.subtitle ? " " + item.subtitle : "");
	   title = title.replace(reg_doublequote, "'");
	   title = title.replace(reg_slash, "");

	   let isbn = item.isbn == null ? Math.floor(Math.random() * 10000000000) : item.isbn;
	   isbn = '' + isbn;
	   isbn = isbn.replace(reg_doublequote, "'");

	   // This will coalesce items with the same title
	   const instance = instances[title];
	   if (instance == null) {
		   const json = {
				   id: uuidv4(),
				   title: title,
				   identifiers: [ {
					   namespace: 'isbn',
					   value: isbn
				   } ]
		   };
	   
		   instances[title] = json;
	   } else {
		   instance.identifiers.push({namespace: 'isbn', value: isbn});
	   }
}

for (let key in instances) {
	console.log(instances[key].id + delim + JSON.stringify(instances[key]));
}