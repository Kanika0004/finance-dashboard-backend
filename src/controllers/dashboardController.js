/**
 * Dashboard Controller
 * GET /api/dashboard/summary
 * GET /api/dashboard/trends
 * GET /api/dashboard/categories
 */

const { getDashboardSummary, getRecords } = require("../database/db");
const { ok, badRequest } = require("../utils/response");

function getSummary(req, res) {
  const { date_from, date_to } = req.query || {};

  // Validate date filters if provided
  if (date_from && !/^\d{4}-\d{2}-\d{2}$/.test(date_from)) {
    return badRequest(res, "date_from must be YYYY-MM-DD");
  }
  if (date_to && !/^\d{4}-\d{2}-\d{2}$/.test(date_to)) {
    return badRequest(res, "date_to must be YYYY-MM-DD");
  }
  if (date_from && date_to && date_from > date_to) {
    return badRequest(res, "date_from must be before date_to");
  }

  const summary = getDashboardSummary({ dateFrom: date_from, dateTo: date_to });
  return ok(res, summary);
}

function getWeeklyTrends(req, res) {
  // Return last 8 weeks summary
  const today = new Date();
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const end = new Date(today);
    end.setDate(today.getDate() - i * 7);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const summary = getDashboardSummary({
      dateFrom: start.toISOString().slice(0, 10),
      dateTo: end.toISOString().slice(0, 10),
    });
    weeks.push({
      week_start: start.toISOString().slice(0, 10),
      week_end: end.toISOString().slice(0, 10),
      income: summary.total_income,
      expenses: summary.total_expenses,
      net: summary.net_balance,
      transaction_count: summary.transaction_count.total,
    });
  }
  return ok(res, { weekly_trends: weeks });
}

function getCategoryBreakdown(req, res) {
  const { type, date_from, date_to } = req.query || {};
  if (type && !["income", "expense"].includes(type)) {
    return badRequest(res, "type must be 'income' or 'expense'");
  }
  const summary = getDashboardSummary({ dateFrom: date_from, dateTo: date_to });
  let categories = summary.by_category;
  if (type) categories = categories.filter((c) => c.type === type);
  const grandTotal = categories.reduce((s, c) => s + c.total, 0);
  const enriched = categories.map((c) => ({
    ...c,
    percentage: grandTotal > 0 ? Math.round((c.total / grandTotal) * 10000) / 100 : 0,
  }));
  return ok(res, { categories: enriched, grand_total: Math.round(grandTotal * 100) / 100 });
}

module.exports = { getSummary, getWeeklyTrends, getCategoryBreakdown };
