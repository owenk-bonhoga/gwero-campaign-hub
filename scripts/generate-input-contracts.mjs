import ts from "typescript";
import { readFileSync, writeFileSync } from "node:fs";
import prettier from "prettier";

const config = ts.readConfigFile("tsconfig.json", ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ".");
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const contracts = {};
function describe(type, seen = new Set()) {
  if (seen.has(type)) return { kind: "json" };
  const next = new Set(seen).add(type);
  if (type.isUnion()) return { kind: "union", choices: type.types.map((t) => describe(t, next)) };
  if (type.isStringLiteral() || type.isNumberLiteral())
    return { kind: "literal", values: [type.value] };
  if (type.flags & ts.TypeFlags.Undefined) return { kind: "undefined" };
  if (type.flags & ts.TypeFlags.Null) return { kind: "null" };
  if (type.flags & ts.TypeFlags.String) return { kind: "string" };
  if (type.flags & ts.TypeFlags.Number) return { kind: "number" };
  if (type.flags & ts.TypeFlags.BooleanLiteral)
    return { kind: "literal", values: [type.intrinsicName === "true"] };
  if (type.flags & ts.TypeFlags.Boolean) return { kind: "boolean" };
  if (checker.isArrayType(type))
    return { kind: "array", item: describe(checker.getTypeArguments(type)[0], next) };
  if (type.flags & ts.TypeFlags.Object) {
    const properties = {};
    for (const property of type.getProperties()) {
      const declaration = property.valueDeclaration || property.declarations?.[0];
      if (!declaration) continue;
      properties[property.name] = {
        optional: Boolean(property.flags & ts.SymbolFlags.Optional),
        contract: describe(checker.getTypeOfSymbolAtLocation(property, declaration), next),
      };
    }
    const index = checker.getIndexTypeOfType(type, ts.IndexKind.String);
    return { kind: "object", properties, ...(index ? { index: describe(index, next) } : {}) };
  }
  return { kind: "json" };
}
const edits = new Map();
for (const file of program.getSourceFiles()) {
  if (!file.fileName.includes("src/") || file.isDeclarationFile) continue;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "validator"
    ) {
      const arrow = node.arguments[0];
      if (arrow && ts.isArrowFunction(arrow) && arrow.parameters.length === 1) {
        let parent = node;
        while (parent && !ts.isVariableDeclaration(parent)) parent = parent.parent;
        if (!parent || !ts.isIdentifier(parent.name))
          throw new Error(`Unnamed validator in ${file.fileName}`);
        const name = parent.name.text;
        const type = checker.getTypeAtLocation(arrow.parameters[0]);
        if (contracts[name]) throw new Error(`Duplicate contract ${name}`);
        contracts[name] = describe(type);
        if (process.argv.includes("--install")) {
          const parameter = arrow.parameters[0].name.getText(file);
          const body = arrow.body.getText(file);
          if (!body.includes("validateContract(")) {
            if (ts.isBlock(arrow.body))
              throw new Error(`Block validator requires manual review: ${name}`);
            const list = edits.get(file.fileName) || [];
            list.push({
              start: arrow.body.getStart(file),
              end: arrow.body.end,
              text: `validateContract(${body}, "${name}")`,
            });
            edits.set(file.fileName, list);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
}
if (process.argv.includes("--install"))
  for (const [file, list] of edits) {
    let contents = readFileSync(file, "utf8");
    for (const edit of list.sort((a, b) => b.start - a.start))
      contents = contents.slice(0, edit.start) + edit.text + contents.slice(edit.end);
    writeFileSync(
      file,
      (contents.includes('from "./input-contract"')
        ? ""
        : 'import { validateContract } from "./input-contract";\n') + contents,
    );
  }
function canonical(value, property = "") {
  if (Array.isArray(value)) {
    const result = value.map((item) => canonical(item));
    return ["choices", "values"].includes(property)
      ? result.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), "en"))
      : result;
  }
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key], key)]),
    );
  return value;
}
const output = await prettier.format(
  `// Generated from declared server-function input types. Run npm run contracts:generate after changing an input.\nexport const inputContracts = ${JSON.stringify(canonical(contracts))};\n`,
  { parser: "typescript", printWidth: 100 },
);
const destination = "src/lib/input-contracts.generated.ts";
if (process.argv.includes("--check")) {
  if (readFileSync(destination, "utf8") !== output)
    throw new Error("Input contracts are stale. Run npm run contracts:generate.");
} else writeFileSync(destination, output);
console.log(`Validated runtime contracts for ${Object.keys(contracts).length} server inputs.`);
