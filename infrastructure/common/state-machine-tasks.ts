import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

type IamStatement = aws.types.input.iam.GetPolicyDocumentStatementArgs;

interface State {
  name: string;
  taskDefinition: Object;
  iamStatements: IamStatement[];
}

type BaseTaskArgs = {
  name: string;
};

type Chain = { next: string } | { end: true };
type IChainable = {
  chain: Chain;
};
interface RetryPolicy {
  ErrorEquals: string[];
  IntervalSeconds: number;
  MaxAttempts: number;
  BackoffRate: number;
}
type Retry = false | RetryPolicy[] | undefined;
type IRetryable = {
  retry?: Retry;
};

type Assign =
  | {
      [key: string]: Assign | string;
    }
  | undefined;
type IAssignable = {
  assign?: Assign;
};

type Output = { [key: string]: string } | undefined;
type IOutputable = {
  output?: Output;
};

type IntegrationPattern =
  | "RUN_JOB"
  | "WAIT_FOR_TASK_TOKEN"
  | "REQUEST_RESPONSE"
  | undefined;
type IIntegrationPattern = {
  integrationPattern?: IntegrationPattern;
};

export abstract class BaseTask<T extends BaseTaskArgs = BaseTaskArgs> {
  protected readonly args: T;

  constructor(args: T) {
    this.args = args;
  }

  public emit(): State {
    const { name } = this.args;

    return {
      name,
      taskDefinition: this.emitFullDefinition(),
      iamStatements: this.emitStatements(),
    };
  }

  private emitFullDefinition(): Object {
    return {
      ...this.emitDefinition(),
      ...this.emitRetryPolicy(),
      ...this.emitAssign(),
      ...this.emitOutput(),
      ...this.emitChain(),
      ...this.emitResource(),
    };
  }

  private emitResource(): Object {
    const baseResource = this.emitBaseResource();

    if (baseResource === "") return {};

    if (!("integrationPattern" in this.args))
      return {
        Resource: baseResource,
      };

    const pattern = this.args.integrationPattern as IntegrationPattern;

    return {
      Resource: this.getFullResourceArn(baseResource, pattern),
    };
  }

  private getFullResourceArn(
    baseResource: string,
    pattern: IntegrationPattern,
  ) {
    if (pattern === "RUN_JOB") return baseResource;
    else if (pattern === "REQUEST_RESPONSE") return `${baseResource}.sync`;
    else if (pattern === "WAIT_FOR_TASK_TOKEN")
      return `${baseResource}.waitForTaskToken`;

    throw Error("Invalid IntegrationPattern");
  }

  private emitRetryPolicy(): Object {
    if (!("retry" in this.args)) {
      return {};
    }

    const retry = this.args.retry as Retry;

    if (retry === undefined)
      return {
        Retry: this.emitDefaultRetryPolicy(),
      };

    if (typeof retry === "boolean") {
      if (retry === false) return {};
      return {
        Retry: this.emitDefaultRetryPolicy(),
      };
    }

    return {
      Retry: retry,
    };
  }

  private emitAssign(): Object {
    if (!("assign" in this.args)) {
      return {};
    }

    const assign = this.args.assign as Assign;

    if (assign === undefined) return {};

    return {
      Assign: assign,
    };
  }

  private emitChain(): Object {
    if (!("chain" in this.args)) {
      return {};
    }

    const chain = this.args.chain as Chain;

    if ("next" in chain) {
      return {
        Next: chain.next,
      };
    }

    return {
      End: chain.end,
    };
  }

  private emitOutput(): Object {
    if (!("output" in this.args)) return {};

    const output = this.args.output as Output;
    if (output === undefined) return {};

    return {
      Output: output,
    };
  }

  protected abstract emitBaseResource(): string;
  protected abstract emitDefinition(): Object;
  protected emitStatements(): IamStatement[] {
    return [];
  }
  protected emitDefaultRetryPolicy(): RetryPolicy[] {
    return [];
  }
}

