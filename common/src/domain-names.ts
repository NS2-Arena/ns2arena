import { Environment } from "./environment";

const BASE_DOMAIN_NAME = "ns2arena.com";

export class SubDomains {
  public static Api = "api";
  public static Auth = "auth";
}

export class DomainNames {
  private static getBaseDomainName(env: Environment) {
    if (env === "prod") return BASE_DOMAIN_NAME;
    return "".concat(env, ".", BASE_DOMAIN_NAME);
  }

  public static getDomainName(env: Environment, subdomain?: string) {
    const base = DomainNames.getBaseDomainName(env);
    if (subdomain === undefined) return base;

    return subdomain.concat(".", base);
  }
}
