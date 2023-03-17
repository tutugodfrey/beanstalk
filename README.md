# Install ebcli (ElasticBeanstalk)
curl -O https://bootstrap.pypa.io/get-pip.py
python3 get-pip.py --user
export PATH=~/.local/bin:$PATH
pip install awsebcli --upgrade --user
eb init # At prompt provide the required data
# deploy the eb app. Configuration is .elasticbeanstalk/config.yaml
# Note the eb cli need a profile to access resource
eb deploy --staged
