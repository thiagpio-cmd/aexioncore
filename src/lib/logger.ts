type LogLevel = "info" | "warn" | "error";

interface LogPayload {
  event: string;
  userId?: string;
  organizationId?: string;
  entityId?: string;
  entityType?: string;
  error?: any;
  [key: string]: any;
}

export const logger = {
  info: (payload: LogPayload) => log("info", payload),
  warn: (payload: LogPayload) => log("warn", payload),
  error: (payload: LogPayload) => log("error", payload),
};

function log(level: LogLevel, payload: LogPayload) {
  const timestamp = new Date().toISOString();
  let errorObj = undefined;
  
  if (payload.error) {
    errorObj = {
      message: payload.error.message || String(payload.error),
      name: payload.error.name,
      stack: payload.error.stack,
    };
  }

  const structuredLog = {
    timestamp,
    level,
    ...payload,
    error: errorObj,
  };

  // In production, this would pipe to Datadog/CloudWatch
  if (level === "error") {
    console.error(JSON.stringify(structuredLog));
  } else if (level === "warn") {
    console.warn(JSON.stringify(structuredLog));
  } else {
    console.info(JSON.stringify(structuredLog));
  }
}
