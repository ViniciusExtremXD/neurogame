import { describe, expect, it } from "vitest";
import {
  cameraFramingBounds,
  cameraPresetDirection,
  rasToScene,
  sceneToRas,
  slicePixelToRas,
  rasToSlicePixel,
  decodeLabel,
  pixelAtPointer,
} from "./spatial";

describe("SPL native IJK to RAS and displayed planes", () => {
  it("retains right/left and anterior/superior in the Three rotation", () => {
    expect(rasToScene([30, 20, 10])).toEqual([30, 10, -20]);
    expect(sceneToRas([-30, 10, -20])).toEqual([-30, 20, 10]);
  });
  it("uses independent index triples for the same physical voxel in all planes", () => {
    // Source label affine: IJK [100,90,80] -> RAS [48,28,38] mm.
    expect(slicePixelToRas("axial", 90, 80, 100)).toEqual([48, 28, 38]);
    expect(slicePixelToRas("coronal", 100, 80, 90)).toEqual([48, 28, 38]);
    expect(slicePixelToRas("sagittal", 80, 100, 90)).toEqual([48, 28, 38]);
    expect(rasToSlicePixel("sagittal", [48, 28, 38])).toEqual({
      index: 80,
      x: 100,
      y: 90,
    });
  });
  it("does not interpolate labels or sample outside the image", () => {
    expect(decodeLabel(1, 1)).toBe(257);
    expect(
      pixelAtPointer(
        300,
        250,
        { left: 100, top: 50, width: 512, height: 512 },
        256,
      ),
    ).toEqual([100, 100]);
    expect(
      pixelAtPointer(
        612,
        50,
        { left: 100, top: 50, width: 512, height: 512 },
        256,
      ),
    ).toBeNull();
    expect(
      pixelAtPointer(
        NaN,
        50,
        { left: 100, top: 50, width: 512, height: 512 },
        256,
      ),
    ).toBeNull();
    expect(
      pixelAtPointer(
        100,
        50,
        { left: 100, top: 50, width: 512, height: 512 },
        0,
      ),
    ).toBeNull();
  });
  it("keeps medial-left and anterior camera directions anatomically correct", () => {
    expect(cameraPresetDirection("medial")[0]).toBeGreaterThan(0);
    expect(cameraPresetDirection("lateral")[0]).toBeLessThan(0);
    expect(sceneToRas(cameraPresetDirection("anterior"))[1]).toBeGreaterThan(0);
    expect(sceneToRas(cameraPresetDirection("superior"))[2]).toBeGreaterThan(0);
    expect(slicePixelToRas("axial", 147, 128, 149)).toEqual([0, -21, -19]);
  });
  it("fits the main source surfaces without letting a tiny remote component displace the camera", () => {
    expect(
      cameraFramingBounds([
        {
          bounds: [
            [-20, -30, -86],
            [20, 10, -8],
          ],
          vertices: 16000,
        },
        {
          bounds: [
            [2, -27, -24],
            [47, -19, 45],
          ],
          vertices: 120,
        },
      ]),
    ).toEqual([
      [-20, -86, -10],
      [20, -8, 30],
    ]);
  });
  it("shows the right lateral surface from R and right medial surface from L without reversing anterior", () => {
    expect(cameraPresetDirection("lateral-right")).toEqual([330, 45, -35]);
    expect(cameraPresetDirection("medial-right")).toEqual([-330, 30, -10]);
    expect(
      sceneToRas(cameraPresetDirection("lateral-right"))[1],
    ).toBeGreaterThan(0);
  });
});
