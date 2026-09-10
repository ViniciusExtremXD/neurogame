import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import {
  GizmoHelper,
  GizmoViewport,
  Html,
  OrbitControls,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  Box3,
  BufferGeometry,
  DoubleSide,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  Texture,
  Vector3,
} from "three";
import type { AnatomyAsset, SceneProps } from "./types";
import { fetchAnatomyAsset } from "./assetTransport";
import {
  cameraFramingBounds,
  cameraPresetDirection,
  rasToScene,
  slicePixelToRas,
} from "./spatial";

const base = import.meta.env.BASE_URL;

/** A new registry belongs to each visible asset set, never to the historical cache. */
export function createMountedAssetRegistry(ids: string[]) {
  const expected = new Set(ids),
    mounted = new Map<string, symbol>(),
    listeners = new Set<() => void>();
  const getSnapshot = () =>
    expected.size > 0 && [...expected].every((id) => mounted.has(id));
  return {
    getSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    report(id: string, instance: symbol, present: boolean) {
      if (!expected.has(id)) return;
      const before = getSnapshot();
      if (present) mounted.set(id, instance);
      else if (mounted.get(id) === instance) mounted.delete(id);
      if (before !== getSnapshot()) listeners.forEach((listener) => listener());
    },
  };
}

function disposeMaterials(materials: Set<Material>) {
  const textures = new Set<Texture>();
  materials.forEach((material) => {
    Object.values(material).forEach((value) => {
      if (value instanceof Texture) textures.add(value);
    });
    material.dispose();
  });
  textures.forEach((texture) => {
    texture.dispose();
    const image = texture.image as { close?: () => void } | undefined;
    image?.close?.();
  });
}

/** These scenes are owned by one mount; no shared Drei geometry remains resident. */
export function disposeAnatomyScene(scene: Group) {
  const geometries = new Set<BufferGeometry>(),
    materials = new Set<Material>();
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    geometries.add(node.geometry);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(
      (material) => materials.add(material),
    );
  });
  geometries.forEach((geometry) => geometry.dispose());
  disposeMaterials(materials);
  scene.clear();
}

export function shouldSelectMesh(
  delta: number,
  button: number,
  rendered: boolean,
) {
  return rendered && Number.isFinite(delta) && delta <= 4 && button === 0;
}

type MountReporter = (id: string, instance: symbol, present: boolean) => void;
type OwnedModel = { scene: Group; material: MeshStandardMaterial };

function AnatomyMesh({
  asset,
  selected,
  dim,
  opacity,
  onSelect,
  onMounted,
}: {
  asset: AnatomyAsset;
  selected: boolean;
  dim: boolean;
  opacity: number;
  onSelect: (id: string) => void;
  onMounted: MountReporter;
}) {
  const { gl, invalidate } = useThree();
  const [model, setModel] = useState<OwnedModel | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const rendered = useRef(false),
    hovered = useRef(false);
  const instance = useRef(Symbol(asset.id));

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false,
      owned: Group | null = null;
    async function load() {
      try {
        const bytes = await fetchAnatomyAsset(
          base + asset.path,
          controller.signal,
        );
        if (cancelled) return;
        const gltf = await new GLTFLoader().parseAsync(bytes, "");
        if (cancelled) {
          disposeAnatomyScene(gltf.scene);
          return;
        }
        owned = gltf.scene;
        const originals = new Set<Material>();
        let meshes = 0;
        owned.traverse((node) => {
          if (!(node instanceof Mesh)) return;
          const positions = node.geometry.getAttribute("position"),
            normals = node.geometry.getAttribute("normal");
          if (
            node.name !== asset.id ||
            !positions?.count ||
            normals?.count !== positions.count
          ) {
            throw new Error(
              "O arquivo 3D não corresponde ao modelo anatômico validado.",
            );
          }
          meshes++;
          (Array.isArray(node.material)
            ? node.material
            : [node.material]
          ).forEach((material) => originals.add(material));
        });
        if (meshes === 0)
          throw new Error("O arquivo não contém uma superfície anatômica.");
        const material = new MeshStandardMaterial({
          color: asset.color,
          roughness: 0.7,
          metalness: 0,
          side: DoubleSide,
        });
        owned.traverse((node) => {
          if (node instanceof Mesh) {
            node.material = material;
            node.castShadow = false;
            node.receiveShadow = false;
          }
        });
        disposeMaterials(originals);
        setModel({ scene: owned, material });
        invalidate();
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause
              : new Error("Falha ao abrir a anatomia 3D."),
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
      controller.abort();
      if (owned) disposeAnatomyScene(owned);
      if (hovered.current) gl.domElement.style.cursor = "";
    };
  }, [asset.id, asset.path, asset.color, gl, invalidate]);

  useEffect(() => {
    if (!model) return;
    rendered.current = false;
    const token = instance.current;
    model.scene.traverse((node) => {
      if (node instanceof Mesh)
        node.onAfterRender = () => {
          if (rendered.current) return;
          rendered.current = true;
          onMounted(asset.id, token, true);
        };
    });
    invalidate();
    return () => {
      rendered.current = false;
      model.scene.traverse((node) => {
        if (node instanceof Mesh) node.onAfterRender = () => {};
      });
      onMounted(asset.id, token, false);
    };
  }, [model, asset.id, onMounted, invalidate]);

  useEffect(() => {
    if (!model) return;
    const material = model.material;
    material.color.set(selected ? "#f5c974" : asset.color);
    material.emissive.set(selected ? "#664518" : "#000000");
    material.emissiveIntensity = selected ? 0.23 : 0;
    const wasTransparent = material.transparent;
    material.opacity = dim ? Math.min(opacity, 0.12) : opacity;
    material.transparent = material.opacity < 1;
    material.depthWrite = material.opacity > 0.5;
    if (wasTransparent !== material.transparent) material.needsUpdate = true;
    invalidate();
  }, [selected, dim, opacity, model, asset.color, invalidate]);

  if (error) throw error;
  if (!model) return null;
  function click(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (
      !shouldSelectMesh(event.delta, event.button, rendered.current) ||
      event.nativeEvent.defaultPrevented
    )
      return;
    onSelect(asset.id);
  }
  return (
    <primitive
      object={model.scene}
      dispose={null}
      onClick={click}
      onPointerOver={(event: ThreeEvent<PointerEvent>) => {
        event.stopPropagation();
        if (event.buttons !== 0 || !rendered.current) return;
        hovered.current = true;
        gl.domElement.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        hovered.current = false;
        gl.domElement.style.cursor = "";
      }}
    />
  );
}

