import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";

export class AwsCitizenlabOssStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 📦 VPC
    const vpc = new ec2.Vpc(this, "citizenlab-vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.0.0.0/16"),
      natGateways: 0,
      subnetConfiguration: [
        { name: "public", cidrMask: 24, subnetType: ec2.SubnetType.PUBLIC },
      ],
    });

    // 📃 Security Group
    const citizenlabSG = new ec2.SecurityGroup(
      this,
      "citizenlab-webserver-sg",
      {
        vpc,
        allowAllOutbound: true,
      }
    );

    citizenlabSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(22),
      "allow SSH access from anywhere, with key"
    );

    citizenlabSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(80),
      "allow HTTP traffic from anywhere"
    );

    citizenlabSG.addIngressRule(
      ec2.Peer.anyIpv4(),
      ec2.Port.tcp(443),
      "allow HTTPS traffic from anywhere"
    );

    // 👮‍♀️ IAM Role
    const citizenlabRole = new iam.Role(this, "citizenlab-role", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3ReadOnlyAccess"),
      ],
    });

    // 🔑 Import the SSH key - first create a key pair in the ec2 dashboard if one doesn't exist
    const keyPair = ec2.KeyPair.fromKeyPairName(
      this,
      "key-pair",
      "devcitizenlab-key-pair"
    );

    // 💿 Specify Ubuntu 20.04 image from Canonical Public SSM Parameter Store
    const ubuntu = ec2.MachineImage.fromSsmParameter(
      "/aws/service/canonical/ubuntu/server/focal/stable/current/amd64/hvm/ebs-gp2/ami-id"
    );

    // 🖥️ create the EC2 Instance
    const ec2Instance = new ec2.Instance(this, "ec2-instance", {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      role: citizenlabRole,
      securityGroup: citizenlabSG,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.LARGE // or LARGE for 8GB RAM?
      ),
      machineImage: ubuntu,
      keyPair: keyPair,
    });
  }
}

// ssh -i "devcitizenlab-key-pair.pem" ubuntu@ec2-13-40-23-76.eu-west-2.compute.amazonaws.com