// ========================
// PassState
// ========================
type PassArgs = BaseTaskArgs & IChainable & IAssignable & IOutputable;
export class Pass extends BaseTask<PassArgs> {
  protected emitBaseResource(): string {
    return "";
  }

  protected emitDefinition(): Object {
    return {
      Type: "Pass",
    };
  }
}

// ========================
// InvokeLambda
// ========================
interface InvokeLambdaArgs
  extends
    BaseTaskArgs,
    IRetryable,
    IAssignable,
    IChainable,
    IOutputable,
    IIntegrationPattern {
  lambda: aws.lambda.Function;
  payload?: Object;
}

export class InvokeLambda extends BaseTask<InvokeLambdaArgs> {
  protected emitBaseResource(): string {
    return "arn:aws:states:::lambda:invoke";
  }

  protected emitDefinition(): Object {
    const { lambda, payload } = this.args;

    return {
      Type: "Task",
      Arguments: {
        FunctionName: lambda.name,
        Payload: payload,
      },
    };
  }

  protected emitStatements(): IamStatement[] {
    return [
      {
        actions: ["lambda:InvokeFunction"],
        resources: [this.args.lambda.arn],
        effect: "Allow",
      },
    ];
  }

  protected emitDefaultRetryPolicy(): RetryPolicy[] {
    return [
      {
        ErrorEquals: [
          "Lambda.ClientExecutionTimeoutException",
          "Lambda.ServiceException",
          "Lambda.AWSLambdaException",
          "Lambda.SdkClientException",
        ],
        IntervalSeconds: 2,
        MaxAttempts: 6,
        BackoffRate: 2,
      },
    ];
  }
}

// ========================
// RunInstance
// ========================

interface RunInstanceArgs
  extends
    BaseTaskArgs,
    IChainable,
    IAssignable,
    IRetryable,
    IOutputable,
    IIntegrationPattern {
  maxCount: 1;
  minCount: 1;
  launchTemplate: aws.ec2.LaunchTemplate;
  iamInstanceProfileRole: aws.iam.Role;
  securityGroup: aws.ec2.SecurityGroup;
}
export class RunInstance extends BaseTask<RunInstanceArgs> {
  protected emitBaseResource(): string {
    return "arn:aws:states:::aws-sdk:ec2:runInstances";
  }

  protected emitDefinition(): Object {
    const { maxCount, minCount, launchTemplate } = this.args;

    return {
      Type: "Task",
      Arguments: {
        MaxCount: minCount,
        MinCount: maxCount,
        LaunchTemplate: {
          LaunchTemplateId: launchTemplate.id,
          Version: "$Latest",
        },
      },
    };
  }

  protected emitStatements(): IamStatement[] {
    const region = aws.getRegionOutput({}).region;
    const accountNumber = aws.getCallerIdentityOutput({}).accountId;

    return [
      {
        actions: ["iam:PassRole"],
        resources: [this.args.iamInstanceProfileRole.arn],
        effect: aws.iam.PolicyStatementEffect.ALLOW,
      },
      {
        actions: [
          "ec2:CreateTags",
          "ec2:DescribeInstances",
          "ec2:StartInstances",
        ],
        resources: [
          pulumi
            .all([region, accountNumber])
            .apply(
              ([region, accountNumber]) =>
                `arn:aws:ec2:${region}:${accountNumber}:instance/*`,
            ),
        ],
        effect: aws.iam.PolicyStatementEffect.ALLOW,
      },
      {
        actions: ["ec2:RunInstances"],
        resources: pulumi
          .all([
            region,
            accountNumber,
            this.args.launchTemplate.arn,
            this.args.securityGroup.arn,
          ])
          .apply(
            ([region, accountNumber, launchTemplateArn, securityGroupArn]) => [
              `arn:aws:ec2:${region}:${accountNumber}:instance/*`,
              `arn:aws:ec2:${region}:${accountNumber}:network-interface/*`,
              `arn:aws:ec2:${region}:${accountNumber}:subnet/*`,
              `arn:aws:ec2:${region}:${accountNumber}:volume/*`,
              `arn:aws:ec2:${region}::image/*`,
              launchTemplateArn,
              securityGroupArn,
            ],
          ),
        effect: aws.iam.PolicyStatementEffect.ALLOW,
      },
      {
        actions: ["ec2:CreateTags"],
        resources: [
          pulumi
            .all([region, accountNumber])
            .apply(
              ([region, accountNumber]) =>
                `arn:aws:ec2:${region}:${accountNumber}:volume/*`,
            ),
        ],
        effect: aws.iam.PolicyStatementEffect.ALLOW,
      },
    ];
  }
}

