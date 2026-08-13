import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  createFeedbackRichTextDocument,
  countFeedbackRichTextCharacters,
  extractFeedbackRichText,
  FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS,
  normaliseFeedbackRichTextDocument,
  type FeedbackRichTextDocument,
} from "../src/components/constrained-rich-text-editor/model.js";
import {
  ConstrainedRichTextEditorImplementation,
  type ConstrainedRichTextEditorLabels,
} from "../src/components/constrained-rich-text-editor/ConstrainedRichTextEditor.js";
import { ConstrainedRichTextEditor } from "../src/components/constrained-rich-text-editor/lazy.js";

const labels: ConstrainedRichTextEditorLabels = {
  editor: "Tell us more",
  toolbar: "Text formatting",
  bold: "Bold",
  italic: "Italic",
  underline: "Underline",
  bullets: "Bulleted list",
  indent: "Increase indent",
  outdent: "Decrease indent",
  loading: "Loading editor",
};

function ControlledEditor({
  initialValue = null,
  onValue,
}: {
  initialValue?: FeedbackRichTextDocument | null;
  onValue?: (value: FeedbackRichTextDocument | null) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ConstrainedRichTextEditorImplementation
      labels={labels}
      placeholder="Optional details"
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onValue?.(nextValue);
      }}
    />
  );
}

function selectEditorText(editor: HTMLElement, start: number, end: number) {
  editor.focus();
  const textNodes = Array.from(
    editor.querySelectorAll("[data-feedback-node]"),
  ).map((node) => node.firstChild as Node);
  const locate = (target: number) => {
    let remaining = target;
    for (const textNode of textNodes) {
      const length = textNode.textContent?.length ?? 0;
      if (remaining <= length) {
        return { textNode, offset: remaining };
      }
      remaining -= length;
    }
    const finalNode = textNodes.at(-1);
    return {
      textNode: finalNode,
      offset: finalNode?.textContent?.length ?? 0,
    };
  };
  const rangeStart = locate(start);
  const rangeEnd = locate(end);
  expect(rangeStart.textNode).toBeTruthy();
  expect(rangeEnd.textNode).toBeTruthy();
  const selection = window.getSelection();
  const range = document.createRange();
  range.setStart(rangeStart.textNode as Node, rangeStart.offset);
  range.setEnd(rangeEnd.textNode as Node, rangeEnd.offset);
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent.mouseUp(editor);
}

function selectEditorBlock(
  editor: HTMLElement,
  blockIndex: number,
  offset = 0,
) {
  editor.focus();
  const block = editor.querySelector<HTMLElement>(
    `[data-block-index="${blockIndex}"]`,
  );
  expect(block).toBeTruthy();
  const textNode = block?.querySelector("[data-feedback-node]")?.firstChild;
  const selectionNode = textNode ?? block;
  expect(selectionNode).toBeTruthy();
  const maximumOffset =
    selectionNode?.nodeType === Node.TEXT_NODE
      ? selectionNode.textContent?.length ?? 0
      : selectionNode?.childNodes.length ?? 0;
  const range = document.createRange();
  range.setStart(
    selectionNode as Node,
    Math.min(Math.max(0, offset), maximumOffset),
  );
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  fireEvent.mouseUp(editor);
}

function setDomSelection(
  editor: HTMLElement,
  anchorNode: Node,
  anchorOffset: number,
  focusNode: Node,
  focusOffset: number,
) {
  const selection = window.getSelection();
  expect(selection).toBeTruthy();
  selection?.removeAllRanges();
  selection?.setBaseAndExtent(
    anchorNode,
    anchorOffset,
    focusNode,
    focusOffset,
  );
  fireEvent.mouseUp(editor);
}

function createClipboardData() {
  return {
    setData: vi.fn(),
    getData: vi.fn(),
    types: [] as string[],
  };
}

function dispatchBeforeInput(
  editor: HTMLElement,
  {
    inputType,
    data = null,
    cancelable = true,
    isComposing = false,
  }: {
    inputType?: string;
    data?: string | null;
    cancelable?: boolean;
    isComposing?: boolean;
  },
) {
  return fireEvent(
    editor,
    new InputEvent("beforeinput", {
      bubbles: true,
      cancelable,
      composed: true,
      data,
      inputType: inputType ?? "",
      isComposing,
    }),
  );
}

describe("feedback rich-text model", () => {
  it("normalises NFKC and counts inter-block newlines in the exact 4,000 limit", () => {
    const exact = normaliseFeedbackRichTextDocument({
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [{ type: "text", text: `Cafe\u0301${"x".repeat(3_994)}` }],
        },
        {
          type: "paragraph",
          depth: 0,
          children: [{ type: "text", text: "z" }],
        },
      ],
    });

    expect(extractFeedbackRichText(exact)).toHaveLength(4_000);
    expect(extractFeedbackRichText(exact).startsWith("Café")).toBe(true);
    expect(extractFeedbackRichText(exact).endsWith("\nz")).toBe(true);

    const overLimit = createFeedbackRichTextDocument(
      `${"x".repeat(4_000)}\ny`,
    );
    expect(extractFeedbackRichText(overLimit)).toHaveLength(4_000);
    expect(extractFeedbackRichText(overLimit)).not.toContain("\n");
  });

  it("counts astral characters as code points with an 8,000-code-unit ceiling", () => {
    const accepted = createFeedbackRichTextDocument("😀".repeat(3_000));
    expect(countFeedbackRichTextCharacters(accepted)).toBe(3_000);
    expect(extractFeedbackRichText(accepted)).toHaveLength(6_000);

    const bounded = createFeedbackRichTextDocument("😀".repeat(4_001));
    expect(countFeedbackRichTextCharacters(bounded)).toBe(4_000);
    expect(extractFeedbackRichText(bounded)).toHaveLength(
      FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS,
    );
    expect(extractFeedbackRichText(bounded).endsWith("\ud83d")).toBe(false);
  });
});

