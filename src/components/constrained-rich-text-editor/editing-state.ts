import {
  FEEDBACK_RICH_TEXT_CONTRACT_VERSION,
  FEEDBACK_RICH_TEXT_MARKS,
  FEEDBACK_RICH_TEXT_MAX_BLOCKS,
  FEEDBACK_RICH_TEXT_MAX_CHARACTERS,
  FEEDBACK_RICH_TEXT_MAX_DEPTH,
  FEEDBACK_RICH_TEXT_MAX_NODES,
  FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS,
  containsFeedbackRichTextUnsupportedCodePoint,
  createFeedbackRichTextDocument,
  extractFeedbackRichText,
  normaliseFeedbackRichTextDocument,
  type FeedbackRichTextBlock,
  type FeedbackRichTextConstraint,
  type FeedbackRichTextDocument,
  type FeedbackRichTextMark,
  type FeedbackRichTextNode,
} from "./model.js";

/**
 * Browser-memory-only editor block. Unlike the public feedback AST, this
 * private view model may contain an empty block so Enter can move the caret to
 * a new paragraph/list item without emitting schema-invalid narrative.
 *
 * @internal
 */
export type FeedbackRichTextEditingBlock =
  | {
      type: "paragraph";
      depth: number;
      children: readonly FeedbackRichTextNode[];
    }
  | {
      type: "listItem";
      listType: "bullet";
      depth: number;
      children: readonly FeedbackRichTextNode[];
    };

/** @internal Never expose this state through component callbacks or exports. */
export interface FeedbackRichTextEditingState {
  readonly children: readonly FeedbackRichTextEditingBlock[];
}

/** @internal */
export interface FeedbackRichTextEditingMutation {
  value: FeedbackRichTextEditingState;
  selectionStart: number;
  selectionEnd: number;
  violation?: FeedbackRichTextConstraint;
}

interface InlineBlock {
  text: string;
  marks: FeedbackRichTextMark[][];
}

interface BlockPoint {
  blockIndex: number;
  innerOffset: number;
}

const unicodeFormatPattern = /\p{Cf}/gu;
const unicodeControlPattern = /\p{Cc}/u;

function normaliseMarks(
  marks: readonly FeedbackRichTextMark[] | undefined,
): FeedbackRichTextMark[] {
  const boundedMarks = Array.isArray(marks)
    ? marks.slice(0, FEEDBACK_RICH_TEXT_MARKS.length + 1)
    : [];
  return FEEDBACK_RICH_TEXT_MARKS.filter((mark) =>
    boundedMarks.includes(mark),
  );
}

function marksEqual(
  left: readonly FeedbackRichTextMark[],
  right: readonly FeedbackRichTextMark[],
): boolean {
  return (
    left.length === right.length &&
    left.every((mark, index) => mark === right[index])
  );
}

function blockText(block: FeedbackRichTextEditingBlock): string {
  return block.children.map((node) => node.text).join("");
}

function codePointLength(text: string): number {
  return Array.from(text).length;
}

function safeSlice(
  text: string,
  maximumCodePoints: number,
  maximumCodeUnits: number,
): string {
  if (
    text.length <= maximumCodeUnits &&
    codePointLength(text) <= maximumCodePoints
  ) {
    return text;
  }
  let result = "";
  let codePoints = 0;
  let codeUnits = 0;
  for (const character of text) {
    if (
      codePoints >= Math.max(0, maximumCodePoints) ||
      codeUnits + character.length > Math.max(0, maximumCodeUnits)
    ) {
      break;
    }
    result += character;
    codePoints += 1;
    codeUnits += character.length;
  }
  return result;
}

function stripControlCharacters(text: string): string {
  return [...text]
    .filter(
      (character) =>
        character === "\n" ||
        character === "\t" ||
        !unicodeControlPattern.test(character),
    )
    .join("");
}

/**
 * Normalises browser input while retaining structural leading/trailing
 * newlines. The public model performs the authoritative Unicode/profile and
 * narrative-syntax validation for every non-empty insertion.
 */
