# inventory-sample-data

This repo provides 2 scripts; 1 for data preparation and 1 for data deployment.

To prepare the data execute:
```
$ bin/prepare.sh source_data datasets/5kItems
```

This will process any MARC encoded file with a `.mrc` extension in the `source_data` directory, converting it to JSON in the process and outputting the [TSV](https://en.wikipedia.org/wiki/Tab-separated_values) files in the `datasets/5kItems` directory.

The `source_data` directory also containes a `names` file that is used to populate the users and logins tables. It is worth noting that a user entry in the `names` file can contain login credentials. There is currently one such entry in the `names` file for `admin` with the password `admin`. Any user with login credentials will be placed in the Folio admin group. Only users with login credentials will be able to authenticate. Required users with their password hashes and salts should be added to this file before executing `prepare.sh`.

The TSV files are formatted for use by the deployment script, which can be run as follows:
```
$ bin/populate.sql 5kItems.manifest db.conf testlib
```

A sample manifest file is outputted when the `prepare.sh` script completes. The format is:
```javascript
{
   "users": "datasets/5kItems/names.tsv",
   "groups": "datasets/common/groups.tsv",
   "logins": "datasets/5kItems/logins.tsv",
   "permissions": "datasets/5kItems/perms.tsv",
   "materials": "datasets/common/materials.tsv",
   "loanTypes": "datasets/common/loanTypes.tsv",
   "items": "datasets/5kItems/items.tsv",
   "circulation": "datasets/5kItems/circulate.tsv",
   "requests": "datasets/5kItems/requests.tsv",
   "notes": "datasets/5kItems/notes.tsv",
   "instances": "datasets/5kItems/instances.tsv",
   "notifications": "datasets/5kItems/notifications.tsv"
}
```

The `db.conf` file contains connection details for the PostgreSQL server. The format is:
```javascript
{
    "database":"okapi_modules",
    "username":"folio_admin",
    "password":"folio_admin",
    "host":"localhost",
    "port":"5432"
}
```

The final argument is the tenant name.

## Requirements

The scripts require the following external tools:
* [catmandu](http://librecat.org/)
    * It is best to use the latest version (1.0606). The reason that only 5k items are processed is due to bad MARC tags in the sample data, which stops processing the file immediately. The latest version of catmandu has a `skip_errors` flag will continue to process the file, which will produce 50k items.
* [node.js](https://nodejs.org)
* [jq](https://stedolan.github.io/jq/)

