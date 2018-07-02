'use strict';

const crypto = require('crypto');
const cryptoJS = require('crypto-js');
const uuid = require('uuid');

const delim = '\t';

exports.genPassword = function (length) {
    return crypto.randomBytes(length).toString('base64').slice(0,length);
//    return Math.random().toString(36).substr(2,length);
}

exports.genSalt = function (length) {
    return crypto.randomBytes(Math.ceil(length/2)) 
           .toString('hex')
           .toUpperCase()
           .slice(0,length);
};

exports.hashPassword = function (password, salt) {
    var salt = cryptoJS.enc.Hex.parse(salt);
    var key = cryptoJS.PBKDF2(password, salt, { keySize: 160, iterations: 1000 });
    return key.toString().substring(0,40).toUpperCase();
};

exports.genLogin = function (username, password, saltLen) {
    let salt = this.genSalt(saltLen);
    let hash = this.hashPassword(password, salt);

    let login = {
        id: uuid.v4(),
        userId: username,
        salt: salt,
        hash: hash
    };
    
    return login.id + delim + JSON.stringify(login);
};

exports.selectPassword = function (passwords, exclude) {
    let candidates = passwords.filter(function(i) {
        return !exclude.includes(i) && i != "";
    });
    console.log(candidates[Math.floor(Math.random() * candidates.length)]);
};