function normaliseInsertedText(text: string): string | null {
  const boundedText = safeSlice(
    text,
    FEEDBACK_RICH_TEXT_MAX_CHARACTERS + 1,
    FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS,
  );
  if (containsFeedbackRichTextUnsupportedCodePoint(boundedText)) {
    return null;
  }
  const normalised = stripControlCharacters(
    boundedText
      .replace(/\r\n?/g, "\n")
      .normalize("NFKC")
      .replace(unicodeFormatPattern, ""),
  ).replace(/\t/g, "  ");
  if (normalised.replace(/\n/g, "").length === 0) {
    return normalised;
  }
  return createFeedbackRichTextDocument(normalised) ? normalised : null;
}

function inlineFromBlock(block: FeedbackRichTextEditingBlock): InlineBlock {
  let text = "";
  const marks: FeedbackRichTextMark[][] = [];
  for (const node of block.children) {
    const nodeMarks = normaliseMarks(node.marks);
    text += node.text;
    for (let index = 0; index < node.text.length; index += 1) {
      marks.push([...nodeMarks]);
    }
  }
  return { text, marks };
}

function inlineSlice(
  inline: InlineBlock,
  start: number,
  end = inline.text.length,
): InlineBlock {
  return {
    text: inline.text.slice(start, end),
    marks: inline.marks.slice(start, end).map((marks) => [...marks]),
  };
}

function concatInline(...parts: readonly InlineBlock[]): InlineBlock {
  return {
    text: parts.map((part) => part.text).join(""),
    marks: parts.flatMap((part) => part.marks.map((marks) => [...marks])),
  };
}

function inlineFromText(
  text: string,
  marks: readonly FeedbackRichTextMark[],
): InlineBlock {
  const normalisedMarks = normaliseMarks(marks);
  return {
    text,
    marks: Array.from({ length: text.length }, () => [...normalisedMarks]),
  };
}

function nodesFromInline(inline: InlineBlock): FeedbackRichTextNode[] {
  const nodes: FeedbackRichTextNode[] = [];
  let runStart = 0;
  while (runStart < inline.text.length) {
    const runMarks = normaliseMarks(inline.marks[runStart]);
    let runEnd = runStart + 1;
    while (
      runEnd < inline.text.length &&
      marksEqual(runMarks, normaliseMarks(inline.marks[runEnd]))
    ) {
      runEnd += 1;
    }
    nodes.push({
      type: "text",
      text: inline.text.slice(runStart, runEnd),
      ...(runMarks.length > 0 ? { marks: runMarks } : {}),
    });
    runStart = runEnd;
  }
  return nodes;
}

function blockWithInline(
  source: FeedbackRichTextEditingBlock,
  inline: InlineBlock,
): FeedbackRichTextEditingBlock {
  const children = nodesFromInline(inline);
  return source.type === "listItem"
    ? {
        type: "listItem",
        listType: "bullet",
        depth: source.depth,
        children,
      }
    : {
        type: "paragraph",
        depth: source.depth,
        children,
      };
}

function editingBlocksEqual(
  left: FeedbackRichTextEditingBlock,
  right: FeedbackRichTextEditingBlock,
): boolean {
  if (
    left.type !== right.type ||
    left.depth !== right.depth ||
    left.children.length !== right.children.length ||
    (left.type === "listItem" &&
      (right.type !== "listItem" || left.listType !== right.listType))
  ) {
    return false;
  }
  return left.children.every((leftNode, index) => {
    const rightNode = right.children[index];
    return (
      rightNode !== undefined &&
      leftNode.text === rightNode.text &&
      marksEqual(
        normaliseMarks(leftNode.marks),
        normaliseMarks(rightNode.marks),
      )
    );
  });
}

function editingStatesEqual(
  left: FeedbackRichTextEditingState,
  right: FeedbackRichTextEditingState,
): boolean {
  return (
    left.children.length === right.children.length &&
    left.children.every((block, index) => {
      const candidate = right.children[index];
      return candidate !== undefined && editingBlocksEqual(block, candidate);
    })
  );
}

