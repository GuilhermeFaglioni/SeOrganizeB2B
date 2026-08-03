import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "fs";
import { extname, join, resolve } from "path";
import ptBR from "../../messages/pt-BR.json";
import en from "../../messages/en.json";

const root = resolve(__dirname, "../..");

function flatten(
  value: Record<string, unknown>,
  prefix = "",
  result: Record<string, string> = {}
): Record<string, string> {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flatten(child as Record<string, unknown>, path, result);
    } else if (typeof child === "string") {
      result[path] = child;
    }
  }
  return result;
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

describe("i18n integrity", () => {
  const ptKeys = flatten(ptBR as Record<string, unknown>);
  const enKeys = flatten(en as Record<string, unknown>);

  it("keeps locale keys in parity with non-empty translations", () => {
    expect(Object.keys(enKeys).sort()).toEqual(Object.keys(ptKeys).sort());
    expect(Object.values(ptKeys).every((value) => value.trim().length > 0)).toBe(true);
    expect(Object.values(enKeys).every((value) => value.trim().length > 0)).toBe(true);
  });

  it("does not use dotted top-level keys that next-intl cannot resolve as namespaces", () => {
    expect(Object.keys(ptBR).filter((key) => key.includes("."))).toEqual([]);
    expect(Object.keys(en).filter((key) => key.includes("."))).toEqual([]);
  });

  it("resolves every static translation call in the source", () => {
    const missing: string[] = [];

    for (const file of sourceFiles(join(root, "src"))) {
      const source = readFileSync(file, "utf8");
      const declarations = Array.from(
        source.matchAll(/const\s+(\w+)\s*=\s*useTranslations\("([^"]+)"\)/g)
      );

      for (const declaration of declarations) {
        const [, translator, namespace] = declaration;
        const calls = Array.from(
          source.matchAll(new RegExp(`\\b${translator}\\("([^"]+)"`, "g"))
        );
        for (const call of calls) {
          const key = `${namespace}.${call[1]}`;
          if (!(key in ptKeys) || !(key in enKeys)) {
            missing.push(`${file.replace(`${root}/`, "")}: ${key}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("covers dynamic financial tab translation keys", () => {
    for (const key of ["overview", "contracts", "proposals", "receivables", "clients"]) {
      expect(ptKeys[`financial.tabs.${key}`]).toBeTruthy();
      expect(enKeys[`financial.tabs.${key}`]).toBeTruthy();
    }
  });
});
