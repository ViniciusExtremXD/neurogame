import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildCatalog, runtimeReviewExclusions } from "./build-catalog.mjs";

const readJson = (path) =>
  JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
const planes = ["axial", "coronal", "sagittal"];
const hash = (buffer) => createHash("sha256").update(buffer).digest("hex");
const normalizedName = (text) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[-‐‑‒–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Reject URL/traversal paths and symlinks escaping the deployed public directory. */
export function publicFile(publicRoot, path) {
  assert(typeof path === "string" && path.length > 0, "Empty asset path");
  assert(
    !isAbsolute(path) && !/[:\\%?#\0]/.test(path),
    `Unsafe asset path: ${path}`,
  );
  assert(
    path
      .split("/")
      .every((segment) => segment && segment !== "." && segment !== ".."),
    `Unsafe asset path: ${path}`,
  );
  const root = realpathSync(publicRoot);
  const actual = realpathSync(resolve(root, path));
  const inside = relative(root, actual);
  assert(
    inside &&
      !inside.startsWith(`..${sep}`) &&
      inside !== ".." &&
      !isAbsolute(inside),
    `Asset escapes public directory: ${path}`,
  );
  assert(statSync(actual).isFile(), `Asset is not a file: ${path}`);
  return actual;
}

function checkedBytes(publicRoot, path, evidence) {
  const bytes = readFileSync(publicFile(publicRoot, path));
  assert.equal(bytes.length, evidence.bytes, `${path}: byte count`);
  assert.match(evidence.sha256, /^[a-f0-9]{64}$/, `${path}: missing SHA256`);
  assert.equal(hash(bytes), evidence.sha256, `${path}: SHA256`);
  return bytes;
}

function glbContents(bytes, path) {
  assert.equal(bytes.toString("ascii", 0, 4), "glTF", `${path}: GLB magic`);
  assert.equal(bytes.readUInt32LE(4), 2, `${path}: glTF version`);
  assert.equal(
    bytes.readUInt32LE(8),
    bytes.length,
    `${path}: GLB total length`,
  );
  assert.equal(bytes.readUInt32LE(16), 0x4e4f534a, `${path}: JSON chunk`);
  const jsonEnd = 20 + bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.toString("utf8", 20, jsonEnd).trim());
  assert.equal(
    bytes.readUInt32LE(jsonEnd + 4),
    0x004e4942,
    `${path}: binary chunk`,
  );
  const binary = bytes.subarray(jsonEnd + 8);
  assert.equal(
    bytes.readUInt32LE(jsonEnd),
    binary.length,
    `${path}: binary length`,
  );
  assert.equal(gltf.buffers.length, 1, `${path}: one embedded buffer`);
  assert(!gltf.buffers[0].uri, `${path}: external buffer is not permitted`);
  assert(
    binary.length >= gltf.buffers[0].byteLength &&
      binary.length - gltf.buffers[0].byteLength <= 3,
    `${path}: buffer length`,
  );
  for (const view of gltf.bufferViews) {
    assert.equal(view.buffer, 0, `${path}: unexpected buffer`);
    assert(
      (view.byteOffset || 0) >= 0 &&
        (view.byteOffset || 0) + view.byteLength <= binary.length,
      `${path}: buffer view exceeds binary`,
    );
  }
  for (const node of gltf.nodes) {
    // All source meshes are already in common world coordinates; no hidden transform is allowed.
    assert(
      !node.translation && !node.rotation && !node.scale && !node.matrix,
      `${path}: unexpected node transform`,
    );
  }
  return { gltf, binary };
}

function checkGeometry(
  bytes,
  path,
  expectedAssets,
  sourceCommit,
  detailed = true,
) {
  const { gltf, binary } = glbContents(bytes, path);
  const expected = new Map(expectedAssets.map((a) => [a.id, a]));
  assert.equal(gltf.meshes.length, expected.size, `${path}: mesh count`);
  const seen = new Set();
  for (const mesh of gltf.meshes) {
    const a = expected.get(mesh.extras?.assetId);
    assert(a, `${path}: unknown mesh identity ${mesh.name}`);
    assert(!seen.has(a.id), `${path}: duplicated mesh ${a.id}`);
    seen.add(a.id);
    assert.equal(mesh.name, a.id, `${path}: mesh name`);
    assert.equal(mesh.extras.labelId, a.labelId, `${path}: mesh label ID`);
    assert.equal(
      mesh.extras.sourceCommit,
      sourceCommit,
      `${path}: source revision`,
    );
    assert.equal(
      mesh.extras.coordinates,
      "RAS millimeters",
      `${path}: mesh coordinate system`,
    );
    assert.equal(mesh.primitives.length, 1, `${path}: primitive count`);
    const p = mesh.primitives[0];
    assert.equal(p.mode, 4, `${path}: triangle primitive`);
    const position = gltf.accessors[p.attributes.POSITION];
    const indices = gltf.accessors[p.indices];
    const normals = gltf.accessors[p.attributes.NORMAL];
    assert.equal(position.type, "VEC3", `${path}: position shape`);
    assert.equal(position.componentType, 5126, `${path}: float32 position`);
    assert.equal(position.count, a.vertices, `${path}: vertex count`);
    assert.equal(indices.type, "SCALAR", `${path}: index shape`);
    assert.equal(indices.componentType, 5125, `${path}: uint32 index`);
    assert.equal(indices.count, a.triangles * 3, `${path}: triangle count`);
    assert(
      normals &&
        normals.count === position.count &&
        normals.type === "VEC3" &&
        normals.componentType === 5126,
      `${path}: source normals`,
    );
    for (let axis = 0; axis < 3; axis++) {
      assert(
        Math.abs(position.min[axis] - a.bounds[0][axis]) < 0.00002,
        `${path}: minimum bound`,
      );
      assert(
        Math.abs(position.max[axis] - a.bounds[1][axis]) < 0.00002,
        `${path}: maximum bound`,
      );
      assert(
        Math.abs(a.center[axis] - (a.bounds[0][axis] + a.bounds[1][axis]) / 2) <
          0.00002,
        `${path}: bounding center`,
      );
    }
    if (!detailed) continue;
    const componentView = (accessor) => {
      const view = gltf.bufferViews[accessor.bufferView];
      const offset = (view.byteOffset || 0) + (accessor.byteOffset || 0);
      const stride = view.byteStride || (accessor.type === "VEC3" ? 12 : 4);
      const end =
        (accessor.byteOffset || 0) +
        (accessor.count - 1) * stride +
        (accessor.type === "VEC3" ? 12 : 4);
      assert(end <= view.byteLength, `${path}: accessor exceeds its view`);
      return { offset, stride };
    };
    for (const accessor of [position, normals]) {
      const { offset, stride } = componentView(accessor);
      const min = [Infinity, Infinity, Infinity],
        max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < accessor.count; i++)
        for (let axis = 0; axis < 3; axis++) {
          const value = binary.readFloatLE(offset + i * stride + axis * 4);
          assert(Number.isFinite(value), `${path}: nonfinite geometry`);
          min[axis] = Math.min(min[axis], value);
          max[axis] = Math.max(max[axis], value);
        }
      for (let axis = 0; axis < 3; axis++) {
        assert(
          Math.abs(min[axis] - accessor.min[axis]) < 0.00001,
          `${path}: accessor minimum disagrees with vertices`,
        );
        assert(
          Math.abs(max[axis] - accessor.max[axis]) < 0.00001,
          `${path}: accessor maximum disagrees with vertices`,
        );
      }
    }
    const { offset, stride } = componentView(indices);
    for (let i = 0; i < indices.count; i++)
      assert(
        binary.readUInt32LE(offset + i * stride) < position.count,
        `${path}: index out of bounds`,
      );
  }
}

