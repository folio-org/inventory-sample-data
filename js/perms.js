'use strict';

var fs = require('fs');
var uuid = require('uuid');

var names = fs.readFileSync(process.argv[2], 'utf-8').split('\n');

var permissionSets = {
   admin: ["circulation.all", "circulation-storage.all", "configuration.all", "inventory.all", "inventory-storage.all", "login.all", "module.checkin.enabled", "module.checkout.enabled", "module.developer.enabled", "module.items.enabled", "module.organization.enabled", "module.requests.enabled", "module.scan.enabled", "module.users.enabled", "module.instances.enabled", "notes.all", "notify.all", "okapi.all", "perms.all", "settings.addresstypes.all", "settings.checkout.enabled", "settings.developer.enabled", "settings.enabled", "settings.items.enabled", "settings.loan-policies.all", "settings.loan-types.all", "settings.material-types.all", "settings.organization.enabled", "settings.usergroups.all", "settings.users.enabled", "ui-checkin.all", "ui-checkout.all", "ui-items.all", "ui-items.settings.loan-types", "ui-items.settings.material-types", "ui-organization.settings.key-bindings", "ui-organization.settings.locale", "ui-organization.settings.plugins", "ui-organization.settings.sso", "ui-users.settings.addresstypes", "ui-users.settings.permsets", "ui-users.settings.usergroups", "users.all", "users-bl.all"],
   librarian: ["circulation.all", "circulation-storage.all", "configuration.all", "inventory.all", "inventory-storage.all", "login.all", "module.checkin.enabled", "module.checkout.enabled", "module.developer.enabled", "module.items.enabled", "module.organization.enabled", "module.requests.enabled", "module.scan.enabled", "module.users.enabled", "module.instances.enabled", "notes.all", "notify.all", "okapi.all", "perms.all", "settings.addresstypes.all", "settings.checkout.enabled", "settings.developer.enabled", "settings.enabled", "settings.items.enabled", "settings.loan-policies.all", "settings.loan-types.all", "settings.material-types.all", "settings.organization.enabled", "settings.usergroups.all", "settings.users.enabled", "ui-checkin.all", "ui-checkout.all", "ui-items.all", "ui-items.settings.loan-types", "ui-items.settings.material-types", "ui-organization.settings.key-bindings", "ui-organization.settings.locale", "ui-organization.settings.plugins", "ui-organization.settings.sso", "ui-users.settings.addresstypes", "ui-users.settings.permsets", "ui-users.settings.usergroups", "users.all", "users-bl.all"],
   patron: [ "login.all", "inventory-storage.material-types.collection.get", "inventory.items.collection.get", "inventory-storage.loan-types.collection.get", "usergroups.collection.get", "users.collection.get", "configuration.entries.collection.get", "users.item.get", "inventory.items.item.get", "perms.permissions.get", "perms.users.get", "addresstypes.collection.get", "circulation-storage.requests.collection.get", "module.users.enabled" , "module.items.enabled", "module.requests.enabled", "module.checkin.enabled", "module.checkout.enabled", "module.scan.enabled", "module.instances.enabled"]
};

var patronGroupId = {
   librarian: "11111111-1111-1111-a111-111111111100",
   on_campus: "11111111-1111-1111-a111-111111111101",
   off_campus: "11111111-1111-1111-a111-111111111102",
   postgrad: "11111111-1111-1111-a111-111111111103",
   admin: "11111111-1111-1111-a111-111111111104"
};

var delim = '\t';

for(let i=0; i<names.length-1; i++) {
   let user = JSON.parse(names[i].split('\t')[1]);
   let permissions;

   if(user.patronGroup == patronGroupId.admin) {
      permissions = permissionSets.admin;
   } else if(user.patronGroup == patronGroupId.librarian) {
      permissions = permissionSets.librarian;
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