// ========================
// Wait
// ========================

interface WaitArgs extends BaseTaskArgs, IChainable, IAssignable, IOutputable {
  seconds: number;
}
export class Wait extends BaseTask<WaitArgs> {
  protected emitBaseResource(): string {
    return "";
  }

  protected emitDefinition(): Object {
    return {
      Type: "Wait",
      Seconds: this.args.seconds,
    };
  }
}

// ========================
// ListContainerInstances
// ========================

interface ListContainerInstancesArgs
  extends
    BaseTaskArgs,
    IChainable,
    IRetryable,
    IAssignable,
    IOutputable,
    IIntegrationPattern {
  cluster: aws.ecs.Cluster;
  filter?: string;
}
export class ListContainerInstances extends BaseTask<ListContainerInstancesArgs> {
  protected emitBaseResource(): string {
    return "arn:aws:states:::aws-sdk:ecs:listContainerInstances";
  }

  protected emitDefinition(): Object {
    return {
      Type: "Task",
      Arguments: {
        Cluster: this.args.cluster.arn,
        Filter: this.args.filter,
      },
    };
  }

  protected emitStatements(): IamStatement[] {
    return [
      {
        actions: ["ecs:ListContainerInstances"],
        resources: [this.args.cluster.arn],
        effect: aws.iam.PolicyStatementEffect.ALLOW,
      },
    ];
  }
}

// ========================
// Choice
// ========================

type ChoiceCondition = {
  Condition: string;
  Next: string;
};
interface ChoiceArgs extends BaseTaskArgs {
  default: string;
  choices: ChoiceCondition[];
}
export class Choice extends BaseTask<ChoiceArgs> {
  protected emitBaseResource(): string {
    return "";
  }

  protected emitDefinition(): Object {
    return {
      Type: "Choice",
      Choices: this.args.choices,
      Default: this.args.default,
    };
  }
}

// ========================
// ECS::RunTask
// ========================

interface RunTaskArgs
  extends
    BaseTaskArgs,
    IChainable,
    IRetryable,
    IAssignable,
    IOutputable,
    IIntegrationPattern {
  cluster: aws.ecs.Cluster;
  taskDefinition: aws.ecs.TaskDefinition;
  overrides?: {
    ContainerOverrides?: {
      Name: string;
      Environment: {
        Name: string;
        Value: string;
      }[];
    }[];
  };
  propagateTags: "TASK_DEFINITION";
  launchType: "EC2" | "FARGATE";
  placementConstraints: { Type: string; Expression: string }[];
}
export class RunTask extends BaseTask<RunTaskArgs> {
  protected emitBaseResource(): string {
    return "arn:aws:states:::ecs:runTask";
  }

  protected emitDefinition(): Object {
    return {
      Type: "Task",
      Arguments: {
        Cluster: this.args.cluster.arn,
        TaskDefinition: this.args.taskDefinition.id,
        Overrides: this.args.overrides,
        PropagateTags: this.args.propagateTags,
        LaunchType: this.args.launchType,
        PlacementConstraints: this.args.placementConstraints,
      },
    };
  }

  protected emitStatements(): IamStatement[] {
    return [
      {
        actions: ["ecs:RunTask"],
        resources: [this.args.taskDefinition.arn],
        effect: aws.iam.PolicyStatementEffect.ALLOW,
      },
    ];
  }
}
