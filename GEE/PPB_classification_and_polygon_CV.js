// ============================================================================
// PORT PHILLIP BAY BENTHIC HABITAT MONITORING — CLASSIFICATION + POLYGON CV
// Public reproducibility version
// ============================================================================
// The classification and polygon-CV computational blocks below are copied from
// the final working Earth Engine editor workflow. The only structural change is
// replacement of the nine Code Editor Imports with the consolidated table asset
// PPB_polygon_samples_type2. Stale comments/display labels were corrected only.
//
// IMPORTANT: Do not alter RF settings, predictor order, dates, sampling scale,
// fold allocation seeds, or the explicit CV RF seed when reproducing the study.
// ============================================================================

// ============================================================================
// PUBLIC REFERENCE-POLYGON ASSET
// Verified distribution: 81 polygons across 9 classes
// 0:6, 1:5, 2:3, 3:11, 4:5, 5:7, 6:30, 7:7, 8:7
// ============================================================================
var PPB_polygon_samples_type2 = ee.FeatureCollection(
  'projects/ee-odebsconstant/assets/PPB_training_polygons_with_original_IDs'
);

// Re-create the nine collections used by the original working editor.
// This lets the computational code below remain unchanged.
var Deep_water = PPB_polygon_samples_type2.filter(ee.Filter.eq('class_num', 0));
var Sub_canopy_brown_and_Caulerpa_Biotope = PPB_polygon_samples_type2.filter(ee.Filter.eq('class_num', 1));
var Ecklonia_Phyllospora_Communities = PPB_polygon_samples_type2.filter(ee.Filter.eq('class_num', 2));
var Sublittoral_Seagrass_Beds = PPB_polygon_samples_type2.filter(ee.Filter.eq('class_num', 3));
var Sublittoral_SeaweedCommunities_onSediment = PPB_polygon_samples_type2.filter(ee.Filter.eq('class_num', 4));
var RockyReef = PPB_polygon_samples_type2.filter(ee.Filter.eq('class_num', 5));
var Sediment = PPB_polygon_samples_type2.filter(ee.Filter.eq('class_num', 6));
var Shoreline_veg = PPB_polygon_samples_type2.filter(ee.Filter.eq('class_num', 7));
var Bare_rocks = PPB_polygon_samples_type2.filter(ee.Filter.eq('class_num', 8));

print('Public training polygons:', PPB_polygon_samples_type2.size());
print('Public training distribution:', PPB_polygon_samples_type2.aggregate_histogram('class_num'));

// //////////////////////////////////////////////////MAIN CODE START///////////////////////////////////////////////////////////


// ===================================================================
// PORT PHILLIP BAY BENTHIC CLASSIFICATION (2025, 9 CLASSES)
// Author: Omosalewa Odebiri (Deakin University)
// Date: Oct 2025
// Purpose: Single-year classification using vegetation indices + bathymetry
// ===================================================================

// =============================
// REGION OF INTEREST
// =============================
var ROI2 = ee.FeatureCollection("projects/ee-odebsconstant/assets/PortPhillipBay");

// =============================
// LOAD SENTINEL-2 COMPOSITE (Feb–Apr 2025)
// =============================
var trainComposite = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
  .filterDate('2025-02-01', '2025-04-30')
  .filterBounds(ROI2)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .median()
  .clip(ROI2);

// =============================
// ADD BATHYMETRY VARIABLES
// =============================
var bathy = ee.Image("projects/ee-odebsconstant/assets/BathyTerrainVars_10m");

