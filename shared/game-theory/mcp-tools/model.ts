import { z } from "zod";

import type {
  AddEntityCommand,
  CrudCommand,
  DeleteEntityCommand,
  EntityFor,
  UpdateEntityCommand,
} from "../engine/commands";
import { entityTypeSchema } from "../types/schemas";
import {
  strategicGameSchema,
  formalizationSchema,
  playerSchema,
  gameNodeSchema,
  gameEdgeSchema,
  sourceSchema,
  observationSchema,
  claimSchema,
  inferenceSchema,
  assumptionSchema,
  contradictionSchema,
  derivationEdgeSchema,
  latentFactorSchema,
  crossGameLinkSchema,
  scenarioSchema,
  playbookSchema,
  escalationLadderSchema,
  trustAssessmentSchema,
  eliminatedOutcomeSchema,
  signalClassificationSchema,
  repeatedGamePatternSchema,
  revalidationEventSchema,
  dynamicInconsistencyRiskSchema,
  crossGameConstraintTableSchema,
  centralThesisSchema,
  tailRiskSchema,
} from "../types/schemas";
import {
  entityTypes,
  STORE_KEY,
  type CanonicalStore,
  type EntityType,
} from "../types/canonical";
import type { ModelQueryResult } from "../types/mcp";
import { createEntityPreview } from "../pipeline";
import type { McpServerLike, RuntimeToolContext } from "./context";

const entitySchemas = {
  game: strategicGameSchema,
  formalization: formalizationSchema,
  player: playerSchema,
  game_node: gameNodeSchema,
  game_edge: gameEdgeSchema,
  source: sourceSchema,
  observation: observationSchema,
  claim: claimSchema,
  inference: inferenceSchema,
  assumption: assumptionSchema,
  contradiction: contradictionSchema,
  derivation: derivationEdgeSchema,
  latent_factor: latentFactorSchema,
  cross_game_link: crossGameLinkSchema,
  scenario: scenarioSchema,
  playbook: playbookSchema,
  escalation_ladder: escalationLadderSchema,
  trust_assessment: trustAssessmentSchema,
  eliminated_outcome: eliminatedOutcomeSchema,
  signal_classification: signalClassificationSchema,
  repeated_game_pattern: repeatedGamePatternSchema,
  revalidation_event: revalidationEventSchema,
  dynamic_inconsistency_risk: dynamicInconsistencyRiskSchema,
  cross_game_constraint_table: crossGameConstraintTableSchema,
  central_thesis: centralThesisSchema,
  tail_risk: tailRiskSchema,
} satisfies Record<EntityType, z.ZodTypeAny>;

function createAddCommand<T extends EntityType>(
  entity_type: T,
  entity_id: string,
  payload: Omit<EntityFor<T>, "id">,
): AddEntityCommand<T> {
  return {
    kind: `add_${entity_type}` as AddEntityCommand<T>["kind"],
    id: entity_id,
    payload,
  };
}

function createUpdateCommand<T extends EntityType>(
  entity_type: T,
  entity_id: string,
  payload: Partial<EntityFor<T>>,
): UpdateEntityCommand<T> {
  return {
    kind: `update_${entity_type}` as UpdateEntityCommand<T>["kind"],
    payload: {
      id: entity_id,
      ...payload,
    },
  };
}

function createDeleteCommand<T extends EntityType>(
  entity_type: T,
  entity_id: string,
): DeleteEntityCommand<T> {
  return {
    kind: `delete_${entity_type}` as DeleteEntityCommand<T>["kind"],
    payload: { id: entity_id },
  };
}

function getExistingEntity(
  canonical: CanonicalStore,
  entity_type: EntityType,
  entity_id: string,
): Record<string, unknown> | null {
  const storeKey = STORE_KEY[entity_type];
  return (
    (canonical[storeKey][entity_id] as Record<string, unknown> | undefined) ??
    null
  );
}

