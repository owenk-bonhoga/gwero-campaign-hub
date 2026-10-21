import test from "node:test";
import assert from "node:assert/strict";
import { copyProspectLocationsToClientSql } from "../src/lib/prospect-conversion.sql.ts";

test("prospect conversion qualifies location fields copied through the self-join", () => {
  const selectedColumns = copyProspectLocationsToClientSql.match(/SELECT([\s\S]+?)FROM/i)?.[1];

  assert.ok(selectedColumns);
  assert.doesNotMatch(selectedColumns, /(?:^|,)\s*name\s*(?:,|$)/i);
  for (const column of [
    "name",
    "address_line",
    "city",
    "region",
    "country",
    "is_primary",
    "source_url",
  ]) {
    assert.ok(selectedColumns.includes(`source.${column}`));
  }
});
