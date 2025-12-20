import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as common from "../../common";
import { EcrRepoInfo } from "@ns2arena/common";

interface NS2ServerComputeRegionalArgs {
  repository: aws.ecr.Repository;
  configBucket: aws.s3.Bucket;
  bucketParameter: aws.ssm.Parameter;
  instanceProfileRole: aws.iam.Role;
  region: string;
}

export class NS2ServerComputeRegional extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: NS2ServerComputeRegionalArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("ns2arena:compute:NS2ServerCompute", name, {}, opts);

    const {
      repository,
      configBucket,
      bucketParameter,
      region,
      instanceProfileRole,
    } = args;

    const taskRole = new aws.iam.Role(
      `${name}-task-role`,
      {
        assumeRolePolicy: common.policy_helpers.Role.servicePrincipal(
          "ecs-tasks.amazonaws.com"
        ),
        inlinePolicies: [
          {
            policy: aws.iam.getPolicyDocumentOutput({
              statements: [
                common.policy_helpers.Parameter.grantRead(bucketParameter),
                common.policy_helpers.Bucket.grantRead(configBucket),
              ],
            }).json,
          },
        ],
      },
      { parent: this }
    );

    new aws.iam.RolePolicy(
      `${name}-dynamic-role-policy`,
      {
        role: taskRole.name,
        policy: aws.iam.getPolicyDocumentOutput({
          statements: [
            common.policy_helpers.StateMachine.grantSendTaskNotification(),
          ],
        }).json,
      },
      { parent: this }
    );

    const logGroup = new aws.cloudwatch.LogGroup(
      `${name}-log-group`,
      {
        name: `/NS2Arena/NS2-Servers/${region}`,
      },
      { parent: this }
    );

    new aws.ecs.TaskDefinition(
      `${name}-task-definition`,
      {
        requiresCompatibilities: ["EC2"],
        taskRoleArn: taskRole.arn,
        networkMode: "host",
        placementConstraints: [
          {
            type: "memberOf",
            expression: "runningTasksCount == 0",
          },
        ],
        family: "ns2server",
        containerDefinitions: pulumi
          .all([logGroup.id, repository.repositoryUrl])
          .apply(([logGroupArn, repositoryUri]) =>
            JSON.stringify([
              {
                name: EcrRepoInfo.Containers.Ns2Server,
                image: repositoryUri,
                portMappings: [
                  { containerPort: 27015, hostPort: 27015, protocol: "tcp" },
                  { containerPort: 27016, hostPort: 27016, protocol: "tcp" },
                  { containerPort: 27017, hostPort: 27017, protocol: "tcp" },
                  { containerPort: 27015, hostPort: 27015, protocol: "udp" },
                  { containerPort: 27016, hostPort: 27016, protocol: "udp" },
                  { containerPort: 27017, hostPort: 27017, protocol: "udp" },
                ],
                cpu: 1024,
                memoryReservation: 1536,
                logConfiguration: {
                  logDriver: "awslogs",
                  options: {
                    "awslogs-region": "eu-west-2", //TODO: you knwo what
                    "awslogs-group": logGroupArn,
                    "awslogs-stream-prefix": "/NS2Arena/NS2-Servers",
                  },
                },
                essential: true,
                privileged: true,
                user: "ns2arena",
              },
            ])
          ),
      },
      { parent: this }
    );

    const cluster = new aws.ecs.Cluster(
      `${name}-cluster`,
      {
        configuration: {},
        settings: [
          {
            name: "containerInsights",
            value: "enabled",
          },
        ],
      },
      { parent: this }
    );

    const securityGroup = new aws.ec2.SecurityGroup(
      `${name}-security-group`,
      {
        ingress: ["tcp", "udp"].map((protocol) => ({
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow TCP access",
          fromPort: 27015,
          toPort: 27017,
          protocol,
        })),
        egress: [
          {
            cidrBlocks: ["0.0.0.0/0"],
            description: "Allow all outbound traffic",
            protocol: "-1",
            fromPort: 0,
            toPort: 0,
          },
        ],
      },
      { parent: this }
    );

    const instanceProfile = new aws.iam.InstanceProfile(
      `${name}-instance-profile`,
      {
        role: instanceProfileRole.id,
      },
      { parent: this }
    );

    const launchTemplate = new aws.ec2.LaunchTemplate(
      `${name}-launch-template`,
      {
        updateDefaultVersion: true,
        imageId: aws.ssm.getParameterOutput({
          name: "/aws/service/ecs/optimized-ami/amazon-linux-2023/recommended/image_id",
          region,
        }).value,
        instanceType: "c7a.medium",
        iamInstanceProfile: {
          arn: instanceProfile.arn,
        },
        networkInterfaces: [
          {
            associatePublicIpAddress: "true",
            deviceIndex: 0,
            securityGroups: [securityGroup.id],
          },
        ],
        blockDeviceMappings: [
          {
            deviceName: "/dev/xvda",
            ebs: {
              volumeType: "gp3",
              volumeSize: 30,
              encrypted: "true",
            },
          },
        ],
        userData: cluster.name.apply((clusterName) =>
          Buffer.from(this.getUserData(clusterName), "utf-8").toString("base64")
        ),
        metadataOptions: {
          httpTokens: "required",
          httpEndpoint: "enabled",
        },
      },
      { parent: this }
    );

    this.registerOutputs({
      launchTemplate,
    });
  }

  private getUserData(clusterName: string): string {
    return `#!/bin/bash\necho "ECS_CLUSTER=${clusterName}" >> /etc/ecs/ecs.config`;
  }
}
