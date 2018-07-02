#!/bin/bash -e

if [[ $# -lt 3 ]]; then
   echo "Usage: $0 <manifest> <db config> <TENANT> [--clear-loan-audit]";
   echo "  e.g. $0 manifests/5kItems.manifest s3://fse-folio-eis-us-east-1-dev/db/postgres-conf.json fs00000000";
   echo "       $0 manifests/S3.manifest psql.conf diku";

   exit 1;
fi

if [[ "${2}" == s3:* ]]; then 
   echo "aws s3 cp ${2} . | cut -d: -f3 | cut -d\  -f3"
   DBCONF=`aws s3 cp ${2} . | cut -d: -f3 | cut -d\  -f3`
else
   DBCONF=${2}
fi

export TENANT=${3}

if [[ "${4}" == "--clear-loan-audit" ]]; then
   DO_CLEAR_LOAN_AUDIT=true;
elif [[ -n ${4} ]]; then
   echo "Unknown argument: ${4}";
   exit 2;
else
   DO_CLEAR_LOAN_AUDIT=false;
fi

export PGDATABASE=`cat $DBCONF | jq '.database' | cut -d\" -f2`
export PGUSER=`cat $DBCONF | jq '.username' | cut -d\" -f2`
export PGPASSWORD=`cat $DBCONF | jq '.password' | cut -d\" -f2`
export PGHOST=`cat $DBCONF | jq '.host' | cut -d\" -f2`
export PGPORT=`cat $DBCONF | jq '.port' | cut -d\" -f2`

export USERS=`cat ${1} | jq '.users' | cut -d\" -f2`
export USER_GROUPS=`cat ${1} | jq '.groups' | cut -d\" -f2`
export USER_ADDRESSTYPES=`cat ${1} | jq '.addressTypes' | cut -d\" -f2`
export LOGINS=`cat ${1} | jq '.logins' | cut -d\" -f2`
export PERMS=`cat ${1} | jq '.permissions' | cut -d\" -f2`
export MATERIALS=`cat ${1} | jq '.materials' | cut -d\" -f2`
export LOAN_TYPES=`cat ${1} | jq '.loanTypes' | cut -d\" -f2`
export LOAN_POLICY=`cat ${1} | jq '.loanPolicy' | cut -d\" -f2`
export LOAN_RULES=`cat ${1} | jq '.loanRules' | cut -d\" -f2`
export ITEMS=`cat ${1} | jq '.items' | cut -d\" -f2`
export CIRCULATION=`cat ${1} | jq '.circulation' | cut -d\" -f2`
export REQUESTS=`jq -r '.requests' ${1}`
export NOTES=`jq -r '.notes' ${1}`
export INSTANCES=`jq -r '.instances' ${1}`
export NOTIFICATIONS=`jq -r '.notifications' ${1}`
export LOC_LIBRARIES=`jq -r '.locLibraries' ${1}`
export LOC_CAMPUSES=`jq -r '.locCampuses' ${1}`
export LOC_INSTITUTIONS=`jq -r '.locInstitutions' ${1}`
export LOCATIONS=`jq -r '.locations' ${1}`
export IDENTIFIER_TYPES=`jq -r '.identifiertypes' ${1}`
export CLASSIFICATION_TYPES=`jq -r '.classificationTypes' ${1}`
export RECORD_HOLDINGS=`jq -r '.recordholdings' ${1}`
export INSTANCE_TYPES=`jq -r '.instancetypes' ${1}`
export CONTRIBUTOR_NAME_TYPES=`jq -r '.contributorNameTypes' ${1}`
export INSTANCE_FORMATS=`jq -r '.instanceFormats' ${1}`
export S3DATASET=`jq -r '.s3dataset' ${1}`

if [[ "${S3DATASET}" == s3:* ]]; then
   echo "aws s3 cp ${S3DATASET} . | cut -d: -f3 | cut -d/ -f5 | cut -d ' ' -f1"
   DATASET=`aws s3 cp ${S3DATASET} . | cut -d: -f3 | cut -d/ -f5 | cut -d ' ' -f1`
   tar xfv ${DATASET}
   DATASET=`echo ${S3DATASET} | cut -d/ -f4`
   FILENAME=`echo ${S3DATASET} | cut -d/ -f5`
   # Delete local tar file after extracting 
   if [ -f ${FILENAME} ]; then
      rm -rf ${FILENAME}
   fi
fi

# Update the names file institutional user. This user is the tenant name.
# We alse make a backup of the names.tsv file so it can be restored later
# and reused for other tenants.
if [[ -e "${USERS}" ]]; then
    sed -i.orig "s/{TENANT}/${TENANT}/g" ${USERS}
fi

# Update loan and due dates
if [[ -e "${CIRCULATION}" ]]; then
   export CIRCULATION_TEMPLATE=${CIRCULATION}
   export CIRCULATION=/tmp/circulation.tsv
   cp ${CIRCULATION_TEMPLATE} ${CIRCULATION}

   loanDate=`date +%Y-%m-%dT%H:%M:%SZ -d "-15 days"`
   dueDate=`date +%Y-%m-%dT%H:%M:%S.000+0000 -d "+15 days"`

   sed -i -e "s/{LOAN_DATE}/${loanDate}/g" ${CIRCULATION}
   sed -i -e "s/{DUE_DATE}/${dueDate}/g" ${CIRCULATION}
fi

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
echo "LOAN_POLICY: $LOAN_POLICY"
echo "LOAN_RULES: $LOAN_RULES"
echo "ITEMS: $ITEMS"
echo "CIRCULATION: $CIRCULATION_TEMPLATE"
echo "REQUESTS: $REQUESTS"
echo "NOTES: $NOTES"
echo "INSTANCES: $INSTANCES"
echo "NOTIFICATIONS: $NOTIFICATIONS"
echo "LOC_LIBRARIES: $LOC_LIBRARIES"
echo "LOC_CAMPUSES: $LOC_CAMPUSES"
echo "LOC_INSTITUTIONS: $LOC_INSTITUTIONS"
echo "LOCATIONS: $LOCATIONS"
echo "IDENTIFIER_TYPES: $IDENTIFIER_TYPES"
echo "CLASSIFICATION_TYPES: $CLASSIFICATION_TYPES"
echo "RECORD_HOLDINGS: $RECORD_HOLDINGS"
echo "INSTANCE_TYPES: $INSTANCE_TYPES"
echo "CONTRIBUTOR_NAME_TYPES: $CONTRIBUTOR_NAME_TYPES"
echo "INSTANCE_FORMATS: $INSTANCE_FORMATS"
echo "S3DATASET: $S3DATASET"
echo "=================================================="

# ==================================================
#  clear and re-populate the database
# ==================================================

RUN_PSQL="psql -X --set AUTOCOMMIT=off --set ON_ERROR_STOP=on "

#if file exists
[ -e /tmp/delete.sql ] && rm /tmp/delete.sql

test "null" != "${ITEMS}" && echo "ALTER TABLE ${TENANT}_mod_inventory_storage.item DROP CONSTRAINT IF EXISTS item_pkey;" >> /tmp/delete.sql
test "null" != "${ITEMS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.item_materialtypeid_idx_gin;" >> /tmp/delete.sql
test "null" != "${ITEMS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.item_status_name_idx_gin;" >> /tmp/delete.sql
test "null" != "${ITEMS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.item_barcode_idx_gin;" >> /tmp/delete.sql
test "null" != "${ITEMS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.item_title_idx_gin;" >> /tmp/delete.sql
test "null" != "${ITEMS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.item_id_idx;" >> /tmp/delete.sql
test "null" != "${ITEMS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.item_status_name_idx;" >> /tmp/delete.sql
test "null" != "${ITEMS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.item_barcode_idx;" >> /tmp/delete.sql
test "null" != "${ITEMS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.item_materialtypeid_idx;" >> /tmp/delete.sql
test "null" != "${ITEMS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.item_holdingsrecordid_idx;" >> /tmp/delete.sql

test "null" != "${INSTANCES}" && echo "ALTER TABLE ${TENANT}_mod_inventory_storage.instance DROP CONSTRAINT IF EXISTS instance_pkey;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_title_idx_gin;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_id_idx;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_title_idx;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_subjects_idx_gin;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_classifications_idx_gin;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_languages_idx_gin;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_instancetypeid_idx_gin;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_identifiers_idx_gin;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_contributors_idx_gin;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_publication_idx;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.instance_contributors_idx;" >> /tmp/delete.sql

test "null" != "${RECORD_HOLDINGS}" && echo "ALTER TABLE ${TENANT}_mod_inventory_storage.holdings_record DROP CONSTRAINT IF EXISTS holdings_record_pkey;" >> /tmp/delete.sql
test "null" != "${RECORD_HOLDINGS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.holdings_record_permanentlocationid_idx_gin;" >> /tmp/delete.sql
test "null" != "${RECORD_HOLDINGS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.holdings_record_instanceid_idx_gin;" >> /tmp/delete.sql
test "null" != "${RECORD_HOLDINGS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.holdings_record_permanentlocationid_idx;" >> /tmp/delete.sql
test "null" != "${RECORD_HOLDINGS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.holdings_record_instanceid_idx;" >> /tmp/delete.sql
test "null" != "${RECORD_HOLDINGS}" && echo "DROP INDEX IF EXISTS ${TENANT}_mod_inventory_storage.holdings_record_id_idx;" >> /tmp/delete.sql

test "null" != "${CIRCULATION}" && echo "DELETE FROM ${TENANT}_mod_circulation_storage.loan WHERE true;" >> /tmp/delete.sql
test "null" != "${CIRCULATION}" && test "${DO_CLEAR_LOAN_AUDIT}" = true && echo "DELETE FROM ${TENANT}_mod_circulation_storage.audit_loan WHERE true;" >> /tmp/delete.sql

test "null" != "${REQUESTS}" && echo "DELETE FROM ${TENANT}_mod_circulation_storage.request WHERE true;" >> /tmp/delete.sql
test "null" != "${PERMS}" && echo "DELETE FROM ${TENANT}_mod_permissions.permissions_users WHERE true;" >> /tmp/delete.sql
test "null" != "${LOGINS}" && echo "DELETE FROM ${TENANT}_mod_login.auth_credentials WHERE true;" >> /tmp/delete.sql 
test "null" != "${USER_ADDRESSTYPES}" && echo "DELETE FROM ${TENANT}_mod_users.addresstype WHERE true;" >> /tmp/delete.sql
test "null" != "${USERS}" && echo "DELETE FROM ${TENANT}_mod_users.users WHERE true;" >> /tmp/delete.sql
test "null" != "${USER_GROUPS}" && echo "DELETE FROM ${TENANT}_mod_users.groups WHERE true;" >> /tmp/delete.sql
test "null" != "${ITEMS}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.item WHERE true;" >> /tmp/delete.sql
test "null" != "${MATERIALS}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.material_type WHERE true;" >> /tmp/delete.sql
test "null" != "${LOAN_TYPES}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.loan_type WHERE true;" >> /tmp/delete.sql
test "null" != "${LOAN_POLICY}" && echo "DELETE FROM ${TENANT}_mod_circulation_storage.loan_policy WHERE true;" >> /tmp/delete.sql
test "null" != "${LOAN_RULES}" && echo "DELETE FROM ${TENANT}_mod_circulation_storage.loan_rules WHERE true;" >> /tmp/delete.sql
test "null" != "${INSTANCES}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.instance WHERE true;" >> /tmp/delete.sql
test "null" != "${RECORD_HOLDINGS}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.holdings_record WHERE true;" >> /tmp/delete.sql
test "null" != "${LOCATIONS}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.location WHERE true;" >> /tmp/delete.sql
test "null" != "${LOC_LIBRARIES}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.loclibrary WHERE true;" >> /tmp/delete.sql
test "null" != "${LOC_CAMPUSES}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.loccampus WHERE true;" >> /tmp/delete.sql
test "null" != "${LOC_INSTITUTIONS}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.locinstitution WHERE true;" >> /tmp/delete.sql
test "null" != "${IDENTIFIER_TYPES}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.identifier_type WHERE true;" >> /tmp/delete.sql
test "null" != "${CLASSIFICATION_TYPES}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.classification_type WHERE true;" >> /tmp/delete.sql
test "null" != "${INSTANCE_TYPES}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.instance_type WHERE true;" >> /tmp/delete.sql
test "null" != "${NOTES}" && echo "DELETE FROM ${TENANT}_mod_notes.note_data WHERE true;" >> /tmp/delete.sql
test "null" != "${NOTIFICATIONS}" && echo "DELETE FROM ${TENANT}_mod_notify.notify_data WHERE true;" >> /tmp/delete.sql
test "null" != "${CONTRIBUTOR_NAME_TYPES}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.contributor_name_type WHERE true;" >> /tmp/delete.sql
test "null" != "${INSTANCE_FORMATS}" && echo "DELETE FROM ${TENANT}_mod_inventory_storage.instance_format WHERE true;" >> /tmp/delete.sql
echo "commit;" >> /tmp/delete.sql

cat /tmp/delete.sql
${RUN_PSQL} < /tmp/delete.sql

test "null" != "${USER_GROUPS}" && psql -a -c "\copy ${TENANT}_mod_users.groups(id, jsonb) FROM '${USER_GROUPS}' DELIMITER E'\t'"
test "null" != "${USER_ADDRESSTYPES}" && psql -a -c "\copy ${TENANT}_mod_users.addresstype(id, jsonb) FROM '${USER_ADDRESSTYPES}' DELIMITER E'\t'"
test "null" != "${USERS}" && psql -a -c "\copy ${TENANT}_mod_users.users(id, jsonb) FROM '${USERS}' DELIMITER E'\t'"
test "null" != "${LOGINS}" && psql -a -c "\copy ${TENANT}_mod_login.auth_credentials(_id, jsonb) FROM ${LOGINS} DELIMITER E'\t'"
test "null" != "${PERMS}" && psql -a -c "\copy ${TENANT}_mod_permissions.permissions_users(_id, jsonb) FROM '${PERMS}' DELIMITER E'\t'"
test "null" != "${LOC_INSTITUTIONS}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.locinstitution(_id, jsonb) FROM '${LOC_INSTITUTIONS}' DELIMITER E'\t'"
test "null" != "${LOC_CAMPUSES}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.loccampus(_id, jsonb) FROM '${LOC_CAMPUSES}' DELIMITER E'\t'"
test "null" != "${LOC_LIBRARIES}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.loclibrary(_id, jsonb) FROM '${LOC_LIBRARIES}' DELIMITER E'\t'"
test "null" != "${LOCATIONS}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.location(_id, jsonb) FROM '${LOCATIONS}' DELIMITER E'\t'"
test "null" != "${CONTRIBUTOR_NAME_TYPES}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.contributor_name_type(_id, jsonb) FROM '${CONTRIBUTOR_NAME_TYPES}' DELIMITER E'\t'"
test "null" != "${INSTANCE_FORMATS}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.instance_format(_id, jsonb) FROM '${INSTANCE_FORMATS}' DELIMITER E'\t'"
test "null" != "${INSTANCE_TYPES}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.instance_type(_id, jsonb) FROM '${INSTANCE_TYPES}' DELIMITER E'\t'"
test "null" != "${IDENTIFIER_TYPES}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.identifier_type(_id, jsonb) FROM '${IDENTIFIER_TYPES}' DELIMITER E'\t'"
test "null" != "${CLASSIFICATION_TYPES}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.classification_type(_id, jsonb) FROM '${CLASSIFICATION_TYPES}' DELIMITER E'\t'"
test "null" != "${MATERIALS}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.material_type(_id, jsonb) FROM '${MATERIALS}' DELIMITER E'\t'"
test "null" != "${LOAN_TYPES}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.loan_type(_id, jsonb) FROM '${LOAN_TYPES}' DELIMITER E'\t'"
test "null" != "${LOAN_POLICY}" && psql -a -c "\copy ${TENANT}_mod_circulation_storage.loan_policy(_id, jsonb) FROM '${LOAN_POLICY}' DELIMITER E'\t'"
test "null" != "${LOAN_RULES}" && psql -a -c "\copy ${TENANT}_mod_circulation_storage.loan_rules(_id, jsonb) FROM '${LOAN_RULES}' DELIMITER E'\t'"
test "null" != "${INSTANCES}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.instance(_id, jsonb) FROM '${INSTANCES}' csv quote e'\x01' DELIMITER E'\t'"
test "null" != "${RECORD_HOLDINGS}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.holdings_record(_id, jsonb, permanentLocationId) FROM '${RECORD_HOLDINGS}' DELIMITER E'\t'"
test "null" != "${ITEMS}" && psql -a -c "\copy ${TENANT}_mod_inventory_storage.item(_id, jsonb, permanentloantypeid, temporaryloantypeid, materialTypeId) FROM '${ITEMS}' DELIMITER E'\t'"
test "null" != "${CIRCULATION}" && psql -a -c "\copy ${TENANT}_mod_circulation_storage.loan(_id, jsonb) FROM '${CIRCULATION}' DELIMITER E'\t'"
test "null" != "${REQUESTS}" && psql -a -c "\copy ${TENANT}_mod_circulation_storage.request(_id, jsonb) FROM '${REQUESTS}' DELIMITER E'\t'"
test "null" != "${NOTES}" && psql -a -c "\copy ${TENANT}_mod_notes.note_data(id, jsonb) FROM '${NOTES}' DELIMITER E'\t'"
test "null" != "${NOTIFICATIONS}" && psql -a -c "\copy ${TENANT}_mod_notify.notify_data(id, jsonb) FROM '${NOTIFICATIONS}' DELIMITER E'\t'"

#if file exists
[ -e /tmp/create_index.sql ] && rm /tmp/create_index.sql

test "null" != "${ITEMS}" && echo "CREATE INDEX item_materialtypeid_idx_gin ON ${TENANT}_mod_inventory_storage.item USING gin (lower(f_unaccent((jsonb ->> 'materialTypeId'::text))) gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${ITEMS}" && echo "CREATE INDEX item_status_name_idx_gin ON ${TENANT}_mod_inventory_storage.item USING gin (lower(f_unaccent(((jsonb -> 'status'::text) ->> 'name'::text))) gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${ITEMS}" && echo "CREATE INDEX item_barcode_idx_gin ON ${TENANT}_mod_inventory_storage.item USING gin (lower(f_unaccent((jsonb ->> 'barcode'::text))) gin_trgm_ops);">> /tmp/create_index.sql
test "null" != "${ITEMS}" && echo "CREATE INDEX item_title_idx_gin ON ${TENANT}_mod_inventory_storage.item USING gin (lower(f_unaccent((jsonb ->> 'title'::text))) gin_trgm_ops);" >>/tmp/create_index.sql
test "null" != "${ITEMS}" && echo "CREATE INDEX item_id_idx ON ${TENANT}_mod_inventory_storage.item USING btree (((jsonb ->> 'id'::text)));" >> /tmp/create_index.sql
test "null" != "${ITEMS}" && echo "CREATE INDEX item_status_name_idx ON ${TENANT}_mod_inventory_storage.item USING btree (lower(f_unaccent(((jsonb -> 'status'::text) ->> 'name'::text))));" >> /tmp/create_index.sql
test "null" != "${ITEMS}" && echo "CREATE INDEX item_barcode_idx ON ${TENANT}_mod_inventory_storage.item USING btree (lower(f_unaccent((jsonb ->> 'barcode'::text))));" >> /tmp/create_index.sql
test "null" != "${ITEMS}" && echo "CREATE INDEX item_materialtypeid_idx ON ${TENANT}_mod_inventory_storage.item USING btree (lower(f_unaccent((jsonb ->> 'materialTypeId'::text))));" >> /tmp/create_index.sql
test "null" != "${ITEMS}" && echo "CREATE UNIQUE INDEX item_pkey ON ${TENANT}_mod_inventory_storage.item USING btree (_id);" >> /tmp/create_index.sql
test "null" != "${ITEMS}" && echo "ALTER TABLE ${TENANT}_mod_inventory_storage.item ADD PRIMARY KEY USING INDEX item_pkey;" >> /tmp/create_index.sql
test "null" != "${ITEMS}" && echo "CREATE INDEX item_holdingsrecordid_idx ON ${TENANT}_mod_inventory_storage.item USING btree (lower(f_unaccent((jsonb ->> 'holdingsRecordId'::text))));" >> /tmp/create_index.sql

test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_title_idx_gin ON ${TENANT}_mod_inventory_storage.instance USING gin (lower(f_unaccent((jsonb ->> 'title'::text))) gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_id_idx ON ${TENANT}_mod_inventory_storage.instance USING btree (lower(f_unaccent((jsonb ->> 'id'::text))));" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_title_idx ON ${TENANT}_mod_inventory_storage.instance USING btree (lower(f_unaccent((jsonb ->> 'title'::text))));" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE UNIQUE INDEX instance_pkey ON ${TENANT}_mod_inventory_storage.instance USING btree (_id);" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "ALTER TABLE ${TENANT}_mod_inventory_storage.instance ADD PRIMARY KEY USING INDEX instance_pkey;" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_subjects_idx_gin ON ${TENANT}_mod_inventory_storage.instance USING gin (lower(f_unaccent((jsonb ->> 'subjects'::text))) gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_classifications_idx_gin ON ${TENANT}_mod_inventory_storage.instance USING gin (lower(f_unaccent((jsonb ->> 'classifications'::text))) gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_languages_idx_gin ON ${TENANT}_mod_inventory_storage.instance USING gin (lower(f_unaccent((jsonb ->> 'languages'::text)))gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_instancetypeid_idx_gin ON ${TENANT}_mod_inventory_storage.instance USING gin (lower(f_unaccent((jsonb ->> 'instanceTypeId'::text))) gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_identifiers_idx_gin ON ${TENANT}_mod_inventory_storage.instance USING gin (lower(f_unaccent((jsonb ->> 'identifiers'::text))) gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_contributors_idx_gin ON ${TENANT}_mod_inventory_storage.instance USING gin (lower(f_unaccent((jsonb ->> 'contributors'::text))) gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_publication_idx ON ${TENANT}_mod_inventory_storage.instance USING btree (lower(f_unaccent((jsonb ->> 'publication'::text))));" >> /tmp/create_index.sql
test "null" != "${INSTANCES}" && echo "CREATE INDEX instance_contributors_idx ON ${TENANT}_mod_inventory_storage.instance USING btree (lower(f_unaccent((jsonb ->> 'contributors'::text))));" >> /tmp/create_index.sql

test "null" != "${RECORD_HOLDINGS}" && echo "CREATE INDEX holdings_record_permanentlocationid_idx_gin ON ${TENANT}_mod_inventory_storage.holdings_record USING gin (lower(f_unaccent((jsonb ->> 'permanentLocationId'::text))) gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${RECORD_HOLDINGS}" && echo "CREATE INDEX holdings_record_instanceid_idx_gin ON ${TENANT}_mod_inventory_storage.holdings_record USING gin (lower(f_unaccent((jsonb ->>'instanceId'::text))) gin_trgm_ops);" >> /tmp/create_index.sql
test "null" != "${RECORD_HOLDINGS}" && echo "CREATE INDEX holdings_record_permanentlocationid_idx ON ${TENANT}_mod_inventory_storage.holdings_record USING btree (lower(f_unaccent((jsonb ->> 'permanentLocationId'::text))));" >> /tmp/create_index.sql
test "null" != "${RECORD_HOLDINGS}" && echo "CREATE INDEX holdings_record_instanceid_idx ON ${TENANT}_mod_inventory_storage.holdings_record USING btree (lower(f_unaccent((jsonb ->> 'instanceId'::text))));" >> /tmp/create_index.sql
test "null" != "${RECORD_HOLDINGS}" && echo "CREATE UNIQUE INDEX holdings_record_pkey ON ${TENANT}_mod_inventory_storage.holdings_record USING btree (_id);" >> /tmp/create_index.sql
test "null" != "${RECORD_HOLDINGS}" && echo "ALTER TABLE ${TENANT}_mod_inventory_storage.holdings_record ADD PRIMARY KEY USING INDEX holdings_record_pkey;" >> /tmp/create_index.sql
test "null" != "${RECORD_HOLDINGS}" && echo "CREATE INDEX holdings_record_id_idx ON ${TENANT}_mod_inventory_storage.holdings_record USING btree (lower(f_unaccent((jsonb ->> 'id'::text))));" >> /tmp/create_index.sql

if [ -e /tmp/create_index.sql ]; then
    echo "commit;" >> /tmp/create_index.sql
    cat /tmp/create_index.sql
    ${RUN_PSQL} < /tmp/create_index.sql
fi

# optimize postgres queries
test "null" != "${ITEMS}" && psql -a -c "vacuum verbose analyze ${TENANT}_mod_inventory_storage.item;"
test "null" != "${INSTANCES}" && psql -a -c "vacuum verbose analyze ${TENANT}_mod_inventory_storage.instance;"
test "null" != "${RECORD_HOLDINGS}" && psql -a -c "vacuum verbose analyze ${TENANT}_mod_inventory_storage.holdings_record;"

# Restore the original version (with the tenant placeholder)
[ -e ${USERS}.orig ] && mv ${USERS}.orig ${USERS}

exit 0;
