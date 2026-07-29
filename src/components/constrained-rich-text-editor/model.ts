/** Exact contract version shared with `@plasius/schema` feedback AST v1. */
export const FEEDBACK_RICH_TEXT_CONTRACT_VERSION = "1.0.0" as const;
/** Exact Unicode-code-point ceiling, including block-separator newlines. */
export const FEEDBACK_RICH_TEXT_MAX_CHARACTERS = 4_000;
/** Defensive browser/scanner ceiling for the UTF-16 encoded representation. */
export const FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS = 8_000;
/** Maximum blocks accepted by the feedback AST contract. */
export const FEEDBACK_RICH_TEXT_MAX_BLOCKS = 128;
/** Maximum total text leaves accepted by the feedback AST contract. */
export const FEEDBACK_RICH_TEXT_MAX_NODES = 256;
/** Maximum indentation depth accepted by the feedback AST contract. */
export const FEEDBACK_RICH_TEXT_MAX_DEPTH = 4;

export const FEEDBACK_RICH_TEXT_MARKS = Object.freeze([
  "bold",
  "italic",
  "underline",
] as const);

export type FeedbackRichTextMark = (typeof FEEDBACK_RICH_TEXT_MARKS)[number];

export interface FeedbackRichTextNode {
  type: "text";
  text: string;
  marks?: readonly FeedbackRichTextMark[];
}

export type FeedbackRichTextBlock =
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

/**
 * Transient, browser-only rich-text document. This is structurally identical
 * to `FeedbackRichTextDocument` in `@plasius/schema` 1.0 feedback contracts.
 */
export interface FeedbackRichTextDocument {
  type: "doc";
  schemaVersion: "1";
  version: typeof FEEDBACK_RICH_TEXT_CONTRACT_VERSION;
  children: readonly FeedbackRichTextBlock[];
}

export type FeedbackRichTextConstraint =
  | "character-limit"
  | "block-limit"
  | "node-limit"
  | "unsupported-content";

interface BlockMetadata {
  type: FeedbackRichTextBlock["type"];
  depth: number;
}

interface FlatDocument {
  text: string;
  marks: FeedbackRichTextMark[][];
  metadata: BlockMetadata[];
}

export interface FeedbackRichTextMutation {
  value: FeedbackRichTextDocument | null;
  selectionStart: number;
  selectionEnd: number;
  violation?: FeedbackRichTextConstraint;
}