export function feedbackRichTextDocumentsEqual(
  left: FeedbackRichTextDocument | null,
  right: FeedbackRichTextDocument | null,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right || left.children.length !== right.children.length) {
    return false;
  }
  return left.children.every((leftBlock, index) => {
    const rightBlock = right.children[index];
    return (
      rightBlock !== undefined &&
      editingBlocksEqual(leftBlock, rightBlock)
    );
  });
}

export function createFeedbackRichTextEditingState(
  value: FeedbackRichTextDocument | null | undefined,
): FeedbackRichTextEditingState {
  const canonical = normaliseFeedbackRichTextDocument(value);
  return {
    children:
      canonical?.children.map((block) => ({
        ...block,
        children: block.children.map((node) => ({
          ...node,
          ...(node.marks ? { marks: [...node.marks] } : {}),
        })),
      })) ?? [
        {
          type: "paragraph",
          depth: 0,
          children: [],
        },
      ],
  };
}

/**
 * The only bridge from private editor state to the public/schema-compatible
 * AST. Empty blocks are deliberately omitted by the canonical normaliser.
 */
export function projectFeedbackRichTextEditingState(
  value: FeedbackRichTextEditingState,
): FeedbackRichTextDocument | null {
  return normaliseFeedbackRichTextDocument({
    type: "doc",
    schemaVersion: "1",
    version: FEEDBACK_RICH_TEXT_CONTRACT_VERSION,
    children: value.children as readonly FeedbackRichTextBlock[],
  });
}

export function extractFeedbackRichTextEditingState(
  value: FeedbackRichTextEditingState,
): string {
  return value.children.map(blockText).join("\n");
}

export function countFeedbackRichTextEditingCharacters(
  value: FeedbackRichTextEditingState,
): number {
  return codePointLength(extractFeedbackRichTextEditingState(value));
}

function clampRange(
  text: string,
  start: number,
  end: number,
): [number, number] {
  let lower = Math.max(0, Math.min(start, end, text.length));
  let upper = Math.max(lower, Math.min(Math.max(start, end), text.length));
  const collapsed = lower === upper;
  const splitsSurrogatePair = (offset: number) =>
    offset > 0 &&
    offset < text.length &&
    text.charCodeAt(offset - 1) >= 0xd800 &&
    text.charCodeAt(offset - 1) <= 0xdbff &&
    text.charCodeAt(offset) >= 0xdc00 &&
    text.charCodeAt(offset) <= 0xdfff;
  if (splitsSurrogatePair(lower)) {
    lower -= 1;
    if (collapsed) {
      upper = lower;
    }
  }
  if (!collapsed && splitsSurrogatePair(upper)) {
    upper += 1;
  }
  return [lower, upper];
}

function pointForOffset(
  value: FeedbackRichTextEditingState,
  requestedOffset: number,
): BlockPoint {
  const maximum = extractFeedbackRichTextEditingState(value).length;
  const offset = Math.min(Math.max(0, requestedOffset), maximum);
  let blockStart = 0;
  for (let index = 0; index < value.children.length; index += 1) {
    const length = blockText(value.children[index] as FeedbackRichTextEditingBlock)
      .length;
    if (offset <= blockStart + length) {
      return {
        blockIndex: index,
        innerOffset: offset - blockStart,
      };
    }
    blockStart += length + 1;
  }
  const finalIndex = Math.max(0, value.children.length - 1);
  const finalBlock = value.children[finalIndex] as FeedbackRichTextEditingBlock;
  return { blockIndex: finalIndex, innerOffset: blockText(finalBlock).length };
}

function blockRangeForOffsets(
  value: FeedbackRichTextEditingState,
  start: number,
  end: number,
): [number, number] {
  const text = extractFeedbackRichTextEditingState(value);
  const [lower, upper] = clampRange(text, start, end);
  const first = pointForOffset(value, lower).blockIndex;
  const last =
    lower === upper
      ? first
      : pointForOffset(value, Math.max(lower, upper - 1)).blockIndex;
  return [Math.min(first, last), Math.max(first, last)];
}

