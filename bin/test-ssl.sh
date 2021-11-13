#!/bin/bash
export CDK_DEFAULT_ACCOUNT=452922823873
export CFREGION=us-east-2
export BASEDOMAIN=awsbuilder.xyz
export SUBDOMAIN1=babi
export FAILOVERSUBDOMAIN=kuda

# Create subdomain
cdk deploy --context domainName=${BASEDOMAIN} --context subdomainName=${SUBDOMAIN1} region1Subdomain
cdk context --clear
# Create failover subdomain
cdk context --clear
cdk deploy --context domainName=${BASEDOMAIN} --context subdomainName=${FAILOVERSUBDOMAIN} failoverDomain
# Create SSL
cdk context --clear
cdk deploy --context domainName=${BASEDOMAIN} --context subdomainName=${SUBDOMAIN1} --context failoverRecord=${FAILOVERSUBDOMAIN} ssl