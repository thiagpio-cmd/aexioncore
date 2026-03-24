export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (message: string, details?: any) => {
  return new ApiError(400, "BAD_REQUEST", message, details);
};

export const unauthorized = (message: string = "Unauthorized") => {
  return new ApiError(401, "UNAUTHORIZED", message);
};

export const forbidden = (message: string = "Forbidden") => {
  return new ApiError(403, "FORBIDDEN", message);
};

export const notFound = (resource: string = "Resource") => {
  return new ApiError(404, "NOT_FOUND", `${resource} not found`);
};

export const validationError = (message: string, details?: any) => {
  return new ApiError(422, "VALIDATION_ERROR", message, details);
};

export const serverError = (message: string = "Internal server error") => {
  return new ApiError(500, "SERVER_ERROR", message);
};

export const conflictError = (message: string) => {
  return new ApiError(409, "CONFLICT", message);
};
