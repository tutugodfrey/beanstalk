#!/bin/bash

echo "-------------------------------------"
echo " Starting Elastic Beanstalk Rollback"
echo "-------------------------------------"

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

echo "eb_rollback: Remove generated Procfile"
cd /opt/ts_gallery/
if [ -f Procfile ]
then
	rm Procfile
fi

echo "eb_rollback: Remove .ebextensions folder and config files"
if [ -d .ebextensions ]
then
	rm -rf .ebextensions
fi

echo "eb_rollback: Remove generated zipfile"
cd /opt
if [ -f ts_gallery.zip ]
then
	rm ts_gallery.zip
fi

echo "s3_rollback: Checking if bucket ${bucketname} needs rollback"
S3_CHECK=$(aws s3api head-object --bucket ${bucketname} --key ts_gallery.zip 2>&1)
if [ $? = 0 ]
then
	echo "s3_rollback: Deleting zip from bucket"
	aws s3 rm --quiet s3://$bucketname/ts_gallery.zip
else
	echo "s3_rollback: No bucket rollback needed"
fi

echo "rds_rollback: Removing lock files"
cd /opt/ts_gallery
[ -f eb_migrate_started.lock ] && rm eb_migrate_started.lock
[ -f eb_migrate_done.lock ] && rm eb_migrate_done.lock

echo "----------------------------------"
echo " Elastic Beanstalk Setup Finished"
echo "----------------------------------"
