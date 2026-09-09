# SPL/NAC asset pipeline

This is a **modified derivative** of the SPL/NAC GitHub atlas, fixed to commit
`bec24db25aad5f7600e2df3becfb1f883e61ff56`. It is not asserted to be identical to
the separate January 2017 OpenAnatomy ZIP. The pinned repository README calls
the collection "SPL-PNL Brain Atlas"; the SPL/NAC page links to that repository.
Both source names are retained here to make the provenance distinction explicit.
It reads no academic PDF or PDF image.

Install a Python 3.13 environment, then from the repository root:

```sh
python -m pip install -r scripts/assets/requirements.txt
python scripts/assets/download_sources.py --cache .private-assets/spl-source
python scripts/assets/convert_atlas.py --cache .private-assets/spl-source --output public/anatomy
python scripts/assets/verify_assets.py --cache .private-assets/spl-source --output public/anatomy
```

Use the actual script directory if this file is still in `staging-assets`.
Acquisition verifies every SHA-256, size, and Git blob hash against
`source-lock.json`. Original volumes and meshes stay in `.private-assets` and
must be ignored by version control. Only converted outputs belong in public.
Python/VTK never run in the browser.

## Representation and transforms

258 individual GLBs and eight packs contain 252 official neuroanatomical
surfaces/curves and six voxel-derived surfaces. There is no decimation, smoothing,
mirroring or repositioning of official vertices. Original point normals are
preserved in GLB to support smooth shading. Missing cerebellar meshes for
labels 305, 306, 322, 339, 340 and 356 use VTK marching cubes at 0.5 on the
corresponding binary source masks; winding is reversed for the negative
determinant of IJK to RAS. Their abbreviated source labels need human review.

GLB positions are RAS in **millimeters**, mesh names are `spl-<source label>`.
Apply one scene rotation of −π/2 around X for Three.js `[R,S,-A]`. The GLB unit
convention is explicitly custom millimeters rather than the glTF default meter;
do not apply a second, implicit medical transform. The source voxel grid is
256³ and IJK → RAS is `[128-k,128-i,128-j]`. The source NRRD is LPS with origin
`[-128,-128,128]`, spacing 1 mm and direction columns `[0,1,0]`, `[0,0,-1]`,
`[1,0,0]`.

The T1 header has a half-millimeter offset from the label grid. MRI intensity
is trilinearly sampled with `mriIJK=labelIJK-[0.5,0.5,0.5]`. The label volume is
never resampled. A reproducible intensity window uses the 99.5th percentile of
positive resampled intensities. Images are T1 MRI, never CT.

Each plane includes 256 MRI PNGs and 256 corresponding ID PNGs. Pixel `(x,y)`:

| Plane | Source IJK | Orientation at image edges |
| --- | --- | --- |
| axial | `[y,index,x]` | top A, bottom P, left R, right L |
| coronal | `[index,y,x]` | top S, bottom I, left R, right L |
| sagittal | `[x,y,index]` | top S, bottom I, left A, right P |

ID PNG is RGB with `labelId=R+256*G`, B=0. Read pixels at native dimensions
without smoothing, image interpolation or lossy conversion. Never infer IDs
from the MRI or visible overlay color. MRI and label PNG pixels have matching
centers. For a Three.js slice plane, transform pixel-center RAS positions by
the same parent transform as the surfaces. A texture spanning pixels 0..255
has spatial edges at -0.5 and 255.5 voxel units.

Full masks retain source non-neural labels (e.g. head muscles). Only IDs in
the manifest with curated eligible catalog entries are valid study targets.
Label 1 has no reliable name and is excluded. Skin and head/neck muscles are
not delivered as 3D models. The 22 official sulcal curves have no volume label
and must never appear as registered slice targets.

## Manifest contract

`manifest.json` stores `atlas`, `coordinates`, `assets`, `packs`, and `slices`.
Paths include `anatomy/` and must be resolved under the Vite base URL.
Each asset includes `id`, `labelId`, `nameEn`, `moduleId`, `path`, `color`,
`center`, `bounds`, `hasVolume`, `representation`, `sourcePath`, `sourceNode`,
`bestSlices`, `technicalReview`, `humanReview`, byte size, SHA-256 and gzip size.
Each pack has a GLB path and exact member IDs. The two cortical packs contain
35 source regions per side; these labels represent atlas parcels, not a complete
list of separate curricular structures.

Technical module IDs: `telencephalon`, `diencephalon`, `cerebellum`, `brainstem`,
`ventricles`. Modules are delivery groups; curricular membership is separate.

`bestSlices[plane]` contains `{index,pixel:[x,y],areaPixels}` measured from the
actual label. This enables choosing a usable training view after filtering
content. Do not use it to guide the camera to the correct answer in Localizar.

## Real discrepancies and limits

The upstream `atlasStructure.json` points `_LabelDS` at `skin.nrrd` despite
neural selectors. This pipeline explicitly fixes the source to the verified
`hncma-atlas.nrrd`; the erroneous pointer is not followed.

Independent source surface-to-label checks flagged `spl-2`, `spl-41`, `spl-506`,
`spl-510`, `spl-1016`, `spl-3005`, `spl-3007`. They remain official surfaces for
exploration with `technicalReview: source-discrepancy`, and must be excluded from
the evaluative bank and claims of exact surface-volume correspondence. Examples:
label 41 includes five remote voxels outside the official surface bounds plus
2 mm; fornix surfaces show point-to-label-center differences exceeding 6 mm.
All per-asset measurements are in `validation.json`.

`technicalReview: verified` means provenance, coordinates, source-label samples
and geometry integrity have passed technical checks; **human anatomical review
is pending for all assets**. Source smoothing produces some small boundary
differences even for passing surfaces. The current conservative automatic limits
are <4 mm discrepancy of full label vs. surface bounds and <3 mm maximum distance
of sampled surface points to the nearest corresponding label voxel center.
These checks validate registration and catch mismatches; they do not validate
clinical anatomy or prove pointwise equality of a smoothed mesh and voxels.

The label names for residual pons/midbrain and subdivided cortical parcels must
not be promoted to a complete organ by translation. Complementary data are not
registered by inference. Preserve known coverage gaps in the app.

## License and attribution

Redistribution is under 3D Slicer License 1.0, Part B, with applicable Part C.
The full license, required preface, attribution and modification notice must
accompany public assets and user documentation. `licenses/SLICER-LICENSE.txt`
is included in the generated public output. The full license source is fixed to
Slicer commit `4666f3bea633b27a517e0e3ee0f7c0f5917cfe24` and hashed in the lock.
The app must link to it in its reference/credits view. Do not replace the data
license with the frontend code license or use institutional logos/endorsement.

Primary sources:
- https://www.openanatomy.org/atlas-pages/atlas-spl-nac-brain.html
- https://github.com/mhalle/spl-brain-atlas/tree/bec24db25aad5f7600e2df3becfb1f883e61ff56
- https://www.openanatomy.org/atlas-pages/slicer-license.html
- https://slicer.readthedocs.io/en/latest/user_guide/coordinate_systems.html
