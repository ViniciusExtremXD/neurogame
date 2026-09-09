import { useEffect, useRef, useState } from "react";
import { decodeLabel, pixelAtPointer, type Plane } from "./spatial";
import type { AnatomyAsset } from "./types";

export interface SliceProps {
  plane: Plane;
  index: number;
  selectedLabel: number | null;
  assets: AnatomyAsset[];
  overlay: boolean;
  assessment: boolean;
  onSelect: (id: string) => void;
  onReady: (ready: boolean) => void;
  onError: (message: string) => void;
  onLabels?: (ids: number[]) => void;
}
const orientation = {
  axial: ["A", "P", "R", "L"],
  coronal: ["S", "I", "R", "L"],
  sagittal: ["S", "I", "A", "P"],
};
export default function SliceViewer({
  plane,
  index,
  selectedLabel,
  assets,
  overlay,
  assessment,
  onSelect,
  onReady,
  onError,
  onLabels,
}: SliceProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = useRef<Uint8ClampedArray | null>(null);
  const [images, setImages] = useState<{
    mri: ImageBitmap;
    mask: ImageData;
  } | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [hover, setHover] = useState<string>("");
  useEffect(() => {
    const controller = new AbortController();
    let bitmap: ImageBitmap | null = null;
    labels.current = null;
    setImages(null);
    setState("loading");
    onReady(false);
    onLabels?.([]);
    const prefix = `${import.meta.env.BASE_URL}anatomy/slices/${plane}/${index}`;
    async function load() {
      try {
        const responses = await Promise.all(
          ["mri", "labels"].map((kind) =>
            fetch(`${prefix}-${kind}.png`, { signal: controller.signal }),
          ),
        );
        if (responses.some((r) => !r.ok)) throw Error("slice-http");
        const [mri, maskImage] = await Promise.all(
          responses.map(async (r) =>
            createImageBitmap(await r.blob(), { colorSpaceConversion: "none" }),
          ),
        );
        if (controller.signal.aborted) {
          mri.close();
          maskImage.close();
          return;
        }
        bitmap = mri;
        const temporary = document.createElement("canvas");
        temporary.width = 256;
        temporary.height = 256;
        const context = temporary.getContext("2d", {
          willReadFrequently: true,
        })!;
        context.imageSmoothingEnabled = false;
        context.drawImage(maskImage, 0, 0);
        maskImage.close();
        const mask = context.getImageData(0, 0, 256, 256);
        const ids = new Set<number>();
        for (let n = 0; n < mask.data.length; n += 4) {
          const id = decodeLabel(mask.data[n], mask.data[n + 1]);
          if (id > 0) ids.add(id);
        }
        labels.current = mask.data;
        setImages({ mri, mask });
        setState("ready");
        onReady(true);
        onLabels?.([...ids]);
      } catch (error) {
        if (controller.signal.aborted) return;
        setState("error");
        onReady(false);
        onError(
          error instanceof Error
            ? "Não foi possível carregar esta fatia. Selecione outra posição ou tente novamente."
            : "Falha no corte.",
        );
      }
    }
    void load();
    return () => {
      controller.abort();
      bitmap?.close();
    };
  }, [plane, index, onReady, onError, onLabels]);
  useEffect(() => {
    if (!images || !canvas.current) return;
    const context = canvas.current.getContext("2d")!;
    context.imageSmoothingEnabled = false;
    context.drawImage(images.mri, 0, 0);
    if (!overlay && !selectedLabel) return;
    const layer = context.createImageData(256, 256);
    const colors = new Map(assets.map((a) => [a.labelId, a.color]));
    for (let n = 0; n < images.mask.data.length; n += 4) {
      const label = decodeLabel(images.mask.data[n], images.mask.data[n + 1]);
      const selected = label === selectedLabel;
      if (!selected && (!overlay || !colors.has(label))) continue;
      const color = selected ? "#ffd383" : colors.get(label)!;
      layer.data[n] = parseInt(color.slice(1, 3), 16);
      layer.data[n + 1] = parseInt(color.slice(3, 5), 16);
      layer.data[n + 2] = parseInt(color.slice(5, 7), 16);
      layer.data[n + 3] = selected ? 205 : 95;
    }
    const temporary = document.createElement("canvas");
    temporary.width = 256;
    temporary.height = 256;
    temporary.getContext("2d")!.putImageData(layer, 0, 0);
    context.drawImage(temporary, 0, 0);
  }, [images, overlay, selectedLabel, assets]);
  function hit(clientX: number, clientY: number) {
    if (!labels.current || !canvas.current || state !== "ready") return;
    const pixel = pixelAtPointer(
      clientX,
      clientY,
      canvas.current.getBoundingClientRect(),
      256,
    );
    if (!pixel) return;
    const offset = (pixel[1] * 256 + pixel[0]) * 4;
    const label = decodeLabel(
      labels.current[offset],
      labels.current[offset + 1],
    );
    return assets.find((a) => a.labelId === label);
  }
  const [top, bottom, left, right] = orientation[plane];
  return (
    <div className="slice-viewer" aria-busy={state === "loading"}>
      <span className="orientation top">{top}</span>
      <span className="orientation bottom">{bottom}</span>
      <span className="orientation left">{left}</span>
      <span className="orientation right">{right}</span>
      <canvas
        ref={canvas}
        width={256}
        height={256}
        aria-label={`Corte ${plane === "sagittal" ? "sagital" : plane} de ressonância T1; orientação ${left} à esquerda e ${right} à direita`}
        onClick={(e) => {
          const asset = hit(e.clientX, e.clientY);
          if (asset) onSelect(asset.id);
        }}
        onMouseMove={(e) => {
          if (assessment) return;
          setHover(hit(e.clientX, e.clientY)?.name || "");
        }}
        onMouseLeave={() => setHover("")}
      />
      {state === "loading" && (
        <div className="slice-loading">Carregando fatia…</div>
      )}
      {state === "error" && (
        <div className="slice-loading">Fatia indisponível</div>
      )}
      {!assessment && hover && <span className="slice-hover">{hover}</span>}
    </div>
  );
}
