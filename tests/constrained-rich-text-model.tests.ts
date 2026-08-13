import { describe, expect, it } from "vitest";
import {
  FEEDBACK_RICH_TEXT_CONTRACT_VERSION,
  FEEDBACK_RICH_TEXT_MARKS,
  activeFeedbackRichTextMarks,
  adjustFeedbackRichTextDepth,
  countFeedbackRichTextCharacters,
  createFeedbackRichTextDocument,
  deleteFeedbackRichTextRange,
  extractFeedbackRichText,
  normaliseFeedbackRichTextDocument,
  replaceFeedbackRichTextRange,
  selectedFeedbackRichTextBlocksAreBulleted,
  toggleFeedbackRichTextBullets,
  toggleFeedbackRichTextMark,
  type FeedbackRichTextBlock,
  type FeedbackRichTextDocument,
} from "../src/components/constrained-rich-text-editor/model.js";

function documentWithBlocks(
  blocks: readonly FeedbackRichTextBlock[],
): FeedbackRichTextDocument {
  return {
    type: "doc",
    schemaVersion: "1",
    version: FEEDBACK_RICH_TEXT_CONTRACT_VERSION,
    children: blocks,
  };
}

describe("constrained rich-text canonicalisation", () => {
  it("keeps the exported mark allowlist immutable", () => {
    expect(Object.isFrozen(FEEDBACK_RICH_TEXT_MARKS)).toBe(true);
    expect(() =>
      (FEEDBACK_RICH_TEXT_MARKS as unknown as string[]).push("link"),
    ).toThrow(TypeError);
    expect(FEEDBACK_RICH_TEXT_MARKS).toEqual([
      "bold",
      "italic",
      "underline",
    ]);
  });

  it("returns null for absent/empty input and strips unsupported empty content", () => {
    expect(normaliseFeedbackRichTextDocument(null)).toBeNull();
    expect(createFeedbackRichTextDocument("")).toBeNull();
    expect(createFeedbackRichTextDocument("\n\n")).toBeNull();
    expect(
      normaliseFeedbackRichTextDocument(
        documentWithBlocks([
          {
            type: "paragraph",
            depth: 0,
            children: [{ type: "text", text: "\u200b\u0000" }],
          },
        ]),
      ),
    ).toBeNull();
  });

  it("merges equal marks, closes mark/depth values, and rejects invalid block shape", () => {
    const result = normaliseFeedbackRichTextDocument(
      documentWithBlocks([
        {
          type: "paragraph",
          depth: Number.NaN,
          children: [
            {
              type: "text",
              text: "A",
              marks: ["underline", "bold", "bold"] as never,
            },
            { type: "text", text: "B", marks: ["bold", "underline"] },
          ],
        },
        {
          type: "listItem",
          listType: "bullet",
          depth: 99,
          children: [{ type: "text", text: "C" }],
        },
        {
          type: "listItem",
          listType: "number" as never,
          depth: 0,
          children: [{ type: "text", text: "discarded" }],
        },
        {
          type: "unsupported" as never,
          depth: 0,
          children: [{ type: "text", text: "discarded" }],
        },
      ]),
    );

    expect(result?.children).toHaveLength(2);
    expect(result?.children[0]?.depth).toBe(0);
    expect(result?.children[0]?.children).toEqual([
      { type: "text", text: "AB", marks: ["bold", "underline"] },
    ]);
    expect(result?.children[1]?.depth).toBe(4);
    expect(result?.children[1]?.type).toBe("listItem");
  });

  it("normalises controls, carriage returns, tabs, and decomposed Unicode", () => {
    const result = createFeedbackRichTextDocument(
      "Cafe\u0301\tone\r\ntwo\u200b\u0000\u0085",
    );
    expect(extractFeedbackRichText(result)).toBe("Café  one\ntwo");
    expect(countFeedbackRichTextCharacters(result)).toBe(13);
  });

  it("fails closed for HTML/link syntax and split-node link construction", () => {
    expect(createFeedbackRichTextDocument("<strong>unsafe</strong>")).toBeNull();
    expect(createFeedbackRichTextDocument("https://invalid.example")).toBeNull();
    expect(createFeedbackRichTextDocument("www.invalid.example")).toBeNull();
    for (const disallowed of [
      "data:text/plain,synthetic",
      "blob:synthetic-object",
      "file:///synthetic/path",
      "//invalid.example/path",
    ]) {
      expect(createFeedbackRichTextDocument(disallowed)).toBeNull();
    }
    expect(
      normaliseFeedbackRichTextDocument(
        documentWithBlocks([
          {
            type: "paragraph",
            depth: 0,
            children: [
              { type: "text", text: "http", marks: ["bold"] },
              { type: "text", text: "s://invalid.example" },
            ],
          },
        ]),
      ),
    ).toBeNull();
  });

  it("rejects malformed UTF-16 and Unicode data newer than the pinned scanner profile", () => {
    const profileCanaries = [
      0x0378,
      0x1c89,
      0xa7f1,
      0x10940,
      0x11db0,
      0x16ea0,
      0x1e6c0,
      0x323b0,
    ].map((codePoint) => String.fromCodePoint(codePoint));
    const malformedUtf16 = [
      "\ud800",
      "\udfff",
      "\ud800A",
      "A\udc00",
      "\ud800\ud800",
      "\udc00\udc00",
    ];

    for (const canary of [...profileCanaries, ...malformedUtf16]) {
      expect(createFeedbackRichTextDocument(`${canary}ynthetic`)).toBeNull();
      expect(
        normaliseFeedbackRichTextDocument(
          documentWithBlocks([
            {
              type: "paragraph",
              depth: 0,
              children: [{ type: "text", text: `${canary}ynthetic` }],
            },
          ]),
        ),
      ).toBeNull();

      const current = createFeedbackRichTextDocument("safe");
      expect(
        replaceFeedbackRichTextRange(current, 4, 4, canary),
      ).toMatchObject({
        value: current,
        selectionStart: 4,
        selectionEnd: 4,
        violation: "unsupported-content",
      });
    }
  });

  it("emits only the exact feedback document identity and allowlisted fields", () => {
    const input = {
      type: "doc",
      schemaVersion: "1",
      version: FEEDBACK_RICH_TEXT_CONTRACT_VERSION,
      ignoredDocumentMetadata: "discarded",
      children: [
        {
          type: "paragraph",
          depth: 0,
          ignoredBlockMetadata: "discarded",
          children: [
            {
              type: "text",
              text: "Synthetic",
              ignoredNodeMetadata: "discarded",
            },
          ],
        },
      ],
    } as unknown as FeedbackRichTextDocument;
    const result = normaliseFeedbackRichTextDocument(input);

    expect(result).toEqual({
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [{ type: "text", text: "Synthetic" }],
        },
      ],
    });
  });

  it("rejects malformed runtime shapes without throwing or reflecting values", () => {
    expect(
      normaliseFeedbackRichTextDocument({
        type: "doc",
        schemaVersion: "1",
        version: FEEDBACK_RICH_TEXT_CONTRACT_VERSION,
        children: "not-an-array",
      } as unknown as FeedbackRichTextDocument),
    ).toBeNull();
    expect(
      normaliseFeedbackRichTextDocument({
        type: "doc",
        schemaVersion: "1",
        version: "9.9.9",
        children: [],
      } as unknown as FeedbackRichTextDocument),
    ).toBeNull();
    expect(
      normaliseFeedbackRichTextDocument({
        type: "synthetic-other-contract",
        schemaVersion: "1",
        version: FEEDBACK_RICH_TEXT_CONTRACT_VERSION,
        children: [],
      } as unknown as FeedbackRichTextDocument),
    ).toBeNull();
    expect(
      normaliseFeedbackRichTextDocument(
        documentWithBlocks([
          {
            type: "paragraph",
            depth: 0,
            children: [
              { type: "text", text: 42 as unknown as string },
              null as unknown as {
                type: "text";
                text: string;
              },
            ],
          },
        ]),
      ),
    ).toBeNull();
  });

  it("bounds blocks and nodes without returning malformed leaves", () => {
    const blocks = Array.from({ length: 140 }, (_, blockIndex) => ({
      type: "paragraph" as const,
      depth: 0,
      children: Array.from({ length: blockIndex === 0 ? 140 : 1 }, (_, index) => ({
        type: "text" as const,
        text: "x",
        marks: index % 2 === 0 ? (["bold"] as const) : undefined,
      })),
    }));
    const result = normaliseFeedbackRichTextDocument(documentWithBlocks(blocks));
    const nodeCount =
      result?.children.reduce(
        (total, block) => total + block.children.length,
        0,
      ) ?? 0;

    expect(result?.children.length).toBeLessThanOrEqual(128);
    expect(result?.children[0]?.children).toHaveLength(128);
    expect(nodeCount).toBeLessThanOrEqual(256);
  });

  it("bounds an oversized browser string before Unicode normalisation", () => {
    const result = createFeedbackRichTextDocument("x".repeat(1_000_000));

    expect(countFeedbackRichTextCharacters(result)).toBe(4_000);
    expect(extractFeedbackRichText(result)).toBe("x".repeat(4_000));
  });
});

