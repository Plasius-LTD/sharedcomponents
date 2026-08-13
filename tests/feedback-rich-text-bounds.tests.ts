import { beforeEach, describe, expect, it, vi } from "vitest";

const { profileScanSpy } = vi.hoisted(() => ({
  profileScanSpy: vi.fn<(text: string) => boolean>(),
}));

vi.mock(
  "@plasius/schema/feedback-unicode-profile",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@plasius/schema/feedback-unicode-profile")
      >();
    profileScanSpy.mockImplementation((text: string) =>
      actual.containsFeedbackUnicodeProfileUnsupportedText(text),
    );
    return {
      ...actual,
      containsFeedbackUnicodeProfileUnsupportedText: profileScanSpy,
    };
  },
);
import {
  extractFeedbackRichText,
  FEEDBACK_RICH_TEXT_MAX_BLOCKS,
  FEEDBACK_RICH_TEXT_MAX_NODES,
  FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS,
  normaliseFeedbackRichTextDocument,
  replaceFeedbackRichTextRange,
  type FeedbackRichTextBlock,
  type FeedbackRichTextDocument,
  type FeedbackRichTextNode,
} from "../src/components/constrained-rich-text-editor/model.js";
import {
  createFeedbackRichTextEditingState,
  replaceFeedbackRichTextEditingRange,
} from "../src/components/constrained-rich-text-editor/editing-state.js";

function isArrayIndex(property: string | symbol): boolean {
  return typeof property === "string" && /^(?:0|[1-9]\d*)$/.test(property);
}

describe("feedback rich-text defensive bounds", () => {
  beforeEach(() => {
    profileScanSpy.mockClear();
  });

  it("visits no more than the closed node ceiling in a dense oversized array", () => {
    const node: FeedbackRichTextNode = { type: "text", text: "x" };
    let indexedReads = 0;
    const nodes = new Proxy(
      Array.from({ length: 20_000 }, () => node),
      {
        get(target, property, receiver) {
          if (isArrayIndex(property)) {
            indexedReads += 1;
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );
    const document: FeedbackRichTextDocument = {
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: nodes,
        },
        {
          type: "paragraph",
          depth: 0,
          children: nodes,
        },
      ],
    };

    const normalised = normaliseFeedbackRichTextDocument(document);

    expect(indexedReads).toBe(FEEDBACK_RICH_TEXT_MAX_NODES);
    expect(extractFeedbackRichText(normalised)).toBe(
      `${"x".repeat(128)}\n${"x".repeat(128)}`,
    );
  });

  it("visits no more than the closed block ceiling in a dense oversized array", () => {
    const emptyBlock: FeedbackRichTextBlock = {
      type: "paragraph",
      depth: 0,
      children: [],
    };
    let indexedReads = 0;
    const blocks = new Proxy(
      Array.from({ length: 20_000 }, () => emptyBlock),
      {
        get(target, property, receiver) {
          if (isArrayIndex(property)) {
            indexedReads += 1;
          }
          return Reflect.get(target, property, receiver);
        },
      },
    );

    const normalised = normaliseFeedbackRichTextDocument({
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: blocks,
    });

    expect(normalised).toBeNull();
    expect(indexedReads).toBe(FEEDBACK_RICH_TEXT_MAX_BLOCKS);
  });

  it("bounds profile and normalisation inputs before inspecting a huge string", () => {
    const normalisationInputLengths: number[] = [];
    const originalNormalise = String.prototype.normalize;
    const normaliseSpy = vi
      .spyOn(String.prototype, "normalize")
      .mockImplementation(function (
        this: string,
        form?: "NFC" | "NFD" | "NFKC" | "NFKD",
      ) {
        const value = String(this);
        normalisationInputLengths.push(value.length);
        return originalNormalise.call(value, form);
      });

    let normalised: FeedbackRichTextDocument | null;
    try {
      normalised = normaliseFeedbackRichTextDocument({
        type: "doc",
        schemaVersion: "1",
        version: "1.0.0",
        children: [
          {
            type: "paragraph",
            depth: 0,
            children: [
              {
                type: "text",
                text: "x".repeat(1_000_000),
              },
            ],
          },
        ],
      });
      replaceFeedbackRichTextRange(
        null,
        0,
        0,
        "\t".repeat(1_000_000),
      );
      replaceFeedbackRichTextEditingRange(
        createFeedbackRichTextEditingState(null),
        0,
        0,
        "x".repeat(1_000_000),
      );
    } finally {
      normaliseSpy.mockRestore();
    }

    const profileInputLengths = profileScanSpy.mock.calls.map(
      ([text]) => text.length,
    );
    expect(extractFeedbackRichText(normalised)).toHaveLength(4_000);
    expect(profileInputLengths.length).toBeGreaterThan(0);
    expect(normalisationInputLengths.length).toBeGreaterThan(0);
    expect(Math.max(...profileInputLengths)).toBeLessThanOrEqual(
      FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS,
    );
    expect(Math.max(...normalisationInputLengths)).toBeLessThanOrEqual(
      FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS,
    );
  });

  it("keeps the pinned Unicode-profile canaries fail closed inside the bound", () => {
    const normalised = normaliseFeedbackRichTextDocument({
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [
            {
              type: "text",
              text: `${"x".repeat(
                FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS - 1,
              )}\u1C89`,
            },
          ],
        },
      ],
    });

    expect(normalised).toBeNull();
  });
});
