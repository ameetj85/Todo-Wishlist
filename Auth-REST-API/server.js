'use strict';

// The API is written in TypeScript and compiled to dist/ (npm run build).
// This launcher keeps `node server.js` and process managers pointed at it working.
module.exports = require('./dist/server.js');
