import { inputContracts } from "./input-contracts.generated";

export type Contract = {
  kind: string;
  values?: unknown[];
  choices?: Contract[];
  item?: Contract;
  properties?: Record<string, { optional: boolean; contract: Contract }>;
  index?: Contract;
};

export function validateContract<T>(value: T, name: keyof typeof inputContracts): T {
  const encoded = JSON.stringify(value);
  if (encoded && encoded.length > 12 * 1024 * 1024) throw new Error("Request is too large.");
  let visited = 0;
  function valid(input: unknown, rule: Contract, depth: number): boolean {
    if (++visited > 250000 || depth > 16) return false;
    if (rule.kind === "union")
      return Boolean(rule.choices?.some((choice) => valid(input, choice, depth + 1)));
    if (rule.kind === "literal") return Boolean(rule.values?.includes(input));
    if (rule.kind === "undefined") return input === undefined;
    if (rule.kind === "null") return input === null;
    if (rule.kind === "string") return typeof input === "string" && input.length <= 2 * 1024 * 1024;
    if (rule.kind === "number") return typeof input === "number" && Number.isFinite(input);
    if (rule.kind === "boolean") return typeof input === "boolean";
    if (rule.kind === "array")
      return (
        Array.isArray(input) &&
        input.length <= 10000 &&
        input.every((item) => valid(item, rule.item!, depth + 1))
      );
    if (rule.kind === "object") {
      if (!input || typeof input !== "object" || Array.isArray(input)) return false;
      const object = input as Record<string, unknown>;
      if (Object.keys(object).length > 300) return false;
      for (const [key, property] of Object.entries(rule.properties || {})) {
        if (object[key] === undefined && property.optional) continue;
        if (!valid(object[key], property.contract, depth + 1)) return false;
      }
      return Object.keys(object).every((key) => {
        if (["__proto__", "prototype", "constructor"].includes(key)) return false;
        if (Object.hasOwn(rule.properties || {}, key)) return true;
        return Boolean(rule.index && valid(object[key], rule.index, depth + 1));
      });
    }
    // unknown/JSON extension values still receive bounded recursive validation.
    if (input === undefined || input === null || typeof input === "boolean") return true;
    if (typeof input === "string") return input.length <= 2 * 1024 * 1024;
    if (typeof input === "number") return Number.isFinite(input);
    if (Array.isArray(input))
      return (
        input.length <= 10000 && input.every((item) => valid(item, { kind: "json" }, depth + 1))
      );
    return valid(input, { kind: "object", index: { kind: "json" } }, depth + 1);
  }
  if (!valid(value, inputContracts[name] as Contract, 0))
    throw new Error("Invalid request. Check the required fields and try again.");
  return value;
}
