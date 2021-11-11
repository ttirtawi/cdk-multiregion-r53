import * as cdk from '@aws-cdk/core';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elb from '@aws-cdk/aws-elasticloadbalancingv2';
import * as autoscaling from '@aws-cdk/aws-autoscaling';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as r53 from '@aws-cdk/aws-route53';
import * as r53target from '@aws-cdk/aws-route53-targets';
import { CfnOutput } from '@aws-cdk/core';
import {readFileSync} from 'fs';

export class regionalStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps ) {
    super(scope, id, props);
    
    const cidr = this.node.tryGetContext('cidr');
    const keyName = this.node.tryGetContext('keyName');
    const domainName = this.node.tryGetContext('domainName');
    const subdomainName = this.node.tryGetContext('subdomainName');
    const failoverRecord = this.node.tryGetContext('failoverRecord');
    const failoverRole = this.node.tryGetContext('failoverRole');

    const fqdn = `${subdomainName}.${domainName}`;
    const failoverdomain = `${failoverRecord}.${domainName}`;
    const stackName = cdk.Stack.of(this).stackName;
    
    // Create VPC
    const vpc = new ec2.Vpc(this, 'vpc1', {
      cidr: cidr,
      natGateways: 1,
      maxAzs: 2
    });

    // Create Security Group for Web Server
    const securitygroup = new ec2.SecurityGroup(this, 'mysg',{
      vpc: vpc,
      allowAllOutbound: true,
      securityGroupName: `web-sg-${fqdn}`,
      description: `web-sg-${stackName}`
    });
    securitygroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      'allow ssh from anywhere'
    );
    securitygroup.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.icmpPing(),
      'allow ping from anywhere'
    );   

    // Create Security Group for ALB
    const securitygroupLB = new ec2.SecurityGroup(this, 'mysglb',{
      vpc: vpc,
      allowAllOutbound: true,
      securityGroupName: `elb-sg-${stackName}`,
      description: `elb-sg-${stackName}`
    });
    securitygroupLB.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
    );
    securitygroupLB.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
    );

    // Prepare subnet list for Auto Scaling Grup
    var subnets: ec2.SubnetSelection = {
      subnetType: ec2.SubnetType.PUBLIC
    };
    
    // Create Auto Scaling Group
    const asg = new autoscaling.AutoScalingGroup(this, 'asg', {
      autoScalingGroupName: `${stackName}-${fqdn}`,
      vpc,
      keyName: keyName,
      instanceType: new ec2.InstanceType('t3.micro'),
      machineImage: ec2.MachineImage.latestAmazonLinux({
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2
      }),
      allowAllOutbound: true,
      desiredCapacity: 2,
      minCapacity: 1,
      maxCapacity: 4,
      securityGroup: securitygroup,
      vpcSubnets: subnets,
    });

    // Define User Data for EC2
    const userDataScript = readFileSync('./lib/userdata.sh', 'utf8');
    asg.addUserData(userDataScript);

    // Create Target Group
    const targetgroup = new elb.ApplicationTargetGroup(this, 'tg', {
      vpc,
      port: 80,
      targetType: elb.TargetType.INSTANCE
    })

    // Attach Auto Scaling Group to Target Grop 
    asg.attachToApplicationTargetGroup(targetgroup);

    // Create Application Load Balancer
    const applicationLoadBalancer = new elb.ApplicationLoadBalancer(this, 'alb',{
      vpc,
      loadBalancerName: `ALB-${stackName}`,
      securityGroup: securitygroupLB,
      internetFacing: true
    });

    // Create ALB Listener HTTP & forward to Target Group
    var targetGroups: elb.IApplicationTargetGroup[] = [];
    targetGroups.push(targetgroup);
    // applicationLoadBalancer.addListener('http',{
    //   port:80,
    //   defaultAction:  elb.ListenerAction.forward(targetGroups)
    // });

    // Populate existing Route53 zone information
    const hostedZone = r53.HostedZone.fromLookup(this, 'myr53',{
      domainName: fqdn
    });

    // Populate failover zone too
    const failoverZone = r53.HostedZone.fromLookup(this, 'myparentr53',{
      domainName:  failoverdomain
    });

    // Create ACM SSL Certificate with DNS validation
    // ALB must have both SSL certificate for both regional & failover domain 
    // so creating 2 certs
    const cert = new acm.DnsValidatedCertificate(this, 'cert', {
      domainName: fqdn,
      hostedZone: hostedZone,
    });
    const cert2 = new acm.DnsValidatedCertificate(this, 'cert2', {
      domainName: failoverdomain,
      hostedZone: failoverZone,
    });
    var certs: elb.ListenerCertificate[] = [];
    certs.push(cert);  
    certs.push(cert2)

    // Create ALB Listener HTTPS
    applicationLoadBalancer.addListener('https',{
      port: 443,
      defaultAction: elb.ListenerAction.forward(targetGroups),
      // defaultAction: elb.ListenerAction.fixedResponse(503),
      certificates: certs
    });

    // Default redirection from HTTP to HTTPS can use addRedirect.
    // Cannot coexist with HTTP Listener
    applicationLoadBalancer.addRedirect();

    // Create new Route53 Alias record, without recordName it will be created as root / apex
    const newAlias = new r53.ARecord(this, 'albRecord', {
      zone: hostedZone,
      target: r53.RecordTarget.fromAlias(new r53target.LoadBalancerTarget(applicationLoadBalancer))
    });

    // Prepare Route53 Health Check
    const healthCheck = new r53.CfnHealthCheck(this, 'healthcheck', {
      healthCheckTags: [
        {
          key: 'Name',
          value: `healthcheck-${fqdn}`
        }
      ],
      healthCheckConfig: {
        port: 443,
        type: "HTTPS",
        resourcePath: "/",
        fullyQualifiedDomainName: fqdn,
        requestInterval: 10,
        failureThreshold: 2,
      },
    });

    // Create failover record in the failover zone
    const record = new r53.ARecord(this, 'A', {
      zone: failoverZone,
      target: r53.RecordTarget.fromAlias(new r53target.LoadBalancerTarget(applicationLoadBalancer)),
    });    
    
    // Create Failover record primary or standby
    const recordSet = (record.node.defaultChild as r53.CfnRecordSet);
    recordSet.failover = failoverRole;
    recordSet.setIdentifier = failoverRole;
    recordSet.healthCheckId = healthCheck.attrHealthCheckId;

    new CfnOutput(this, 'LB DNS Name', {value: applicationLoadBalancer.loadBalancerDnsName});
    new CfnOutput(this, 'DNS_Record', {value: newAlias.domainName});
    new CfnOutput(this, 'FQDN', {value: fqdn});
    new CfnOutput(this, 'certArn', {value: cert.certificateArn});
    new CfnOutput(this, 'cert2Arn', {value: cert2.certificateArn});
    new CfnOutput(this, 'hostedZone', {value: hostedZone.hostedZoneId});
    new CfnOutput(this, 'failoverZone', {value: failoverZone.hostedZoneId});
  }
}