// =============================
// FUNCTION: ADD INDICES
// =============================
function addIndices(image) {
  var ndvi = image.normalizedDifference(['B8','B4']).rename('NDVI');
  var ndwi = image.normalizedDifference(['B3','B8']).rename('NDWI');
  var mndwi = image.normalizedDifference(['B3','B11']).rename('MNDWI');
  var evi = image.expression(
    '2.5 * ((NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1))',
    {NIR:image.select('B8'), RED:image.select('B4'), BLUE:image.select('B2')}
  ).rename('EVI');
  var savi = image.expression(
    '((NIR - RED) / (NIR + RED + 0.5)) * 1.5',
    {NIR:image.select('B8'), RED:image.select('B4')}
  ).rename('SAVI');
  var bsi = image.expression(
    '((SWIR + RED) - (NIR + BLUE)) / ((SWIR + RED) + (NIR + BLUE))',
    {SWIR:image.select('B11'), RED:image.select('B4'),
    NIR:image.select('B8'), BLUE:image.select('B2')}
  ).rename('BSI');
  var blue_green = image.select('B2').divide(image.select('B3')).rename('Blue_Green');
  var green_red  = image.select('B3').divide(image.select('B4')).rename('Green_Red');
  var nir_red    = image.select('B8').divide(image.select('B4')).rename('NIR_Red');
  var fai = image.expression(
    'NIR - (RED + (SWIR - RED) * (NIRw - REDw) / (SWIRw - REDw))',
    {NIR:image.select('B8'), RED:image.select('B4'),
    SWIR:image.select('B11'), NIRw:842, REDw:665, SWIRw:1610}
  ).rename('FAI');
  var awei_nsh = image.expression(
    '4*(GREEN - SWIR1) - (0.25*NIR + 2.75*SWIR2)',
    {GREEN:image.select('B3'), NIR:image.select('B8'),
    SWIR1:image.select('B11'), SWIR2:image.select('B12')}
  ).rename('AWEInsh');
  return image.addBands([ndvi, ndwi, mndwi, evi, savi, bsi,
                        blue_green, green_red, nir_red, fai, awei_nsh]);
}

// =============================
// ADD INDICES + BATHY TO IMAGE
// =============================
var predictorImage = addIndices(trainComposite)
  .addBands(bathy);

// =============================
// VISUALIZE TRUE COLOR IMAGE
// =============================
var visParams = {
  bands: ['B4', 'B3', 'B2'],
  min: 0,
  max: 3000,
  gamma: 1.4
};
Map.centerObject(ROI2, 10);
Map.addLayer(trainComposite, visParams, 'True-color (2025)');

// =============================
// ASSIGN CLASS NUMBERS (9 CLASSES)
// =============================
var Deep_water = Deep_water.map(function(f){ return f.set('class_num', 0); });
var Sub_canopy_brown_and_Caulerpa_Biotope = Sub_canopy_brown_and_Caulerpa_Biotope.map(function(f){ return f.set('class_num', 1); });
var Ecklonia_Phyllospora_Communities = Ecklonia_Phyllospora_Communities.map(function(f){ return f.set('class_num', 2); });
var Sublittoral_Seagrass_Beds = Sublittoral_Seagrass_Beds.map(function(f){ return f.set('class_num', 3); });
var Sublittoral_SeaweedCommunities_onSediment = Sublittoral_SeaweedCommunities_onSediment.map(function(f){ return f.set('class_num', 4); });
var RockyReef = RockyReef.map(function(f){ return f.set('class_num', 5); });
var Sediment = Sediment.map(function(f){ return f.set('class_num', 6); });
var Shoreline_veg = Shoreline_veg.map(function(f){ return f.set('class_num', 7); });
var Bare_rocks = Bare_rocks.map(function(f){ return f.set('class_num', 8); });



// Merge all
var samples = Deep_water
  .merge(Sub_canopy_brown_and_Caulerpa_Biotope)
  .merge(Ecklonia_Phyllospora_Communities)
  .merge(Sublittoral_Seagrass_Beds)
  .merge(Sublittoral_SeaweedCommunities_onSediment)
  .merge(RockyReef)
  .merge(Sediment)
  .merge(Shoreline_veg)
  .merge(Bare_rocks);

print('✅ Total samples:', samples.size());
print('✅ Class distribution:', samples.aggregate_histogram('class_num'));

// =============================
// DEFINE CLASS COLORS
// =============================
var palette = [
  '#0000FF', // Deep_water
  '#00FF00', // Sub_canopy_brown_and_Caulerpa_Biotope
  '#8B4513', // Ecklonia_Phyllospora_Communities
  '#228B22', // Sublittoral_Seagrass_Beds
  '#FFD700', // Sublittoral_SeaweedCommunities_onSediment
  '#00CED1', // RockyReef
  '#C2B280', // Sediment
  '#a9c994',  // Shoreline_veg
  '#000000'  // Bare_rocks
];
var classNames = [
  'Deep_water','Sub_canopy_brown_and_Caulerpa_Biotope','Ecklonia_Phyllospora_Communities',
  'Sublittoral_Seagrass_Beds','Sublittoral_SeaweedCommunities_onSediment',
  'RockyReef','Sediment','Shoreline_veg','Bare_rocks'
];

