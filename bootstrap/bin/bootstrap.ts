#!/usr/bin/env node
import * as cdk from "aws-cdk-lib/core";
import { BootstrapStack } from "../lib/stacks/bootstrap-stack";

const app = new cdk.App();
new BootstrapStack(app, "BootstrapStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
