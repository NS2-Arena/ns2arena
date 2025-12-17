#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { RestApiStack } from "../lib/stacks/rest-api-stack";
import { EcrRepositoryStack } from "../lib/stacks/ecr-repository-stack";
import { NS2ArenaCompute } from "../lib/stacks/compute-stack";
import { ConfigBucketStack } from "../lib/stacks/config-bucket-stack";
import { Variables } from "./variables";
import { DatabaseStack } from "../lib/stacks/database-stack";
import { SSMDependencyTracker } from "../lib/features/ssm-parameter-management/ssm-dependency-tracker";
import { DomainNameStack } from "../lib/stacks/domain-name-stack";
import { CognitoStack } from "../lib/stacks/cognito-stack";
import { CognitoCertStack } from "../lib/stacks/cognito-cert-stack";
import { FrontendStack } from "../lib/stacks/frontend-stack";
import { FrontendCertStack } from "../lib/stacks/frontend-cert-stack";

const app = new App();

const account = Variables.getAccount();

const environment = Variables.getEnvironment();
const regionConfig = Variables.getRegionConfig(app);
const mainRegion = regionConfig.mainRegion;
const computeRegions = regionConfig.computeRegions;
const computeRegionsExceptMain = computeRegions.filter(
  (regionInfo) => regionInfo.value !== mainRegion
);

// Compute regions only
computeRegions.forEach((region) => {
  new ConfigBucketStack(app, `ConfigBucket${region.alias}`, {
    env: {
      account,
      region: region.value,
    },
    stackName: "ConfigBucket",
    serviceName: "ConfigBucket",
    environment,
    mainRegion,
    replicationRegions: computeRegionsExceptMain,
  });

  new EcrRepositoryStack(app, `EcrRepository${region.alias}`, {
    env: {
      account,
      region: region.value,
    },
    stackName: "EcrRepository",
    serviceName: "EcrRepository",
    environment,
    mainRegion,
    replicationRegions: computeRegionsExceptMain.map((region) => region.value),
  });

  new NS2ArenaCompute(app, `Compute${region.alias}`, {
    env: {
      account,
      region: region.value,
    },
    stackName: "Compute",
    serviceName: "Compute",
    environment,
  });
});

// Main region only
new DomainNameStack(app, "DomainNames", {
  env: {
    account,
    region: mainRegion,
  },
  serviceName: "DomainNames",
  environment,
  terminationProtection: true,
});

new DatabaseStack(app, "DatabaseTables", {
  env: {
    account,
    region: mainRegion,
  },
  serviceName: "DatabaseTables",
  environment,
  replicationRegions: computeRegionsExceptMain.map((region) => region.value),
});

new RestApiStack(app, "RestApi", {
  env: {
    account,
    region: mainRegion,
  },
  serviceName: "RestApi",
  environment,
  computeRegions,
});

new CognitoCertStack(app, "CognitoCert", {
  env: {
    account,
    region: "us-east-1",
  },
  serviceName: "Cognito",
  environment,
  mainRegion,
});

new CognitoStack(app, "Cognito", {
  env: {
    account,
    region: mainRegion,
  },
  serviceName: "Cognito",
  environment,
});

new FrontendCertStack(app, "FrontendCert", {
  env: {
    account,
    region: "us-east-1",
  },
  serviceName: "Frontend",
  environment,
  mainRegion,
});

// new FrontendStack(app, "Frontend", {
//   env: {
//     account,
//     region: mainRegion,
//   },
//   serviceName: "Frontend",
//   environment,
// });

// Create lobby step function workflow

SSMDependencyTracker.getInstance().applyStackDependencies();