// =============================
// SELECT BANDS (Spectral + Indices + Bathy)
// =============================
var selectedBands = [
  'B2','B3','B4','B5','B6','B7','B8','B8A','B11','B12',
  'NDVI','NDWI','MNDWI','EVI','SAVI','BSI','FAI','AWEInsh',
  'Blue_Green','Green_Red','NIR_Red',
  'Slope','Aspect','Rugosity','Ruggedness','Depth','Relief',
  'TPI_100','TPI_25','TPI_5'
];

// ============================================================================
// FROZEN ORIGINAL PIXEL TRAINING / TEST SAMPLE
// ============================================================================
// This table was exported directly from the original working editor AFTER
// sampleRegions() and randomColumn('random'). It therefore preserves the
// predictor values, class_num labels, and exact 70/30 split values used by
// the original workflow. Placeholder geometry was added only to permit the
// Earth Engine table export; geometry is not used by the Random Forest.
//
// Do NOT resample the polygons or create a new random column here.
var trainingData = ee.FeatureCollection(
  'projects/ee-odebsconstant/assets/PPB_training_pixels_original_split'
);

print('Frozen pixel samples:', trainingData.size());
print(
  'Frozen pixel class distribution:',
  trainingData.aggregate_histogram('class_num')
);

// Re-use the original split values exactly.
var trainSet = trainingData.filter(ee.Filter.lt('random', 0.7));
var testSet  = trainingData.filter(ee.Filter.gte('random', 0.7));

print('Frozen train-set size:', trainSet.size());
print('Frozen test-set size:', testSet.size());


// =============================
// RANDOM FOREST CLASSIFIER
// =============================
var classifier = ee.Classifier.smileRandomForest(50).train({
  features: trainSet,
  classProperty: 'class_num',
  inputProperties: selectedBands
});

// =============================
// APPLY CLASSIFICATION
// =============================

// Force the classified image to use Sentinel-2 UTM projection (Zone 55S)


var classified = predictorImage.select(selectedBands).classify(classifier);
var visClass = {min: 0, max: 8, palette: palette};
Map.addLayer(classified, visClass, 'Classified (2025)');


// =============================
// ACCURACY ASSESSMENT
// =============================
var validated = testSet.classify(classifier);
var confusionMatrix = validated.errorMatrix('class_num', 'classification');
print('🧾 Confusion Matrix:', confusionMatrix);
print('✅ Overall Accuracy:', confusionMatrix.accuracy());
print('✅ Producer Accuracy:', confusionMatrix.producersAccuracy());
print('✅ Consumer Accuracy:', confusionMatrix.consumersAccuracy());
print('✅ Kappa Coefficient:', confusionMatrix.kappa());



// =============================
// VARIABLE IMPORTANCE
// =============================
var dictImportance = classifier.explain();
var importanceDict = ee.Dictionary(dictImportance.get('importance'));
var importanceFeature = ee.Feature(null, importanceDict);
var chart = ui.Chart.feature.byProperty(ee.FeatureCollection([importanceFeature]))
  .setChartType('ColumnChart')
  .setOptions({
    title: 'Variable Importance (Broader Classification)',
    legend: {position: 'none'},
    hAxis: {title: 'Predictors'},
    vAxis: {title: 'Importance'}
  });
print(chart);


// =============================
// VARIABLE IMPORTANCE – Clean Console Output + Sorted Table
// =============================
var dictImportance = classifier.explain();
var importanceDict = ee.Dictionary(dictImportance.get('importance'));

// Extract keys (variable names)
var keys = importanceDict.keys();

// Convert each variable into a Feature
var importanceList = keys.map(function (k) {
  k = ee.String(k);
  var v = ee.Number(importanceDict.get(k));
  return ee.Feature(null, { 'Variable': k, 'Importance': v });
});

// Convert to FeatureCollection and sort descending
var importanceTable = ee.FeatureCollection(importanceList).sort('Importance', false);

// =============================
// Print as readable ranked list
// =============================

// Convert FeatureCollection → List for simple console output
var sortedList = importanceTable.aggregate_array('Variable')
  .zip(importanceTable.aggregate_array('Importance'));

