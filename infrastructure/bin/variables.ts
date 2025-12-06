import { App } from "aws-cdk-lib";

import { Environment } from "@ns2-arena/common";

export interface RegionInfo {
  value: string;
  alias: string;
}

interface RegionConfig {
  mainRegion: string;
  computeRegions: RegionInfo[];
}

type EnvironmentConfig = {
  [key in Environment]: {
    regionConfig: RegionConfig;
  };
};

export abstract class Variables {
  public static getEnvironment(): Environment {
    return (process.env.TARGET_ENVIRONMENT as Environment) ?? "staging";
  }

  public static getAccount(): string {
    return process.env.CDK_DEFAULT_ACCOUNT!;
  }

  public static getRegionConfig(app: App): RegionConfig {
    const envs = app.node.tryGetContext("envs") as EnvironmentConfig;
    const environment = Variables.getEnvironment();

    if (!(environment in envs))
      throw new Error(`No region config for environment "${environment}`);

    const config = envs[environment].regionConfig;
    const computeContainsMain = config.computeRegions.some(
      (region) => region.value === config.mainRegion
    );

    if (!computeContainsMain)
      throw new Error("Main region must also be a compute region");

    return config;
  }
}
