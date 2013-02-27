'use strict';

module.exports = function(grunt) {

  grunt.registerTask('devtools', 'Runs a server for devtools', function() {
    this.async();
    var WebSocketServer = require('websocket').server;
    var fs = require("fs");
    var spawn = require("child_process").spawn;
    var workers = [];
    var http = require('http');
    var portscanner = require('portscanner');

    // TODO: update this
    var projectPath = process.cwd().split('/');
    var projectName = projectPath[projectPath.length - 1];
    var aliasTasks = getAliasTasks();

    var server = http.createServer(function(request, response) {
      //console.log((new Date()) + ' Received request for ' + request.url);
      response.writeHead(404);
      response.end();
    });

    // TODO: update this
    var projectPort = 61750;
    portscanner.findAPortNotInUse(projectPort, projectPort + 5, 'localhost', function(error, port) {
      projectPort = port;
      server.listen(port, function() {
        console.log("Grunt Devtools is ready! Proceed to the Chrome extension.");
      });
    });

    var wsServer = new WebSocketServer({
      httpServer: server,
      autoAcceptConnections: false
    });

    wsServer.on('request', function(request) {
      var key = request.key;
      //console.log(key);
      var connection = request.accept('echo-protocol', request.origin);
      //console.log((new Date()) + ' Connection accepted.');
      connection.on('message', function(message) {
        if (message.type === 'utf8') {
          var msg = message.utf8Data;
          if (msg === 'connect') {
            connection.sendUTF( JSON.stringify({
              tasks: grunt.util._.difference(Object.keys(grunt.task._tasks), aliasTasks),
              alias: aliasTasks,
              project:projectName,
              port: projectPort}) );
          }
          else if (Object.keys(grunt.config.data).indexOf(msg) > -1 || aliasTasks.indexOf(msg) > -1) {
            var watcher = spawn('grunt', [msg, '-no-color']);
            workers.push(watcher);
            connection.send("Running Task: " + msg);
            watcher.stdout.on('data', function(data) {
              //console.log(data);
              if (data) {
                connection.send(data.toString());
              }
            });
            watcher.stdout.on('end', function(data) {
              if (data) {
                connection.send(data.toString());
              }
            });
            watcher.stderr.on('data', function (data) {
              if (data) {
                connection.send(data.toString());
              }
            });
            watcher.on('exit', function (code) {
              if (code !== 0) {
                //console.log('ps process exited with code ' + code);
              }
            });
          }
        }
      });
      connection.on('close', function() {
        // TODO: this
      });
    });


    /**
     * Clean up child processes
     */
    var killWorkers = function() {
      workers.forEach(function(worker) {
        process.kill(worker);
      });
      process.exit();
    };

    process.on("uncaughtException", killWorkers);
    process.on("SIGINT", killWorkers);
    process.on("SIGTERM", killWorkers);

    // TODO: move this later please
    /**
     * Get sidebar list for section from Home.md
     */
    function getAliasTasks() {
      var l,
        aliasTasks = [];

      // read the Home.md of the wiki, extract the section links
      var lines = fs.readFileSync('Gruntfile.js').toString().split('\n');
      for(l in lines) {
        var line = lines[l].replace(/ /g,'');
        if (line.indexOf('grunt.registerTask') === 0) {
          aliasTasks.push(line.split(/'/)[1]);
        }

      }
      return aliasTasks;
    }


  });
};