// Map to readable strings like "Depth — 816.3"
var readableList = sortedList.map(function (pair) {
  pair = ee.List(pair);
  var variable = ee.String(pair.get(0));
  var value = ee.Number(pair.get(1)).format('%.2f');
  return variable.cat(' — ').cat(value);
});

// Print clean readable summary
print('📊 Variable Importance (Descending Order):');
readableList.evaluate(function (list) {
list.forEach(function (item) { print(item); });
});

// Still print FeatureCollection for detailed table / export
print('Variable Importance Table:', importanceTable);


// =============================
// AREA PER CLASS (ha)
// =============================

// Convert each pixel to area (ha) and attach class band
var areaImage = ee.Image.pixelArea()
  .divide(10000) // m² → hectares
  .rename('area_ha')
  .addBands(classified.rename('class_num'));

// Reduce region by class
var areas = areaImage.reduceRegion({
  reducer: ee.Reducer.sum().group({
    groupField: 1,       // index of 'class_num' band
    groupName: 'class_num'
  }),
  geometry: ROI2,
  scale: 10,
  maxPixels: 1e13
});

print('Raw grouped area dictionary:', areas);

// Convert JS array → ee.List for server-side use
var classNamesList = ee.List(classNames);

// Convert grouped dictionary → FeatureCollection
var classAreas = ee.List(areas.get('groups')).map(function (item) {
  item = ee.Dictionary(item);

  var classNum = ee.Number(item.get('class_num'));  // 0–8
  var area = ee.Number(item.get('sum'));            // area in ha

  var className = classNamesList.get(classNum);     // ✅ now valid

  return ee.Feature(null, {
    'class_num': classNum,
    'class_name': className,
    'area_ha': area
  });
});

var areaFC = ee.FeatureCollection(classAreas);
print('Area per class (ha):', areaFC);

// -----------------------------
// AREA CHART
// -----------------------------
var areaChart = ui.Chart.feature.byFeature({
  features: areaFC,
  xProperty: 'class_name',
  yProperties: ['area_ha']
})
.setChartType('ColumnChart')
.setOptions({
  title: 'Area per Class (ha)',
  hAxis: {title: 'Class'},
  vAxis: {title: 'Area (ha)'},
  colors: palette
});

print(areaChart);


// =============================
//LEGEND 
// =============================
var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px',
    backgroundColor: 'white'
  }
});
legend.add(ui.Label('Legend (9 Classes)', {fontWeight: 'bold'}));

// ✅ classNames is a JS array, so loop directly
classNames.forEach(function(name, idx) {
  var colorBox = ui.Label('', {
    backgroundColor: palette[idx],
    padding: '8px',
    margin: '0',
    width: '20px',
    height: '20px'
  });
  var label = ui.Label(name, {margin: '0 0 0 6px'});
  var row = ui.Panel([colorBox, label], ui.Panel.Layout.Flow('horizontal'));
  legend.add(row);
});

Map.add(legend);


// =============================
// SAVE CLASSIFIED TO ASSET (FINAL FIXED VERSION)
// =============================

// Attach metadata as a string
var labeledImage = classified
  .clip(ROI2)
  .set({
    'year': 2025,
    'class_names': 'Deep_water, Sub_canopy_brown_and_Caulerpa_Biotope, Ecklonia_Phyllospora_Communities, Sublittoral_Seagrass_Beds, Sublittoral_SeaweedCommunities_onSediment, RockyReef, Sediment, Shoreline_veg, Bare_rocks'
  });

// Export.image.toAsset({
//   image: labeledImage,
//   description: 'PortPhillipBay_Classified_2016',
//   assetId: 'projects/ee-odebsconstant/assets/PPB_Classified_2016_2',
//   region: ROI2.geometry(),
//   scale: 10,
//   maxPixels: 1e13
// });


// // =============================
// // FINAL EXPORT — SAFE AND VISUALLY IDENTICAL
// // =============================

// // Force a smaller geographic projection only during export
// // (no reproject() call → avoids pixel limit)
// var labeledImage = classified
//   .toInt16()
//   .clip(ROI2)
//   .set({
//     'year': 2025,
//     'class_names': 'Deep_water, Sub_canopy_brown_and_Caulerpa_Biotope, Ecklonia_Phyllospora_Communities, Sublittoral_Seagrass_Beds, Sublittoral_SeaweedCommunities_onSediment, RockyReef, Sediment, Shoreline_veg, Bare_rocks'
//   });

