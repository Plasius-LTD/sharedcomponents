import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type CompositionEvent,
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import {
  FEEDBACK_RICH_TEXT_MARKS,
  FEEDBACK_RICH_TEXT_MAX_CHARACTERS,
  activeFeedbackRichTextMarks,
  adjustFeedbackRichTextDepth,
  countFeedbackRichTextCharacters,
  deleteFeedbackRichTextRange,
  extractFeedbackRichText,
  normaliseFeedbackRichTextDocument,
  replaceFeedbackRichTextRange,
  selectedFeedbackRichTextBlocksAreBulleted,
  toggleFeedbackRichTextBullets,
  toggleFeedbackRichTextMark,
  type FeedbackRichTextConstraint,
  type FeedbackRichTextDocument,
  type FeedbackRichTextMark,
  type FeedbackRichTextMutation,
} from "./model.js";
import styles from "./ConstrainedRichTextEditor.module.css";

export interface ConstrainedRichTextEditorLabels {
  /** Accessible name for the multiline editor. */
  editor: string;
  /** Accessible name for the formatting toolbar. */
  toolbar: string;
  bold: string;
  italic: string;
  underline: string;
  bullets: string;
  indent: string;
  outdent: string;
  /** Status announced while the implementation chunk loads. */
  loading: string;
}

export interface ConstrainedRichTextEditorProps {
  labels: ConstrainedRichTextEditorLabels;
  placeholder: string;
  value: FeedbackRichTextDocument | null;
  onChange: (value: FeedbackRichTextDocument | null) => void;
  onBlur?: (event: FocusEvent<HTMLDivElement>) => void;
  onConstraintViolation?: (constraint: FeedbackRichTextConstraint) => void;
  id?: string;
  className?: string;
  describedBy?: string;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
}

interface SelectionOffsets {
  start: number;
  end: number;
}

const markButtonText: Record<FeedbackRichTextMark, string> = {
  bold: "B",
  italic: "I",
  underline: "U",
};

function blockTextLength(
  value: FeedbackRichTextDocument,
  blockIndex: number,
): number {
  return (
    value.children[blockIndex]?.children.reduce(
      (total, node) => total + node.text.length,
      0,
    ) ?? 0
  );
}

function blockStartOffset(
  value: FeedbackRichTextDocument,
  blockIndex: number,
): number {
  let offset = 0;
  for (let index = 0; index < blockIndex; index += 1) {
    offset += blockTextLength(value, index) + 1;
  }
  return offset;
}

function pointToOffset(
  root: HTMLElement,
  value: FeedbackRichTextDocument | null,
  node: Node,
  domOffset: number,
): number | null {
  if (!root.contains(node) && node !== root) {
    return null;
  }
  if (!value) {
    return 0;
  }

  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  const blockElement = element?.closest<HTMLElement>("[data-feedback-block]");
  if (!blockElement) {
    if (node === root) {
      const blockIndex = Math.min(
        Math.max(0, domOffset),
        value.children.length - 1,
      );
      return blockStartOffset(value, blockIndex);
    }
    return null;
  }

  const blockIndex = Number(blockElement.dataset.blockIndex);
  if (!Number.isInteger(blockIndex) || !value.children[blockIndex]) {
    return null;
  }
  const start = blockStartOffset(value, blockIndex);
  const nodeElement = element?.closest<HTMLElement>("[data-feedback-node]");
  if (nodeElement) {
    const nodeIndex = Number(nodeElement.dataset.nodeIndex);
    const block = value.children[blockIndex];
    if (!Number.isInteger(nodeIndex) || !block?.children[nodeIndex]) {
      return start;
    }
    const precedingLength = block.children
      .slice(0, nodeIndex)
      .reduce((total, child) => total + child.text.length, 0);
    const nodeLength = block.children[nodeIndex]?.text.length ?? 0;
    return start + precedingLength + Math.min(Math.max(0, domOffset), nodeLength);
  }

  if (node === blockElement) {
    const childCount = Math.min(domOffset, blockElement.childNodes.length);
    let length = 0;
    for (let index = 0; index < childCount; index += 1) {
      length += blockElement.childNodes[index]?.textContent?.length ?? 0;
    }
    return start + Math.min(length, blockTextLength(value, blockIndex));
  }
  return start;
}

