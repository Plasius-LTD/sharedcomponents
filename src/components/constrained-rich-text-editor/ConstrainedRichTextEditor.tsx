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
  FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS,
  type FeedbackRichTextConstraint,
  type FeedbackRichTextDocument,
  type FeedbackRichTextMark,
} from "./model.js";
import {
  activeFeedbackRichTextEditingMarks,
  adjustFeedbackRichTextEditingDepth,
  countFeedbackRichTextEditingCharacters,
  createFeedbackRichTextEditingState,
  deleteFeedbackRichTextEditingRange,
  extractFeedbackRichTextEditingState,
  feedbackRichTextDocumentsEqual,
  projectFeedbackRichTextEditingState,
  replaceFeedbackRichTextEditingRange,
  selectedFeedbackRichTextEditingBlocksAreBulleted,
  toggleFeedbackRichTextEditingBullets,
  toggleFeedbackRichTextEditingMark,
  type FeedbackRichTextEditingMutation,
  type FeedbackRichTextEditingState,
} from "./editing-state.js";
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

interface PendingDomRestore {
  selection: SelectionOffsets;
  restoreFocus: boolean;
  focusExitGeneration: number;
}

interface CompositionTransaction {
  value: FeedbackRichTextEditingState;
  selection: SelectionOffsets;
  marks: readonly FeedbackRichTextMark[];
  canonicalText: string;
}

const markButtonText: Record<FeedbackRichTextMark, string> = {
  bold: "B",
  italic: "I",
  underline: "U",
};

function blockTextLength(
  value: FeedbackRichTextEditingState,
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
  value: FeedbackRichTextEditingState,
  blockIndex: number,
): number {
  let offset = 0;
  for (let index = 0; index < blockIndex; index += 1) {
    offset += blockTextLength(value, index) + 1;
  }
  return offset;
}

function isValidDomOffset(offset: number, maximum: number): boolean {
  return Number.isInteger(offset) && offset >= 0 && offset <= maximum;
}

function isUtf16Boundary(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) {
    return true;
  }
  const precedingCodeUnit = text.charCodeAt(offset - 1);
  const followingCodeUnit = text.charCodeAt(offset);
  return !(
    precedingCodeUnit >= 0xd800 &&
    precedingCodeUnit <= 0xdbff &&
    followingCodeUnit >= 0xdc00 &&
    followingCodeUnit <= 0xdfff
  );
}

function blockDomMatchesEditingState(
  root: HTMLElement,
  value: FeedbackRichTextEditingState,
  blockElement: HTMLElement,
  blockIndex: number,
): boolean {
  const block = value.children[blockIndex];
  if (
    !block ||
    blockElement.parentNode !== root ||
    root.childNodes[blockIndex] !== blockElement ||
    blockElement.dataset.feedbackBlock !== "true" ||
    blockElement.dataset.blockIndex !== String(blockIndex)
  ) {
    return false;
  }

  if (block.children.length === 0) {
    return (
      blockElement.childNodes.length === 1 &&
      blockElement.firstChild?.nodeName === "BR"
    );
  }
  if (blockElement.childNodes.length !== block.children.length) {
    return false;
  }

  return block.children.every((child, nodeIndex) => {
    const nodeElement = blockElement.childNodes[nodeIndex];
    const textNode = nodeElement?.firstChild;
    return (
      nodeElement instanceof HTMLElement &&
      nodeElement.dataset.feedbackNode === "true" &&
      nodeElement.dataset.nodeIndex === String(nodeIndex) &&
      nodeElement.childNodes.length === 1 &&
      textNode?.nodeType === Node.TEXT_NODE &&
      textNode.textContent === child.text
    );
  });
}

function rootDomMatchesEditingState(
  root: HTMLElement,
  value: FeedbackRichTextEditingState,
): boolean {
  return (
    root.childNodes.length === value.children.length &&
    value.children.every((_, blockIndex) => {
      const blockElement = root.childNodes[blockIndex];
      return (
        blockElement instanceof HTMLElement &&
        blockDomMatchesEditingState(root, value, blockElement, blockIndex)
      );
    })
  );
}

