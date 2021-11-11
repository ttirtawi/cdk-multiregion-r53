#!/bin/bash

helpFunction()
{
  echo "Usage: $0  --accountid <1> --region1 <2> --region2 <3> --region1role <4> --region2role <5> --keypair1 <6> --keypair2 <7> --cidr1 <8> --cidr2 <9> --subdomain1 <10> --subdomain2 <11> --basedomain <12> --failoversubdomain <13>"
  exit 1 # Exit script after printing help
}


POSITIONAL=()
while [[ $# -gt 0 ]]; do
  key="$1"
  case $key in
    -a|--accountid)
      ACCOUNTID="$2"
      shift # past argument
      shift # past value
      ;;
    -r1|--region1)
      REGION1="$2"
      shift # past argument
      shift # past value
      ;;
    -r2|--region2)
      REGION2="$2"
      shift # past argument
      shift # past value
      ;;
    -d1|--region1role)
      REGION1ROLE="$2"
      shift # past argument
      shift # past value
      ;;
    -d2|--region2role)
      REGION2ROLE="$2"
      shift # past argument
      shift # past value
      ;;  
    -k1|--keypair1)
      KEYPAIR1="$2"
      shift # past argument
      shift # past value
      ;;
    -k2|--keypair2)
      KEYPAIR2="$2"
      shift # past argument
      shift # past value
      ;;
    -c1|--cidr1)
      CIDR1="$2"
      shift # past argument
      shift # past value
      ;;
    -c2|--cidr2)
      CIDR2="$2"
      shift # past argument
      shift # past value
      ;;
    -s1|--subdomain1)
      SUBDOMAIN1="$2"
      shift # past argument
      shift # past value
      ;;
    -s2|--subdomain2)
      SUBDOMAIN2="$2"
      shift # past argument
      shift # past value
      ;;
    -b|--basedomain)
      BASEDOMAIN="$2"
      shift # past argument
      shift # past value
      ;;
    -f|--failoversubdomain)
      FAILOVERSUBDOMAIN="$2"
      shift # past argument
      shift # past value
      ;;
    *)  # unknown option
      POSITIONAL+=("$1") # save it in an array for later
      shift # past argument
      ;;
  esac
done

set -- "${POSITIONAL[@]}" # restore positional parameters

if [[ -z ${ACCOUNTID} || -z ${REGION1} || -z ${REGION2} || -z ${REGION1ROLE} || -z ${REGION2ROLE} || -z ${KEYPAIR1} || -z ${KEYPAIR2} || -z ${CIDR1} || -z ${CIDR2} || -z ${SUBDOMAIN1} || -z ${SUBDOMAIN2} || -z ${BASEDOMAIN} || -z ${FAILOVERSUBDOMAIN} ]]; then
  echo "Incomplete parameter"
  helpFunction;
else
  echo ""
  echo ${ACCOUNTID};
  echo ${REGION1};
  echo ${REGION2};
  echo ${REGION1ROLE};
  echo ${REGION2ROLE};
  echo ${KEYPAIR1};
  echo ${KEYPAIR2};
  echo ${CIDR1};
  echo ${CIDR2};
  echo ${SUBDOMAIN1};
  echo ${SUBDOMAIN2};
  echo ${BASEDOMAIN};
  echo ${FAILOVERSUBDOMAIN};  
  echo ""
  export CDK_DEFAULT_REGION=${REGION1}
  export CDK_DEFAULT_ACCOUNT=${ACCOUNTID}
  export APP="npx ts-node test-multiregion-r53.ts" 
  # Create subdomain
  cdk deploy --context domainName=${BASEDOMAIN} --context subdomainName=${SUBDOMAIN1} region1Subdomain
  cdk context --clear
  cdk deploy --context domainName=${BASEDOMAIN} --context subdomainName=${SUBDOMAIN2} region2Subdomain
  
  # Create failover subdomain
  cdk context --clear
  cdk deploy --context domainName=${BASEDOMAIN} --context subdomainName=${FAILOVERSUBDOMAIN} failoverDomain

  # Create application stack PRIMARY
  cdk context --clear
  cdk deploy --context domainName=${BASEDOMAIN} \
    --context subdomainName=${SUBDOMAIN1} \
    --context cidr=${CIDR1} \
    --context keyName=${KEYPAIR1} \
    --context failoverRole=${REGION1ROLE} \
    --context failoverRecord=${FAILOVERSUBDOMAIN} region1;

  # Create application stack SECONDARY
  export CDK_DEFAULT_REGION=${REGION2}
  env | grep CDK_DEFAULT_REGION
  CDK_DEFAULT_REGION=${REGION2} npx cdk deploy --context domainName=${BASEDOMAIN} \
  --context subdomainName=${SUBDOMAIN2} \
  --context cidr=${CIDR2} \
  --context keyName=${KEYPAIR2} \
  --context failoverRole=${REGION2ROLE} \
  --context failoverRecord=${FAILOVERSUBDOMAIN} region2
  
fi




