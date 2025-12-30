import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as common from "../../common";
import { EcrRepoInfo } from "@ns2arena/common";
import { ServerManagement } from "./server-management";
import { DynamoTables } from "../database/dynamo-tables";

interface NS2ServerComputeRegionalArgs {
  repository: aws.ecr.Repository;
  configBucket: aws.s3.Bucket;
  bucketParameter: aws.ssm.Parameter;
  tables: DynamoTables;
  instanceProfileRole: aws.iam.Role;
  region: string;
}

export class NS2ServerComputeRegional extends pulumi.ComponentResource {
  public readonly cluster: aws.ecs.Cluster;
  public readonly taskDefinition: aws.ecs.TaskDefinition;
  public readonly launchTemplate: aws.ec2.LaunchTemplate;

  private readonly name: string;

  constructor(
    name: string,
    args: NS2ServerComputeRegionalArgs,
    opts?: pulumi.ComponentResourceOptions
  ) {
    super("ns2arena:compute:NS2ServerCompute", name, args, opts);

    const {
      repository,
      configBucket,
      bucketParameter,
      tables,
      region,
      instanceProfileRole,
    } = args;

    this.name = name;

    const taskRole = this.createTaskRole(bucketParameter, configBucket);
    const logGroup = this.createLogGroup(region);
    this.taskDefinition = this.createTaskDefinition(
      taskRole,
      logGroup,
      repository
    );
    this.cluster = this.createCluster();
    const securityGroup = this.createSecurityGroup();
    const iamInstanceProfile = this.createInstanceProfile(instanceProfileRole);
    this.launchTemplate = this.createLaunchTemplate(
      region,
      iamInstanceProfile,
      securityGroup
    );

    new ServerManagement(
      `${name}-server-management`,
      {
        taskRole,
        region,
        tables,
        launchTemplate: this.launchTemplate,
        iamInstanceProfile,
        securityGroup,
      },
      { parent: this }
    );
  }

  private createTaskRole(
    bucketParameter: aws.ssm.Parameter,
    configBucket: aws.s3.Bucket
  ) {
    return new aws.iam.Role(
      `${this.name}-task-role`,
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
  }

  private createLogGroup(region: string) {
    return new aws.cloudwatch.LogGroup(
      `${this.name}-log-group`,
      {
        name: `/NS2Arena/NS2-Servers/${region}`,
      },
      { parent: this }
    );
  }

  private createTaskDefinition(
    taskRole: aws.iam.Role,
    logGroup: aws.cloudwatch.LogGroup,
    repository: aws.ecr.Repository
  ) {
    return new aws.ecs.TaskDefinition(
      `${this.name}-task-definition`,
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
  }

  private createCluster() {
    return new aws.ecs.Cluster(
      `${this.name}-cluster`,
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
  }

  private createSecurityGroup() {
    return new aws.ec2.SecurityGroup(
      `${this.name}-security-group`,
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
  }

  private createInstanceProfile(instanceProfileRole: aws.iam.Role) {
    return new aws.iam.InstanceProfile(
      `${this.name}-instance-profile`,
      {
        role: instanceProfileRole.id,
      },
      { parent: this }
    );
  }

  private createLaunchTemplate(
    region: string,
    instanceProfile: aws.iam.InstanceProfile,
    securityGroup: aws.ec2.SecurityGroup
  ) {
    return new aws.ec2.LaunchTemplate(
      `${this.name}-launch-template`,
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
        userData: this.cluster.name.apply((clusterName) =>
          Buffer.from(this.getUserData(clusterName), "utf-8").toString("base64")
        ),
        metadataOptions: {
          httpTokens: "required",
          httpEndpoint: "enabled",
        },
      },
      { parent: this }
    );
  }

  private getUserData(clusterName: string): string {
    return `#!/bin/bash\necho "ECS_CLUSTER=${clusterName}" >> /etc/ecs/ecs.config`;
  }
}
