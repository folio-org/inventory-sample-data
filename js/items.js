'use strict';

var fs = require('fs');
var uuid = require('uuid');

//var items = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
var lines = fs.readFileSync(process.argv[2], 'utf-8').split('\n');
var instances = fs.readFileSync(process.argv[3], 'utf-8').split('\n').filter(Boolean);

var materialTypeId = {
   book: "19e7caf1-e846-41cb-bf3e-11293720544e",
   audio_download: "0006ea42-7983-46a8-9e0f-36781675d7e1",
   audio_cd: "772b6933-4a52-46ce-948f-3d61cabad9eb",
   audio_cassette: "23be2193-d0f0-4483-83c0-9b71a094ef1a",
   video_dvd: "40a5d7e6-4384-4b60-b04b-435b33811cc3",
   video_vhs: "287fc752-d466-4904-ab72-a5274a7c0a36",
   er_other: "5f573f8a-2939-4d9e-abd9-325b7987e754",
   microform_other: "9a6667a0-41c0-4208-a36c-ea35555ea19b",
   microfiche: "de87b4e1-88bd-44b8-9a98-23d9fc43b97f",
   cartography: "aaef9536-416f-4a40-83fb-900d9f949839"
};

var loanTypeId = {
   circulation: "8089b526-d2d4-441b-bcf2-f0c61b909a87",
   course_resv: "a87dd263-a539-4be4-9525-733ade05369a",
   reading_room: "cca1cf1b-3f93-4ce2-849f-c2a0e9537a38",
   research: "d3d9fe71-b56e-46f5-a2f0-94a848c03dec"   
};

var delim = "\t";
var percentOut = 0.025;

var reg_doublequote = new RegExp("\"", "g");
var reg_slash = new RegExp("\/", "g");
var reg_isbn = new RegExp("^[0-9]+[X]?");
var reg_soundrec = new RegExp("\\[sound[\ ]?recording\\]", "i");
var reg_videorec = new RegExp("\\[video[\ ]?recording\\]", "i");
var reg_er = new RegExp("\\[electronic[\ ]?resource\\]", "i");
var reg_map = new RegExp("\\[cartographic[\ ]? material\\]", "i");
var reg_microform = new RegExp("\\[microform\\]", "i");
var reg_cd = new RegExp("(cd|disc|compact dis)", "i");
var reg_cassette = new RegExp("(cassette|cass\.|vhs|tape)", "i");
var reg_dvd = new RegExp("(dvd|digital video dis|video dis|disc)", "i");
var reg_downloadable = new RegExp("(downloadable|audio file)", "i");
var reg_microfiche = new RegExp("(microfiche)", "i");

const titleInstanceMap = {};
// Create a map of titles to instances. Instance titles are created the same
// way as item item titles, so they should be exact matches. We need to ensure
// that we continue to construct instance and item titles the same way going
// forward (perhaps extract this code into a utility function).
for (let i = 0; i < instances.length; i++) {
	const instance = JSON.parse(instances[i].split(delim)[1]);
	titleInstanceMap[instance.title] = instance.id;
}

for(var i=0; i<lines.length; i++) {
   let item;
   try {
      item = JSON.parse(lines[i]);
   } catch (e) {
      console.error(JSON.stringify(e));
      continue;
   }

   let id = uuid.v4();

   let title = item.title + (item.subtitle ? " " + item.subtitle : "");
   title = title.replace(reg_doublequote, "'");
   title = title.replace(reg_slash, "");
  
   let barcode;
   if(item.isbn && reg_isbn.test(item.isbn)) {
      barcode = reg_isbn.exec(item.isbn)[0];
   } else {
      barcode = Math.floor(Math.random() * 10000000000);
   }
  
   let materialType;
   let loanType;

   if(item.medium) {
      if(reg_videorec.test(item.medium)) {
         if(reg_dvd.test(item.note)) {
            materialType = materialTypeId.video_dvd;
         } else if(reg_cassette.test(item.note)) {
            materialType = materialTypeId.video_vhs;
         } else {
            materialType = materialTypeId.video_dvd;
         }
      } else if(reg_soundrec.test(item.medium)) {
         if(reg_cd.test(item.note)) {
            materialType = materialTypeId.audio_cd;
         } else if(reg_cassette.test(item.note)) {
            materialType = materialTypeId.audio_cassette;
         } else if(reg_downloadable.test(item.note)) {
            materialType = materialTypeId.audio_download;
         } else {
            materialType = materialTypeId.audio_cd;
         }
      } else if(reg_er.test(item.medium)) {
         if(reg_downloadable.test(item.note)) {
            materialType = materialTypeId.audio_download;
         } else {
            materialType = materialTypeId.er_other;
         }
      } else if(reg_microform.test(item.medium)) {
         if(reg_microfiche.test(item.note)) {
            materialType = materialTypeId.microfiche;
         } else {
            materialType = materialTypeId.microform_other;
         }
         loanType = loanTypeId.research;
      } else if(reg_map.test(item.medium)) {
         materialType = materialTypeId.cartography;
         loanType = loanTypeId.research;
      }
   } 

   if(!materialType) {
      materialType = materialTypeId.book;

      let rand = Math.floor(Math.random() * 100);
      if(rand == 42) {
         loanType = loanTypeId.reading_room;
      } else if(rand == 13) {
         loanType = loanTypeId.course_resv;
      }
   }
 
   let available;
   let every = Math.floor(lines.length/Math.floor(lines.length*percentOut));
   if(!loanType) {
      loanType = loanTypeId.circulation;
      if(i % every == 0) {
         available = "Checked out";
      } else {
         available = "Available";
      }

   }

   let instance = titleInstanceMap[title];
   const instanceId = instance == null ? '' + Math.floor(Math.random() * 10000000000) : instance;

   let json = {
      status: {
         name: available
      },
      title: title,
      instanceId: instanceId,
      barcode: barcode,
      materialTypeId: materialType,
      temporaryLoanTypeId: loanType,
      permanentLoanTypeId: loanType,
      location: {  
         name: "Main Library"
      },
      id: id
   };
  
   console.log(id + delim + JSON.stringify(json) + delim + loanType + delim + loanType);
}
