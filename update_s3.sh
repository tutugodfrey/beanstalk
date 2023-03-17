#!/bin/bash
stageid=8F319BF5-16DD-4D38-8E76-2D247A14A079

echo "---------------------------"
echo " Starting S3 Migration"
echo "---------------------------"

if [[ -f s3_migrate_started.lock ]]
then
    echo "s3_migrate: This script did not complete successfully during it's last run,"
    echo "s3_migrate: please run \"sh rollback_s3.sh\""
    exit 1
fi

if [[ -f s3_migrate_done.lock ]]
then
    echo "s3_migrate: This script can only be run once."
    echo "s3_migrate: If there are any issues, please run \"sh rollback_s3.sh\""
    exit 1
fi

region=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone | egrep -o '(\w)+-(\w)+-[0-9]')

if [ $? != 0 ]
then
  echo "s3_migrate: Unable to determine server region."
  exit 1
fi

bucketname=$1
if [ -z "$bucketname" ]
then
	echo -n "Enter your bucket name and press <ENTER>: "
	read bucketname
fi

echo ""


echo "s3_migrate: ==== Validating access to $bucketname ===="

S3_CHECK=$(aws s3api head-bucket --bucket ${bucketname} 2>&1)

if [ $? != 0 ]
then
  NO_BUCKET_CHECK=$(echo $S3_CHECK | grep -c '404')
  if [ $NO_BUCKET_CHECK = 1 ]
  then
    echo "s3_migrate: Bucket s3://${bucketname} does not exist, nothing I can do"
    exit 1
  else
  	NO_BUCKET_CHECK=$(echo $S3_CHECK | grep -c '403')
  	if [ $NO_BUCKET_CHECK = 1 ]
  	then
    	echo "s3_migrate: You do not have permission to access the bucket s3://${bucketname}, nothing I can do"
    	exit 1
    else
    	echo "s3_migrate: An error occured validating access to s3://${bucketname}, nothing I can do"
    	exit 1
  	fi
  fi
fi
echo "s3_migrate: Bucket s3://${bucketname} found and permissions appears ok"


# Create lock file
cd /opt/ts_gallery
echo "1" > s3_migrate_started.lock
if [ -f /opt/ts_gallery/s3_migrate_started.lock ]
then
	echo "s3_migrate: Lock file created"
else
  echo "s3_migrate: Unable to create lock file"
  exit 1
fi

echo "s3_migrate: ==== Moving images to $bucketname ===="

echo "s3_migrate: Backup images"
cd /opt/ts_gallery/public/images/uploads
mkdir backup
mv *.* ./backup

echo "s3_migrate: Copy images to S3"
cd /opt/ts_gallery/public/images/uploads/backup
aws s3 cp --quiet . s3://$bucketname/images/uploads --recursive

if [ $? != 0 ]
then
	echo "s3_migrate: An error occured while copying files to S3"
	echo "s3_migrate: ***** STARTING ROLLBACK *****"
	cd /opt/ts_gallery
	sh rollback_s3.sh $bucketname
	echo "s3_migrate: ***** ROLLBACK DONE *****"
	echo "s3_migrate: Please confirm your bucket details and try again."
  	exit 1
fi

echo ""
echo "Images have now been deleted from the server. To confirm the files are not on the server,"
echo "return to the browser window with the photo gallery open and refresh it. You should see"
echo "the site load with broken images."
echo ""
read -s -n 1 -p "Press any key to continue updating server . . ."
echo ""


echo "s3_migrate: ==== Update the server ===="

echo "s3_migrate: Add the AWS-SDK package"
yum groupinstall "Development Tools" -y -q &> /dev/null

npm install aws-sdk --save  --silent --no-progress &> /dev/null
if [ $? != 0 ]
then
	echo "s3_migrate: An error occured while adding the AWS SDK to npm"
	echo "s3_migrate: ***** STARTING ROLLBACK *****"
	cd /opt/ts_gallery
	sh rollback_s3.sh $bucketname
	echo "s3_migrate: ***** ROLLBACK DONE *****"
  	exit 1
fi

npm update  --silent --no-progress &> /dev/null
if [ $? != 0 ]
then
	echo "s3_migrate: An error occured while updating npm"
	echo "s3_migrate: ***** STARTING ROLLBACK *****"
	cd /opt/ts_gallery
	sh rollback_s3.sh $bucketname
	echo "s3_migrate: ***** ROLLBACK DONE *****"
  	exit 1
fi

echo "s3_migrate: Backup config to config.s3.bak.js"
cd /opt/ts_gallery/utils
cp config.js config.s3.bak.js

echo "s3_migrate: Add region and secret name to the aws block in config.js"
sed -i "10i\    aws: {\n\
      region: process.env.REGION || '$region',\n\
      s3Bucket: process.env.S3_BUCKET || '$bucketname',\n\
    }," config.js

if [ $? != 0 ]
then
	echo "s3_migrate: An error occured while updating config.js"
	echo "s3_migrate: ***** STARTING ROLLBACK *****"
	cd /opt/ts_gallery
	sh rollback_s3.sh $bucketname
	echo "s3_migrate: ***** ROLLBACK DONE *****"
  	exit 1
fi

echo "s3_migrate: ==== Update the server code to use S3 ===="

echo "s3_migrate: Backup www to www.s3.bak.js"
cd /opt/ts_gallery/bin
cp www.js www.s3.bak.js

echo "s3_migrate: Update dependancy injected file system with s3 version"
sed -i 's/filesystem"/filesystem.s3"/g' www.js

if [ $? != 0 ]
then
	echo "s3_migrate: An error occured while updating www.js"
	echo "s3_migrate: ***** STARTING ROLLBACK *****"
	cd /opt/ts_gallery
	sh rollback_s3.sh $bucketname
	echo "s3_migrate: ***** ROLLBACK DONE *****"
 fi

echo "s3_migrate: Restarting server"
cd /opt/ts_gallery/
forever stopall --silent &> /dev/null
forever start  --silent ./bin/www.js &> /dev/null

echo "s3_migrate: Server update done"

# Remove lock file
cd /opt/ts_gallery
rm s3_migrate_started.lock

# Create done lock file
echo "1" > s3_migrate_done.lock

echo "---------------------------"
echo " S3 Migration Finished"
echo "---------------------------"
