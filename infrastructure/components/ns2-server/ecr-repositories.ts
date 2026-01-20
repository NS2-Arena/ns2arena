import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as common from "../../common";
import * as arena_common from "@ns2arena/common";
import { RegionalData } from "../../common/types";

interface EcrRepositoriesArgs {
  computeRegions: string[];
  replicationRegions: string[];
}

export class EcrRepositories extends pulumi.ComponentResource {
  public readonly repositories: RegionalData<aws.ecr.Repository>;

  constructor(
    name: string,
    args: EcrRepositoriesArgs,
    opts?: pulumi.ComponentResourceOptions,
  ) {
    super("ns2arena:containers:EcrRepositories", name, args, opts);

    const { computeRegions, replicationRegions } = args;

    const accountId = aws.getCallerIdentityOutput().accountId;

    this.repositories = computeRegions.reduce(
      (prev, region) => {
        const provider = new aws.Provider(
          `${name}-provider-${region}`,
          { region },
          { parent: this },
        );

        return {
          ...prev,
          [region]: new EcrRepository(
            `${name}-repository-${region}`,
            {},
            { provider, parent: this },
          ).repository,
        };
      },
      {} as typeof this.repositories,
    );

    new aws.ecr.ReplicationConfiguration(
      `${name}-replication-config`,
      {
        replicationConfiguration: {
          rules: [
            {
              destinations: accountId.apply((accountId) =>
                replicationRegions.map((region) => ({
                  region,
                  registryId: accountId,
                })),
              ),
              repositoryFilters: [
                {
                  filter: "ns2arena/",
                  filterType: "PREFIX_MATCH",
                },
              ],
            },
          ],
        },
      },
      { parent: this, dependsOn: Object.values(this.repositories) },
    );

    this.registerOutputs({
      repositories: this.repositories,
    });
  }
}

class EcrRepository extends pulumi.ComponentResource {
  public readonly repository: aws.ecr.Repository;

  constructor(name: string, args: {}, opts: pulumi.ComponentResourceOptions) {
    super("ns2arena:containers:EcrRepository", name, args, opts);

    this.repository = new aws.ecr.Repository(
      `${name}-repository`,
      {
        imageTagMutability: "IMMUTABLE_WITH_EXCLUSION",
        imageTagMutabilityExclusionFilters: [
          {
            filter: "LATEST",
            filterType: "WILDCARD",
          },
        ],
        name: common.repo_info.Repos.Ns2Servers,
      },
      { parent: this },
    );

    new aws.ecr.LifecyclePolicy(
      `${name}-lifecycle-policy`,
      {
        repository: this.repository.id,
        policy: aws.ecr.getLifecyclePolicyDocumentOutput({
          rules: [
            {
              priority: 1,
              description: "Remove all untagged images",
              selection: {
                tagStatus: "any",
                countType: "imageCountMoreThan",
                countNumber: 1,
              },
            },
          ],
        }).json,
      },
      { parent: this, dependsOn: [this.repository] },
    );

    new aws.ssm.Parameter(
      `${name}-parameter`,
      {
        type: aws.ssm.ParameterType.String,
        insecureValue: this.repository.name,
        name: arena_common.ssm.ImageRepositories.NS2Server.Name,
      },
      { parent: this },
    );

    this.registerOutputs({
      repository: this.repository,
    });
  }
}
