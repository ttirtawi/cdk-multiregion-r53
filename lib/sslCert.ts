import * as cdk from '@aws-cdk/core';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as r53 from '@aws-cdk/aws-route53';
import { CfnOutput } from '@aws-cdk/core';

export class sslCertStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps ) {
    super(scope, id, props);
    
    const domainName = this.node.tryGetContext('domainName');
    const subdomainName = this.node.tryGetContext('subdomainName');
    const failoverRecord = this.node.tryGetContext('failoverRecord');

    const fqdn = `${subdomainName}.${domainName}`;
    const failoverdomain = `${failoverRecord}.${domainName}`;
  
    console.log('fqdn:',fqdn);
    console.log('failoverdomain:',failoverdomain);
    // Populate existing Route53 zone information
    const hostedZone = r53.HostedZone.fromLookup(this, 'myr53',{
      domainName: fqdn
    });

    // Populate failover zone too
    const failoverZone = r53.HostedZone.fromLookup(this, 'myparentr53',{
      domainName:  failoverdomain
    });

    // Create ACM SSL Certificate with DNS validation
    // with 2 entries in SAN
    const cert = new acm.Certificate(this, 'cert', {
      domainName: fqdn,
      subjectAlternativeNames: [failoverdomain],
      validation: acm.CertificateValidation.fromDnsMultiZone({
        fqdn: hostedZone,
        failoverdomain: failoverZone
      })
    });

    const domainValidationOptions = [{ 
      DomainName: fqdn,
      HostedZoneId: hostedZone.hostedZoneId
    },{ 
      DomainName: failoverdomain,
      HostedZoneId: failoverZone.hostedZoneId
    }];
  
    const cfnCertificate = cert.node.defaultChild as acm.CfnCertificate;
    cfnCertificate.addOverride('Properties.DomainValidationOptions', domainValidationOptions);

    new CfnOutput(this, 'FQDN', {value: fqdn});
    new CfnOutput(this, 'certArn', {value: cert.certificateArn});
  }
}
