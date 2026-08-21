'use strict';

/** Sums a list of possibly-null/undefined numeric values, treating missing as 0. */
function sumOrZero(values) {
  return values.reduce((total, v) => total + (v === null || v === undefined ? 0 : Number(v)), 0);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Computes the four fields that used to be `GENERATED ALWAYS AS ...
 * STORED` columns in the raw-SQL version of this schema: budgetTotal,
 * actualTotal, profitAmount, and durationMinutes. Now that schema.sql handles
 * push` owns the schema, these can't be database-computed (Prisma has
 * no syntax for STORED generated columns), so this function is the
 * single source of truth for the formulas instead — call it on every
 * create/update so the four values never drift from their inputs.
 *
 * Formulas mirror the original SQL exactly:
 *   budget_total  = sum of the 7 budget_* columns (nulls as 0)
 *   actual_total  = sum of the 7 actual_* columns (nulls as 0)
 *   profit_amount = quoted_price (or 0) - actual_total
 *   duration_minutes = minutes between ot_in_time and ot_out_time
 *
 * @param {object} record - the *merged* (existing + incoming) surgery
 *   fields — callers must merge before calling this, so a partial
 *   update doesn't compute totals from only the changed fields.
 */
function computeDerivedFields(record) {
  const budgetTotal = sumOrZero([
    record.budgetSurgeonFee,
    record.budgetAssistantCost,
    record.budgetAnaesthetistFee,
    record.budgetOtCost,
    record.budgetConsumables,
    record.budgetPharmacy,
    record.budgetMiscellaneous,
  ]);

  const actualTotal = sumOrZero([
    record.actualSurgeonFee,
    record.actualAssistantCost,
    record.actualAnaesthetistFee,
    record.actualOtCost,
    record.actualConsumables,
    record.actualPharmacy,
    record.actualMiscellaneous,
  ]);

  const profitAmount = sumOrZero([record.quotedPrice]) - actualTotal;

  let durationMinutes = null;
  if (record.otInTime && record.otOutTime) {
    const inMs = new Date(record.otInTime).getTime();
    const outMs = new Date(record.otOutTime).getTime();
    if (Number.isFinite(inMs) && Number.isFinite(outMs)) {
      durationMinutes = Math.max(0, Math.round((outMs - inMs) / 60000));
    }
  }

  return {
    budgetTotal: round2(budgetTotal),
    actualTotal: round2(actualTotal),
    profitAmount: round2(profitAmount),
    durationMinutes,
  };
}

/**
 * quantity * unitCost — replaces the old STORED total_cost column on
 * surgery_consumables / surgery_pharmacy.
 */
function computeLineItemTotal(quantity, unitCost) {
  return round2(Number(quantity) * Number(unitCost));
}

module.exports = { computeDerivedFields, computeLineItemTotal, round2 };
