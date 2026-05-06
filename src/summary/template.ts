// Tiny mustache-like renderer.
// Supports:
//   {{ path }}                 interpolate
//   {{ money path }}           format currency (uses ctx.t.currency)
//   {{ pct path }}             format percent
//   {{#if path}} ... {{/if}}   conditional block (truthy)
//   {{#each path}} ... {{/each}} loop; inside, "this" refers to current item
//   {{ t.patientNoun }}        path lookup; "this" inside #each

import { formatMoney, formatPercent } from "../calc/calculations";

type Node =
  | { kind: "text"; value: string }
  | { kind: "var"; path: string; helper?: "money" | "pct" }
  | { kind: "if"; path: string; children: Node[] }
  | { kind: "each"; path: string; children: Node[] };

const TAG = /\{\{\s*([^}]+?)\s*\}\}/g;

interface Tag {
  start: number;
  end: number;
  raw: string;
}

function tokenize(src: string): Tag[] {
  const tags: Tag[] = [];
  let m: RegExpExecArray | null;
  TAG.lastIndex = 0;
  while ((m = TAG.exec(src)) !== null) {
    tags.push({ start: m.index, end: m.index + m[0].length, raw: m[1].trim() });
  }
  return tags;
}

interface ParseState {
  src: string;
  tags: Tag[];
  cursor: number; // index into src
  i: number; // index into tags
}

function parseChildren(state: ParseState, stopOn?: string): Node[] {
  const nodes: Node[] = [];
  while (state.i < state.tags.length) {
    const tag = state.tags[state.i];
    if (tag.start > state.cursor) {
      nodes.push({
        kind: "text",
        value: state.src.slice(state.cursor, tag.start),
      });
    }
    state.cursor = tag.end;

    const raw = tag.raw;
    if (stopOn && raw === stopOn) {
      state.i++;
      return nodes;
    }

    state.i++;

    if (raw.startsWith("#if ")) {
      const path = raw.slice(4).trim();
      const children = parseChildren(state, "/if");
      nodes.push({ kind: "if", path, children });
    } else if (raw.startsWith("#each ")) {
      const path = raw.slice(6).trim();
      const children = parseChildren(state, "/each");
      nodes.push({ kind: "each", path, children });
    } else if (raw.startsWith("/")) {
      // unmatched closer — render literally
      nodes.push({ kind: "text", value: `{{${raw}}}` });
    } else if (raw.startsWith("money ")) {
      nodes.push({ kind: "var", path: raw.slice(6).trim(), helper: "money" });
    } else if (raw.startsWith("pct ")) {
      nodes.push({ kind: "var", path: raw.slice(4).trim(), helper: "pct" });
    } else {
      nodes.push({ kind: "var", path: raw });
    }
  }
  if (state.cursor < state.src.length) {
    nodes.push({
      kind: "text",
      value: state.src.slice(state.cursor),
    });
  }
  return nodes;
}

function parse(src: string): Node[] {
  const state: ParseState = {
    src,
    tags: tokenize(src),
    cursor: 0,
    i: 0,
  };
  return parseChildren(state);
}

function lookup(path: string, scopes: unknown[]): unknown {
  const parts = path.split(".");
  // "this" or "this.foo" resolves against the innermost scope only.
  const restrictToInnermost = parts[0] === "this";
  const effectiveParts = restrictToInnermost ? parts.slice(1) : parts;
  const candidates = restrictToInnermost ? [scopes[0]] : scopes;

  for (const scope of candidates) {
    if (effectiveParts.length === 0) return scope;
    let cur: unknown = scope;
    let ok = true;
    for (const p of effectiveParts) {
      if (cur == null || typeof cur !== "object") {
        ok = false;
        break;
      }
      cur = (cur as Record<string, unknown>)[p];
      if (cur === undefined) {
        ok = false;
        break;
      }
    }
    if (ok && cur !== undefined) return cur;
  }
  return undefined;
}

function truthy(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (v === false || v === 0 || v === "") return false;
  if (Array.isArray(v) && v.length === 0) return false;
  return true;
}

interface RenderCtx {
  locale: string;
  currencyCode: string;
}

function renderNodes(nodes: Node[], scopes: unknown[], ctx: RenderCtx): string {
  let out = "";
  for (const node of nodes) {
    if (node.kind === "text") {
      out += node.value;
    } else if (node.kind === "var") {
      const v = lookup(node.path, scopes);
      if (node.helper === "money") {
        out += formatMoney(
          typeof v === "number" ? v : null,
          ctx.locale,
          ctx.currencyCode,
        );
      } else if (node.helper === "pct") {
        out += formatPercent(typeof v === "number" ? v : null);
      } else {
        if (v === null || v === undefined) {
          out += "";
        } else if (typeof v === "object") {
          out += "";
        } else {
          out += String(v);
        }
      }
    } else if (node.kind === "if") {
      const v = lookup(node.path, scopes);
      if (truthy(v)) {
        out += renderNodes(node.children, scopes, ctx);
      }
    } else if (node.kind === "each") {
      const v = lookup(node.path, scopes);
      if (Array.isArray(v)) {
        for (const item of v) {
          out += renderNodes(node.children, [item, ...scopes], ctx);
        }
      }
    }
  }
  return out;
}

export function renderTemplate(
  template: string,
  data: Record<string, unknown>,
  ctx: RenderCtx,
): string {
  const ast = parse(template);
  return renderNodes(ast, [data], ctx);
}
