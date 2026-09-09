# Third-party anatomical data

NeuroGame distributes modified derivatives of the SPL/NAC Brain Atlas from
`mhalle/spl-brain-atlas`, fixed to commit
`bec24db25aad5f7600e2df3becfb1f883e61ff56`. The source page is
https://www.openanatomy.org/atlas-pages/atlas-spl-nac-brain.html . This GitHub
edition has not been equated to the separate downloadable January 2017 ZIP.
The pinned repository README names its collection "SPL-PNL Brain Atlas"; it is
the repository linked by the SPL/NAC source page.

Atlas authors credited by the Open Anatomy Project: Michael Halle, Florin
Talos, Marianna Jakab, Nikos Makris, Dominic Meier, Laurence Wald, Bruce Fischl
and Ron Kikinis. Contributors include Ilwoo Lyu and Martin Styner (sulcal
curves), Samira Farough (ventricular system), George Papadimitriou (cerebellar
parcellation), and Madiha Tahir (white matter). The original project credits
NIH grants P41 EB015902, P41 RR013218 and R01 MH050740 and a Google Research
Grant. No affiliation, endorsement or human anatomical review is implied.

Changes: VTK-to-GLB conversion preserving official vertices; six surfaces derived
from their source labels; source T1 MRI resampled by its header affine into the
label grid and exported as PNG; labels losslessly encoded as integer ID PNGs;
browser delivery groups and provenance manifests added. Derivatives are not
represented as original, unmodified SPL files. Python source and exact input
hashes are supplied with this project.

The 3D Slicer Contribution and Software License Agreement, Version 1.0,
December 20, 2005, applies to these data. Its terms, including Part B and Part C,
are reproduced in the public `anatomy/licenses/SLICER-LICENSE.txt` file and apply
to these derivatives and copies of them. That file must accompany redistribution.

All or portions of this licensed product (such portions are the “Software”) have
been obtained under license from The Brigham and Women's Hospital, Inc. and are
subject to the terms and conditions in the accompanying SLICER-LICENSE.txt.

This educational beta is not a clinical decision product. The original license
states that clinical applications are neither recommended nor advised.

The academic PDFs supplied privately for this project and their extracted
images are not distributed as part of these assets.

## Fonts

DM Sans: Copyright 2014 The DM Sans Project Authors (https://github.com/googlefonts/dm-fonts).
Manrope: Copyright 2019 The Manrope Project Authors (https://github.com/sharanda/manrope).
Both are redistributed from Fontsource 5.3.0 under SIL Open Font License 1.1.
The complete licenses accompany the built site in licenses/DM-Sans-OFL.txt and licenses/Manrope-OFL.txt.
Fonts are served locally; the study interface does not depend on Google Fonts requests.
