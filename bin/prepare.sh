#!/bin/bash

if [[ $# -lt 2 ]]; then
   echo "Usage: $0 <source dir> <output dir>"
   echo "  e.g. $0 source_dir/5kItems datasets/5kItems"
   echo "       $0 source_data/ s3://path/to/destination/filename.tar.gz"
   echo "       $0 source_data/ s3://path/to/destination/folder/"
   echo "       $0 s3://path/to/source/filename.tar.gz datasets/5kItems"
   echo "       $0 s3://path/to/source/filename.tar.gz s3://path/to/destination/filename.tar.gz"
   echo "       $0 s3://path/to/source/filename.tar.gz s3://path/to/destination/directory/"
   echo "       Assuming all MARC and names files are stored in folder 'source_data/'"
   exit 1;
fi

rm -f /tmp/items.json

SOURCE_DIR=${1}
DEST_DIR=${2}
SCRIPT_HOME="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
COMMON_DIR="$SCRIPT_HOME/datasets/common"

# Download and extract source from S3 bucket
if [[ "${SOURCE_DIR}" == s3:* && "${DEST_DIR}" != s3:* ]]; then
   aws s3 cp ${SOURCE_DIR} .
   mkdir -p extracted_tar
   tar xzvf $(basename ${SOURCE_DIR}) --directory extracted_tar/
   CP_SOURCE="./extracted_tar/*"
   CP_DEST="."
   RMRF="extracted_tar/"
   DIR_EXISTS=extracted_tar
   if [ -d ${DIR_EXISTS} ]; then
      cp -r ${CP_SOURCE} ${CP_DEST} && rm -rf ${RMRF}
   fi
elif [[ "${SOURCE_DIR}" == s3:* && "${DEST_DIR}" == s3:* ]]; then
   aws s3 cp ${SOURCE_DIR} /tmp/
   mkdir -p /tmp/extracted_tar
   tar xzvf /tmp/$(basename ${SOURCE_DIR}) --directory /tmp/extracted_tar/
   CP_SOURCE="/tmp/extracted_tar/*"
   CP_DEST="/tmp"
   RMRF="/tmp/extracted_tar/"
   DIR_EXISTS="/tmp/extracted_tar/"
   if [ -d ${DIR_EXISTS} ]; then
      cp -r ${CP_SOURCE} ${CP_DEST} && rm -rf ${RMRF}
   fi
fi

if [[ "${SOURCE_DIR}" == s3:* && "${DEST_DIR}" != s3:* ]]; then
   SOURCE_DIR="`pwd`/source_data"
elif [[ "${SOURCE_DIR}" == s3:* && "${DEST_DIR}" == s3:* ]]; then
   SOURCE_DIR="/tmp/source_data"
elif [[ "$SOURCE_DIR" != "/*" ]]; then
   SOURCE_DIR="`pwd`/${1}"
fi

if [[ "$DEST_DIR" != "/*" && "$DEST_DIR" != s3:* ]]; then
   DEST_DIR="`pwd`/${2}"
elif [[ "$DEST_DIR" == s3:* ]]; then
   mkdir -p /tmp/dataset/
   DEST_DIR=/tmp/dataset/
fi

mkdir -p $DEST_DIR

for i in `ls $SOURCE_DIR/*.mrc`; do 
   printf "processing $i ... ";
   catmandu convert MARC --skip_errors 1 to JSON --line_delimited 1 --skip_errors 1 --fix 'marc_map(245a,title); marc_map(245b,subtitle); marc_map(245c,author); marc_map(245h,medium); marc_map(020a,isbn); marc_map(500,note); marc_map(852khim,callNumber,join:" ",pluck:1); marc_map(852p,barcode); marc_map(907a,sierraId); marc_map(100a,mainEntryPersonalName,split:1); marc_map(600a,subjectAddedEntryPersonalName,split:1); marc_map(700a,addedEntryPersonalName,split:1); marc_map(800a,seriesAddedEntryPersonalName,split:1); retain(title,subtitle,isbn,medium,note,sierraId,callNumber,barcode,mainEntryPersonalName,subjectAddedEntryPersonalName,addedEntryPersonalName,seriesAddedEntryPersonalName);' < $i 2>/tmp/stderr 1>/tmp/items_tmp.json || (echo "WARN: Failed while processing MARC records." && cat /tmp/stderr)
   sed -ie 's/},{/},\n{/g' /tmp/items_tmp.json
   sed -ie 's/\///g' /tmp/items_tmp.json
   sed -ie 's/\\\\//g' /tmp/items_tmp.json

   cat /tmp/items_tmp.json >> /tmp/items.json
   #rm /tmp/items_tmp.json

   echo "done"
done

# remove no title item records
mv /tmp/items.json /tmp/items.json.old
grep '"title"' /tmp/items.json.old > /tmp/items.json

set -x

pushd $SCRIPT_HOME/js
npm install
if [[ `egrep '.*' /tmp/items.json > /dev/null 2>&1; echo $?` -eq 0 ]]; then
	node --max-old-space-size=16384 instances.js /tmp/items.json > $DEST_DIR/instances.tsv
    node --max-old-space-size=16384 recordholding.js $DEST_DIR/instances.tsv $COMMON_DIR/locations.tsv /tmp/items.json > $DEST_DIR/recordholdings.tsv
    node --max-old-space-size=16384 items.js /tmp/items.json $DEST_DIR/instances.tsv $COMMON_DIR/locations.tsv $DEST_DIR/recordholdings.tsv > $DEST_DIR/items.tsv
fi    
node --max-old-space-size=16384 names.js $SOURCE_DIR/names > $DEST_DIR/names.tsv
node --max-old-space-size=16384 logins.js $DEST_DIR/names.tsv > $DEST_DIR/logins.tsv
node --max-old-space-size=16384 perms.js $DEST_DIR/names.tsv > $DEST_DIR/perms.tsv
if [[ `wc -l  < $DEST_DIR/names.tsv` -eq 1 ]]; then
   &> $DEST_DIR/circulate.tsv
   &> $DEST_DIR/requests.tsv
   &> $DEST_DIR/notes.tsv
   &> $DEST_DIR/notifications.tsv
else
   node --max-old-space-size=16384 circulate.js $DEST_DIR/names.tsv $DEST_DIR/items.tsv > $DEST_DIR/circulate.tsv
   node --max-old-space-size=16384 requests.js $DEST_DIR/names.tsv $DEST_DIR/circulate.tsv $DEST_DIR/items.tsv $DEST_DIR/recordholdings.tsv $DEST_DIR/instances.tsv > $DEST_DIR/requests.tsv
   node --max-old-space-size=16384 notes.js $DEST_DIR/names.tsv > $DEST_DIR/notes.tsv
   node --max-old-space-size=16384 notify.js $DEST_DIR/names.tsv $DEST_DIR/items.tsv > $DEST_DIR/notifications.tsv
fi
cp $DEST_DIR/names.tsv $DEST_DIR/names_tmp.tsv
cut -f1,2 $DEST_DIR/names_tmp.tsv > $DEST_DIR/names.tsv
rm $DEST_DIR/names_tmp.tsv
popd

set +x

rm /tmp/items.json

# Compress and upload dataset to S3 bucket
if [[ "${2}" == s3:* ]]; then
   echo ${2} | grep -qE "/$"
   # Destination is directory
   if [[ $? -eq 0 ]]; then
     FILENAME="dataset.tar.gz" 
     S3_PATH=${2}
   # Destination is file
   elif [[ $? -eq 1 ]]; then
     FILENAME=$(basename ${2})
     FORWARDSLASH='/'
     S3_PATH=$(dirname ${2})$FORWARDSLASH
   fi
   # Use /manifests/S3.manifest when running populate.sh
   tar -czvf ${FILENAME} /tmp/dataset
   aws s3 cp ${FILENAME} ${S3_PATH}
   # Delete local tar file after uploading to S3
   if [ -f ${FILENAME} ]; then
      rm -rf ${FILENAME}
   fi
fi

# Clean-up /tmp/
if [[ "${DEST_DIR}" == /tmp/dataset/ && -d ${DEST_DIR} ]]; then
   rm -rf ${DEST_DIR}
fi

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
   "notifications": "${DEST_DIR}/notifications.tsv",
   "locLibraries": "${COMMON_DIR}/locLibraries.tsv",
   "locCampuses": "${COMMON_DIR}/locCampuses.tsv",
   "locInstitutions": "${COMMON_DIR}/locInstitutions.tsv",
   "locations": "${COMMON_DIR}/locations.tsv",
   "recordholdings": "${DEST_DIR}/recordholdings.tsv",
   "identifiertypes": "${COMMON_DIR}/identifierTypes.tsv",
   "instancetypes": "${COMMON_DIR}/instanceTypes.tsv",
   "contributorNametypes": "${COMMON_DIR}/contributorNameTypes.tsv",
   "instanceFormats": "${COMMON_DIR}/instanceFormats.tsv"
}
EOF