const paeth = (a, b, c) => {
  const p = a + b - c,
    pa = Math.abs(p - a),
    pb = Math.abs(p - b),
    pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Decode the actual lossless image. This does not trust labelIds or bestSlices metadata. */
function decodePng(bytes, path, width, height, colorType) {
  assert.equal(
    bytes.subarray(0, 8).toString("hex"),
    "89504e470d0a1a0a",
    `${path}: PNG signature`,
  );
  assert.equal(bytes.toString("ascii", 12, 16), "IHDR", `${path}: PNG header`);
  assert.equal(bytes.readUInt32BE(16), width, `${path}: width`);
  assert.equal(bytes.readUInt32BE(20), height, `${path}: height`);
  assert.equal(bytes[24], 8, `${path}: bit depth`);
  assert.equal(bytes[25], colorType, `${path}: color type`);
  assert.equal(
    bytes[26] + bytes[27] + bytes[28],
    0,
    `${path}: unsupported PNG encoding`,
  );
  const chunks = [];
  for (let offset = 8; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    assert(
      offset + 12 + length <= bytes.length,
      `${path}: truncated PNG chunk`,
    );
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT")
      chunks.push(bytes.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  const channels = colorType === 2 ? 3 : 1;
  const stride = width * channels;
  const filtered = inflateSync(Buffer.concat(chunks));
  assert.equal(
    filtered.length,
    height * (stride + 1),
    `${path}: decompressed length`,
  );
  const pixels = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const kind = filtered[y * (stride + 1)];
    assert(kind <= 4, `${path}: PNG filter`);
    for (let x = 0; x < stride; x++) {
      const position = y * stride + x;
      const left = x >= channels ? pixels[position - channels] : 0;
      const up = y ? pixels[position - stride] : 0;
      const upperLeft =
        y && x >= channels ? pixels[position - stride - channels] : 0;
      const correction =
        kind === 0
          ? 0
          : kind === 1
            ? left
            : kind === 2
              ? up
              : kind === 3
                ? Math.floor((left + up) / 2)
                : paeth(left, up, upperLeft);
      pixels[position] =
        (filtered[y * (stride + 1) + 1 + x] + correction) & 255;
    }
  }
  return pixels;
}

function rejectPrivateFiles(directory) {
  let count = 0;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      assert(
        !/^\.private|^staging-|^attachments$/i.test(entry.name),
        `Private source directory found: ${path}`,
      );
      count += rejectPrivateFiles(path);
    } else {
      assert(
        !entry.isSymbolicLink(),
        `Distributed symlink is not allowed: ${path}`,
      );
      assert(
        extname(path).toLowerCase() !== ".pdf",
        `PDF found in distribution: ${path}`,
      );
      const bytes = readFileSync(path);
      assert(
        !bytes.subarray(0, 1024).includes(Buffer.from("%PDF-")),
        `PDF disguised as another extension: ${path}`,
      );
      count++;
    }
  }
  return count;
}

