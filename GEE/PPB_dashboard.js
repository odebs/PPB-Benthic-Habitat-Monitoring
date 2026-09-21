// =============================================
// Port Phillip Bay Benthic Dashboard (2016-2025)
// Simplified: Pre-classified dataset version
// Author: Omosalewa Odebiri (Deakin University)  
// Date: 2025-10  
// =============================================


// Text package for Tier 3 GIF labelling
var textPkg = null;
try {
  textPkg = require('users/gena/packages:text');
} catch (err) {
  // leave textPkg = null;
}

var text = require('users/gena/packages:text');


// -----------------------------
// USER PARAMETERS & CLASS INFO
// -----------------------------
var startYear = 2016;
var endYear   = 2025;

var classInfo = [
  {name: 'Deep_water',                           color: '#0000FF'},
  {name: 'Sub_canopy_brown_and_Caulerpa_Biotope', color: '#00FF00'},
  {name: 'Ecklonia_Phyllospora_Communities',     color: '#8B4513'},
  {name: 'Sublittoral_Seagrass_Beds',            color: '#228B22'},
  {name: 'Sublittoral_SeaweedCommunities_onSediment', color: '#FFD700'},
  {name: 'RockyReef',                            color: '#00CED1'},
  {name: 'Sediment',                             color: '#C2B280'},
  {name: 'Shoreline_veg',                        color: '#a9c994'},
  {name: 'Bare_rocks',                           color: '#000000'}
];

var classNames = ee.List(classInfo.map(function(d){ return d.name; }));
var palette    = classInfo.map(function(d){ return d.color; });

var ROI = ee.FeatureCollection("projects/ee-odebsconstant/assets/PortPhillipBay");

// ============================================
// FUNCTION: Make collapsible header for any panel (auto-shrinks width)
// ============================================
function makeCollapsibleHeader(title, contentPanel, color) {
  var collapsed = false;

  // Create the header as a button
  var header = ui.Button({
    label: '▾ ' + title,
    style: {
      fontWeight: 'bold',
      color: 'black',
      backgroundColor: color || '#4A997E',
      padding: '6px 8px',
      fontSize: '13px',
      border: '1px solid #2C5E50',
      textAlign: 'left'
    },
    onClick: function() {
      collapsed = !collapsed;

      // When collapsed → hide + shrink width
      if (collapsed) {
        contentPanel.style().set({
          shown: false,
          width: '0px',
          padding: '0px'
        });
        header.setLabel('▸ ' + title);
      } else {
        // When expanded → restore width + padding
        contentPanel.style().set({
          shown: true,
          width: 'auto',
          padding: '4px'
        });
        header.setLabel('▾ ' + title);
      }
    }
  });

  // Combine header and content in a single container
  var container = ui.Panel({
    widgets: [header, contentPanel],
    layout: ui.Panel.Layout.flow('vertical'),
    style: {margin: '0', padding: '0'}
  });

  return container;
}



// =============================
// ROI INSPECTOR (Default View): Draw ROI and summarize class areas
// =============================
function buildROIInspectorPanel(mapMain, classifiedCollection, ROI) {

  // -------------------------
  // UI widgets
  // -------------------------
  var title = ui.Label('🧰 ROI Inspector (Default View)', {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '0 0 6px 0'
  });

  var help = ui.Label(
    'Draw an ROI and compute class areas inside it (for the currently visible year).\n' +
    'Outputs: total ROI area (ha), per-class area (ha), % composition (pie).',
    {fontSize: '12px', color: '#444', whiteSpace: 'pre-wrap', margin: '0 0 8px 0'}
  );

  // Active year display
  var activeYearLabel = ui.Label('Active year: (auto-detect)', {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '0 0 8px 0'
  });

  var drawModeSelect = ui.Select({
    items: ['rectangle', 'polygon'],
    value: 'rectangle',
    style: {stretch: 'horizontal'}
  });

  var statusLabel = ui.Label('Ready. Draw an ROI and click Analyze.', {
    fontSize: '11px',
    color: '#555',
    whiteSpace: 'pre-wrap',
    margin: '6px 0 0 0'
  });

  var totalAreaLabel = ui.Label('Total ROI area: (not computed)', {
    fontSize: '12px',
    margin: '6px 0 0 0'
  });

  // Output charts (created empty first, then updated on Analyze)
  var pieChartPanel = ui.Panel({style: {margin: '8px 0 0 0'}});
  var tablePanel    = ui.Panel({style: {margin: '8px 0 0 0'}});

  // -------------------------
  // Drawing tools setup
  // -------------------------
  var drawTools = mapMain.drawingTools();
  drawTools.setShown(true);
  drawTools.setDrawModes(['rectangle', 'polygon']);

  function clearDrawingLayers() {
    // Remove all drawn layers
    var layers = drawTools.layers();
    while (layers.length() > 0) {
      layers.remove(layers.get(0));
    }
  }

  function setDrawMode(mode) {
    // Start drawing the selected mode
    drawTools.setShape(mode);
  }

  // -------------------------
  // Helper: detect active year from visible layer name
  // -------------------------
  function getActiveYearFromVisibleLayer() {
    var activeYear = null;

    mapMain.layers().forEach(function(layer) {
      var nm = String(layer.getName());
      // expecting: "Classified 2025" etc.
      if (layer.getShown() && nm.indexOf('Classified ') === 0) {
        var parts = nm.split(' ');
        var y = parseInt(parts[1], 10);
        if (!isNaN(y)) activeYear = y;
      }
    });

    return activeYear; // can be null if nothing visible
  }

  // -------------------------
  // Helper: get drawn ROI geometry
  // -------------------------
  function getDrawnGeometry() {
    var layers = drawTools.layers();
    if (layers.length() === 0) return null;

    // Use first drawn geometry
    var geom = layers.get(0).getEeObject();

    // Optional safety: intersect with overall ROI boundary
    var roiGeom = ee.FeatureCollection(ROI).geometry();
    geom = ee.Geometry(geom).intersection(roiGeom, ee.ErrorMargin(1));
    return geom;
  }

  // -------------------------
  // Computation: areas and % composition
  // -------------------------
  function analyzeROI() {
    statusLabel.setValue('⏳ Computing…');

    var activeYear = getActiveYearFromVisibleLayer();
    if (activeYear === null) {
      activeYearLabel.setValue('Active year: (none detected)');
      statusLabel.setValue('⚠ No visible "Classified YYYY" layer detected. Turn one ON in the Layers panel, then Analyze again.');
      return;
    }
    activeYearLabel.setValue('Active year: ' + activeYear);

    var geom = getDrawnGeometry();
    if (geom === null) {
      statusLabel.setValue('⚠ No ROI drawn. Click "Draw ROI" first.');
      return;
    }

    var img = ee.Image(classifiedCollection.filter(ee.Filter.eq('year', activeYear)).first());

    // Total ROI area (ha)
    var totalAreaHa = ee.Image.pixelArea().divide(10000).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geom,
      scale: 10,
      maxPixels: 1e13
    }).get('area');

    // Per-class area (ha): pixelArea grouped by class
    // Note: ensure the classified band is named 'classification'
    // If your images already have a different band name, adjust here.
    var classBand = img.bandNames().get(0);
    var cls = img.select([classBand]).rename('classification');

    var areaImg = ee.Image.pixelArea().divide(10000).rename('area')
      .addBands(cls);

    var dict = areaImg.reduceRegion({
      reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}),
      geometry: geom,
      scale: 10,
      maxPixels: 1e13
    });

    var groups = ee.List(dict.get('groups'));

    // Build FeatureCollection with: class_name, area_ha, percent_area
    var totalFromGroups = groups.map(function(g) {
      return ee.Number(ee.Dictionary(g).get('sum'));
    }).reduce(ee.Reducer.sum());

    var fc = ee.FeatureCollection(groups.map(function(g) {
      g = ee.Dictionary(g);
      var clsNum = ee.Number(g.get('class'));
      var areaHa = ee.Number(g.get('sum'));
      var pct = ee.Algorithms.If(
        ee.Number(totalFromGroups).neq(0),
        areaHa.divide(totalFromGroups).multiply(100),
        0
      );

      // If you want class names, match to your class list order:
      // (Assumes class indices 0..8 align with your classNames list.)
      var className = ee.Algorithms.If(
        clsNum.gte(0),
        classNames.get(clsNum),
        ee.String('Unknown')
      );

      return ee.Feature(null, {
        year: activeYear,
        class: className,
        area_ha: areaHa,
        percent_area: pct
      });
    }));

    // Update Total ROI label (client-side)
    ee.Number(totalAreaHa).evaluate(function(v) {
      if (v === null || v === undefined) {
        totalAreaLabel.setValue('Total ROI area: (could not compute)');
      } else {
        totalAreaLabel.setValue('Total ROI area: ' + Number(v).toFixed(2) + ' ha');
      }
    });

    // Pie chart (% composition)
    var pie = ui.Chart.feature.byFeature(fc, 'class', 'percent_area')
      .setChartType('PieChart')
      .setOptions({
        title: 'Percent Composition (ROI) — ' + activeYear,
        legend: {position: 'right'},
        // use your global palette if available
        colors: palette,
        chartArea: {left: 10, top: 40, width: '95%', height: '75%'}
      });

    // Table: class areas and %
    var table = ui.Chart.feature.byFeature(fc, 'class', ['area_ha', 'percent_area'])
      .setChartType('Table')
      .setOptions({
        allowHtml: true,
        title: 'ROI Summary Table — ' + activeYear
      });

    pieChartPanel.clear();
    tablePanel.clear();
    pieChartPanel.add(pie);
    tablePanel.add(table);

    statusLabel.setValue('✅ Done. You can redraw the ROI and Analyze again.');
  }

  // -------------------------
  // Buttons
  // -------------------------
  var drawBtn = ui.Button({
    label: '✏️ Draw ROI',
    style: {stretch: 'horizontal', margin: '6px 0'},
    onClick: function() {
      clearDrawingLayers();
      setDrawMode(drawModeSelect.getValue());
      drawTools.draw();
      statusLabel.setValue('Drawing mode ON. Draw on map, then click Analyze.');
    }
  });

  var analyzeBtn = ui.Button({
    label: '📊 Analyze ROI',
    style: {stretch: 'horizontal', margin: '6px 0'},
    onClick: analyzeROI
  });

  var clearBtn = ui.Button({
    label: '🧹 Clear ROI',
    style: {stretch: 'horizontal', margin: '6px 0'},
    onClick: function() {
      clearDrawingLayers();
      pieChartPanel.clear();
      tablePanel.clear();
      totalAreaLabel.setValue('Total ROI area: (not computed)');
      statusLabel.setValue('ROI cleared. Draw a new ROI and click Analyze.');
    }
  });

  // Keep active year label reasonably up to date (best effort)
  function refreshActiveYearLabel() {
    var y = getActiveYearFromVisibleLayer();
    if (y === null) activeYearLabel.setValue('Active year: (none detected)');
    else activeYearLabel.setValue('Active year: ' + y);
  }
  refreshActiveYearLabel();

  // -------------------------
  // Panel layout
  // -------------------------
  var panel = ui.Panel({
    widgets: [
      title,
      help,
      activeYearLabel,
      ui.Label('Draw mode:', {fontSize: '12px', margin: '0 0 4px 0'}),
      drawModeSelect,
      drawBtn,
      analyzeBtn,
      clearBtn,
      totalAreaLabel,
      pieChartPanel,
      tablePanel,
      statusLabel
    ],
    style: {
      padding: '8px',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      margin: '8px'
    }
  });

  return panel;
}



// -----------------------------
// IMPORT CLASSIFIED COLLECTION (2016–2025)
// -----------------------------
var years = ee.List.sequence(startYear, endYear);

// Build list of images for PPB_Classified_2016_2 to PPB_Classified_2025_2
var imgs = years.getInfo().map(function(y){
  var assetId = "projects/ee-odebsconstant/assets/PPB_Classified_" + y + "_2";
  return ee.Image(assetId).set('year', y);
});

var classifiedCollection = ee.ImageCollection(imgs);


// -----------------------------
// COMPUTE AREA & PERCENT SERIES
// -----------------------------
var yearlyAreaFC = ee.FeatureCollection(
  years.map(function(y) {
    y = ee.Number(y);
    var img = classifiedCollection.filter(ee.Filter.eq('year', y)).first();
    var areaImg = ee.Image.pixelArea().divide(10000)
      .addBands(img.rename('classification'));

    var dict = areaImg.reduceRegion({
      reducer: ee.Reducer.sum().group({ groupField: 1, groupName: 'class' }),
      geometry: ROI,
      scale: 10,
      maxPixels: 1e13
    });

    var groups = ee.List(dict.get('groups'));
    var total = groups.map(function(g) {
      return ee.Number(ee.Dictionary(g).get('sum'));
    }).reduce(ee.Reducer.sum());

    var feats = groups.map(function(g) {
      g = ee.Dictionary(g);
      var clsNum = ee.Number(g.get('class'));
      var areaHa = ee.Number(g.get('sum'));
      var pct = areaHa.divide(total).multiply(100);
      var name = classNames.get(clsNum);
      return ee.Feature(null, {
        'year': y,
        'class': name,
        'area_ha': areaHa,
        'percent_area': pct
      });
    });

    return ee.FeatureCollection(feats);
  })
).flatten();

var filteredFC = yearlyAreaFC.filter(
  ee.Filter.rangeContains('year', startYear, endYear)
);

// -----------------------------
// RELATIVE CHANGE INDEX (baseline = startYear)
// -----------------------------
var baseFC = filteredFC.filter(ee.Filter.eq('year', startYear));
var baseDict = ee.Dictionary.fromLists(
  baseFC.aggregate_array('class'),
  baseFC.aggregate_array('area_ha')
);
var relChangeFC = filteredFC.map(function(f){
  var cls = f.get('class');
  var base = ee.Number(baseDict.get(cls));
  var rel = ee.Algorithms.If(base.neq(0),
            ee.Number(f.get('area_ha')).divide(base).multiply(100),
            null);
  return f.set('rel_index', rel);
});
var filteredRelFC = relChangeFC.filter(
  ee.Filter.rangeContains('year', startYear, endYear)
);

