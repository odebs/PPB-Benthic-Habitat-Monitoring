# Reproduction workflow

1. Confirm the Earth Engine assets in `gee_assets.md` are publicly readable.
2. Open `GEE/PPB_classification_and_polygon_CV.js` in the Earth Engine Code Editor and run it. Verify the 81-feature distribution and frozen polygon-CV summary against `verification_report.md` and `FINAL_GEE_REPRODUCIBILITY_TEST.md`.
3. The dashboard uses the public annual classified assets `PPB_Classified_2016_2` through `PPB_Classified_2025_2`. Open `GEE/PPB_dashboard.js` in Earth Engine to reproduce the interactive application.
4. From the repository root, run `R/PPB_validation_temporal_QA_analysis.R`. The script reads only repository-relative paths and writes derived tables/figures to `outputs/`.
5. The archived QA CSV/TIFF files are the actual inputs used for the manuscript. They are retained rather than replacing them with later reconstructed QA code that did not exactly reproduce the reported values.
