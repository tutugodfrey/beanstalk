var express = require('express');

module.exports = function(app){
  var router = express.Router();

  /* GET users listing */
  router.get('/', app.locals.requireUser(), async function(req, res, next) {
    var users = await req.app.locals.cache.get(req.app.locals.config.cache.userCollectionKey);
    if (users == null) {
      users = await app.locals.db.users.list(req.app.locals.dbpool);
      await req.app.locals.cache.put(req.app.locals.config.cache.userCollectionKey, users, 300); 
    }
    res.send({
      result: users
    });

    next();
  });

  /* GET single user */
  router.get('/:id', app.locals.requireUser(), async function(req, res, next) {
    var userId = req.params.id;
    var cacheKey = req.app.locals.config.cache.userKeyPrefix + userId;

    var user = await req.app.locals.cache.get(cacheKey);
    if (user == null) {
      user = await app.locals.db.users.get(req.app.locals.dbpool, userId);
      if (user == null) {
        res.sendStatus(404);
        return;
      }
      await req.app.locals.cache.put(cacheKey, user, 300);
    }
    res.send(user);

    next();
  });

  /* POST register new user */
  router.post("/", app.locals.requireUser(true), async function(req, res, next) {
    var newUser = req.body;
    if (!newUser.displayName || !newUser.username || !newUser.password) {
      res.sendStatus(400);
      return;
    }
    var user = await app.locals.db.users.create(req.app.locals.dbpool, newUser.displayName, newUser.username, newUser.password);
    if (user == null) {
      res.sendStatus(400);
      return;
    }
    await req.app.locals.cache.delete(req.app.locals.config.cache.userCollectionKey);
    res.send(user);

    next();
  });

  /* DELETE disable a user */
  router.delete("/:id", app.locals.requireUser(true), async function(req, res, next) {
    var userId = req.params.id;
    var user = await app.locals.db.users.delete(req.app.locals.dbpool, userId);
    if (user == null) {
      res.sendStatus(500);
      return;
    }
    await req.app.locals.cache.delete(req.app.locals.config.cache.userKeyPrefix + userId);
    await req.app.locals.cache.delete(req.app.locals.config.cache.userCollectionKey);
    res.send(user);

    next();
  });

  /* POST login as a user */
  router.post("/login", async function(req, res, next) {
    var loginDetails = req.body;
    if (!loginDetails.username || !loginDetails.password) {
      res.sendStatus(400);
      return;
    }

    var user = await app.locals.db.users.login(req.app.locals.dbpool, loginDetails.username, loginDetails.password);
    if (user == null) {
      res.sendStatus(403);
      return;
    }

    //Log the user in
    const uuidv4 = require('uuid/v4');

    var sessionObj = {
      sessionId: uuidv4(),
      clientIp: req.ip,
      user: user
    };

    await req.app.locals.cache.put(req.app.locals.config.cache.userSessionPrefix + sessionObj.sessionId, sessionObj, (60*60*24));  //Session lasts up to 1 day

    res.send({
      sessionId: sessionObj.sessionId,
      user: user
    });

    next();
  });

  router.get("/logout", app.locals.requireUser(), async function(req, res, next) {
    await req.app.locals.cache.delete(req.app.locals.config.cache.userSessionPrefix + res.locals.sessionId);
    res.sendStatus(204);

    next();
  });

  router.put("/:id", app.locals.requireUser(), async function(req, res, next) {
    var userId = req.params.id;
    var newUser = req.body;

    if (!newUser.displayName || (newUser.enabled === undefined) || (newUser.enabled == null) ) {
      res.sendStatus(400);
      return;
    }
    
    var user = await app.locals.db.users.update(req.app.locals.dbpool, userId, newUser.displayName, newUser.enabled);
    
    await req.app.locals.cache.put(req.app.locals.config.cache.userKeyPrefix + userId, user, 300);
    await req.app.locals.cache.delete(req.app.locals.config.cache.userCollectionKey);
    res.send(user);

    next();
  });

  router.put("/:id/password", app.locals.requireUser(), async function(req, res, next) {
    var userId = req.params.id;
    var passwordChange = req.body;

    if (!passwordChange.username || !passwordChange.oldpassword || !passwordChange.newpassword ) {
      res.status(400).send({message: "Invalid parameters"});
      return;
    }

    if ((res.locals.user.id != userId) && (res.locals.user.id != 1)) {
      res.status(400).send({message: "You cannot change another users password unless you are admin"});
      return;
    }

    if (res.locals.user.id != 1) {
      //Validate the existing password
      var user = await app.locals.db.users.login(req.app.locals.dbpool, passwordChange.username, passwordChange.oldpassword);
      if ((user == null)) {
        res.status(400).send({message: "Incorrect old password / username combination"});
        return;
      }
      
      if (user.id != userId) {
        res.status(400).send({message: "Username does not match user id does not match the path"});;
        return;
      }
    }
    
    user = await app.locals.db.users.resetPassword(req.app.locals.dbpool, userId, passwordChange.newpassword);

    await req.app.locals.cache.put(req.app.locals.config.cache.userKeyPrefix + userId, user, 300);
    await req.app.locals.cache.delete(req.app.locals.config.cache.userCollectionKey);
    res.send(user);

    next();
  });

  return router;
}