// -----------------------------
// YEAR-TO-YEAR Δ-AREA
// -----------------------------
var deltaFC = ee.FeatureCollection(
  years.map(function(y){
    y = ee.Number(y);
    var prev = y.subtract(1);
    var curFC = filteredFC.filter(ee.Filter.eq('year', y));
    var prevFC = filteredFC.filter(ee.Filter.eq('year', prev));
    var join = ee.Join.inner().apply({
      primary: curFC,
      secondary: prevFC,
      condition: ee.Filter.equals({leftField:'class', rightField:'class'})
    });
    return ee.FeatureCollection(
      join.map(function(pair){
        var c = ee.Feature(pair.get('primary'));
        var p = ee.Feature(pair.get('secondary'));
        return ee.Feature(null,{
          'year': y,
          'class': c.get('class'),
          'delta_area': ee.Number(c.get('area_ha')).subtract(ee.Number(p.get('area_ha')))
        });
      })
    );
  })
).flatten()
.filter(ee.Filter.rangeContains('year', startYear + 1, endYear));




// -----------------------------
// CHART HELPER FUNCTION
// -----------------------------
function makeChart(fc, yProperty, title, stacked) {
  // Ensure class property as string
  fc = fc.map(function(f) {
    return ee.Feature(f).set('class', ee.String(f.get('class')));
  });
  var chartType = (yProperty === 'delta_area') ? 'ColumnChart'
                : (!stacked && yProperty === 'area_ha') ? 'LineChart'
                : 'AreaChart';
  return ui.Chart.feature.groups({
      features: fc,
      xProperty: 'year',
      yProperty: yProperty,
      seriesProperty: 'class'
    })
    .setChartType(chartType)
    .setOptions({
      title: title,
      isStacked: stacked,
      hAxis: { title: 'Year' },
      vAxis: {
        title: (yProperty === 'percent_area') ? 'Percent Area (%)'
             : (yProperty === 'rel_index')    ? 'Relative Change (Index, 2016=' + startYear + ')'
             : (yProperty === 'delta_area')   ? 'Change in Area (ha)'
             : 'Area (ha)',
        format: (yProperty === 'percent_area') ? 'short' : 'short'
      },
      colors: palette,
      areaOpacity: 0.85,
      lineWidth: chartType === 'LineChart' ? 2 : 1,
      pointSize: chartType === 'LineChart' ? 4 : 0,
      bar: {groupWidth: '85%'},
      chartArea: {left:80, right:200, top:50, bottom:60},
      legend: {position: 'right'}
    });
}

// -----------------------------
// PANELS: Charts + Legend + Docs + Key Findings
// -----------------------------
function chartWithCaption(chart, caption) {
  return ui.Panel({
    widgets: [chart, ui.Label(caption, {fontSize: '12px', color:'#555', whiteSpace:'wrap'})],
    layout: ui.Panel.Layout.flow('vertical'),
    style: {padding:'8px', border:'1px solid #ddd', margin:'8px'}
  });
}


function buildChartsPanel() {
  // --- Define chart helper with consistent palette ---
  function makeChart(fc, yProperty, title, stacked, chartTypeOverride) {
    var yProp = String(yProperty);
    var chartType = chartTypeOverride || (stacked ? 'AreaChart' : 'LineChart');

    var chart = ui.Chart.feature.groups({
      features: fc,
      xProperty: 'year',
      yProperty: yProp,
      seriesProperty: 'class'
    })
    .setChartType(chartType)
    .setOptions({
      title: title,
      hAxis: {
        title: 'Year',
        format: '####',
        slantedText: true,
        slantedTextAngle: 45
      },
      vAxis: {
        title: yProp.indexOf('percent') !== -1 ? '% Area' : 'Area (ha)',
        format: 'short',  // 👈 shortens 100,000 → 100k
        textStyle: { fontSize: 12 }
      },
      legend: { position: 'right', textStyle: { fontSize: 10 } },
      colors: classInfo.map(function(d) { return d.color; }),
      chartArea: { left: 70, top: 40, width: '80%', height: '65%' },
      lineWidth: stacked ? 0 : 2,
      areaOpacity: stacked ? 0.7 : 0.2, // 👈 distinct semi-transparent fill for stacked
      pointSize: stacked ? 0 : 3
    });
    return chart;
  }

  // --- Helper to attach caption below each chart ---
  function chartSection(chart, caption) {
    return ui.Panel({
      widgets: [
        chart,
        ui.Label(caption, { fontSize: '12px', margin: '4px 0 12px 0' })
      ],
      layout: ui.Panel.Layout.flow('vertical'),
      style: { stretch: 'horizontal', padding: '6px 0', backgroundColor: 'white' }
    });
  }

  // --- Main container ---
  var panel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: { stretch: 'horizontal', padding: '8px', backgroundColor: 'white' }
  });

  // --- Add charts ---
  panel.add(chartSection(
    makeChart(filteredFC, 'area_ha', 'Area per Class Over Time (ha)', false),
    'Annual area (ha) per class.'+
    'Lines make it easy to track how each habitat expands or contracts over time.'
  ));

  // --- True stacked area chart (each layer cumulative, non-overlapping)
panel.add(chartSection(
  ui.Chart.feature.groups({
    features: filteredFC,
    xProperty: 'year',
    yProperty: 'area_ha',
    seriesProperty: 'class'
  })
  .setChartType('AreaChart')
  .setOptions({
    title: 'Stacked Area of Classes',
    hAxis: { title: 'Year', format: '####', slantedText: true, slantedTextAngle: 45 },
    vAxis: { title: 'Area (ha)', format: 'short' },
    legend: { position: 'right', textStyle: { fontSize: 10 } },
    colors: classInfo.map(function(d){ return d.color; }),
    chartArea: { left: 70, top: 40, width: '80%', height: '65%' },
    isStacked: true,  // ✅ key line — makes it cumulative
    areaOpacity: 1.0, // solid stacked fill, no overlap blending
    lineWidth: 1
  }),
  'Stacked area view of total class coverage (non-overlapping layers).'+
  'It highlights how the total area is distributed among classes each year.'
));

// --- Percent stacked area chart
panel.add(chartSection(
  ui.Chart.feature.groups({
    features: filteredFC,
    xProperty: 'year',
    yProperty: 'percent_area',
    seriesProperty: 'class'
  })
  .setChartType('AreaChart')
  .setOptions({
    title: 'Percent Stacked Area of Classes',
    hAxis: { title: 'Year', format: '####', slantedText: true, slantedTextAngle: 45 },
    vAxis: { title: '% Area', format: 'short' },
    legend: { position: 'right', textStyle: { fontSize: 10 } },
    colors: classInfo.map(function(d){ return d.color; }),
    chartArea: { left: 70, top: 40, width: '80%', height: '65%' },
    isStacked: 'percent', // ✅ proportional stacking by percent
    areaOpacity: 1.0,
    lineWidth: 1
  }),
  'Percent stacked area showing relative dominance (%) through time.'+
  'It emphasizes shifts in dominance among classes, independent of total area size.'
));

  // Filled smooth line for relative change index (like last image)
  panel.add(chartSection(
    makeChart(filteredRelFC, 'rel_index', 'Relative Change Index (2016 = baseline)', true, 'AreaChart'),
    'Index showing relative changes since baseline year (filled solid lines).'+
    'This shows percentage change relative to the baseline, useful for comparing trends across classes.'
  ));

  // Year-to-year Δ-area → bar chart
  panel.add(chartSection(
    makeChart(deltaFC, 'delta_area', 'Year-to-Year Δ-Area per Class', false, 'ColumnChart'),
    'Annual change in area (ha) between consecutive years (displayed as bars).'+
    'Positive bars indicate expansion compared to the previous year, while negative values show contraction, zero/no bar shows no change.'
  ));
  
  // --- Overall Trend Summary Table (Start vs End Year) ---
var base = filteredFC.filter(ee.Filter.eq('year', startYear));
var final = filteredFC.filter(ee.Filter.eq('year', endYear));

var join = ee.Join.inner().apply({
  primary: base,
  secondary: final,
  condition: ee.Filter.equals({leftField: 'class', rightField: 'class'})
});

// --- Build summary FeatureCollection ---
var summaryFC = ee.FeatureCollection(join.map(function(pair) {
  var b = ee.Feature(pair.get('primary'));
  var f = ee.Feature(pair.get('secondary'));
  var cls = b.get('class');
  var a0  = ee.Number(b.get('area_ha'));
  var a1  = ee.Number(f.get('area_ha'));
  var d   = a1.subtract(a0);
  var pct = ee.Algorithms.If(a0.neq(0), a1.divide(a0).subtract(1).multiply(100), null);
  var mean = filteredFC.filter(ee.Filter.eq('class', cls)).aggregate_mean('area_ha');
  var sd   = filteredFC.filter(ee.Filter.eq('class', cls)).aggregate_total_sd('area_ha');

  // --- Helper: round to 3 decimals ---
  var round3 = function(x) { return ee.Number(x).format('%.3f'); };

  // --- Build properties step-by-step (in logical order) ---
  var props = {};
  props['Class'] = cls;
  props['Area_' + startYear + '_ha'] = round3(a0);
  props['Area_' + endYear + '_ha'] = round3(a1);
  props['Δ Area (ha)'] = round3(d);
  props['Mean Area (ha)'] = round3(mean);
  props['Std Dev (ha)'] = round3(sd);
  props['Z % Change'] = round3(pct);  // 👈 renamed so it appears last alphabetically

  return ee.Feature(null, props);
}));

// --- Create summary table chart ---
var summaryTable = ui.Chart.feature.byFeature({
    features: summaryFC,
    xProperty: 'Class'
  })
  .setChartType('Table')
  .setOptions({
    title: 'Overall Habitat Trend Summary (' + startYear + '–' + endYear + ')',
    allowHtml: true
  });

// --- Add to right panel ---
panel.add(chartSection(
  summaryTable,
  'Numerical summary of overall habitat trends: start vs end year, mean, variability, and percent change across the full period.'
));


  return panel;
}


// =============================
// INTERACTIVE LEGEND (works for Default View, Tier 1, and multi-year updates)
// =============================
function buildLegendPanel(targetMap, year) {
  // --- Fallback for Default View ---
  if (!targetMap && typeof MapApp !== 'undefined' && MapApp instanceof ui.Map) {
    targetMap = MapApp;
  }

  // --- Legend container ---
  var legend = ui.Panel({
    style: {
      position: 'bottom-left',
      padding: '8px',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      margin: '8px'
    }
  });

  // --- Title ---
  legend.add(ui.Label('Legend' + (year ? ' (' + year + ')' : ''), {
    fontWeight: 'bold',
    fontSize: '14px',
    color: 'white',
    backgroundColor: '#4A997E',
    padding: '4px',
    textAlign: 'center',
    stretch: 'horizontal'
  }));

  // --- Initialize active states ---
  var activeClasses = {};
  classInfo.forEach(function (d) { activeClasses[d.name] = true; });

  // --- Add layers if in Default View ---
  if (targetMap === MapApp) {
    years.getInfo().forEach(function (y) {
      var img = classifiedCollection.filter(ee.Filter.eq('year', y)).first();
      var vis = { min: 0, max: 8, palette: palette };
      targetMap.addLayer(img.visualize(vis), {}, 'Classified ' + y, y === endYear);
    });
  }

  // --- Update composite for one or many layers ---
  function updateComposite() {
    if (!targetMap) return;

    var layers = targetMap.layers();

    // If we're in Tier 1, only update the single specified year
    if (year) {
      var imgYear = classifiedCollection.filter(ee.Filter.eq('year', year)).first();
      var combined = ee.Image(0);
      classInfo.forEach(function (d, idx) {
        if (activeClasses[d.name]) combined = combined.add(imgYear.eq(idx));
      });
      var vis = { min: 0, max: 8, palette: palette };
      var masked = imgYear.updateMask(combined).visualize(vis);
      for (var j = 0; j < layers.length(); j++) {
        if (layers.get(j).getName() === 'Classified ' + year) {
          layers.set(j, ui.Map.Layer(masked, {}, 'Classified ' + year, true));
          break;
        }
      }
    } 
    // If we're in Default View, update ALL visible classified layers
    else {
      years.getInfo().forEach(function (y) {
        var imgYear = classifiedCollection.filter(ee.Filter.eq('year', y)).first();
        var combined = ee.Image(0);
        classInfo.forEach(function (d, idx) {
          if (activeClasses[d.name]) combined = combined.add(imgYear.eq(idx));
        });
        var vis = { min: 0, max: 8, palette: palette };
        var masked = imgYear.updateMask(combined).visualize(vis);

        for (var i = 0; i < layers.length(); i++) {
          var lyr = layers.get(i);
          if (lyr.getName() === 'Classified ' + y) {
            layers.set(i, ui.Map.Layer(masked, {}, 'Classified ' + y, lyr.getShown()));
            break;
          }
        }
      });
    }
  }

  // --- Build clickable class rows ---
  classInfo.forEach(function (d) {
    var colorBox = ui.Panel({
      style: {
        backgroundColor: d.color,
        width: '20px',
        height: '20px',
        margin: '0',
        padding: '0',
        border: '1px solid #555'
      }
    });

    var lbl = ui.Label({
      value: d.name,
      style: { fontSize: '12px', margin: '0 0 0 6px', color: 'black' }
    });

    var row = ui.Panel({
      widgets: [colorBox, lbl],
      layout: ui.Panel.Layout.flow('horizontal'),
      style: { margin: '2px 0', padding: '2px' }
    });

    var clicker = ui.Button({
      label: '',
      style: {
        backgroundColor: '#555555',
        border: '1px solid #333333',
        margin: '0',
        padding: '0',
        width: '15%',
        height: '8px'
      },
      onClick: function () {
        activeClasses[d.name] = !activeClasses[d.name];
        updateComposite();
        if (!activeClasses[d.name]) {
          colorBox.style().set({ backgroundColor: 'white', border: '2px solid ' + d.color });
          lbl.style().set({ color: '#888' });
        } else {
          colorBox.style().set({ backgroundColor: d.color, border: '1px solid #555' });
          lbl.style().set({ color: 'black' });
        }
      }
    });

    var container = ui.Panel({
      widgets: [row, clicker],
      layout: ui.Panel.Layout.flow('vertical'),
      style: { margin: '0' }
    });
    legend.add(container);
  });

  updateComposite();
  return legend;
}