describe("ConstrainedRichTextEditor", () => {
  it("loads through the public lazy facade", async () => {
    render(
      <ConstrainedRichTextEditor
        labels={labels}
        placeholder="Optional details"
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(await screen.findByRole("textbox", { name: "Tell us more" })).toBeTruthy();
  });

  it("applies toolbar and conventional shortcut marks without an HTML sink", () => {
    const initialValue = createFeedbackRichTextDocument("Synthetic details");
    render(<ControlledEditor initialValue={initialValue} />);

    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 0, 9);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Bold" }));
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(
      editor.querySelector("[data-feedback-node]")?.textContent,
    ).toContain("Synthetic");
    expect(
      editor.querySelector("[data-feedback-node]")?.getAttribute("data-marks"),
    ).toContain("bold");
    expect(
      screen.getByRole("button", { name: "Bold" }).getAttribute("aria-pressed"),
    ).toBe("true");

    selectEditorText(editor, 10, 17);
    fireEvent.keyDown(editor, { key: "u", ctrlKey: true });
    expect(
      Array.from(editor.querySelectorAll("[data-feedback-node]")).some(
        (node) => node.getAttribute("data-marks")?.includes("underline"),
      ),
    ).toBe(true);
    expect(editor.querySelector("a, img, code")).toBeNull();
  });

  it("accepts only text/plain paste and emits no pasted element or metadata", () => {
    const onValue = vi.fn();
    render(<ControlledEditor onValue={onValue} />);

    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    editor.focus();
    selectEditorBlock(editor, 0);
    fireEvent.paste(editor, {
      clipboardData: {
        getData: (type: string) =>
          type === "text/plain" ? "Pasted safely" : "<a href='x'>unsafe</a>",
        setData: vi.fn(),
      },
    });

    const emitted = onValue.mock.calls.at(-1)?.[0] as FeedbackRichTextDocument;
    expect(extractFeedbackRichText(emitted)).toBe("Pasted safely");
    expect(JSON.stringify(emitted)).not.toContain("href");
    expect(editor.querySelector("a, img, code")).toBeNull();
  });

  it("supports bullets, indentation, blur notification, and bounded input", () => {
    const onBlur = vi.fn();
    const onConstraintViolation = vi.fn();
    const initialValue = createFeedbackRichTextDocument("One");
    const { rerender } = render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={initialValue}
        onChange={vi.fn()}
        onBlur={onBlur}
        onConstraintViolation={onConstraintViolation}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    editor.focus();
    selectEditorText(editor, 0, 3);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Bulleted list" }));
    fireEvent.click(screen.getByRole("button", { name: "Bulleted list" }));
    expect(editor.querySelector("[data-block-type='listItem']")).toBeTruthy();

    fireEvent.mouseDown(screen.getByRole("button", { name: "Increase indent" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase indent" }));
    expect(editor.querySelector("[data-depth='1']")).toBeTruthy();

    rerender(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={createFeedbackRichTextDocument("x".repeat(4_000))}
        onChange={vi.fn()}
        onBlur={onBlur}
        onConstraintViolation={onConstraintViolation}
      />,
    );
    const fullEditor = screen.getByRole("textbox", { name: "Tell us more" });
    fullEditor.focus();
    selectEditorText(fullEditor, 4_000, 4_000);
    fireEvent.paste(fullEditor, {
      clipboardData: {
        getData: (type: string) => (type === "text/plain" ? "y" : ""),
        setData: vi.fn(),
      },
    });
    expect(onConstraintViolation).toHaveBeenCalledWith("character-limit");

    fireEvent.blur(fullEditor);
    expect(onBlur).toHaveBeenCalled();
    expect(screen.getByText("4000 / 4000")).toBeTruthy();
  });

  it("presents the toolbar state after lazy resolution", async () => {
    render(
      <ConstrainedRichTextEditor
        labels={labels}
        placeholder="Optional details"
        value={createFeedbackRichTextDocument("Details")}
        onChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("toolbar", { name: "Text formatting" })).toBeTruthy();
    });
  });

  it("handles browser before-input insert, paragraph, delete, and unsupported commands", () => {
    const onValue = vi.fn();
    const onConstraintViolation = vi.fn();
    render(
      <ControlledEditor onValue={onValue} />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    editor.focus();
    selectEditorBlock(editor, 0);

    expect(
      dispatchBeforeInput(editor, { data: "A", inputType: "insertText" }),
    ).toBe(false);
    expect(
      extractFeedbackRichText(onValue.mock.calls.at(-1)?.[0]),
    ).toBe("A");

    const { unmount } = render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={createFeedbackRichTextDocument("OneTwo")}
        onChange={onValue}
        onConstraintViolation={onConstraintViolation}
      />,
    );
    const populatedEditors = screen.getAllByRole("textbox", {
      name: "Tell us more",
    });
    const populatedEditor = populatedEditors.at(-1) as HTMLElement;
    selectEditorText(populatedEditor, 3, 3);
    dispatchBeforeInput(populatedEditor, { inputType: "insertParagraph" });
    expect(
      extractFeedbackRichText(onValue.mock.calls.at(-1)?.[0]),
    ).toBe("One\nTwo");

    dispatchBeforeInput(populatedEditor, { inputType: "historyUndo" });
    expect(onConstraintViolation).toHaveBeenCalledWith("unsupported-content");
    unmount();
  });

  it("rolls every escaped native input back to the canonical model", () => {
    const onChange = vi.fn();
    const onConstraintViolation = vi.fn();
    render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={createFeedbackRichTextDocument("Safe")}
        onChange={onChange}
        onConstraintViolation={onConstraintViolation}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 4, 4);

    expect(
      dispatchBeforeInput(editor, {
        inputType: "insertText",
        data: "x",
        cancelable: false,
      }),
    ).toBe(true);

    const escapedInputTypes = [
      "",
      "insertText",
      "insertReplacementText",
      "formatBold",
      "insertFromPaste",
      "insertFromDrop",
      "historyUndo",
    ];
    for (const [index, inputType] of escapedInputTypes.entries()) {
      if (index === 0) {
        const rogue = document.createElement("em");
        rogue.textContent = "Rogue";
        editor.append(rogue);
      }
      const textNode =
        editor.querySelector("[data-feedback-node]")?.firstChild;
      expect(textNode).toBeTruthy();
      if (textNode) {
        textNode.textContent = `Unsafe ${index}`;
      }
      fireEvent.input(editor, {
        data: "x",
        inputType,
        isComposing: false,
      });
      expect(editor.textContent).toBe("Safe");
      expect(editor.querySelector("em")).toBeNull();
      expect(document.activeElement).toBe(editor);
    }

    expect(onChange).not.toHaveBeenCalled();
    expect(onConstraintViolation).toHaveBeenCalledTimes(
      escapedInputTypes.length,
    );
  });

  it("rejects stale or unmappable selections on every mutation surface", () => {
    const onChange = vi.fn();
    const onConstraintViolation = vi.fn();
    const listDocument: FeedbackRichTextDocument = {
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: [
        {
          type: "listItem",
          listType: "bullet",
          depth: 0,
          children: [{ type: "text", text: "Item" }],
        },
      ],
    };
    render(
      <>
        <ConstrainedRichTextEditorImplementation
          labels={labels}
          placeholder="Optional details"
          value={listDocument}
          onChange={onChange}
          onConstraintViolation={onConstraintViolation}
        />
        <button type="button">Outside</button>
      </>,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    const outsideText = screen.getByRole("button", { name: "Outside" })
      .firstChild;
    expect(outsideText).toBeTruthy();
    selectEditorText(editor, 0, 4);

    setDomSelection(
      editor,
      outsideText as Node,
      0,
      outsideText as Node,
      outsideText?.textContent?.length ?? 0,
    );
    fireEvent.paste(editor, {
      clipboardData: {
        types: ["text/plain"],
        getData: () => "Unsafe",
        setData: vi.fn(),
      },
    });
    expect(editor.textContent).toBe("Item");

    const rogue = document.createElement("em");
    rogue.textContent = "Rogue";
    editor.querySelector("[data-feedback-block]")?.append(rogue);
    const rogueText = rogue.firstChild;
    expect(rogueText).toBeTruthy();
    setDomSelection(
      editor,
      rogueText as Node,
      0,
      rogueText as Node,
      rogueText?.textContent?.length ?? 0,
    );
    dispatchBeforeInput(editor, { inputType: "deleteContentBackward" });
    expect(editor.querySelector("em")).toBeNull();
    expect(editor.textContent).toBe("Item");

    setDomSelection(
      editor,
      outsideText as Node,
      0,
      outsideText as Node,
      outsideText?.textContent?.length ?? 0,
    );
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);
    expect(editor.querySelector("[data-depth='0']")).toBeTruthy();

    setDomSelection(
      editor,
      outsideText as Node,
      0,
      outsideText as Node,
      outsideText?.textContent?.length ?? 0,
    );
    const bold = screen.getByRole("button", { name: "Bold" });
    fireEvent.mouseDown(bold);
    fireEvent.click(bold);
    expect(editor.querySelector("[data-marks~='bold']")).toBeNull();

    expect(onChange).not.toHaveBeenCalled();
    expect(onConstraintViolation).toHaveBeenCalledTimes(4);
  });

  it("preserves editor focus through internal canonical resets only", () => {
    const onBlur = vi.fn();
    const onChange = vi.fn();
    render(
      <>
        <ConstrainedRichTextEditorImplementation
          labels={labels}
          placeholder="Optional details"
          value={createFeedbackRichTextDocument("Safe")}
          onChange={onChange}
          onBlur={onBlur}
        />
        <button type="button">Outside</button>
      </>,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    const outside = screen.getByRole("button", { name: "Outside" });
    selectEditorText(editor, 4, 4);
    const originalEditor = editor;

    fireEvent.compositionStart(editor);
    const textNode = editor.querySelector("[data-feedback-node]")?.firstChild;
    expect(textNode).toBeTruthy();
    if (textNode) {
      textNode.textContent = "Safex";
    }
    fireEvent.compositionEnd(editor, { data: "x" });
    expect(screen.getByRole("textbox", { name: "Tell us more" })).toBe(
      originalEditor,
    );
    expect(document.activeElement).toBe(editor);
    expect(onBlur).not.toHaveBeenCalled();

    selectEditorText(editor, 5, 5);
    fireEvent.compositionStart(editor);
    fireEvent.compositionEnd(editor, { data: "" });
    expect(screen.getByRole("textbox", { name: "Tell us more" })).toBe(
      originalEditor,
    );
    expect(document.activeElement).toBe(editor);
    expect(onBlur).not.toHaveBeenCalled();

    const escapedText =
      editor.querySelector("[data-feedback-node]")?.firstChild;
    expect(escapedText).toBeTruthy();
    if (escapedText) {
      escapedText.textContent = "Escaped";
    }
    fireEvent.input(editor, {
      inputType: "insertReplacementText",
      data: "Escaped",
    });
    expect(editor.textContent).toBe("Safex");
    expect(document.activeElement).toBe(editor);
    expect(onBlur).not.toHaveBeenCalled();

    outside.focus();
    expect(document.activeElement).toBe(outside);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("keeps a trailing empty paragraph private until the user types into it", () => {
    const onValue = vi.fn();
    render(
      <ControlledEditor
        initialValue={createFeedbackRichTextDocument("One")}
        onValue={onValue}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 3, 3);

    dispatchBeforeInput(editor, { inputType: "insertParagraph" });

    expect(onValue).not.toHaveBeenCalled();
    const blocks = editor.querySelectorAll("[data-feedback-block]");
    expect(blocks).toHaveLength(2);
    expect(blocks[1]?.textContent).toBe("");
    expect(screen.getByText("4 / 4000")).toBeTruthy();

    dispatchBeforeInput(editor, { data: "Two", inputType: "insertText" });

    expect(onValue).toHaveBeenCalledTimes(1);
    const emitted = onValue.mock.calls.at(-1)?.[0] as FeedbackRichTextDocument;
    expect(extractFeedbackRichText(emitted)).toBe("One\nTwo");
    expect(
      emitted.children.every(
        (block) =>
          block.children.length > 0 &&
          block.children.every((node) => node.text.length > 0),
      ),
    ).toBe(true);
  });

  it("bounds private empty paragraphs and removes one with Backspace", () => {
    const onValue = vi.fn();
    render(
      <ControlledEditor
        initialValue={createFeedbackRichTextDocument("One")}
        onValue={onValue}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 3, 3);
    dispatchBeforeInput(editor, { inputType: "insertParagraph" });
    dispatchBeforeInput(editor, { inputType: "insertParagraph" });

    expect(editor.querySelectorAll("[data-feedback-block]")).toHaveLength(2);
    expect(screen.getByText("4 / 4000")).toBeTruthy();
    expect(onValue).not.toHaveBeenCalled();

    dispatchBeforeInput(editor, { inputType: "deleteContentBackward" });

    expect(editor.querySelectorAll("[data-feedback-block]")).toHaveLength(1);
    expect(screen.getByText("3 / 4000")).toBeTruthy();
    expect(editor.textContent).toBe("One");
    expect(onValue).not.toHaveBeenCalled();
  });

  it("supports boundary and middle paragraph splits without exposing empty blocks", () => {
    const onValue = vi.fn();
    const initial = createFeedbackRichTextDocument("One");
    const { unmount } = render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={initial}
        onChange={onValue}
      />,
    );
    let editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 0, 0);
    dispatchBeforeInput(editor, { inputType: "insertParagraph" });

    expect(onValue).not.toHaveBeenCalled();
    expect(editor.querySelectorAll("[data-feedback-block]")).toHaveLength(2);
    selectEditorBlock(editor, 0);
    dispatchBeforeInput(editor, { data: "Zero", inputType: "insertText" });
    expect(
      extractFeedbackRichText(onValue.mock.calls.at(-1)?.[0]),
    ).toBe("Zero\nOne");
    unmount();

    const middleValue = vi.fn();
    render(
      <ControlledEditor
        initialValue={createFeedbackRichTextDocument("One")}
        onValue={middleValue}
      />,
    );
    editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 2, 2);
    dispatchBeforeInput(editor, { inputType: "insertParagraph" });
    expect(
      extractFeedbackRichText(middleValue.mock.calls.at(-1)?.[0]),
    ).toBe("On\ne");
  });

  it("creates a private list item and exits the list from an empty item", () => {
    const onValue = vi.fn();
    const listDocument: FeedbackRichTextDocument = {
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: [
        {
          type: "listItem",
          listType: "bullet",
          depth: 1,
          children: [{ type: "text", text: "One" }],
        },
      ],
    };
    render(
      <ControlledEditor initialValue={listDocument} onValue={onValue} />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 3, 3);

    dispatchBeforeInput(editor, { inputType: "insertParagraph" });
    expect(onValue).not.toHaveBeenCalled();
    expect(
      editor.querySelectorAll("[data-block-type='listItem']"),
    ).toHaveLength(2);

    dispatchBeforeInput(editor, { inputType: "insertParagraph" });
    expect(onValue).not.toHaveBeenCalled();
    expect(
      editor.querySelector("[data-block-index='1']")?.getAttribute(
        "data-block-type",
      ),
    ).toBe("paragraph");
    expect(
      editor.querySelector("[data-block-index='1']")?.getAttribute(
        "data-depth",
      ),
    ).toBe("0");

    dispatchBeforeInput(editor, { data: "After", inputType: "insertText" });
    const emitted = onValue.mock.calls.at(-1)?.[0] as FeedbackRichTextDocument;
    expect(extractFeedbackRichText(emitted)).toBe("One\nAfter");
    expect(emitted.children.map((block) => block.type)).toEqual([
      "listItem",
      "paragraph",
    ]);
  });

  it("applies the block limit to private empty paragraphs", () => {
    const onChange = vi.fn();
    const onConstraintViolation = vi.fn();
    const maximumBlocks: FeedbackRichTextDocument = {
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: Array.from({ length: 128 }, () => ({
        type: "paragraph" as const,
        depth: 0,
        children: [{ type: "text" as const, text: "x" }],
      })),
    };
    render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={maximumBlocks}
        onChange={onChange}
        onConstraintViolation={onConstraintViolation}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorBlock(editor, 127, 1);

    dispatchBeforeInput(editor, { inputType: "insertParagraph" });

    expect(editor.querySelectorAll("[data-feedback-block]")).toHaveLength(128);
    expect(onChange).not.toHaveBeenCalled();
    expect(onConstraintViolation).toHaveBeenCalledWith("block-limit");
  });

  it("preserves a private empty block across an equivalent prop echo and clears it for a replacement", async () => {
    const onChange = vi.fn();
    const initial = createFeedbackRichTextDocument("One");
    const { rerender } = render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={initial}
        onChange={onChange}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 3, 3);
    dispatchBeforeInput(editor, { inputType: "insertParagraph" });
    expect(editor.querySelectorAll("[data-feedback-block]")).toHaveLength(2);

    rerender(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={createFeedbackRichTextDocument("One")}
        onChange={onChange}
      />,
    );
    await waitFor(() => {
      expect(editor.querySelectorAll("[data-feedback-block]")).toHaveLength(2);
    });
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={createFeedbackRichTextDocument("Replacement")}
        onChange={onChange}
      />,
    );
    await waitFor(() => {
      expect(editor.querySelectorAll("[data-feedback-block]")).toHaveLength(1);
      expect(editor.textContent).toBe("Replacement");
    });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("commits only the final normalised composition value", () => {
    const onValue = vi.fn();
    render(<ControlledEditor onValue={onValue} />);
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorBlock(editor, 0, 0);

    fireEvent.compositionStart(editor);
    fireEvent.input(editor, {
      data: "e",
      inputType: "insertCompositionText",
      isComposing: true,
    });
    fireEvent.input(editor, {
      data: "e\u0301",
      inputType: "insertCompositionText",
      isComposing: true,
    });
    expect(onValue).not.toHaveBeenCalled();

    const block = editor.querySelector<HTMLElement>("[data-feedback-block]");
    expect(block).toBeTruthy();
    if (block) {
      block.textContent = "e\u0301";
    }
    fireEvent.compositionEnd(editor, { data: "e\u0301" });
    expect(onValue).toHaveBeenCalledTimes(1);
    expect(
      extractFeedbackRichText(onValue.mock.calls.at(-1)?.[0]),
    ).toBe("é");
    const restoredEditor = screen.getByRole("textbox", {
      name: "Tell us more",
    });
    expect(restoredEditor.textContent).toBe("é");

    const restoredTextNode =
      restoredEditor.querySelector("[data-feedback-node]")?.firstChild;
    expect(restoredTextNode).toBeTruthy();
    if (restoredTextNode) {
      restoredTextNode.textContent = "ée\u0301";
    }
    fireEvent.input(restoredEditor, {
      data: "e\u0301",
      inputType: "insertFromComposition",
      isComposing: false,
    });
    expect(onValue).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("textbox", { name: "Tell us more" }).textContent,
    ).toBe("é");
  });

  it("distinguishes composition cancellation from an explicit deletion", () => {
    const onValue = vi.fn();
    const initialValue = createFeedbackRichTextDocument("Synthetic");
    const { unmount } = render(
      <ControlledEditor initialValue={initialValue} onValue={onValue} />,
    );
    let editor = screen.getByRole("textbox", { name: "Tell us more" });

    selectEditorText(editor, 0, 4);
    fireEvent.compositionStart(editor);
    fireEvent.compositionEnd(editor, { data: "" });

    expect(onValue).not.toHaveBeenCalled();
    expect(
      screen.getByRole("textbox", { name: "Tell us more" }).textContent,
    ).toBe("Synthetic");

    unmount();
    onValue.mockClear();
    render(<ControlledEditor initialValue={initialValue} onValue={onValue} />);
    editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 0, 4);
    fireEvent.compositionStart(editor);
    const textNode = editor.querySelector("[data-feedback-node]")?.firstChild;
    expect(textNode).toBeTruthy();
    if (textNode) {
      textNode.textContent = "hetic";
    }
    fireEvent.compositionEnd(editor, { data: "" });

    expect(onValue).toHaveBeenCalledTimes(1);
    expect(extractFeedbackRichText(onValue.mock.calls.at(-1)?.[0])).toBe(
      "hetic",
    );
    expect(
      screen.getByRole("textbox", { name: "Tell us more" }).textContent,
    ).toBe("hetic");
  });

  it("fails composition closed and rebuilds canonical DOM for invalid or oversized mutations", () => {
    const onValue = vi.fn();
    const onConstraintViolation = vi.fn();
    const initialValue = createFeedbackRichTextDocument("Safe");
    const { rerender } = render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={initialValue}
        onChange={onValue}
        onConstraintViolation={onConstraintViolation}
      />,
    );
    let editor = screen.getByRole("textbox", { name: "Tell us more" });

    selectEditorText(editor, 4, 4);
    fireEvent.compositionStart(editor);
    const textNode = editor.querySelector("[data-feedback-node]")?.firstChild;
    expect(textNode).toBeTruthy();
    if (textNode) {
      textNode.textContent = "Safe\uA7F1";
    }
    fireEvent.compositionEnd(editor, { data: "\uA7F1" });

    expect(onValue).not.toHaveBeenCalled();
    expect(onConstraintViolation).toHaveBeenCalledWith("unsupported-content");
    expect(
      screen.getByRole("textbox", { name: "Tell us more" }).textContent,
    ).toBe("Safe");

    const maximumValue = createFeedbackRichTextDocument("x".repeat(4_000));
    rerender(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={maximumValue}
        onChange={onValue}
        onConstraintViolation={onConstraintViolation}
      />,
    );
    editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 4_000, 4_000);
    fireEvent.compositionStart(editor);
    const maximumTextNode =
      editor.querySelector("[data-feedback-node]")?.firstChild;
    expect(maximumTextNode).toBeTruthy();
    if (maximumTextNode) {
      maximumTextNode.textContent = `${"x".repeat(4_000)}y`;
    }
    fireEvent.compositionEnd(editor, { data: "y" });

    expect(onValue).not.toHaveBeenCalled();
    expect(onConstraintViolation).toHaveBeenLastCalledWith("character-limit");
    expect(
      screen.getByRole("textbox", { name: "Tell us more" }).textContent,
    ).toBe("x".repeat(4_000));
  });

  it("rejects unexpected DOM structure introduced during composition", () => {
    const onValue = vi.fn();
    const onConstraintViolation = vi.fn();
    render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={createFeedbackRichTextDocument("Safe")}
        onChange={onValue}
        onConstraintViolation={onConstraintViolation}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 4, 4);
    fireEvent.compositionStart(editor);

    const unsafeLink = document.createElement("a");
    unsafeLink.href = "https://invalid.example";
    unsafeLink.textContent = "x";
    editor.querySelector("[data-feedback-block]")?.append(unsafeLink);
    fireEvent.compositionEnd(editor, { data: "x" });

    expect(onValue).not.toHaveBeenCalled();
    expect(onConstraintViolation).toHaveBeenCalledWith("unsupported-content");
    const restoredEditor = screen.getByRole("textbox", {
      name: "Tell us more",
    });
    expect(restoredEditor.querySelector("a")).toBeNull();
    expect(restoredEditor.textContent).toBe("Safe");
  });

  it("uses pending marks for collapsed input and supports keyboard block actions", () => {
    const onValue = vi.fn();
    render(
      <ControlledEditor
        initialValue={createFeedbackRichTextDocument("One")}
        onValue={onValue}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 3, 3);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Italic" }));
    fireEvent.click(screen.getByRole("button", { name: "Italic" }));
    fireEvent.paste(editor, {
      clipboardData: {
        types: ["text/plain"],
        getData: (type: string) => (type === "text/plain" ? "!" : ""),
        setData: vi.fn(),
      },
    });
    const marked = onValue.mock.calls.at(-1)?.[0] as FeedbackRichTextDocument;
    expect(
      marked.children[0]?.children.some((node) =>
        node.marks?.includes("italic"),
      ),
    ).toBe(true);

    selectEditorText(editor, 0, 4);
    fireEvent.keyDown(editor, {
      code: "Digit8",
      key: "*",
      ctrlKey: true,
      shiftKey: true,
    });
    expect(editor.querySelector("[data-block-type='listItem']")).toBeTruthy();
    fireEvent.keyDown(editor, { key: "]", ctrlKey: true });
    expect(editor.querySelector("[data-depth='1']")).toBeTruthy();
    fireEvent.keyDown(editor, { key: "[", ctrlKey: true });
    expect(editor.querySelector("[data-depth='0']")).toBeTruthy();
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(false);
    expect(editor.querySelector("[data-depth='1']")).toBeTruthy();
    expect(
      fireEvent.keyDown(editor, { key: "Tab", shiftKey: true }),
    ).toBe(false);
    expect(editor.querySelector("[data-depth='0']")).toBeTruthy();
  });

  it("never traps Tab at list-depth boundaries or outside the selected list", () => {
    const listDocument = (depth: number): FeedbackRichTextDocument => ({
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: [
        {
          type: "listItem",
          listType: "bullet",
          depth,
          children: [{ type: "text", text: "Item" }],
        },
      ],
    });

    const maximum = render(
      <ControlledEditor initialValue={listDocument(4)} />,
    );
    let editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 0, 4);
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);
    expect(editor.querySelector("[data-depth='4']")).toBeTruthy();
    maximum.unmount();

    const minimum = render(
      <ControlledEditor initialValue={listDocument(0)} />,
    );
    editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 0, 4);
    expect(
      fireEvent.keyDown(editor, { key: "Tab", shiftKey: true }),
    ).toBe(true);
    expect(editor.querySelector("[data-depth='0']")).toBeTruthy();
    minimum.unmount();

    render(
      <ControlledEditor
        initialValue={{
          type: "doc",
          schemaVersion: "1",
          version: "1.0.0",
          children: [
            {
              type: "paragraph",
              depth: 0,
              children: [{ type: "text", text: "Paragraph" }],
            },
            {
              type: "listItem",
              listType: "bullet",
              depth: 0,
              children: [{ type: "text", text: "Item" }],
            },
          ],
        }}
      />,
    );
    editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 0, 13);
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);

    const textNodes = Array.from(
      editor.querySelectorAll("[data-feedback-node]"),
    ).map((node) => node.firstChild as Node);
    const paragraphText = textNodes[0];
    const listText = textNodes[1];
    expect(paragraphText).toBeTruthy();
    expect(listText).toBeTruthy();
    const reverseSelection = window.getSelection();
    reverseSelection?.removeAllRanges();
    reverseSelection?.setBaseAndExtent(
      listText as Node,
      listText?.textContent?.length ?? 0,
      paragraphText as Node,
      0,
    );
    fireEvent.mouseUp(editor);
    expect(fireEvent.keyDown(editor, { key: "Tab" })).toBe(true);
  });

  it("keeps readable narrative out of spell services and avoids live counters", () => {
    render(
      <ControlledEditor
        initialValue={createFeedbackRichTextDocument("Private narrative")}
      />,
    );

    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    expect(editor.getAttribute("spellcheck")).toBe("false");
    expect(editor.getAttribute("autocorrect")).toBe("off");
    expect(editor.getAttribute("autocapitalize")).toBe("off");
    expect(editor.getAttribute("translate")).toBe("no");
    expect(editor.getAttribute("writingsuggestions")).toBe("false");
    expect(editor.getAttribute("data-gramm")).toBe("false");
    expect(editor.getAttribute("data-gramm_editor")).toBe("false");
    expect(editor.getAttribute("data-enable-grammarly")).toBe("false");

    const counter = screen.getByText("17 / 4000");
    expect(counter.tagName).toBe("SPAN");
    expect(counter.hasAttribute("aria-live")).toBe(false);
  });

  it("copies and cuts only plain text, while rejecting HTML-only paste and drops", () => {
    const onValue = vi.fn();
    const onConstraintViolation = vi.fn();
    render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={createFeedbackRichTextDocument("Synthetic")}
        onChange={onValue}
        onConstraintViolation={onConstraintViolation}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 0, 4);
    const setData = vi.fn();
    fireEvent.copy(editor, {
      clipboardData: { setData, getData: vi.fn(), types: [] },
    });
    expect(setData).toHaveBeenCalledWith("text/plain", "Synt");

    fireEvent.cut(editor, {
      clipboardData: { setData, getData: vi.fn(), types: [] },
    });
    expect(extractFeedbackRichText(onValue.mock.calls.at(-1)?.[0])).toBe(
      "hetic",
    );

    fireEvent.paste(editor, {
      clipboardData: {
        files: [],
        types: ["text/html"],
        getData: () => "",
        setData: vi.fn(),
      },
    });
    fireEvent.paste(editor, {
      clipboardData: {
        files: [{ name: "synthetic.txt" }],
        types: ["Files"],
        getData: () => "",
        setData: vi.fn(),
      },
    });
    fireEvent.drop(editor);
    expect(onConstraintViolation).toHaveBeenCalledTimes(3);
    expect(editor.querySelector("a, img, code")).toBeNull();
  });

  it("maps text, span, block, and root DOM boundaries to exact plain text", () => {
    const initialValue: FeedbackRichTextDocument = {
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [
            { type: "text", text: "Bold", marks: ["bold"] },
            { type: "text", text: " plain" },
          ],
        },
        {
          type: "paragraph",
          depth: 0,
          children: [{ type: "text", text: "Next" }],
        },
      ],
    };
    render(<ControlledEditor initialValue={initialValue} />);

    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    const firstBlock = editor.querySelector<HTMLElement>(
      "[data-block-index='0']",
    );
    const firstSpan = firstBlock?.querySelector<HTMLElement>(
      "[data-node-index='0']",
    );
    const secondSpan = firstBlock?.querySelector<HTMLElement>(
      "[data-node-index='1']",
    );
    const firstText = firstSpan?.firstChild;
    const secondText = secondSpan?.firstChild;
    expect(firstBlock).toBeTruthy();
    expect(firstSpan).toBeTruthy();
    expect(secondSpan).toBeTruthy();
    expect(firstText).toBeTruthy();
    expect(secondText).toBeTruthy();

    const cases = [
      {
        anchorNode: firstText as Node,
        anchorOffset: 1,
        focusNode: secondText as Node,
        focusOffset: 3,
        expected: "old pl",
      },
      {
        anchorNode: firstSpan as Node,
        anchorOffset: 0,
        focusNode: firstSpan as Node,
        focusOffset: 1,
        expected: "Bold",
      },
      {
        anchorNode: firstBlock as Node,
        anchorOffset: 0,
        focusNode: firstBlock as Node,
        focusOffset: 2,
        expected: "Bold plain",
      },
      {
        anchorNode: editor,
        anchorOffset: 0,
        focusNode: editor,
        focusOffset: 1,
        expected: "Bold plain\n",
      },
    ];

    for (const selectionCase of cases) {
      setDomSelection(
        editor,
        selectionCase.anchorNode,
        selectionCase.anchorOffset,
        selectionCase.focusNode,
        selectionCase.focusOffset,
      );
      const clipboardData = createClipboardData();
      expect(fireEvent.copy(editor, { clipboardData })).toBe(false);
      expect(clipboardData.setData.mock.calls).toEqual([
        ["text/plain", selectionCase.expected],
      ]);
    }
  });

  it("maps root and empty-block boundaries without losing structural newlines", () => {
    const onValue = vi.fn();
    render(
      <ControlledEditor
        initialValue={createFeedbackRichTextDocument("One\nTwo")}
        onValue={onValue}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    const firstText = editor.querySelector(
      "[data-block-index='0'] [data-feedback-node]",
    )?.firstChild;
    expect(firstText).toBeTruthy();
    setDomSelection(editor, firstText as Node, 3, firstText as Node, 3);
    dispatchBeforeInput(editor, { inputType: "insertParagraph" });

    const blocks = editor.querySelectorAll<HTMLElement>(
      "[data-feedback-block]",
    );
    expect(blocks).toHaveLength(3);
    expect(blocks[1]?.textContent).toBe("");
    expect(onValue).not.toHaveBeenCalled();

    const rootClipboard = createClipboardData();
    setDomSelection(editor, editor, 1, editor, 2);
    fireEvent.copy(editor, { clipboardData: rootClipboard });
    expect(rootClipboard.setData.mock.calls).toEqual([["text/plain", "\n"]]);

    const emptyBlockClipboard = createClipboardData();
    setDomSelection(editor, blocks[1] as Node, 0, editor, 2);
    fireEvent.copy(editor, { clipboardData: emptyBlockClipboard });
    expect(emptyBlockClipboard.setData.mock.calls).toEqual([
      ["text/plain", "\n"],
    ]);
  });

  it("cuts a reverse cross-span selection to the exact canonical AST", () => {
    const onValue = vi.fn();
    const initialValue: FeedbackRichTextDocument = {
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [
            { type: "text", text: "Bold", marks: ["bold"] },
            { type: "text", text: " plain" },
          ],
        },
      ],
    };
    render(<ControlledEditor initialValue={initialValue} onValue={onValue} />);
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    const spans = editor.querySelectorAll<HTMLElement>("[data-feedback-node]");
    const firstText = spans[0]?.firstChild;
    const secondText = spans[1]?.firstChild;
    expect(firstText).toBeTruthy();
    expect(secondText).toBeTruthy();
    setDomSelection(
      editor,
      secondText as Node,
      3,
      firstText as Node,
      2,
    );

    const clipboardData = createClipboardData();
    fireEvent.cut(editor, { clipboardData });

    expect(clipboardData.setData.mock.calls).toEqual([
      ["text/plain", "ld pl"],
    ]);
    expect(onValue).toHaveBeenCalledTimes(1);
    expect(onValue.mock.calls[0]?.[0]).toEqual({
      type: "doc",
      schemaVersion: "1",
      version: "1.0.0",
      children: [
        {
          type: "paragraph",
          depth: 0,
          children: [
            { type: "text", text: "Bo", marks: ["bold"] },
            { type: "text", text: "ain" },
          ],
        },
      ],
    });
  });

  it("fails copy and cut closed for stale, outside, cross-editor, invalid, and unmappable selections", () => {
    const onValue = vi.fn();
    render(
      <>
        <ControlledEditor
          initialValue={createFeedbackRichTextDocument("Synthetic")}
          onValue={onValue}
        />
        <ControlledEditor
          initialValue={createFeedbackRichTextDocument("Other editor")}
        />
        <button type="button">Outside selection</button>
      </>,
    );
    const editors = screen.getAllByRole("textbox", { name: "Tell us more" });
    const editor = editors[0] as HTMLElement;
    const otherEditor = editors[1] as HTMLElement;
    const editorText = editor.querySelector("[data-feedback-node]")?.firstChild;
    const otherText =
      otherEditor.querySelector("[data-feedback-node]")?.firstChild;
    const outsideText = screen.getByRole("button", {
      name: "Outside selection",
    }).firstChild;
    expect(editorText).toBeTruthy();
    expect(otherText).toBeTruthy();
    expect(outsideText).toBeTruthy();

    // Seed a valid prior selection; every invalid case must ignore it.
    setDomSelection(editor, editorText as Node, 0, editorText as Node, 4);

    const outsideClipboard = createClipboardData();
    setDomSelection(
      editor,
      outsideText as Node,
      0,
      outsideText as Node,
      outsideText?.textContent?.length ?? 0,
    );
    expect(fireEvent.copy(editor, { clipboardData: outsideClipboard })).toBe(
      false,
    );
    expect(outsideClipboard.setData).not.toHaveBeenCalled();

    const crossEditorClipboard = createClipboardData();
    setDomSelection(
      editor,
      editorText as Node,
      0,
      otherText as Node,
      5,
    );
    expect(
      fireEvent.cut(editor, { clipboardData: crossEditorClipboard }),
    ).toBe(false);
    expect(crossEditorClipboard.setData).not.toHaveBeenCalled();

    const actualSelection = window.getSelection();
    expect(actualSelection).toBeTruthy();
    const getSelectionSpy = vi.spyOn(window, "getSelection").mockReturnValue({
      anchorNode: editorText as Node,
      anchorOffset: 100,
      focusNode: editorText as Node,
      focusOffset: 100,
      rangeCount: 1,
      isCollapsed: true,
      getRangeAt: () => actualSelection?.getRangeAt(0) as Range,
    } as Selection);
    const invalidClipboard = createClipboardData();
    expect(fireEvent.copy(editor, { clipboardData: invalidClipboard })).toBe(
      false,
    );
    getSelectionSpy.mockRestore();
    expect(invalidClipboard.setData).not.toHaveBeenCalled();

    const rogueElement = document.createElement("em");
    rogueElement.textContent = "Unmapped";
    editor.querySelector("[data-feedback-block]")?.append(rogueElement);
    const rogueText = rogueElement.firstChild;
    expect(rogueText).toBeTruthy();
    setDomSelection(
      editor,
      rogueText as Node,
      0,
      rogueText as Node,
      rogueText?.textContent?.length ?? 0,
    );
    const unmappableClipboard = createClipboardData();
    expect(
      fireEvent.cut(editor, { clipboardData: unmappableClipboard }),
    ).toBe(false);
    expect(unmappableClipboard.setData).not.toHaveBeenCalled();
    rogueElement.remove();

    expect(onValue).not.toHaveBeenCalled();
    expect(editor.textContent).toBe("Synthetic");
  });

  it("does not delete text when cut is invoked with a collapsed selection", () => {
    const onValue = vi.fn();
    render(
      <ControlledEditor
        initialValue={createFeedbackRichTextDocument("Synthetic")}
        onValue={onValue}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 9, 9);
    const setData = vi.fn();

    fireEvent.cut(editor, {
      clipboardData: { setData, getData: vi.fn(), types: [] },
    });

    expect(setData).not.toHaveBeenCalled();
    expect(onValue).not.toHaveBeenCalled();
    expect(editor.textContent).toBe("Synthetic");
  });

  it("rejects HTML and link syntax even when it arrives as plain text", () => {
    const onValue = vi.fn();
    const onConstraintViolation = vi.fn();
    render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={createFeedbackRichTextDocument("https")}
        onChange={onValue}
        onConstraintViolation={onConstraintViolation}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 5, 5);

    fireEvent.paste(editor, {
      clipboardData: {
        types: ["text/plain"],
        getData: (type: string) => (type === "text/plain" ? ":" : ""),
        setData: vi.fn(),
      },
    });
    expect(onValue).not.toHaveBeenCalled();
    expect(onConstraintViolation).toHaveBeenCalledWith("unsupported-content");
    expect(extractFeedbackRichText(createFeedbackRichTextDocument("https"))).toBe(
      "https",
    );

    fireEvent.paste(editor, {
      clipboardData: {
        types: ["text/plain"],
        getData: (type: string) =>
          type === "text/plain" ? "<strong>unsafe</strong>" : "",
        setData: vi.fn(),
      },
    });
    expect(onValue).not.toHaveBeenCalled();
    expect(onConstraintViolation).toHaveBeenCalledTimes(2);
    expect(editor.querySelector("a, img, code, strong")).toBeNull();
  });

  it("honours disabled/read-only states, auto-focus, and whole-surface blur", () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const { rerender } = render(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={createFeedbackRichTextDocument("Synthetic")}
        onChange={onChange}
        onBlur={onBlur}
        readOnly={true}
        autoFocus={true}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    expect(editor.getAttribute("aria-readonly")).toBe("true");
    expect(editor).toBe(document.activeElement);
    fireEvent.paste(editor, {
      clipboardData: {
        types: ["text/plain"],
        getData: () => "Blocked",
        setData: vi.fn(),
      },
    });
    expect(onChange).not.toHaveBeenCalled();

    const toolbarButton = screen.getByRole("button", { name: "Bold" });
    fireEvent.blur(editor, { relatedTarget: toolbarButton });
    expect(onBlur).not.toHaveBeenCalled();

    rerender(
      <ConstrainedRichTextEditorImplementation
        labels={labels}
        placeholder="Optional details"
        value={null}
        onChange={onChange}
        onBlur={onBlur}
        disabled={true}
      />,
    );
    expect(editor.getAttribute("aria-disabled")).toBe("true");
    fireEvent.blur(editor);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