describe("constrained rich-text mutations", () => {
  it("inserts, replaces reverse selections, normalises input, and no-ops empty input", () => {
    const initial = createFeedbackRichTextDocument("abcd");
    const replaced = replaceFeedbackRichTextRange(
      initial,
      3,
      1,
      "Cafe\u0301\t",
      ["italic", "italic"],
    );
    expect(extractFeedbackRichText(replaced.value)).toBe("aCafé  d");
    expect(replaced.selectionStart).toBe(7);
    expect(replaced.value?.children[0]?.children[1]?.marks).toEqual(["italic"]);

    const noOp = replaceFeedbackRichTextRange(initial, 0, 0, "");
    expect(noOp.value).toBe(initial);

    const astral = createFeedbackRichTextDocument("😀");
    const snapped = replaceFeedbackRichTextRange(astral, 1, 1, "x");
    expect(extractFeedbackRichText(snapped.value)).toBe("x😀");
    expect(Array.from(extractFeedbackRichText(snapped.value))).toEqual([
      "x",
      "😀",
    ]);
  });

  it("reports character, block, and node limits without splitting astral text", () => {
    const full = createFeedbackRichTextDocument("😀".repeat(4_000));
    const characterLimited = replaceFeedbackRichTextRange(
      full,
      8_000,
      8_000,
      "x",
    );
    expect(characterLimited.violation).toBe("character-limit");
    expect(characterLimited.value).toBe(full);

    const maximumBlocks = documentWithBlocks(
      Array.from({ length: 128 }, () => ({
        type: "paragraph",
        depth: 0,
        children: [{ type: "text", text: "x" }],
      })),
    );
    const blockLimited = replaceFeedbackRichTextRange(
      maximumBlocks,
      1,
      1,
      "\ny",
    );
    expect(blockLimited.violation).toBe("block-limit");

    const saturatedNodes = documentWithBlocks(
      Array.from({ length: 2 }, () => ({
        type: "paragraph",
        depth: 0,
        children: Array.from({ length: 128 }, (_, index) => ({
          type: "text",
          text: "xx",
          ...(index % 2 === 0 ? { marks: ["bold"] as const } : {}),
        })),
      })),
    );
    const nodeLimited = toggleFeedbackRichTextMark(
      saturatedNodes,
      0,
      1,
      "italic",
    );
    expect(nodeLimited.violation).toBe("node-limit");
    expect(nodeLimited.value).toBe(saturatedNodes);
  });

  it("deletes selections, adjacent text, whole emoji, and no-ops at boundaries", () => {
    const initial = createFeedbackRichTextDocument("a😀bc");
    expect(
      extractFeedbackRichText(
        deleteFeedbackRichTextRange(initial, 3, 3, "backward").value,
      ),
    ).toBe("abc");
    expect(
      extractFeedbackRichText(
        deleteFeedbackRichTextRange(initial, 1, 1, "forward").value,
      ),
    ).toBe("abc");
    expect(
      extractFeedbackRichText(
        deleteFeedbackRichTextRange(initial, 1, 4, "backward").value,
      ),
    ).toBe("ac");

    expect(deleteFeedbackRichTextRange(initial, 0, 0, "backward").value).toBe(
      initial,
    );
    expect(deleteFeedbackRichTextRange(initial, 5, 5, "forward").value).toBe(
      initial,
    );
  });

  it("applies and removes closed marks while ignoring collapsed/newline-only ranges", () => {
    const initial = createFeedbackRichTextDocument("one\ntwo");
    const bold = toggleFeedbackRichTextMark(initial, 0, 3, "bold");
    expect(activeFeedbackRichTextMarks(bold.value, 0, 3)).toContain("bold");
    expect(activeFeedbackRichTextMarks(bold.value, 1, 1)).toContain("bold");

    const removed = toggleFeedbackRichTextMark(bold.value, 0, 3, "bold");
    expect(activeFeedbackRichTextMarks(removed.value, 0, 3)).not.toContain(
      "bold",
    );
    expect(toggleFeedbackRichTextMark(initial, 1, 1, "italic").value).toBe(
      initial,
    );
    expect(toggleFeedbackRichTextMark(initial, 3, 4, "italic").value).toBe(
      initial,
    );
    expect(activeFeedbackRichTextMarks(initial, 0, 7)).toEqual([]);
    expect(activeFeedbackRichTextMarks(null, 0, 0)).toEqual([]);
  });

  it("toggles bullets and adjusts only selected block depths with closed limits", () => {
    const initial = createFeedbackRichTextDocument("one\ntwo");
    const bullets = toggleFeedbackRichTextBullets(initial, 0, 3);
    expect(bullets.value?.children[0]?.type).toBe("listItem");
    expect(bullets.value?.children[1]?.type).toBe("paragraph");
    expect(
      selectedFeedbackRichTextBlocksAreBulleted(bullets.value, 0, 3),
    ).toBe(true);
    expect(
      selectedFeedbackRichTextBlocksAreBulleted(bullets.value, 4, 7),
    ).toBe(false);

    const removed = toggleFeedbackRichTextBullets(bullets.value, 0, 3);
    expect(removed.value?.children[0]?.type).toBe("paragraph");

    const indented = adjustFeedbackRichTextDepth(initial, 0, 3, 1);
    expect(indented.value?.children.map((block) => block.depth)).toEqual([1, 0]);
    const outdented = adjustFeedbackRichTextDepth(indented.value, 0, 3, -1);
    expect(outdented.value?.children[0]?.depth).toBe(0);
    expect(adjustFeedbackRichTextDepth(outdented.value, 0, 3, -1).value).toBe(
      outdented.value,
    );
    expect(toggleFeedbackRichTextBullets(null, 0, 0).value).toBeNull();
    expect(selectedFeedbackRichTextBlocksAreBulleted(null, 0, 0)).toBe(false);
    expect(adjustFeedbackRichTextDepth(null, 0, 0, 1).value).toBeNull();
  });
});