function buildDocumentationPanel() {
  var text =
    '🌊 **Benthic Habitat Mapping Explorer**\n\n' +
    '**Documentation & User Guide (Updated 2025)**\n\n' +
    'This Earth Engine dashboard visualizes benthic habitat classification and temporal dynamics across **Port Phillip Bay (2016–2025)**. ' +
    'It uses pre-classified annual habitat maps derived from Sentinel-2 imagery and a consistent classification schema of nine major benthic classes.\n\n' +

    'The dashboard provides **four main exploration modes**, each designed to support interactive monitoring and interpretation:\n\n' +
    '• **Default View →** Displays long-term temporal trends across all mapped years.\n' +
    '• **Tier 1 (Single-Year Snapshot) →** Provides spatial composition, interactive downloads, and class summaries for a chosen year.\n' +
    '• **Tier 2 (Two-Year Comparison) →** Enables side-by-side visualization and quantification of class-specific changes between two years.\n' +
    '• **Tier 3 (Animated Time-lapse) →** Generates animated annual habitat maps from 2016 to 2025.\n\n' +

    '🔹 **1. Default View: Long-Term Trends**\n\n' +
    '**What you see:**\n' +
    '• **Map Panel (center):** All annual classified habitat layers (2016–2025) are available in the layer manager; only the most recent year is visible by default.\n' +
    '• **Legend (left):** Interactive legend with toggle boxes — click any habitat class to show or hide it on the map.\n' +
    '• **Left Sidebar:** Collapsible; use the **Hide/Show Sidebar** button to maximize the map view.\n' +
    '• Toggle on/off individual classes via the legend.\n' +
    '• Collapse or expand the sidebar to enter full-screen map mode.\n' +
    '• **ROI Inspector (left sidebar):** Draw a rectangle or polygon ROI and click **Analyze ROI** to compute:\n' +
    '   – Total ROI area (ha)\n' +
    '   – Per-class area (ha)\n' +
    '   – Percent composition (pie chart)\n' +
    '   – Summary table for the **currently visible** “Classified YYYY” layer\n' +
    '  *Tip:* Ensure a “Classified YYYY” layer is switched ON before analyzing. Use **Clear ROI** to reset.\n\n' +
    '• **Right Sidebar:** Includes Overview, Documentation, Charts, and Key Findings panels.\n' +
    '**Charts include:**\n' +
    '• *Absolute Area Chart* – Tracks total area (ha) per class through time.\n' +
    '• *Stacked Area Chart* – Displays cumulative habitat composition.\n' +
    '• *Percent Stacked Area* – Shows proportional class dominance (% of total).\n' +
    '• *Relative Change Index* – Uses 2016 as baseline (index = 100) to show relative growth or decline.\n' +
    '• *Δ-Area Chart* – Displays year-to-year gains and losses for each class.\n\n' +
    
    '🔹 **2. Tier 1: Single-Year Snapshot (Swipe Mode)**\n\n' +
    '**How to access:**\n' +
    '• From the left sidebar, select “Swipe View (choose year)”.\n' +
    '**What you see:**\n' +
    '• Split map: *Classified Image (left)* vs *Sentinel-2 RGB (right)*.\n' +
    '• Swipe bar for visual comparison of mapped classes, boundaries, and Sentinel-2 image context.\n' +
    '• Left sidebar: Year selector and interactive legend with toggle boxes.\n' +
    '• **Download options:**\n' +
    '   – Request a full-resolution classified map via email link.\n' +
    '   – Use the **Draw ROI (rectangle)** tool to define a smaller area and receive a download link for that subregion.\n' +
    '• **Hide/Show Sidebar:** Temporarily collapse the left sidebar for an expanded map.\n' +
    '• Right sidebar: Pie chart, bar chart, and summary table of class areas for that year.\n\n' +
    
    '🔹 **3. Tier 2: Two-Year Comparison**\n\n' +
    '**How to access:**\n' +
    '• From Default View, select any two years and click “Compare Selected Years”.\n' +
    '**What you see:**\n' +
    '• Split map: *Year 1 (left)* vs *Year 2 (right)* classifications.\n' +
    '• Change-Detection Tool: Highlight specific transitions (e.g., *Seagrass → Sediment*) and compute change area (ha).\n' +
    '• Toggle visibility of individual classes in both comparison panels.\n' +
    '• Hide/Show sidebar for a larger change-view workspace.\n' +
    '• Right sidebar: Displays absolute area change, percent change, and class-wise differences.\n\n' +
    
    '🔹 **4. Tier 3: Animated Time-lapse (2016–2025)**\n\n' +
    '**Location:**\n' +
    '• Tier 3 tools are located in the **left sidebar** under “Animated Time-lapse”.\n' +
    '**What it does:**\n' +
    '• Generates an animated sequence of annual classified maps (2016–2025) to visualize long-term habitat transitions.\n' +
    '• Each frame includes the **year label** at the **bottom-left corner** and an optional **white indicator chip** for reference.\n' +
    '• Provides an interactive preview and a downloadable animation in GIF or MP4 format.\n' +
    '**Controls available:**\n' +
    '• *Year Range:* Select start and end years for animation.\n' +
    '• *Frames per Second (FPS):* Adjust playback speed.\n' +
    '• *Pixel Size:* Set output resolution (e.g., 512–2048 px).\n' +
    '• *Hide/Show Animated Time-lapse:* Toggle panel visibility.\n' +
    '• *Generate Button:* “🎞️ Generate Habitat Trends Time-lapse” builds the animation with dynamic year overlay.\n' +
    '**Outputs:**\n' +
    '• Shows a preview thumbnail and provides a **download link** (“📥 Click to view in a new tab”) after generation.\n' +
    '• The animation illustrates year-by-year mapped habitat change across Port Phillip Bay for communication, reporting, and education.\n' +
    '**Notes:**\n' +
    '• Complements analytical charts by offering a spatially continuous summary of multi-year change.\n' +
    '• Uses the same color palette, year text, and transition timing as the Default View for visual consistency.\n\n' +

    '🔹 **5. Key Interpretation Notes**\n' +
    '• Consistent color palette ensures intuitive comparison across years and tools.\n' +
    '• Δ-Area = absolute change (ha); % Change = relative difference from baseline.\n' +
    '• Swipe and comparison tools serve complementary purposes: Tier 1 = visual inspection, Tier 2 = change quantification.\n' +
    '• Stability and variability metrics reflect mapped temporal dynamics and should be interpreted alongside class-specific confidence.\n' +
    '• Broad patterns are more reliable for persistent classes; short-term changes in macroalgal and mixed benthic classes require greater caution.\n\n' +

    '✅ **Practical Uses:**\n' +
    '• Identify long-term ecological trends and habitat shifts.\n' +
    '• Quantify broad seagrass, reef, macroalgal, and sediment patterns.\n' +
    '• Screen potential restoration, recovery, or degradation hotspots for follow-up validation.\n' +
    '• Support evidence-based coastal management, monitoring, and marine planning.\n\n' +

    '🧭 **Data Provenance & Methodology:**\n' +
    'Habitat classifications were produced from **harmonized Sentinel-2 Level-1C top-of-atmosphere reflectance composites (10 m)** processed annually for temporal consistency. ' +
    'Classification used a **Random Forest model** trained using a harmonised polygon-based reference framework representing nine benthic habitat classes. ' +
    'Internal accuracy values indicate consistency within this reference framework, while independent field validation was available for the 2025 map only.\n\n' +
    'Outputs support research, monitoring, and decision-making on marine habitat change, biodiversity conservation, and ecosystem resilience in southern Australia. ' +
    'They are intended as broad-scale screening and decision-support products, not a substitute for site-scale field validation.';

  return ui.Panel(
    [ui.Label(text, {fontSize: '13px', whiteSpace: 'pre-wrap'})],
    ui.Panel.Layout.flow('vertical'),
    {stretch: 'horizontal', padding: '8px', backgroundColor: 'white'}
  );
}




function buildKeyFindingsPanel() {
  // --- Filter for baseline and final year
  var baseFC = filteredFC.filter(ee.Filter.eq('year', startYear));
  var finalFC = filteredFC.filter(ee.Filter.eq('year', endYear));

  // --- Join baseline and final year
  var join = ee.Join.inner().apply({
    primary: baseFC,
    secondary: finalFC,
    condition: ee.Filter.equals({leftField: 'class', rightField: 'class'})
  });

  var comparison = ee.FeatureCollection(join.map(function(pair) {
    var b = ee.Feature(pair.get('primary'));
    var f = ee.Feature(pair.get('secondary'));
    var areaBase = ee.Number(b.get('area_ha'));
    var areaFinal = ee.Number(f.get('area_ha'));
    var delta = areaFinal.subtract(areaBase);
    var pctChange = ee.Algorithms.If(areaBase.neq(0),
      areaFinal.divide(areaBase).subtract(1).multiply(100),
      null);
    return ee.Feature(null, {
      'class': b.get('class'),
      'base': areaBase,
      'final': areaFinal,
      'delta': delta,
      'pctChange': pctChange
    });
  }));

  var compFC = ee.FeatureCollection(comparison);

  // --- Largest gain & loss
  var largestGain = compFC.sort('delta', false).first();
  var largestLoss = compFC.sort('delta', true).first();

  // --- Variability across years
  var stats = filteredFC.reduceColumns({
    selectors: ['class', 'area_ha'],
    reducer: ee.Reducer.stdDev().group({groupField: 0, groupName: 'class'})
  });

  var variability = ee.List(stats.get('groups'));
  var varDict = ee.Dictionary(
    variability.map(function(item) {
      item = ee.Dictionary(item);
      return [item.get('class'), item.get('stdDev')];
    }).flatten()
  );

  var stableClass = ee.String(varDict.keys().sort(varDict.values()).get(0));
  var volatileClass = ee.String(varDict.keys().sort(varDict.values()).reverse().get(0));

  // -----------------------------
  // SECTION 1: Overall Summary
  // -----------------------------
  var overallSummary = ee.String('🌍 **Overall Trends**\n\n')
    .cat('Between ')
    .cat(ee.Number(startYear).format('%d'))
    .cat(' and ')
    .cat(ee.Number(endYear).format('%d'))
    .cat(', the largest gain was ')
    .cat(ee.String(largestGain.get('class')))
    .cat(' (+')
    .cat(ee.Number(largestGain.get('delta')).format('%.1f'))
    .cat(' ha). The largest loss was ')
    .cat(ee.String(largestLoss.get('class')))
    .cat(' (')
    .cat(ee.Number(largestLoss.get('delta')).format('%.1f'))
    .cat(' ha).\n\n')
    .cat('The most stable habitat was ')
    .cat(stableClass)
    .cat(', while the most volatile was ')
    .cat(volatileClass)
    .cat('.');

  // -----------------------------
  // SECTION 2: Per-Class Changes
  // -----------------------------
  var classNamesList = classInfo.map(function(d){ return d.name; });
  var classSentences = ee.List(classNamesList).map(function(cls) {
    var rec = compFC.filter(ee.Filter.eq('class', cls)).first();
    return ee.Algorithms.If(rec,
      ee.String('• ').cat(cls)
        .cat(' changed by ')
        .cat(ee.Number(rec.get('delta')).format('%.1f'))
        .cat(' ha (')
        .cat(ee.Number(rec.get('pctChange')).format('%.1f'))
        .cat('%).'),
      null
    );
  });
  var perClassBlock = ee.String('🌱 **Per-Class Changes**\n\n').cat(ee.List(classSentences).join('\n'));

  // -----------------------------
  // SECTION 3: Biggest Loss & Gain Events
  // -----------------------------
  var lossSentences = ee.List(classNamesList).map(function(cls) {
    var loss = deltaFC.filter(ee.Filter.eq('class', cls))
                      .sort('delta_area', true).first();
    return ee.Algorithms.If(loss,
      ee.String('• ').cat(cls)
        .cat(' had its largest loss in ')
        .cat(ee.Number(loss.get('year')).format('%d'))
        .cat(' (')
        .cat(ee.Number(loss.get('delta_area')).format('%.1f'))
        .cat(' ha).'),
      null
    );
  });
  var lossBlock = ee.String('📉 **Biggest Loss Events**\n\n').cat(ee.List(lossSentences).join('\n'));

  var gainSentences = ee.List(classNamesList).map(function(cls) {
    var gain = deltaFC.filter(ee.Filter.eq('class', cls))
                      .sort('delta_area', false).first();
    return ee.Algorithms.If(gain,
      ee.String('• ').cat(cls)
        .cat(' had its largest gain in ')
        .cat(ee.Number(gain.get('year')).format('%d'))
        .cat(' (+')
        .cat(ee.Number(gain.get('delta_area')).format('%.1f'))
        .cat(' ha).'),
      null
    );
  });
  var gainBlock = ee.String('📈 **Biggest Gain Events**\n\n').cat(ee.List(gainSentences).join('\n'));

  
// -----------------------------
// SECTION 4: Stability Insights (Sorted from Most → Least Variable)
// -----------------------------
var sortedKeysAsc = varDict.keys().sort(varDict.values()); // ascending order
var sortedKeysDesc = sortedKeysAsc.reverse(); // descending

var sortedVarStrings = sortedKeysDesc.map(function(k) {
  var v = ee.Number(varDict.get(k));
  return ee.String(k).cat(' = ').cat(v.format('%.1f')).cat(' ha');
});

var stabilityBlock = ee.String('📊 **Stability & Variability (standard deviation of area across years)**\n\n')
  .cat('Reveals how much each class fluctuated in area over time (sorted from most to least variable).\n')
  .cat('Most stable: ').cat(stableClass)
  .cat('; Most volatile: ').cat(volatileClass).cat('.\n\n')
  .cat(ee.String(sortedVarStrings.join('; ')));


// -----------------------------
// SECTION 5: Model Evaluation Summary (Static Highlight)
// -----------------------------
var evalSummary = ee.String(
  '🧭 **Model Evaluation Summary (2016–2025)**\n\n' +
  'Internal accuracy assessment based on the harmonised polygon reference framework ' +
  'showed very high consistency across the annual archive, with overall accuracy ranging ' +
  'from 99.60–99.96% (mean = 99.86%) and Kappa coefficients from 0.994–0.9992 ' +
  '(mean = 0.9979).\n\n' +
  'Because these values are derived from held-out samples taken from the same polygon-based ' +
  'reference framework used for training, they should be interpreted as indicators of internal ' +
  'consistency rather than fully independent external map accuracy.\n\n' +
  'Independent validation of the 2025 map used 518 field observations for the surveyed benthic classes, ' +
  'with 91 additional independent reference observations completing the nine-class assessment (n = 609). ' +
  'The complete assessment yielded an overall accuracy of 66.2% (95% CI: 62.3–70.0%; Kappa = 0.612), indicating moderate external agreement and ' +
  'greater uncertainty for some spectrally complex benthic classes.\n\n' +
  'Overall, the archive is most robust for broad decadal patterns and persistent habitat ' +
  'distributions, while short-term fluctuations in macroalgal and mixed benthic classes ' +
  'should be interpreted with greater caution.'
);


// -----------------------------
// SECTION 6: Variable Importance Summary (Static Highlight)
// -----------------------------
var varImportanceSummary = ee.String(
  '🔬 **Variable Importance Summary (2016–2025)**\n\n' +
  'Across all classification years, Depth consistently ranked as the single most important predictor, ' +
  'followed by terrain and short-wavelength spectral variables. The top predictors were generally: ' +
  'Depth, TPI_100, B2 (Blue), Rugosity, MNDWI, and AWEInsh.\n\n' +
  'Bathymetric and topographic metrics—particularly Depth and Topographic Position Index (TPI_100 and TPI_25)—' +
  'dominated model importance, underscoring the critical role of seafloor structure and elevation gradients ' +
  'in shaping benthic habitat distribution across Port Phillip Bay.\n\n' +
  'Among spectral indices, Blue/Green ratios (B2, Blue_Green) and water-related indices (MNDWI, AWEInsh) ' +
  'showed strong and consistent contributions, reflecting sensitivity to optical water depth and substrate brightness. ' +
  'Vegetation-related indices (NDVI, SAVI, EVI) and red-edge bands (B5, B6, B7) contributed moderately but were secondary to bathymetric drivers.\n\n' +
  'Overall, variable importance remained stable through time, indicating that the physical template of the bay—' +
  'dominated by depth and terrain heterogeneity—consistently governs benthic habitat separability in Sentinel-2–based classifications.'
);


  // -----------------------------
  // Combine all sections into one text
  // -----------------------------
  var allText = ee.List([overallSummary, perClassBlock, lossBlock, gainBlock, stabilityBlock, evalSummary, varImportanceSummary]).join('\n\n');

  // --- Wrap in collapsible UI panel
  // --- Return simple panel content only (no internal header)
  return ui.Panel({
    widgets: [
      ui.Label(allText.getInfo(), {fontSize:'13px', whiteSpace:'pre-wrap'})
    ],
    style: {padding:'8px', backgroundColor:'white', border:'1px solid #ddd'}
  });

}