function markRunCount(value: FeedbackRichTextEditingState): {
  total: number;
  maximumInBlock: number;
} {
  let total = 0;
  let maximumInBlock = 0;
  for (const block of value.children) {
    const runs = nodesFromInline(inlineFromBlock(block)).length;
    total += runs;
    maximumInBlock = Math.max(maximumInBlock, runs);
  }
  return { total, maximumInBlock };
}

function expectedCanonicalText(value: FeedbackRichTextEditingState): string {
  return value.children
    .map(blockText)
    .filter((text) => text.length > 0)
    .join("\n");
}

function candidateIsCanonicalisable(
  value: FeedbackRichTextEditingState,
): boolean {
  const expected = expectedCanonicalText(value);
  const projected = projectFeedbackRichTextEditingState(value);
  return expected.length === 0
    ? projected === null
    : projected !== null && extractFeedbackRichText(projected) === expected;
}

function withMutationValue(
  current: FeedbackRichTextEditingState,
  candidate: FeedbackRichTextEditingState,
): FeedbackRichTextEditingState {
  return editingStatesEqual(current, candidate) ? current : candidate;
}

export function replaceFeedbackRichTextEditingRange(
  value: FeedbackRichTextEditingState,
  selectionStart: number,
  selectionEnd: number,
  insertedText: string,
  insertedMarks: readonly FeedbackRichTextMark[] = [],
): FeedbackRichTextEditingMutation {
  const currentText = extractFeedbackRichTextEditingState(value);
  const [start, end] = clampRange(currentText, selectionStart, selectionEnd);
  const normalisedInsertion = normaliseInsertedText(insertedText);
  if (normalisedInsertion === null) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      violation: "unsupported-content",
    };
  }

  const startPoint = pointForOffset(value, start);
  const endPoint = pointForOffset(value, end);
  const startBlock = value.children[
    startPoint.blockIndex
  ] as FeedbackRichTextEditingBlock;
  const endBlock = value.children[
    endPoint.blockIndex
  ] as FeedbackRichTextEditingBlock;

  if (
    start === end &&
    normalisedInsertion === "\n" &&
    blockText(startBlock).length === 0
  ) {
    if (startBlock.type === "listItem") {
      const children = value.children.map((block, index) =>
        index === startPoint.blockIndex
          ? ({
              type: "paragraph",
              depth: 0,
              children: [],
            } satisfies FeedbackRichTextEditingBlock)
          : block,
      );
      return {
        value: withMutationValue(value, { children }),
        selectionStart: start,
        selectionEnd: end,
      };
    }
    return { value, selectionStart: start, selectionEnd: end };
  }

  const selectedText = currentText.slice(start, end);
  const availableCodePoints =
    FEEDBACK_RICH_TEXT_MAX_CHARACTERS -
    (codePointLength(currentText) - codePointLength(selectedText));
  const availableCodeUnits =
    FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS -
    (currentText.length - selectedText.length);
  const acceptedInsertion = safeSlice(
    normalisedInsertion,
    availableCodePoints,
    availableCodeUnits,
  );
  const violation =
    acceptedInsertion.length < normalisedInsertion.length
      ? ("character-limit" as const)
      : undefined;
  if (start === end && acceptedInsertion.length === 0) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      ...(violation ? { violation } : {}),
    };
  }

  const prefix = inlineSlice(inlineFromBlock(startBlock), 0, startPoint.innerOffset);
  const suffix = inlineSlice(inlineFromBlock(endBlock), endPoint.innerOffset);
  const insertionLines = acceptedInsertion.split("\n");
  const normalisedInsertedMarks = normaliseMarks(insertedMarks);
  const before = value.children.slice(0, startPoint.blockIndex);
  const after = value.children.slice(endPoint.blockIndex + 1);
  const replacement: FeedbackRichTextEditingBlock[] = [];

  if (insertionLines.length === 1) {
    replacement.push(
      blockWithInline(
        startBlock,
        concatInline(
          prefix,
          inlineFromText(insertionLines[0] ?? "", normalisedInsertedMarks),
          suffix,
        ),
      ),
    );
  } else {
    const firstLine = insertionLines[0] ?? "";
    replacement.push(
      blockWithInline(
        startBlock,
        concatInline(prefix, inlineFromText(firstLine, normalisedInsertedMarks)),
      ),
    );
    for (const line of insertionLines.slice(1, -1)) {
      replacement.push(
        blockWithInline(
          startBlock,
          inlineFromText(line, normalisedInsertedMarks),
        ),
      );
    }
    const finalLine = insertionLines[insertionLines.length - 1] ?? "";
    replacement.push(
      blockWithInline(
        endBlock,
        concatInline(
          inlineFromText(finalLine, normalisedInsertedMarks),
          suffix,
        ),
      ),
    );
  }

  const candidate: FeedbackRichTextEditingState = {
    children: [...before, ...replacement, ...after],
  };
  if (candidate.children.length > FEEDBACK_RICH_TEXT_MAX_BLOCKS) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      violation: "block-limit",
    };
  }
  const runs = markRunCount(candidate);
  if (
    runs.total > FEEDBACK_RICH_TEXT_MAX_NODES ||
    runs.maximumInBlock > 128
  ) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      violation: "node-limit",
    };
  }
  if (!candidateIsCanonicalisable(candidate)) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      violation: "unsupported-content",
    };
  }
  const nextOffset = start + acceptedInsertion.length;
  return {
    value: withMutationValue(value, candidate),
    selectionStart: nextOffset,
    selectionEnd: nextOffset,
    ...(violation ? { violation } : {}),
  };
}