// // Export to Drive in EPSG:4326 at ~10 m (0.0001°) resolution
// Export.image.toDrive({
//   image: labeledImage,
//   description: 'PPB_Classified_2025_GEEversion',
//   folder: 'PortPhillipBay_Exports',
//   fileNamePrefix: 'PPB_Classified_2025_111',
//   region: ROI2.geometry(),
//   scale: 10,
//   crs: 'EPSG:4326',   // ✅ display-aligned with GEE
//   maxPixels: 1e13
// });


// // Additioanl training points
// var pts = ee.FeatureCollection("projects/ee-odebsconstant/assets/Extra_Training_points");

// // Split by class
// var sedimentPts = pts.filter(ee.Filter.eq('Class', 'Sediment'));
// var seagrassPts = pts.filter(ee.Filter.eq('Class', 'Seagrass'));

// // Display
// Map.addLayer(sedimentPts, {color: 'brown'}, 'Sediment Points');
// Map.addLayer(seagrassPts, {color: 'green'}, 'Seagrass Points');

// // Center map
// Map.centerObject(pts, 11);


////////////////////////////////////////////////MAIN CODE END//////////////////////////////////////////////////////


// DATE 10/09/2026
// ////// NEW ANALYSIS TRIAL FOR PPB TO SOLVE SPATIAL AUTOCORRELATION IN RESPONSE TO REVIEWER 2 ECOLOGICAL INFORMATICS PAPER

// ============================================================================
// PORT PHILLIP BAY
// 3-FOLD CLASS-STRATIFIED POLYGON-LEVEL CROSS-VALIDATION
//
// PURPOSE:
// Independent spatial validation of the existing 2025 classification framework.
//
// IMPORTANT:
// - Uses the SAME reference FeatureCollections as the original classification.
// - Uses the SAME Sentinel-2 collection.
// - Uses the SAME February-April temporal window.
// - Uses the SAME predictors.
// - Uses the SAME 50-tree Random Forest.
// - DOES NOT generate or replace the original habitat map.
// - DOES NOT export anything.
// - The only major change is the validation design:
//   whole polygons are assigned to one of three folds.
// ============================================================================


// ============================================================================
// 1. REGION OF INTEREST
// ============================================================================

var ROI2 = ee.FeatureCollection(
  "projects/ee-odebsconstant/assets/PortPhillipBay"
);


// ============================================================================
// 2. SENTINEL-2 COMPOSITE — EXACTLY AS USED IN ORIGINAL WORKFLOW
// ============================================================================

var trainComposite = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
  .filterDate('2025-02-01', '2025-04-30')
  .filterBounds(ROI2)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
  .median()
  .clip(ROI2);


// ============================================================================
// 3. BATHYMETRIC / TERRAIN VARIABLES
// ============================================================================

var bathy = ee.Image(
  "projects/ee-odebsconstant/assets/BathyTerrainVars_10m"
);


// ============================================================================
// 4. SPECTRAL INDICES — SAME AS ORIGINAL CLASSIFICATION
// ============================================================================

