import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { readTrackerData } from '@/lib/tracker-data';
import {
  addOneTimeIncome,
  addPocketExpenses,
  addRecurringExpense,
  addSavingsGoal,
  setRecurringExpenseAmounts,
} from '@/lib/tracker-operations';

const dateSchema: z.ZodType<string> = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthSchema: z.ZodType<string> = z.string().regex(/^\d{4}-\d{2}$/);

type AddPocketExpensesInput = {
  expenses: Array<{ date: string; label: string; amount: number }>;
};

type AddRecurringExpenseInput = {
  label: string;
  amount: number;
  dayOfMonth: number;
  startDate: string;
  endMonth?: string | null;
  prorateFirstMonth?: boolean;
  deductFromPocket?: boolean;
  deductIncomeSourceId?: string;
};

type AddSavingsGoalInput = {
  name: string;
  startDate: string;
  endDate?: string;
  lineItems: Array<{ label: string; amount: number }>;
  pauseIncome?: boolean;
  incomeResumeDate?: string;
  pausePocket?: boolean;
  pausedExpenseIds?: string[];
};

type AddOneTimeIncomeInput = {
  date: string;
  label: string;
  amount: number;
};

type SetRecurringExpenseAmountsInput = {
  recurringExpenseId: string;
  amounts: Array<{ scheduledDate: string; amount: number }>;
};

type ToolExtra = { authInfo?: AuthInfo };

type RegisterTool = (
  name: string,
  config: {
    title?: string;
    description?: string;
    inputSchema?: z.ZodTypeAny;
    outputSchema?: z.ZodTypeAny;
    annotations?: Record<string, boolean>;
    _meta?: Record<string, unknown>;
  },
  callback: (args: unknown, extra: ToolExtra) => unknown,
) => unknown;

const trackerOutputSchema = z.object({
  tracker: z.unknown(),
});
const mutationOutputSchema = z.object({
  activeBranchId: z.string().nullable(),
  activeBranchName: z.string(),
  value: z.unknown(),
});
const addPocketExpensesInputSchema: z.ZodType<AddPocketExpensesInput> =
  z.object({
    expenses: z
      .array(
        z.object({
          date: dateSchema,
          label: z.string().trim().min(1),
          amount: z.number().finite().positive(),
        }),
      )
      .min(1)
      .max(50),
  });
const addRecurringExpenseInputSchema: z.ZodType<AddRecurringExpenseInput> =
  z.object({
    label: z.string().trim().min(1),
    amount: z.number().finite().positive(),
    dayOfMonth: z.number().int().min(0).max(31),
    startDate: dateSchema,
    endMonth: monthSchema.nullable().optional(),
    prorateFirstMonth: z.boolean().optional(),
    deductFromPocket: z.boolean().optional(),
    deductIncomeSourceId: z.string().min(1).optional(),
  });
const addSavingsGoalInputSchema: z.ZodType<AddSavingsGoalInput> = z.object({
  name: z.string().trim().min(1),
  startDate: dateSchema,
  endDate: dateSchema.optional(),
  lineItems: z
    .array(
      z.object({
        label: z.string().trim().min(1),
        amount: z.number().finite().positive(),
      }),
    )
    .min(1)
    .max(50),
  pauseIncome: z.boolean().optional(),
  incomeResumeDate: dateSchema.optional(),
  pausePocket: z.boolean().optional(),
  pausedExpenseIds: z.array(z.string().min(1)).optional(),
});
const addOneTimeIncomeInputSchema: z.ZodType<AddOneTimeIncomeInput> = z.object({
  date: dateSchema,
  label: z.string().trim().min(1),
  amount: z.number().finite().positive(),
});
const setRecurringExpenseAmountsInputSchema: z.ZodType<SetRecurringExpenseAmountsInput> =
  z.object({
    recurringExpenseId: z.string().min(1),
    amounts: z
      .array(
        z.object({
          scheduledDate: dateSchema,
          amount: z.number().finite().nonnegative(),
        }),
      )
      .min(1)
      .max(60),
  });

const oauthMeta = (scopes: string[]) => ({
  securitySchemes: [{ type: 'oauth2', scopes }],
});

type ToolListMessage = {
  result?: {
    tools?: Array<{
      securitySchemes?: unknown;
      _meta?: Record<string, unknown>;
    }>;
  };
};

export const mirrorToolSecuritySchemes = (payload: unknown) => {
  const messages = (
    Array.isArray(payload) ? payload : [payload]
  ) as ToolListMessage[];
  for (const message of messages) {
    for (const tool of message.result?.tools ?? []) {
      if (tool._meta?.securitySchemes) {
        tool.securitySchemes = tool._meta.securitySchemes;
      }
    }
  }
  return payload;
};

const authError = (resourceMetadataUrl: string) => ({
  content: [
    {
      type: 'text' as const,
      text: 'Sign in to Finance Tracker to use this tool.',
    },
  ],
  _meta: {
    'mcp/www_authenticate': [
      `Bearer resource_metadata="${resourceMetadataUrl}", error="insufficient_scope", error_description="Sign in to Finance Tracker to continue"`,
    ],
  },
  isError: true,
});

const result = (value: Record<string, unknown>, text: string) => ({
  structuredContent: value,
  content: [{ type: 'text' as const, text }],
});

const run = async (
  action: () => Promise<Record<string, unknown>>,
  success: string,
) => {
  try {
    return result(await action(), success);
  } catch (error) {
    return {
      content: [
        {
          type: 'text' as const,
          text:
            error instanceof Error
              ? error.message
              : 'Finance Tracker request failed',
        },
      ],
      isError: true,
    };
  }
};

