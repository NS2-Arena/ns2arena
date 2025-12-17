import { Construct } from "constructs";
import {
  Effect,
  FederatedPrincipal,
  ManagedPolicy,
  OpenIdConnectProvider,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { Stack, StackProps } from "aws-cdk-lib";

export class GithubIntegrationStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const oidcProvider = new OpenIdConnectProvider(this, "OIDCProvider", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
    });

    const actionsPolicy = new ManagedPolicy(this, "ActionsPolicy", {
      statements: [
        new PolicyStatement({
          // TODO: Lock down a bit
          actions: ["*"],
          resources: ["*"],
          effect: Effect.ALLOW,
        }),
      ],
    });

    new Role(this, "ActionsRole", {
      assumedBy: new FederatedPrincipal(
        oidcProvider.openIdConnectProviderArn,
        {
          StringEquals: {
            "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          },
          StringLike: {
            "token.actions.githubusercontent.com:sub":
              "repo:NS2-Arena/*:ref:refs/heads/main",
          },
        },
        "sts:AssumeRoleWithWebIdentity"
      ),
      managedPolicies: [actionsPolicy],
      roleName: "ActionsRole",
    });
  }
}
