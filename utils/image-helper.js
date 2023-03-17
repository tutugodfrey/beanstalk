'use strict';

module.exports = {

  generateThumbnail: async function(src, dest) { 
    var jimp = require('jimp');
    var img = await jimp.read(src);
    await img
      .scaleToFit(200, 200, jimp.RESIZE_BICUBIC)
      .write(dest);
  }
}