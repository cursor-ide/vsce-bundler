/**
 * Module for validating web compatibility of VS Code extensions.
 * 
 * This module provides a static analysis utility that identifies potential issues
 * that would make a VS Code extension incompatible with the Web Extension runtime.
 * 
 * @module
 */
import { dirname } from "jsr:@std/path@^1.0.0";
import { walk } from "jsr:@std/fs@^1.0.0/walk";

/** 
 * List of Node built-in modules that are not available in the web runtime.
 * These modules cannot be used in VS Code web extensions.
 */
const NODE_BUILTINS = [
  "fs", "path", "os", "crypto", "child_process", "net", "tls", "http",
  "https", "stream", "url", "zlib", "buffer", "util", "dns", "cluster",
  "readline", "repl", "vm", "worker_threads", "perf_hooks", "assert",
  "tty", "dgram", "inspector", "module", "process",
] as const;

/** Set of Node.js built-in modules for faster lookups. */
const BUILTIN_SET = new Set<string>(NODE_BUILTINS);

/** RegEx to capture ES module import specifiers. */
const IMPORT_RE = /import\s+(?:[^"']+?\s+from\s+)?["']([^"']+)["']/g;

/** RegEx for detecting CommonJS style require calls. */
const REQUIRE_RE = /require\(\s*["']([^"']+)["']\s*\)/g;

/** RegEx to detect `Deno.` namespace usage (not available in web workers). */
const DENO_NS_RE = /\bDeno\./g;

/**
 * Validates that a VS Code extension is compatible with the Web Extension runtime.
 * 
 * This function performs static analysis to identify potential Node.js built-in
 * module usage or Deno namespace calls that would make an extension incompatible
 * with the VS Code Web Extension runtime.
 * 
 * @param entryPoint The absolute path to the extension's entry point file
 * @returns An array of human-readable issues found in the project.
 *          If the array is empty, the project appears to be web-compatible.
 * 
 * @example Validating extension web compatibility
 * ```ts
 * import { validateWebCompatibility } from "@vsce/bundler";
 * 
 * const issues = await validateWebCompatibility("/path/to/extension/extension.ts");
 * 
 * if (issues.length === 0) {
 *   console.log("✅ Extension is web compatible!");
 * } else {
 *   console.log("⚠️ Web compatibility issues found:");
 *   issues.forEach(issue => console.log(` - ${issue}`));
 * }
 * ```
 */
export async function validateWebCompatibility(entryPoint: string): Promise<string[]> {
  const issues: string[] = [];
  const root = dirname(entryPoint);

  // Walk the project files with reasonable limits for performance
  let count = 0;
  for await (const entry of walk(root, { includeDirs: false, exts: [".ts", ".tsx"], maxDepth: 10 })) {
    if (++count > 1000) break; // Safety limit - prevent analysis of huge projects

    const src = await Deno.readTextFile(entry.path);

    // Check ES module imports for Node.js built-ins
    for (const [, specifier] of src.matchAll(IMPORT_RE)) {
      if (BUILTIN_SET.has(specifier)) {
        issues.push(`${entry.path}: imports Node builtin module '${specifier}'`);
      }
    }

    // Check CommonJS requires (rare in TS projects, but still possible)
    for (const [, specifier] of src.matchAll(REQUIRE_RE)) {
      if (BUILTIN_SET.has(specifier)) {
        issues.push(`${entry.path}: requires Node builtin module '${specifier}'`);
      }
    }

    // Check for Deno namespace usage
    if (DENO_NS_RE.test(src)) {
      issues.push(`${entry.path}: uses 'Deno.*' APIs that are not available in web extensions`);
    }
  }

  return issues;
}
