#!/usr/bin/env node
import { App, Aspects } from "aws-cdk-lib";
import { GithubIntegrationStack } from "../lib/stacks/github-integration";
import {
  AwsSolutionsChecks,
  NIST80053R5Checks,
  ServerlessChecks,
} from "cdk-nag";

const app = new App();
new GithubIntegrationStack(app, "GithubIntegration", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

Aspects.of(app).add(new AwsSolutionsChecks());
Aspects.of(app).add(new ServerlessChecks());
Aspects.of(app).add(new NIST80053R5Checks());