const unicodeFormatPattern = /\p{Cf}/gu;
const unicodeControlPattern = /\p{Cc}/u;
const unicodeUnassignedPattern = /\p{Cn}/u;
const disallowedNarrativeSyntaxPattern =
  /<|>|(?:https?|ftp|mailto|javascript|data|blob|file):|\/\/|www\.|\]\s*\(/i;
/**
 * U+1C89 and U+A7F1 are unassigned in the scanner's pinned Unicode 15.1
 * profile but are assigned by newer runtimes; U+A7F1 also gains a
 * compatibility mapping. Reject both before runtime-dependent normalization
 * so browser and scanner decisions cannot diverge.
 */
const postProfileCompatibilityCodePointPattern = /[\u1C89\uA7F1]/u;

function containsDisallowedUnicodeProfileCodePoint(text: string): boolean {
  return (
    unicodeUnassignedPattern.test(text) ||
    postProfileCompatibilityCodePointPattern.test(text)
  );
}

function nodeContainsDisallowedUnicodeProfileCodePoint(node: unknown): boolean {
  if (!node || typeof node !== "object") {
    return false;
  }
  const candidate = node as Record<string, unknown>;
  return (
    candidate.type === "text" &&
    typeof candidate.text === "string" &&
    containsDisallowedUnicodeProfileCodePoint(candidate.text)
  );
}

function stripControlCharacters(text: string, allowNewlines: boolean): string {
  return [...text]
    .filter((character) => {
      if (allowNewlines && (character === "\n" || character === "\t")) {
        return true;
      }
      return !unicodeControlPattern.test(character);
    })
    .join("");
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

function documentsEqual(
  left: FeedbackRichTextDocument | null,
  right: FeedbackRichTextDocument | null,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right || left.children.length !== right.children.length) {
    return false;
  }
  return left.children.every((leftBlock, blockIndex) => {
    const rightBlock = right.children[blockIndex];
    if (
      !rightBlock ||
      leftBlock.type !== rightBlock.type ||
      leftBlock.depth !== rightBlock.depth ||
      leftBlock.children.length !== rightBlock.children.length ||
      (leftBlock.type === "listItem" &&
        (rightBlock.type !== "listItem" ||
          leftBlock.listType !== rightBlock.listType))
    ) {
      return false;
    }
    return leftBlock.children.every((leftNode, nodeIndex) => {
      const rightNode = rightBlock.children[nodeIndex];
      return (
        rightNode !== undefined &&
        leftNode.type === rightNode.type &&
        leftNode.text === rightNode.text &&
        marksEqual(
          normaliseMarks(leftNode.marks),
          normaliseMarks(rightNode.marks),
        )
      );
    });
  });
}

function normaliseMarks(
  marks: readonly FeedbackRichTextMark[] | undefined,
): FeedbackRichTextMark[] {
  const boundedMarks = Array.isArray(marks)
    ? marks.slice(0, FEEDBACK_RICH_TEXT_MARKS.length + 1)
    : [];
  return FEEDBACK_RICH_TEXT_MARKS.filter(
    (mark) => boundedMarks.includes(mark),
  );
}

function normaliseInlineText(text: string): string {
  const boundedText = safeSlice(
    text,
    FEEDBACK_RICH_TEXT_MAX_CHARACTERS + 1,
    FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS + 1,
  );
  return stripControlCharacters(
    boundedText
      .normalize("NFKC")
      .replace(unicodeFormatPattern, "")
      .replace(/[\r\n]/g, " "),
    false,
  );
}

function normaliseInsertedText(text: string): string {
  const boundedText = safeSlice(
    text,
    FEEDBACK_RICH_TEXT_MAX_CHARACTERS + 1,
    FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS + 1,
  );
  return stripControlCharacters(
    boundedText
      .replace(/\r\n?/g, "\n")
      .normalize("NFKC")
      .replace(unicodeFormatPattern, ""),
    true,
  ).replace(/\t/g, "  ");
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

function mergeNodes(
  nodes: readonly FeedbackRichTextNode[],
): FeedbackRichTextNode[] {
  const merged: FeedbackRichTextNode[] = [];
  for (const node of nodes.slice(0, FEEDBACK_RICH_TEXT_MAX_NODES + 1)) {
    if (
      !node ||
      node.type !== "text" ||
      typeof node.text !== "string"
    ) {
      continue;
    }
    const text = normaliseInlineText(node.text);
    if (!text) {
      continue;
    }
    const marks = normaliseMarks(node.marks);
    const previous = merged[merged.length - 1];
    if (
      previous &&
      marksEqual(normaliseMarks(previous.marks), marks)
    ) {
      previous.text += text;
      continue;
    }
    merged.push({
      type: "text",
      text,
      ...(marks.length > 0 ? { marks } : {}),
    });
  }
  return merged;
}

/**
 * Returns a canonical document whose extracted representation cannot exceed
 * the schema limits. Empty/unsupported blocks and marks are discarded.
 */
export function normaliseFeedbackRichTextDocument(
  value: FeedbackRichTextDocument | null | undefined,
): FeedbackRichTextDocument | null {
  if (
    !value ||
    typeof value !== "object" ||
    value.type !== "doc" ||
    value.schemaVersion !== "1" ||
    value.version !== FEEDBACK_RICH_TEXT_CONTRACT_VERSION ||
    !Array.isArray(value.children)
  ) {
    return null;
  }

  const blocks: FeedbackRichTextBlock[] = [];
  let remainingCodePoints = FEEDBACK_RICH_TEXT_MAX_CHARACTERS;
  let remainingCodeUnits = FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS;
  let totalNodes = 0;

  for (const candidate of value.children.slice(0, FEEDBACK_RICH_TEXT_MAX_BLOCKS)) {
    if (
      !candidate ||
      typeof candidate !== "object" ||
      candidate.type !== "paragraph" &&
      candidate.type !== "listItem"
    ) {
      continue;
    }
    if (
      candidate.type === "listItem" &&
      candidate.listType !== "bullet"
    ) {
      continue;
    }
    if (!Array.isArray(candidate.children)) {
      continue;
    }
    if (
      candidate.children.some(nodeContainsDisallowedUnicodeProfileCodePoint)
    ) {
      return null;
    }

    const separatorCost = blocks.length > 0 ? 1 : 0;
    if (
      remainingCodePoints <= separatorCost ||
      remainingCodeUnits <= separatorCost
    ) {
      break;
    }

    const sourceNodes = mergeNodes(candidate.children);
    if (
      sourceNodes.some((node) =>
        disallowedNarrativeSyntaxPattern.test(node.text),
      ) ||
      disallowedNarrativeSyntaxPattern.test(
        sourceNodes.map((node) => node.text).join(""),
      )
    ) {
      return null;
    }
    const acceptedNodes: FeedbackRichTextNode[] = [];
    let blockRemainingCodePoints = remainingCodePoints - separatorCost;
    let blockRemainingCodeUnits = remainingCodeUnits - separatorCost;
    for (const sourceNode of sourceNodes) {
      if (
        totalNodes + acceptedNodes.length >= FEEDBACK_RICH_TEXT_MAX_NODES ||
        acceptedNodes.length >= 128 ||
        blockRemainingCodePoints <= 0 ||
        blockRemainingCodeUnits <= 0
      ) {
        break;
      }
      const text = safeSlice(
        sourceNode.text,
        blockRemainingCodePoints,
        blockRemainingCodeUnits,
      );
      if (!text) {
        continue;
      }
      acceptedNodes.push({
        ...sourceNode,
        text,
      });
      blockRemainingCodePoints -= codePointLength(text);
      blockRemainingCodeUnits -= text.length;
    }

    if (acceptedNodes.length === 0) {
      continue;
    }

    const depth = Number.isFinite(candidate.depth)
      ? Math.min(
          FEEDBACK_RICH_TEXT_MAX_DEPTH,
          Math.max(0, Math.trunc(candidate.depth)),
        )
      : 0;
    blocks.push(
      candidate.type === "listItem"
        ? {
            type: "listItem",
            listType: "bullet",
            depth,
            children: acceptedNodes,
          }
        : {
            type: "paragraph",
            depth,
            children: acceptedNodes,
          },
    );
    const acceptedCodePoints = acceptedNodes.reduce(
      (total, node) => total + codePointLength(node.text),
      0,
    );
    const acceptedCodeUnits = acceptedNodes.reduce(
      (total, node) => total + node.text.length,
      0,
    );
    remainingCodePoints -= separatorCost + acceptedCodePoints;
    remainingCodeUnits -= separatorCost + acceptedCodeUnits;
    totalNodes += acceptedNodes.length;
  }

  if (blocks.length === 0) {
    return null;
  }
  if (
    disallowedNarrativeSyntaxPattern.test(
      blocks
        .map((block) => block.children.map((node) => node.text).join(""))
        .join("\n"),
    )
  ) {
    return null;
  }
  return {
    type: "doc",
    schemaVersion: "1",
    version: FEEDBACK_RICH_TEXT_CONTRACT_VERSION,
    children: blocks,
  };
}

/** Creates a canonical paragraph document from transient plain text. */
export function createFeedbackRichTextDocument(
  text: string,
): FeedbackRichTextDocument | null {
  if (containsDisallowedUnicodeProfileCodePoint(text)) {
    return null;
  }
  const blocks = normaliseInsertedText(text)
    .split("\n")
    .filter((line) => line.length > 0)
    .map(
      (line): FeedbackRichTextBlock => ({
        type: "paragraph",
        depth: 0,
        children: [{ type: "text", text: line }],
      }),
    );
  return normaliseFeedbackRichTextDocument({
    type: "doc",
    schemaVersion: "1",
    version: FEEDBACK_RICH_TEXT_CONTRACT_VERSION,
    children: blocks,
  });
}

/**
 * Extracts transient text with one newline per block boundary. Callers must
 * never log, persist, cache, or send this return value without privacy
 * processing.
 */
export function extractFeedbackRichText(
  value: FeedbackRichTextDocument | null | undefined,
): string {
  const normalised = normaliseFeedbackRichTextDocument(value);
  return (
    normalised?.children
      .map((block) => block.children.map((node) => node.text).join(""))
      .join("\n") ?? ""
  );
}

/** Counts extracted Unicode code points, including block separators. */
export function countFeedbackRichTextCharacters(
  value: FeedbackRichTextDocument | null | undefined,
): number {
  return codePointLength(extractFeedbackRichText(value));
}

function flattenDocument(
  value: FeedbackRichTextDocument | null | undefined,
): FlatDocument {
  const normalised = normaliseFeedbackRichTextDocument(value);
  if (!normalised) {
    return { text: "", marks: [], metadata: [] };
  }

  let text = "";
  const marks: FeedbackRichTextMark[][] = [];
  const metadata: BlockMetadata[] = [];
  normalised.children.forEach((block, blockIndex) => {
    if (blockIndex > 0) {
      text += "\n";
      marks.push([]);
      metadata.push({
        type: normalised.children[blockIndex - 1]?.type ?? "paragraph",
        depth: normalised.children[blockIndex - 1]?.depth ?? 0,
      });
    }
    for (const node of block.children) {
      text += node.text;
      const nodeMarks = normaliseMarks(node.marks);
      for (let index = 0; index < node.text.length; index += 1) {
        marks.push([...nodeMarks]);
        metadata.push({ type: block.type, depth: block.depth });
      }
    }
  });
  return { text, marks, metadata };
}

function documentFromFlat(
  flat: FlatDocument,
): FeedbackRichTextDocument | null {
  if (!flat.text) {
    return null;
  }

  const blocks: FeedbackRichTextBlock[] = [];
  let lineStart = 0;
  const lines = flat.text.split("\n");
  lines.forEach((line, lineIndex) => {
    const lineEnd = lineStart + line.length;
    if (line.length > 0) {
      const nodes: FeedbackRichTextNode[] = [];
      let runStart = lineStart;
      while (runStart < lineEnd) {
        const runMarks = normaliseMarks(flat.marks[runStart]);
        let runEnd = runStart + 1;
        while (
          runEnd < lineEnd &&
          marksEqual(runMarks, normaliseMarks(flat.marks[runEnd]))
        ) {
          runEnd += 1;
        }
        nodes.push({
          type: "text",
          text: flat.text.slice(runStart, runEnd),
          ...(runMarks.length > 0 ? { marks: runMarks } : {}),
        });
        runStart = runEnd;
      }
      const blockMetadata =
        flat.metadata[lineStart] ??
        flat.metadata[Math.max(0, lineStart - 1)] ?? {
          type: "paragraph",
          depth: 0,
        };
      blocks.push(
        blockMetadata.type === "listItem"
          ? {
              type: "listItem",
              listType: "bullet",
              depth: blockMetadata.depth,
              children: nodes,
            }
          : {
              type: "paragraph",
              depth: blockMetadata.depth,
              children: nodes,
            },
      );
    }
    lineStart = lineEnd + (lineIndex < lines.length - 1 ? 1 : 0);
  });

  return normaliseFeedbackRichTextDocument({
    type: "doc",
    schemaVersion: "1",
    version: FEEDBACK_RICH_TEXT_CONTRACT_VERSION,
    children: blocks,
  });
}

function markRunCount(flat: FlatDocument): {
  total: number;
  maximumInBlock: number;
} {
  let total = 0;
  let inBlock = 0;
  let maximumInBlock = 0;
  let previousMarks: FeedbackRichTextMark[] | null = null;
  for (let index = 0; index < flat.text.length; index += 1) {
    if (flat.text[index] === "\n") {
      maximumInBlock = Math.max(maximumInBlock, inBlock);
      inBlock = 0;
      previousMarks = null;
      continue;
    }
    const marks = normaliseMarks(flat.marks[index]);
    if (!previousMarks || !marksEqual(previousMarks, marks)) {
      total += 1;
      inBlock += 1;
      previousMarks = marks;
    }
  }
  return {
    total,
    maximumInBlock: Math.max(maximumInBlock, inBlock),
  };
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

function metadataAt(flat: FlatDocument, offset: number): BlockMetadata {
  return (
    flat.metadata[Math.min(offset, flat.metadata.length - 1)] ??
    flat.metadata[Math.max(0, offset - 1)] ?? {
      type: "paragraph",
      depth: 0,
    }
  );
}

/** @internal Model operation used by the constrained editor implementation. */
export function replaceFeedbackRichTextRange(
  value: FeedbackRichTextDocument | null,
  selectionStart: number,
  selectionEnd: number,
  insertedText: string,
  insertedMarks: readonly FeedbackRichTextMark[] = [],
): FeedbackRichTextMutation {
  const flat = flattenDocument(value);
  const [start, end] = clampRange(flat.text, selectionStart, selectionEnd);
  if (containsDisallowedUnicodeProfileCodePoint(insertedText)) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      violation: "unsupported-content",
    };
  }
  const normalisedInsertion = normaliseInsertedText(insertedText);
  if (disallowedNarrativeSyntaxPattern.test(normalisedInsertion)) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      violation: "unsupported-content",
    };
  }
  const selectedText = flat.text.slice(start, end);
  const availableCodePoints =
    FEEDBACK_RICH_TEXT_MAX_CHARACTERS -
    (codePointLength(flat.text) - codePointLength(selectedText));
  const availableCodeUnits =
    FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS -
    (flat.text.length - selectedText.length);
  const acceptedInsertion = safeSlice(
    normalisedInsertion,
    availableCodePoints,
    availableCodeUnits,
  );
  const violation =
    acceptedInsertion.length < normalisedInsertion.length
      ? "character-limit"
      : undefined;
  const candidateText =
    flat.text.slice(0, start) + acceptedInsertion + flat.text.slice(end);
  if (disallowedNarrativeSyntaxPattern.test(candidateText)) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      violation: "unsupported-content",
    };
  }

  if (candidateText.split("\n").length > FEEDBACK_RICH_TEXT_MAX_BLOCKS) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      violation: "block-limit",
    };
  }

  const insertionMetadata = metadataAt(flat, start);
  const insertionMarks = normaliseMarks(insertedMarks);
  const candidateMarks = [
    ...flat.marks.slice(0, start),
    ...Array.from({ length: acceptedInsertion.length }, (_, index) =>
      acceptedInsertion[index] === "\n" ? [] : [...insertionMarks],
    ),
    ...flat.marks.slice(end),
  ];
  const candidateMetadata = [
    ...flat.metadata.slice(0, start),
    ...Array.from({ length: acceptedInsertion.length }, () => ({
      ...insertionMetadata,
    })),
    ...flat.metadata.slice(end),
  ];
  const candidateFlat = {
    text: candidateText,
    marks: candidateMarks,
    metadata: candidateMetadata,
  };
  const runs = markRunCount(candidateFlat);
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
  if (candidateText === flat.text && start === end) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      ...(violation ? { violation } : {}),
    };
  }
  const nextValue = documentFromFlat(candidateFlat);
  if (documentsEqual(value, nextValue)) {
    return {
      value,
      selectionStart: start,
      selectionEnd: end,
      ...(violation ? { violation } : {}),
    };
  }

  const nextOffset = start + acceptedInsertion.length;
  return {
    value: nextValue,
    selectionStart: nextOffset,
    selectionEnd: nextOffset,
    ...(violation ? { violation } : {}),
  };
}

