var express = require("express");
var router = express.Router();
var mongo = require("mongodb").MongoClient;
var async = require("async");

var connect = function(cb) {
  mongo.connect("mongodb://localhost/seismo", cb);
};

var cache = {
  on: true,
  cache: {},
  key: function(query) {
    return ["dateFrom", "dateTo", "status", "edited", "stationIds", "page"]
      .map(function(field) { return query[field]; }).join("_");
  },
  hit: function(query) {
    return this.on ? this.cache[this.key(query)] : null;
  },
  put: function(query, payload) {
    var key = this.key(query);
    this.cache[key] = payload;
  }
};

router.get("/stations", function(req, res, next) {
  async.waterfall([
    connect,
    function(db, cb) {
      var stations = db.collection("stations");
      stations.find({}).toArray(cb);
    },
    function(stations, cb) {
      res.send(stations);
      cb(null);
    }
  ], function(err) {
    if (err) next(err);
  });
});

router.get("/files", function(req, res, next) {
  console.log("--- processing files query ---", req.query);
  var hit = cache.hit(req.query);
  if (hit) {
    console.log("result is cached");
    res.send(hit);
    return;
  }
  var edited = req.query.edited;
  var dateFrom = new Date(req.query.dateFrom);
  var dateTo = new Date(req.query.dateTo);

  // result paging
  var page = parseInt(req.query.page) || 1;
  var pageSize = 40;

  // station ids to match. If no ids are provided, all ids are matched
  var stationIds = [];
  if (req.query.stationIds) {
    stationIds = req.query.stationIds.split(",").map(function(stationId) {
      return stationId.trim();
    });
  }

  var status = [];
  if (req.query.status) {
    status = req.query.status.split(",").reduce(function(acc, status) {
      var cleanedUpStatus = parseInt(status.trim());
      if (!isNaN(cleanedUpStatus)) {
        acc.push(cleanedUpStatus);
      }
      return acc;
    }, []);
  }

  // build the query.
  // queryComponents is a list of clauses that will be $and-ed together
  var queryComponents = [];

  // the date range
  var dateComponents = {};
  // the image date should be greater or equal to datFrom (lower bound)
  if (dateFrom.toString() !== "Invalid Date") dateComponents.$gte = dateFrom;
  // and less than or equal to dateTo (upper bound)
  if (dateTo.toString() !== "Invalid Date") dateComponents.$lte = dateTo;
  if (Object.keys(dateComponents).length > 0) queryComponents.push({date: dateComponents});

  // edited bit
  if (edited) {
    var editedValue = JSON.parse(edited);
    if (editedValue)
      queryComponents.push({edited: JSON.parse(edited)});
  }
  // station Ids to match
  if (stationIds.length > 0) queryComponents.push({stationId: {$in: stationIds}});
  // statuses
  queryComponents.push({status: {$in: status}});

  // final query
  var query = {};
  if (queryComponents.length > 0) query.$and = queryComponents;
  console.log("query =", JSON.stringify(query, null, 2));

  async.waterfall([
    connect,
    function(db, cb) {
      console.time("filteredFiles");
      db.collection("files").find(query).skip(pageSize * (page-1)).limit(pageSize).toArray(function(err, filteredFiles) {
        console.timeEnd("filteredFiles");
        cb(err, db, filteredFiles);
      });
    },
    function(db, filteredFiles, cb) {
      console.time("numResults");
      var fileCursor = db.collection("files").find(query).batchSize(10000);
      fileCursor.count(function(err, numResults) {
        console.timeEnd("numResults");
        cb(err, db, fileCursor, filteredFiles, numResults);
      });
    },
    function(db, fileCursor, filteredFiles, numResults, cb) {
      db.collection("files").find(query).sort({date:1}).limit(1).toArray(function(err, files) {
        var date = files.length > 0 ? files[0].date : null;
        cb(err, db, fileCursor, filteredFiles, numResults, date);
      });
    },
    function(db, fileCursor, filteredFiles, numResults, lowDate, cb) {
      db.collection("files").find(query).sort({date:-1}).limit(1).toArray(function(err, files) {
        var date = files.length > 0 ? files[0].date : null;
        cb(err, db, fileCursor, filteredFiles, numResults, lowDate, date);
      });
    },
    function(db, fileCursor, filteredFiles, numResults, lowDate, highDate, cb) {
      console.time("processing");
      var stationMap = {};
      var getStation = function(id) {
        if (!(id in stationMap)) {
          stationMap[id] = {
            status: [0,0,0,0],
            edited: 0
          };
        }
        return stationMap[id];
      };
      fileCursor.each(function(err, file) {
        if (file === null) {
          console.timeEnd("processing");
          var payload = {
            stations: stationMap,
            lowDate: lowDate,
            highDate: highDate,
            numResults: numResults,
            files: filteredFiles
          };
          cache.put(req.query, payload);
          res.send(payload);
          db.close();
          cb(null);
        } else {
          var station = getStation(file.stationId);
          if (!station) console.error(file.stationId, "does not exist");
          station.status[file.status]++;
          station.edited += +file.edited;
        }
      });

    }
  ], function(err) {
    if (err) next(err);
  });
});

module.exports = router;