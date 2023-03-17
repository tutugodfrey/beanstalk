//DEBUG=tsa-gallery:* npm start

module.exports = function(config, requireUser){
  var util = require('util');
  var mysql = require('mysql');
  var createError = require('http-errors');
  var express = require('express');
  var path = require('path');
  var cookieParser = require('cookie-parser');
  var cors = require('cors');

  var app = express();

  /**
   * Set the config and user auth into the app
   */
  app.locals.config = config;
  app.locals.requireUser = requireUser;

  app.dbpool = null;

  var usersRouter = require('./routes/users')(app);
  var categoriesRouter = require('./routes/categories')(app);
  var imagesRouter = require('./routes/images')(app);

  app.use(function(req, res, next) {
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    if (req.originalUrl != "/api/health") {
      console.log("=== Starting Request: " + req.method + " -> " + fullUrl + " ===");
    }
    next();
  });

  // make sure database is connected
  app.use(async function (req, res, next) {
    if (app.locals.dbpool == null) {
      app.locals.dbpool = mysql.createPool({
        connectionLimit: 10,
        host: app.locals.config.db.host,
        port: app.locals.config.db.port,
        user: app.locals.config.db.username,
        password: app.locals.config.db.password,
        database: app.locals.config.db.schema
      });

      app.locals.dbpool.getConnection((err, connection) => {
        if (err) {
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
                console.error('Database connection was closed.');
            }
            if (err.code === 'ER_CON_COUNT_ERROR') {
                console.error('Database has too many connections.');
            }
            if (err.code === 'ECONNREFUSED') {
                console.error('Database connection was refused.');
            }
            console.log("It's an error: " + err);
            app.locals.dbpool = null;
        }
        
        if (connection) connection.release();
        return;
      });

      app.locals.dbpool.query = util.promisify(app.locals.dbpool.query);
    }

    next();
  })

  // gets the user object
  app.use(async function (req, res, next) {
    const authorization = req.headers["authorization"];
    res.locals.user = null;

    if (authorization) {
      const parts = authorization.split(' ');
      if (parts.length === 2) {
        const scheme = parts[0];
        const token = parts[1];
        
        if (/^Bearer$/i.test(scheme)) {
          //get the user from the cache
          var session = await req.app.locals.cache.get(req.app.locals.config.cache.userSessionPrefix + token);
          if (session != null) {
            res.locals.user = session.user;
            res.locals.sessionId = token;
          }

          /* TODO: Remove me! - Shortcut for admin, use in dev only! */
          if (token == "oZ36seEEmKMjsJa1EEKXsJr1Nhwj93UxpfgNHwFqjhjSnaKSS5dEXXV6pos8YkL") {
            res.locals.user = await req.app.locals.cache.get(app.locals.config.cache.userKeyPrefix + "1");
            if (res.locals.user == null) {
              var usersdb = require("./data/users");
              res.locals.user = await usersdb.get(req.app.locals.dbpool, 1);
              res.locals.sessionId = token;
              await req.app.locals.cache.put(req.app.locals.config.cache.userKeyPrefix + "1", res.locals.user, 600); //10 minutes
            }
          }
        }
      }
    }
    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, 'public')));
  app.use(cors({
    origin: "*",
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  }));

  app.use('/api/users', usersRouter);
  app.use('/api/categories', categoriesRouter);
  app.use('/api/images', imagesRouter);

  app.use(async function(req, res, next) {
    await req.app.locals.cache.validateCache();
    if (!res.headersSent) {
      next();
    }
  });

  app.use((req, res, next) => {
    console.log("Send default file");
    var defaultPath = path.join(__dirname, "public", "index.html");
    console.log(defaultPath);

    res.sendFile(defaultPath);
  });

  return app;
}