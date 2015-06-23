class SeismoMain {

  constructor($scope, $http, $location, SeismoStationMap,
    SeismoImageMap, SeismoQuery, SeismoServer,
    SeismoData, SeismoEditor, SeismoHistogram,
    SeismoStatus, PieOverlay, Loading) {

    // debug
    //window.SeismoStationMap = SeismoStationMap;
    //window.SeismoImageMap = SeismoImageMap;
    //window.SeismoQuery = SeismoQuery;

    // add maps and services to scope
    $scope.SeismoStationMap = SeismoStationMap;
    $scope.SeismoImageMap = SeismoImageMap;
    $scope.SeismoHistogram = SeismoHistogram;
    $scope.SeismoData = SeismoData;
    $scope.SeismoEditor = SeismoEditor;
    $scope.SeismoStatus = SeismoStatus;
    $scope.PieOverlay = PieOverlay;
    $scope.Loading = Loading;

    $scope.viewSeismogram = (file) => {
      $scope.showImageMap();
      $scope.startUpdatingUrl();
      SeismoImageMap.loadImage(file);
    };

    $scope.stopViewingSeismogram = () => {
      $scope.stopUpdatingUrl();
      $scope.hideImageMap();
      $scope.updateUrlParams();
    }

    $scope.startProcessing = () => {
      var file = SeismoImageMap.currentFile;
      $http({ url: SeismoServer.processingUrl + "/" + file.name });
    };

    $scope.isProcessing = () => {
      var file = SeismoImageMap.currentFile;
      return file && SeismoStatus.is(file.status, "Processing");
    };

    $scope.canProcess = () => {
      var file = SeismoImageMap.currentFile;
      return file &&
        SeismoData.isLongPeriod(file) &&
        SeismoImageMap.imageIsLoaded &&
        (SeismoStatus.is(file.status, "Not Started") ||
        SeismoStatus.is(file.status, "Failed"));
    };

    $scope.canEdit = () => {
      var file = SeismoImageMap.currentFile;
      return file && (SeismoStatus.is(file.status, "Complete") ||
                      SeismoStatus.is(file.status, "Edited"));
    };

    $scope.logShowing = false;
    $scope.log = "";

    $scope.hasLog = () => {
      var file = SeismoImageMap.currentFile;
      return file && (SeismoStatus.is(file.status, "Complete") ||
                      SeismoStatus.is(file.status, "Edited") ||
                      SeismoStatus.is(file.status, "Failed"));
    };

    $scope.showLog = () => {
      var file = SeismoImageMap.currentFile;
      var token = Math.random();
      var url = "logs/" + file.name + ".txt?token="+token;

      $scope.log = "";

      $http({url: url}).then((res) => {
        $scope.log = res.data;
      }).catch(() => {
        $scope.log = "A log is not available for this file...";
      }).then(() => {
        $scope.logShowing = true;
      });
    };

    $scope.hideLog = () => {
      $scope.logShowing = false;
    };

    $scope.imageMapVisible = false;

    $scope.showImageMap = () => {
      $scope.imageMapVisible = true;
    };

    $scope.hideImageMap = () => {
      $scope.imageMapVisible = false;
    };

    $scope.queryStationStatuses = () => {
      $scope.updateUrlParams();
      Loading.start("Loading results...");
      return SeismoQuery.queryFiles($scope.queryParamModel)
        .then((res) => {
          console.log("Query complete.", res.data);
          $scope.update(res.data);
          Loading.stop("Loading results...");
        });
    };

    $scope.update = (data) => {
      // update SeismoData
      SeismoData.files = data.files;
      SeismoData.stationStatuses = data.stations;

      // update SeismoStationMap
      SeismoStationMap.updateBounds();

      // update PieOverlay
      PieOverlay.renderStatuses();

      // update SeismoHistogram
      SeismoHistogram.renderOverlay(data.histogram);
    };

    $scope.updateUrlParams = () => {
      var map = SeismoImageMap.leafletMap,
          file = SeismoImageMap.currentFile,
          center = map.getCenter(),
          zoom = map.getZoom();

      var imageParams = {};
      if (file && $scope.imageMapVisible) {
        imageParams = {
          name: file.name,
          lat: center.lat,
          lng: center.lng,
          zoom: zoom
        };
      }

      var queryParams = escapeQueryParams($scope.queryParamModel);

      $location.search(_.extend(queryParams, imageParams));
    }

    $scope.getImageParamsFromUrl = () => {
      var imageParamKeys = {
        name: "",
        lat: "",
        lng: "",
        zoom: ""
      };

      var imageParams = filterObject($location.search(), imageParamKeys);

      if (_.isEmpty(imageParams)) {
        return null;
      }
      
      return imageParams;
    }

    $scope.getQueryParamsFromUrl = () => {
      var queryParamKeys = {
        dateFrom: "",
        dateTo: "",
        numBins: "",
        stationNames: "",
        fileNames: "",
        status: ""
      };
      
      var queryParams = filterObject($location.search(), queryParamKeys);
      
      if (_.isEmpty(queryParams)) {
        return null;
      }

      return unescapeQueryParams(queryParams);
    }

    $scope.startUpdatingUrl = () => {
      SeismoImageMap.leafletMap.on("moveend", $scope.updateUrlParams);
    }

    $scope.stopUpdatingUrl = () => {
      SeismoImageMap.leafletMap.off("moveend", $scope.updateUrlParams);
    }

    $scope.initQueryModel = (queryModel) => {
      var defaultQueryModel = {
        dateFrom: "",
        dateTo: "",
        numBins: 200,
        stationNames: "",
        fileNames: "",
        status: {}
      };

      $scope.SeismoStatus.statuses.forEach((status) => {
        defaultQueryModel.status[status.code] = true;
      });

      $scope.queryParamModel = _.extend(defaultQueryModel, queryModel);
    }

    $scope.init = () => {
      // parse url search string
      var initialQueryParams = $scope.getQueryParamsFromUrl(),
          imageParams = $scope.getImageParamsFromUrl();

      // perform initial queries to fetch low/high dates,
      // histogram, and station info
      SeismoQuery.initialQuery()
        .then((res) => {
          console.log("Initial query complete.", res);

          // stations are loaded; render station backgrounds
          var stationsResult = res.stations.data;
          $scope.SeismoData.stations = stationsResult;
          $scope.PieOverlay.renderStations();

          // files stats are loaded; render histogram background
          var seismoResult = res.seismograms.data,
              lowDate = new Date(seismoResult.lowDate),
              highDate = new Date(seismoResult.highDate),
              numBins = seismoResult.numBins,
              data = seismoResult.histogram;
          SeismoHistogram.initBackground(lowDate, highDate, numBins, data);
              
          if (!initialQueryParams) {
            // no query parameters passed in with the url; use results from files query
            initialQueryParams = { dateFrom: lowDate, dateTo: highDate, numBins: numBins };
          }

          $scope.initQueryModel(initialQueryParams);
          return $scope.queryStationStatuses();
        })
        .then(() => {
          // if a specific seismogram is linked in the url, show the seismo
          if (imageParams) {
            // but first wait for the base layer to start loading
            // otherwise rendering gets weird
            SeismoStationMap.map.currentBaseLayer.leafletLayer.once("loading", () => {
              var center = [parseInt(imageParams.lat), parseInt(imageParams.lng)],
                  zoom = imageParams.zoom;

              var curSeismo = SeismoData.files.find((file) => file.name === imageParams.name);
              $scope.viewSeismogram(curSeismo);
              
              SeismoImageMap.leafletMap.setView(center, zoom);
            });
          }
        });
    };

    $scope.init();
  }

}

function filterObject(object, template) {
  var filteredObj = {};
  for (var key in object) {
    if (key in template) {
      filteredObj[key] = object[key];
    }
  }
  return filteredObj;
}

function escapeQueryParams(queryParams) {
  return _.extend(_.clone(queryParams), {
    dateFrom: new Date(queryParams.dateFrom).toJSON(),
    dateTo: new Date(queryParams.dateTo).toJSON(),
    status: Object.keys(queryParams.status)
      .filter((key) => queryParams.status[key] === true).join(",")
  });
}

function unescapeQueryParams(queryParams) {
  return _.extend(_.clone(queryParams), {
    dateFrom: new Date(queryParams.dateFrom).toString(),
    dateTo: new Date(queryParams.dateTo).toString(),
    status: _.object(_.map(queryParams.status.split(","), (val) => [val, true]))
  });
}

export { SeismoMain };
