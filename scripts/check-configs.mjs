import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { FacilityConfig } from "../src/config/schema.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const files = ["public/config/default.json", "public/config/bh-clinic.json"];
let bad = false;
for (const rel of files) {
  const full = resolve(root, rel);
  const raw = JSON.parse(readFileSync(full, "utf8"));
  const parsed = FacilityConfig.safeParse(raw);
  if (!parsed.success) {
    console.log("FAIL", rel);
    console.log(parsed.error.issues.slice(0, 5));
    bad = true;
  } else {
    console.log("OK", rel);
  }
}
process.exit(bad ? 1 : 0);
