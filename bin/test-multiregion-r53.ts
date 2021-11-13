#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { HostedZoneStack } from '../lib/newHostedZone';
import { regionalStack } from '../lib/test-multiregion-r53-stack';
import { sslCertStack } from '../lib/sslCert';

const app = new cdk.App();

const region1Subdomain = new HostedZoneStack(app, 'region1Subdomain', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CFREGION 
  }
});
const region2Subdomain = new HostedZoneStack(app, 'region2Subdomain', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CFREGION 
  }
});
const failoverDomain = new HostedZoneStack(app, 'failoverDomain', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CFREGION 
  }
});
const region1 = new regionalStack(app, 'region1', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CFREGION 
  }
});
// region1.addDependency(region1Subdomain);
// region1.addDependency(failoverDomain);


const region2 = new regionalStack(app, 'region2', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CFREGION 
  }
});
// region2.addDependency(region2Subdomain);  


const testSSL = new sslCertStack(app, 'ssl', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CFREGION
  }
})