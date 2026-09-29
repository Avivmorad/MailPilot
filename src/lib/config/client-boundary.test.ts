import fs from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const sourceRoot = path.join(process.cwd(), "src");
const forbidden = new Set(
  [
    "lib/supabase/admin.ts",
    "lib/gmail/client.ts",
    "lib/gmail/oauth.ts",
    "lib/gmail/connections.ts",
    "lib/security/encryption.ts",
    "lib/ai/client.ts",
    "lib/ai/nvidia.ts",
    "lib/scans/store.ts",
  ].map((file) => path.join(sourceRoot, file)),
);

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(filename);
    return entry.isFile() && /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)
      ? [filename]
      : [];
  });
}

function parseSource(filename: string): ts.SourceFile {
  return ts.createSourceFile(
    filename,
    fs.readFileSync(filename, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function localImports(source: ts.SourceFile): string[] {
  const imports: string[] = [];
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      imports.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === "require")) &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      imports.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
}

function resolveLocal(from: string, specifier: string): string | null {
  const base = specifier.startsWith("@/")
    ? path.join(sourceRoot, specifier.slice(2))
    : specifier.startsWith(".")
      ? path.resolve(path.dirname(from), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

describe("client import boundary", () => {
  it("keeps privileged modules out of every transitive client bundle", () => {
    const files = sourceFiles(sourceRoot);
    const parsed = new Map(files.map((file) => [file, parseSource(file)]));
    const clientEntries = files.filter((file) => {
      const first = parsed.get(file)?.statements[0];
      return (
        first &&
        ts.isExpressionStatement(first) &&
        ts.isStringLiteral(first.expression) &&
        first.expression.text === "use client"
      );
    });
    expect(clientEntries.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const entry of clientEntries) {
      const visited = new Set<string>();
      const walk = (file: string, chain: string[]): void => {
        if (visited.has(file)) return;
        visited.add(file);
        if (forbidden.has(file)) {
          violations.push(
            [...chain, file].map((part) => path.relative(sourceRoot, part)).join(" -> "),
          );
          return;
        }
        const source = parsed.get(file);
        if (!source) return;
        for (const specifier of localImports(source)) {
          const target = resolveLocal(file, specifier);
          if (target) walk(target, [...chain, file]);
        }
      };
      walk(entry, []);
    }
    expect(violations).toEqual([]);
  });
});
