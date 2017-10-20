#!/bin/bash -e

if [[ $# -lt 3 ]]; then
   echo "Usage: $0 <manifest> <db config> <TENANT>";
   echo "  e.g. $0 5kItems.manifest db.json testlib";
   exit 1;
fi

if [[ "${2}" == s3:* ]]; then 
   echo "aws s3 cp ${2} . | cut -d: -f3 | cut -d\  -f3"
   DBCONF=`aws s3 cp ${2} . | cut -d: -f3 | cut -d\  -f3`
else
   DBCONF=${2}
fi

export TENANT=${3}
export PGDATABASE=`cat $DBCONF | jq '.database' | cut -d\" -f2`
export PGUSER=`cat $DBCONF | jq '.username' | cut -d\" -f2`
export PGPASSWORD=`cat $DBCONF | jq '.password' | cut -d\" -f2`
export PGHOST=`cat $DBCONF | jq '.host' | cut -d\" -f2`
export PGPORT=`cat $DBCONF | jq '.port' | cut -d\" -f2`

export USERS=`cat ${1} | jq '.users' | cut -d\" -f2`
export USER_GROUPS=`cat ${1} | jq '.groups' | cut -d\" -f2`
export LOGINS=`cat ${1} | jq '.logins' | cut -d\" -f2`
export PERMS=`cat ${1} | jq '.permissions' | cut -d\" -f2`
export MATERIALS=`cat ${1} | jq '.materials' | cut -d\" -f2`
export LOAN_TYPES=`cat ${1} | jq '.loanTypes' | cut -d\" -f2`
export ITEMS=`cat ${1} | jq '.items' | cut -d\" -f2`
export CIRCULATION=`cat ${1} | jq '.circulation' | cut -d\" -f2`
export REQUESTS=`jq -r '.requests' ${1}`
export NOTES=`jq -r '.notes' ${1}`
export INSTANCES=`jq -r '.instances' ${1}`
export NOTIFICATIONS=`jq -r '.notifications' ${1}`

echo "================================================="
echo "PGUSER: $PGUSER"
echo "PGPASSWORD: $PGPASSWORD"
echo "PGDATABASE: $PGDATABASE"
echo "PGHOST: $PGHOST"
echo "PGPORT: $PGPORT"
echo "TENANT: $TENANT"
echo ""
echo "USERS: $USERS"
echo "USER_GROUPS: $USER_GROUPS"
echo "LOGINS: $LOGINS"
echo "PERMS: $PERMS"
echo "MATERIALS: $MATERIALS"
echo "LOAN_TYPES: $LOAN_TYPES"
echo "ITEMS: $ITEMS"
echo "CIRCULATION: $CIRCULATION"
echo "REQUESTS: $REQUESTS"
echo "NOTES: $NOTES"
echo "INSTANCES: $INSTANCES"
echo "NOTIFICATIONS: $NOTIFICATIONS"
echo "=================================================="

# ==================================================
#  clear and re-populate the database
# ==================================================

RUN_PSQL="psql -X --set AUTOCOMMIT=off --set ON_ERROR_STOP=on "

${RUN_PSQL} <<SQL
DELETE FROM ${TENANT}_mod_circulation_storage.loan WHERE true;
DELETE FROM ${TENANT}_mod_circulation_storage.request WHERE true;
DELETE FROM ${TENANT}_mod_permissions.permissions_users WHERE true;
DELETE FROM ${TENANT}_mod_login.auth_credentials WHERE true;
DELETE FROM ${TENANT}_mod_users.users WHERE true;
DELETE FROM ${TENANT}_mod_users.groups WHERE true;
DELETE FROM ${TENANT}_mod_inventory_storage.item WHERE true;
DELETE FROM ${TENANT}_mod_inventory_storage.material_type WHERE true;
DELETE FROM ${TENANT}_mod_inventory_storage.loan_type WHERE true;
DELETE FROM ${TENANT}_mod_inventory_storage.instance WHERE true;
DELETE FROM ${TENANT}_mod_notes.note_data WHERE true;
DELETE FROM ${TENANT}_mod_notify.notify_data WHERE true;
commit;
SQL

psql -a -c "\copy ${TENANT}_mod_users.groups(id, jsonb) FROM '${USER_GROUPS}' DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_users.users(id, jsonb) FROM '${USERS}' DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_login.auth_credentials(jsonb) FROM ${LOGINS} DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_permissions.permissions_users(_id, jsonb) FROM '${PERMS}' DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_inventory_storage.material_type(_id, jsonb) FROM '${MATERIALS}' DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_inventory_storage.loan_type(_id, jsonb) FROM '${LOAN_TYPES}' DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_inventory_storage.item(_id, jsonb, permanentloantypeid, temporaryloantypeid) FROM '${ITEMS}' DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_inventory_storage.instance(_id, jsonb) FROM '${INSTANCES}' DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_circulation_storage.loan(_id, jsonb) FROM '${CIRCULATION}' DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_circulation_storage.request(_id, jsonb) FROM '${REQUESTS}' DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_notes.note_data(id, jsonb) FROM '${NOTES}' DELIMITER E'\t'"
psql -a -c "\copy ${TENANT}_mod_notify.notify_data(id, jsonb) FROM '${NOTIFICATIONS}' DELIMITER E'\t'"
