# Google Earth Engine asset manifest

The public scripts refer to the following assets. Before DOI release, each asset must be readable by other Earth Engine users (for example, shared publicly / "Anyone can read").

## Core inputs

- `projects/ee-odebsconstant/assets/PortPhillipBay` — study boundary.
- `projects/ee-odebsconstant/assets/BathyTerrainVars_10m` — bathymetric/terrain predictor stack.
- `projects/ee-odebsconstant/assets/PPB_training_polygons_with_original_IDs` — consolidated 9-class training/reference features. Verified: 81 features with class counts 6, 5, 3, 11, 5, 7, 30, 7, 7 for classes 0–8.
- `projects/ee-odebsconstant/assets/PPB_training_polygons_with_CV_folds` — frozen original polygon-CV partition.
- `projects/ee-odebsconstant/assets/PPB_training_pixels_original_split` — frozen sampled predictor table and original 70/30 split used by the main classifier.

## Annual classified products used by the dashboard

- `projects/ee-odebsconstant/assets/PPB_Classified_2016_2`
- `projects/ee-odebsconstant/assets/PPB_Classified_2017_2`
- `projects/ee-odebsconstant/assets/PPB_Classified_2018_2`
- `projects/ee-odebsconstant/assets/PPB_Classified_2019_2`
- `projects/ee-odebsconstant/assets/PPB_Classified_2020_2`
- `projects/ee-odebsconstant/assets/PPB_Classified_2021_2`
- `projects/ee-odebsconstant/assets/PPB_Classified_2022_2`
- `projects/ee-odebsconstant/assets/PPB_Classified_2023_2`
- `projects/ee-odebsconstant/assets/PPB_Classified_2024_2`
- `projects/ee-odebsconstant/assets/PPB_Classified_2025_2`

These annual classified products are the archive used for dashboard display and the downstream annual-area, turbidity, sensitivity and persistence analyses. The repository also archives the smaller derived QA datasets used directly in R.