function addIndices(image) {

  var ndvi = image
    .normalizedDifference(['B8', 'B4'])
    .rename('NDVI');

  var ndwi = image
    .normalizedDifference(['B3', 'B8'])
    .rename('NDWI');

  var mndwi = image
    .normalizedDifference(['B3', 'B11'])
    .rename('MNDWI');

  var evi = image.expression(
    '2.5 * ((NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1))',
    {
      NIR: image.select('B8'),
      RED: image.select('B4'),
      BLUE: image.select('B2')
    }
  ).rename('EVI');

  var savi = image.expression(
    '((NIR - RED) / (NIR + RED + 0.5)) * 1.5',
    {
      NIR: image.select('B8'),
      RED: image.select('B4')
    }
  ).rename('SAVI');

  var bsi = image.expression(
    '((SWIR + RED) - (NIR + BLUE)) / ' +
    '((SWIR + RED) + (NIR + BLUE))',
    {
      SWIR: image.select('B11'),
      RED: image.select('B4'),
      NIR: image.select('B8'),
      BLUE: image.select('B2')
    }
  ).rename('BSI');

  var blue_green = image
    .select('B2')
    .divide(image.select('B3'))
    .rename('Blue_Green');

  var green_red = image
    .select('B3')
    .divide(image.select('B4'))
    .rename('Green_Red');

  var nir_red = image
    .select('B8')
    .divide(image.select('B4'))
    .rename('NIR_Red');

  var fai = image.expression(
    'NIR - (RED + (SWIR - RED) * ' +
    '(NIRw - REDw) / (SWIRw - REDw))',
    {
      NIR: image.select('B8'),
      RED: image.select('B4'),
      SWIR: image.select('B11'),
      NIRw: 842,
      REDw: 665,
      SWIRw: 1610
    }
  ).rename('FAI');

  var awei_nsh = image.expression(
    '4*(GREEN - SWIR1) - (0.25*NIR + 2.75*SWIR2)',
    {
      GREEN: image.select('B3'),
      NIR: image.select('B8'),
      SWIR1: image.select('B11'),
      SWIR2: image.select('B12')
    }
  ).rename('AWEInsh');

  return image.addBands([
    ndvi,
    ndwi,
    mndwi,
    evi,
    savi,
    bsi,
    blue_green,
    green_red,
    nir_red,
    fai,
    awei_nsh
  ]);
}


// ============================================================================
// 5. COMPLETE PREDICTOR IMAGE
// ============================================================================

var predictorImage = addIndices(trainComposite)
  .addBands(bathy);


// ============================================================================
// 6. ASSIGN THE SAME NINE CLASS NUMBERS USED IN ORIGINAL ANALYSIS
//
// These nine FeatureCollections must be imported into this script exactly
// as they were imported in your original classification script.
// ============================================================================

Deep_water =
  Deep_water.map(function(f) {
    return f.set('class_num', 0);
  });

Sub_canopy_brown_and_Caulerpa_Biotope =
  Sub_canopy_brown_and_Caulerpa_Biotope.map(function(f) {
    return f.set('class_num', 1);
  });

Ecklonia_Phyllospora_Communities =
  Ecklonia_Phyllospora_Communities.map(function(f) {
    return f.set('class_num', 2);
  });

Sublittoral_Seagrass_Beds =
  Sublittoral_Seagrass_Beds.map(function(f) {
    return f.set('class_num', 3);
  });

Sublittoral_SeaweedCommunities_onSediment =
  Sublittoral_SeaweedCommunities_onSediment.map(function(f) {
    return f.set('class_num', 4);
  });

RockyReef =
  RockyReef.map(function(f) {
    return f.set('class_num', 5);
  });

Sediment =
  Sediment.map(function(f) {
    return f.set('class_num', 6);
  });

Shoreline_veg =
  Shoreline_veg.map(function(f) {
    return f.set('class_num', 7);
  });

Bare_rocks =
  Bare_rocks.map(function(f) {
    return f.set('class_num', 8);
  });


// ============================================================================
// 7. PREDICTOR LIST — SAME AS ORIGINAL ANALYSIS
// ============================================================================

var selectedBands = [
  'B2',
  'B3',
  'B4',
  'B5',
  'B6',
  'B7',
  'B8',
  'B8A',
  'B11',
  'B12',

  'NDVI',
  'NDWI',
  'MNDWI',
  'EVI',
  'SAVI',
  'BSI',
  'FAI',
  'AWEInsh',

  'Blue_Green',
  'Green_Red',
  'NIR_Red',

  'Slope',
  'Aspect',
  'Rugosity',
  'Ruggedness',
  'Depth',
  'Relief',

  'TPI_100',
  'TPI_25',
  'TPI_5'
];


// ============================================================================
// 8–9. FROZEN ORIGINAL POLYGON-CV PARTITION
// ============================================================================
// Exact cv_fold values exported from the original working Earth Engine editor.
// Do not regenerate folds in the public reproducibility script.

var cvPolygons = ee.FeatureCollection(
  'projects/ee-odebsconstant/assets/PPB_training_polygons_with_CV_folds'
);

print('Frozen CV polygons:', cvPolygons.size());
print('Frozen fold distribution:', cvPolygons.aggregate_histogram('cv_fold'));

