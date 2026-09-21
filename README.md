# Port Phillip Bay Benthic Habitat Monitoring (2016–2025)

This repository contains the code and derived analytical data supporting the manuscript **“Beyond Static Maps: An Operational Framework for Marine Habitat Monitoring in Southeastern Australia.”** The workflow combines annual Sentinel-2 classifications, independent validation, polygon-blocked cross-validation, error-adjusted area estimation, compositing sensitivity, turbidity diagnostics, classification persistence, and an interactive Google Earth Engine dashboard.

## Repository contents

- `GEE/PPB_classification_and_polygon_CV.js` — public standalone version of the final working 2025 classification and 3-fold polygon-level CV. It loads the verified consolidated 81-polygon reference asset and otherwise preserves the working computational logic.
- `GEE/PPB_classification_and_polygon_CV_import_reference.js` — audit reference retaining the original nine-Import computational structure.
- `GEE/PPB_dashboard.js` — interactive Port Phillip Bay benthic habitat dashboard.
- `R/PPB_validation_temporal_QA_analysis.R` — cleaned R workflow using repository-relative paths.
- `data/` — the actual archived CSV/TIFF inputs used for the reported validation and QA results.
- `documentation/verification_report.md` — numerical cross-checks against manuscript/supplement values.
- `documentation/gee_assets.md` — Earth Engine asset manifest.

## Core Earth Engine reference asset

The nine original Code Editor Imports were consolidated previously into:

`projects/ee-odebsconstant/assets/PPB_training_polygons_with_original_IDs`

It has been verified to contain **81 polygons** with class distribution **6, 5, 3, 11, 5, 7, 30, 7, 7** for classes 0–8. The public script reconstructs the nine class-specific collections by filtering this one asset, allowing it to run in a fresh Code Editor without manual Imports.

## Important provenance note for QA

The repository intentionally archives the **actual QA files used in the R analysis and manuscript** (`annual_turbidity.csv`, the three `sensitivity2_*.csv` files, `persistence_by_class2.csv`, and the two persistence/modal-class TIFFs). Later attempts to reconstruct some QA-generation blocks in GEE produced slightly different values and are therefore **not presented as the authoritative source of the reported QA statistics**.

## Independent validation

`validation_2025_4.csv` is the archived independent-validation export. The harmonisation rules in the R script yield the complete **609-observation nine-class assessment**, with OA **66.2%** and Kappa **0.612**. The 2025 field-survey component comprised 518 observations for the surveyed benthic classes; additional independent reference observations completed the nine-class assessment.

## Reproducing the analysis

See `documentation/workflow.md`. In brief: make the listed GEE assets publicly readable, run the GEE classification/CV script, run the R script from the repository root, and open the dashboard script in Earth Engine.

## Public data / classified archive

The annual classified habitat maps are referenced as public Earth Engine assets `PPB_Classified_2016_2` through `PPB_Classified_2025_2`. These assets, the ROI, bathymetry/terrain stack and consolidated reference polygons must be publicly readable before the repository DOI is cited in the manuscript.

## Citation / DOI

Version 1.0.0 is prepared for GitHub + Zenodo archival. Add the GitHub URL and Zenodo DOI to `CITATION.cff` and the manuscript Data Availability statement after the release is minted.

## License

Code is provided under the MIT License (`LICENSE-CODE`). Data licensing should be selected for the DOI deposit only after confirming compatibility with any underlying legacy/reference sources; see `DATA-LICENSE-NOTE.md`.

### Frozen training and CV assets
The public GEE workflow uses:
- `projects/ee-odebsconstant/assets/PPB_training_polygons_with_original_IDs`
- `projects/ee-odebsconstant/assets/PPB_training_polygons_with_CV_folds`

The latter stores the exact original fold assignment (30/27/24), so the public script does not regenerate folds after export/re-import.

### Frozen pixel training/test sample

The main 2025 classifier uses the archived Earth Engine table
`projects/ee-odebsconstant/assets/PPB_training_pixels_original_split`.
This table was exported directly from the original working editor after
`sampleRegions()` and `randomColumn('random')`, preserving the predictor values,
`class_num`, and original 70/30 split. A placeholder point geometry was added
only because Earth Engine table assets cannot store null geometry; model fitting
uses the feature properties, not that placeholder geometry.

## Locked release reproducibility benchmark

The public GEE workflow was tested twice without modification in a blank Code Editor and
returned consistent results. The final benchmark for the frozen three-fold polygon-CV workflow is:

- mean OA = 0.8092823 (80.9%)
- SD OA = 0.0465502 (4.7 percentage points)
- mean Kappa = 0.7054017
- SD Kappa = 0.0574253

The archived annual classified images remain the authoritative annual map products used in the
study. The original 81 reference features, sampled predictor table and 70/30 split, and CV fold
partition are preserved as separate Earth Engine assets for reproducibility.
