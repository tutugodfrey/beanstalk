#!/bin/bash
stageid=A1903111-7C19-43CF-A18E-A9B3127292B4

echo "---------------------------"
echo " Starting RDS Migration"
echo "---------------------------"

if [ -f rds_migrate_started.lock ]
then
    echo "rds_migrate: This script did not complete successfully during it's last run,"
    echo "rds_migrate: please run \"sh rollback_rds.sh\""
    exit 1
fi

if [ -f rds_migrate_done.lock ]
then
    echo "rds_migrate: This script can only be run once."
    echo "rds_migrate: If there are any issues, please run \"sh rollback_rds.sh\""
    exit 1
fi

if [ ! -f s3_migrate_done.lock ]
then
    echo "rds_migrate: This script requires that the S3 lab be completed before running this script."
    echo "rds_migrate: Please work through the S3 lab."
    exit 1
fi


region=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone | egrep -o '(\w)+-(\w)+-[0-9]')

if [ $? != 0 ]
then
  echo "rds_migrate: Unable to determine server region."
  exit 1
fi

secretname=$1
if [ -z "$secretname" ]
then
  read -e -p "Enter your secret name and press <ENTER>: " -i "tsgallery.secrets.dbcluster" secretname
fi

echo ""

yum install jq -y -q &> /dev/null

echo "rds_migrate: Retrieve secret $secretname from $region"
for s in $(aws secretsmanager get-secret-value --secret-id $secretname --region $region --query SecretString --output text 2>/dev/null | jq -r "to_entries|map(\"\(.key)=\(.value|tostring)\")|.[]" ); do
    export $s
done

if [ -z "$username" ] || [ -z "$password" ] || [ -z "$engine" ] || [ -z "$host" ] || [ -z "$port" ] || [ -z "$dbname" ]
then
  echo "rds_migrate: Unable to retrieve secret."
  exit 1
fi

echo "rds_migrate: ==== Moving data to $host ===="

mysql -u $username -p$password -h $host -e "show schemas;" &>/dev/null
if [ $? != 0 ]
then
  echo "rds_migrate: Unable to connect to the database cluster."
  exit 1
fi

# Create lock file
cd /opt/ts_gallery
echo "1" > rds_migrate_started.lock
if [ -f /opt/ts_gallery/rds_migrate_started.lock ]
then
	echo "rds_migrate: Lock file created"
else
  echo "rds_migrate: Unable to create lock file"
  exit 1
fi

echo "rds_migrate: Create new schema $dbname on $host"
mysql -u $username -p$password -h $host -e "CREATE DATABASE IF NOT EXISTS $dbname;" 2>/dev/null
if [ $? != 0 ]
then
  echo "rds_migrate: Unable to create schema."
#Rollback at this point just deletes the lock files
  echo "rds_migrate: ***** STARTING ROLLBACK *****"
  cd /opt/ts_gallery
  sh rollback_rds.sh $secretname
  echo "rds_migrate: ***** ROLLBACK DONE *****"
  exit 1
fi

echo "rds_migrate: Export data from MySQL localhost"
mysqldump -u tsauser -pmy-secret-pw tsagallery > dump.sql
if [ $? != 0 ]
then
  echo "rds_migrate: Unable to export local data."
  echo "rds_migrate: ***** STARTING ROLLBACK *****"
  cd /opt/ts_gallery
  sh rollback_rds.sh $secretname
  echo "rds_migrate: ***** ROLLBACK DONE *****"
  exit 1
fi

echo "rds_migrate: Push data to $host"
mysql -u $username -p$password -h $host $dbname < dump.sql
if [ $? != 0 ]
then
  echo "rds_migrate: Unable to push data to $host"
  echo "rds_migrate: ***** STARTING ROLLBACK *****"
  cd /opt/ts_gallery
  sh rollback_rds.sh $secretname
  echo "rds_migrate: ***** ROLLBACK DONE *****"
  exit 1
fi

echo "rds_migrate: ==== Update the server config ===="

echo "rds_migrate: Backup config to config.rds.bak.js"
cd /opt/ts_gallery/utils
cp config.js config.rds.bak.js

echo "rds_migrate: Add secret name to the aws block in config.js"
sed -i "12i\      secretName: process.env.SECRETNAME || '$secretname'," config.js

echo "rds_migrate: Removing un-needed db configuration block from config.js"
sed -i '15,21d' config.js


echo "rds_migrate: ==== Update the server code to retrieve database credentials before creating database pool ===="

echo "rds_migrate: Backup app to app.rds.bak.js"
cd /opt/ts_gallery
cp app.js app.rds.bak.js

echo "rds_migrate: Removing existing database configuration block"
sed -i '37,44d' app.js

echo "rds_migrate: Adding SecretsManager enabled database configuration block"
sed -i "37i\      var AWS = require('aws-sdk');\n\
      var client = new AWS.SecretsManager({ region: app.locals.config.aws.region });\n\
      var secretObj = await client.getSecretValue({SecretId: app.locals.config.aws.secretName}).promise();\n\
      var secrets = JSON.parse(secretObj.SecretString);\n\
      app.locals.dbpool = mysql.createPool({\n\
        connectionLimit: 10,\n\
        host: secrets.host,\n\
        port: secrets.port,\n\
        user: secrets.username,\n\
        password: secrets.password,\n\
        database: secrets.dbname\n\
      });" app.js


echo "rds_migrate: Restarting server"
cd /opt/ts_gallery/
forever stopall --silent &> /dev/null
forever start  --silent ./bin/www.js &> /dev/null

echo "rds_migrate: Disable MySQL currently running on server"
systemctl --quiet stop mariadb &> /dev/null
systemctl --quiet disable mariadb &> /dev/null

echo "rds_migrate: Removing lock files"
cd /opt/ts_gallery
[ -f dump.sql ] && rm dump.sql
[ -f rds_migrate_started.lock ] && rm rds_migrate_started.lock

# Create done lock file
echo "1" > rds_migrate_done.lock

echo "---------------------------"
echo " RDS Migration Finished"
echo "---------------------------"
