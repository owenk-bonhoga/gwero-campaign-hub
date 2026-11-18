import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStickyNoteCommentTree,
  type StickyNoteCommentNode,
} from "../src/lib/sticky-note-comments.ts";
import type { StickyNoteComment } from "../src/lib/sticky-notes.functions.ts";

function comment(id: string, parentId: string | null): StickyNoteComment {
  return {
    id,
    note_id: "note-1",
    parent_id: parentId,
    body: id,
    color: "yellow",
    created_by: "user-1",
    created_by_name: "Test User",
    created_at: "2026-11-18 10:00:00.000",
    updated_at: "2026-11-18 10:00:00.000",
    mentions: [],
    can_edit: true,
  };
}

test("builds replies recursively regardless of input order", () => {
  const tree = buildStickyNoteCommentTree([
    comment("grandchild", "child"),
    comment("root", null),
    comment("child", "root"),
  ]);
  assert.equal(tree.length, 1);
  assert.equal(tree[0]?.id, "root");
  assert.equal(tree[0]?.children[0]?.id, "child");
  assert.equal(tree[0]?.children[0]?.children[0]?.id, "grandchild");
});

test("keeps orphaned replies visible as roots", () => {
  const tree: StickyNoteCommentNode[] = buildStickyNoteCommentTree([comment("orphan", "missing")]);
  assert.equal(tree[0]?.id, "orphan");
});
