var express = require('express');

module.exports = function(app){
  var router = express.Router();
  
  var multer  = require('multer');
  var upload = multer({ dest: app.locals.config.app.tempFilePath });

  function hasValue(variable) {
    return ((typeof variable !== 'undefined') && (variable !== null));
  }
  
  /* GET images listing. */
  router.get('/', async function(req, res, next) {
    var images = await req.app.locals.cache.get(req.app.locals.config.cache.imageCollectionKey);
    if (images == null) {
      images = await app.locals.db.images.list(req.app.locals.dbpool);
      images.forEach((image) => {
        image.uri = app.locals.fs.uriForImage(req, image);
        image.thumburi = app.locals.fs.uriForImageThumb(req, image);
      });
      await req.app.locals.cache.put(req.app.locals.config.cache.imageCollectionKey, images, 300); 
    }
    res.send({
      result: images
    });
  
    next();
  });

  router.get('/search', async function(req, res, next) {
    var searchStr = req.query.s;
    if (!hasValue(searchStr)) {
      res.status(400).send({message:"SearchString missing"});
      return;
    }

    var cacheKey = req.app.locals.config.cache.searchCollectionPrefix + searchStr;

    var images = await req.app.locals.cache.get(cacheKey);
    if (images == null) {
      images = await app.locals.db.images.listByString(req.app.locals.dbpool, searchStr);
      if (images == null) {
        res.sendStatus(404);
        return;
      }
      images.forEach((image) => {
        image.uri = app.locals.fs.uriForImage(req, image);
        image.thumburi = app.locals.fs.uriForImageThumb(req, image);
      });
      await req.app.locals.cache.put(cacheKey, images, 300);
    }

    res.send({
      result: images
    });

    next();
  });
  
  /* GET single image */
  router.get('/:id', async function(req, res, next) {
    if (res.headersSent) {
      next();
      return;
    }
    var imageId = req.params.id;
    var cacheKey = req.app.locals.config.cache.imageKeyPrefix + imageId;
  
    var image = await req.app.locals.cache.get(cacheKey);
    if (image == null) {
      image = await app.locals.db.images.get(req.app.locals.dbpool, imageId);
      if (image == null) {
        res.sendStatus(404);
        return;
      }
      image.uri = app.locals.fs.uriForImage(req, image);
      image.thumburi = app.locals.fs.uriForImageThumb(req, image);
      await req.app.locals.cache.put(cacheKey, image, 300);
    }
    res.send(image);
  
    next();
  });

  /* POST upload new image */
  router.post("/", app.locals.requireUser(), upload.single('imgsrc'), async function(req, res, next) {
    // req.file is the `imgsrc` file
    // req.body will hold the text fields, if there were any
        
    if (!hasValue(req.body.name) || !hasValue(req.body.tags) || !hasValue(req.body.categoryid)) {
      await app.locals.fs.deleteTemp(req.file.path);  
      res.status(400).send({message: "Name, tags or categoryid is not found"});
      return;
    }
  
    //Get the image dimensions
    const sizeOf = require('image-size');
    const dimensions = sizeOf(req.file.path);

    //rename the uploaded file to add extension
    await app.locals.fs.renameTemp(req.file.path, req.file.path + "." + dimensions.type);

    var thumbName = req.file.path + "_thumb." + dimensions.type
    req.file.path = req.file.path + "." + dimensions.type

    //create a new image in the database
    var image = await app.locals.db.images.create(req.app.locals.dbpool, req.body.name, dimensions.width, dimensions.height, req.body.tags, req.file.size, dimensions.type, res.locals.user.id, req.body.categoryid);
    if (image == null) {
      await app.locals.fs.deleteTemp(req.file.path);  
      res.status(400).send({message: "Name already exitst in the category"});
      return;
    }
    
    //Generate a thumnbnail
    const imageHelper = require("../utils/image-helper");
    
    await imageHelper.generateThumbnail(req.file.path, thumbName);
  
    //Move the image to the public store
    await app.locals.fs.moveFileToPublic(req.file.path, app.locals.fs.pathForImage(image));
    await app.locals.fs.moveFileToPublic(thumbName, app.locals.fs.pathForImageThumb(image));
    
    image.uri = app.locals.fs.uriForImage(req, image);
    image.thumburi = app.locals.fs.uriForImageThumb(req, image);
    
    await req.app.locals.cache.delete(req.app.locals.config.cache.imageCollectionKey);
    await req.app.locals.cache.delete(req.app.locals.config.cache.categoryImagesPrefix + image.category.id);

    res.send(image);
    next();
  });
  
  /* UPDATE category */
  router.put("/:id", app.locals.requireUser(), async function(req, res, next) {
    var imageId = req.params.id;
    var newImg = req.body;
    console.log(newImg);
  /*
    {
      name,
      tags,
      categoryid
    }
  */
    if (!hasValue(newImg.name) || !hasValue(newImg.tags) || !hasValue(newImg.categoryid)) {
      res.sendStatus(400);
      return;
    }
    
    //Get the image form the database
    var image = await app.locals.db.images.get(req.app.locals.dbpool, imageId);
    var oldCategory = image.category.id;
  
    //Now update fields we can change
    image = await app.locals.db.images.update(req.app.locals.dbpool, image.id, newImg.name, image.width, image.height, newImg.tags, image.size, image.extension, newImg.categoryid);
    
    image.uri = app.locals.fs.uriForImage(req, image);
    image.thumburi = app.locals.fs.uriForImageThumb(req, image);
    await req.app.locals.cache.put(req.app.locals.config.cache.imageKeyPrefix + image.id, image, 300);
    await req.app.locals.cache.delete(req.app.locals.config.cache.imageCollectionKey);
    
    await req.app.locals.cache.delete(req.app.locals.config.cache.categoryImagesPrefix + oldCategory);
    if (oldCategory != newImg.categoryid) {
      await req.app.locals.cache.delete(req.app.locals.config.cache.categoryImagesPrefix + newImg.categoryid);
    }
    res.send(image);
  
    next();
  });
  
  /* DELETE category */
  router.delete("/:id", app.locals.requireUser(), async function(req, res, next) {
    var imageId = req.params.id;
    
    var image = await app.locals.db.images.get(req.app.locals.dbpool, imageId);
    
    if (image == null) {
      res.sendStatus(404);
      return;
    }
  
    var deleteOk = await app.locals.db.images.delete(req.app.locals.dbpool, imageId);
    if (!deleteOk) {
      res.sendStatus(500);
      return;
    }
  
    //delete the image
    await app.locals.fs.deletePublic(image);
    
    await req.app.locals.cache.delete(req.app.locals.config.cache.imageKeyPrefix + image.id);
    await req.app.locals.cache.delete(req.app.locals.config.cache.imageCollectionKey);
    await req.app.locals.cache.delete(req.app.locals.config.cache.categoryImagesPrefix + image.category.id);
    res.send({ status: "OK" });
  
    next();
  });

  return router;
}