export function deleteFeedbackRichTextEditingRange(
  value: FeedbackRichTextEditingState,
  selectionStart: number,
  selectionEnd: number,
  direction: "backward" | "forward",
): FeedbackRichTextEditingMutation {
  const text = extractFeedbackRichTextEditingState(value);
  let [start, end] = clampRange(text, selectionStart, selectionEnd);
  if (start === end) {
    if (direction === "backward" && start > 0) {
      const previousCodeUnit = text.charCodeAt(start - 1);
      const precedingCodeUnit = text.charCodeAt(start - 2);
      const beginsSurrogatePair =
        previousCodeUnit >= 0xdc00 &&
        previousCodeUnit <= 0xdfff &&
        precedingCodeUnit >= 0xd800 &&
        precedingCodeUnit <= 0xdbff;
      start -= beginsSurrogatePair ? 2 : 1;
    } else if (direction === "forward" && end < text.length) {
      const nextCodePoint = text.codePointAt(end);
      end += nextCodePoint !== undefined && nextCodePoint > 0xffff ? 2 : 1;
    }
  }
  if (start === end) {
    return { value, selectionStart: start, selectionEnd: end };
  }
  return replaceFeedbackRichTextEditingRange(value, start, end, "");
}

export function toggleFeedbackRichTextEditingMark(
  value: FeedbackRichTextEditingState,
  selectionStart: number,
  selectionEnd: number,
  mark: FeedbackRichTextMark,
): FeedbackRichTextEditingMutation {
  const text = extractFeedbackRichTextEditingState(value);
  const [start, end] = clampRange(text, selectionStart, selectionEnd);
  if (start === end) {
    return { value, selectionStart: start, selectionEnd: end };
  }
  let globalOffset = 0;
  const selectedMarks: FeedbackRichTextMark[][] = [];
  for (const block of value.children) {
    const inline = inlineFromBlock(block);
    for (let index = 0; index < inline.text.length; index += 1) {
      const offset = globalOffset + index;
      if (offset >= start && offset < end) {
        selectedMarks.push(inline.marks[index] ?? []);
      }
    }
    globalOffset += inline.text.length + 1;
  }
  const shouldRemove =
    selectedMarks.length > 0 &&
    selectedMarks.every((marks) => marks.includes(mark));
  globalOffset = 0;
  const children = value.children.map((block) => {
    const inline = inlineFromBlock(block);
    const marks = inline.marks.map((current, index) => {
      const offset = globalOffset + index;
      if (offset < start || offset >= end) {
        return current;
      }
      return normaliseMarks(
        shouldRemove
          ? current.filter((candidate) => candidate !== mark)
          : [...current, mark],
      );
    });
    globalOffset += inline.text.length + 1;
    return blockWithInline(block, { text: inline.text, marks });
  });
  const candidate = { children };
  const runs = markRunCount(candidate);
  if (
    runs.total > FEEDBACK_RICH_TEXT_MAX_NODES ||
    runs.maximumInBlock > 128
  ) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      violation: "node-limit",
    };
  }
  return {
    value: withMutationValue(value, candidate),
    selectionStart: start,
    selectionEnd: end,
  };
}

