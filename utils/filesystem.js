'use strict';
const fs = require('fs');

module.exports = class FileSystem {

    constructor(app) {
        this.config = app.locals.config;
    }

    getVersion() {
        return 2.1;     //Track 2, lab 1
    }

    async renameTemp(src, dest) {
        fs.renameSync(src, dest);
    }

    async deleteTemp(filename) { 
        if (fs.existsSync(filename)) {
            fs.unlinkSync(filename);
        }
    }

   async deletePublic(image) { 
        if (fs.existsSync("public" + this.pathForImage(image))) {
            await this.deleteTemp("public" + this.pathForImage(image));
        }
        if (fs.existsSync("public" + this.pathForImageThumb(image))) {
            await this.deleteTemp("public" + this.pathForImageThumb(image));
        }
    }

    async moveFileToPublic(src, dest) {
        
        fs.renameSync(src, "public" + dest);
    }

    uriForImage(req, image) {
        return "/images/uploads/" + image.id + "." + image.extension;;
    }

    uriForImageThumb(req, image) {
        return "/images/uploads/" + image.id + "_thumb." + image.extension;
    }

    pathForImage(image) {
        return "/images/uploads/" + image.id + "." + image.extension;
    }

    pathForImageThumb(image) {
        return "/images/uploads/" + image.id + "_thumb." + image.extension;
    }
}