// =============================
// COLLAPSIBLE PANEL TEMPLATE (modern clean style)
// =============================
function makeCollapsiblePanel(headerLabel, bodyWidget, icon) {
  var header = ui.Button({
    label: icon + ' ' + headerLabel + ' ▲',
    style: {
      color: 'black',
      backgroundColor: 'white',
      fontWeight: 'bold',
      fontSize: '14px',
      border: '2px solid #2E8B57',   // green border
      margin: '4px 0',
      textAlign: 'left',
      padding: '6px 8px',
      stretch: 'horizontal'
    }
  });

  var body = ui.Panel({
    widgets: [bodyWidget],
    style: {
      shown: false,                  // Hidden by default
      padding: '8px',
      backgroundColor: 'white',
      border: '1px solid #ddd'
    }
  });

  var expanded = false;
  header.onClick(function() {
    expanded = !expanded;
    body.style().set('shown', expanded);
    header.setLabel(icon + ' ' + headerLabel + (expanded ? ' ▼' : ' ▲'));
  });

  return ui.Panel({
    widgets: [header, body],
    style: {stretch: 'horizontal', backgroundColor: 'white'}
  });
}


// =============================================
// FUNCTION: Add Pixel Information on Click
// =============================================
function enablePixelInfo(map, imageCollection, roi) {
  var infoLabel = ui.Label('🖱 Click on the map to view habitat info', {
    fontSize: '12px',
    color: '#333',
    margin: '4px'
  });

  var infoPanel = ui.Panel({
    widgets: [
      ui.Label('📍 Pixel Info', {
        fontWeight: 'bold',
        backgroundColor: '#4A997E',
        color: 'white',
        padding: '4px',
        textAlign: 'center',
        stretch: 'horizontal'
      }),
      infoLabel
    ],
    style: {
      position: 'bottom-right',
      padding: '8px',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      width: '220px'
    }
  });

  map.add(infoPanel);

  // --- Add "Info Mode" toggle button ---
  var infoMode = false;
  var toggleBtn = ui.Button({
    label: '🖱 Enable Info Mode',
    style: {
      stretch: 'horizontal',
      backgroundColor: '#4A997E',
      color: 'black',
      margin: '4px 0',
      width: '200px'
    },
    onClick: function() {
      infoMode = !infoMode;
      if (infoMode) {
        map.style().set('cursor', 'crosshair');  // enable precise mode
        toggleBtn.setLabel('✅ Info Mode: ON (click map)');
      } else {
        map.style().set({});                      // restore default pan cursor
        toggleBtn.setLabel('🖱 Enable Info Mode');
      }
    }
  });

  // Place the button above the pixel info label
  infoPanel.widgets().insert(1, toggleBtn);

  // --- Listener for clicks ---
  map.onClick(function(coords) {
    if (!infoMode) return; // only active in Info Mode

    var point = ee.Geometry.Point(coords.lon, coords.lat);
    var activeYear = endYear; // default
    var activeLayer;

    map.layers().forEach(function(layer) {
      var layerName = String(layer.getName());
      if (layer.getShown() && layerName.indexOf('Classified') === 0) {
        activeLayer = layerName;
        var parts = layerName.split(' ');
        activeYear = parseInt(parts[1], 10);
      }
    });

    var img = imageCollection.filter(ee.Filter.eq('year', activeYear)).first();
    var classVal = img.sample(point, 10).first().get('classification');

    classVal.evaluate(function(val) {
      if (val !== null && val !== undefined) {
        var clsName = classNames.getInfo()[val];
        infoLabel.setValue(
          '📆 Year: ' + activeYear + '\n' +
          '🗺 Class: ' + clsName + '\n' +
          '🧭 Coordinates:\n' +
          coords.lon.toFixed(5) + ', ' + coords.lat.toFixed(5)
        );
      } else {
        infoLabel.setValue('No data at this location.');
      }
    });
  });
}




function buildConfidenceGuidePanel() {
  var fc = ee.FeatureCollection([
    ee.Feature(null, {
      'Habitat class/group': 'Deep water',
      'Supporting evidence': 'High independent accuracy, low compositing sensitivity, very high persistence',
      'Confidence interpretation': 'Higher confidence for broad spatial patterns'
    }),
    ee.Feature(null, {
      'Habitat class/group': 'Sediment',
      'Supporting evidence': 'High persistence and low compositing sensitivity, but area was overestimated and correlated with turbidity',
      'Confidence interpretation': 'Higher confidence for broad distribution; moderate confidence for precise area estimates'
    }),
    ee.Feature(null, {
      'Habitat class/group': 'Sublittoral seagrass beds',
      'Supporting evidence': 'High persistence, but moderate independent validation and upward error-adjusted area estimate',
      'Confidence interpretation': 'Moderate confidence'
    }),
    ee.Feature(null, {
      'Habitat class/group': 'Shoreline vegetation',
      'Supporting evidence': 'High independent accuracy and high persistence',
      'Confidence interpretation': 'Higher confidence, noting narrow shoreline extent'
    }),
    ee.Feature(null, {
      'Habitat class/group': 'Sub-canopy brown algae and Caulerpa communities',
      'Supporting evidence': 'High compositing sensitivity, lower persistence and moderate class confusion',
      'Confidence interpretation': 'Lower to moderate confidence'
    }),
    ee.Feature(null, {
      'Habitat class/group': 'Ecklonia–Phyllospora communities',
      'Supporting evidence': 'Lower persistence and moderate class confusion, with small mapped extent',
      'Confidence interpretation': 'Lower to moderate confidence'
    }),
    ee.Feature(null, {
      'Habitat class/group': 'Sublittoral seaweed communities on sediment',
      'Supporting evidence': 'High compositing sensitivity and moderate persistence',
      'Confidence interpretation': 'Lower to moderate confidence'
    }),
    ee.Feature(null, {
      'Habitat class/group': 'Rocky reef',
      'Supporting evidence': 'Moderate compositing sensitivity and class confusion with mixed benthic substrates',
      'Confidence interpretation': 'Moderate confidence'
    }),
    ee.Feature(null, {
      'Habitat class/group': 'Bare rocks',
      'Supporting evidence': 'High user accuracy but very small mapped extent',
      'Confidence interpretation': 'Moderate confidence; interpret locally with caution'
    })
  ]);

  var intro = ui.Label(
    'Confidence guide for dashboard outputs based on independent validation, compositing sensitivity and temporal persistence.',
    {fontSize: '12px', margin: '0 0 8px 0', whiteSpace: 'wrap'}
  );

  var table = ui.Chart.feature.byFeature(
      fc,
      'Habitat class/group',
      ['Supporting evidence', 'Confidence interpretation']
    )
    .setChartType('Table')
    .setOptions({
      allowHtml: true,
      page: 'enable',
      pageSize: 10
    });

  var note = ui.Label(
    'Use these confidence levels for broad interpretation. Fine-scale restoration assessment should be supported by field, drone, diver or other site-scale validation.',
    {fontSize: '12px', margin: '8px 0 0 0', whiteSpace: 'wrap', color: '#444'}
  );

  return ui.Panel({
    widgets: [intro, table, note],
    layout: ui.Panel.Layout.flow('vertical'),
    style: {stretch: 'horizontal', padding: '8px', backgroundColor: 'white'}
  });
}


// -----------------------------
// BUILD DEFAULT VIEW (maps + panels + controls)
// -----------------------------
// === Global variables ===
var MapApp;               // to hold main map
var layersByClass = {};   // to hold per-class layers for toggling

function buildDefaultView() {
  ui.root.clear();

  // --- Map ---
  var mapMain = ui.Map();
  MapApp = mapMain; // make global for legend access
  mapMain.centerObject(ROI, 10.7);
  mapMain.setOptions('HYBRID');

  // --- Add Credits / Footer Panel ---
  var creditsPanel = ui.Panel({
    widgets: [
      ui.Label({
        value: '© 2025 Deakin University | Contact: Deakin Marine',
        style: {fontSize: '10px', color: '#1a73e8', margin: '6px'}
      })
    ],
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
      position: 'bottom-left',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      padding: '8px',
      width: '280px',
      border: '1px solid #ccc',
      borderRadius: '8px'
    }
  });

  // ✅ Attach credits panel directly to mapMain
  mapMain.add(creditsPanel);

  // --- Directly attach legend (no base transparent layer) ---
  var legendPanel = buildLegendPanel();

  // --- Tier 1: Single-Year Snapshot ---
  var tier1Panel = ui.Panel([
    ui.Label('🗓 Tier 1: Single-Year Snapshot', {
      fontWeight: 'bold',
      backgroundColor: '#4A997E',
      color: 'white',
      padding: '4px',
      textAlign: 'center',
      stretch: 'horizontal'
    }),
    ui.Button({
      label: '▶ Swipe view (choose year)',
      onClick: function() { buildSingleYearSwipe(endYear); },
      style: {stretch: 'horizontal', margin: '4px'}
    })
  ], ui.Panel.Layout.flow('vertical'), {margin: '6px 0'});

  // --- Tier 2: Two-Year Comparison ---
  var tier2Panel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {margin: '6px 0'}
  });

  // Add Tier 2 header label
  tier2Panel.add(ui.Label('🔀 Tier 2: Two-Year Comparison', {
    fontWeight: 'bold',
    backgroundColor: '#4A997E',
    color: 'white',
    padding: '4px',
    textAlign: 'center',
    stretch: 'horizontal'
  }));

  // Add instructional label
  tier2Panel.add(ui.Label('Select two years to compare:', {fontSize: '12px'}));

  // ✅ Declare comparison years
  var year1 = startYear;
  var year2 = endYear;

  // Create year selectors
  var select1 = ui.Select({
    items: years.getInfo().map(String),
    value: String(startYear),
    style: {stretch: 'horizontal'},
    onChange: function(v) { year1 = parseInt(v, 10); }
  });

  var select2 = ui.Select({
    items: years.getInfo().map(String),
    value: String(endYear),
    style: {stretch: 'horizontal'},
    onChange: function(v) { year2 = parseInt(v, 10); }
  });

  // Create compare button (uses dynamic year1/year2)
  var compareBtn = ui.Button({
    label: '🔁 Compare Selected Years',
    onClick: function() { buildTwoYearSwipe(year1, year2); },
    style: {stretch: 'horizontal', margin: '4px'}
  });

  // Add controls to Tier 2 panel
  tier2Panel.add(select1);
  tier2Panel.add(select2);
  tier2Panel.add(compareBtn);

  // --- Tier 3: Animated Time-lapse ---
  var tier3Panel = ui.Panel({
    layout: ui.Panel.Layout.flow('vertical'),
    style: {margin: '6px 0'}
  });

  tier3Panel.add(ui.Label('🎞 Tier 3: Animated Time-lapse', {
    fontWeight: 'bold',
    backgroundColor: '#4A997E',
    color: 'white',
    padding: '4px',
    textAlign: 'center',
    stretch: 'horizontal'
  }));

  // Generate the actual time-lapse panel
   tier3Panel.add(buildTier3AnimationPanel());
  
  // --- Tier 3: Animated Time-lapse (left sidebar) ---
  //var tier3Panel = makeCollapsiblePanel(
    //'Tier 3: Animated Time-lapse',
    //buildTier3AnimationPanel({ targetMap: mapMain }), // <-- pass the live map
    //'🎞️'
  //);
  
  // --- Left Sidebar ---
  var leftSidebarContent = ui.Panel({
    widgets: [legendPanel, tier1Panel, tier2Panel, tier3Panel], // <-- include Tier 3
    layout: ui.Panel.Layout.flow('vertical'),
    style: {padding: '4px'} // , backgroundColor: 'white'
  });
  
  // ✅ ROI Inspector (Default View)
  var roiInspector = buildROIInspectorPanel(mapMain, classifiedCollection, ROI);
  leftSidebarContent.add(roiInspector);


  // --- Left Sidebar with Full Collapse + Restore ---
  var collapsed = false;

  // Sidebar header toggle (inside the sidebar)
  var headerButton = ui.Button({
    label: '▾ Hide Sidebar',
    style: {
      fontWeight: 'bold',
      color: 'black',
      backgroundColor: '#4A997E',
      padding: '6px 8px',
      fontSize: '13px',
      border: '1px solid #2C5E50',
      textAlign: 'left',
      stretch: 'horizontal'
    },
    onClick: function() {
      collapsed = !collapsed;
      if (collapsed) {
        leftSidebarContent.style().set({shown: false});
        leftSidebar.style().set({width: '0px', padding: '0px', margin: '0px'});
        headerButton.style().set({shown: false});
        restoreButton.style().set({shown: true});
      } else {
        leftSidebarContent.style().set({shown: true});
        leftSidebar.style().set({width: '335px', padding: '0px'});
        headerButton.setLabel('▾ Sidebar Controls');
      }
    }
  });

  var restoreButton = ui.Button({
    label: '➡ Show Sidebar',
    style: {
      position: 'top-left',
      backgroundColor: '#4A997E',
      color: 'black',
      fontWeight: 'bold',
      border: '1px solid #2C5E50',
      padding: '4px 8px',
      fontSize: '12px',
      margin: '6px',
      shown: false
    },
    onClick: function() {
      collapsed = false;
      leftSidebarContent.style().set({shown: true});
      leftSidebar.style().set({width: '335px', padding: '0px'});
      headerButton.style().set({shown: true});
      restoreButton.style().set({shown: false});
    }
  });

  var leftSidebar = ui.Panel({
    widgets: [headerButton, leftSidebarContent],
    layout: ui.Panel.Layout.flow('vertical'),
    style: {
      width: '335px',
      backgroundColor: 'black',
      margin: '0',
      padding: '0'
    }
  });

  var middle = ui.Panel({
    widgets: [mapMain],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {stretch: 'both'}
  });

  ui.root.add(restoreButton);

  var rightPanel = ui.Panel({
    widgets: [
      ui.Label('Benthic Habitat Mapping in Port Phillip Bay', {
        fontSize: '20px', fontWeight: 'bold', color: '#4A997E'
      }),
      ui.Label(
        'This dashboard shows benthic habitat classifications and temporal dynamics within Port Phillip Bay (2016–2025). ' +
        'Sentinel-2 imagery, bathymetry and terrain variables were used in a Random Forest workflow to generate annual habitat maps. ' +
        'Use the Tier panels to explore single-year views, two-year comparisons, ROI summaries and time-lapse outputs. ' +
        'Dashboard outputs are designed for broad-scale monitoring and decision support, and should be interpreted using the class-specific confidence guidance provided in the Confidence Guide panel.',
        {fontSize: '16px', whiteSpace: 'wrap'}
      ),
      makeCollapsiblePanel('User Guide / Documentation', buildDocumentationPanel(), '📘'),
      makeCollapsiblePanel('Explore Overall Habitat Trends', buildChartsPanel(), '📊'),
      makeCollapsiblePanel('Key Findings / Highlights', buildKeyFindingsPanel(), '📌'),
      makeCollapsiblePanel('Confidence Guide / Class Specific', buildConfidenceGuidePanel(), '✅')
    ],
    style: {width: '400px', padding: '8px', backgroundColor: 'white'}
  });

  var rootLayout = ui.Panel({
    widgets: [leftSidebar, middle, rightPanel],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: {stretch: 'both'}
  });
  
