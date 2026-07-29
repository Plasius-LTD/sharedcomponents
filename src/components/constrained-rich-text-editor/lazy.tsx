import { lazy, Suspense } from "react";
import type { ConstrainedRichTextEditorProps } from "./ConstrainedRichTextEditor.js";

const LazyEditorImplementation = lazy(async () => {
  const module = await import("./ConstrainedRichTextEditor.js");
  return { default: module.ConstrainedRichTextEditorImplementation };
});

/**
 * Public editor facade. The implementation and its editing model are loaded
 * only when a host renders this component.
 */
export function ConstrainedRichTextEditor(
  props: ConstrainedRichTextEditorProps,
) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-live="polite"
          style={{ minBlockSize: "3rem" }}
        >
          {props.labels.loading}
        </div>
      }
    >
      <LazyEditorImplementation {...props} />
    </Suspense>
  );
}

export default ConstrainedRichTextEditor;
