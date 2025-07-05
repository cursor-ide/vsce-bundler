/**
 * @fileoverview Tests for the VSC extension bundler
 */

import { assertEquals, assertNotEquals, assertRejects } from "jsr:@std/assert";
import { afterEach, beforeEach, describe, it } from "jsr:@std/testing/bdd";
import { join } from "jsr:@std/path";
import { ensureDir } from "jsr:@std/fs";

import { bundleExtension } from "../mod.ts";

// Mock fs test helpers
const TEST_DIR = join(Deno.makeTempDirSync(), "bundler-test");
const FIXTURES_DIR = join(TEST_DIR, "fixtures");
const TEST_PROJECT_DIR = join(FIXTURES_DIR, "test-extension");
const OUT_DIR = "out";
const OUT_PATH = join(TEST_PROJECT_DIR, OUT_DIR);
const ENTRY_FILE = "extension.ts";
const OUT_FILE = "extension.js";



// Setup test environment
async function setupTestProject() {
  await ensureDir(TEST_PROJECT_DIR);
  await ensureDir(OUT_PATH);

  // Create test extension files
  await Deno.writeTextFile(
    join(TEST_PROJECT_DIR, ENTRY_FILE),
    `import { commands } from "vscode";
export function activate() {
  console.log("Extension activated");
  commands.registerCommand("test.hello", () => console.log("Hello"));
}`,
  );

  await Deno.writeTextFile(
    join(TEST_PROJECT_DIR, "package.json"),
    JSON.stringify({
      name: "test-extension",
      version: "1.0.0",
      engines: { vscode: "^1.60.0" },
      activationEvents: ["onCommand:test.hello"],
      contributes: {
        commands: [{ command: "test.hello", title: "Say Hello" }],
      },
      main: "./out/extension.js",
    }),
  );
}

// Clean up test environment
async function cleanupTestProject() {
  try {
    await Deno.remove(TEST_DIR, { recursive: true });
  } catch (_) {
    // Ignore cleanup errors
  }
}

// Fake bundle function for tests to avoid invoking Deno.emit
const fakeBundle: typeof import("jsr:@deno/emit").bundle = () => Promise.resolve({
  code: "// fake bundle\nconsole.log('bundled');\n",
  map: "{}",
});

describe("bundleExtension", () => {
  

  beforeEach(async () => {
    await setupTestProject();

    
  });

  afterEach(async () => {


    // Clean up test files
    await cleanupTestProject();
  });

  it("should bundle an extension with default options", async () => {
    // Setup fake logging
    const messages: string[] = [];
    const logFunction = (msg: string) => messages.push(msg);

    const result = await bundleExtension({
      projectDir: TEST_PROJECT_DIR,
      log: logFunction,
      logError: logFunction,
      bundleFn: fakeBundle,
    });

    // Verify bundle was created
    assertEquals(typeof result, "object");
    assertEquals(result.fromCache, false);
    assertEquals(result.messages.length, 0);
    assertNotEquals(result.size, 0);
    assertEquals(result.bundlePath, join(TEST_PROJECT_DIR, OUT_DIR, OUT_FILE));
  });

  it("should respect custom output paths", async () => {
    const customOutDir = "custom-out";
    const customOutFile = "custom-extension.js";

    const result = await bundleExtension({
      projectDir: TEST_PROJECT_DIR,
      outDir: customOutDir,
      outFile: customOutFile,
      bundleFn: fakeBundle,
    });

    assertEquals(
      result.bundlePath,
      join(TEST_PROJECT_DIR, customOutDir, customOutFile),
    );

    // Verify file was actually created
    const fileInfo = await Deno.stat(result.bundlePath);
    assertEquals(typeof fileInfo.size, "number");
    assertEquals(fileInfo.isFile, true);
  });

  it("should report verbose output when requested", async () => {
    const messages: string[] = [];

    await bundleExtension({
      projectDir: TEST_PROJECT_DIR,
      verbose: true,
      bundleFn: fakeBundle,
      log: (msg) => messages.push(msg),
    });

    // Check for expected verbose messages
    const bundleSizeMessageFound = messages.some((msg) =>
      msg.includes("Bundle size:")
    );
    const buildTimeMessageFound = messages.some((msg) =>
      msg.includes("Build completed in")
    );

    assertEquals(bundleSizeMessageFound, true);
    assertEquals(buildTimeMessageFound, true);
  });

  it("should respect quiet flag and not output messages", async () => {
    const messages: string[] = [];

    await bundleExtension({
      projectDir: TEST_PROJECT_DIR,
      verbose: true, // Even with verbose, quiet should override
      bundleFn: fakeBundle,
      quiet: true,
      log: (msg) => messages.push(msg),
    });

    // No messages should be logged
    assertEquals(messages.length, 0);
  });

  it("should use cache when content hasn't changed", async () => {
    // First build to prime cache
    await bundleExtension({
      projectDir: TEST_PROJECT_DIR,
      useCache: true,
      bundleFn: fakeBundle,
    });

    // Check if cache file was created
    const cacheFilePath = join(OUT_PATH, ".build-cache.json");
    const cacheExists = await Deno.stat(cacheFilePath).then(() => true).catch(
      () => false
    );
    assertEquals(cacheExists, true);

    // Second build should use cache
    const messages: string[] = [];
    const result = await bundleExtension({
      projectDir: TEST_PROJECT_DIR,
      useCache: true,
      bundleFn: fakeBundle,
      verbose: true,
      log: (msg) => messages.push(msg),
    });

    assertEquals(result.fromCache, true);
    assertEquals(result.buildTimeMs, 0);

    const cacheMessageFound = messages.some((msg) =>
      msg.includes("No changes detected")
    );
    assertEquals(cacheMessageFound, true);
  });

  it("should rebuild when cache is disabled", async () => {
    // First build to prime cache
    await bundleExtension({
      projectDir: TEST_PROJECT_DIR,
      useCache: true,
      bundleFn: fakeBundle,
    });

    // Second build with cache disabled
    const result = await bundleExtension({
      projectDir: TEST_PROJECT_DIR,
      useCache: false,
      bundleFn: fakeBundle,
    });

    // Should be a fresh build, not from cache
    assertEquals(result.fromCache, false);
    assertNotEquals(result.buildTimeMs, 0);
  });

  it("should throw error on bundling failure", async () => {
    const errorBundle: typeof import("jsr:@deno/emit").bundle = () => Promise.reject(new Error("Simulated bundle error"));
    // Should throw error
    await assertRejects(
      () => bundleExtension({ projectDir: TEST_PROJECT_DIR, bundleFn: errorBundle }),
      Error,
      "Simulated bundle error",
    );
  });

  // Add these tests if we can properly mock the minifiers
  /*
  it("should minify with esbuild when requested", async () => {});
  it("should minify with terser when requested", async () => {});
  it("should handle terser not being available", async () => {});
  */
});

// Mock for bundleWebExtension compatibility function
describe("bundleWebExtension", () => {
  // Legacy API tests would go here
});
