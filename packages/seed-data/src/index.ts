import type { InsurerMetrics, Product, Scenario } from "@stacked/claim-engine";
import insurersJson from "../data/insurers.json";
import productsJson from "../data/products.json";
import scenariosJson from "../data/scenarios.json";

/** Table A — 31 insurers, FY24–26 NL-37 metrics (Ditto compilation, 7 Sept 2026). */
export const INSURERS = insurersJson as unknown as InsurerMetrics[];
/** Tables B1, B2 and the name-only list. */
export const PRODUCTS = productsJson as unknown as Product[];
/** Table C — S1 to S11. */
export const SCENARIOS = scenariosJson as unknown as Scenario[];

export { presetFromProduct, type PresetInput } from "./preset.js";