// --- Right Sidebar with Full Collapse + Restore (mirrors left sidebar) ---
var rightCollapsed = false;

// Header toggle (inside the right sidebar)
var rightHeaderButton = ui.Button({
  label: '▾ Hide Sidebar',
  style: {
    fontWeight: 'bold',
    color: 'black',
    backgroundColor: '#4A997E',
    padding: '6px 8px',
    fontSize: '13px',
    border: '1px solid #2C5E50',
    textAlign: 'left',
    stretch: 'horizontal'
  },
  onClick: function() {
    rightCollapsed = !rightCollapsed;
    if (rightCollapsed) {
      rightPanel.style().set({shown: false});
      rightHeaderButton.style().set({shown: false});
      rightRestoreButton.style().set({shown: true});
    } else {
      rightPanel.style().set({shown: true});
      rightHeaderButton.setLabel('▾ Sidebar Controls');
    }
  }
});

// ✅ Wrap header in a black background container (same as left)
var rightHeaderContainer = ui.Panel({
  widgets: [rightHeaderButton],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    backgroundColor: 'black',
    margin: '0',
    padding: '0'
  }
});

// Floating restore button (identical style but pinned top-right)
var rightRestoreButton = ui.Button({
  label: '⬅ Show Sidebar',
  style: {
    position: 'top-right',
    backgroundColor: '#4A997E',
    color: 'black',
    fontWeight: 'bold',
    border: '1px solid #2C5E50',
    padding: '4px 8px',
    fontSize: '12px',
    margin: '6px',
    shown: false
  },
  onClick: function() {
    rightCollapsed = false;
    rightPanel.style().set({shown: true});
    rightHeaderButton.style().set({shown: true});
    rightRestoreButton.style().set({shown: false});
  }
});

// Insert black-boxed header on top of rightPanel (exactly like left)
rightPanel.widgets().insert(0, rightHeaderContainer);

// Add restore button to the map’s top-right
mapMain.add(ui.Panel({
  widgets: [rightRestoreButton],
  style: {
    position: 'top-right',
    padding: '0',
    margin: '6px'
  }
}));


enablePixelInfo(mapMain, classifiedCollection, ROI);

  ui.root.add(rootLayout);
}


// -----------------------------
// TIER 1: Single-Year Snapshot View
// -----------------------------
function buildSingleYearSwipe(yearStr) {
  ui.root.clear();
  var year = parseInt(yearStr, 10);

  // --- Data ---
  var imgClass = classifiedCollection.filter(ee.Filter.eq('year', year)).first().clip(ROI);
  var visCLS = {min: 0, max: 8, palette: palette};

  // --- Area summary per class ---
  var areaImg = ee.Image.pixelArea().divide(10000).addBands(imgClass.rename('class'));
  var areaDict = areaImg.reduceRegion({
    reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}),
    geometry: ROI,
    scale: 10,
    maxPixels: 1e13
  });

  var groups = ee.List(areaDict.get('groups'));
  var total = groups.map(function(g){ return ee.Number(ee.Dictionary(g).get('sum')); })
                    .reduce(ee.Reducer.sum());
  var fc = ee.FeatureCollection(groups.map(function(g){
    g = ee.Dictionary(g);
    var cls = ee.Number(g.get('class'));
    var name = ee.String(classNames.get(cls));
    var area = ee.Number(g.get('sum'));
    var pct = area.divide(total).multiply(100);
    return ee.Feature(null, {class:name, area_ha:area, percent_area:pct});
  }));

  // --- Charts ---
  var pieChart = ui.Chart.feature.byFeature(fc, 'class', 'percent_area')
    .setChartType('PieChart')
    .setOptions({
      title: 'Percent Composition (' + year + ')',
      colors: palette,
      legend: {position:'right'}
    });

  var barChart = ui.Chart.feature.byFeature(fc, 'class', 'area_ha')
    .setChartType('ColumnChart')
    .setOptions({
      title: 'Absolute Area per Class (' + year + ')',
      colors:['#4A997E'],
      legend:'none',
      hAxis:{title:'Class'}, vAxis:{title:'Area (ha)'}
    });

  var table = ui.Chart.feature.byFeature(fc, 'class', ['area_ha','percent_area'])
    .setChartType('Table')
    .setOptions({
      allowHtml:true,
      title:'Class Summary ('+year+')'
    });

  // --- Maps ---
  var visRGB = {bands:['B4','B3','B2'], min:0, max:3000};
  var rgb = ee.ImageCollection("COPERNICUS/S2_HARMONIZED")
              .filterDate(ee.Date.fromYMD(year,1,1), ee.Date.fromYMD(year,12,31))
              .filterBounds(ROI)
              .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',10))
              .median()
              .clip(ROI);

  var leftMap = ui.Map();
  var rightMap = ui.Map();
  ui.Map.Linker([leftMap, rightMap]);
  leftMap.centerObject(ROI, 10.7);
  rightMap.centerObject(ROI, 10.7);
  leftMap.setOptions('HYBRID');   // ✅ satellite with labels
  rightMap.setOptions('HYBRID');  // ✅ satellite with labels


  leftMap.addLayer(imgClass.select(0), visCLS, 'Classified ' + year);
  rightMap.addLayer(rgb, visRGB, 'Sentinel-2 ' + year);

  var split = ui.SplitPanel({firstPanel:leftMap, secondPanel:rightMap, orientation:'horizontal', wipe:true});

  // --- Panels ---
  var legendPanel = buildLegendPanel(leftMap, year);
  var selector = ui.Select({
    items: years.getInfo().map(String),
    value: String(year),
    onChange: buildSingleYearSwipe,
    style: {stretch:'horizontal'}
  });
  var backBtn = ui.Button({
    label: '⬅ Return to Default View',
    onClick: buildDefaultView,
    style:{stretch:'horizontal', margin:'6px'}
  });

  // --- Build core sidebar content ---
var leftSidebarContent = ui.Panel({
  widgets: [legendPanel, selector],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '4px', backgroundColor: 'white'}
});

// --- Left Sidebar with Full Collapse + Restore (Tier 1) ---
var collapsed = false;

// Sidebar header toggle
var headerButton = ui.Button({
  label: '▾ Hide Sidebar',
  style: {
    fontWeight: 'bold',
    color: 'black',
    backgroundColor: '#4A997E',
    padding: '6px 8px',
    fontSize: '13px',
    border: '1px solid #2C5E50',
    textAlign: 'left',
    stretch: 'horizontal'
  },
  onClick: function() {
    collapsed = !collapsed;
    if (collapsed) {
      leftSidebarContent.style().set({shown: false});
      leftSidebar.style().set({width: '0px', padding: '0px', margin: '0px'});
      headerButton.style().set({shown: false});
      restoreButton.style().set({shown: true});
    } else {
      leftSidebarContent.style().set({shown: true});
      leftSidebar.style().set({width: '335px', padding: '0px'});
      headerButton.setLabel('▾ Sidebar Controls');
    }
  }
});

// Floating restore button
var restoreButton = ui.Button({
  label: '➡ Show Sidebar',
  style: {
    position: 'top-left',
    backgroundColor: '#4A997E',
    color: 'black',
    fontWeight: 'bold',
    border: '1px solid #2C5E50',
    padding: '4px 8px',
    fontSize: '12px',
    margin: '6px',
    shown: false
  },
  onClick: function() {
    collapsed = false;
    leftSidebarContent.style().set({shown: true});
    leftSidebar.style().set({width: '335px', padding: '0px'});
    headerButton.style().set({shown: true});
    restoreButton.style().set({shown: false});
  }
});

// Build sidebar
var leftSidebar = ui.Panel({
  widgets: [headerButton, leftSidebarContent],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    width: '335px',
    backgroundColor: 'black',
    margin: '0',
    padding: '0'
  }
});

// Add floating restore button to the app root (so it stays visible on the map)
ui.root.add(restoreButton);

  
// =============================
// EXPORT OPTIONS (Tier 1) - Public Download + Request Form
// =============================
function buildExportPanel_Tier1(yearSelect, collection, roi, leftMap) {

  // --- Status label ---
  var statusLabel = ui.Label('Select an option to generate or request download.', {
    margin: '4px 0 6px 0',
    fontSize: '12px',
    color: '#555'
  });

  // --- Full Download Button ---
  var fullDownloadBtn = ui.Button({
    label: '⬇ Generate Full Bay Download Link',
    style: {
      stretch: 'horizontal',
      margin: '6px',
      backgroundColor: '#1f77b4',
      color: 'black'
    },
    onClick: function() {
      statusLabel.setValue('⏳ Generating full image link...');
      var selectedYear = parseInt(yearSelect.getValue(), 10);
      var img = ee.Image(collection.filter(ee.Filter.eq('year', selectedYear)).first());
      var roiGeom = ee.FeatureCollection(roi).geometry().bounds();

      img.getDownloadURL({
        name: 'PPB_Classified_' + selectedYear,
        scale: 10,
        region: roiGeom,
        format: 'GEO_TIFF'
      }, function(url) {
        statusLabel.setValue('');
        if (url) {
          var link = ui.Label({
            value: '📥 Download Full Image (' + selectedYear + ')',
            targetUrl: url,
            style: { color: '#007bff', fontWeight: 'bold' }
          });
          panel.widgets().set(6, link);
        } else {
          statusLabel.setValue('⚠ Failed to generate download link. Try ROI option or submit a request below.');
        }
      });
    }
  });

  // --- ROI Download Button ---
  var drawTools = leftMap.drawingTools();
  drawTools.setShown(true);
  drawTools.setDrawModes(['rectangle']);

  var roiDownloadBtn = ui.Button({
    label: '⬇ Generate ROI Download Link',
    style: {
      stretch: 'horizontal',
      margin: '6px',
      backgroundColor: '#2ca02c',
      color: 'black'
    },
    onClick: function() {
      statusLabel.setValue('⏳ Generating ROI download link...');
      var selectedYear = parseInt(yearSelect.getValue(), 10);
      var img = ee.Image(collection.filter(ee.Filter.eq('year', selectedYear)).first());
      var roiGeom;

      try {
        roiGeom = drawTools.layers().get(0).getEeObject();
      } catch (err) {
        statusLabel.setValue('⚠ Please draw a rectangle first.');
        return;
      }

      img.getDownloadURL({
        name: 'PPB_Classified_ROI_' + selectedYear,
        scale: 10,
        region: roiGeom,
        format: 'GEO_TIFF'
      }, function(url) {
        statusLabel.setValue('');
        if (url) {
          var link = ui.Label({
            value: '📥 Download ROI Image (' + selectedYear + ')',
            targetUrl: url,
            style: { color: '#007bff', fontWeight: 'bold' }
          });
          panel.widgets().set(6, link);
        } else {
          statusLabel.setValue('⚠ Failed to generate ROI download link.');
        }
      });
    }
  });

  // --- Email box and Request Form ---
  var emailBox = ui.Textbox({
    placeholder: 'Enter your email to request full image',
    style: { stretch: 'horizontal' }
  });

  var requestBtn = ui.Button({
    label: '📩 Submit Full Image Request',
    style: {
      stretch: 'horizontal',
      margin: '6px',
      backgroundColor: '#ffcc00',
      color: 'black'
    },
    onClick: function() {
      var userEmail = emailBox.getValue();
      if (!userEmail || userEmail.indexOf('@') === -1) {
        statusLabel.setValue('⚠ Please enter a valid email address.');
        return;
      }

      var selectedYear = parseInt(yearSelect.getValue(), 10);
      statusLabel.setValue('✅ Opening request form...');

      // --- Google Form prefill URL (public form) ---
      var baseFormURL =
        'https://docs.google.com/forms/d/e/1FAIpQLSfpRF-erlE3BP9nqIU6_ep4RaKChR1D58CnGtiUjNxD1TfXuQ/viewform?usp=pp_url' +
        '&entry.608309574=' + encodeURIComponent(userEmail) +   // email field
        '&entry.934423489=' + encodeURIComponent(selectedYear);  // year field


      var formLink = ui.Label({
        value: '📋 Open Request Form (click here)',
        targetUrl: baseFormURL,
        style: {color: '#007bff', fontWeight: 'bold'}
      });
      statusLabel.setValue('✅ Request form link generated below.');
      panel.widgets().set(6, formLink);
    }
  });

  // --- Panel layout ---
  var panel = ui.Panel({
    widgets: [
      ui.Label('🗺 Export Options (Public Download)', {
        fontWeight: 'bold',
        margin: '6px 0 4px 0'
      }),
      fullDownloadBtn,
      roiDownloadBtn,
      ui.Label('If full download fails, request it below:', {
        fontSize: '11px',
        color: '#555'
      }),
      emailBox,
      requestBtn,
      statusLabel // must remain last
    ],
    style: {
      margin: '6px 0',
      padding: '6px',
      backgroundColor: 'white',
      border: '1px solid #ddd'
    }
  });

  return panel;
}

