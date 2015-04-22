var Canvas = require('canvas');

function Tiler(tileSize) {
  this.tileSize = tileSize || 256;
  this.cache = {};
}

Tiler.prototype.tileRect = function(tx, ty, zoom, imageWidth, imageHeight) {
  // Returns a rectangle [x, y, width, height] with dimensions
  // representing which coordinates in the source image are covered
  // by the tile at the specified zoom and tile coordinates (tx, ty).

  var tileCoordExtent = this.tileSize * Math.pow(2, zoom),
      imageCoordExtent = this.smallestPowerOf2GreaterThan(Math.max(imageWidth, imageHeight)),
      scale = imageCoordExtent / tileCoordExtent; // number of image pixels in one tile pixel at this zoom

  var x = tx * this.tileSize * scale,
      y = ty * this.tileSize * scale,
      size = this.tileSize * scale;

  return [x, y, size, size];
};

Tiler.prototype.createTile = function(image, z, x, y) {
  var canvas = new Canvas(),
      ctx = canvas.getContext("2d");

  canvas.width = canvas.height = this.tileSize;

  var tileRect = this.tileRect(x, y, z, image.width, image.height);

  ctx.drawImage(image, tileRect[0], tileRect[1], tileRect[2], tileRect[3],
                0, 0, canvas.width, canvas.height);

  return canvas;
};

Tiler.prototype.smallestPowerOf2GreaterThan = function(num) {
  var exponent = Math.ceil(Math.log(num) / Math.log(2));
  return Math.pow(2, exponent);
};

module.exports = Tiler;