function readTextOnlyChildren(
  parent: HTMLElement,
  maximumCodeUnits: number,
): string | null {
  if (parent.childNodes.length > 4) {
    return null;
  }
  let text = "";
  for (const child of parent.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE) {
      return null;
    }
    const value = (child as Text).data;
    if (value.length > maximumCodeUnits - text.length) {
      return null;
    }
    text += value;
  }
  return text;
}

/**
 * Reads only the small DOM shape that a native IME may mutate in place.
 * Elements, attributes, HTML, and arbitrary descendants are never parsed or
 * trusted; any structural drift fails closed and is rebuilt from the model.
 */
function readBoundedCompositionDomText(
  root: HTMLElement,
  value: FeedbackRichTextEditingState,
): string | null {
  if (
    root.childNodes.length !== value.children.length ||
    value.children.length === 0
  ) {
    return null;
  }

  let text = "";
  for (let blockIndex = 0; blockIndex < value.children.length; blockIndex += 1) {
    const block = value.children[blockIndex];
    const blockElement = root.childNodes[blockIndex];
    if (
      !block ||
      !(blockElement instanceof HTMLElement) ||
      blockElement.parentNode !== root ||
      blockElement.dataset.feedbackBlock !== "true" ||
      blockElement.dataset.blockIndex !== String(blockIndex) ||
      blockElement.dataset.blockType !== block.type ||
      blockElement.dataset.depth !== String(block.depth)
    ) {
      return null;
    }

    if (blockIndex > 0) {
      if (text.length >= FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS) {
        return null;
      }
      text += "\n";
    }

    let blockText = "";
    if (block.children.length === 0) {
      if (
        blockElement.childNodes.length === 1 &&
        blockElement.firstChild?.nodeName === "BR"
      ) {
        blockText = "";
      } else {
        blockText =
          readTextOnlyChildren(
            blockElement,
            FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS - text.length,
          ) ?? "";
        if (
          blockText.length === 0 &&
          blockElement.childNodes.length > 0
        ) {
          return null;
        }
      }
    } else {
      if (blockElement.childNodes.length !== block.children.length) {
        return null;
      }
      for (let nodeIndex = 0; nodeIndex < block.children.length; nodeIndex += 1) {
        const nodeElement: ChildNode | undefined =
          blockElement.childNodes[nodeIndex];
        if (
          !(nodeElement instanceof HTMLElement) ||
          nodeElement.parentNode !== blockElement ||
          nodeElement.dataset.feedbackNode !== "true" ||
          nodeElement.dataset.nodeIndex !== String(nodeIndex)
        ) {
          return null;
        }
        const nodeText = readTextOnlyChildren(
          nodeElement,
          FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS -
            text.length -
            blockText.length,
        );
        if (nodeText === null) {
          return null;
        }
        blockText += nodeText;
      }
    }

    if (
      blockText.length >
      FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS - text.length
    ) {
      return null;
    }
    text += blockText;
  }
  return text;
}

