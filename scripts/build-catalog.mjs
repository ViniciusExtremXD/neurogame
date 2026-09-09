import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const read = (path) =>
  JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const planes = ["axial", "coronal", "sagittal"];
const moduleMap = {
  telencephalon: "telencefalo",
  brainstem: "tronco",
  cerebellum: "cerebelo",
  diencephalon: "diencefalo",
  ventricles: "ventriculos",
  sulci: "telencefalo",
};
const colorPalette = [
  "#d4b0ab",
  "#d6c2a8",
  "#b4b9d8",
  "#a5beb5",
  "#d5afbc",
  "#c1bd94",
  "#b6c8d4",
  "#cca78d",
];
// Runtime review exclusions do not rewrite pinned source evidence or source geometry.
export const runtimeReviewExclusions = {
  "spl-3022": {
    id: "spl-3022-ectopic-component",
    reason:
      "Um voxel isolado e seu componente de malha foram observados na superfície cerebral, distantes do colículo inferior, em RAS [47, −19, 45] mm. Correspondência anatômica pendente; excluído das perguntas.",
    evidenceRasMm: [47, -19, 45],
    evidence:
      "Componente presente tanto na malha quanto no volume de labels da fonte; conferir docs/source-discrepancies.md.",
    sourceCommit: "bec24db25aad5f7600e2df3becfb1f883e61ff56",
    reviewedAt: "2026-09-09",
  },
};
const residualNames = {
  "spl-35": "Região não segmentada da ponte",
  "spl-40": "Região não segmentada do mesencéfalo",
  "spl-1000": "Região não segmentada da ínsula esquerda",
  "spl-2000": "Região não segmentada da ínsula direita",
  "spl-1008": "Região não segmentada do lóbulo parietal inferior esquerdo",
  "spl-2008": "Região não segmentada do lóbulo parietal inferior direito",
  "spl-3012": "Região não segmentada da neuro-hipófise",
};
const moduleDescriptions = {
  gerais: "Conceitos que organizam o sistema nervoso",
  meninges: "Envoltórios e espaços meníngeos",
  medula: "Morfologia e nervos espinais",
  tronco: "Bulbo, ponte e mesencéfalo",
  cerebelo: "Organização, núcleos e pedúnculos",
  diencefalo: "Tálamo, hipotálamo e estruturas relacionadas",
  telencefalo: "Superfície, núcleos e substância branca",
};

