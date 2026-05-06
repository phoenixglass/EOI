import { describe, it, expect } from "vitest";
import { renderTemplate } from "./template";

const ctx = { locale: "en-US", currencyCode: "USD" };

describe("renderTemplate", () => {
  it("interpolates simple paths", () => {
    expect(
      renderTemplate("Hello {{name}}", { name: "Alice" }, ctx),
    ).toBe("Hello Alice");
  });

  it("formats money", () => {
    const out = renderTemplate("Total: {{ money amount }}", { amount: 1234.5 }, ctx);
    expect(out).toMatch(/\$1,234\.50/);
  });

  it("formats percent", () => {
    expect(
      renderTemplate("Share: {{pct rate}}", { rate: 30 }, ctx),
    ).toBe("Share: 30%");
  });

  it("conditional shows when truthy", () => {
    expect(
      renderTemplate("{{#if x}}YES{{/if}}", { x: 1 }, ctx),
    ).toBe("YES");
  });

  it("conditional hides when falsy/null", () => {
    expect(
      renderTemplate("{{#if x}}YES{{/if}}", { x: null }, ctx),
    ).toBe("");
    expect(
      renderTemplate("{{#if x}}YES{{/if}}", { x: 0 }, ctx),
    ).toBe("");
  });

  it("each loops over arrays with this.field", () => {
    const out = renderTemplate(
      "{{#each items}}- {{this.label}}\n{{/each}}",
      { items: [{ label: "a" }, { label: "b" }] },
      ctx,
    );
    expect(out).toBe("- a\n- b\n");
  });

  it("nested if inside each", () => {
    const out = renderTemplate(
      "{{#each xs}}{{#if this.show}}{{this.v}} {{/if}}{{/each}}",
      { xs: [{ show: true, v: "x" }, { show: false, v: "y" }, { show: 1, v: "z" }] },
      ctx,
    );
    expect(out).toBe("x z ");
  });

  it("preserves newlines", () => {
    const out = renderTemplate("a\nb\n", {}, ctx);
    expect(out).toBe("a\nb\n");
  });

  it("renders empty string for missing path", () => {
    expect(renderTemplate("[{{missing}}]", {}, ctx)).toBe("[]");
  });
});
