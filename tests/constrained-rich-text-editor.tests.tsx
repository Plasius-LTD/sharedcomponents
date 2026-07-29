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

    fireEvent.input(editor, { data: "A", inputType: "insertText" });
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
    fireEvent.input(populatedEditor, { inputType: "insertParagraph" });
    expect(
      extractFeedbackRichText(onValue.mock.calls.at(-1)?.[0]),
    ).toBe("One\nTwo");

    fireEvent.input(populatedEditor, { inputType: "historyUndo" });
    expect(onConstraintViolation).toHaveBeenCalledWith("unsupported-content");
    unmount();
  });

  it("does not emit a dirty change for an empty trailing paragraph", () => {
    const onValue = vi.fn();
    render(
      <ControlledEditor
        initialValue={createFeedbackRichTextDocument("One")}
        onValue={onValue}
      />,
    );
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    selectEditorText(editor, 3, 3);

    fireEvent.input(editor, { inputType: "insertParagraph" });

    expect(onValue).not.toHaveBeenCalled();
    expect(extractFeedbackRichText(createFeedbackRichTextDocument("One"))).toBe(
      "One",
    );
  });

  it("commits only the final normalised composition value", () => {
    const onValue = vi.fn();
    render(<ControlledEditor onValue={onValue} />);
    const editor = screen.getByRole("textbox", { name: "Tell us more" });
    editor.focus();

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

    fireEvent.compositionEnd(editor, { data: "e\u0301" });
    expect(onValue).toHaveBeenCalledTimes(1);
    expect(
      extractFeedbackRichText(onValue.mock.calls.at(-1)?.[0]),
    ).toBe("é");
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
    selectEditorText(editor, 0, 9);
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
