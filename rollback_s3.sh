#!/bin/bash

echo "---------------------------"
echo " Starting S3 Rollback"
echo "---------------------------"

# Check if images have been moved
echo "s3_rollback: Checking if images need rollback"
if [ -d /opt/ts_gallery/public/images/uploads/backup ]
then

	if [ -f /opt/ts_gallery/public/images/uploads/backup/1.png ]
	then
		echo "s3_rollback: Restoring images"
		cd /opt/ts_gallery/public/images/uploads/backup
		mv *.* /opt/ts_gallery/public/images/uploads
	fi

	echo "s3_rollback: Removing backup folder"
	cd /opt/ts_gallery/public/images/uploads/
	rm -rf backup
else
	echo "s3_rollback: No image rollback needed"
fi


bucketname=$1
if [ -z "$bucketname" ]
then
  bucketname=$(echo 'var config = require("./utils/config"); console.log(config.aws.s3Bucket);' | node 2>/dev/null)

  if [ "$bucketname" = "undefined" ] || [ -z "$bucketname" ]
  then
    echo -n "Enter your bucket name and press <ENTER>: "
  	read bucketname
  fi
fi

echo "s3_rollback: Checking if bucket ${bucketname} needs rollback"
S3_CHECK=$(aws s3api head-object --bucket ${bucketname} --key images/uploads/3.png 2>&1)
if [ $? = 0 ]
then
	echo "s3_rollback: Deleting images from bucket"
	aws s3 rm --quiet s3://$bucketname/images/uploads --recursive
else
	echo "s3_rollback: No bucket rollback needed"
fi


cd /opt/ts_gallery
echo "s3_rollback: Rolling back npm updates"
npm uninstall aws-sdk --save  --silent --no-progress &> /dev/null
npm update  --silent --no-progress &> /dev/null

echo "s3_rollback: Rollback changes to config file"
cd /opt/ts_gallery/utils
if [ -f config.s3.bak.js ]
then
	rm config.js
	mv config.s3.bak.js config.js
fi

echo "s3_rollback: Rollback changes to www file"
cd /opt/ts_gallery/bin
if [ -f www.s3.bak.js ]
then
	rm www.js
	mv www.s3.bak.js www.js
fi

echo "s3_rollback: Restarting server"
cd /opt/ts_gallery/
forever stopall --silent &> /dev/null
forever start  --silent ./bin/www.js &> /dev/null

echo "s3_rollback: Server update done"

echo "s3_rollback: Removing lock files"
cd /opt/ts_gallery
[ -f s3_migrate_started.lock ] && rm s3_migrate_started.lock
[ -f s3_migrate_done.lock ] && rm s3_migrate_done.lock

echo "s3_rollback: Rollback done"