function pointToOffset(
  root: HTMLElement,
  value: FeedbackRichTextEditingState,
  node: Node,
  domOffset: number,
): number | null {
  if (!Number.isInteger(domOffset) || domOffset < 0) {
    return null;
  }

  if (node === root) {
    if (
      !isValidDomOffset(domOffset, root.childNodes.length) ||
      !rootDomMatchesEditingState(root, value)
    ) {
      return null;
    }
    return domOffset === value.children.length
      ? extractFeedbackRichTextEditingState(value).length
      : blockStartOffset(value, domOffset);
  }
  if (!root.contains(node)) {
    return null;
  }

  const containingElement =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  const blockElement =
    containingElement?.closest<HTMLElement>("[data-feedback-block]") ?? null;
  if (!blockElement || blockElement.parentNode !== root) {
    return null;
  }
  const blockIndex = Number(blockElement.dataset.blockIndex);
  if (
    !Number.isInteger(blockIndex) ||
    !blockDomMatchesEditingState(root, value, blockElement, blockIndex)
  ) {
    return null;
  }

  const block = value.children[blockIndex];
  if (!block) {
    return null;
  }
  const start = blockStartOffset(value, blockIndex);

  if (node === blockElement) {
    if (!isValidDomOffset(domOffset, blockElement.childNodes.length)) {
      return null;
    }
    return (
      start +
      block.children
        .slice(0, domOffset)
        .reduce((length, child) => length + child.text.length, 0)
    );
  }

  const nodeElement =
    containingElement?.closest<HTMLElement>("[data-feedback-node]") ?? null;
  if (!nodeElement || nodeElement.parentNode !== blockElement) {
    return null;
  }
  const nodeIndex = Number(nodeElement.dataset.nodeIndex);
  const editingNode = block.children[nodeIndex];
  if (
    !Number.isInteger(nodeIndex) ||
    !editingNode ||
    blockElement.childNodes[nodeIndex] !== nodeElement
  ) {
    return null;
  }
  const precedingLength = block.children
    .slice(0, nodeIndex)
    .reduce((total, child) => total + child.text.length, 0);

  if (node === nodeElement) {
    if (!isValidDomOffset(domOffset, nodeElement.childNodes.length)) {
      return null;
    }
    return (
      start +
      precedingLength +
      (domOffset === 0 ? 0 : editingNode.text.length)
    );
  }

  if (
    node.nodeType !== Node.TEXT_NODE ||
    node.parentNode !== nodeElement ||
    nodeElement.firstChild !== node ||
    !isValidDomOffset(domOffset, editingNode.text.length) ||
    !isUtf16Boundary(editingNode.text, domOffset)
  ) {
    return null;
  }
  return start + precedingLength + domOffset;
}

