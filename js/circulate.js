'use strict';

var fs = require('fs');
var uuid = require('uuid');

var names = fs.readFileSync(process.argv[2], 'utf-8').split('\n');
var items = fs.readFileSync(process.argv[3], 'utf-8').split('\n');
var delim = '\t';
var adminUUID = '"patronGroup":"11111111-1111-1111-a111-111111111104"';

for(let i=0; i<items.length-1; i++) {
   
   let item = JSON.parse(items[i].split(delim)[1]);

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
         loanDate: new Date().toISOString().split('T')[0],
         userId: userId,
         id: uuid.v4()
      };
 
      console.log(item.id + delim + JSON.stringify(json));
   }
}
