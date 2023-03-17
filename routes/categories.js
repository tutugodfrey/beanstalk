var express = require('express');

module.exports = function(app){
  var router = express.Router();

  /* GET categories listing. */
  router.get('/', async function(req, res, next) {
    var categories = await req.app.locals.cache.get(req.app.locals.config.cache.categoryCollectionKey);
    if (categories == null) {
      categories = await app.locals.db.categories.list(req.app.locals.dbpool);
      await req.app.locals.cache.put(req.app.locals.config.cache.categoryCollectionKey, categories, 300); 
    }
    res.send({
      result: categories
    });

    next();
  });

  /* GET single category */
  router.get('/:id', async function(req, res, next) {
    var catId = req.params.id;
    var cacheKey = req.app.locals.config.cache.categoryKeyPrefix + catId;

    var category = await req.app.locals.cache.get(cacheKey);
    if (category == null) {
      category = await app.locals.db.categories.get(req.app.locals.dbpool, catId);
      if (category == null) {
        res.sendStatus(404);
        return;
      }
      await req.app.locals.cache.put(cacheKey, category, 300);
    }
    res.send(category);

    next();
  });

  router.get('/:id/images', async function(req, res, next) {
    var catId = req.params.id;
    var cacheKey = req.app.locals.config.cache.categoryImagesPrefix + catId;

    var images = await req.app.locals.cache.get(cacheKey);
    if (images == null) {
      images = await app.locals.db.images.listByCategory(req.app.locals.dbpool, catId);
      images.forEach((image) => {
        image.uri = app.locals.fs.uriForImage(req, image);
        image.thumburi = app.locals.fs.uriForImageThumb(req, image);
      });
      if (images == null) {
        res.sendStatus(404);
        return;
      }
      await req.app.locals.cache.put(cacheKey, images, 300);
    }

    res.send({
      result: images
    });

    next();
  });

  /* POST create new category */
  router.post("/", app.locals.requireUser(), async function(req, res, next) {
    var newCat = req.body;
    if (!newCat.name || !newCat.createdBy) {
      res.sendStatus(400);
      return;
    }
    var category = await app.locals.db.categories.create(req.app.locals.dbpool, newCat.name, newCat.createdBy);
    if (category == null) {
      res.sendStatus(400);
      return;
    }
    await req.app.locals.cache.delete(req.app.locals.config.cache.categoryCollectionKey);
    res.send(category);

    next();
  });

  /* UPDATE category */
  router.put("/:id", app.locals.requireUser(), async function(req, res, next) {
    var catId = req.params.id;
    var newCat = req.body;

    if (!newCat.name ) {
      res.sendStatus(400);
      return;
    }
    
    var category = await app.locals.db.categories.update(req.app.locals.dbpool, catId, newCat.name);
    
    await req.app.locals.cache.put(req.app.locals.config.cache.categoryKeyPrefix + catId, category, 300);
    await req.app.locals.cache.delete(req.app.locals.config.cache.categoryCollectionKey);
    res.send(category);

    next();
  });

  /* DELETE category */
  router.delete("/:id", app.locals.requireUser(), async function(req, res, next) {
    var catId = req.params.id;
    var deleteOk = await app.locals.db.categories.delete(req.app.locals.dbpool, catId);
    if (!deleteOk) {
      res.sendStatus(500);
      return;
    }
    await req.app.locals.cache.delete(req.app.locals.config.cache.categoryKeyPrefix + catId);
    await req.app.locals.cache.delete(req.app.locals.config.cache.categoryCollectionKey);
    await req.app.locals.cache.delete(req.app.locals.config.cache.categoryImagesPrefix + catId);

    res.send({ status: "OK" });

    next();
  });

  return router;
}
