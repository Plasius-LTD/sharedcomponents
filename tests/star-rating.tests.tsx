import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  StarRating,
  type StarRatingValue,
} from "../src/components/star-rating/StarRating.js";

const labels = ["Very poor", "Poor", "Fair", "Good", "Excellent"] as const;

function ControlledRating() {
  const [value, setValue] = useState<StarRatingValue | null>(null);
  return (
    <StarRating
      label="Overall satisfaction"
      labels={labels}
      value={value}
      onChange={setValue}
      required={true}
      name="satisfaction"
    />
  );
}

describe("StarRating", () => {
  it("exposes a required, labelled radiogroup with visible shape and text state", () => {
    render(<ControlledRating />);

    const group = screen.getByRole("radiogroup", {
      name: "Overall satisfaction",
    });
    const radios = screen.getAllByRole("radio");

    expect(group.getAttribute("aria-required")).toBe("true");
    expect(radios).toHaveLength(5);
    expect(radios[0]?.getAttribute("aria-label")).toBe("1: Very poor");
    expect(screen.getAllByText("☆")).toHaveLength(5);

    fireEvent.click(radios[2] as HTMLElement);

    expect(radios[2]?.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("3 / 5 — Fair")).toBeTruthy();
    expect(screen.getAllByText("★")).toHaveLength(3);
  });

  it("supports arrows, Home, and End with roving focus and selection", () => {
    render(<ControlledRating />);
    const radios = screen.getAllByRole("radio");

    (radios[0] as HTMLElement).focus();
    fireEvent.keyDown(radios[0] as HTMLElement, { key: "ArrowLeft" });
    expect(radios[4]).toBe(document.activeElement);
    expect(radios[4]?.getAttribute("aria-checked")).toBe("true");

    fireEvent.keyDown(radios[4] as HTMLElement, { key: "Home" });
    expect(radios[0]).toBe(document.activeElement);
    expect(radios[0]?.getAttribute("aria-checked")).toBe("true");

    fireEvent.keyDown(radios[0] as HTMLElement, { key: "End" });
    expect(radios[4]).toBe(document.activeElement);

    fireEvent.keyDown(radios[4] as HTMLElement, { key: "ArrowRight" });
    expect(radios[0]).toBe(document.activeElement);

    fireEvent.keyDown(radios[0] as HTMLElement, { key: "ArrowDown" });
    expect(radios[1]).toBe(document.activeElement);
    fireEvent.keyDown(radios[1] as HTMLElement, { key: "ArrowUp" });
    expect(radios[0]).toBe(document.activeElement);
  });

  it("keeps read-only ratings focusable without allowing mutation", () => {
    const onChange = vi.fn();
    render(
      <StarRating
        label="Severity"
        labels={labels}
        value={4}
        onChange={onChange}
        readOnly={true}
      />,
    );

    const group = screen.getByRole("radiogroup", { name: "Severity" });
    const first = screen.getAllByRole("radio")[0] as HTMLElement;
    expect(group.getAttribute("aria-readonly")).toBe("true");

    fireEvent.click(first);
    fireEvent.keyDown(first, { key: "End" });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByRole("radio")[3]?.getAttribute("aria-checked")).toBe(
      "true",
    );
  });
});
