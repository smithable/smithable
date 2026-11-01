// A brand colour's theme colours live in core (packages/core/src/brand.ts), so the ux file's check
// and the generated app derive them the same way; this module keeps the adapter's import.
export { type BrandColors, brandColors } from "@smithable/core";
