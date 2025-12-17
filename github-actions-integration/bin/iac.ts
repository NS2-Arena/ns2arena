#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { GithubIntegrationStack } from "../lib/stacks/github-integration";

const app = new App();
new GithubIntegrationStack(app, "GithubIntegration", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