// --- Add export panel just below selector ---
var exportPanel_Tier1 = buildExportPanel_Tier1(selector, classifiedCollection, ROI, leftMap);
leftSidebarContent.add(exportPanel_Tier1);

  var rightPanel = ui.Panel({
    widgets:[
      ui.Label('Benthic Habitat Mapping in Port Phillip Bay', {
        fontSize:'20px', fontWeight:'bold', color:'#4A997E'
      }),
      ui.Label('Percent composition and area distribution of benthic habitat classes for '+year+'.',
               {fontSize:'13px', whiteSpace:'wrap'}),
      pieChart, barChart, table
    ],
    style:{width:'400px', padding:'8px', backgroundColor:'white'}
  });
  
  // --- Right Sidebar with Full Collapse + Restore (Tier 1) ---
var rightCollapsed = false;

// Header toggle (inside the right sidebar)
var rightHeaderButton = ui.Button({
  label: '▾ Hide Sidebar',
  style: {
    fontWeight: 'bold',
    color: 'black',
    backgroundColor: '#4A997E',
    padding: '6px 8px',
    fontSize: '13px',
    border: '1px solid #2C5E50',
    textAlign: 'left',
    stretch: 'horizontal'
  },
  onClick: function() {
    rightCollapsed = !rightCollapsed;
    if (rightCollapsed) {
      rightPanel.style().set({shown: false});
      rightHeaderButton.style().set({shown: false});
      rightRestoreButton.style().set({shown: true});
    } else {
      rightPanel.style().set({shown: true});
      rightHeaderButton.setLabel('▾ Sidebar Controls');
    }
  }
});

// ✅ Wrap header in a black background container (to match left sidebar)
var rightHeaderContainer = ui.Panel({
  widgets: [rightHeaderButton],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    backgroundColor: 'black',
    margin: '0',
    padding: '0'
  }
});

// Floating restore button (identical look, top-right position)
var rightRestoreButton = ui.Button({
  label: '⬅ Show Sidebar',
  style: {
    position: 'top-right',
    backgroundColor: '#4A997E',
    color: 'black',
    fontWeight: 'bold',
    border: '1px solid #2C5E50',
    padding: '4px 8px',
    fontSize: '12px',
    margin: '6px',
    shown: false
  },
  onClick: function() {
    rightCollapsed = false;
    rightPanel.style().set({shown: true});
    rightHeaderButton.style().set({shown: true});
    rightRestoreButton.style().set({shown: false});
  }
});

// Insert the black-boxed header at the top of the right panel
rightPanel.widgets().insert(0, rightHeaderContainer);

// Attach the floating restore button to the right map area (top-right corner)
rightMap.add(ui.Panel({
  widgets: [rightRestoreButton],
  style: {
    position: 'top-right',
    padding: '0',
    margin: '6px'
  }
}));


  var layout = ui.Panel({
    widgets:[leftSidebar, split, rightPanel],
    layout: ui.Panel.Layout.flow('horizontal'),
    style:{stretch:'both'}
  });
  ui.root.add(layout);
  
  // --- Finally add the Return button at the very end ---
leftSidebarContent.add(backBtn);
  
}


// =============================
// TIER 2: TWO-YEAR COMPARISON SWIPE (Interactive Legend + Change Map + Detection)
// =============================
function buildTwoYearSwipe(year1, year2) {
  ui.root.clear();

  // --- Loader identical to Tier 1 ---
  function loadFixedClassified(year) {
    var img = ee.Image(classifiedCollection.filter(ee.Filter.eq('year', year)).first());
    var band = ee.String(img.bandNames().get(0));
    return img.select([band])
      .unmask(0)
      .round()
      .toInt16()
      .rename('classification')
      .clip(ROI)
      .set('year', year);
  }

  var class1 = loadFixedClassified(year1);
  var class2 = loadFixedClassified(year2);

  // --- Charts ---
  var year1FC = filteredFC.filter(ee.Filter.eq('year', year1));
  var year2FC = filteredFC.filter(ee.Filter.eq('year', year2));
  var join = ee.Join.inner().apply({
    primary: year1FC,
    secondary: year2FC,
    condition: ee.Filter.equals({ leftField: 'class', rightField: 'class' })
  });

  var compFC = ee.FeatureCollection(join.map(function (pair) {
    var f1 = ee.Feature(pair.get('primary'));
    var f2 = ee.Feature(pair.get('secondary'));
    var cls = f1.get('class');
    var a1 = ee.Number(f1.get('area_ha'));
    var a2 = ee.Number(f2.get('area_ha'));
    var delta = a2.subtract(a1);
    var pct = ee.Algorithms.If(a1.neq(0), a2.divide(a1).subtract(1).multiply(100), 0); // avoid nulls
    return ee.Feature(null, {
      'class': cls,
      'year1': a1,
      'year2': a2,
      'delta_area': delta,
      'delta_percent': pct
    });
  }));

  // Use actual year labels for chart/table columns
  var y1Key = String(year1);
  var y2Key = String(year2);
  var compFCPretty = compFC.map(function(f) {
    return f.set(y1Key, f.get('year1'))
            .set(y2Key, f.get('year2'));
  });

  // --- Chart Panel ---
  var groupedChart = ui.Chart.feature.byFeature({ features: compFCPretty, xProperty: 'class', yProperties: [y1Key, y2Key] })
    .setChartType('ColumnChart')
    .setOptions({
      title: 'Class Areas in ' + year1 + ' vs ' + year2,
      colors: ['#1f77b4', '#ff7f0e'],
      legend: { position: 'top' }
    });

  var deltaChart = ui.Chart.feature.byFeature({ features: compFCPretty, xProperty: 'class', yProperties: ['delta_area'] })
    .setChartType('ColumnChart')
    .setOptions({
      title: 'Δ-area (' + year1 + ' vs ' + year2 + ')',
      colors: ['#2ca02c'],
      legend: { position: 'none' }
    });

  var pctChart = ui.Chart.feature.byFeature({ features: compFCPretty, xProperty: 'class', yProperties: ['delta_percent'] })
    .setChartType('ColumnChart')
    .setOptions({
      title: '% Change (' + year1 + ' vs ' + year2 + ')',
      colors: ['#d62728'],
      legend: { position: 'none' }
    });

  var summaryTable = ui.Chart.feature.byFeature({
    features: compFCPretty,
    xProperty: 'class',
    yProperties: [y1Key, y2Key, 'delta_area', 'delta_percent']
  })
    .setChartType('Table')
    .setOptions({ allowHtml: true, title: 'Summary Table (Exact Values)' });

  var chartPanel = ui.Panel({
    widgets: [groupedChart, deltaChart, pctChart, summaryTable],
    layout: ui.Panel.Layout.flow('vertical'),
    style: { width: '400px', padding: '8px', backgroundColor: 'white' }
  });
  
  
  // --- Right Sidebar with Full Collapse + Restore (Tier 2) ---
var rightCollapsed = false;

// Header toggle (inside the right sidebar)
var rightHeaderButton = ui.Button({
  label: '▾ Hide Sidebar',
  style: {
    fontWeight: 'bold',
    color: 'black',
    backgroundColor: '#4A997E',
    padding: '6px 8px',
    fontSize: '13px',
    border: '1px solid #2C5E50',
    textAlign: 'left',
    stretch: 'horizontal'
  },
  onClick: function() {
    rightCollapsed = !rightCollapsed;
    if (rightCollapsed) {
      chartPanel.style().set({shown: false});
      rightHeaderButton.style().set({shown: false});
      rightRestoreButton.style().set({shown: true});
    } else {
      chartPanel.style().set({shown: true});
      rightHeaderButton.setLabel('▾ Sidebar Controls');
    }
  }
});

// ✅ Wrap the right header in a black background box (matches left sidebar)
var rightHeaderContainer = ui.Panel({
  widgets: [rightHeaderButton],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    backgroundColor: 'black',
    margin: '0',
    padding: '0'
  }
});

// Floating restore button (top-right)
var rightRestoreButton = ui.Button({
  label: '⬅ Show Sidebar',
  style: {
    position: 'top-right',
    backgroundColor: '#4A997E',
    color: 'black',
    fontWeight: 'bold',
    border: '1px solid #2C5E50',
    padding: '4px 8px',
    fontSize: '12px',
    margin: '6px',
    shown: false
  },
  onClick: function() {
    rightCollapsed = false;
    chartPanel.style().set({shown: true});
    rightHeaderButton.style().set({shown: true});
    rightRestoreButton.style().set({shown: false});
  }
});

// Insert the black-boxed header at the top of the right panel
chartPanel.widgets().insert(0, rightHeaderContainer);

// ✅ Add floating restore button *after* the layout (forces correct top-right alignment)
var rightRestorePanel = ui.Panel({
  widgets: [rightRestoreButton],
  style: {
    position: 'top-right',    // stays on right
    padding: '0',
    margin: '0 6px 0 0',      // ⬅ force right margin only
    backgroundColor: 'white', // keeps same look as button container
    border: '1px solid #2C5E50' // optional, to visually match black frame
  }
});


  // --- Maps ---
  var visClass = { min: 0, max: 8, palette: palette.map(function (c) { return ee.String(c).getInfo(); }) };
  var leftMap = ui.Map();
  var rightMap = ui.Map();
  ui.Map.Linker([leftMap, rightMap]);
  leftMap.centerObject(ROI, 10.7);
  rightMap.centerObject(ROI, 10.7);
  leftMap.setOptions('HYBRID');   // ✅ satellite with labels
 rightMap.setOptions('HYBRID');  // ✅ satellite with labels


  leftMap.addLayer(class1.select(0), visClass, 'Classified ' + year1);
  rightMap.addLayer(class2.select(0), visClass, 'Classified ' + year2);

  var swipeSplit = ui.SplitPanel({
    firstPanel: leftMap,
    secondPanel: rightMap,
    orientation: 'horizontal',
    wipe: true
  });

