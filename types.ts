/**
 * Shared type declarations for the @vsce/bundler package.
 *
 * @module
 */

import type { bundle as EmitBundle } from '@deno/emit';

/**
 * Options for bundling a VS Code extension.
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
 * console.log(`Bundle created at ${result.bundlePath} (${result.size} bytes)`);
 * ```
 */
export interface BundleOptions {
	/**
	 * Absolute path to the extension project root (where extension.ts lives).
	 * This is the base directory of the extension project.
	 */
	readonly projectDir: string;

	/**
	 * Entry point filename (defaults to "extension.ts").
	 * This is the main TypeScript file of the extension that exports the activate function.
	 */
	readonly entryPoint?: string;

	/**
	 * Output directory name relative to projectDir (defaults to "out").
	 * The bundler will create this directory if it doesn't exist.
	 */
	readonly outDir?: string;

	/**
	 * Output filename (defaults to "extension.js").
	 * The generated bundle will be written to this file within the outDir.
	 */
	readonly outFile?: string;

	/**
	 * Show verbose diagnostic and timing information during the build process.
	 * Useful for debugging or understanding the bundling steps.
	 */
	readonly verbose?: boolean;

	/**
	 * Suppress all non-error output from the bundler.
	 * When true, only errors will be logged.
	 */
	readonly quiet?: boolean;

	/**
	 * Minify the bundle to reduce its size.
	 * Recommended for production builds.
	 */
	readonly minify?: boolean;

	/**
	 * Minifier engine to use when minify=true.
	 * - "esbuild": Faster minification (default)
	 * - "terser": Potentially better compression but slower
	 */
	readonly minifier?: 'esbuild' | 'terser';

	/**
	 * Enable incremental build cache for faster rebuilds.
	 * The cache is stored in the outDir as .build-cache.json.
	 */
	readonly useCache?: boolean;

	/**
	 * Logger function for standard output (defaults to console.log).
	 * Can be customized for integration with different logging systems.
	 */
	readonly log?: (message: string) => void;

	/**
	 * Logger function for errors (defaults to console.error).
	 * Can be customized for integration with different logging systems.
	 */
	readonly logError?: (message: string) => void;

	/**
	 * Custom bundle implementation (used in unit tests).
	 * Defaults to Deno.emit's bundle function.
	 * @internal
	 */
	readonly bundleFn?: typeof EmitBundle;
}

/**
 * Result of a bundle operation.
 *
 * Contains metadata about the bundle including its path, size, and build performance information.
 */
export interface BundleResult {
	/**
	 * Path to the bundled extension file.
	 * The absolute path to the generated bundle that can be loaded by VS Code.
	 */
	bundlePath: string;

	/**
	 * Bundle size in bytes.
	 * The size of the generated JavaScript bundle file.
	 */
	size: number;

	/**
	 * Build time in milliseconds.
	 * How long it took to generate the bundle.
	 */
	buildTimeMs: number;

	/**
	 * Whether the bundle was served from cache.
	 * If true, the bundle was generated from the cache instead of a full rebuild.
	 */
	fromCache: boolean;

	/**
	 * Warnings or info messages recorded during the build.
	 * Contains any non-error messages generated during bundling.
	 */
	messages: string[];
}
