/**
 * Validators
 * Manual validation (no zod since no npm) - returns { valid, errors }
 */

function validate(schema, data) {
  const errors = [];
  for (const [field, rules] of Object.entries(schema)) {
    const value = data[field];
    if (rules.required && (value === undefined || value === null || value === "")) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }
    if (value === undefined || value === null || value === "") continue;
    if (rules.type === "string" && typeof value !== "string") {
      errors.push({ field, message: `${field} must be a string` });
    }
    if (rules.type === "number" && (typeof value !== "number" || isNaN(value))) {
      errors.push({ field, message: `${field} must be a number` });
    }
    if (rules.min !== undefined && typeof value === "string" && value.length < rules.min) {
      errors.push({ field, message: `${field} must be at least ${rules.min} characters` });
    }
    if (rules.max !== undefined && typeof value === "string" && value.length > rules.max) {
      errors.push({ field, message: `${field} must be at most ${rules.max} characters` });
    }
    if (rules.minValue !== undefined && typeof value === "number" && value < rules.minValue) {
      errors.push({ field, message: `${field} must be >= ${rules.minValue}` });
    }
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push({ field, message: `${field} must be one of: ${rules.enum.join(", ")}` });
    }
    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push({ field, message: rules.patternMessage || `${field} is invalid` });
    }
  }
  return { valid: errors.length === 0, errors };
}

const registerSchema = {
  name: { required: true, type: "string", min: 2, max: 100 },
  email: { required: true, type: "string", pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: "email must be valid" },
  password: { required: true, type: "string", min: 6, max: 128 },
  role: { type: "string", enum: ["viewer", "analyst", "admin"] },
};

const loginSchema = {
  email: { required: true, type: "string" },
  password: { required: true, type: "string" },
};

const createRecordSchema = {
  amount: { required: true, type: "number", minValue: 0.01 },
  type: { required: true, type: "string", enum: ["income", "expense"] },
  category: { required: true, type: "string", min: 1, max: 100 },
  date: { required: true, type: "string", pattern: /^\d{4}-\d{2}-\d{2}$/, patternMessage: "date must be YYYY-MM-DD" },
  notes: { type: "string", max: 500 },
};

const updateRecordSchema = {
  amount: { type: "number", minValue: 0.01 },
  type: { type: "string", enum: ["income", "expense"] },
  category: { type: "string", min: 1, max: 100 },
  date: { type: "string", pattern: /^\d{4}-\d{2}-\d{2}$/, patternMessage: "date must be YYYY-MM-DD" },
  notes: { type: "string", max: 500 },
};

const updateUserSchema = {
  name: { type: "string", min: 2, max: 100 },
  role: { type: "string", enum: ["viewer", "analyst", "admin"] },
  status: { type: "string", enum: ["active", "inactive"] },
};

module.exports = { validate, registerSchema, loginSchema, createRecordSchema, updateRecordSchema, updateUserSchema };
