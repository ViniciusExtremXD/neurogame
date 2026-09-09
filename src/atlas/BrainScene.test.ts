import { describe, expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from "three";
import {
  createMountedAssetRegistry,
  disposeAnatomyScene,
  shouldSelectMesh,
} from "./BrainScene";

describe("3D asset ownership and readiness", () => {
  it("only becomes ready after all current assets rendered and revokes readiness on unmount", () => {
    const registry = createMountedAssetRegistry(["spl-11", "spl-50"]);
    const left = Symbol("left"),
      right = Symbol("right");
    expect(registry.getSnapshot()).toBe(false);
    registry.report("spl-11", left, true);
    expect(registry.getSnapshot()).toBe(false);
    registry.report("spl-50", right, true);
    expect(registry.getSnapshot()).toBe(true);
    registry.report("spl-11", left, false);
    expect(registry.getSnapshot()).toBe(false);
    expect(createMountedAssetRegistry(["spl-11", "spl-50"]).getSnapshot()).toBe(
      false,
    );
    expect(createMountedAssetRegistry([]).getSnapshot()).toBe(false);
  });

  it("ignores delayed cleanup from an earlier instance of the same asset", () => {
    const registry = createMountedAssetRegistry(["spl-19"]);
    const earlier = Symbol("earlier"),
      current = Symbol("current");
    registry.report("spl-19", earlier, true);
    registry.report("spl-19", current, true);
    registry.report("spl-19", earlier, false);
    expect(registry.getSnapshot()).toBe(true);
    registry.report("spl-19", current, false);
    expect(registry.getSnapshot()).toBe(false);
  });

  it("disposes every owned GPU resource once even when meshes share it", () => {
    const scene = new Group(),
      geometry = new BoxGeometry(),
      texture = new Texture();
    const material = new MeshStandardMaterial({ map: texture });
    const disposed = { geometry: 0, material: 0, texture: 0 };
    geometry.addEventListener("dispose", () => {
      disposed.geometry++;
    });
    material.addEventListener("dispose", () => {
      disposed.material++;
    });
    texture.addEventListener("dispose", () => {
      disposed.texture++;
    });
    scene.add(new Mesh(geometry, material), new Mesh(geometry, material));
    disposeAnatomyScene(scene);
    expect(disposed).toEqual({ geometry: 1, material: 1, texture: 1 });
    expect(scene.children).toHaveLength(0);
  });

  it("does not score drags, non-primary clicks or unrendered surfaces", () => {
    expect(shouldSelectMesh(5, 0, true)).toBe(false);
    expect(shouldSelectMesh(0, 2, true)).toBe(false);
    expect(shouldSelectMesh(0, 0, false)).toBe(false);
    expect(shouldSelectMesh(0, 0, true)).toBe(true);
  });
});
