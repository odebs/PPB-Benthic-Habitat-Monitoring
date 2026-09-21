// Export the preserved 9-class training/reference features for DOI/archive backup.
var samples = ee.FeatureCollection(
  'projects/ee-odebsconstant/assets/PPB_training_polygons_with_original_IDs'
);

print('Total reference features', samples.size());
print('Class distribution', samples.aggregate_histogram('class_num'));

Export.table.toDrive({
  collection: samples,
  description: 'PPB_training_polygons_with_original_IDs',
  fileNamePrefix: 'PPB_training_polygons_with_original_IDs',
  fileFormat: 'GeoJSON'
});
