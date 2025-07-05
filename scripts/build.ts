#!/usr/bin/env -S deno run --allow-all

/**
 * Build script for @vsce/bundler package
 */

console.log("📦 Building @vsce/bundler...");

// Type check the module
const checkResult = await new Deno.Command("deno", {
  args: ["check", "mod.ts"],
  cwd: new URL("../", import.meta.url).pathname,
}).spawn().status;

if (!checkResult.success) {
  console.error("❌ Type check failed");
  Deno.exit(1);
}

console.log("✅ @vsce/bundler built successfully");
