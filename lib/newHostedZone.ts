import * as cdk from '@aws-cdk/core';
import * as r53 from '@aws-cdk/aws-route53';

export class HostedZoneStack extends cdk.Stack {

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps ) {
      super(scope, id, props);

      // Apparently parameter values are not available at synthesis time
      // change to use context instead
      
      // const parentZoneId = new cdk.CfnParameter(this, "parentZoneId", {
      //   type: "String",
      //   description: "The Route53 parent domain zone ID."}); 
      // const domainName = new cdk.CfnParameter(this, "domainName", {
      //   type: "String",
      //   description: "The Route53 base domain name."});  
      // const subdomainName = new cdk.CfnParameter(this, "subdomainName", {
      //   type: "String",
      //   description: "The subdomain name only for the Regional Endpoint, exclude the base domain name."});    

      const domainName = this.node.tryGetContext('domainName');
      const subdomainName = this.node.tryGetContext('subdomainName');
      
      // Populate existing Route53 zone information
      const parentZone = r53.HostedZone.fromLookup(this, 'myr53',{
        domainName: domainName,
      });

      // Create subdomain hosted zone
      const zoneName = `${subdomainName}.${domainName}`;
      const newZone = new r53.PublicHostedZone(this, 'subdomain', {
          zoneName,
      });
      
      const nsArray = newZone.hostedZoneNameServers as string[];
      const nsList = cdk.Fn.join(',', nsArray );
      
      const nsrecord = new r53.NsRecord(this, 'parent', {
        zone: parentZone,
        values: nsArray,
        recordName: subdomainName
      })
      
      new cdk.CfnOutput(this, 'ZoneName', { value: zoneName });
      new cdk.CfnOutput(this, 'NameServerList', { value: nsList });
    }
}