import axe from "axe-core";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StarRating } from "../src/components/star-rating/StarRating.js";
import { ConstrainedRichTextEditorImplementation } from "../src/components/constrained-rich-text-editor/ConstrainedRichTextEditor.js";
import { createFeedbackRichTextDocument } from "../src/components/constrained-rich-text-editor/model.js";

describe("feedback primitives accessibility", () => {
  it("has no automatically detectable WCAG 2.2 A/AA violations", async () => {
    const { container } = render(
      <main>
        <StarRating
          label="Overall satisfaction"
          labels={["Very poor", "Poor", "Fair", "Good", "Excellent"]}
          value={3}
          onChange={vi.fn()}
          required={true}
        />
        <ConstrainedRichTextEditorImplementation
          labels={{
            editor: "Tell us more",
            toolbar: "Text formatting",
            bold: "Bold",
            italic: "Italic",
            underline: "Underline",
            bullets: "Bulleted list",
            indent: "Increase indent",
            outdent: "Decrease indent",
            loading: "Loading editor",
          }}
          placeholder="Optional details"
          value={createFeedbackRichTextDocument("Synthetic feedback")}
          onChange={vi.fn()}
        />
      </main>,
    );

    const result = await axe.run(container, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
      },
    });

    expect(result.violations).toEqual([]);
  });
});
