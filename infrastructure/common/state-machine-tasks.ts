import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { generateArn } from "./aws-helpers";

type IamStatement = aws.types.input.iam.GetPolicyDocumentStatementArgs;

interface State {
  name: string;
  taskDefinition: Object;
  iamStatements: IamStatement[];
}

interface RetryPolicy {
  ErrorEquals: string[];
  IntervalSeconds: number;
  MaxAttempts: number;
  BackoffRate: number;
}

type BaseTaskArgs = {
  name: string;
};

type Chain = { next: string } | { end: true };
type IChainable = {
  chain: Chain;
};

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
      ...this.emitChain(),
    };
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
type PassArgs = BaseTaskArgs & IChainable & IAssignable;
export class Pass extends BaseTask<PassArgs> {
  protected emitDefinition(): Object {
    return {
      Type: "Pass",
    };
  }

  protected emitStatement(): IamStatement | undefined {
    return undefined;
  }
}

// ========================
// InvokeLambda
// ========================
interface InvokeLambdaArgs
  extends BaseTaskArgs,
    IRetryable,
    IAssignable,
    IChainable {
  lambda: aws.lambda.Function;
  payload?: Object;
}

export class InvokeLambda extends BaseTask<InvokeLambdaArgs> {
  protected emitDefinition(): Object {
    const { lambda, payload } = this.args;

    return {
      Type: "Task",
      Arguments: {
        FunctionName: lambda.name,
        Payload: payload,
      },
      Resource: "arn:aws:states:::lambda:invoke",
    };
  }

  protected emitStatement(): IamStatement | undefined {
    return {
      actions: ["lambda:InvokeFunction"],
      resources: [this.args.lambda.arn],
      effect: "Allow",
    };
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
  extends BaseTaskArgs,
    IChainable,
    IAssignable,
    IRetryable {
  maxCount: 1;
  minCount: 1;
  launchTemplate: aws.ec2.LaunchTemplate;
  iamInstanceProfile: aws.iam.InstanceProfile;
  securityGroup: aws.ec2.SecurityGroup;
}
export class RunInstance extends BaseTask<RunInstanceArgs> {
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
      Resource: "arn:aws:states:::aws-sdk:ec2:runInstances",
    };
  }

  protected emitStatements(): IamStatement[] {
    const region = aws.getRegionOutput({}).region;
    const accountNumber = aws.getCallerIdentityOutput({}).accountId;

    return [
      {
        actions: ["iam:PassRole"],
        resources: [this.args.iamInstanceProfile.arn],
        effect: aws.iam.PolicyStatementEffect.ALLOW,
      },
      {
        actions: [
          "ec2:CreateTags",
          "ec2:DescribeInstances",
          "ec2:StartInstances",
        ],
        resources: [`arn:aws:${region}:${accountNumber}:instance/*`],
        effect: aws.iam.PolicyStatementEffect.ALLOW,
      },
      {
        actions: ["ec2:RunInstances"],
        resources: [
          `arn:aws:${region}:${accountNumber}:instance/*`,
          `arn:aws:${region}:${accountNumber}:network-interface/*`,
          `arn:aws:${region}:${accountNumber}:subnet/*`,
          `arn:aws:${region}:${accountNumber}:volume/*`,
          `arn:aws:${region}::image/*`,
          this.args.launchTemplate.arn,
          this.args.securityGroup.arn,
        ],
        effect: aws.iam.PolicyStatementEffect.ALLOW,
      },
      {
        actions: ["ec2:CreateTags"],
        resources: [`arn:aws:ec2:${region}:${accountNumber}:volume/*`],
        effect: aws.iam.PolicyStatementEffect.ALLOW,
      },
    ];
  }
}
