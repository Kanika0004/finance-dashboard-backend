/**
 * Financial Records Controller
 * POST   /api/records           (analyst, admin)
 * GET    /api/records           (viewer, analyst, admin)
 * GET    /api/records/:id       (viewer, analyst, admin)
 * PUT    /api/records/:id       (analyst/admin - own records; admin - all)
 * DELETE /api/records/:id       (analyst/admin - own records; admin - all)
 */

const { createRecord, getRecordById, getRecords, updateRecord, softDeleteRecord } = require("../database/db");
const { validate, createRecordSchema, updateRecordSchema } = require("../validators");
const { ok, created, noContent, badRequest, notFound, forbidden, serverError } = require("../utils/response");
const { generateId } = require("../utils/auth");
const { canModifyRecord } = require("../middleware");

function listRecords(req, res) {
  const { page = "1", limit = "20", type, category, date_from, date_to, search } = req.query || {};

  // Validate type filter if provided
  if (type && !["income", "expense"].includes(type)) {
    return badRequest(res, "type must be 'income' or 'expense'");
  }

  const result = getRecords({
    page: Math.max(1, parseInt(page) || 1),
    limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
    type,
    category,
    dateFrom: date_from,
    dateTo: date_to,
    search,
  });

  return ok(res, result.records, {
    pagination: {
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: Math.ceil(result.total / result.limit),
    },
  });
}

function getRecord(req, res) {
  const record = getRecordById(req.params.id);
  if (!record) return notFound(res, "Record not found");
  return ok(res, { record });
}

function createFinancialRecord(req, res) {
  const { valid, errors } = validate(createRecordSchema, req.body);
  if (!valid) return badRequest(res, "Validation failed", errors);

  // Validate date is a real date
  const dateObj = new Date(req.body.date);
  if (isNaN(dateObj.getTime())) {
    return badRequest(res, "Invalid date value");
  }

  const now = new Date().toISOString();
  const record = createRecord({
    id: generateId(),
    amount: parseFloat(req.body.amount.toFixed(2)),
    type: req.body.type,
    category: req.body.category.trim(),
    date: req.body.date,
    notes: req.body.notes ? req.body.notes.trim() : null,
    created_by: req.user.id,
    created_at: now,
    updated_at: now,
  });

  return created(res, { record });
}

function updateFinancialRecord(req, res) {
  const record = getRecordById(req.params.id);
  if (!record) return notFound(res, "Record not found");

  if (!canModifyRecord(req.user, record)) {
    return forbidden(res, "You can only modify your own records");
  }

  const { valid, errors } = validate(updateRecordSchema, req.body);
  if (!valid) return badRequest(res, "Validation failed", errors);

  const updates = {};
  const allowed = ["amount", "type", "category", "date", "notes"];
  for (const field of allowed) {
    if (req.body[field] !== undefined) {
      updates[field] = field === "amount"
        ? parseFloat(parseFloat(req.body[field]).toFixed(2))
        : field === "category" || field === "notes"
          ? req.body[field].trim()
          : req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return badRequest(res, "No valid fields to update");
  }

  // Validate date if being updated
  if (updates.date) {
    const dateObj = new Date(updates.date);
    if (isNaN(dateObj.getTime())) return badRequest(res, "Invalid date value");
  }

  updates.updated_at = new Date().toISOString();
  const updated = updateRecord(req.params.id, updates);
  return ok(res, { record: updated });
}

function deleteFinancialRecord(req, res) {
  const record = getRecordById(req.params.id);
  if (!record) return notFound(res, "Record not found");

  if (!canModifyRecord(req.user, record)) {
    return forbidden(res, "You can only delete your own records");
  }

  softDeleteRecord(req.params.id, new Date().toISOString());
  return ok(res, { message: "Record deleted successfully" });
}

module.exports = { listRecords, getRecord, createFinancialRecord, updateFinancialRecord, deleteFinancialRecord };
