import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  availableViews,
  createSession,
  eligibleTargets,
  isAnswerCorrect,
} from "../domain/engine";
import { targetsFromCatalog, type Catalog } from "./catalog";

const read = <T>(path: string): T =>
  JSON.parse(readFileSync(resolve(path), "utf8")) as T;
type AssetEvidence = {
  id: string;
  labelId: number;
  path: string;
  moduleId: string;
  technicalReview: string;
  hasVolume: boolean;
  bestSlices?: Record<string, { index: number; areaPixels: number }>;
};
type SliceEntry = {
  index: number;
  mriPath: string;
  labelsPath: string;
  labelIds: number[];
};
const manifest = read<{
  assets: AssetEvidence[];
  slices: Record<string, { entries: SliceEntry[] }>;
}>("public/anatomy/manifest.json");
const sourceContent = read<{
  assets: {
    id: string;
    assessmentCandidate: boolean;
    mappingRelation: string;
    curriculumIds: string[];
    laterality: string;
    curricularModuleId: string;
  }[];
}>("src/content/asset-content.json");
const curriculum = read<{
  items: {
    id: string;
    moduleId: string;
    originalName: string;
    sourcePages: number[];
    representation3d: string[];
    representation2d: string[];
    identificationMethods: string[];
    pending: string[];
    coverage: { visual3d: boolean; visual2d: boolean; assessment: boolean };
  }[];
  summary: {
    visual3dItems: number;
    visual2dItems: number;
    assessmentItems: number;
  };
}>("public/content/curriculum.json");
const catalog = read<Catalog>("public/content/catalog.json");
const targets = targetsFromCatalog(catalog);
const manifestById = new Map(manifest.assets.map((a) => [a.id, a]));

