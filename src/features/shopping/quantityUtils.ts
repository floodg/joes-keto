/**
 * Utilities for parsing and formatting ingredient quantity strings.
 *
 * Quantities in meal ingredients are stored as plain strings (e.g. "500g",
 * "1.5 kg", "2 cups").  These helpers allow us to parse them into numeric
 * values so that inventory stock levels can be subtracted from the total
 * meal demand to produce the final shopping list.
 */

export interface ParsedQuantity {
  amount: number;
  /** Canonical (normalised) unit string, e.g. "g", "ml", "cups", "units". */
  unit: string;
}

/** Convert a raw unit string to its canonical abbreviation. */
export function normalizeUnit(raw: string): string {
  const u = raw.toLowerCase().trim();
  if (u === "gram" || u === "grams" || u === "g") return "g";
  if (u === "kilogram" || u === "kilograms" || u === "kg") return "kg";
  if (u === "milliliter" || u === "milliliters" || u === "millilitre" || u === "millilitres" || u === "ml") return "ml";
  if (u === "liter" || u === "liters" || u === "litre" || u === "litres" || u === "l") return "l";
  if (u === "unit" || u === "units" || u === "piece" || u === "pieces" || u === "pcs") return "units";
  return u;
}

/** Convert amount + unit to a base SI unit (g for mass, ml for volume). */
export function toBaseUnit(amount: number, unit: string): ParsedQuantity {
  const n = normalizeUnit(unit);
  if (n === "kg") return { amount: amount * 1000, unit: "g" };
  if (n === "l") return { amount: amount * 1000, unit: "ml" };
  return { amount, unit: n };
}

/**
 * Parse a quantity string (e.g. "500g", "1.5 kg", "2 cups") into a numeric
 * amount and a canonical unit.  Returns `null` when the string cannot be
 * parsed or is empty.
 */
export function parseQuantity(q: string | undefined): ParsedQuantity | null {
  if (!q) return null;
  const trimmed = q.trim();
  // Match an optional sign, a number (integer or decimal), optional
  // whitespace, and an optional unit label.
  const match = trimmed.match(/^([+-]?\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
  if (!match) return null;
  const amount = parseFloat(match[1]);
  const rawUnit = match[2] || "units";
  return toBaseUnit(amount, rawUnit);
}

/**
 * Format a (amount, unit) pair back into a human-readable string.
 * Amounts are rounded to at most two decimal places.
 */
export function formatQuantity(amount: number, unit: string): string {
  const rounded = Math.round(amount * 100) / 100;
  if (unit === "units") return `${rounded}`;
  return `${rounded}${unit}`;
}
