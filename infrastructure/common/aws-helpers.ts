interface GenerateArnArgs {
  partition?: string;
  service: string;
  region?: string;
  accountId?: string;
  resource: string;
  resourceName?: string;
}

function getValue<T>(value: T | undefined, defaultValue: T): T {
  if (value === undefined) return defaultValue;
  return value;
}

export function generateArn(args: GenerateArnArgs): string {
  const { service, resource } = args;

  const partition = getValue(args.partition, "aws");
  const region = getValue(args.region, "");
  const accountId = getValue(args.accountId, "");

  const baseArn = `arn:${partition}:${service}:${region}:${accountId}:${resource}`;

  if (args.resourceName === undefined) return baseArn;

  return `${baseArn}/${args.resourceName}`;
}