function CameraRig({
  preset,
  resetKey,
  zoom,
  reducedMotion,
  selected,
  assessment,
  assets,
  onMounted,
}: {
  preset: string;
  resetKey: number;
  zoom: number;
  reducedMotion: boolean;
  selected: AnatomyAsset | undefined;
  assessment: boolean;
  assets: AnatomyAsset[];
  onMounted: MountReporter;
}) {
  const { camera, invalidate } = useThree();
  const controls = useRef<OrbitControlsImpl>(null),
    moving = useRef(false);
  const instance = useRef(Symbol("camera"));
  const target = useRef(new Vector3()),
    destination = useRef(new Vector3());
  const assetKey = assets.map((asset) => asset.id).join("|");
  const framing = useMemo(() => {
    const [min, max] = cameraFramingBounds(assets);
    const bounds = new Box3(new Vector3(...min), new Vector3(...max));
    const center = bounds.getCenter(new Vector3()),
      size = bounds.getSize(new Vector3());
    return {
      center,
      distance: Math.max(130, Math.max(size.x, size.y, size.z) * 1.35),
    };
    // Atlas metadata for a stable asset ID is immutable.
  }, [assetKey]);
  useEffect(() => {
    const direction = new Vector3(...cameraPresetDirection(preset)).normalize();
    target.current.copy(framing.center);
    destination.current
      .copy(target.current)
      .addScaledVector(direction, framing.distance / Math.max(0.1, zoom));
    moving.current = true;
    onMounted("__camera__", instance.current, false);
    invalidate();
  }, [preset, resetKey, zoom, framing, invalidate, onMounted]);
  useEffect(() => {
    if (assessment || !selected) return;
    const next = framing.center
      .clone()
      .lerp(new Vector3(...rasToScene(selected.center)), 0.3);
    const delta = next.clone().sub(controls.current?.target ?? target.current);
    target.current.copy(next);
    destination.current.copy(camera.position).add(delta);
    moving.current = true;
    onMounted("__camera__", instance.current, false);
    invalidate();
  }, [selected, assessment, camera, framing, invalidate, onMounted]);
  useEffect(() => {
    const token = instance.current;
    return () => {
      onMounted("__camera__", token, false);
    };
  }, [onMounted]);
  useFrame((_, dt) => {
    if (!moving.current || !controls.current) return;
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, 0.1) * 10);
    camera.position.lerp(destination.current, alpha);
    controls.current.target.lerp(target.current, alpha);
    controls.current.update();
    if (
      camera.position.distanceTo(destination.current) < 0.08 &&
      controls.current.target.distanceTo(target.current) < 0.08
    ) {
      camera.position.copy(destination.current);
      controls.current.target.copy(target.current);
      controls.current.update();
      moving.current = false;
      onMounted("__camera__", instance.current, true);
    } else invalidate();
  });
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping={!reducedMotion}
      dampingFactor={0.12}
      minDistance={35}
      maxDistance={900}
      onStart={() => {
        moving.current = false;
        onMounted("__camera__", instance.current, true);
      }}
    />
  );
}

