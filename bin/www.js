#!/usr/bin/env node

/**
 * Module dependencies.
 */

var config = require("../utils/config");
var requireUser = require("../utils/auth");

var app = require('../app')(config, requireUser);
var debug = require('debug')('tsa-gallery:server');
var http = require('http');

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(config.app.port);
app.set('port', port);

/**
 * Inject a cache provider
 */
app.locals.cache = new (require("../utils/cache"))(app);

/**
 * Inject the filesystem
 */
app.locals.fs = new (require("../utils/filesystem.s3"))(app);


/**
 * Inject the database providers
 */
app.locals.db = {
  categories: require("../data/categories"),
  images: require("../data/images"),
  users: require("../data/users")
};

 /**
 * Create HTTP server.
 */

var server = http.createServer(app);

/**
 * Listen on provided port, on all network interfaces.
 */
console.log("Starting ExpressJS on port: " + port);
var fs = require("fs");
var buildNum = "0";
try {
 buildNum = fs.readFileSync("buildnum.txt", { encoding: "utf8" });
} catch (err) {
 console.log("Error: Unable to locate buildnum.txt");
}
console.log("Running Build Num: " + buildNum.trim());

var buildHash = "";
try {
 buildHash = fs.readFileSync("buildhash.txt", { encoding: "utf8" });
} catch (err) {
 console.log("Error: Unable to locate buildhash.txt");
}
console.log("Running Build Hash: " + buildHash.trim());

server.listen(port);
server.on('error', onError);
server.on('listening', onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
  var addr = server.address();
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port;
  debug('Listening on ' + bind);
}