function captureSelection(
  root: HTMLElement,
  value: FeedbackRichTextDocument | null,
): SelectionOffsets | null {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.rangeCount === 0 ||
    !selection.anchorNode ||
    !selection.focusNode
  ) {
    return null;
  }
  const anchor = pointToOffset(
    root,
    value,
    selection.anchorNode,
    selection.anchorOffset,
  );
  const focus = pointToOffset(
    root,
    value,
    selection.focusNode,
    selection.focusOffset,
  );
  if (anchor === null || focus === null) {
    return null;
  }
  return {
    start: Math.min(anchor, focus),
    end: Math.max(anchor, focus),
  };
}

function domPointAtOffset(
  root: HTMLElement,
  value: FeedbackRichTextDocument | null,
  requestedOffset: number,
): { node: Node; offset: number } {
  const firstBlock = root.querySelector<HTMLElement>("[data-feedback-block]");
  if (!value || !firstBlock) {
    return { node: firstBlock ?? root, offset: 0 };
  }
  const maximum = extractFeedbackRichText(value).length;
  const offset = Math.min(Math.max(0, requestedOffset), maximum);
  let blockIndex = value.children.length - 1;
  for (let index = 0; index < value.children.length; index += 1) {
    const start = blockStartOffset(value, index);
    const end = start + blockTextLength(value, index);
    if (offset <= end) {
      blockIndex = index;
      break;
    }
  }
  const block = value.children[blockIndex];
  const blockElement = root.querySelector<HTMLElement>(
    `[data-block-index="${blockIndex}"]`,
  );
  if (!block || !blockElement) {
    return { node: firstBlock, offset: 0 };
  }
  let innerOffset = Math.max(0, offset - blockStartOffset(value, blockIndex));
  for (let nodeIndex = 0; nodeIndex < block.children.length; nodeIndex += 1) {
    const child = block.children[nodeIndex];
    if (!child) {
      continue;
    }
    const nodeElement = blockElement.querySelector<HTMLElement>(
      `[data-node-index="${nodeIndex}"]`,
    );
    const textNode = nodeElement?.firstChild;
    if (innerOffset <= child.text.length && textNode) {
      return {
        node: textNode,
        offset: Math.min(innerOffset, child.text.length),
      };
    }
    innerOffset -= child.text.length;
  }
  return { node: blockElement, offset: blockElement.childNodes.length };
}

function restoreSelection(
  root: HTMLElement,
  value: FeedbackRichTextDocument | null,
  selection: SelectionOffsets,
) {
  const start = domPointAtOffset(root, value, selection.start);
  const end = domPointAtOffset(root, value, selection.end);
  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const domSelection = window.getSelection();
  domSelection?.removeAllRanges();
  domSelection?.addRange(range);
}