function CuttingPlane({
  plane,
  index,
}: {
  plane: NonNullable<SceneProps["plane"]>;
  index: number;
}) {
  const center = rasToScene(slicePixelToRas(plane, index, 127.5, 127.5));
  const size: [number, number, number] =
    plane === "axial"
      ? [256, 0.7, 256]
      : plane === "coronal"
        ? [256, 256, 0.7]
        : [0.7, 256, 256];
  return (
    <mesh position={center} raycast={() => {}}>
      <boxGeometry args={size} />
      <meshBasicMaterial
        color="#57baba"
        transparent
        opacity={0.15}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}

function SceneContent(props: SceneProps) {
  const {
    assets,
    selectedId,
    highlightedId,
    onSelect,
    hiddenIds,
    isolated,
    opacity,
    labels,
    assessment,
  } = props;
  const visible = assets.filter(
    (asset) =>
      !hiddenIds.includes(asset.id) &&
      (!isolated || asset.id === selectedId) &&
      (assessment ||
        props.preset !== "medial" ||
        asset.hemisphere !== "right") &&
      (assessment ||
        props.preset !== "medial-right" ||
        asset.hemisphere !== "left"),
  );
  const visibleKey = visible
    .map((asset) => `${asset.id}:${asset.path}`)
    .join("|");
  const registry = useMemo(
    () =>
      createMountedAssetRegistry(
        visible.length
          ? [...visible.map((asset) => asset.id), "__camera__"]
          : [],
      ),
    [visibleKey],
  );
  const ready = useSyncExternalStore(
    registry.subscribe,
    registry.getSnapshot,
    registry.getSnapshot,
  );
  useEffect(() => {
    props.onReady(ready);
  }, [ready, props.onReady]);
  useEffect(
    () => () => {
      props.onReady(false);
    },
    [props.onReady],
  );
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const contextLost = (event: Event) => {
      event.preventDefault();
      props.onReady(false);
      props.onError(
        "O contexto 3D foi interrompido. Continue pelos cortes ou tente novamente.",
      );
    };
    canvas.addEventListener("webglcontextlost", contextLost);
    return () => {
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.style.cursor = "";
    };
  }, [gl, props.onReady, props.onError]);
  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight color="#fff8e9" groundColor="#637f88" intensity={0.8} />
      <directionalLight position={[-160, 240, -120]} intensity={2} />
      <directionalLight
        position={[120, 40, 180]}
        intensity={0.7}
        color="#d4e7f0"
      />
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {visible.map((asset) => (
          <AnatomyMesh
            key={`${asset.id}:${asset.path}`}
            asset={asset}
            selected={asset.id === (highlightedId ?? selectedId)}
            dim={
              !assessment &&
              !!selectedId &&
              asset.id !== selectedId &&
              opacity < 1
            }
            opacity={opacity}
            onSelect={onSelect}
            onMounted={registry.report}
          />
        ))}
      </group>
      {labels &&
        !assessment &&
        visible
          .filter((asset) => asset.id === selectedId)
          .map((asset) => (
            <Html
              key={asset.id}
              position={rasToScene(asset.center)}
              center
              distanceFactor={220}
              style={{ pointerEvents: "none" }}
            >
              <span className="anatomy-label">{asset.name}</span>
            </Html>
          ))}
      {props.showPlane && props.plane && (
        <CuttingPlane plane={props.plane} index={props.sliceIndex} />
      )}
      <CameraRig
        preset={props.preset}
        resetKey={props.resetKey}
        zoom={props.zoom}
        reducedMotion={props.reducedMotion}
        selected={assets.find((asset) => asset.id === selectedId)}
        assessment={assessment}
        assets={visible}
        onMounted={registry.report}
      />
      <GizmoHelper alignment="bottom-left" margin={[68, 86]}>
        <GizmoViewport
          labels={["R", "S", "P"]}
          axisColors={["#659994", "#8ba8c4", "#c1a273"]}
          labelColor="#20393e"
          axisHeadScale={1.05}
          disabled
        />
      </GizmoHelper>
    </>
  );
}

export default function BrainScene(props: SceneProps) {
  // Canvas initializes its renderer asynchronously. Detect unavailable WebGL2
  // here so the surrounding React boundary can show the MRI fallback.
  const [supported] = useState(() => {
    try {
      const context = document.createElement("canvas").getContext("webgl2");
      if (!context) return false;
      context.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  });
  if (!supported) throw new Error("WebGL2 indisponível neste navegador.");
  return (
    <Canvas
      className="brain-canvas"
      role="group"
      aria-label={
        props.assessment
          ? "Modelo anatômico interativo; selecione um alvo"
          : "Atlas anatômico tridimensional interativo"
      }
      camera={{ position: [-270, 40, -30], near: 0.1, far: 1600, fov: 38 }}
      dpr={[1, 1.7]}
      frameloop="demand"
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