export function validateAssets(projectRoot = process.cwd()) {
  const publicRoot = resolve(projectRoot, "public");
  const manifest = readJson(resolve(publicRoot, "anatomy/manifest.json"));
  const lock = readJson(resolve(publicRoot, "anatomy/source-lock.json"));
  const curriculum = readJson(
    resolve(projectRoot, "src/content/curriculum.json"),
  );
  const editorial = readJson(
    resolve(projectRoot, "src/content/asset-content.json"),
  );
  const catalog = readJson(resolve(publicRoot, "content/catalog.json"));
  const runtimeCurriculum = readJson(
    resolve(publicRoot, "content/curriculum.json"),
  );
  const assetById = new Map(manifest.assets.map((a) => [a.id, a]));
  const labelIds = new Set(manifest.assets.map((a) => a.labelId));
  const packById = new Map(manifest.packs.map((p) => [p.id, p]));
  assert.equal(assetById.size, manifest.assets.length, "Duplicate asset IDs");
  assert.equal(labelIds.size, manifest.assets.length, "Duplicate label IDs");
  assert.equal(packById.size, manifest.packs.length, "Duplicate pack IDs");
  assert.equal(
    manifest.atlas.commit,
    lock.commit,
    "Source lock differs from manifest",
  );
  assert.equal(
    manifest.atlas.repository,
    lock.repository,
    "Source repository differs from lock",
  );
  assert.equal(manifest.coordinates.meshSpace, "RAS");
  assert.equal(manifest.coordinates.units, "mm");
  const report = {
    status: "passed",
    publicFiles: rejectPrivateFiles(publicRoot),
    assets: 0,
    packs: 0,
    pngs: 0,
    maskPixels: 0,
    sourceDiscrepancies: [],
    sourceCommit: manifest.atlas.commit,
    manifestSha256: hash(
      readFileSync(resolve(publicRoot, "anatomy/manifest.json")),
    ),
  };
  const packedIds = [];
  for (const a of manifest.assets) {
    assert.equal(a.id, `spl-${a.labelId}`, `${a.id}: stable label identity`);
    assert(
      ["verified", "source-discrepancy"].includes(a.technicalReview),
      `${a.id}: unsupported technical review`,
    );
    assert.equal(
      a.humanReview,
      "pending",
      `${a.id}: human review must not be invented`,
    );
    assert.equal(a.licenseId, manifest.atlas.licenseId, `${a.id}: license`);
    if (a.technicalReview === "source-discrepancy") {
      assert(a.reviewNote, `${a.id}: discrepancy requires evidence`);
      report.sourceDiscrepancies.push(a.id);
    }
    const pack = packById.get(a.packId);
    assert(pack?.assetIds.includes(a.id), `${a.id}: missing pack reference`);
    checkGeometry(
      checkedBytes(publicRoot, a.path, a),
      a.path,
      [a],
      manifest.atlas.commit,
    );
    report.assets++;
  }
  for (const p of manifest.packs) {
    assert.equal(
      new Set(p.assetIds).size,
      p.assetIds.length,
      `${p.id}: duplicated asset in pack`,
    );
    const assets = p.assetIds.map((id) => {
      const a = assetById.get(id);
      assert(a && a.packId === p.id, `${p.id}: invalid asset reference ${id}`);
      return a;
    });
    checkGeometry(
      checkedBytes(publicRoot, p.path, p),
      p.path,
      assets,
      manifest.atlas.commit,
      false,
    );
    packedIds.push(...p.assetIds);
    report.packs++;
  }
  assert.equal(
    packedIds.length,
    manifest.assets.length,
    "Pack membership must be one-to-one",
  );
  assert.equal(
    new Set(packedIds).size,
    manifest.assets.length,
    "Each asset must appear in exactly one pack",
  );
  const seenSlices = new Map();
  const preservedUnmappedLabels = new Set();
  let inferiorColliculusVoxels = 0,
    isolatedComponentNeighborhoodVoxels = 0;
  for (const plane of planes) {
    const { width, height, entries } = manifest.slices[plane];
    assert.equal(entries.length, 256, `${plane}: incomplete slice stack`);
    assert.equal(
      new Set(entries.map((e) => e.index)).size,
      entries.length,
      `${plane}: duplicate slice index`,
    );
    for (const entry of entries) {
      assert(
        Number.isInteger(entry.index) && entry.index >= 0 && entry.index < 256,
        `${plane}: invalid index`,
      );
      decodePng(
        checkedBytes(publicRoot, entry.mriPath, entry.mri),
        entry.mriPath,
        width,
        height,
        0,
      );
      const pixels = decodePng(
        checkedBytes(publicRoot, entry.labelsPath, entry.labels),
        entry.labelsPath,
        width,
        height,
        2,
      );
      const counts = new Map();
      for (let offset = 0; offset < pixels.length; offset += 3) {
        assert.equal(
          pixels[offset + 2],
          0,
          `${entry.labelsPath}: label blue channel must be zero`,
        );
        const label = pixels[offset] + pixels[offset + 1] * 256;
        if (label) counts.set(label, (counts.get(label) || 0) + 1);
      }
      if (plane === "axial" && runtimeReviewExclusions["spl-3022"]) {
        inferiorColliculusVoxels += counts.get(3022) || 0;
        // RAS [47,-19,45] -> axial index 83, pixel [81,147]. The complete
        // 3×3×3 neighborhood verifies that the flagged source voxel is isolated.
        if (entry.index >= 82 && entry.index <= 84)
          for (let y = 146; y <= 148; y++)
            for (let x = 80; x <= 82; x++) {
              const offset = (y * width + x) * 3;
              const label = pixels[offset] + pixels[offset + 1] * 256;
              if (label === 3022) isolatedComponentNeighborhoodVoxels++;
              if (entry.index === 83 && x === 81 && y === 147)
                assert.equal(
                  label,
                  3022,
                  "spl-3022: pinned runtime exclusion evidence changed",
                );
            }
      }
      // Conversion preserves every native voxel, including facial muscles and labels
      // outside the neuroanatomy catalog. Metadata intentionally lists catalog labels.
      for (const label of counts.keys())
        if (!labelIds.has(label)) preservedUnmappedLabels.add(label);
      assert.deepEqual(
        [...counts.keys()]
          .filter((id) => labelIds.has(id))
          .sort((a, b) => a - b),
        [...entry.labelIds].sort((a, b) => a - b),
        `${entry.labelsPath}: catalog labels differ from actual pixels`,
      );
      for (const a of manifest.assets) {
        const best = a.bestSlices?.[plane];
        if (best?.index !== entry.index) continue;
        assert(a.hasVolume, `${a.id}: surface-only asset has a best slice`);
        assert.equal(
          counts.get(a.labelId),
          best.areaPixels,
          `${a.id}/${plane}: actual mask area`,
        );
        const [x, y] = best.pixel;
        assert(
          Number.isInteger(x) &&
            Number.isInteger(y) &&
            x >= 0 &&
            x < width &&
            y >= 0 &&
            y < height,
          `${a.id}/${plane}: landmark pixel`,
        );
        const offset = (y * width + x) * 3;
        assert.equal(
          pixels[offset] + pixels[offset + 1] * 256,
          a.labelId,
          `${a.id}/${plane}: landmark belongs to another label`,
        );
      }
      seenSlices.set(`${plane}/${entry.index}`, counts);
      report.maskPixels += width * height;
      report.pngs += 2;
    }
  }
  if (runtimeReviewExclusions["spl-3022"]) {
    assert.equal(
      inferiorColliculusVoxels,
      66,
      "spl-3022: total native voxels changed",
    );
    assert.equal(
      isolatedComponentNeighborhoodVoxels,
      1,
      "spl-3022: isolated component evidence changed",
    );
  }
  const itemIds = new Set(curriculum.items.map((i) => i.id));
  const editorialById = new Map(editorial.assets.map((a) => [a.id, a]));
  const names = new Map();
  for (const a of catalog.assets) {
    assert(assetById.has(a.id), `${a.id}: catalog references absent geometry`);
    assert.equal(
      a.sourceTechnicalReview,
      assetById.get(a.id).technicalReview,
      `${a.id}: original technical review must remain traceable`,
    );
    if (runtimeReviewExclusions[a.id]) {
      assert.equal(
        a.eligible,
        false,
        `${a.id}: runtime review exclusion must prevent assessment`,
      );
      assert.equal(
        a.explorationReview,
        "flagged",
        `${a.id}: exploration must disclose review flag`,
      );
      assert.equal(
        a.technicalReview,
        "source-discrepancy",
        `${a.id}: runtime review status`,
      );
      assert.deepEqual(
        a.runtimeReview,
        runtimeReviewExclusions[a.id],
        `${a.id}: runtime review evidence`,
      );
    }
    for (const id of a.curriculumIds)
      assert(itemIds.has(id), `${a.id}: unknown curriculum ID ${id}`);
    if (!a.eligible) continue;
    assert.equal(
      a.technicalReview,
      "verified",
      `${a.id}: unverified geometry cannot be assessed`,
    );
    assert.equal(
      a.mappingRelation,
      "exact",
      `${a.id}: partial mapping cannot be assessed`,
    );
    assert.equal(
      editorialById.get(a.id)?.assessmentCandidate,
      true,
      `${a.id}: assessment lacks editorial approval`,
    );
    assert(
      a.description?.summary && a.description.references.length,
      `${a.id}: missing description sources`,
    );
    assert(a.assessmentViews.length, `${a.id}: no assessment view`);
    for (const view of a.assessmentViews) {
      if (view === "3d")
        assert(
          a.surface,
          `${a.id}: hidden deep target cannot be assessed in surface scene`,
        );
      else
        assert(
          (seenSlices.get(`${view}/${a.sliceIndices[view]}`)?.get(a.labelId) ||
            0) >= 12,
          `${a.id}/${view}: target is absent or too small`,
        );
    }
    for (const name of new Set([a.name, ...a.aliases].map(normalizedName))) {
      assert(
        !names.has(name),
        `${a.id}: answer collides with ${names.get(name)}: ${name}`,
      );
      names.set(name, a.id);
    }
  }
  const rebuilt = buildCatalog(manifest, curriculum, editorial, publicRoot);
  // Serialize to remove intentionally omitted optional fields before equality checking.
  assert.deepEqual(
    catalog,
    JSON.parse(JSON.stringify(rebuilt.catalog)),
    "Runtime catalog is stale; run node scripts/build-catalog.mjs",
  );
  assert.deepEqual(
    runtimeCurriculum,
    JSON.parse(JSON.stringify(rebuilt.curriculum)),
    "Runtime curriculum is stale",
  );
  Object.assign(report, {
    preservedUnmappedLabels: [...preservedUnmappedLabels].sort((a, b) => a - b),
    runtimeReviewExclusions: Object.keys(runtimeReviewExclusions),
    curricularItems: catalog.curriculumCount,
    visual3dItems: catalog.visualCount,
    visual2dItems: catalog.visual2dCount,
    assessmentItems: catalog.assessmentCount,
    eligibleTargets: catalog.eligibleAssetCount,
  });
  return report;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(JSON.stringify(validateAssets(), null, 2));
  } catch (error) {
    console.error(`Asset validation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