function buildCommandForProposal(input: {
  action: "create" | "update" | "delete";
  entity_type: EntityType;
  entity_id: string;
  data: Record<string, unknown>;
  canonical: CanonicalStore;
}): { command: CrudCommand; preview: Record<string, unknown> } {
  const schema = entitySchemas[input.entity_type];
  if (input.action === "create") {
    const parsed = schema.parse({ id: input.entity_id, ...input.data });
    const { id, ...payload } = parsed;
    return {
      command: createAddCommand(input.entity_type, id, payload) as CrudCommand,
      preview: payload,
    };
  }

  if (input.action === "update") {
    const existing = getExistingEntity(
      input.canonical,
      input.entity_type,
      input.entity_id,
    );
    if (!existing) {
      throw new Error(
        `Cannot update missing ${input.entity_type} ${input.entity_id}.`,
      );
    }

    const parsed = schema.parse({
      ...existing,
      ...input.data,
      id: input.entity_id,
    });
    const { id, ...payload } = parsed;
    return {
      command: createUpdateCommand(
        input.entity_type,
        id,
        payload,
      ) as CrudCommand,
      preview: payload,
    };
  }

  return {
    command: createDeleteCommand(
      input.entity_type,
      input.entity_id,
    ) as CrudCommand,
    preview: { id: input.entity_id },
  };
}

export function registerModelTools(
  server: McpServerLike,
  context: RuntimeToolContext,
): void {
  server.registerTool({
    name: "get_model_summary",
    description:
      "Get a structured summary of the current analysis: entity counts by type, phase completion status, and key findings.",
    inputSchema: z.object({}),
    execute(): ModelQueryResult {
      const model = context.getModel();
      const counts = Object.fromEntries(
        entityTypes.map((entityType) => {
          const key = STORE_KEY[entityType];
          return [
            entityType,
            Object.keys(context.getCanonicalStore()[key]).length,
          ];
        }),
      );

      return {
        success: true,
        data: {
          has_model: Boolean(model),
          entity_counts: counts,
          phase_statuses: context.getAllPhaseStatuses(),
        },
      };
    },
  });

  server.registerTool({
    name: "get_entities",
    description: "Read all entities of a given type from the canonical model.",
    inputSchema: z.object({
      entity_type: entityTypeSchema,
      filter: z.record(z.unknown()).optional(),
    }),
    execute(input): ModelQueryResult {
      const entities = [...context.getEntities(input.entity_type)];
      return {
        success: true,
        data: entities,
        entity_count: entities.length,
      };
    },
  });

  server.registerTool({
    name: "get_entity",
    description: "Read a single entity by its ID.",
    inputSchema: z.object({
      entity_id: z.string(),
    }),
    execute(input): ModelQueryResult {
      for (const entityType of entityTypes) {
        const key = STORE_KEY[entityType];
        const entity = context.getCanonicalStore()[key][input.entity_id];
        if (entity) {
          return {
            success: true,
            data: entity,
            entity_count: 1,
          };
        }
      }

      return {
        success: false,
        data: null,
        entity_count: 0,
      };
    },
  });

  server.registerTool({
    name: "propose_entity",
    description:
      "Propose a new entity or modification for user review without directly mutating the canonical model.",
    inputSchema: z.object({
      action: z.enum(["create", "update", "delete"]),
      entity_type: entityTypeSchema,
      entity_id: z.string().optional(),
      data: z.record(z.unknown()),
      rationale: z.string(),
      phase: z.number().optional(),
    }),
    execute(input): ModelQueryResult {
      const proposalId = `proposal_${crypto.randomUUID()}`;
      const entityId =
        input.entity_id ?? `${input.entity_type}_${crypto.randomUUID()}`;
      const { command, preview } = buildCommandForProposal({
        action: input.action,
        entity_type: input.entity_type,
        entity_id: entityId,
        data: input.data,
        canonical: context.getCanonicalStore(),
      });

      context.host.registerProposalGroup({
        phase: input.phase ?? 1,
        content: input.rationale,
        proposals: [
          {
            id: proposalId,
            description: input.rationale,
            phase: input.phase ?? 1,
            phase_execution_id: `phase_execution_${crypto.randomUUID()}`,
            base_revision: context.getPersistedRevision(),
            status: "pending",
            commands: [command],
            entity_previews: [
              createEntityPreview(
                input.entity_type,
                input.action === "create"
                  ? "add"
                  : input.action === "update"
                    ? "update"
                    : "delete",
                input.action === "delete"
                  ? (input.entity_id ?? entityId)
                  : entityId,
                preview,
              ),
            ],
            conflicts: [],
          },
        ],
      });
      context.host.setPipelineProposalReview(
        context.host.getConversationState().proposal_review,
      );

      return {
        success: true,
        data: {
          proposal_id: proposalId,
          entity_id: entityId,
        },
      };
    },
  });
}
