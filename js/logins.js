'use strict';

var fs = require('fs');
var crypto = require('crypto');
var CryptoJS = require('crypto-js');

function genSalt (length) {
   return crypto.randomBytes(Math.ceil(length/2))
           .toString('hex')
           .toUpperCase()
           .slice(0,length);
};

function hashPassword (password, salt) {
   var salt = CryptoJS.enc.Hex.parse(salt);
   var key = CryptoJS.PBKDF2(password, salt, { keySize: 160, iterations: 1000 });
   return key.toString().substring(0,40).toUpperCase();
};

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
   } else {
      //  TODO: for demo site, skip creating login if non-admin
      continue;           
      // salt = genSalt(40);
      // hash = hashPassword(user.username, salt);
   }
   let login = {
      userId: user.id,
      salt: salt,
      hash: hash
   };
   
   console.log(JSON.stringify(login));
}
