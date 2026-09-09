export type Plane = "axial" | "coronal" | "sagittal";
export type Vec3 = [number, number, number];
/** Camera framing only: trim tiny disconnected components using vertex weights.
 * This does not alter, hide, relabel, or validate any source geometry. */
export function cameraFramingBounds(
  assets: ReadonlyArray<{ bounds: [Vec3, Vec3]; vertices?: number }>,
): [Vec3, Vec3] {
  if (!assets.length)
    return [
      [-80, -70, -100],
      [80, 80, 100],
    ];
  const quantile = (axis: number, edge: 0 | 1, q: number) => {
    const values = assets
      .map((asset) => ({
        value: rasToScene(asset.bounds[edge])[axis],
        weight: Math.max(1, asset.vertices ?? 1),
      }))
      .sort((a, b) => a.value - b.value);
    const threshold = values.reduce((sum, item) => sum + item.weight, 0) * q;
    let cumulative = 0;
    for (const item of values) {
      cumulative += item.weight;
      if (cumulative >= threshold) return item.value;
    }
    return values[values.length - 1].value;
  };
  // RAS->Three reverses the anterior axis, so source min A becomes max Three Z.
  return [
    [quantile(0, 0, 0.01), quantile(1, 0, 0.01), quantile(2, 1, 0.01)],
    [quantile(0, 1, 0.99), quantile(1, 1, 0.99), quantile(2, 0, 0.99)],
  ];
}
export function cameraPresetDirection(preset: string): Vec3 {
  const directions: Record<string, Vec3> = {
    lateral: [-330, 45, -35],
    medial: [330, 30, -10],
    "lateral-right": [330, 45, -35],
    "medial-right": [-330, 30, -10],
    superior: [0, 350, 0.1],
    inferior: [0, -350, 0.1],
    anterior: [0, 15, -350],
    posterior: [0, 15, 350],
  };
  return directions[preset] ?? directions.lateral;
}
export function rasToScene([r, a, s]: Vec3): Vec3 {
  return [r, s, -a];
}
export function sceneToRas([x, y, z]: Vec3): Vec3 {
  return [x, -z, y];
}
export function slicePixelToRas(
  plane: Plane,
  index: number,
  x: number,
  y: number,
): Vec3 {
  if (plane === "axial") return [128 - x, 128 - y, 128 - index];
  if (plane === "coronal") return [128 - x, 128 - index, 128 - y];
  return [128 - index, 128 - x, 128 - y];
}
export function rasToSlicePixel(plane: Plane, [r, a, s]: Vec3) {
  if (plane === "axial") return { index: 128 - s, x: 128 - r, y: 128 - a };
  if (plane === "coronal") return { index: 128 - a, x: 128 - r, y: 128 - s };
  return { index: 128 - r, x: 128 - a, y: 128 - s };
}
export function decodeLabel(r: number, g: number) {
  return r + g * 256;
}
export function pixelAtPointer(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
  size: number,
): [number, number] | null {
  if (
    ![
      clientX,
      clientY,
      rect.left,
      rect.top,
      rect.width,
      rect.height,
      size,
    ].every(Number.isFinite) ||
    !Number.isInteger(size) ||
    size <= 0
  )
    return null;
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    clientX < rect.left ||
    clientY < rect.top ||
    clientX >= rect.left + rect.width ||
    clientY >= rect.top + rect.height
  )
    return null;
  return [
    Math.floor(((clientX - rect.left) / rect.width) * size),
    Math.floor(((clientY - rect.top) / rect.height) * size),
  ];
}
