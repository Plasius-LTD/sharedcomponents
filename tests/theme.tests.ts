import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const theme = () => read("src/theme/theme.css");

function mount(variant = "", mode = "light") {
  const style = document.createElement("style");
  style.textContent = theme();
  document.head.append(style);
  const scope = document.createElement("section");
  scope.className = `plasius-theme ${variant}`;
  scope.dataset.theme = mode;
  document.body.append(scope);
  return { style, scope };
}

function contrast(left: string, right: string) {
  const luminance = (hex: string) => {
    const rgb = hex.match(/[a-f0-9]{2}/gi)!.map(value => parseInt(value, 16) / 255);
    const [r, g, b] = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return r * 0.2126 + g * 0.7152 + b * 0.0722;
  };
  const values = [luminance(left), luminance(right)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

afterEach(() => {
  document.body.replaceChildren();
  document.head.querySelectorAll("style").forEach(style => style.remove());
  document.documentElement.removeAttribute("data-theme");
});

describe("opt-in theme stylesheet", () => {
  it("has a resolvable CSS export included by the package allowlist", () => {
    const manifest = JSON.parse(read("package.json"));
    const exported = manifest.exports["./theme.css"];
    expect(exported).toBe("./src/theme/theme.css");
    expect(manifest.files).toContain("src");
    expect(manifest.sideEffects).toContain("*.css");
    const require = createRequire(resolve(process.cwd(), "package.json"));
    expect(require.resolve("@plasius/sharedcomponents/theme.css")).toBe(resolve(process.cwd(), exported));
    expect(read("src/index.ts")).not.toMatch(/theme\.css|fontsource/);
    expect(theme()).not.toMatch(/@import|@font-face|url\(/);
  });

  it("scopes every selector and leaves unthemed content alone", () => {
    const { style, scope } = mount();
    const outside = document.createElement("button");
    document.body.append(outside);
    const visit = (rules: CSSRuleList) => {
      for (const rule of Array.from(rules)) {
        if ("selectorText" in rule) {
          expect((rule as CSSStyleRule).selectorText).toContain(".plasius-theme");
        } else if ("cssRules" in rule) {
          visit((rule as CSSGroupingRule).cssRules);
        }
      }
    };
    visit(style.sheet!.cssRules);
    expect(getComputedStyle(scope).getPropertyValue("--plasius-surface").trim()).not.toBe("");
    expect(getComputedStyle(outside).getPropertyValue("--plasius-surface")).toBe("");
  });

  for (const variant of ["", "plasius-theme--chronicle"]) {
    for (const mode of ["light", "dark"]) {
      it(`provides readable ${variant || "neutral"} ${mode} colours`, () => {
        const { scope } = mount(variant, mode);
        const css = getComputedStyle(scope);
        const colour = (name: string) => css.getPropertyValue(`--plasius-${name}`).trim();
        for (const background of ["surface", "panel", "raised"]) {
          for (const foreground of ["text", "muted", "accent"]) {
            expect(contrast(colour(foreground), colour(background)), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
          }
          expect(contrast(colour("border"), colour(background))).toBeGreaterThanOrEqual(3);
        }
        expect(contrast(colour("on-accent"), colour("accent"))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it("allows light and dark specimens within a page with an opposite theme", () => {
    document.documentElement.dataset.theme = "dark";
    const { scope } = mount("plasius-theme--chronicle", "light");
    expect(getComputedStyle(scope).getPropertyValue("--plasius-surface").trim()).toBe("#f3eddf");
    scope.dataset.theme = "dark";
    expect(getComputedStyle(scope).getPropertyValue("--plasius-surface").trim()).toBe("#182621");
    scope.removeAttribute("data-theme");
    expect(getComputedStyle(scope).getPropertyValue("--plasius-surface").trim()).toBe("#182621");
  });

  it("uses the actual Header and Footer property names for readable shell text", () => {
    const { scope } = mount();
    const css = getComputedStyle(scope);
    for (const [property, semantic] of [
      ["--headerText", "--plasius-text"],
      ["--footerTextPrimary", "--plasius-text"],
      ["--footerTextSecondary", "--plasius-muted"],
      ["--footerLink", "--plasius-accent"],
      ["--footerLinkHover", "--plasius-accent"],
      ["--footerBorder", "--plasius-border"],
    ]) {
      expect(css.getPropertyValue(property)).toBe(`var(${semantic})`);
    }
  });

  it("allows host identity overrides without forcing editorial headings", () => {
    const { scope } = mount();
    expect(getComputedStyle(scope).getPropertyValue("--plasius-font-heading")).toContain("Roboto");
    scope.classList.add("plasius-theme--chronicle");
    expect(getComputedStyle(scope).getPropertyValue("--plasius-font-heading")).toContain("Merriweather");
    scope.style.setProperty("--plasius-font-heading", "Example, sans-serif");
    scope.style.setProperty("--plasius-accent", "#164e68");
    expect(getComputedStyle(scope).getPropertyValue("--plasius-font-heading")).toBe("Example, sans-serif");
    expect(getComputedStyle(scope).getPropertyValue("--plasius-accent")).toBe("#164e68");
  });

  it("defines touch targets, visible focus, native disabled states and reduced motion", () => {
    const { style } = mount();
    const rules = Array.from(style.sheet!.cssRules).filter(rule => "selectorText" in rule) as CSSStyleRule[];
    const button = rules.find(rule => rule.selectorText === ".plasius-theme .plasius-button")!;
    expect(button.style.getPropertyValue("min-height")).toBe("3rem");
    const focus = rules.find(rule => rule.selectorText.includes(":focus-visible"))!;
    expect(focus.style.getPropertyValue("outline")).toContain("3px solid");
    expect(rules.some(rule => rule.selectorText.includes(":disabled"))).toBe(true);
    expect(theme()).toContain("prefers-reduced-motion: reduce");
    expect(theme()).toContain("forced-colors: active");
    expect(theme()).not.toMatch(/outline:\s*(none|0)\s*;/);
  });
});
