import { describe, expect, it } from "vitest";
import { resolveMenuPosition } from "../src/components/context-menu/positioning.js";

describe("resolveMenuPosition", () => {
  it("keeps preferred position when menu fits", () => {
    const resolved = resolveMenuPosition({
      position: { x: 24, y: 36 },
      menuSize: { width: 180, height: 120 },
      viewportSize: { width: 1280, height: 720 },
      viewportPadding: 12,
    });

    expect(resolved).toEqual({ x: 24, y: 36 });
  });

  it("flips horizontally when right edge would overflow", () => {
    const resolved = resolveMenuPosition({
      position: { x: 760, y: 80 },
      menuSize: { width: 220, height: 120 },
      viewportSize: { width: 900, height: 700 },
      viewportPadding: 12,
    });

    expect(resolved).toEqual({ x: 540, y: 80 });
  });

  it("flips vertically when bottom edge would overflow", () => {
    const resolved = resolveMenuPosition({
      position: { x: 120, y: 650 },
      menuSize: { width: 220, height: 140 },
      viewportSize: { width: 1200, height: 700 },
      viewportPadding: 12,
    });

    expect(resolved).toEqual({ x: 120, y: 510 });
  });

  it("clamps to viewport padding", () => {
    const resolved = resolveMenuPosition({
      position: { x: -20, y: -30 },
      menuSize: { width: 100, height: 80 },
      viewportSize: { width: 300, height: 220 },
      viewportPadding: 16,
    });

    expect(resolved).toEqual({ x: 16, y: 16 });
  });

  it("treats negative viewport padding as zero", () => {
    const resolved = resolveMenuPosition({
      position: { x: -30, y: -50 },
      menuSize: { width: 80, height: 60 },
      viewportSize: { width: 220, height: 180 },
      viewportPadding: -10,
    });

    expect(resolved).toEqual({ x: 0, y: 0 });
  });
});
