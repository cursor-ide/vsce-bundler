// packages/vsce-bundler/mod.ts
/**
 * A bundler for VS Code extensions targeting the Web Extension runtime.
 *
 * This module provides utilities for bundling TypeScript/JavaScript VS Code extensions
 * into web-compatible bundles with support for caching, minification, and validation.
 *
 * @module
 */

export {
	/**
	 * Bundles a VS Code extension into a single JavaScript file suitable for use in
	 * the VS Code Web Extension runtime.
	 */
	bundleExtension,
	/**
	 * Legacy API alias for bundleExtension.
	 *
	 * @deprecated Use bundleExtension instead.
	 */
	bundleWebExtension,
	/**
	 * Validates that a VS Code extension doesn't use Node.js built-in modules
	 * or Deno namespace APIs that would make it incompatible with the Web Extension runtime.
	 */
	validateWebCompatibility,
} from './core/bundle.ts';

export type {
	/**
	 * Options for bundling a VS Code extension.
	 */
	BundleOptions,
	/**
	 * Result of a bundle operation containing metadata about the bundle.
	 */
	BundleResult,
} from './types.ts';
