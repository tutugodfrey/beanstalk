echo "====================="
echo "  TechShift Migrate"
echo "====================="
echo
stage=0
#stages 0-install done, 1=S3 done, 2=RDS done, 3=EB done

if [ -f s3_migrate_done.lock ]
then
  if [ -f rds_migrate_done.lock ]
  then
    if [ -f eb_migrate_done.lock ]
    then
      stage=3
    else
      stage=2
    fi
  else
    stage=1
  fi
else
  stage=0
fi

case $stage in
  0)
    echo "1. Update S3"
    ;;
  1)
    echo "2. Rollback S3"
    echo "3. Update RDS"
    ;;
  2)
    echo "4. Rollback RDS"
    echo "5. Update Elastic Beanstalk"
    ;;
  3)
    echo "6. Rollback Elastic Beanstalk"
    ;;
esac
echo "7. Exit"

read -p "Enter choice [1 to 7]: " choice

case $choice in
  1) sh update_s3.sh ;;
	2) sh rollback_s3.sh ;;
  3) sh update_rds.sh ;;
  4) sh rollback_rds.sh ;;
  5) sh update_eb.sh ;;
  6) sh rollback_eb.sh ;;
  7) exit 0;;
  *) echo -e "Invalid option entered. Please enter a number between 1 and 7." ;;
esac
