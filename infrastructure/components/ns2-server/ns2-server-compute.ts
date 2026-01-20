import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as common from "../../common";
import { ConfigStoreBucket } from "../server-configs/config-store-bucket";
import { NS2ServerComputeRegional } from "./ns2-server-compute-regional";
import { Tables } from "../database/dynamo-tables";

interface NS2ServerComputeArgs {
  computeRegions: string[];
  repositories: common.types.RegionalData<aws.ecr.Repository>;
  configStores: common.types.RegionalData<ConfigStoreBucket>;
  tables: Tables;
}

export class NS2ServerCompute extends pulumi.ComponentResource {
  constructor(
    name: string,
    args: NS2ServerComputeArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("ns2arena:compute:NS2ServerCompute", name, args, opts);

    const { computeRegions, repositories, configStores, tables } = args;

    const instanceProfileRole = new aws.iam.Role(
      `${name}-instance-profile-role`,
      {
        name: "ns2-server-instance-profile-role",
        assumeRolePolicy:
          common.policy_helpers.Role.servicePrincipal("ec2.amazonaws.com"),
        inlinePolicies: [
          {
            policy: this.createEC2Policy(),
          },
        ],
      },
      { parent: this },
    );

    const resources = computeRegions.map((region) => {
      const provider = new aws.Provider(
        `${name}-provider-${region}`,
        { region },
        { parent: this },
      );

      return new NS2ServerComputeRegional(
        `${name}-compute-${region}`,
        {
          repository: repositories[region],
          configBucket: configStores[region].bucket,
          bucketParameter: configStores[region].parameter,
          tables,
          region,
          instanceProfileRole,
        },
        {
          parent: this,
          provider,
        },
      );
    });

    this.registerOutputs({
      regionalLaunchTemplates: resources,
    });
  }

  private createEC2Policy() {
    return aws.iam.getPolicyDocumentOutput({
      statements: [
        {
          effect: "Allow",
          actions: [
            "ec2:DescribeTags",
            "ecs:CreateCluster",
            "ecs:DeregisterContainerInstance",
            "ecs:DiscoverPollEndpoint",
            "ecs:Poll",
            "ecs:RegisterContainerInstance",
            "ecs:StartTelemetrySession",
            "ecs:UpdateContainerInstancesState",
            "ecs:Submit*",
            "ecr:GetAuthorizationToken",
            "ecr:BatchCheckLayerAvailability",
            "ecr:GetDownloadUrlForLayer",
            "ecr:BatchGetImage",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
          ],
          resources: ["*"],
        },
        {
          effect: "Allow",

          actions: ["ecs:TagResource"],
          resources: ["*"],
          conditions: [
            {
              test: "StringEquals",
              variable: "ecs:CreateAction",
              values: ["CreateCluster", "RegisterContainerUsage"],
            },
          ],
        },
        {
          effect: "Allow",
          actions: ["ecs:ListTagsForResource"],
          resources: [
            "arn:aws:ecs:*:*:task/*/*",
            "arn:aws:ecs:*:*:container-instance/*/*",
          ],
        },
      ],
    }).json;
  }
}
