/**
 * Structured Logger — production-ready observability
 *
 * All API routes should use this instead of console.log/error.
 * In production, pipe output to Datadog/CloudWatch/Sentry.
 */

import { randomUUID } from "crypto";

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogPayload {
  event: string;
  requestId?: string;
  userId?: string;
  organizationId?: string;
  entityId?: string;
  entityType?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  error?: any;
  [key: string]: any;
}

/** Generate a short request ID for tracing */
export function generateRequestId(): string {
  return randomUUID().slice(0, 8);
}

export const logger = {
  info: (payload: LogPayload) => log("info", payload),
  warn: (payload: LogPayload) => log("warn", payload),
  error: (payload: LogPayload) => log("error", payload),
  debug: (payload: LogPayload) => {
    if (process.env.NODE_ENV === "development") log("debug", payload);
  },
};

function log(level: LogLevel, payload: LogPayload) {
  const timestamp = new Date().toISOString();

  const entry: Record<string, any> = {
    timestamp,
    level,
    event: payload.event,
  };

  // Add optional fields only if present (keeps logs clean)
  if (payload.requestId) entry.rid = payload.requestId;
  if (payload.route) entry.route = payload.route;
  if (payload.method) entry.method = payload.method;
  if (payload.statusCode) entry.status = payload.statusCode;
  if (payload.durationMs) entry.ms = payload.durationMs;
  if (payload.userId) entry.uid = payload.userId;
  if (payload.organizationId) entry.oid = payload.organizationId;
  if (payload.entityId) entry.eid = payload.entityId;
  if (payload.entityType) entry.etype = payload.entityType;

  // Error serialization
  if (payload.error) {
    entry.error = {
      message: payload.error.message || String(payload.error),
      name: payload.error.name,
      ...(process.env.NODE_ENV === "development" && { stack: payload.error.stack }),
    };
  }

  // Add any extra fields
  const { event, requestId, userId, organizationId, entityId, entityType, route, method, statusCode, durationMs, error: _e, ...extra } = payload;
  if (Object.keys(extra).length > 0) entry.meta = extra;

  const output = JSON.stringify(entry);

  switch (level) {
    case "error": console.error(output); break;
    case "warn": console.warn(output); break;
    case "debug": console.debug(output); break;
    default: console.info(output);
  }
}
