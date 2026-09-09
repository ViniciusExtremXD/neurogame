import type { Plane, Vec3 } from "./spatial";

export interface AnatomyAsset {
  id: string;
  labelId: number;
  name: string;
  nameEn: string;
  moduleId: string;
  category: string;
  path: string;
  color: string;
  center: Vec3;
  bounds: [Vec3, Vec3];
  hemisphere: "left" | "right" | "midline";
  surface: boolean;
  eligible: boolean;
  aliases: string[];
  curriculumIds: string[];
  source: string;
  sliceIndices: Partial<Record<Plane, number>>;
  description: {
    summary: string;
    location?: string;
    function?: string;
    relations?: string;
    clinical?: string;
    tip?: string;
    references: { title: string; url?: string; pages?: string }[];
  } | null;
  technicalReview?: "verified" | "source-discrepancy";
  reviewNote?: string;
}
export interface SceneProps {
  assets: AnatomyAsset[];
  selectedId: string | null;
  highlightedId?: string | null;
  onSelect: (id: string) => void;
  onReady: (ready: boolean) => void;
  onError: (message: string) => void;
  isolated: boolean;
  hiddenIds: string[];
  opacity: number;
  labels: boolean;
  assessment: boolean;
  reducedMotion: boolean;
  preset: string;
  resetKey: number;
  zoom: number;
  plane?: Plane;
  sliceIndex: number;
  showPlane: boolean;
}