// Expected: 81 features; folds 0/1/2 = 30/27/24.
// ============================================================================

// ============================================================================
// 10. MERGE ALL FOLDED POLYGONS
// ============================================================================



print(
  'Total reference polygons:',
  cvPolygons.size()
);

print(
  'Polygons per habitat class:',
  cvPolygons.aggregate_histogram('class_num')
);

print(
  'Polygons assigned to each fold:',
  cvPolygons.aggregate_histogram('cv_fold')
);


// ============================================================================
// 11. CHECK EACH CLASS × FOLD COMBINATION
//
// This is important because we want every habitat class represented
// in every validation fold.
// ============================================================================

print('------------------------------------------------');
print('POLYGON COUNTS BY CLASS AND FOLD');
print('------------------------------------------------');

for (var c = 0; c < 9; c++) {

  var thisClass =
    cvPolygons.filter(
      ee.Filter.eq('class_num', c)
    );

  print(
    'Class ' + c + ' fold distribution:',
    thisClass.aggregate_histogram('cv_fold')
  );
}


// ============================================================================
// 12. EXTRACT PREDICTOR VALUES
//
// Crucially, cv_fold is copied from each WHOLE polygon to every sampled pixel.
// geometries:false reduces memory use.
// ============================================================================

var allSamples =
  predictorImage
    .select(selectedBands)
    .sampleRegions({
      collection: cvPolygons,
      properties: [
        'class_num',
        'cv_fold'
      ],
      scale: 10,
      geometries: false,
      tileScale: 4
    });


print(
  'Total sampled pixels:',
  allSamples.size()
);

print(
  'Total sample distribution by class:',
  allSamples.aggregate_histogram('class_num')
);


// ============================================================================
// 13. CLASS ORDER
//
// Supplying an explicit order ensures every confusion matrix is 9 × 9.
// ============================================================================

var classOrder =
  ee.List.sequence(0, 8);


// ============================================================================
// 14. CROSS-VALIDATION FUNCTION
//
// For each iteration:
// - ONE entire polygon fold is withheld.
// - The other TWO folds train the RF.
// - Predictions are generated ONLY for the held-out fold.
// ============================================================================

function runFold(foldNumber) {

  foldNumber = ee.Number(foldNumber);

  var trainSet =
    allSamples.filter(
      ee.Filter.neq(
        'cv_fold',
        foldNumber
      )
    );

  var testSet =
    allSamples.filter(
      ee.Filter.eq(
        'cv_fold',
        foldNumber
      )
    );


  // SAME RF configuration as original workflow.
  var classifier =
    ee.Classifier
      .smileRandomForest(50, null, 1, 0.5, null, 1234)
      .train({
        features: trainSet,
        classProperty: 'class_num',
        inputProperties: selectedBands
      });


  var validated =
    testSet.classify(classifier);


  var matrix =
    validated.errorMatrix(
      'class_num',
      'classification',
      classOrder
    );


  // Create one summary feature for this fold.
  return ee.Feature(
    null,
    {
      fold: foldNumber.add(1),

      training_samples:
        trainSet.size(),

      validation_samples:
        testSet.size(),

      overall_accuracy:
        matrix.accuracy(),

      kappa:
        matrix.kappa()
    }
  );
}


// ============================================================================
// 15. RUN ALL THREE FOLDS
// ============================================================================

var foldResults =
  ee.FeatureCollection([
    runFold(0),
    runFold(1),
    runFold(2)
  ]);


print('================================================');
print('3-FOLD POLYGON CROSS-VALIDATION SUMMARY');
print('================================================');

print(
  'Fold summary table:',
  foldResults
);


// ============================================================================
// 16. MEAN OVERALL ACCURACY AND KAPPA
// ============================================================================

print(
  'Mean polygon-CV overall accuracy:',
  foldResults.aggregate_mean(
    'overall_accuracy'
  )
);

print(
  'Mean polygon-CV Kappa:',
  foldResults.aggregate_mean(
    'kappa'
  )
);


// ============================================================================
// 17. STANDARD DEVIATION ACROSS FOLDS
// ============================================================================

print(
  'SD overall accuracy:',
  foldResults.aggregate_total_sd(
    'overall_accuracy'
  )
);

print(
  'SD Kappa:',
  foldResults.aggregate_total_sd(
    'kappa'
  )
);
