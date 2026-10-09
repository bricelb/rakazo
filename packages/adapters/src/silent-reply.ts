import type { MessageBlock } from "@rakazo/contracts";

/** Exact token a silent routine must emit as its entire final assistant reply. */
export const NO_RESPONSE = "NO_RESPONSE";

function textBlocksOf(
  blocks: readonly MessageBlock[],
): Array<Extract<MessageBlock, { kind: "text" }>> {
  return blocks.filter(
    (block): block is Extract<MessageBlock, { kind: "text" }> => block.kind === "text",
  );
}

function joinedText(blocks: readonly MessageBlock[]): string {
  return textBlocksOf(blocks)
    .map((block) => block.text)
    .join("");
}

/**
 * The sentinel alone, once or repeated. Text segments of one turn are joined
 * with no separator, so a model that re-emits the sentinel after each tool
 * batch yields `NO_RESPONSENO_RESPONSE`; that is still a silent reply, not prose.
 */
const SENTINEL_ONLY = /^(?:NO_RESPONSE\s*)+$/;

/** True when trimmed text is only the silent-routine sentinel, once or repeated. Extra prose does not match. */
export function isExactNoResponse(text: string): boolean {
  return SENTINEL_ONLY.test(text.trim());
}

/**
 * Sentinel runs standing at either edge of a text, glued to it or not, with nothing of the
 * token left inside a longer word. A model that writes a report and then also emits its
 * silence signal yields `…sans modification.NO_RESPONSE`; the report is the reply, the
 * token is noise the user should never read.
 */
const STRAY_EDGE_SENTINEL =
  /^(?:\s*NO_RESPONSE(?![A-Za-z0-9_]))+\s*|(?:\s*(?<![A-Za-z0-9_])NO_RESPONSE)+\s*$/g;

function withoutStraySentinels(text: string): string {
  return text.replace(STRAY_EDGE_SENTINEL, "");
}

/**
 * Silent-reply stripper. If the trimmed final text is exactly `NO_RESPONSE`,
 * drop that text so the run can finish with no chat bubble. Sibling tool/step
 * blocks do not count as extra prose. Surrounding words keep the reply; only a
 * stray sentinel at the start or end of that prose is removed from it.
 */
export function stripNoResponseReply(
  assembled: string,
  blocks: MessageBlock[],
): { assembled: string; blocks: MessageBlock[] } {
  const assembledTrimmed = assembled.trim();
  const blockText = joinedText(blocks).trim();
  const visible = assembledTrimmed || blockText;
  if (!isExactNoResponse(visible)) return withoutStraySentinelsAtEdges(assembled, blocks);
  // Fail closed: extra prose in either the assembled final or a text block keeps the reply.
  if (assembledTrimmed && blockText && !isExactNoResponse(blockText)) {
    return { assembled, blocks };
  }
  return {
    assembled: "",
    blocks: blocks.filter((block) => block.kind !== "text"),
  };
}

/** A reply with prose stays a reply; a sentinel misplaced at its edge is dropped from what the user sees. */
function withoutStraySentinelsAtEdges(
  assembled: string,
  blocks: MessageBlock[],
): { assembled: string; blocks: MessageBlock[] } {
  let changed = false;
  const cleanedAssembled = withoutStraySentinels(assembled);
  if (cleanedAssembled !== assembled) changed = true;
  const cleanedBlocks = blocks.flatMap((block) => {
    if (block.kind !== "text") return [block];
    const text = withoutStraySentinels(block.text);
    if (text === block.text) return [block];
    changed = true;
    return text.trim() ? [{ ...block, text }] : [];
  });
  return changed ? { assembled: cleanedAssembled, blocks: cleanedBlocks } : { assembled, blocks };
}
