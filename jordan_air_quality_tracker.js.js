/**
 * ==================================================================================
 * 🌫️ Jordan Air Quality Tracker (Sentinel-5P TROPOMI)
 * ==================================================================================
 * @Author: Osama Al-Qawasmeh / Yarmouk University
 * @Project: Air Quality Monitoring System for Jordan
 * @Dataset: Copernicus Sentinel-5P TROPOMI Level 3
 * ==================================================================================
 */

// 1. Setup
Map.setCenter(36.5, 31.2, 7);
Map.setOptions('HYBRID');

var jordanBoundary = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    .filter(ee.Filter.eq("country_na", "Jordan"));

var gasConfigs = {
  "Nitrogen Dioxide (NO2)": {
    "collection": "COPERNICUS/S5P/OFFL/L3_NO2",
    "band": "tropospheric_NO2_column_number_density",
    "min": 0, "max": 0.0002, "unit": "mol/m²",
    "palette": ['black', 'blue', 'purple', 'cyan', 'green', 'yellow', 'red']
  },
  "Sulfur Dioxide (SO2)": {
    "collection": "COPERNICUS/S5P/OFFL/L3_SO2",
    "band": "SO2_column_number_density",
    "min": 0, "max": 0.0005, "unit": "mol/m²",
    "palette": ['blue', 'green', 'yellow', 'orange', 'red']
  },
  "Carbon Monoxide (CO)": {
    "collection": "COPERNICUS/S5P/OFFL/L3_CO",
    "band": "CO_column_number_density",
    "min": 0, "max": 0.05, "unit": "mol/m²",
    "palette": ['black', 'blue', 'purple', 'cyan', 'green', 'yellow', 'red']
  },
  "Aerosol Index (Dust/Smoke)": {
    "collection": "COPERNICUS/S5P/OFFL/L3_AER_AI",
    "band": "absorbing_aerosol_index",
    "min": -1, "max": 2, "unit": "Index",
    "palette": ['black', 'blue', 'purple', 'cyan', 'green', 'yellow', 'red']
  }
};

// 2. UI Sidebar
var panel = ui.Panel({style: {width: '380px'}});
ui.root.add(panel);

panel.add(ui.Label('🌫️ Jordan Air Quality Tracker', {fontSize: '20px', fontWeight: 'bold'}));
panel.add(ui.Label('Sentinel-5P Satellite Analysis', {color: 'gray'}));

panel.add(ui.Label('Select Air Pollutant:'));
var pollutantSelect = ui.Select({
  items: Object.keys(gasConfigs),
  value: "Nitrogen Dioxide (NO2)",
  onChange: updateAnalysis
});
panel.add(pollutantSelect);

panel.add(ui.Label('Select Year:'));
var yearSlider = ui.Slider({min: 2019, max: 2026, value: 2025, step: 1, onChange: updateAnalysis, style: {stretch: 'horizontal'}});
panel.add(yearSlider);

panel.add(ui.Label('Select Month:'));
var monthSlider = ui.Slider({min: 1, max: 12, value: 1, step: 1, onChange: updateAnalysis, style: {stretch: 'horizontal'}});
panel.add(monthSlider);

var statsPanel = ui.Panel();
panel.add(statsPanel);

// 3. Main Function
function updateAnalysis() {
  Map.layers().reset();
  statsPanel.clear();
  
  var pollutant = pollutantSelect.getValue();
  var year = yearSlider.getValue();
  var month = monthSlider.getValue();
  var config = gasConfigs[pollutant];
  
  var startDate = ee.Date.fromYMD(year, month, 1);
  var endDate = startDate.advance(1, 'month');
  
  var image = ee.ImageCollection(config.collection)
    .filterDate(startDate, endDate)
    .select(config.band)
    .mean()
    .clip(jordanBoundary);
  
  Map.addLayer(jordanBoundary, {color: 'white'}, 'Jordan Boundary');
  Map.addLayer(image, {min: config.min, max: config.max, palette: config.palette}, pollutant);
  
  // 4. Bar Chart Generation
  var locations = {
    "Irbid": [35.85, 32.55],
    "Amman": [35.92, 31.95],
    "Zarqa": [36.10, 32.06],
    "Aqaba": [35.00, 29.53],
    "Mafraq": [36.24, 32.34]
  };

  var cityFeatures = ee.FeatureCollection(
    Object.keys(locations).map(function(city) {
      var point = ee.Geometry.Point(locations[city]);
      var meanVal = image.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: point,
        scale: 7000
      }).get(config.band);
      return ee.Feature(null, {'City': city, 'Pollution': meanVal});
    })
  );

  var chart = ui.Chart.feature.byFeature(cityFeatures, 'City', 'Pollution')
    .setChartType('ColumnChart')
    .setOptions({
      title: 'Pollution Comparison (' + config.unit + ')',
      legend: {position: 'none'},
      hAxis: {title: 'City'},
      vAxis: {title: 'Level'},
      colors: ['#e74c3c']
    });

  statsPanel.add(ui.Label('📊 Statistical Report', {fontWeight: 'bold'}));
  statsPanel.add(chart);

  // 5. Scientific Insight
  var insight = (pollutant.indexOf("Nitrogen") !== -1) ? "🚗 NO₂: Sources include traffic and fuel combustion." :
                (pollutant.indexOf("Sulfur") !== -1) ? "🏭 SO₂: Industrial emissions and power plants." :
                (pollutant.indexOf("Carbon") !== -1) ? "🔥 CO: Incomplete combustion in urban areas." :
                "🏜️ Aerosol Index: Dust and smoke transport.";
  
  statsPanel.add(ui.Label(insight, {fontSize: '12px', color: 'gray', fontStyle: 'italic'}));

  // 6. Export Button
  var exportButton = ui.Button({
    label: '💾 Export Map (GeoTIFF) to Drive',
    style: {stretch: 'horizontal', color: 'darkblue'},
    onClick: function() {
      var description = 'Jordan_AQ_' + pollutant.split(' ')[0] + '_' + year + '_' + month;
      Export.image.toDrive({
        image: image,
        description: description,
        scale: 7000,
        region: jordanBoundary.geometry().bounds(),
        fileFormat: 'GeoTIFF',
        maxPixels: 1e9
      });
      print('🚀 Task started: Check the "Tasks" tab on the right.');
    }
  });
  statsPanel.add(exportButton);
}

// Start
updateAnalysis();