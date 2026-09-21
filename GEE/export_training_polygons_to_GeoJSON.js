// Export the consolidated 9-class training polygons for DOI/archive backup.
var samples = ee.FeatureCollection(
  'projects/ee-odebsconstant/assets/PPB_polygon_samples_type2'
);
print('Total polygons', samples.size());
print('Class distribution', samples.aggregate_histogram('class_num'));
Export.table.toDrive({
  collection: samples,
  description: 'PPB_polygon_samples_type2',
  fileNamePrefix: 'PPB_polygon_samples_type2',
  fileFormat: 'GeoJSON'
});