/** Model-driven implementation loaded by the public lazy facade. */
export function ConstrainedRichTextEditorImplementation({
  labels,
  placeholder,
  value,
  onChange,
  onBlur,
  onConstraintViolation,
  id,
  className,
  describedBy,
  required = false,
  disabled = false,
  readOnly = false,
  autoFocus = false,
}: ConstrainedRichTextEditorProps) {
  const generatedId = useId();
  const editorId = id ?? `constrained-rich-text-${generatedId}`;
  const counterId = `${editorId}-counter`;
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const pendingSelectionRef = useRef<SelectionOffsets | null>(null);
  const compositionSelectionRef = useRef<SelectionOffsets | null>(null);
  const [editorValue, setEditorValue] =
    useState<FeedbackRichTextDocument | null>(() =>
      normaliseFeedbackRichTextDocument(value),
    );
  const [selection, setSelection] = useState<SelectionOffsets>({
    start: 0,
    end: 0,
  });
  const selectionRef = useRef<SelectionOffsets>(selection);
  const [pendingMarks, setPendingMarks] = useState<FeedbackRichTextMark[]>([]);

  useEffect(() => {
    setEditorValue(normaliseFeedbackRichTextDocument(value));
  }, [value]);

  useLayoutEffect(() => {
    const pendingSelection = pendingSelectionRef.current;
    const editor = editorRef.current;
    if (!pendingSelection || !editor) {
      return;
    }
    pendingSelectionRef.current = null;
    editor.focus({ preventScroll: true });
    restoreSelection(editor, editorValue, pendingSelection);
  }, [editorValue]);

  useEffect(() => {
    if (autoFocus) {
      editorRef.current?.focus();
    }
  }, [autoFocus]);

  const extractedLength = countFeedbackRichTextCharacters(editorValue);
  const adjacentMarks = useMemo(
    () =>
      activeFeedbackRichTextMarks(
        editorValue,
        selection.start,
        selection.end,
      ),
    [editorValue, selection.end, selection.start],
  );
  const activeMarks =
    selection.start === selection.end && pendingMarks.length > 0
      ? pendingMarks
      : adjacentMarks;

  const updateSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return selection;
    }
    const nextSelection = captureSelection(editor, editorValue) ?? selection;
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
    return nextSelection;
  }, [editorValue, selection]);

  const commitMutation = useCallback(
    (mutation: FeedbackRichTextMutation) => {
      if (mutation.violation) {
        onConstraintViolation?.(mutation.violation);
      }
      const nextSelection = {
        start: mutation.selectionStart,
        end: mutation.selectionEnd,
      };
      selectionRef.current = nextSelection;
      setSelection(nextSelection);
      pendingSelectionRef.current = nextSelection;
      if (mutation.value !== editorValue) {
        setEditorValue(mutation.value);
        onChange(mutation.value);
      }
    },
    [editorValue, onChange, onConstraintViolation],
  );

  const applyMark = (mark: FeedbackRichTextMark) => {
    if (disabled || readOnly) {
      return;
    }
    const currentSelection = selectionRef.current;
    if (currentSelection.start === currentSelection.end) {
      setPendingMarks((current) =>
        current.includes(mark)
          ? current.filter((candidate) => candidate !== mark)
          : FEEDBACK_RICH_TEXT_MARKS.filter(
              (candidate) =>
                current.includes(candidate) || candidate === mark,
            ),
      );
      editorRef.current?.focus();
      return;
    }
    commitMutation(
      toggleFeedbackRichTextMark(
        editorValue,
        currentSelection.start,
        currentSelection.end,
        mark,
      ),
    );
  };

  const applyBlockAction = (action: "bullets" | "indent" | "outdent") => {
    if (disabled || readOnly) {
      return;
    }
    const currentSelection = selectionRef.current;
    const mutation =
      action === "bullets"
        ? toggleFeedbackRichTextBullets(
            editorValue,
            currentSelection.start,
            currentSelection.end,
          )
        : adjustFeedbackRichTextDepth(
            editorValue,
            currentSelection.start,
            currentSelection.end,
            action === "indent" ? 1 : -1,
          );
    commitMutation(mutation);
  };

  const insertText = (text: string) => {
    if (disabled || readOnly) {
      return;
    }
    const currentSelection = updateSelection();
    const marks =
      pendingMarks.length > 0
        ? pendingMarks
        : activeFeedbackRichTextMarks(
            editorValue,
            currentSelection.start,
            currentSelection.end,
          );
    commitMutation(
      replaceFeedbackRichTextRange(
        editorValue,
        currentSelection.start,
        currentSelection.end,
        text,
        marks,
      ),
    );
  };

  const deleteText = (direction: "backward" | "forward") => {
    if (disabled || readOnly) {
      return;
    }
    const currentSelection = updateSelection();
    commitMutation(
      deleteFeedbackRichTextRange(
        editorValue,
        currentSelection.start,
        currentSelection.end,
        direction,
      ),
    );
  };

  const handleBeforeInput = (event: FormEvent<HTMLDivElement>) => {
    const inputEvent = event.nativeEvent as InputEvent;
    const inputType =
      typeof inputEvent.inputType === "string" ? inputEvent.inputType : "";
    if (!inputType) {
      return;
    }
    if (
      inputType === "insertFromPaste" ||
      inputType === "insertFromDrop" ||
      inputType.startsWith("format") ||
      inputType === "insertLink"
    ) {
      event.preventDefault();
      return;
    }
    if (inputType === "insertCompositionText") {
      event.preventDefault();
      return;
    }
    if (inputType === "insertText") {
      event.preventDefault();
      insertText(inputEvent.data ?? "");
      return;
    }
    if (inputType === "insertParagraph" || inputType === "insertLineBreak") {
      event.preventDefault();
      insertText("\n");
      return;
    }
    if (inputType === "deleteContentBackward") {
      event.preventDefault();
      deleteText("backward");
      return;
    }
    if (inputType === "deleteContentForward") {
      event.preventDefault();
      deleteText("forward");
      return;
    }
    if (inputType) {
      event.preventDefault();
      onConstraintViolation?.("unsupported-content");
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const modifier = event.ctrlKey || event.metaKey;
    const lowerKey = event.key.toLowerCase();
    if (modifier && ["b", "i", "u"].includes(lowerKey)) {
      event.preventDefault();
      applyMark(
        lowerKey === "b" ? "bold" : lowerKey === "i" ? "italic" : "underline",
      );
      return;
    }
    if (
      modifier &&
      event.shiftKey &&
      (event.code === "Digit8" || event.key === "8" || event.key === "*")
    ) {
      event.preventDefault();
      applyBlockAction("bullets");
      return;
    }
    if (modifier && event.key === "]") {
      event.preventDefault();
      applyBlockAction("indent");
      return;
    }
    if (modifier && event.key === "[") {
      event.preventDefault();
      applyBlockAction("outdent");
      return;
    }
    if (event.key === "Tab") {
      const domSelection = event.currentTarget.ownerDocument.getSelection();
      const anchorElement =
        domSelection?.anchorNode instanceof Element
          ? domSelection.anchorNode
          : domSelection?.anchorNode?.parentElement;
      const selectedListItem = anchorElement?.closest(
        "[data-block-type='listItem']",
      );
      if (
        !selectedListItem ||
        !event.currentTarget.contains(selectedListItem)
      ) {
        return;
      }

      const currentSelection = updateSelection();
      const mutation = adjustFeedbackRichTextDepth(
        editorValue,
        currentSelection.start,
        currentSelection.end,
        event.shiftKey ? -1 : 1,
      );
      if (mutation.value !== editorValue) {
        event.preventDefault();
        commitMutation(mutation);
      }
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const plainText = event.clipboardData.getData("text/plain");
    if (!plainText) {
      if (
        event.clipboardData.files.length > 0 ||
        Array.from(event.clipboardData.types).some(
          (type) => type !== "text/plain",
        )
      ) {
        onConstraintViolation?.("unsupported-content");
      }
      return;
    }
    insertText(plainText);
  };

  const handleCompositionStart = () => {
    compositionSelectionRef.current = updateSelection();
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLDivElement>) => {
    if (disabled || readOnly) {
      compositionSelectionRef.current = null;
      return;
    }
    const currentSelection =
      compositionSelectionRef.current ?? selectionRef.current;
    compositionSelectionRef.current = null;
    const marks =
      pendingMarks.length > 0
        ? pendingMarks
        : activeFeedbackRichTextMarks(
            editorValue,
            currentSelection.start,
            currentSelection.end,
          );
    commitMutation(
      replaceFeedbackRichTextRange(
        editorValue,
        currentSelection.start,
        currentSelection.end,
        event.data,
        marks,
      ),
    );
  };

  const handleCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    const currentSelection = updateSelection();
    if (currentSelection.start === currentSelection.end) {
      return;
    }
    event.preventDefault();
    event.clipboardData.setData(
      "text/plain",
      extractFeedbackRichText(editorValue).slice(
        currentSelection.start,
        currentSelection.end,
      ),
    );
  };

  const handleCut = (event: ClipboardEvent<HTMLDivElement>) => {
    if (readOnly || disabled) {
      handleCopy(event);
      return;
    }
    handleCopy(event);
    deleteText("backward");
  };

  const preserveEditorSelection = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const handleContainerBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (
      event.relatedTarget instanceof Node &&
      containerRef.current?.contains(event.relatedTarget)
    ) {
      return;
    }
    onBlur?.(event);
  };

  const describedByIds = [describedBy, counterId].filter(Boolean).join(" ");
  const renderBlocks =
    editorValue?.children.length
      ? editorValue.children
      : [
          {
            type: "paragraph" as const,
            depth: 0,
            children: [],
          },
        ];

  return (
    <div
      ref={containerRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      onBlur={handleContainerBlur}
    >
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label={labels.toolbar}
      >
        {FEEDBACK_RICH_TEXT_MARKS.map((mark) => (
          <button
            key={mark}
            type="button"
            className={[styles.toolbarButton, styles[mark]].join(" ")}
            aria-label={labels[mark]}
            aria-pressed={activeMarks.includes(mark)}
            disabled={disabled || readOnly}
            onMouseDown={preserveEditorSelection}
            onClick={() => applyMark(mark)}
          >
            {markButtonText[mark]}
          </button>
        ))}
        <span className={styles.toolbarSeparator} aria-hidden="true" />
        <button
          type="button"
          className={styles.toolbarButton}
          aria-label={labels.bullets}
          aria-pressed={selectedFeedbackRichTextBlocksAreBulleted(
            editorValue,
            selection.start,
            selection.end,
          )}
          disabled={disabled || readOnly}
          onMouseDown={preserveEditorSelection}
          onClick={() => applyBlockAction("bullets")}
        >
          •
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          aria-label={labels.outdent}
          aria-pressed={false}
          disabled={disabled || readOnly}
          onMouseDown={preserveEditorSelection}
          onClick={() => applyBlockAction("outdent")}
        >
          ←
        </button>
        <button
          type="button"
          className={styles.toolbarButton}
          aria-label={labels.indent}
          aria-pressed={false}
          disabled={disabled || readOnly}
          onMouseDown={preserveEditorSelection}
          onClick={() => applyBlockAction("indent")}
        >
          →
        </button>
      </div>
      <div
        ref={editorRef}
        id={editorId}
        className={styles.editor}
        role="textbox"
        aria-label={labels.editor}
        aria-multiline="true"
        aria-required={required}
        aria-readonly={readOnly}
        aria-disabled={disabled}
        aria-describedby={describedByIds || undefined}
        contentEditable={!disabled && !readOnly}
        suppressContentEditableWarning={true}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        translate="no"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
        data-empty={!editorValue || extractedLength === 0 ? "true" : "false"}
        data-placeholder={placeholder}
        onBeforeInput={handleBeforeInput}
        onInput={handleBeforeInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        onCopy={handleCopy}
        onCut={handleCut}
        onDrop={(event) => {
          event.preventDefault();
          onConstraintViolation?.("unsupported-content");
        }}
        onSelect={() => {
          setPendingMarks([]);
          updateSelection();
        }}
        onKeyUp={updateSelection}
        onMouseUp={updateSelection}
      >
        {renderBlocks.map((block, blockIndex) => (
          <div
            key={`${block.type}-${blockIndex}`}
            className={[
              styles.block,
              block.type === "listItem" ? styles.listItem : undefined,
            ]
              .filter(Boolean)
              .join(" ")}
            data-feedback-block="true"
            data-block-index={blockIndex}
            data-block-type={block.type}
            data-depth={block.depth}
            style={{ "--feedback-depth": block.depth } as CSSProperties}
          >
            {block.children.length > 0 ? (
              block.children.map((node, nodeIndex) => (
                <span
                  key={`${nodeIndex}-${node.text.length}`}
                  className={[
                    styles.textNode,
                    ...(node.marks ?? []).map((mark) => styles[mark]),
                  ].join(" ")}
                  data-feedback-node="true"
                  data-node-index={nodeIndex}
                  data-marks={(node.marks ?? []).join(" ")}
                >
                  {node.text}
                </span>
              ))
            ) : (
              <br />
            )}
          </div>
        ))}
      </div>
      <span id={counterId} className={styles.counter}>
        {extractedLength} / {FEEDBACK_RICH_TEXT_MAX_CHARACTERS}
      </span>
    </div>
  );
}

export default ConstrainedRichTextEditorImplementation;
