'use strict';

const fs = require('fs');
const uuid = require('uuid');
const passUtils = require('./pass-utils.js');

var names = fs.readFileSync(process.argv[2], 'utf-8').split('\n');

var delim = '\t';

for(let i=0; i<names.length-1; i++) {
   let name = names[i].split(delim);
   let user = JSON.parse(name[1]);
   let salt = null;
   let hash = null;
   if (name.length > 2) {
      salt = name[2];
      hash = name[3]; 
      hash = hash.replace(/\s+/g, ' ').trim();
   } else {
      //  TODO: for demo site, skip creating login if non-admin
      continue;           
      // salt = passUtils.genSalt(40);
      // hash = passUtils.hashPassword(user.username, salt);
   }
   
   let login = {
      id: uuid.v4(),
      userId: user.id,
      salt: salt,
      hash: hash
   };
   
   console.log(login.id + delim + JSON.stringify(login));
}
