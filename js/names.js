'use strict';

var fs = require('fs');
var uuid = require('uuid');

var names = fs.readFileSync(process.argv[2], 'utf-8').split('\n');

var patronGroupId = {
   librarian: "11111111-1111-1111-1111-111111111100",
   on_campus: "11111111-1111-1111-1111-111111111101",
   off_campus: "11111111-1111-1111-1111-111111111102",
   postgrad: "11111111-1111-1111-1111-111111111103",
   admin: "11111111-1111-1111-1111-111111111104"
}

var delim = '\t';

for(let i=0; i<names.length-1; i++) {
   let name = names[i].split('\t');

   let username = (name[0].charAt(0) + name[1]).toLowerCase();
   let domain = "folio.org";
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
      patronGroup = patronGroupId.admin;
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
         domain = "folio.org";
      } else if(time % 3 == 2) {
         domain = "yahoo.com"
      }
   } else if(i % 3 == 2) {
      patronGroup = patronGroupId.postgrad;
   }

   let user = {
      active: active,
      personal: {
         firstName: name[0],
         lastName: name[1],
         email: email ? email : username + "@" + domain,
      },
      username: username,
      patronGroup: patronGroup,
      id: uuid.v4(),
      barcode: Math.floor(Math.random() * 10000000000)
   };

   let extra = (salt ? delim + salt + delim + hash : "");
   console.log(user.id + delim + JSON.stringify(user) + extra);
}
