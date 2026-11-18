import type { StickyNoteComment } from "./sticky-notes.functions";

export type StickyNoteCommentNode = StickyNoteComment & {
  children: StickyNoteCommentNode[];
};

export function buildStickyNoteCommentTree(comments: StickyNoteComment[]): StickyNoteCommentNode[] {
  const nodes = new Map<string, StickyNoteCommentNode>();
  for (const comment of comments) nodes.set(comment.id, { ...comment, children: [] });

  const roots: StickyNoteCommentNode[] = [];
  for (const comment of comments) {
    const node = nodes.get(comment.id)!;
    const parent = comment.parent_id ? nodes.get(comment.parent_id) : undefined;
    if (parent && parent.id !== node.id) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
