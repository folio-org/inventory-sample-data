'use strict';

var fs = require('fs');
var uuid = require('uuid');

var names = fs.readFileSync(process.argv[2], 'utf-8').split('\n');

var patronGroupId = {
   librarian: "97d25c0c-3c18-4683-8b4a-979f5b6db2bf",
   on_campus: "b0c005d5-599f-4839-b3f7-63000915cfc3",
   off_campus: "a7f4cac3-884a-47be-aef6-ec886a17b164",
   postgrad: "6e50e769-3e07-45f5-a7e2-d83f13d7402b",
   admin: "5464cbd9-2c7d-4286-8e89-20c75980884b",
   institutional: "0da8de38-fd05-44ed-bc51-011fe30eeb9d"
}

var delim = '\t';
var adminUserUUID = "";

for(let i=0; i<names.length-1; i++) {
   let name = names[i].split('\t');

   let username = (name[0].charAt(0) + name[1]).toLowerCase();
   username = username.replace(/\s+/g, ' ').trim();
   let domain = "demo.folio.org";
   let patronGroup;
   let active = i % 10 == 0 ? false : true;
   let email = null;
   let salt = null;
   let hash = null;

   if (name.length > 2) {
      username = name[2];
      email = name[3];
      salt = name[4];
      hash = name[5];
      if (username === "{TENANT}") {
         patronGroup = patronGroupId.institutional;
      } else {
         patronGroup = patronGroupId.admin;
      }
      active = true;
   } else if(i % 25 == 0) {
      patronGroup = patronGroupId.librarian;
   } else if(i % 3 == 0) {
      patronGroup = patronGroupId.on_campus;
   } else if(i % 3 == 1) {
      patronGroup = patronGroupId.off_campus;
      let time = new Date().getTime();
      if(time % 3 == 0) {
         domain = "gmail.com";
      } else if(time % 3 == 1) {
         domain = "ebsco.com";
      } else if(time % 3 == 2) {
         domain = "yahoo.com"
      }
   } else if(i % 3 == 2) {
      patronGroup = patronGroupId.postgrad;
   }

   let Id = uuid.v4();
   if(i==0) {
     adminUserUUID = Id;
   }

   let user = {
      active: active,
      personal: {
         firstName: name[0],
         lastName: name[1].replace(/\s+/g, ' ').trim(),
         email: email ? email : username + "@" + domain,
      },
      username: username,
      patronGroup: patronGroup,
      id: uuid.v4(),
      barcode: Math.floor(Math.random() * 10000000000),
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      metadata: {
         createdDate: new Date().toISOString(),
         createdByUserId: adminUserUUID,
         updatedDate: new Date().toISOString(),
         updatedByUserId: adminUserUUID
      }
   };

   let extra = (salt ? delim + salt + delim + hash : "");
   console.log(user.id + delim + JSON.stringify(user) + extra);
}
