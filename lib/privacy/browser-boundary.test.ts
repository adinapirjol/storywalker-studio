import { readFileSync, existsSync } from "node:fs";
import { globSync } from "node:fs";
import { resolve, dirname } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

describe("browser credential boundary", () => {
  it("does not reference Spotify credentials or server importer code in browser modules", () => {
    const files = [
      ...globSync("app/**/*.{ts,tsx}").filter((file) => !file.startsWith("app/api/")),
      ...globSync("components/**/*.{ts,tsx}"),
    ];
    // Follow reachable imports instead of classifying every lib server module as
    // browser code. This also catches credentials hidden behind an intermediate import.
    const visited = new Set<string>();
    const sources: string[] = [];
    function visit(file: string) {
      const absolute = resolve(file);
      if (visited.has(absolute)) return;
      visited.add(absolute);
      const source = readFileSync(absolute, "utf8");
      sources.push(source);
      const parsed=ts.createSourceFile(absolute,source,ts.ScriptTarget.Latest,true);
      const imports:string[]=[];
      function collect(node:ts.Node){
        if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
          const clause=node.importClause;
          if(clause?.isTypeOnly)return;
          if(clause&&!clause.name&&clause.namedBindings&&ts.isNamedImports(clause.namedBindings)&&clause.namedBindings.elements.every(e=>e.isTypeOnly))return;
          imports.push(node.moduleSpecifier.text);
        }
        if(ts.isExportDeclaration(node)&&!node.isTypeOnly&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))imports.push(node.moduleSpecifier.text);
        if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))imports.push(node.arguments[0].text);
        ts.forEachChild(node,collect);
      }
      collect(parsed);
      for (const name of imports) {
        if (!name.startsWith(".") && !name.startsWith("@/")) continue;
        const base = name.startsWith("@/") ? resolve(name.slice(2)) : resolve(dirname(absolute), name);
        const target = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]
          .find(candidate => /\.(?:ts|tsx)$/.test(candidate) && existsSync(candidate));
        if (target) visit(target);
      }
    }
    files.forEach(visit);
    for(const pattern of [/SPOTIFY_CLIENT_(?:ID|SECRET)/u,/spotify-token\.local/u,/scripts\/spotify/u,/NEXT_PUBLIC_SPOTIFY/u,/private-playlist/u,/private-data\/research/u]){
      // Never dump concatenated source (or a future accidentally embedded secret) on failure.
      expect(sources.some(source=>pattern.test(source)),pattern.source).toBe(false);
    }
  });
});
