'use strict';

var fs = require('fs');
var uuid = require('uuid');

var names = fs.readFileSync(process.argv[2], 'utf-8').split('\n');

// keep admin updated to includes both backend and ui permissions
// for librarian and patron, consider to use just ui permissions
var permissionSets = {
   admin: ["okapi.all", "login.all", "perms.all", "users.all", "users-bl.all", "user-import.all", "codex.all", "notes.all", "notify.all", "configuration.all", "inventory.all", "inventory-storage.all", "circulation.all", "circulation-storage.all", "ui-checkin.all", "ui-checkout.all", "settings.checkout.enabled", "module.developer.enabled", "settings.developer.enabled", "settings.loan-policies.all", "settings.loan-rules.all", "ui-circulation.settings.fixed-due-date-schedules", "module.eholdings.enabled", "settings.eholdings.enabled", "module.inventory.enabled", "module.organization.enabled", "ui-organization.settings.key-bindings", "ui-organization.settings.locale", "ui-organization.settings.plugins", "ui-organization.settings.sso", "ui-organization.settings.location", "ui-requests.all", "module.search.enabled", "module.notes.enabled", "stripes-util-notes.all", "ui-users.create", "ui-users.editperms", "ui-users.editpermsets", "settings.usergroups.all", "settings.addresstypes.all", "ui-users.editproxies", "settings.inventory.enabled", "ui-inventory.settings.loantypes", "ui-inventory.settings.materialtypes", "rtac.all", "settings.calendar.enabled", "ui-calendar.all", "module.vendors.enabled", "vendor.module.all", "patron.all"],
   librarian: ["circulation.all", "circulation-storage.all", "configuration.all", "inventory.all", "inventory-storage.all", "login.all", "module.checkin.enabled", "module.checkout.enabled", "module.developer.enabled", "module.items.enabled", "module.organization.enabled", "module.requests.enabled", "module.scan.enabled", "module.users.enabled", "module.instances.enabled", "notes.all", "notify.all", "okapi.all", "perms.all", "settings.addresstypes.all", "settings.checkout.enabled", "settings.developer.enabled", "settings.enabled", "settings.items.enabled", "settings.loan-policies.all", "settings.loan-types.all", "settings.material-types.all", "settings.organization.enabled", "settings.usergroups.all", "settings.users.enabled", "ui-checkin.all", "ui-checkout.all", "ui-items.all", "ui-items.settings.loan-types", "ui-items.settings.material-types", "ui-organization.settings.key-bindings", "ui-organization.settings.locale", "ui-organization.settings.plugins", "ui-organization.settings.sso", "ui-users.settings.addresstypes", "ui-users.settings.permsets", "ui-users.settings.usergroups", "users.all", "users-bl.all", "module.inventory.enabled","module.search.enabled","module.eholdings.enabled", "settings.inventory.enabled", "ui-inventory.settings.loantypes", "ui-inventory.settings.materialtypes", "rtac.all", "patron.all"],
   patron: [ "login.all", "inventory-storage.material-types.collection.get", "inventory.items.collection.get", "inventory-storage.loan-types.collection.get", "usergroups.collection.get", "users.collection.get", "configuration.entries.collection.get", "users.item.get", "inventory.items.item.get", "perms.permissions.get", "perms.users.get", "addresstypes.collection.get", "circulation-storage.requests.collection.get", "module.users.enabled" , "module.items.enabled", "module.requests.enabled", "module.checkin.enabled", "module.checkout.enabled", "module.scan.enabled", "module.instances.enabled", "module.inventory.enabled","module.search.enabled","module.eholdings.enabled", "rtac.all", "patron.all"],
   institutional: ["login.all", "rtac.all", "patron.all"]
};

var patronGroupId = {
   librarian: "97d25c0c-3c18-4683-8b4a-979f5b6db2bf",
   on_campus: "b0c005d5-599f-4839-b3f7-63000915cfc3",
   off_campus: "a7f4cac3-884a-47be-aef6-ec886a17b164",
   postgrad: "6e50e769-3e07-45f5-a7e2-d83f13d7402b",
   admin: "5464cbd9-2c7d-4286-8e89-20c75980884b",
   institutional: "0da8de38-fd05-44ed-bc51-011fe30eeb9d"
};

var delim = '\t';

for(let i=0; i<names.length-1; i++) {
   let user = JSON.parse(names[i].split('\t')[1]);
   let permissions;

   if(user.patronGroup == patronGroupId.admin) {
      permissions = permissionSets.admin;
   } else if(user.patronGroup == patronGroupId.librarian) {
      permissions = permissionSets.librarian;
   } else if(user.patronGroup == patronGroupId.institutional) {
      permissions = permissionSets.institutional;
   } else {
      permissions = permissionSets.patron;
   }

   let perm = {
      id: uuid.v4(),
      userId: user.id,
      permissions: permissions
   };
   
   console.log(perm.id + delim + JSON.stringify(perm));
}