/** @internal Deletes a selection or one adjacent code point. */
export function deleteFeedbackRichTextRange(
  value: FeedbackRichTextDocument | null,
  selectionStart: number,
  selectionEnd: number,
  direction: "backward" | "forward",
): FeedbackRichTextMutation {
  const flat = flattenDocument(value);
  let [start, end] = clampRange(flat.text, selectionStart, selectionEnd);
  if (start === end) {
    if (direction === "backward" && start > 0) {
      const previousCodeUnit = flat.text.charCodeAt(start - 1);
      const precedingCodeUnit = flat.text.charCodeAt(start - 2);
      const beginsSurrogatePair =
        previousCodeUnit >= 0xdc00 &&
        previousCodeUnit <= 0xdfff &&
        precedingCodeUnit >= 0xd800 &&
        precedingCodeUnit <= 0xdbff;
      start -= beginsSurrogatePair ? 2 : 1;
    } else if (direction === "forward" && end < flat.text.length) {
      const nextCodePoint = flat.text.codePointAt(end);
      end += nextCodePoint !== undefined && nextCodePoint > 0xffff ? 2 : 1;
    }
  }
  if (start === end) {
    return { value, selectionStart: start, selectionEnd: end };
  }
  return replaceFeedbackRichTextRange(value, start, end, "");
}

