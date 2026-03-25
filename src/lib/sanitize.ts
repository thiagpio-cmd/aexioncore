/**
 * Input sanitization utilities for preventing XSS and injection attacks.
 *
 * Use these functions to sanitize user input before storing or rendering.
 */

// ─── HTML Entity Map ────────────────────────────────────────────────────────

const HTML_ENTITIES: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
  "&": "&amp;",
};

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Strip HTML tags and encode dangerous characters to prevent XSS.
 *
 * @param input - Raw string input
 * @returns Sanitized string with HTML tags removed and special chars encoded
 */
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== "string") return "";

  return input
    // Remove all HTML tags
    .replace(/<[^>]*>/g, "")
    // Encode remaining dangerous characters
    .replace(/[<>"'&]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize a string for safe use in database queries and output.
 * Less aggressive than sanitizeHtml — preserves most characters
 * but neutralizes script injection vectors.
 *
 * @param input - Raw string input
 * @returns Sanitized string
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== "string") return "";

  return input
    // Remove null bytes
    .replace(/\0/g, "")
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Remove event handlers (onclick, onload, etc.)
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, "")
    // Remove javascript: protocol
    .replace(/javascript\s*:/gi, "")
    // Remove data: protocol with script content
    .replace(/data\s*:\s*text\/html/gi, "")
    // Trim whitespace
    .trim();
}

/**
 * Deep-sanitize all string values in an object.
 * Recursively traverses nested objects and arrays.
 *
 * @param obj - Object with potentially unsafe string values
 * @returns New object with all string values sanitized
 */
export function sanitizeInput(
  obj: Record<string, any>
): Record<string, any> {
  if (!obj || typeof obj !== "object") return obj;

  const result: Record<string, any> = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) => {
        if (typeof item === "string") return sanitizeString(item);
        if (typeof item === "object" && item !== null) return sanitizeInput(item);
        return item;
      });
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeInput(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Sanitize an email address — basic validation and cleanup.
 *
 * @param email - Raw email string
 * @returns Cleaned email or empty string if invalid format
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== "string") return "";

  const cleaned = email.trim().toLowerCase();
  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : "";
}

/**
 * Sanitize a URL — validate and prevent javascript: protocol attacks.
 *
 * @param url - Raw URL string
 * @returns Cleaned URL or empty string if potentially dangerous
 */
export function sanitizeUrl(url: string): string {
  if (!url || typeof url !== "string") return "";

  const cleaned = url.trim();
  // Block dangerous protocols
  if (/^(javascript|data|vbscript):/i.test(cleaned)) return "";
  // Must start with http://, https://, or /
  if (!/^(https?:\/\/|\/)/i.test(cleaned)) return "";

  return cleaned;
}
