/**
 * Core bundling logic for the @vsce/bundler package.
 * 
 * This module provides the main functionality for bundling VS Code extensions
 * targeting the Web Extension runtime. It includes support for caching, minification,
 * and detailed build reporting.
 * 
 * @module
 */

import { join } from "@std/path";
import { ensureDir } from "@std/fs";
import { bundle as emitBundle } from "@deno/emit";

import type { BundleOptions, BundleResult } from "../types.ts";
import { computeProjectHash } from "../hash/compute_hash.ts";

// Attempt to import colors (optional dependency)
type ColorFn = (s: string) => string;
interface Colors {
  green: ColorFn;
  red: ColorFn;
  blue: ColorFn;
  cyan: ColorFn;
  yellow: ColorFn;
}

let colors: Colors = {
  green: (s) => s,
  red: (s) => s,
  blue: (s) => s,
  cyan: (s) => s,
  yellow: (s) => s,
};
try {
  // Use the import map from deno.json
  const fmt = await import("jsr:@std/fmt/colors@^1.0.0");
  const { green, red, blue, cyan, yellow } = fmt as unknown as Colors & Record<string, unknown>;
  colors = { green, red, blue, cyan, yellow };
} catch {
  /* colors not available – keep no-op implementations */
}

/**
 * Bundle a VS Code extension for the Web Extension runtime.
 * 
 * This function takes a VS Code extension project and bundles it into a single JavaScript
 * file that can be loaded by VS Code in a web environment. It supports incremental builds
 * via caching, minification, and detailed build reporting.
 * 
 * @param options Configuration options for the bundling process
 * @returns A promise that resolves to the bundle result containing metadata
 * 
 * @example Basic bundling
 * ```ts
 * import { bundleExtension } from "@vsce/bundler";
 * 
 * const result = await bundleExtension({
 *   projectDir: "/path/to/extension",
 *   verbose: true
 * });
 * 
 * console.log(`Bundle created at ${result.bundlePath}`);
 * console.log(`Size: ${result.size} bytes`);
 * console.log(`Build time: ${result.buildTimeMs}ms`);
 * ```
 * 
 * @example Bundling with minification
 * ```ts
 * const result = await bundleExtension({
 *   projectDir: "/path/to/extension",
 *   minify: true,
 *   minifier: "esbuild" // or "terser"
 * });
 * ```
 */
export async function bundleExtension(
  options: BundleOptions,
): Promise<BundleResult> {
  const {
    projectDir,
    entryPoint = "extension.ts",
    outDir = "out",
    outFile = "extension.js",
    verbose = false,
    quiet = false,
    minify = false,
    minifier = "esbuild",
    useCache = true,
    log = console.log,
    logError = console.error,
    bundleFn,
  } = options;

  const start = performance.now();
  const messages: string[] = [];
  const logEnabled = !quiet;
  const logMessage = (msg: string) => {
    if (logEnabled) log(msg);
    messages.push(msg);
  };

  const entry = join(projectDir, entryPoint);
  const outDirectory = join(projectDir, outDir);
  const bundlePath = join(outDirectory, outFile);
  await ensureDir(outDirectory);

  const cachePath = join(outDirectory, ".build-cache.json");

  // Hash calculation
  let currentHash = "";
  try {
    currentHash = await computeProjectHash(projectDir, outDir);
  } catch {
    messages.push(
      "Failed to compute project hash – proceeding with full rebuild",
    );
  }

  // Cache check
  if (useCache && currentHash) {
    try {
      const cachedHash = await Deno.readTextFile(cachePath);
      if (cachedHash.trim() === currentHash) {
        if (verbose) logMessage(colors.green("⚡ No changes detected. Using cached build."));
        const { size } = await Deno.stat(bundlePath);
        return {
          bundlePath,
          size,
          buildTimeMs: 0,
          fromCache: true,
          messages,
        };
      }
    } catch { /* cache miss */ }
  }

  // Build
  try {
    const bundler = bundleFn ?? emitBundle;
    const result = await bundler(entry);
    let bundleCode = result.code;

    // Minification
    if (minify) {
      if (verbose) logMessage(colors.cyan(`🔧 Minifying with ${minifier}`));
      if (minifier === "esbuild") {
        const esbuild = await import("npm:esbuild@0.19.2");
        const { code: minCode, map } = await esbuild.transform(bundleCode, {
          minify: true,
          sourcemap: "external",
          sourcefile: outFile,
        });
        bundleCode = `${minCode}\n//# sourceMappingURL=${outFile}.map`;
        await Deno.writeTextFile(join(outDirectory, `${outFile}.map`), map);
        // esbuild.stop is not available in npm version
        // Previously used with Deno-specific esbuild version
      } else {
        // deno-lint-ignore no-explicit-any
        let terser: any;
        try {
          terser = await import("npm:terser@5.27.0");
        } catch {
          logMessage(
            colors.yellow("terser unavailable – skipping minification"),
          );
        }
        if (terser) {
          const res = await terser.minify({ [outFile]: bundleCode }, {
            sourceMap: { filename: outFile, url: `${outFile}.map` },
          });
          if (res.code) bundleCode = res.code;
          if (res.map) {
            await Deno.writeTextFile(
              join(outDirectory, `${outFile}.map`),
              res.map as string,
            );
          }
        }
      }
    }

    await Deno.writeTextFile(bundlePath, bundleCode);

    if (useCache && currentHash) {
      await Deno.writeTextFile(cachePath, currentHash);
    }

    const { size } = await Deno.stat(bundlePath);
    const elapsed = performance.now() - start;

    if (verbose) {
      logMessage(
        colors.blue(
          `📦 Bundle size: ${(size / 1024).toFixed(1)} kB${
            minify ? " (minified)" : ""
          }`,
        ),
      );
      logMessage(
        colors.green(`✅ Build completed in ${elapsed.toFixed(0)} ms`),
      );
    }

    return {
      bundlePath,
      size,
      buildTimeMs: Math.round(elapsed),
      fromCache: false,
      messages,
    };
  } catch (err) {
    logError(colors.red("❌ Build failed:"));
    logError(colors.red(err instanceof Error ? err.message : String(err)));
    throw err;
  }
}

/**
 * Legacy wrapper for backward compatibility.
 * 
 * This is an internal compatibility alias maintained for backward compatibility
 * with early versions of the bundler. New code should use bundleExtension instead.
 * 
 * @param config Legacy configuration object
 * @returns A promise that resolves to the bundle result
 * @deprecated Use bundleExtension instead
 * @internal
 */
export function bundleWebExtension(
  config: { entryPoint: string; outDir: string; minify?: boolean },
): Promise<BundleResult> {
  const parts = config.entryPoint.split("/");
  const projectDir = parts.slice(0, -1).join("/") || ".";
  const entry = parts[parts.length - 1];
  return bundleExtension({
    projectDir,
    entryPoint: entry,
    outDir: config.outDir,
    minify: config.minify,
  });
}

// Re-export web-compat validator from separate module to keep concerns isolated
export { validateWebCompatibility } from "./validate.ts";
