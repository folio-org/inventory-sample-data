#!/bin/bash -e

if [[ $# -lt 2 ]]; then
   echo "Usage: $0 <source dir> <output dir>"
   echo "  e.g. $0 source_dir/5kItems datasets/5kItems"
   exit 1;
fi

rm -f /tmp/items.json

SOURCE_DIR=${1}
DEST_DIR=${2}
SCRIPT_HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
COMMON_DIR="$SCRIPT_HOME/datasets/common"

if [[ "$SOURCE_DIR" != "/*" ]]; then
   SOURCE_DIR="`pwd`/${1}"
fi

if [[ "$DEST_DIR" != "/*" ]]; then
   DEST_DIR="`pwd`/${2}"
fi

mkdir -p $DEST_DIR

for i in `ls $SOURCE_DIR/*.mrc`; do 
   printf "processing $i ... ";
   catmandu convert MARC to JSON --fix 'marc_map(245a,title); marc_map(245b,subtitle); marc_map(245c,author); marc_map(245h,medium); marc_map(020a,isbn); marc_map(500,note); retain(title,subtitle,isbn,medium,note);' < $i 2>/tmp/stderr 1>/tmp/items_tmp.json || (echo "WARN: Failed while processing MARC records." && cat /tmp/stderr)
   sed -ie 's/},{/},\n{/g' /tmp/items_tmp.json
   sed -ie 's/\///g' /tmp/items_tmp.json
   sed -ie 's/\\\\//g' /tmp/items_tmp.json

   cat /tmp/items_tmp.json >> /tmp/items.json
   #rm /tmp/items_tmp.json

   echo "done"
done

set -x

pushd $SCRIPT_HOME/js
npm install
if [[ `egrep '.*' /tmp/items.json > /dev/null 2>&1; echo $?` -eq 0 ]]; then
	node instances.js /tmp/items.json > $DEST_DIR/instances.tsv
    node items.js /tmp/items.json $DEST_DIR/instances.tsv > $DEST_DIR/items.tsv
    cat $SCRIPT_HOME/datasets/variety/variety.tsv >> $DEST_DIR/items.tsv
fi    
node names.js $SOURCE_DIR/names > $DEST_DIR/names.tsv
node logins.js $DEST_DIR/names.tsv > $DEST_DIR/logins.tsv
node perms.js $DEST_DIR/names.tsv > $DEST_DIR/perms.tsv
node circulate.js $DEST_DIR/names.tsv $DEST_DIR/items.tsv > $DEST_DIR/circulate.tsv
node requests.js $DEST_DIR/names.tsv $DEST_DIR/circulate.tsv $DEST_DIR/items.tsv > $DEST_DIR/requests.tsv
node notes.js $DEST_DIR/names.tsv > $DEST_DIR/notes.tsv
node notify.js $DEST_DIR/names.tsv $DEST_DIR/items.tsv > $DEST_DIR/notifications.tsv
cp $DEST_DIR/names.tsv $DEST_DIR/names_tmp.tsv
cut -f1,2 $DEST_DIR/names_tmp.tsv > $DEST_DIR/names.tsv
rm $DEST_DIR/names_tmp.tsv
popd

set +x

rm /tmp/items.json

cat << EOF
Manifest:
{
   "users": "${DEST_DIR}/names.tsv",
   "groups": "${COMMON_DIR}/groups.tsv",
   "logins": "${DEST_DIR}/logins.tsv",
   "permissions": "${DEST_DIR}/perms.tsv",
   "materials": "${COMMON_DIR}/materials.tsv",
   "loanTypes": "${COMMON_DIR}/loanTypes.tsv",
   "items": "${DEST_DIR}/items.tsv",
   "circulation": "${DEST_DIR}/circulate.tsv",
   "requests": "${DEST_DIR}/requests.tsv",
   "notes": "${DEST_DIR}/notes.tsv",
   "instances": "${DEST_DIR}/instances.tsv",
   "notifications": "${DEST_DIR}/notifications.tsv"
}
EOF
