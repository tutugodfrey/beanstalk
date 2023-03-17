#!/bin/bash

echo "---------------------------"
echo " Starting RDS Rollback"
echo "---------------------------"

region=$(curl -s http://169.254.169.254/latest/meta-data/placement/availability-zone | egrep -o '(\w)+-(\w)+-[0-9]')

if [ $? != 0 ]
then
  echo "rds_rollback: Unable to determine server region."
  exit 1
fi

echo "rds_rollback: Rollback changes to remote database"

secretname=$1
if [ -z "$secretname" ]
then
  read -e -p "Enter your secret name and press <ENTER>: " -i "tsgallery.secrets.dbcluster" secretname
fi

yum install jq -y -q &> /dev/null

echo "rds_rollback: Retrieve secret $secretname from $region"
for s in $(aws secretsmanager get-secret-value --secret-id $secretname --region $region --query SecretString --output text 2>/dev/null | jq -r "to_entries|map(\"\(.key)=\(.value|tostring)\")|.[]" ); do
    export $s
done

if [ -z "$username" ] || [ -z "$password" ] || [ -z "$engine" ] || [ -z "$host" ] || [ -z "$port" ] || [ -z "$dbname" ]
then
  echo "rds_rollback: Unable to retrieve secret."
  exit 1
else
  mysql -u $username -p$password -h $host -e "show schemas;" &>/dev/null
  if [ $? != 0 ]
  then
    echo "rds_rollback: Unable to connect to the database cluster."
  else
    #Attempt to delete the data from the server
    echo "rds_rollback: Droping schema and tables"

    mysql -u $username -p$password -h $host -e "drop schema $dbname;" 2>/dev/null
  fi
fi

echo "rds_rollback: Rollback changes to config file"
cd /opt/ts_gallery/utils
if [ -f config.rds.bak.js ]
then
	rm config.js
	mv config.rds.bak.js config.js
fi

echo "rds_rollback: Rollback changes to application file"
cd /opt/ts_gallery
if [ -f app.rds.bak.js ]
then
	rm app.js
	mv app.rds.bak.js app.js
fi

echo "rds_rollback: Enable local MySQL server"
systemctl --quiet start mariadb &> /dev/null
systemctl --quiet enable mariadb &> /dev/null

echo "rds_rollback: Restarting server"
cd /opt/ts_gallery/
forever stopall --silent &> /dev/null
forever start  --silent ./bin/www.js &> /dev/null

echo "rds_rollback: Removing lock files"
cd /opt/ts_gallery
[ -f dump.sql ] && rm dump.sql
[ -f rds_migrate_started.lock ] && rm rds_migrate_started.lock
[ -f rds_migrate_done.lock ] && rm rds_migrate_done.lock

echo "---------------------------"
echo " RDS Rollback Finished"
echo "---------------------------"
