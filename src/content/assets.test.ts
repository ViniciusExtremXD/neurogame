import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("distributed asset integrity", () => {
  it("verifies every deployed GLB, pack and PNG against its manifest and decodes all masks", () => {
    const report = JSON.parse(
      execFileSync(process.execPath, ["scripts/validate-assets.mjs"], {
        encoding: "utf8",
      }),
    );
    expect(report).toMatchObject({
      status: "passed",
      assets: 258,
      packs: 8,
      pngs: 1536,
      maskPixels: 50_331_648,
      curricularItems: 404,
      visual3dItems: 70,
      visual2dItems: 54,
      assessmentItems: 70,
      eligibleTargets: 109,
    });
    expect(report.sourceDiscrepancies.sort()).toEqual(
      [
        "spl-2",
        "spl-41",
        "spl-506",
        "spl-510",
        "spl-1016",
        "spl-3005",
        "spl-3007",
      ].sort(),
    );
    expect(report.runtimeReviewExclusions).toEqual(["spl-3022"]);
    expect(report.preservedUnmappedLabels).toContain(4001);
  }, 30_000);

  it("rejects traversal, absolute, encoded and remote paths before reading an asset", () => {
    const verification = `
      import assert from 'node:assert/strict';
      import { publicFile } from './scripts/validate-assets.mjs';
      for (const path of ['../package.json', '/anatomy/manifest.json', 'C:/Users/file', 'anatomy/../manifest.json', 'anatomy/%2e%2e/package.json', 'https://example.com/file', 'anatomy/manifest.json?x=1', 'anatomy//manifest.json', 'anatomy\\\\manifest.json']) {
        assert.throws(() => publicFile('public', path), /Unsafe asset path/);
      }
      assert(publicFile('public', 'anatomy/manifest.json').endsWith('manifest.json'));
      process.stdout.write('safe');
    `;
    expect(
      execFileSync(
        process.execPath,
        ["--input-type=module", "-e", verification],
        { encoding: "utf8" },
      ),
    ).toBe("safe");
  });
});
