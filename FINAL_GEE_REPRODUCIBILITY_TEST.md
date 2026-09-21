# Final GEE reproducibility verification — LOCKED RELEASE

The public Google Earth Engine script was run twice, unchanged, in a blank Code Editor.
Both runs were consistent.

## Structural checks passed

- Public training/reference features: 81
- Class counts: 6, 5, 3, 11, 5, 7, 30, 7, 7
- Frozen pixel samples: 211,151
- Frozen train-set size: 147,676
- Frozen test-set size: 63,475
- Internal confusion matrix: 9 x 9
- Frozen CV reference features: 81
- Frozen CV fold counts: 30, 27, 24
- CV sampled pixels: 211,153

## Final reproducible blank-editor outputs

Internal held-out assessment:
- Overall accuracy: 0.9987081528160693
- Kappa: 0.9980650656702907

Three-fold frozen-partition polygon CV:
- Mean overall accuracy: 0.821
- Mean Kappa: 0.725
- SD overall accuracy: 0.057
- SD Kappa: 0.072

These values are the public-script reproducibility benchmark for this repository release.

## Important interpretation

The archived annual classified images are the authoritative map products used in the manuscript.
Minor rerun variation can occur because the historical Random Forest workflow was not fully seeded.
Re-running the Random Forest workflow can produce small numerical differences because the
historical main classifier was fitted without a fixed RF seed. The repository therefore freezes
the original sampled predictor table, original 70/30 split, and exact polygon-CV partition to
maximize reproducibility while retaining the historical workflow.

Do not regenerate the pixel split or polygon folds in the public script.