/** Derive availability from distributed assets, preserving the immutable editorial inventory. */
export function buildCatalog(
  manifest,
  curriculum,
  content,
  publicRoot = "public",
) {
  const byId = new Map(content.assets.map((a) => [a.id, a]));
  const itemIds = new Set(curriculum.items.map((i) => i.id));
  const sourceById = new Map(content.sources.map((s) => [s.id, s]));
  assert.equal(
    byId.size,
    content.assets.length,
    "Duplicate editorial asset IDs",
  );
  assert.equal(
    itemIds.size,
    curriculum.items.length,
    "Duplicate curricular IDs",
  );
  const exists = (path) =>
    typeof path === "string" &&
    !/[:\\?#%]/.test(path) &&
    !path.startsWith("/") &&
    path.split("/").every((p) => p && p !== "." && p !== "..") &&
    existsSync(resolve(publicRoot, path));
  const assets = manifest.assets.map((a, i) => {
    const c = byId.get(a.id);
    const runtimeReview = runtimeReviewExclusions[a.id];
    if (runtimeReview)
      assert.equal(
        manifest.atlas.commit,
        runtimeReview.sourceCommit,
        `${a.id}: review exclusion must be reconsidered for a new source revision`,
      );
    const technicalReview = runtimeReview
      ? "source-discrepancy"
      : a.technicalReview;
    for (const id of c?.curriculumIds || [])
      assert(itemIds.has(id), `${a.id}: unknown curricular reference ${id}`);
    const hasModel = exists(a.path);
    const sliceIndices = Object.fromEntries(
      planes.flatMap((plane) => {
        const s = a.bestSlices?.[plane];
        const entry = manifest.slices[plane]?.entries.find(
          (e) => e.index === s?.index,
        );
        return a.hasVolume &&
          technicalReview === "verified" &&
          s &&
          Number.isInteger(s.index) &&
          s.index >= 0 &&
          s.areaPixels >= 12 &&
          entry?.labelIds.includes(a.labelId) &&
          exists(entry.mriPath) &&
          exists(entry.labelsPath)
          ? [[plane, s.index]]
          : [];
      }),
    );
    const surface = a.packId.startsWith("cortex-") || a.packId === "sulci";
    const refs = (c?.description?.sourceRefs || []).map((r) => ({
      title: sourceById.get(r.sourceId)?.title || r.sourceId,
      url: r.url || undefined,
      pages: r.pagePdf
        ? `PDF p. ${r.pagePdf}${r.pagePrinted ? ` · impressa p. ${r.pagePrinted}` : ""}${r.figure ? ` · fig. ${r.figure}` : ""}`
        : r.section || undefined,
    }));
    const sourcedDescription =
      !!c?.description?.summary?.trim() &&
      refs.length > 0 &&
      c.description.sourceRefs.every((r) => sourceById.has(r.sourceId));
    const eligible =
      !!c?.assessmentCandidate &&
      c.mappingRelation === "exact" &&
      c.curriculumIds.length > 0 &&
      technicalReview === "verified" &&
      hasModel &&
      sourcedDescription &&
      (surface || Object.keys(sliceIndices).length > 0);
    // Deep structures are assessed in registered slices; the 3D assessment scene exposes surfaces.
    const assessmentViews = eligible
      ? [
          ...(surface ? ["3d"] : []),
          ...planes.filter((p) => sliceIndices[p] !== undefined),
        ]
      : [];
    return {
      ...a,
      technicalReview,
      sourceTechnicalReview: a.technicalReview,
      explorationReview:
        technicalReview === "source-discrepancy"
          ? "flagged"
          : "human-review-pending",
      runtimeReview: runtimeReview || null,
      reviewNote: runtimeReview?.reason || a.reviewNote,
      name: c?.name || residualNames[a.id] || a.nameEn,
      moduleId: moduleMap[a.moduleId] || c?.curricularModuleId || "outros",
      curricularModuleId: c?.curricularModuleId || null,
      conceptId: c?.conceptId || null,
      category: c?.distractorGroup || a.packId,
      hemisphere:
        c?.laterality ||
        (/\bleft\b/i.test(a.nameEn)
          ? "left"
          : /\bright\b/i.test(a.nameEn)
            ? "right"
            : "midline"),
      surface,
      hasModel,
      eligible,
      assessmentViews,
      color: surface ? colorPalette[i % colorPalette.length] : a.color,
      aliases: c?.aliases || [],
      curriculumIds: c?.curriculumIds || [],
      mappingRelation: c?.mappingRelation || "unmapped",
      source: refs[0]
        ? refs[0].url ||
          `${refs[0].title}${refs[0].pages ? ` — ${refs[0].pages}` : ""}`
        : "https://www.openanatomy.org/atlas-pages/atlas-spl-nac-brain.html",
      sliceIndices,
      difficulty: c?.difficulty ?? null,
      description: c?.description
        ? {
            summary: c.description.summary,
            location: c.description.location || undefined,
            function: c.description.function || undefined,
            relations: c.description.relations.join(" "),
            clinical: c.description.clinical || undefined,
            tip: c.description.tip || undefined,
            references: refs,
          }
        : null,
    };
  });
  const exactVerified = assets.filter(
    (a) =>
      a.hasModel &&
      a.mappingRelation === "exact" &&
      a.technicalReview === "verified",
  );
  const visualSet = new Set(exactVerified.flatMap((a) => a.curriculumIds));
  const visual2dSet = new Set(
    exactVerified
      .filter((a) => Object.keys(a.sliceIndices).length > 0)
      .flatMap((a) => a.curriculumIds),
  );
  const assessmentSet = new Set(
    assets.filter((a) => a.eligible).flatMap((a) => a.curriculumIds),
  );
  const modules = curriculum.modules.map((m) => ({
    id: m.id,
    name: m.name,
    shortName: m.name,
    subtitle: moduleDescriptions[m.id],
    curricular: true,
    items: m.itemCount,
  }));
  modules.push(
    {
      id: "ventriculos",
      name: "Ventrículos",
      shortName: "Ventrículos",
      subtitle: "Grupo de estudo transversal aos capítulos do roteiro",
      curricular: false,
      items: 0,
    },
    {
      id: "vascularizacao",
      name: "Vascularização",
      shortName: "Vascularização",
      subtitle: "Pendente de representação licenciada e revisão anatômica",
      curricular: false,
      items: 0,
    },
    {
      id: "nervos",
      name: "Nervos cranianos",
      shortName: "Nervos cranianos",
      subtitle: "Pendente de representação licenciada e revisão anatômica",
      curricular: false,
      items: 0,
    },
  );
  if (assets.some((a) => a.moduleId === "outros"))
    modules.push({
      id: "outros",
      name: "Complementos do atlas",
      shortName: "Complementos",
      subtitle: "Ativos sem equivalência curricular documentada",
      curricular: false,
      items: 0,
    });
  assert.equal(
    modules.reduce((n, m) => n + m.items, 0),
    curriculum.items.length,
    "Study groups must not increase the curricular denominator",
  );
  const catalog = {
    assets,
    modules,
    curriculumCount: curriculum.items.length,
    occurrenceCount: curriculum.occurrences.length,
    visualCount: visualSet.size,
    visual2dCount: visual2dSet.size,
    assessmentCount: assessmentSet.size,
    eligibleAssetCount: assets.filter((a) => a.eligible).length,
    eligibleConceptCount: new Set(
      assets.filter((a) => a.eligible).map((a) => a.conceptId),
    ).size,
    sourceCommit: manifest.atlas.commit,
  };
  const runtimeCurriculum = {
    ...curriculum,
    summary: {
      ...curriculum.summary,
      visual3dItems: visualSet.size,
      visual2dItems: visual2dSet.size,
      assessmentItems: assessmentSet.size,
    },
    items: curriculum.items.map((item) => {
      const mapped = exactVerified.filter((a) =>
        a.curriculumIds.includes(item.id),
      );
      const assessed = mapped.filter((a) => a.eligible);
      const canChoose = assessed.some((a) =>
        a.assessmentViews.some(
          (view) =>
            assets.filter(
              (other) =>
                other.eligible &&
                other.moduleId === a.moduleId &&
                other.category === a.category &&
                other.assessmentViews.includes(view),
            ).length >= 4,
        ),
      );
      return {
        ...item,
        coverage: {
          ...item.coverage,
          visual3d: visualSet.has(item.id),
          visual2d: visual2dSet.has(item.id),
          assessment: assessmentSet.has(item.id),
        },
        representation3d: mapped.map((a) => a.id),
        representation2d: mapped
          .filter((a) => Object.keys(a.sliceIndices).length > 0)
          .map((a) => a.id),
        identificationMethods: assessed.length
          ? ["locate", "name", ...(canChoose ? ["choice"] : [])]
          : [],
        pending: mapped.length
          ? item.pending.filter(
              (reason) => reason !== "licensed-representation",
            )
          : item.pending,
      };
    }),
  };
  return { catalog, curriculum: runtimeCurriculum };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = buildCatalog(
    read("public/anatomy/manifest.json"),
    read("src/content/curriculum.json"),
    read("src/content/asset-content.json"),
  );
  mkdirSync("public/content", { recursive: true });
  writeFileSync("public/content/catalog.json", JSON.stringify(result.catalog));
  writeFileSync(
    "public/content/curriculum.json",
    JSON.stringify(result.curriculum),
  );
  console.log(
    JSON.stringify({
      assets: result.catalog.assets.length,
      eligibleAssets: result.catalog.eligibleAssetCount,
      curricular: result.catalog.curriculumCount,
      visual: result.catalog.visualCount,
      visual2d: result.catalog.visual2dCount,
      assessment: result.catalog.assessmentCount,
    }),
  );
}
