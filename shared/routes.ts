import { z } from 'zod';
import { insertLogSchema, logs, insertSettingSchema, settings } from './schema';

export const errorSchemas = {
  internal: z.object({
    message: z.string(),
  }),
};

export const api = {
  logs: {
    list: {
      method: 'GET' as const,
      path: '/api/logs',
      responses: {
        200: z.array(z.custom<typeof logs.$inferSelect>()),
      },
    },
  },
  settings: {
    list: {
      method: 'GET' as const,
      path: '/api/settings',
      responses: {
        200: z.array(z.custom<typeof settings.$inferSelect>()),
      },
    },
    update: {
      method: 'POST' as const,
      path: '/api/settings',
      input: z.object({
        key: z.string(),
        value: z.string(),
      }),
      responses: {
        200: z.custom<typeof settings.$inferSelect>(),
        400: errorSchemas.internal,
      },
    },
  },
  bot: {
    status: {
      method: 'GET' as const,
      path: '/api/bot/status',
      responses: {
        200: z.object({
          status: z.enum(["online", "offline", "connecting"]),
          uptime: z.number().nullable(),
          serverCount: z.number(),
          ping: z.number(),
        }),
      },
    },
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