/** @internal Applies/removes one allowlisted mark across a selection. */
export function toggleFeedbackRichTextMark(
  value: FeedbackRichTextDocument | null,
  selectionStart: number,
  selectionEnd: number,
  mark: FeedbackRichTextMark,
): FeedbackRichTextMutation {
  const flat = flattenDocument(value);
  const [start, end] = clampRange(flat.text, selectionStart, selectionEnd);
  if (start === end) {
    return { value, selectionStart: start, selectionEnd: end };
  }
  const selectedIndexes = Array.from(
    { length: end - start },
    (_, index) => start + index,
  ).filter((index) => flat.text[index] !== "\n");
  const selectedIndexSet = new Set(selectedIndexes);
  const shouldRemove =
    selectedIndexes.length > 0 &&
    selectedIndexes.every((index) => flat.marks[index]?.includes(mark));
  if (selectedIndexes.length === 0) {
    return { value, selectionStart: start, selectionEnd: end };
  }
  const nextMarks = flat.marks.map((marks, index) => {
    if (!selectedIndexSet.has(index)) {
      return marks;
    }
    return normaliseMarks(
      shouldRemove
        ? marks.filter((candidate) => candidate !== mark)
        : [...marks, mark],
    );
  });
  const candidateFlat = { ...flat, marks: nextMarks };
  const runs = markRunCount(candidateFlat);
  return runs.total > FEEDBACK_RICH_TEXT_MAX_NODES ||
    runs.maximumInBlock > 128
    ? {
        value,
        selectionStart: start,
        selectionEnd: end,
        violation: "node-limit",
      }
    : {
        value: documentFromFlat(candidateFlat),
        selectionStart: start,
        selectionEnd: end,
      };
}