const getUserId = (authInfo: AuthInfo | undefined) => {
  const userId = authInfo?.extra?.userId;
  return typeof userId === 'string' ? userId : null;
};

const runAuthenticated = (
  authInfo: AuthInfo | undefined,
  scope: string,
  resourceMetadataUrl: string,
  action: (userId: string) => Promise<Record<string, unknown>>,
  success: string,
) => {
  const userId = getUserId(authInfo);
  return userId && authInfo?.scopes.includes(scope)
    ? run(() => action(userId), success)
    : authError(resourceMetadataUrl);
};

export const createTrackerMcpServer = (resourceMetadataUrl: string) => {
  const server = new McpServer(
    { name: 'finance-tracker', version: '1.0.0' },
    {
      instructions:
        "Use Finance Tracker only to read and modify the authenticated user's cloud budget. Never ask for or infer a user or account ID. The server selects the account from OAuth. Use write tools only for changes the user explicitly requests.",
    },
  );
  const registerTool = server.registerTool.bind(
    server,
  ) as unknown as RegisterTool;

  registerTool(
    'get_tracker',
    {
      title: 'Read finance tracker',
      description:
        "Use this before answering questions about the user's finances. Returns every stored field in the signed-in account's cloud tracker, including all branches, pocket expenses, savings inputs, goals, recurring expenses, income sources, one-time income, and overrides.",
      inputSchema: z.object({}),
      outputSchema: trackerOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: oauthMeta(['tracker:read']),
    },
    async (_, extra) =>
      runAuthenticated(
        extra.authInfo,
        'tracker:read',
        resourceMetadataUrl,
        async (userId) => ({ tracker: await readTrackerData(userId) }),
        'Read the complete finance tracker.',
      ),
  );

  registerTool(
    'add_pocket_expenses',
    {
      title: 'Add pocket expenses',
      description:
        "Use this only when the user explicitly says they spent money, purchased something, or asks to log pocket spending. Adds one or more dated expenses to the signed-in account's active branch.",
      inputSchema: addPocketExpensesInputSchema,
      outputSchema: mutationOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: oauthMeta(['tracker:write']),
    },
    async (args, extra) => {
      const { expenses } = addPocketExpensesInputSchema.parse(args);
      return runAuthenticated(
        extra.authInfo,
        'tracker:write',
        resourceMetadataUrl,
        (userId) => addPocketExpenses(userId, expenses),
        'Added the pocket expenses.',
      );
    },
  );

  registerTool(
    'add_recurring_expense',
    {
      title: 'Add recurring expense',
      description:
        "Use this when the user explicitly asks to set up a recurring expense. Adds it to the signed-in account's active branch. A dayOfMonth of 0 means the last day of each month.",
      inputSchema: addRecurringExpenseInputSchema,
      outputSchema: mutationOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: oauthMeta(['tracker:write']),
    },
    async (args, extra) => {
      const input = addRecurringExpenseInputSchema.parse(args);
      return runAuthenticated(
        extra.authInfo,
        'tracker:write',
        resourceMetadataUrl,
        (userId) =>
          addRecurringExpense(userId, {
            ...input,
            endMonth: input.endMonth ?? null,
            occurrenceOverrides: [],
            deductFromPocket: input.deductFromPocket ?? false,
          }),
        'Added the recurring expense.',
      );
    },
  );

  registerTool(
    'add_savings_goal',
    {
      title: 'Add savings goal',
      description:
        "Use this only when the user explicitly asks to create a savings goal. Adds the goal and its cost breakdown to the signed-in account's active branch.",
      inputSchema: addSavingsGoalInputSchema,
      outputSchema: mutationOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: oauthMeta(['tracker:write']),
    },
    async (args, extra) => {
      const input = addSavingsGoalInputSchema.parse(args);
      return runAuthenticated(
        extra.authInfo,
        'tracker:write',
        resourceMetadataUrl,
        (userId) =>
          addSavingsGoal(userId, {
            ...input,
            endDate: input.endDate ?? input.startDate,
            pauseIncome: input.pauseIncome ?? false,
            pausePocket: input.pausePocket ?? false,
            pausedExpenseIds: input.pausedExpenseIds ?? [],
          }),
        'Added the savings goal.',
      );
    },
  );

  registerTool(
    'add_one_time_income',
    {
      title: 'Add one-time income',
      description:
        "Use this only when the user explicitly says they received or will receive one-time income and asks to add it to the signed-in account's active branch.",
      inputSchema: addOneTimeIncomeInputSchema,
      outputSchema: mutationOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      _meta: oauthMeta(['tracker:write']),
    },
    async (args, extra) => {
      const input = addOneTimeIncomeInputSchema.parse(args);
      return runAuthenticated(
        extra.authInfo,
        'tracker:write',
        resourceMetadataUrl,
        (userId) => addOneTimeIncome(userId, input),
        'Added the one-time income.',
      );
    },
  );

  registerTool(
    'set_recurring_expense_amounts',
    {
      title: 'Set recurring expense amounts',
      description:
        'Use get_tracker first to identify the recurring expense ID and exact scheduled dates. Sets the price for one or more dates without changing other occurrence overrides.',
      inputSchema: setRecurringExpenseAmountsInputSchema,
      outputSchema: mutationOutputSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: oauthMeta(['tracker:write']),
    },
    async (args, extra) => {
      const { recurringExpenseId, amounts } =
        setRecurringExpenseAmountsInputSchema.parse(args);
      return runAuthenticated(
        extra.authInfo,
        'tracker:write',
        resourceMetadataUrl,
        (userId) =>
          setRecurringExpenseAmounts(userId, recurringExpenseId, amounts),
        'Updated the recurring expense amounts.',
      );
    },
  );

  return server;
};