// ✅ Correct: attach restore button to the right map, not the global root
rightMap.add(ui.Panel({
  widgets: [rightRestoreButton],
  style: {
    position: 'top-right',
    padding: '0',
    margin: '6px'
  }
}));


  // =============================
  // 🔹 INTERACTIVE LEGEND (works on both maps)
  // =============================
  function buildLegendTwoMaps(map1, map2, year1, year2) {
    var legend = ui.Panel({
      style: { padding: '8px', backgroundColor: 'white', border: '1px solid #ddd', margin: '8px' }
    });

    legend.add(ui.Label('Legend (' + year1 + ' & ' + year2 + ')', {
      fontWeight: 'bold',
      fontSize: '14px',
      color: 'white',
      backgroundColor: '#4A997E',
      padding: '4px',
      textAlign: 'center',
      stretch: 'horizontal'
    }));

    var activeClasses = {};
    classInfo.forEach(function (d) { activeClasses[d.name] = true; });

    function updateComposite(map, imgYear, yearLabel) {
      var combined = ee.Image(0);
      classInfo.forEach(function (d, idx) {
        if (activeClasses[d.name]) combined = combined.add(imgYear.eq(idx));
      });
      var vis = { min: 0, max: 8, palette: palette };
      var masked = imgYear.updateMask(combined).visualize(vis);
      var layers = map.layers();
      for (var i = 0; i < layers.length(); i++) {
        if (layers.get(i).getName() === 'Classified ' + yearLabel) {
          layers.set(i, ui.Map.Layer(masked, {}, 'Classified ' + yearLabel, true));
          break;
        }
      }
    }

    function updateBoth() {
      updateComposite(map1, class1, year1);
      updateComposite(map2, class2, year2);
    }

    classInfo.forEach(function (d) {
      var colorBox = ui.Panel({
        style: {
          backgroundColor: d.color,
          width: '20px',
          height: '20px',
          margin: '0',
          padding: '0',
          border: '1px solid #555'
        }
      });

      var lbl = ui.Label({
        value: d.name,
        style: { fontSize: '12px', margin: '0 0 0 6px', color: 'black' }
      });

      var row = ui.Panel({
        widgets: [colorBox, lbl],
        layout: ui.Panel.Layout.flow('horizontal'),
        style: { margin: '2px 0', padding: '2px' }
      });

      var clicker = ui.Button({
        label: '',
        style: {
          backgroundColor: '#555555',
          border: '1px solid #333333',
          margin: '0',
          padding: '0',
          width: '15%',
          height: '8px'
        },
        onClick: function () {
          activeClasses[d.name] = !activeClasses[d.name];
          updateBoth();
          if (!activeClasses[d.name]) {
            colorBox.style().set({ backgroundColor: 'white', border: '2px solid ' + d.color });
            lbl.style().set({ color: '#888' });
          } else {
            colorBox.style().set({ backgroundColor: d.color, border: '1px solid #555' });
            lbl.style().set({ color: 'black' });
          }
        }
      });

      legend.add(ui.Panel({ widgets: [row, clicker], layout: ui.Panel.Layout.flow('vertical') }));
    });

    updateBoth();
    return legend;
  }

  var legend = buildLegendTwoMaps(leftMap, rightMap, year1, year2);

  // =============================
  // 🔹 CHANGE MAP + DETECTION
  // =============================
  var changeMap = class1.select(0).multiply(100).add(class2.select(0));
  var transitions = changeMap.reduceRegion({
    reducer: ee.Reducer.frequencyHistogram(),
    geometry: ROI,
    scale: 10,
    maxPixels: 1e13
  }).get('classification');

  var transDict = ee.Dictionary(transitions);
  var transList = transDict.keys().map(function(k) {
    k = ee.Number.parse(k);
    var from = k.divide(100).floor();
    var to = k.mod(100);
    return ee.String(classNames.get(from)).cat(' → ').cat(ee.String(classNames.get(to)));
  });
  transList = ee.List(['Show All Changes']).cat(transList);

  var changeSelect = ui.Select({
    items: transList.getInfo(),
    value: 'Show All Changes',
    style: { stretch: 'horizontal' }
  });
  var changeInfoLabel = ui.Label('', { fontSize: '13px', color: 'black' });
  changeSelect.onChange(function(choice) {
    rightMap.layers().reset();
    if (choice === 'Show All Changes') {
      rightMap.addLayer(changeMap.clip(ROI),
        { min: 0, max: 1200, palette: visClass.palette }, 'All Changes');
      changeInfoLabel.setValue('');
    } else {
      var parts = choice.split(' → ');
      var fromIdx = classNames.getInfo().indexOf(parts[0]);
      var toIdx = classNames.getInfo().indexOf(parts[1]);
      var singleTrans = changeMap.eq(fromIdx * 100 + toIdx);
      rightMap.addLayer(singleTrans.updateMask(singleTrans).clip(ROI),
        { palette: ['yellow'] }, choice);
      var area = singleTrans.multiply(ee.Image.pixelArea()).reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: ROI,
        scale: 10,
        maxPixels: 1e13
      }).get('classification');
      area.evaluate(function(val) {
        changeInfoLabel.setValue(choice + ': ' + (val ? (val / 10000).toFixed(1) : 0) + ' ha');
      });
    }
  });

  var changePanel = ui.Panel({
    widgets: [
      ui.Label('🔄 Change Detection Map', { fontWeight: 'bold' }),
      changeSelect,
      changeInfoLabel
    ],
    style: { margin: '8px 0', padding: '6px', backgroundColor: 'white', border: '1px solid #ddd' }
  });

  var changeMapCheckbox = ui.Checkbox({
    label: 'Show Change Map',
    value: false,
    onChange: function(show) {
      leftMap.layers().forEach(function(layer) {
        if (layer.getName() === 'Change Map') leftMap.layers().remove(layer);
      });
      if (show) {
        var diff = class1.neq(class2).selfMask();
        var changeVis = diff.visualize({ palette: ['red'], opacity: 0.6 });
        leftMap.addLayer(changeVis, {}, 'Change Map');
      }
    }
  });

  // =============================
  // 🔹 CONTROLS
  // =============================
  var yearList = [];
  for (var y = startYear; y <= endYear; y++) yearList.push(y.toString());
  var year1Select = ui.Select({ items: yearList, value: year1.toString(), style: { stretch: 'horizontal' } });
  var year2Select = ui.Select({ items: yearList, value: year2.toString(), style: { stretch: 'horizontal' } });
  var compareButton = ui.Button({
    label: '🔀 Update Comparison',
    style: { stretch: 'horizontal', margin: '6px' },
    onClick: function() {
      buildTwoYearSwipe(parseInt(year1Select.getValue(), 10), parseInt(year2Select.getValue(), 10));
    }
  });
  var backButton = ui.Button({
    label: '⬅ Return to Default View',
    onClick: buildDefaultView,
    style: { stretch: 'horizontal', margin: '6px' }
  });

  var selectorPanel = ui.Panel({
    widgets: [
      ui.Label('Compare Two Years', { fontWeight: 'bold' }),
      year1Select,
      year2Select,
      compareButton,
      changeMapCheckbox
    ],
    layout: ui.Panel.Layout.flow('vertical'),
    style: { margin: '8px 0', padding: '6px', backgroundColor: 'white', border: '1px solid #ddd' }
  });

  // --- Sidebar ---
  var leftSidebarContent = ui.Panel({
  widgets: [legend, selectorPanel, changePanel, backButton],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {padding: '4px', backgroundColor: 'white'}
});

// --- Left Sidebar with Full Collapse + Restore (Tier 2) ---
var collapsed = false;

// Sidebar header toggle
var headerButton = ui.Button({
  label: '▾ Hide Sidebar',
  style: {
    fontWeight: 'bold',
    color: 'black',
    backgroundColor: '#4A997E',
    padding: '6px 8px',
    fontSize: '13px',
    border: '1px solid #2C5E50',
    textAlign: 'left',
    stretch: 'horizontal'
  },
  onClick: function() {
    collapsed = !collapsed;
    if (collapsed) {
      leftSidebarContent.style().set({ shown: false });
      leftSidebar.style().set({ width: '0px', padding: '0px', margin: '0px' });
      headerButton.style().set({ shown: false });
      restoreButton.style().set({ shown: true });
    } else {
      leftSidebarContent.style().set({ shown: true });
      leftSidebar.style().set({ width: '335px', padding: '0px' });
      headerButton.setLabel('▾ Sidebar Controls');
    }
  }
});

// Floating restore button
var restoreButton = ui.Button({
  label: '➡ Show Sidebar',
  style: {
    position: 'top-left',
    backgroundColor: '#4A997E',
    color: 'black',
    fontWeight: 'bold',
    border: '1px solid #2C5E50',
    padding: '4px 8px',
    fontSize: '12px',
    margin: '6px',
    shown: false
  },
  onClick: function() {
    collapsed = false;
    leftSidebarContent.style().set({ shown: true });
    leftSidebar.style().set({ width: '335px', padding: '0px' });
    headerButton.style().set({ shown: true });
    restoreButton.style().set({ shown: false });
  }
});

// Sidebar container
var leftSidebar = ui.Panel({
  widgets: [headerButton, leftSidebarContent],
  layout: ui.Panel.Layout.flow('vertical'),
  style: {
    width: '335px',
    backgroundColor: 'black',
    margin: '0',
    padding: '0'
  }
});

// Add floating restore button to the app root (so it stays visible on map)
ui.root.add(restoreButton);


  // --- Year labels ---
  leftMap.add(ui.Label({
    value: 'Classified ' + year1,
    style: {
      backgroundColor: 'black', color: 'white', padding: '4px 8px',
      fontSize: '12px', fontWeight: 'bold', border: '1px solid black',
      position: 'bottom-left', margin: '0 0 8px 8px'
    }
  }));
  rightMap.add(ui.Label({
    value: 'Classified ' + year2,
    style: {
      backgroundColor: 'black', color: 'white', padding: '4px 8px',
      fontSize: '12px', fontWeight: 'bold', border: '1px solid black',
      position: 'bottom-right', margin: '0 8px 8px 0'
    }
  }));


  ui.root.add(ui.Panel({
    widgets: [leftSidebar, swipeSplit, chartPanel],
    layout: ui.Panel.Layout.flow('horizontal'),
    style: { stretch: 'both' }
  }));
  

}


// Add at top-level (once in your file, not inside the function):
//var text = require('users/gena/packages:text');

// =============================
// TIER 3: Animated Time-lapse (Generate button + bottom-left year text)
// =============================
function buildTier3AnimationPanel(opts) {
  // text module for drawing strings on images
  var text = require('users/gena/packages:text');

  // Optional opts from Tier 2: {start: <int>, end: <int>}
  opts = opts || {};
  var defaultStart = startYear;
  var defaultEnd   = endYear;


  // ---- Controls ----
  var fpsSlider    = ui.Slider({min: 1, max: 10, value: 2,  step: 1,  style: {stretch: 'horizontal'}});
  var sizeSlider   = ui.Slider({min: 256, max: 2048, value: 768, step: 64, style: {stretch: 'horizontal'}});
  var chipCheckbox = ui.Checkbox({label: 'Hide/Show Animated Time-lapse', value: false});
  var generateBtn  = ui.Button({
    label: '🎞️ Generate Habitat Trends Time-lapse',
    style: {stretch: 'horizontal', margin: '6px 0', backgroundColor: '#4A997E', color: 'black', fontWeight: 'bold'}
  });
  var status = ui.Label('', {fontSize: '11px', color: '#555'});

  // ---- Year range ----
  var yearItems = [];
  for (var y = defaultStart; y <= defaultEnd; y++) yearItems.push(String(y));
  var fromSelect = ui.Select({items: yearItems, value: String(opts.start || defaultStart), style: {width: '48%'}});
  var toSelect   = ui.Select({items: yearItems, value: String(opts.end   || defaultEnd  ), style: {width: '48%'}});

  function currentYearRange() {
    var s = parseInt(fromSelect.getValue(), 10);
    var e = parseInt(toSelect.getValue(),   10);
    if (e < s) { var t = s; s = e; e = t; fromSelect.setValue(String(s), false); toSelect.setValue(String(e), false); }
    return {start: s, end: e};
  }

  // ---- ROI geometry helpers (robust to ROI type) ----
  var roiGeom   = ee.FeatureCollection(ROI).geometry();
  var roiBounds = roiGeom.bounds(1);
  var ring      = ee.List(ee.List(roiBounds.coordinates()).get(0));
  var ll        = ee.List(ring.get(0)); // lower-left
  var ur        = ee.List(ring.get(2)); // upper-right
  var minX      = ee.Number(ll.get(0));
  var minY      = ee.Number(ll.get(1));
  var maxX      = ee.Number(ur.get(0));
  var maxY      = ee.Number(ur.get(1));

  // Optional corner chip (visual marker) — no .boundary()
  var chipWidth   = maxX.subtract(minX).multiply(0.04);
  var chipHeight  = maxY.subtract(minY).multiply(0.07);
  var labelChip   = ee.Geometry.Rectangle([minX, maxY.subtract(chipHeight), minX.add(chipWidth), maxY], null, false)
                    .intersection(roiGeom, ee.ErrorMargin(1));

  // Bottom-left text anchor (with a small inset)
  var insetX = maxX.subtract(minX).multiply(0.04); // 1% inward
  var insetY = maxY.subtract(minY).multiply(0.04); // 2% upward
  var textPointBL = ee.Geometry.Point([minX.add(insetX), minY.add(insetY)]);

  // Text rendering scale (meters/px). Adjust if text looks too small/large.
  var textScaleM = 100;

  // ---- Visualized IC builder with bottom-left YEAR text ----
  function makeVisIC(showChip, yrStart, yrEnd) {
    var vis = {min: 0, max: 8, palette: palette};

    var frames = ee.List.sequence(yrStart, yrEnd).map(function(y) {
      y = ee.Number(y);
      var yearStr = ee.Number(y).toInt().format();   // ensures "2021" not "2021.0"

      var img    = ee.Image(classifiedCollection.filter(ee.Filter.eq('year', y)).first());
      var visImg = img.visualize(vis);

      if (showChip) {
        var chipRGB = ee.Image.constant([255, 255, 255])
          .rename(['vis-red','vis-green','vis-blue'])
          .paint(labelChip, 1, 0)
          .selfMask();
        visImg = visImg.blend(chipRGB);
      }

      // ✅ Correct call: text.draw(textString, positionGeom, scaleMetersPerPixel, style, regionOpt)
      var yearTextImg = text.draw(
        yearStr,                  // ee.String for the current year
        textPointBL,              // bottom-left anchor geometry
        textScaleM = 200,               // scale in meters per pixel
        { fontSize: 18, textColor: 'ffffff', outlineWidth: 5, outlineColor: '000000' },
        roiGeom                   // optional region to limit rendering
      );

      return visImg.blend(yearTextImg).set({'year': y, 'label': yearStr});
    });

    return ee.ImageCollection(frames).sort('year');
  }

  // ---- Thumbnail + MP4 link (no map side-effects) ----
  var thumb = ui.Thumbnail({
    image: ee.ImageCollection([]), // set on generate
    params: {
      region: roiGeom,
      framesPerSecond: fpsSlider.getValue(),
      dimensions: sizeSlider.getValue()
    },
    style: {width: '100%', height: 'auto', margin: '6px 0', backgroundColor: 'black'}
  });

  var linksPanel = ui.Panel([], ui.Panel.Layout.flow('vertical'));

  function generate() {
    status.setValue('Generating preview & download link…');

    var r = currentYearRange();
    var ic = makeVisIC(chipCheckbox.getValue(), r.start, r.end);

    var params = {
      region: roiGeom,
      framesPerSecond: fpsSlider.getValue(),
      dimensions: sizeSlider.getValue()
    };

    thumb.setImage(ic);
    thumb.setParams(params);

    ic.getVideoThumbURL(params, function(url) {
      linksPanel.clear();
      if (url) {
        status.setValue('');
        linksPanel.add(ui.Label({
          value: '📥 Click to view in a new tab',
          targetUrl: url,
          style: {color:'#1a73e8', fontWeight:'bold', margin:'4px 0'}
        }));
      } else {
        status.setValue('⚠ Could not generate a video URL.');
      }
    });
  }

  // ---- Events ----
  generateBtn.onClick(generate);
  fpsSlider.onChange(generate);
  sizeSlider.onChange(generate);
  chipCheckbox.onChange(generate);
  fromSelect.onChange(generate);
  toSelect.onChange(generate);

  // ---- Layout ----
  var rangeRow = ui.Panel([fromSelect, toSelect], ui.Panel.Layout.flow('horizontal'));

  var panel = ui.Panel({
    widgets: [
      ui.Label('🎬 Animated Time-lapse', {fontWeight: 'bold'}),
      ui.Label('Year range'),
      rangeRow,
      ui.Label('Frames/sec'), fpsSlider,
      ui.Label('Pixel size (long side, px)'), sizeSlider,
      chipCheckbox,
      generateBtn,
      thumb,
      linksPanel,
      status
    ],
    style: {padding: '10px', backgroundColor: 'white', border: '2px solid #ddd'}
  });

  // Initial render
  generate();
  return panel;
}


//var documentationPanel = buildDocumentationPanel();
//ui.root.insert(0, documentationPanel);


// ----------------------------
// INITIATE DASHBOARD with Default View
// -----------------------------

