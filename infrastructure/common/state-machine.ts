import * as aws from "@pulumi/aws";
import { BaseTask } from "./state-machine-tasks";
import * as pulumi from "@pulumi/pulumi";

type IamStatement = aws.types.input.iam.GetPolicyDocumentStatementArgs;

interface CreateDefinitionOutput {
  definition: pulumi.Output<string>;
  statements: IamStatement[];
}

interface CreateDefinitionArgs {
  comment: string;
  tasks: BaseTask[];
  startAt: string;
  queryLanguage?: string;
}

export function createDefinition(
  args: CreateDefinitionArgs
): CreateDefinitionOutput {
  const { startAt, comment, tasks, queryLanguage } = args;

  const states = tasks.map((task) => task.emit());

  const jsonDefinition = pulumi.output({
    StartAt: startAt,
    QueryLanguage: queryLanguage ?? "JSONata",
    Comment: comment,
    States: states.reduce(
      (prev, curr) => ({
        ...prev,
        [curr.name]: curr.taskDefinition,
      }),
      {}
    ),
  });

  const statements = states.reduce(
    (prev, state) => [...prev, ...state.iamStatements],
    [] as IamStatement[]
  );

  return {
    definition: jsonDefinition.apply((def) => JSON.stringify(def)),
    statements,
  };
}
