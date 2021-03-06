export class ServerUrls {
  constructor($location) {
    var port = 3000;
    this.url = $location.protocol() + "://" + $location.host() + ":" + port;
    this.filesUrl = this.url + "/query/files";
    this.moreFilesUrl = this.url + "/query/morefiles";
    this.fileUrl = this.url + "/query/file";
    this.stationsUrl = this.url + "/query/stations";
    this.tilesUrl = this.url + "/tiles";
    this.loadfileUrl = this.tilesUrl + "/loadfile";
    this.processingUrl = this.url + "/processing/start";
    this.saveUrl = this.url + "/processing/save";
    this.assignUrl = this.url + "/processing/assign";
    this.loginUrl = this.url + "/login";
  }
}