// DEVELOPMENT OVERRIDE: Enhanced ROI Inspector with single-year and two-year modes.
// This function intentionally overrides the earlier buildROIInspectorPanel declaration.
function buildROIInspectorPanel(mapMain, classifiedCollection, ROI) {
  var title = ui.Label('ROI Inspector (Default View)', {
    fontWeight: 'bold',
    fontSize: '14px',
    margin: '0 0 6px 0'
  });

  var help = ui.Label(
    'Draw one ROI, then analyse either the currently visible year or compare two selected years.\n' +
    'Comparison mode reports class area in each year, net change and class-to-class transitions.',
    {fontSize: '11px', color: '#555', whiteSpace: 'pre-wrap', margin: '0 0 8px 0'}
  );

  var modeSelect = ui.Select({
    items: ['Single year', 'Compare two years'],
    value: 'Single year',
    style: {stretch: 'horizontal'}
  });

  var yearItems = years.getInfo().map(function(y) { return String(y); });
  var year1Select = ui.Select({
    items: yearItems,
    value: String(startYear),
    style: {stretch: 'horizontal'}
  });
  var year2Select = ui.Select({
    items: yearItems,
    value: String(endYear),
    style: {stretch: 'horizontal'}
  });

  var yearPairPanel = ui.Panel({
    widgets: [
      ui.Label('Year 1 (baseline):', {fontSize: '11px', margin: '4px 0 2px 0'}),
      year1Select,
      ui.Label('Year 2 (comparison):', {fontSize: '11px', margin: '4px 0 2px 0'}),
      year2Select
    ],
    style: {shown: false, margin: '0 0 6px 0'}
  });

  var activeYearLabel = ui.Label('Active year: (auto-detect)', {
    fontSize: '12px',
    fontWeight: 'bold',
    margin: '4px 0 8px 0'
  });

  var drawModeSelect = ui.Select({
    items: ['rectangle', 'polygon'],
    value: 'rectangle',
    style: {stretch: 'horizontal'}
  });

  var statusLabel = ui.Label('Ready. Draw an ROI and click Analyze.', {
    fontSize: '11px',
    color: '#555',
    whiteSpace: 'pre-wrap',
    margin: '6px 0 0 0'
  });
  var totalAreaLabel = ui.Label('Total ROI area: (not computed)', {
    fontSize: '12px',
    margin: '6px 0 0 0'
  });
  var seagrassTransitionLabel = ui.Label('', {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#8b0000',
    margin: '6px 0 0 0',
    shown: false
  });

  var chartPanel = ui.Panel({style: {margin: '8px 0 0 0'}});
  var summaryTablePanel = ui.Panel({style: {margin: '8px 0 0 0'}});
  var transitionTablePanel = ui.Panel({style: {margin: '8px 0 0 0'}});

  var drawTools = mapMain.drawingTools();
  drawTools.setShown(true);
  drawTools.setDrawModes(['rectangle', 'polygon']);

  function clearDrawingLayers() {
    var layers = drawTools.layers();
    while (layers.length() > 0) {
      layers.remove(layers.get(0));
    }
  }

  function clearOutputs() {
    chartPanel.clear();
    summaryTablePanel.clear();
    transitionTablePanel.clear();
    totalAreaLabel.setValue('Total ROI area: (not computed)');
    seagrassTransitionLabel.setValue('');
    seagrassTransitionLabel.style().set('shown', false);
  }

  function getActiveYearFromVisibleLayer() {
    var activeYear = null;
    mapMain.layers().forEach(function(layer) {
      var nm = String(layer.getName());
      if (layer.getShown() && nm.indexOf('Classified ') === 0) {
        var y = parseInt(nm.split(' ')[1], 10);
        if (!isNaN(y)) activeYear = y;
      }
    });
    return activeYear;
  }

  function getDrawnGeometry() {
    var layers = drawTools.layers();
    if (layers.length() === 0) return null;
    var geom = layers.get(0).getEeObject();
    var roiGeom = ee.FeatureCollection(ROI).geometry();
    return ee.Geometry(geom).intersection(roiGeom, ee.ErrorMargin(1));
  }

  function getClassImage(year) {
    var img = ee.Image(classifiedCollection.filter(ee.Filter.eq('year', year)).first());
    return img.select([img.bandNames().get(0)]).rename('classification').toInt();
  }

  function getAreaDictionary(classImage, geom) {
    var areaImg = ee.Image.pixelArea().divide(10000).rename('area').addBands(classImage);
    var result = areaImg.reduceRegion({
      reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'class'}),
      geometry: geom,
      scale: 10,
      maxPixels: 1e13,
      tileScale: 4
    });
    var groups = ee.List(ee.Algorithms.If(result.contains('groups'), result.get('groups'), ee.List([])));
    return ee.Dictionary(groups.iterate(function(group, accumulator) {
      group = ee.Dictionary(group);
      var key = ee.Number(group.get('class')).format('%d');
      return ee.Dictionary(accumulator).set(key, group.get('sum'));
    }, ee.Dictionary({})));
  }

  function getArea(areaDictionary, classId) {
    var key = ee.Number(classId).format('%d');
    return ee.Number(ee.Algorithms.If(areaDictionary.contains(key), areaDictionary.get(key), 0));
  }

  function getTotalArea(geom) {
    var result = ee.Image.pixelArea().divide(10000).rename('area').reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geom,
      scale: 10,
      maxPixels: 1e13,
      tileScale: 4
    });
    return ee.Number(result.get('area'));
  }

  function updateTotalArea(geom) {
    getTotalArea(geom).evaluate(function(value) {
      if (value === null || value === undefined) {
        totalAreaLabel.setValue('Total ROI area: (could not compute)');
      } else {
        totalAreaLabel.setValue('Total ROI area: ' + Number(value).toFixed(2) + ' ha');
      }
    });
  }

  function makeSingleYearFeatures(year, geom) {
    var areaDictionary = getAreaDictionary(getClassImage(year), geom);
    var classIds = ee.List.sequence(0, classInfo.length - 1);
    var totalMappedArea = ee.Number(classIds.map(function(classId) {
      return getArea(areaDictionary, classId);
    }).reduce(ee.Reducer.sum()));

    return ee.FeatureCollection(classIds.map(function(classId) {
      classId = ee.Number(classId);
      var areaHa = getArea(areaDictionary, classId);
      var percent = ee.Number(ee.Algorithms.If(
        totalMappedArea.gt(0), areaHa.divide(totalMappedArea).multiply(100), 0
      ));
      return ee.Feature(null, {
        class: classNames.get(classId),
        area_ha: areaHa,
        percent_area: percent,
        year: year
      });
    }));
  }

  function analyseSingleYear(year, geom) {
    var features = makeSingleYearFeatures(year, geom);
    activeYearLabel.setValue('Active year: ' + year);

    var pie = ui.Chart.feature.byFeature(features, 'class', 'percent_area')
      .setChartType('PieChart')
      .setOptions({
        title: 'Percent Composition (ROI) - ' + year,
        legend: {position: 'right'},
        colors: palette,
        chartArea: {left: 10, top: 40, width: '95%', height: '75%'}
      });
    var table = ui.Chart.feature.byFeature(features, 'class', ['area_ha', 'percent_area'])
      .setChartType('Table')
      .setOptions({allowHtml: true, title: 'ROI Summary Table - ' + year});

    chartPanel.clear();
    summaryTablePanel.clear();
    transitionTablePanel.clear();
    chartPanel.add(pie);
    summaryTablePanel.add(table);
    seagrassTransitionLabel.style().set('shown', false);
    statusLabel.setValue('Done. Single-year ROI summary calculated for ' + year + '.');
  }

  function makeComparisonFeatures(year1, year2, geom) {
    var areas1 = getAreaDictionary(getClassImage(year1), geom);
    var areas2 = getAreaDictionary(getClassImage(year2), geom);
    var classIds = ee.List.sequence(0, classInfo.length - 1);

    return ee.FeatureCollection(classIds.map(function(classId) {
      classId = ee.Number(classId);
      var area1 = getArea(areas1, classId);
      var area2 = getArea(areas2, classId);
      var changeHa = area2.subtract(area1);
      var changePct = ee.Algorithms.If(
        area1.gt(0), changeHa.divide(area1).multiply(100), null
      );
      return ee.Feature(null, {
        class: classNames.get(classId),
        year_1_ha: area1,
        year_2_ha: area2,
        change_ha: changeHa,
        change_percent: changePct
      });
    }));
  }

  function makeTransitionFeatures(year1, year2, geom) {
    var class1 = getClassImage(year1);
    var class2 = getClassImage(year2);
    var transition = class1.multiply(100).add(class2).rename('transition');
    var areaImg = ee.Image.pixelArea().divide(10000).rename('area').addBands(transition);
    var result = areaImg.reduceRegion({
      reducer: ee.Reducer.sum().group({groupField: 1, groupName: 'transition'}),
      geometry: geom,
      scale: 10,
      maxPixels: 1e13,
      tileScale: 4
    });
    var groups = ee.List(ee.Algorithms.If(result.contains('groups'), result.get('groups'), ee.List([])));

    return ee.FeatureCollection(groups.map(function(group) {
      group = ee.Dictionary(group);
      var code = ee.Number(group.get('transition')).toInt();
      var fromId = code.divide(100).floor();
      var toId = code.mod(100);
      return ee.Feature(null, {
        transition: ee.String(classNames.get(fromId)).cat(' -> ').cat(ee.String(classNames.get(toId))),
        from_class: fromId,
        to_class: toId,
        area_ha: ee.Number(group.get('sum'))
      });
    }))
      .filter(ee.Filter.notEquals({leftField: 'from_class', rightField: 'to_class'}))
      .filter(ee.Filter.gt('area_ha', 0.01))
      .sort('area_ha', false);
  }

  function updateSeagrassToSediment(year1, year2, geom) {
    var class1 = getClassImage(year1);
    var class2 = getClassImage(year2);
    var seagrassToSediment = ee.Image.pixelArea().divide(10000).rename('area')
      .updateMask(class1.eq(3).and(class2.eq(6)))
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: geom,
        scale: 10,
        maxPixels: 1e13,
        tileScale: 4
      }).get('area');

    ee.Number(ee.Algorithms.If(seagrassToSediment, seagrassToSediment, 0)).evaluate(function(value) {
      seagrassTransitionLabel.setValue(
        'Seagrass -> Sediment transition: ' + Number(value || 0).toFixed(2) + ' ha'
      );
      seagrassTransitionLabel.style().set('shown', true);
    });
  }

  function analyseComparison(year1, year2, geom) {
    var comparisonFeatures = makeComparisonFeatures(year1, year2, geom);
    var transitionFeatures = makeTransitionFeatures(year1, year2, geom);

    var comparisonTable = ui.Chart.feature.byFeature(
      comparisonFeatures,
      'class',
      ['year_1_ha', 'year_2_ha', 'change_ha', 'change_percent']
    ).setChartType('Table').setOptions({
      allowHtml: true,
      title: 'Class area comparison: ' + year1 + ' vs ' + year2
    });

    var transitionTable = ui.Chart.feature.byFeature(
      transitionFeatures.limit(25),
      'transition',
      ['area_ha']
    ).setChartType('Table').setOptions({
      allowHtml: true,
      title: 'Largest class-to-class changes (unchanged pixels excluded)'
    });

    chartPanel.clear();
    summaryTablePanel.clear();
    transitionTablePanel.clear();
    summaryTablePanel.add(comparisonTable);
    transitionTablePanel.add(transitionTable);
    updateSeagrassToSediment(year1, year2, geom);
    statusLabel.setValue(
      'Done. Positive change means class area increased in Year 2; negative means it decreased. ' +
      'Percent change is blank when Year 1 area is zero.'
    );
  }

  function analyseROI() {
    statusLabel.setValue('Computing ROI statistics...');
    var geom = getDrawnGeometry();
    if (geom === null) {
      statusLabel.setValue('No ROI drawn. Click Draw ROI first.');
      return;
    }
    updateTotalArea(geom);

    if (modeSelect.getValue() === 'Compare two years') {
      var year1 = parseInt(year1Select.getValue(), 10);
      var year2 = parseInt(year2Select.getValue(), 10);
      if (year1 === year2) {
        statusLabel.setValue('Choose two different years for comparison.');
        return;
      }
      analyseComparison(year1, year2, geom);
      return;
    }

    var activeYear = getActiveYearFromVisibleLayer();
    if (activeYear === null) {
      activeYearLabel.setValue('Active year: (none detected)');
      statusLabel.setValue('No visible Classified YYYY layer detected. Turn one on, then Analyze again.');
      return;
    }
    analyseSingleYear(activeYear, geom);
  }

  var drawBtn = ui.Button({
    label: 'Draw ROI',
    style: {stretch: 'horizontal', margin: '6px 0'},
    onClick: function() {
      clearDrawingLayers();
      drawTools.setShape(drawModeSelect.getValue());
      drawTools.draw();
      statusLabel.setValue('Drawing mode ON. Draw on map, then click Analyze.');
    }
  });

  var analyzeBtn = ui.Button({
    label: 'Analyze ROI',
    style: {stretch: 'horizontal', margin: '6px 0'},
    onClick: analyseROI
  });

  var clearBtn = ui.Button({
    label: 'Clear ROI',
    style: {stretch: 'horizontal', margin: '6px 0'},
    onClick: function() {
      clearDrawingLayers();
      clearOutputs();
      statusLabel.setValue('ROI cleared. Draw a new ROI and click Analyze.');
    }
  });

  modeSelect.onChange(function(mode) {
    var compareMode = mode === 'Compare two years';
    yearPairPanel.style().set('shown', compareMode);
    activeYearLabel.style().set('shown', !compareMode);
    clearOutputs();
    statusLabel.setValue(compareMode ?
      'Select two years, draw one ROI and click Analyze.' :
      'Single-year mode uses the currently visible Classified YYYY layer.');
  });

  var activeYear = getActiveYearFromVisibleLayer();
  activeYearLabel.setValue(activeYear === null ?
    'Active year: (none detected)' : 'Active year: ' + activeYear);

  return ui.Panel({
    widgets: [
      title,
      help,
      ui.Label('Analysis mode:', {fontSize: '12px', margin: '0 0 4px 0'}),
      modeSelect,
      activeYearLabel,
      yearPairPanel,
      ui.Label('Draw mode:', {fontSize: '12px', margin: '0 0 4px 0'}),
      drawModeSelect,
      drawBtn,
      analyzeBtn,
      clearBtn,
      totalAreaLabel,
      seagrassTransitionLabel,
      chartPanel,
      summaryTablePanel,
      transitionTablePanel,
      statusLabel
    ],
    style: {
      padding: '8px',
      backgroundColor: 'white',
      border: '1px solid #ddd',
      margin: '8px'
    }
  });
}


buildDefaultView();