export function activeFeedbackRichTextEditingMarks(
  value: FeedbackRichTextEditingState,
  selectionStart: number,
  selectionEnd: number,
): FeedbackRichTextMark[] {
  const text = extractFeedbackRichTextEditingState(value);
  const [start, end] = clampRange(text, selectionStart, selectionEnd);
  let globalOffset = 0;
  const marksByOffset: FeedbackRichTextMark[][] = [];
  for (const block of value.children) {
    const inline = inlineFromBlock(block);
    for (let index = 0; index < inline.text.length; index += 1) {
      marksByOffset[globalOffset + index] = inline.marks[index] ?? [];
    }
    globalOffset += inline.text.length + 1;
  }
  if (start === end) {
    return normaliseMarks(
      marksByOffset[Math.max(0, Math.min(start - 1, marksByOffset.length - 1))],
    );
  }
  const indexes = Array.from(
    { length: end - start },
    (_, index) => start + index,
  ).filter((index) => text[index] !== "\n");
  return FEEDBACK_RICH_TEXT_MARKS.filter(
    (mark) =>
      indexes.length > 0 &&
      indexes.every((index) => marksByOffset[index]?.includes(mark)),
  );
}

export function selectedFeedbackRichTextEditingBlocksAreBulleted(
  value: FeedbackRichTextEditingState,
  selectionStart: number,
  selectionEnd: number,
): boolean {
  const [firstBlock, lastBlock] = blockRangeForOffsets(
    value,
    selectionStart,
    selectionEnd,
  );
  return value.children
    .slice(firstBlock, lastBlock + 1)
    .every((block) => block.type === "listItem");
}

export function toggleFeedbackRichTextEditingBullets(
  value: FeedbackRichTextEditingState,
  selectionStart: number,
  selectionEnd: number,
): FeedbackRichTextEditingMutation {
  const [firstBlock, lastBlock] = blockRangeForOffsets(
    value,
    selectionStart,
    selectionEnd,
  );
  const removeBullets = value.children
    .slice(firstBlock, lastBlock + 1)
    .every((block) => block.type === "listItem");
  const children = value.children.map((block, index) => {
    if (index < firstBlock || index > lastBlock) {
      return block;
    }
    return removeBullets
      ? ({
          type: "paragraph",
          depth: block.depth,
          children: block.children,
        } satisfies FeedbackRichTextEditingBlock)
      : ({
          type: "listItem",
          listType: "bullet",
          depth: block.depth,
          children: block.children,
        } satisfies FeedbackRichTextEditingBlock);
  });
  return {
    value: withMutationValue(value, { children }),
    selectionStart,
    selectionEnd,
  };
}

export function adjustFeedbackRichTextEditingDepth(
  value: FeedbackRichTextEditingState,
  selectionStart: number,
  selectionEnd: number,
  delta: -1 | 1,
): FeedbackRichTextEditingMutation {
  const [firstBlock, lastBlock] = blockRangeForOffsets(
    value,
    selectionStart,
    selectionEnd,
  );
  const children = value.children.map((block, index) =>
    index < firstBlock || index > lastBlock
      ? block
      : {
          ...block,
          depth: Math.min(
            FEEDBACK_RICH_TEXT_MAX_DEPTH,
            Math.max(0, block.depth + delta),
          ),
        },
  );
  return {
    value: withMutationValue(value, { children }),
    selectionStart,
    selectionEnd,
  };
}
