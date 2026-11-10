#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const TARGET_DIRECTORIES = [
  path.join(rootDir, "apps/staff/src"),
  path.join(rootDir, "apps/coach/src"),
  path.join(rootDir, "apps/member/src"),
  path.join(rootDir, "packages/ui/src"),
  path.join(rootDir, "packages/i18n/src"),
];

const FORBIDDEN_PATTERNS = [
  { name: "powercore", regex: /powercore/i },
  { name: "01012345", regex: /01012345/ },
  { name: '"123456"', regex: /"123456"|'123456'/ },
  { name: "حسابات تجريبية", regex: /حسابات تجريبية/ },
  { name: "عضو تجريبي", regex: /عضو تجريبي/ },
  { name: "تجربة فورية", regex: /تجربة فورية/ },
  { name: "for demonstration", regex: /for demonstration/i },
  { name: "demo (case-insensitive)", regex: /\bdemo\b/i },
  {
    name: "demo coach/member/staff names",
    regex: /(كابتن أحمد|كابتن طارق|كابتن منى|منى السيد|سارة حسن|عمر خالد|محمد أحمد|محمود حسن|زياد محمود|كريم عادل)/,
  },
  { name: "المعادي", regex: /المعادي/ },
];

let violationsCount = 0;

function isTestFile(filename) {
  return (
    filename.includes(".test.") ||
    filename.includes(".spec.") ||
    filename.includes("__tests__")
  );
}

function checkFile(filePath) {
  if (isTestFile(filePath)) return;

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  lines.forEach((line, index) => {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.regex.test(line)) {
        console.error(
          `[FAIL] ${path.relative(rootDir, filePath)}:${index + 1}`
        );
        console.error(`       Pattern: ${pattern.name}`);
        console.error(`       Line:    ${line.trim()}`);
        violationsCount++;
      }
    }
  });
}

function walkDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name !== "node_modules" &&
        entry.name !== ".next" &&
        entry.name !== "dist" &&
        entry.name !== "__tests__"
      ) {
        walkDir(fullPath);
      }
    } else if (
      entry.isFile() &&
      /\.(tsx?|jsx?|mjs|cjs|json)$/.test(entry.name)
    ) {
      checkFile(fullPath);
    }
  }
}

console.log("Checking frontends and packages for forbidden demo/test remnants...");
for (const dir of TARGET_DIRECTORIES) {
  walkDir(dir);
}

if (violationsCount > 0) {
  console.error(`\nFound ${violationsCount} forbidden demo remnant(s)!`);
  process.exit(1);
} else {
  console.log("SUCCESS: No demo or test remnants found across frontend apps and shared packages.");
  process.exit(0);
}
