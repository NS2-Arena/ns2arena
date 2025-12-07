import { Environment } from "./environment";

const BASE_DOMAIN_NAME = "ns2arena.com";

export class DomainNames {
  private static getBaseDomainName(env: Environment) {
    if (env === "prod") return BASE_DOMAIN_NAME;
    return "".concat(env, ".", BASE_DOMAIN_NAME);
  }

  public static getDomainName(env: Environment, ...subdomains: string[]) {
    const base = DomainNames.getBaseDomainName(env);
    if (subdomains.length === 0) return base;

    return subdomains.join(".").concat(".", base);
  }
}
