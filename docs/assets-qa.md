# Asset pipeline verification — 2026-09-09

Final asset manifest SHA-256:
`228b19907a73d8d00c62a01f636d031ebfba07145eefaabfb64b3674d712d587`.

Commands actually executed successfully (exit 0):

```sh
python staging-assets/download_sources.py --cache .private-assets/spl-source
python staging-assets/convert_atlas.py --cache .private-assets/spl-source --output staging-assets/output/anatomy
python staging-assets/verify_assets.py --cache .private-assets/spl-source --output staging-assets/output/anatomy
```

Acquisition verified 262 source files, 64,030,683 bytes, with SHA-256, byte
length and Git object hashes. The final conversion repeats the SHA-256 and size
verification before reading data.

Final verification output:

```json
{
  "ok": true,
  "glbMeshesVerified": 258,
  "packsVerified": 8,
  "fullLabelSlicesComparedToSource": 768,
  "labelPixelsCompared": 50331648,
  "orientationCornersChecked": 8,
  "fixedNamedLandmarks": 3,
  "anatomicalHumanReview": "pending"
}
```

GLBs were reopened from disk and checked for file hash, node identity, finite
vertices/normals, NORMAL attribute, triangle count and bounds. The six derived
meshes also passed watertightness, winding consistency and positive volume.
All 768 output ID masks were compared in full against the original NRRD planes.
Fixed source landmarks checked the aqueduct and bilateral caudate nuclei through
all three plane mappings. Transform inversion and lateral orientation were
checked at all eight volume corners. Each PNG file hash was checked.

Visual inspection of `qa-slices.png` confirmed readable T1 MRI in axial,
coronal and sagittal planes and coherent displayed orientation. This is
technical image inspection, not expert anatomical review. Browser selection,
WebGL performance, application usability and publication are validated by the
main application task, not this asset-only script.

The final public assets occupy 114,246,324 bytes, including duplicate delivery
as individual files and as packs. There are 236 meshes with volume labels and
22 source sulcal curves without volume labels. Seven source discrepancies are
marked and excluded from evaluative use: `spl-2`, `spl-41`, `spl-506`, `spl-510`,
`spl-1016`, `spl-3005`, `spl-3007`. See per-asset measurements in `validation.json`.

| Pack | Bytes on disk | Local gzip estimate | Triangles |
| --- | ---: | ---: | ---: |
| brainstem | 795,672 | 480,256 | 31,554 |
| cerebellum | 5,077,684 | 3,059,299 | 199,126 |
| cortex-left | 12,948,180 | 7,954,400 | 511,602 |
| cortex-right | 12,996,212 | 8,003,128 | 512,418 |
| deep-telencephalon | 13,470,932 | 8,231,576 | 550,118 |
| diencephalon | 1,029,372 | 622,613 | 38,566 |
| sulci | 2,154,312 | 1,297,662 | 87,888 |
| ventricles | 870,836 | 530,665 | 35,558 |

All packs individually fit below 15 MB on disk; this does not prove the initial
browser transfer budget if multiple packs are requested together. Gzip sizes
are measured local estimates, not measured HTTP transfers. The full atlas has
1,966,830 triangles; it should not be loaded all at once on mobile. No physical
mobile device performance claim is made.