function blockRangeForOffsets(
  value: FeedbackRichTextDocument | null,
  start: number,
  end: number,
): [number, number] {
  const normalised = normaliseFeedbackRichTextDocument(value);
  if (!normalised) {
    return [0, 0];
  }
  const starts: number[] = [];
  let offset = 0;
  normalised.children.forEach((block, index) => {
    starts.push(offset);
    offset +=
      block.children.reduce((total, node) => total + node.text.length, 0) +
      (index < normalised.children.length - 1 ? 1 : 0);
  });
  const findBlock = (target: number) => {
    let result = 0;
    starts.forEach((blockStart, index) => {
      if (blockStart <= target) {
        result = index;
      }
    });
    return result;
  };
  return [findBlock(start), findBlock(Math.max(start, end - 1))];
}

/** @internal Reports the list state for every block touched by a selection. */
export function selectedFeedbackRichTextBlocksAreBulleted(
  value: FeedbackRichTextDocument | null,
  selectionStart: number,
  selectionEnd: number,
): boolean {
  const normalised = normaliseFeedbackRichTextDocument(value);
  if (!normalised) {
    return false;
  }
  const [firstBlock, lastBlock] = blockRangeForOffsets(
    normalised,
    selectionStart,
    selectionEnd,
  );
  return normalised.children
    .slice(firstBlock, lastBlock + 1)
    .every((block) => block.type === "listItem");
}

