# Data dictionary and provenance

## `data/validation/validation_2025_4.csv`
Independent 2025 validation export used by the R validation workflow. The archived file has 772 rows before harmonisation. The reported nine-class assessment excludes original field codes 6 and 8 and removes Built-up (code 3), leaving 609 observations. This reproduces overall accuracy 66.2% and Kappa 0.612. The 609-observation matrix comprises the field-survey component plus additional independent reference observations required to complete the nine-class assessment.

## `data/annual/annual_areas2.csv`
Annual mapped class areas (ha), 2016–2025, used for trajectory, interannual variability and turbidity analyses.

## `data/annual/annual_turbidity.csv`
Archived annual Red/Green turbidity proxy values used in the reported R analysis. This file, rather than a later reconstructed GEE QA block, is the authoritative analytical input for the manuscript turbidity correlations.

## `data/sensitivity/sensitivity2_2016.csv`, `sensitivity2_2019.csv`, `sensitivity2_2023.csv`
Archived median-versus-25th-percentile compositing sensitivity outputs actually used in R. Each file contains 18 rows (9 classes × 2 compositing methods).

## `data/persistence/persistence_by_class2.csv`
Per-class classification-persistence summary used for the supplementary persistence table. Fields include mean persistence and the proportion of pixels with persistence >8 years.

## Persistence rasters
- `PPB_Persistence_Map_2016_2025_2.tif` — number of years (out of ten) that each pixel matched its modal class.
- `PPB_Modal_Class_Map_2016_2025_2.tif` — modal mapped class for each pixel over 2016–2025.

The TIFFs are the raster inputs used by the R code for the persistence/modal-class supplementary figure.
