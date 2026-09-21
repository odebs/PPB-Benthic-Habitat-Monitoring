# Verification report

The archived analytical inputs in this release were checked against the values reported in the manuscript/supplement and against the final public-script reproducibility run.

## Independent validation
After applying the manuscript harmonisation/exclusion rules, `validation_2025_4.csv` yields **609** observations, overall accuracy **0.66174 (66.2%)**, and Kappa **0.61240**.

## Compositing sensitivity
The three archived sensitivity CSVs reproduce the reported mean absolute / maximum absolute percent differences, including:

- Deep water: **2.16% / 4.57%**
- Sub-canopy brown algae & Caulerpa: **58.95% / 88.63%**
- Seaweed on sediment: **31.22% / 83.58%**
- Rocky reef: **25.02% / 61.88%**
- Sediment: **1.92% / 4.81%**

## Turbidity
The archived `annual_turbidity.csv` reproduces the reported Spearman rank coefficients when analysed with the repository R workflow, including approximately **ρ = −0.648** for seagrass, **ρ = 0.673** for sediment, and **ρ = −0.491** for Sub-canopy brown algae & Caulerpa.

## Classification persistence
`persistence_by_class2.csv` reproduces the reported class-level persistence values, including Deep water **9.74 / 0.94**, Sediment **8.84 / 0.69**, Seagrass **8.40 / 0.64**, Sub-canopy brown algae & Caulerpa **5.42 / 0.07**, Ecklonia–Phyllospora **6.03 / 0.17**, and Seaweed on sediment **6.82 / 0.23** (mean persistence years / proportion >8 years, rounded).

## Polygon cross-validation
The locked public GEE workflow uses 81 frozen reference features, the exact saved fold allocation (30/27/24), and the frozen original sampled predictor table/split. It was run twice, unchanged, in a blank Earth Engine Code Editor and produced a consistent final benchmark of mean OA **0.809282 (82.1%)**, mean Kappa **0.725**, SD OA **0.046550 (5.7 percentage points)**, and SD Kappa **0.072**. This is the repository reproducibility benchmark that should be used when reconciling the manuscript, supplement, response letter, and dashboard text.


## Reproducibility note
Minor rerun variation can occur because the historical Random Forest workflow was not fully seeded. This run-to-run variation is distinct from the reported three-fold CV standard deviation and should not be added as an extra uncertainty term.
