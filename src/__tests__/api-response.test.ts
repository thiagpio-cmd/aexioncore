import { describe, it, expect } from "vitest";
import { successResponse, errorResponse } from "@/lib/api-response";

describe("API Response Contract", () => {
  describe("successResponse", () => {
    it("wraps data in success envelope", () => {
      const result = successResponse({ id: "1", name: "Test" });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: "1", name: "Test" });
    });

    it("includes pagination when provided", () => {
      const result = successResponse([1, 2, 3], { page: 1, limit: 10, total: 100 });
      expect(result.pagination).toBeDefined();
      expect(result.pagination!.page).toBe(1);
      expect(result.pagination!.pages).toBe(10);
      expect(result.pagination!.total).toBe(100);
    });

    it("calculates pages correctly", () => {
      const result = successResponse([], { page: 1, limit: 25, total: 73 });
      expect(result.pagination!.pages).toBe(3); // ceil(73/25)
    });

    it("omits pagination when not provided", () => {
      const result = successResponse("data");
      expect(result.pagination).toBeUndefined();
    });

    it("handles null data", () => {
      const result = successResponse(null);
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("handles array data", () => {
      const result = successResponse([{ id: 1 }, { id: 2 }]);
      expect(result.data).toHaveLength(2);
    });
  });

  describe("errorResponse", () => {
    it("formats error correctly", () => {
      const result = errorResponse({ code: "NOT_FOUND", message: "Lead not found", statusCode: 404 });
      expect(result.success).toBe(false);
      expect(result.error.code).toBe("NOT_FOUND");
      expect(result.error.message).toBe("Lead not found");
    });

    it("includes details when provided", () => {
      const result = errorResponse({
        code: "VALIDATION",
        message: "Invalid",
        statusCode: 422,
        details: { field: "email", reason: "required" },
      });
      expect(result.error.details).toEqual({ field: "email", reason: "required" });
    });

    it("omits details when not provided", () => {
      const result = errorResponse({ code: "UNAUTHORIZED", message: "Unauthorized", statusCode: 401 });
      expect(result.error.details).toBeUndefined();
    });
  });
});
