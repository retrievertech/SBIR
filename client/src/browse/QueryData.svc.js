var L = window.L;

export class QueryData {

  constructor() {
    this.stationQueryData = [];
    this.filesQueryData = {};
    this.groups = [];
    this.gotDataAlready = false;
  }

  // This method populates the "groups" prop.
  // Groups is the same as files except instead of an array, it is an array of arrays,
  // currently each sub-array being of size 2. For example,
  //   files == [a,b,c,d,e,f,g];
  //   groups == [[a,b], [c,d], [e,f], [g]]
  // This is used by the UI to display the seismograms list in rows of 2.
  // TODO: Is there an underscore function that does this?
  // TODO: Could this be done with a filter?

  setGroups(files) {
    this.groups = [];

    var group = [];

    files.forEach((file) => {
      if (group.length < 2) {
        group.push(file);
      }
      if (group.length === 2) {
        this.groups.push(group);
        group = [];
      }
    });

    if (group.length > 0) {
      this.groups.push(group);
    }
  }

  // holds on to the station data as returned by the server
  setStationQueryData(data) {
    this.stationQueryData = data;
  }

  // holds on to the files query data as returned by the server
  setFilesQueryData(data) {
    this.filesQueryData = data;
    this.setGroups(data.files);
    this.gotDataAlready = true;
  }

  // called with new file data loaded from subsequent pages 
  moreFilesData(data) {
    this.filesQueryData.files = this.filesQueryData.files.concat(data.files);
    this.setGroups(this.filesQueryData.files);
  }

  resultsBBox() {
    var stationIds = Object.keys(this.filesQueryData.stations);

    // return max bounds if there are no results
    if (stationIds.length === 0) {
      return L.latLngBounds([-180, -90], [180, 90]);
    }

    // get the station points in the result set
    var points = stationIds.map((stationId) => {
      var station = this.stationQueryData.find((station) => station.stationId === stationId);
      return L.latLng(station.lat, station.lon);
    });

    // make a minimal bbox around the first point
    var minBBox = L.latLngBounds(points[0], points[0]);

    // extend the minimal bbox with every subsequent point
    return points.reduce((bbox, point) => bbox.extend(point), minBBox);
  }

  formatDate(file) {
    if (!file) return;

    var pad = (val) => {
      val = val + "";
      return val.length === 1 ? "0" + val : val;
    };

    var date = new Date(file.date);
    var month = pad(date.getUTCMonth() + 1);
    var day = pad(date.getUTCDate());
    var year = date.getUTCFullYear();
    var hours = pad(date.getUTCHours());
    var minutes = pad(date.getUTCMinutes());

    return month + "/" + day + "/" + year + " " + hours + ":" + minutes;
  }

  stationLocation(file) {
    if (!file) return;
    return this.getStation(file.stationId).location;
  }

  getStation(id) {
    return this.stationQueryData.find((station) => station.stationId === id);
  }

  getStationByCode(code) {
    return this.stationQueryData.find((station) => station.code === code); 
  }

  isLongPeriod(file) {
    if (!file) return;
    var type = parseInt(file.type);
    return type >= 4 && type <= 6;
  }

  isShortPriod(file) {
    if (!file) return;
    var type = parseInt(file.type);
    return type >= 1 && type <= 3;
  }

  seismoType(file) {
    if (!file) return;
    if (this.isLongPeriod(file)) {
      return "Long-period";
    } else {
      return "Short-period";
    }
  }

  seismoDirection(file) {
    if (!file) return;
    var type = parseInt(file.type);

    if (type === 1 || type === 4) {
      return "up-down";
    } else if (type === 2 || type === 5) {
      return "north-south";
    } else {
      return "east-west";
    }
  }
}