describe("the distributed catalog and its actual source assets", () => {
  it("keeps the 404-item denominator independent from UI study groupings", () => {
    expect(catalog.curriculumCount).toBe(404);
    expect(curriculum.items).toHaveLength(404);
    expect(new Set(curriculum.items.map((i) => i.id)).size).toBe(404);
    expect(catalog.modules.reduce((n, m) => n + m.items, 0)).toBe(404);
    for (const id of ["vascularizacao", "nervos"]) {
      expect(catalog.modules.find((m) => m.id === id)).toMatchObject({
        items: 0,
        curricular: false,
      });
      expect(catalog.assets.filter((a) => a.moduleId === id)).toHaveLength(0);
    }
    expect(catalog.modules.find((m) => m.id === "ventriculos")).toMatchObject({
      items: 0,
      curricular: false,
    });
  });

  it("counts only exact mappings with technically verified geometry as visual coverage", () => {
    const expected = new Set(
      sourceContent.assets
        .filter(
          (a) =>
            a.mappingRelation === "exact" &&
            a.id !== "spl-3022" &&
            manifestById.get(a.id)?.technicalReview === "verified",
        )
        .flatMap((a) => a.curriculumIds),
    );
    expect(expected.size).toBe(70);
    expect(catalog.visualCount).toBe(expected.size);
    expect(
      new Set(
        curriculum.items.filter((i) => i.coverage.visual3d).map((i) => i.id),
      ),
    ).toEqual(expected);
    expect(curriculum.summary.visual3dItems).toBe(expected.size);
    const fornix = curriculum.items.find((i) => i.originalName === "Fórnice")!;
    expect(fornix.coverage).toMatchObject({
      visual3d: false,
      visual2d: false,
      assessment: false,
    });
  });

  it("excludes residual organs, partial equivalents and every flagged source mismatch", () => {
    const excluded = [
      "spl-35",
      "spl-40",
      "spl-1000",
      "spl-2000",
      "spl-4",
      "spl-43",
      "spl-7",
      "spl-46",
      "spl-2",
      "spl-41",
      "spl-506",
      "spl-510",
      "spl-1016",
      "spl-3005",
      "spl-3007",
      "spl-3022",
    ];
    for (const id of excluded)
      expect(targets.find((t) => t.id === id)?.eligible, id).toBe(false);
    expect(catalog.assets.find((a) => a.id === "spl-35")?.name).toContain(
      "não segmentada",
    );
    expect(catalog.assets.find((a) => a.id === "spl-40")?.name).toContain(
      "não segmentada",
    );
  });

  it("retains all 109 safe editorial targets through the real domain filter", () => {
    expect(
      sourceContent.assets.filter((a) => a.assessmentCandidate),
    ).toHaveLength(110);
    const editorialIds = sourceContent.assets
      .filter((a) => a.assessmentCandidate && a.id !== "spl-3022")
      .map((a) => a.id)
      .sort();
    expect(editorialIds).toHaveLength(109);
    const domain = eligibleTargets(targets);
    expect(domain.map((t) => t.id).sort()).toEqual(editorialIds);
    for (const target of domain) {
      expect(availableViews(target).length).toBeGreaterThan(0);
      expect(
        existsSync(resolve("public", manifestById.get(target.id)!.path)),
      ).toBe(true);
      expect(
        isAnswerCorrect(target, "name", target.name.toLocaleUpperCase()),
      ).toBe(true);
    }
  });

  it("preserves the original inferior-colliculus files while flagging its ectopic component in runtime", () => {
    expect(manifestById.get("spl-3022")?.technicalReview).toBe("verified");
    expect(
      sourceContent.assets.find((a) => a.id === "spl-3022")
        ?.assessmentCandidate,
    ).toBe(true);
    const asset = catalog.assets.find((a) => a.id === "spl-3022")!;
    expect(asset).toMatchObject({
      eligible: false,
      technicalReview: "source-discrepancy",
      sourceTechnicalReview: "verified",
      explorationReview: "flagged",
      assessmentViews: [],
    });
    expect(asset.runtimeReview?.id).toBe("spl-3022-ectopic-component");
    expect(asset.runtimeReview?.evidenceRasMm).toEqual([47, -19, 45]);
    expect(asset.path).toBe(manifestById.get("spl-3022")?.path);
    expect(catalog.assets.find((a) => a.id === "spl-3023")?.eligible).toBe(
      true,
    );
    for (const item of curriculum.items) {
      expect(item.representation3d).not.toContain("spl-3022");
      expect(item.representation2d).not.toContain("spl-3022");
    }
  });

  it("preserves lateralized names and never accepts the opposite side or omitted side", () => {
    const left = targets.find((t) => t.id === "spl-11")!;
    const right = targets.find((t) => t.id === "spl-50")!;
    expect(isAnswerCorrect(left, "name", right.name)).toBe(false);
    expect(isAnswerCorrect(left, "name", "Núcleo caudado")).toBe(false);
    expect(isAnswerCorrect(left, "name", "  NUCLEO CAUDADO ESQUERDO ")).toBe(
      true,
    );
    const amygdala = targets.find((t) => t.id === "spl-18")!;
    expect(
      isAnswerCorrect(amygdala, "name", "Amígdala cerebral esquerda"),
    ).toBe(true);
    expect(isAnswerCorrect(amygdala, "name", "Amígdala cerebral direita")).toBe(
      false,
    );
    for (const editorial of sourceContent.assets) {
      const asset = catalog.assets.find((a) => a.id === editorial.id)!;
      expect(asset.hemisphere).toBe(editorial.laterality);
      expect(asset.curricularModuleId).toBe(editorial.curricularModuleId);
    }
  });

  it("keeps brainstem subregions and ventricular grouping separate from curricular ownership", () => {
    for (const id of [
      "spl-61",
      "spl-66",
      "spl-71",
      "spl-79",
      "spl-84",
      "spl-3020",
      "spl-3033",
    ])
      expect(catalog.assets.find((a) => a.id === id)?.moduleId).toBe("tronco");
    for (const id of ["spl-19", "spl-15"])
      expect(catalog.assets.find((a) => a.id === id)).toMatchObject({
        moduleId: "ventriculos",
        curricularModuleId: "tronco",
      });
    for (const item of curriculum.items) {
      expect(item.coverage.visual3d).toBe(item.representation3d.length > 0);
      expect(item.coverage.visual2d).toBe(item.representation2d.length > 0);
      expect(item.coverage.assessment).toBe(
        item.identificationMethods.length > 0,
      );
      expect(item.pending).toContain("human-anatomical-review");
      if (item.coverage.visual3d)
        expect(item.pending).not.toContain("licensed-representation");
    }
  });

  it("defensively withholds a stale eligible flag when geometry fails or equivalence is partial", () => {
    const asset = catalog.assets.find((a) => a.id === "spl-11")!;
    for (const patch of [
      { technicalReview: "source-discrepancy" as const },
      { hasModel: false },
      { mappingRelation: "part-of" as const },
    ]) {
      const [target] = targetsFromCatalog({
        ...catalog,
        assets: [{ ...asset, eligible: true, ...patch }],
      });
      expect(target.eligible).toBe(false);
      expect(target.views).toEqual([]);
    }
  });

  it("uses a real existing slice containing the requested label and keeps sulci out of slices", () => {
    for (const target of eligibleTargets(targets)) {
      const asset = manifestById.get(target.id)!;
      for (const view of availableViews(target)) {
        if (view === "3d") continue;
        expect(asset.hasVolume, target.id).toBe(true);
        const slice = manifest.slices[view].entries.find(
          (s) => s.index === target.sliceIndices?.[view],
        )!;
        expect(slice, `${target.id}/${view}`).toBeDefined();
        expect(slice.labelIds).toContain(asset.labelId);
        expect(existsSync(resolve("public", slice.mriPath))).toBe(true);
        expect(existsSync(resolve("public", slice.labelsPath))).toBe(true);
        expect(asset.bestSlices?.[view].areaPixels).toBeGreaterThanOrEqual(12);
      }
      if (!asset.hasVolume) expect(availableViews(target)).toEqual(["3d"]);
    }
    expect(availableViews(targets.find((t) => t.id === "spl-19")!)).toEqual(
      expect.arrayContaining(["sagittal", "axial"]),
    );
    expect(
      availableViews(targets.find((t) => t.id === "spl-11")!),
    ).not.toContain("3d");
  });

  it("can generate naming/localization questions for every eligible target without alias loss", () => {
    const session = createSession(targets, {
      id: "catalog-qa",
      seed: "catalog-seed",
      mode: "exam",
      count: 1000,
      kinds: ["locate", "name"],
    });
    expect(new Set(session.questions.map((q) => q.targetId))).toEqual(
      new Set(eligibleTargets(targets).map((t) => t.id)),
    );
    expect(session.questions.length).toBe(session.availableCount);
    expect(
      new Set(session.questions.map((q) => `${q.targetId}/${q.view}`)).size,
    ).toBe(session.questions.length);
    const assessmentItems = new Set(
      catalog.assets.filter((a) => a.eligible).flatMap((a) => a.curriculumIds),
    );
    expect(catalog.assessmentCount).toBe(assessmentItems.size);
    expect(curriculum.summary.assessmentItems).toBe(assessmentItems.size);
  });
});