/** @internal Toggles bullet-list shape for every selected block. */
export function toggleFeedbackRichTextBullets(
  value: FeedbackRichTextDocument | null,
  selectionStart: number,
  selectionEnd: number,
): FeedbackRichTextMutation {
  const normalised = normaliseFeedbackRichTextDocument(value);
  if (!normalised) {
    return { value, selectionStart, selectionEnd };
  }
  const [firstBlock, lastBlock] = blockRangeForOffsets(
    normalised,
    selectionStart,
    selectionEnd,
  );
  const selectedBlocks = normalised.children.slice(firstBlock, lastBlock + 1);
  const removeBullets = selectedBlocks.every(
    (block) => block.type === "listItem",
  );
  const children = normalised.children.map((block, index) => {
    if (index < firstBlock || index > lastBlock) {
      return block;
    }
    return removeBullets
      ? ({
          type: "paragraph",
          depth: block.depth,
          children: block.children,
        } satisfies FeedbackRichTextBlock)
      : ({
          type: "listItem",
          listType: "bullet",
          depth: block.depth,
          children: block.children,
        } satisfies FeedbackRichTextBlock);
  });
  return {
    value: { ...normalised, children },
    selectionStart,
    selectionEnd,
  };
}

/** @internal Adjusts selected block indentation inside the closed 0–4 range. */
export function adjustFeedbackRichTextDepth(
  value: FeedbackRichTextDocument | null,
  selectionStart: number,
  selectionEnd: number,
  delta: -1 | 1,
): FeedbackRichTextMutation {
  const normalised = normaliseFeedbackRichTextDocument(value);
  if (!normalised) {
    return { value, selectionStart, selectionEnd };
  }
  const [firstBlock, lastBlock] = blockRangeForOffsets(
    normalised,
    selectionStart,
    selectionEnd,
  );
  const children = normalised.children.map((block, index) =>
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
  const changed = children.some(
    (block, index) => block.depth !== normalised.children[index]?.depth,
  );
  return {
    value: changed ? { ...normalised, children } : value,
    selectionStart,
    selectionEnd,
  };
}

/** @internal Computes allowlisted marks active across/collapsed at a selection. */
export function activeFeedbackRichTextMarks(
  value: FeedbackRichTextDocument | null,
  selectionStart: number,
  selectionEnd: number,
): FeedbackRichTextMark[] {
  const flat = flattenDocument(value);
  const [start, end] = clampRange(flat.text, selectionStart, selectionEnd);
  if (start === end) {
    return normaliseMarks(
      flat.marks[Math.max(0, Math.min(start - 1, flat.marks.length - 1))],
    );
  }
  const indexes = Array.from(
    { length: end - start },
    (_, index) => start + index,
  ).filter((index) => flat.text[index] !== "\n");
  return FEEDBACK_RICH_TEXT_MARKS.filter(
    (mark) =>
      indexes.length > 0 &&
      indexes.every((index) => flat.marks[index]?.includes(mark)),
  );
}
