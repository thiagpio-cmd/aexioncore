import { NextResponse } from "next/server";
import { ApiError } from "./errors";

export interface ApiResponseSuccess<T> {
  success: true;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiResponseError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}

export type ApiResponse<T> = ApiResponseSuccess<T> | ApiResponseError;

export const successResponse = <T>(
  data: T,
  pagination?: { page: number; limit: number; total: number }
): ApiResponseSuccess<T> => {
  const response: ApiResponseSuccess<T> = {
    success: true,
    data,
  };

  if (pagination) {
    response.pagination = {
      ...pagination,
      pages: Math.ceil(pagination.total / pagination.limit),
    };
  }

  return response;
};

export const errorResponse = (error: ApiError): ApiResponseError => {
  return {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      ...(error.details && { details: error.details }),
    },
  };
};

export const sendSuccess = <T>(
  data: T,
  statusCode: number = 200,
  pagination?: { page: number; limit: number; total: number }
) => {
  return NextResponse.json(successResponse(data, pagination), {
    status: statusCode,
  });
};

export const sendError = (error: ApiError) => {
  return NextResponse.json(errorResponse(error), {
    status: error.statusCode,
  });
};

export const sendUnhandledError = () => {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    },
    { status: 500 }
  );
};
