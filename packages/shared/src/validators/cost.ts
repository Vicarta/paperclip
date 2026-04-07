import { z } from "zod";

export const createCostEventSchema = z
  .object({
    agentId: z.string().uuid(),
    issueId: z.string().uuid().optional().nullable(),
    projectId: z.string().uuid().optional().nullable(),
    goalId: z.string().uuid().optional().nullable(),
    billingCode: z.string().optional().nullable(),
    provider: z.string().min(1),
    model: z.string().min(1),
    inputTokens: z.number().int().nonnegative().optional().default(0),
    outputTokens: z.number().int().nonnegative().optional().default(0),
    costUsd: z.number().nonnegative().optional(),
    // Deprecated compatibility path for older plugin/reporting callers.
    costCents: z.number().int().nonnegative().optional(),
    occurredAt: z.string().datetime(),
  })
  .superRefine((value, ctx) => {
    if (value.costUsd == null && value.costCents == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["costUsd"],
        message: "costUsd is required",
      });
    }
  })
  .transform(({ costCents, costUsd, ...rest }) => ({
    ...rest,
    costUsd: costUsd ?? (costCents != null ? costCents / 100 : 0),
  }));

export type CreateCostEvent = z.infer<typeof createCostEventSchema>;

export const updateBudgetSchema = z.object({
  budgetMonthlyUsd: z.number().nonnegative(),
});

export type UpdateBudget = z.infer<typeof updateBudgetSchema>;