function captureSelection(
  root: HTMLElement,
  value: FeedbackRichTextEditingState,
): SelectionOffsets | null {
  const selection = window.getSelection();
  if (
    !selection ||
    selection.rangeCount !== 1 ||
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
  let range: Range;
  try {
    range = selection.getRangeAt(0);
  } catch {
    return null;
  }
  const rangeStart = pointToOffset(
    root,
    value,
    range.startContainer,
    range.startOffset,
  );
  const rangeEnd = pointToOffset(
    root,
    value,
    range.endContainer,
    range.endOffset,
  );
  const start = Math.min(anchor, focus);
  const end = Math.max(anchor, focus);
  if (
    rangeStart === null ||
    rangeEnd === null ||
    rangeStart !== start ||
    rangeEnd !== end ||
    selection.isCollapsed !== (start === end)
  ) {
    return null;
  }
  return {
    start,
    end,
  };
}

function domPointAtOffset(
  root: HTMLElement,
  value: FeedbackRichTextEditingState,
  requestedOffset: number,
): { node: Node; offset: number } {
  const firstBlock = root.querySelector<HTMLElement>("[data-feedback-block]");
  if (!firstBlock) {
    return { node: firstBlock ?? root, offset: 0 };
  }
  const maximum = extractFeedbackRichTextEditingState(value).length;
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
  value: FeedbackRichTextEditingState,
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
  const blockRefs = useRef<Array<HTMLDivElement | null>>([]);
  const pendingDomRestoreRef = useRef<PendingDomRestore | null>(null);
  const internalResetPendingRef = useRef(false);
  const focusExitGenerationRef = useRef(0);
  const deferredBlurGenerationRef = useRef(0);
  const nativeBeforeInputHandlerRef = useRef<(event: InputEvent) => void>(
    () => undefined,
  );
  const compositionTransactionRef = useRef<CompositionTransaction | null>(
    null,
  );
  const [editingState, setEditingState] =
    useState<FeedbackRichTextEditingState>(() =>
      createFeedbackRichTextEditingState(value),
    );
  const [domRevision, setDomRevision] = useState(0);
  const [selection, setSelection] = useState<SelectionOffsets>({
    start: 0,
    end: 0,
  });
  const selectionRef = useRef<SelectionOffsets>(selection);
  const [pendingMarks, setPendingMarks] = useState<FeedbackRichTextMark[]>([]);
  const setEditorElement = useCallback((node: HTMLDivElement | null) => {
    editorRef.current = node;
    if (node) {
      node.setAttribute("writingsuggestions", "false");
    }
  }, []);

  useEffect(() => {
    setEditingState((current) => {
      const currentProjection = projectFeedbackRichTextEditingState(current);
      const incoming = createFeedbackRichTextEditingState(value);
      const incomingProjection =
        projectFeedbackRichTextEditingState(incoming);
      return feedbackRichTextDocumentsEqual(
        currentProjection,
        incomingProjection,
      )
        ? current
        : incoming;
    });
  }, [value]);

  useLayoutEffect(() => {
    const pendingRestore = pendingDomRestoreRef.current;
    const editor = editorRef.current;
    if (!pendingRestore || !editor) {
      internalResetPendingRef.current = false;
      return;
    }
    pendingDomRestoreRef.current = null;
    const canonicalBlocks = editingState.children.map(
      (_, blockIndex) => blockRefs.current[blockIndex] ?? null,
    );
    const resolvedCanonicalBlocks = canonicalBlocks.filter(
      (block): block is HTMLDivElement => block !== null,
    );
    if (resolvedCanonicalBlocks.length === canonicalBlocks.length) {
      const canonicalBlockSet = new Set<Node>(resolvedCanonicalBlocks);
      for (const child of Array.from(editor.childNodes)) {
        if (!canonicalBlockSet.has(child)) {
          editor.removeChild(child);
        }
      }
      for (
        let blockIndex = 0;
        blockIndex < resolvedCanonicalBlocks.length;
        blockIndex += 1
      ) {
        const block = resolvedCanonicalBlocks[blockIndex];
        if (block && editor.childNodes[blockIndex] !== block) {
          editor.insertBefore(block, editor.childNodes[blockIndex] ?? null);
        }
      }
      blockRefs.current.length = canonicalBlocks.length;
    }
    if (
      pendingRestore.restoreFocus &&
      pendingRestore.focusExitGeneration === focusExitGenerationRef.current
    ) {
      editor.focus({ preventScroll: true });
      restoreSelection(editor, editingState, pendingRestore.selection);
    }
    internalResetPendingRef.current = false;
  }, [domRevision, editingState]);

  useEffect(() => {
    if (autoFocus) {
      editorRef.current?.focus();
    }
  }, [autoFocus]);

  const extractedLength =
    countFeedbackRichTextEditingCharacters(editingState);
  const adjacentMarks = useMemo(
    () =>
      activeFeedbackRichTextEditingMarks(
        editingState,
        selection.start,
        selection.end,
      ),
    [editingState, selection.end, selection.start],
  );
  const activeMarks =
    selection.start === selection.end && pendingMarks.length > 0
      ? pendingMarks
      : adjacentMarks;

  const scheduleDomRestore = useCallback(
    (nextSelection: SelectionOffsets, forceCanonicalRebuild: boolean) => {
      const editor = editorRef.current;
      const activeElement = document.activeElement;
      pendingDomRestoreRef.current = {
        selection: nextSelection,
        restoreFocus:
          !!editor &&
          !!activeElement &&
          (activeElement === editor || editor.contains(activeElement)),
        focusExitGeneration: focusExitGenerationRef.current,
      };
      internalResetPendingRef.current = true;
      if (forceCanonicalRebuild) {
        setDomRevision((current) => current + 1);
      }
    },
    [],
  );

  const restoreCanonicalDom = useCallback(
    (
      nextSelection: SelectionOffsets,
      violation?: FeedbackRichTextConstraint,
    ) => {
      if (violation) {
        onConstraintViolation?.(violation);
      }
      selectionRef.current = nextSelection;
      setSelection(nextSelection);
      scheduleDomRestore(nextSelection, true);
    },
    [onConstraintViolation, scheduleDomRestore],
  );

  const captureCurrentSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) {
      return null;
    }
    const nextSelection = captureSelection(editor, editingState);
    if (!nextSelection) {
      return null;
    }
    selectionRef.current = nextSelection;
    setSelection(nextSelection);
    return nextSelection;
  }, [editingState]);

  const requireFreshSelection = useCallback(() => {
    const currentSelection = captureCurrentSelection();
    if (!currentSelection) {
      restoreCanonicalDom(selectionRef.current, "unsupported-content");
    }
    return currentSelection;
  }, [captureCurrentSelection, restoreCanonicalDom]);

  const commitMutation = useCallback(
    (mutation: FeedbackRichTextEditingMutation) => {
      if (mutation.violation) {
        onConstraintViolation?.(mutation.violation);
      }
      const nextSelection = {
        start: mutation.selectionStart,
        end: mutation.selectionEnd,
      };
      selectionRef.current = nextSelection;
      setSelection(nextSelection);
      if (mutation.value !== editingState) {
        scheduleDomRestore(nextSelection, false);
        const currentProjection =
          projectFeedbackRichTextEditingState(editingState);
        const nextProjection =
          projectFeedbackRichTextEditingState(mutation.value);
        setEditingState(mutation.value);
        if (
          !feedbackRichTextDocumentsEqual(currentProjection, nextProjection)
        ) {
          onChange(nextProjection);
        }
      }
    },
    [
      editingState,
      onChange,
      onConstraintViolation,
      scheduleDomRestore,
    ],
  );

  const applyMark = (mark: FeedbackRichTextMark) => {
    if (disabled || readOnly) {
      return;
    }
    const currentSelection = requireFreshSelection();
    if (!currentSelection) {
      return;
    }
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
      toggleFeedbackRichTextEditingMark(
        editingState,
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
    const currentSelection = requireFreshSelection();
    if (!currentSelection) {
      return;
    }
    const mutation =
      action === "bullets"
        ? toggleFeedbackRichTextEditingBullets(
            editingState,
            currentSelection.start,
            currentSelection.end,
          )
        : adjustFeedbackRichTextEditingDepth(
            editingState,
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
    const currentSelection = requireFreshSelection();
    if (!currentSelection) {
      return;
    }
    const marks =
      pendingMarks.length > 0
        ? pendingMarks
        : activeFeedbackRichTextEditingMarks(
            editingState,
            currentSelection.start,
            currentSelection.end,
          );
    commitMutation(
      replaceFeedbackRichTextEditingRange(
        editingState,
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
    const currentSelection = requireFreshSelection();
    if (!currentSelection) {
      return;
    }
    commitMutation(
      deleteFeedbackRichTextEditingRange(
        editingState,
        currentSelection.start,
        currentSelection.end,
        direction,
      ),
    );
  };

  const handleNativeBeforeInput = (inputEvent: InputEvent) => {
    const inputType =
      typeof inputEvent.inputType === "string" ? inputEvent.inputType : "";
    if (
      inputEvent.isComposing ||
      inputType.toLowerCase().includes("composition")
    ) {
      if (compositionTransactionRef.current !== null) {
        return;
      }
      if (inputEvent.cancelable) {
        inputEvent.preventDefault();
        restoreCanonicalDom(
          selectionRef.current,
          "unsupported-content",
        );
      }
      return;
    }
    if (!inputEvent.cancelable) {
      return;
    }
    inputEvent.preventDefault();
    if (!inputEvent.defaultPrevented) {
      return;
    }
    if (
      !inputType ||
      inputType === "insertFromPaste" ||
      inputType === "insertFromDrop" ||
      inputType.startsWith("format") ||
      inputType === "insertLink"
    ) {
      restoreCanonicalDom(selectionRef.current, "unsupported-content");
      return;
    }
    if (inputType === "insertText") {
      if (typeof inputEvent.data !== "string") {
        restoreCanonicalDom(selectionRef.current, "unsupported-content");
        return;
      }
      insertText(inputEvent.data);
      return;
    }
    if (inputType === "insertParagraph" || inputType === "insertLineBreak") {
      insertText("\n");
      return;
    }
    if (inputType === "deleteContentBackward") {
      deleteText("backward");
      return;
    }
    if (inputType === "deleteContentForward") {
      deleteText("forward");
      return;
    }
    restoreCanonicalDom(selectionRef.current, "unsupported-content");
  };

  useLayoutEffect(() => {
    nativeBeforeInputHandlerRef.current = handleNativeBeforeInput;
  });

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const handleBeforeInput = (event: Event) => {
      nativeBeforeInputHandlerRef.current(event as InputEvent);
    };
    editor.addEventListener("beforeinput", handleBeforeInput);
    return () => {
      editor.removeEventListener("beforeinput", handleBeforeInput);
    };
  }, []);

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    if (compositionTransactionRef.current !== null) {
      return;
    }
    event.preventDefault();
    restoreCanonicalDom(selectionRef.current, "unsupported-content");
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
      const currentSelection = requireFreshSelection();
      if (!currentSelection) {
        return;
      }
      if (
        !selectedFeedbackRichTextEditingBlocksAreBulleted(
          editingState,
          currentSelection.start,
          currentSelection.end,
        )
      ) {
        return;
      }

      const mutation = adjustFeedbackRichTextEditingDepth(
        editingState,
        currentSelection.start,
        currentSelection.end,
        event.shiftKey ? -1 : 1,
      );
      if (mutation.value !== editingState) {
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
    if (disabled || readOnly) {
      compositionTransactionRef.current = null;
      return;
    }
    const editor = editorRef.current;
    const currentSelection =
      editor === null ? null : captureSelection(editor, editingState);
    if (currentSelection === null) {
      compositionTransactionRef.current = null;
      restoreCanonicalDom(selectionRef.current, "unsupported-content");
      return;
    }
    const marks =
      pendingMarks.length > 0
        ? pendingMarks
        : activeFeedbackRichTextEditingMarks(
            editingState,
            currentSelection.start,
            currentSelection.end,
          );
    selectionRef.current = currentSelection;
    setSelection(currentSelection);
    compositionTransactionRef.current = {
      value: editingState,
      selection: currentSelection,
      marks,
      canonicalText: extractFeedbackRichTextEditingState(editingState),
    };
  };

  const handleCompositionEnd = (event: CompositionEvent<HTMLDivElement>) => {
    const transaction = compositionTransactionRef.current;
    compositionTransactionRef.current = null;
    if (
      disabled ||
      readOnly ||
      !transaction ||
      transaction.value !== editingState
    ) {
      restoreCanonicalDom(
        transaction?.selection ?? selectionRef.current,
        "unsupported-content",
      );
      return;
    }
    const insertedText = event.data;
    if (typeof insertedText !== "string") {
      restoreCanonicalDom(transaction.selection, "unsupported-content");
      return;
    }
    const replacedCodeUnits =
      transaction.selection.end - transaction.selection.start;
    if (
      insertedText.length > FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS ||
      transaction.canonicalText.length -
        replacedCodeUnits +
        insertedText.length >
        FEEDBACK_RICH_TEXT_MAX_UTF16_CODE_UNITS
    ) {
      restoreCanonicalDom(transaction.selection, "character-limit");
      return;
    }

    const expectedText =
      transaction.canonicalText.slice(0, transaction.selection.start) +
      insertedText +
      transaction.canonicalText.slice(transaction.selection.end);
    const mutation = replaceFeedbackRichTextEditingRange(
      editingState,
      transaction.selection.start,
      transaction.selection.end,
      insertedText,
      transaction.marks,
    );
    if (mutation.violation) {
      restoreCanonicalDom(transaction.selection, mutation.violation);
      return;
    }

    const editor = editorRef.current;
    const observedText =
      editor === null
        ? null
        : readBoundedCompositionDomText(editor, transaction.value);
    if (
      observedText === null ||
      (insertedText.length === 0
        ? observedText !== transaction.canonicalText &&
          observedText !== expectedText
        : observedText !== expectedText)
    ) {
      restoreCanonicalDom(transaction.selection, "unsupported-content");
      return;
    }
    if (
      insertedText.length === 0 &&
      observedText === transaction.canonicalText
    ) {
      restoreCanonicalDom(transaction.selection);
      return;
    }

    commitMutation(mutation);
    restoreCanonicalDom({
      start: mutation.selectionStart,
      end: mutation.selectionEnd,
    });
  };

  const copySelection = (
    event: ClipboardEvent<HTMLDivElement>,
    currentSelection: SelectionOffsets | null,
  ): boolean => {
    event.preventDefault();
    if (
      !currentSelection ||
      currentSelection.start === currentSelection.end
    ) {
      return false;
    }
    try {
      event.clipboardData.setData(
        "text/plain",
        extractFeedbackRichTextEditingState(editingState).slice(
          currentSelection.start,
          currentSelection.end,
        ),
      );
    } catch {
      return false;
    }
    return true;
  };

  const captureClipboardSelection = (): SelectionOffsets | null => {
    const editor = editorRef.current;
    if (!editor) {
      return null;
    }
    const currentSelection = captureSelection(editor, editingState);
    if (!currentSelection) {
      return null;
    }
    selectionRef.current = currentSelection;
    setSelection(currentSelection);
    return currentSelection;
  };

  const handleCopy = (event: ClipboardEvent<HTMLDivElement>) => {
    copySelection(event, captureClipboardSelection());
  };

  const handleCut = (event: ClipboardEvent<HTMLDivElement>) => {
    const currentSelection = captureClipboardSelection();
    if (readOnly || disabled) {
      copySelection(event, currentSelection);
      return;
    }
    if (!currentSelection) {
      event.preventDefault();
      restoreCanonicalDom(selectionRef.current, "unsupported-content");
      return;
    }
    if (!copySelection(event, currentSelection)) {
      return;
    }
    commitMutation(
      deleteFeedbackRichTextEditingRange(
        editingState,
        currentSelection.start,
        currentSelection.end,
        "backward",
      ),
    );
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
    if (
      internalResetPendingRef.current &&
      event.relatedTarget === null
    ) {
      const deferredGeneration = deferredBlurGenerationRef.current + 1;
      deferredBlurGenerationRef.current = deferredGeneration;
      const blurEvent = event;
      queueMicrotask(() => {
        if (deferredBlurGenerationRef.current !== deferredGeneration) {
          return;
        }
        const container = containerRef.current;
        if (!container || container.contains(document.activeElement)) {
          return;
        }
        focusExitGenerationRef.current += 1;
        onBlur?.(blurEvent);
      });
      return;
    }
    focusExitGenerationRef.current += 1;
    onBlur?.(event);
  };

  const describedByIds = [describedBy, counterId].filter(Boolean).join(" ");
  const renderBlocks = editingState.children;

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
          aria-pressed={selectedFeedbackRichTextEditingBlocksAreBulleted(
            editingState,
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
        ref={setEditorElement}
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
        data-empty={extractedLength === 0 ? "true" : "false"}
        data-placeholder={placeholder}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onPaste={handlePaste}
        onCopy={handleCopy}
        onCut={handleCut}
        onDrop={(event) => {
          event.preventDefault();
          restoreCanonicalDom(selectionRef.current, "unsupported-content");
        }}
        onSelect={() => {
          setPendingMarks([]);
          captureCurrentSelection();
        }}
        onKeyUp={captureCurrentSelection}
        onMouseUp={captureCurrentSelection}
      >
        {renderBlocks.map((block, blockIndex) => (
          <div
            key={`${domRevision}-${block.type}-${blockIndex}`}
            ref={(node) => {
              blockRefs.current[blockIndex] = node;
            }}
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
