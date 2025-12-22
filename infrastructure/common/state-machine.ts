import * as aws from "@pulumi/aws";
import { BaseState } from "./state-machine-states";
import * as pulumi from "@pulumi/pulumi";

type IamStatement = aws.types.input.iam.GetPolicyDocumentStatementArgs;

interface CreateDefinitionOutput {
  definition: pulumi.Output<string>;
  statements: IamStatement[];
}

interface CreateDefinitionArgs {
  comment: string;
  states: BaseState[];
  startAt: string;
  queryLanguage?: string;
}

export function createDefinition(
  args: CreateDefinitionArgs
): CreateDefinitionOutput {
  const { startAt, comment, states, queryLanguage } = args;

  const jsonDefinition = pulumi.output({
    StartAt: startAt,
    QueryLanguage: queryLanguage ?? "JSONata",
    Comment: comment,
    States: states.reduce((prev, stateObj) => {
      const state = stateObj.state;
      return {
        ...prev,
        [state.name]: state.stateDefinition,
      };
    }, {}),
  });

  const statements = states
    .filter((stateObj) => stateObj.state.iamStatement !== undefined)
    .map((stateObj) => stateObj.state.iamStatement) as IamStatement[];

  return {
    definition: jsonDefinition.apply((def) => JSON.stringify(def)),
    statements,
  };
}
