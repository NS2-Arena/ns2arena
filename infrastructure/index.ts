import * as pulumi from "@pulumi/pulumi";
import { ConfigStores } from "./components/server-configs/config-store";
import { EcrRepositories } from "./components/ns2-server/ecr-repositories";
import { NS2ServerCompute } from "./components/ns2-server/ns2-server-compute";

const stack = pulumi.getStack(); // staging/prod
const config = new pulumi.Config();
const mainRegion = config.require("mainRegion");
const computeRegions = config.requireObject<string[]>("computeRegions");
const computeRegionsExceptMain = computeRegions.filter(
  (region) => region !== mainRegion
);

const configStores = new ConfigStores("config-stores", {
  mainRegion,
  computeRegions,
  replicationRegions: computeRegionsExceptMain,
});

const repo = new EcrRepositories("ecr-repositories", {
  computeRegions: computeRegions,
  replicationRegions: computeRegionsExceptMain,
});

new NS2ServerCompute("ns2-server-compute", {
  computeRegions,
  repositories: repo.repositories,
  configStores: configStores.stores,
});
