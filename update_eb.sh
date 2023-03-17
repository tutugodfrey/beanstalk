#!/bin/bash
stageid=7CF35C72-FBD2-4CEA-9C3B-42B915CA62EC

echo "----------------------------------"
echo " Starting Elastic Beanstalk Setup"
echo "----------------------------------"

if [ -f eb_migrate_started.lock ]
then
    echo "eb_migrate: This script did not complete successfully during it's last run,"
    echo "eb_migrate: please run \"sh rollback_eb.sh\""
    exit 1
fi

if [ -f eb_migrate_done.lock ]
then
    echo "eb_migrate: This script can only be run once."
    echo "eb_migrate: If there are any issues, please run \"sh rollback_eb.sh\""
    exit 1
fi

if [ ! -f rds_migrate_done.lock ]
then
    echo "rds_migrate: This script requires that the RDS lab be completed before running this script."
    echo "rds_migrate: Please work through the RDS lab."
    exit 1
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

echo "eb_migrate: ==== Validating access to $bucketname ===="

S3_CHECK=$(aws s3api head-bucket --bucket ${bucketname} 2>&1)

if [ $? != 0 ]
then
  NO_BUCKET_CHECK=$(echo $S3_CHECK | grep -c '404')
  if [ $NO_BUCKET_CHECK = 1 ]
  then
    echo "eb_migrate: Bucket s3://${bucketname} does not exist, nothing I can do"
    exit 1
  else
  	NO_BUCKET_CHECK=$(echo $S3_CHECK | grep -c '403')
  	if [ $NO_BUCKET_CHECK = 1 ]
  	then
    	echo "eb_migrate: You do not have permission to access the bucket s3://${bucketname}, nothing I can do"
    	exit 1
    else
    	echo "eb_migrate: An error occured validating access to s3://${bucketname}, nothing I can do"
    	exit 1
  	fi
  fi
fi
echo "eb_migrate: Bucket s3://${bucketname} found and permissions appears ok"

# Create lock file
cd /opt/ts_gallery
echo "1" > eb_migrate_started.lock
if [ -f /opt/ts_gallery/eb_migrate_started.lock ]
then
	echo "eb_migrate: Lock file created"
else
  echo "eb_migrate: Unable to create lock file"
  exit 1
fi

echo "eb_migrate: Create Procfile to control NodeJS startup"
cd /opt/ts_gallery/
echo 'web: npm start' > Procfile
if [ ! -f Procfile ]
then
  echo "eb_migrate: Unable to create Procfile."
#Rollback at this point just deletes the lock files
  echo "eb_migrate: ***** STARTING ROLLBACK *****"
  cd /opt/ts_gallery
  sh rollback_eb.sh $bucketname
  echo "eb_migrate: ***** ROLLBACK DONE *****"
  exit 1
fi

echo "eb_migrate: Create .ebextensions folder"
cd /opt/ts_gallery/
mkdir .ebextensions

if [ ! -d .ebextensions ]
then
  echo "eb_migrate: Unable to create .ebextensions folder."
#Rollback at this point just deletes the lock files
  echo "eb_migrate: ***** STARTING ROLLBACK *****"
  cd /opt/ts_gallery
  sh rollback_eb.sh $bucketname
  echo "eb_migrate: ***** ROLLBACK DONE *****"
  exit 1
fi


cd .ebextensions/
echo "eb_migrate: Create disable-npm.config to prevent 'npm rebuild'"
echo '# This file prevents Elastic Beanstalk from trying to run npm install or' > disable-npm.config
echo '# npm rebuild on its EC2 instances. See the README for why.' >> disable-npm.config
echo '' >> disable-npm.config
echo 'files:' >> disable-npm.config
echo '  "/opt/elasticbeanstalk/hooks/appdeploy/pre/50npm.sh":' >> disable-npm.config
echo '    mode: "000755"' >> disable-npm.config
echo '    owner: root' >> disable-npm.config
echo '    group: users' >> disable-npm.config
echo '    content: |' >> disable-npm.config
echo '      #!/usr/bin/env bash' >> disable-npm.config
echo '      #' >> disable-npm.config
echo '      # Prevent installing or rebuilding like Elastic Beanstalk tries to do by' >> disable-npm.config
echo '      # default.' >> disable-npm.config
echo '' >> disable-npm.config
echo '  "/opt/elasticbeanstalk/hooks/configdeploy/pre/50npm.sh":' >> disable-npm.config
echo '    mode: "000755"' >> disable-npm.config
echo '    owner: root' >> disable-npm.config
echo '    group: users' >> disable-npm.config
echo '    content: |' >> disable-npm.config
echo '      #!/usr/bin/env bash' >> disable-npm.config
echo '      #' >> disable-npm.config
echo '      # Prevent installing or rebuilding like Elastic Beanstalk tries to do by' >> disable-npm.config
echo '      # default.' >> disable-npm.config

if [ ! -f disable-npm.config ]
then
  echo "eb_migrate: Unable to create disable-npm.config."
#Rollback at this point just deletes the lock files
  echo "eb_migrate: ***** STARTING ROLLBACK *****"
  cd /opt/ts_gallery
  sh rollback_eb.sh $bucketname
  echo "eb_migrate: ***** ROLLBACK DONE *****"
  exit 1
fi

echo "eb_migrate: Zip server files for deployment"
cd /opt/ts_gallery/
zip -rqdgds 1m /opt/ts_gallery.zip . 2>/dev/null
if [ $? != 0 ]
then
  echo "eb_migrate: Unable to zip project."
#Rollback at this point just deletes the lock files
  echo "eb_migrate: ***** STARTING ROLLBACK *****"
  cd /opt/ts_gallery
  sh rollback_eb.sh $bucketname
  echo "eb_migrate: ***** ROLLBACK DONE *****"
  exit 1
fi

echo "eb_migrate: Upload deployment package to S3"
aws s3 cp --quiet /opt/ts_gallery.zip s3://$bucketname

if [ $? != 0 ]
then
	echo "eb_migrate: An error occured while copying zip to S3"
	echo "eb_migrate: ***** STARTING ROLLBACK *****"
	cd /opt/ts_gallery
	sh rollback_eb.sh $bucketname
	echo "eb_migrate: ***** ROLLBACK DONE *****"
	echo "eb_migrate: Please confirm your bucket details and try again."
  	exit 1
fi

echo "eb_migrate: Removing lock files"
cd /opt/ts_gallery
[ -f eb_migrate_started.lock ] && rm eb_migrate_started.lock

# Create done lock file
echo "1" > eb_migrate_done.lock

echo "----------------------------------"
echo " Elastic Beanstalk Setup Finished"
echo "----------------------------------"
