import type { AnatomyAsset } from "../atlas/types";
import type { StudyTarget, StudyView } from "../domain/types";

export interface Module {
  id: string;
  name: string;
  shortName: string;
  subtitle: string;
  curricular: boolean;
  items: number;
}
export interface CatalogAsset extends AnatomyAsset {
  assessmentViews?: StudyView[];
  technicalReview?: "verified" | "source-discrepancy";
  sourceTechnicalReview?: "verified" | "source-discrepancy";
  explorationReview?: "flagged" | "human-review-pending";
  reviewNote?: string;
  runtimeReview?: {
    id: string;
    reason: string;
    evidenceRasMm: number[];
    evidence: string;
    sourceCommit: string;
    reviewedAt: string;
  } | null;
  hasModel?: boolean;
  curricularModuleId?: string | null;
  conceptId?: string | null;
  mappingRelation?: "exact" | "part-of" | "unmapped";
}
export interface Catalog {
  assets: CatalogAsset[];
  modules: Module[];
  curriculumCount: number;
  occurrenceCount: number;
  visualCount: number;
  visual2dCount?: number;
  assessmentCount: number;
  eligibleAssetCount?: number;
  eligibleConceptCount?: number;
  sourceCommit: string;
}
export const moduleNames: Record<string, string> = {
  gerais: "Termos gerais",
  meninges: "Meninges",
  medula: "Medula espinal",
  tronco: "Tronco encefálico",
  cerebelo: "Cerebelo",
  diencefalo: "Diencéfalo",
  telencefalo: "Telencéfalo",
  ventriculos: "Ventrículos",
  vascularizacao: "Vascularização",
  nervos: "Nervos cranianos",
  outros: "Complementos do atlas",
};
export function targetsFromCatalog(catalog: Catalog): StudyTarget[] {
  return catalog.assets.map((a) => {
    const eligible =
      a.eligible &&
      a.technicalReview !== "source-discrepancy" &&
      a.explorationReview !== "flagged" &&
      !a.runtimeReview &&
      a.hasModel !== false &&
      (!a.mappingRelation || a.mappingRelation === "exact");
    const views: StudyView[] = eligible
      ? a.assessmentViews || [
          ...(a.surface ? ["3d" as const] : []),
          ...(["axial", "coronal", "sagittal"] as const).filter(
            (plane) => a.sliceIndices[plane] !== undefined,
          ),
        ]
      : [];
    return {
      id: a.id,
      name: a.name,
      aliases: a.aliases,
      moduleId: a.moduleId,
      category: a.category,
      source: a.source,
      eligible,
      labelIds: [a.labelId],
      sliceIndices: a.sliceIndices,
      views,
    };
  });
}
export function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
