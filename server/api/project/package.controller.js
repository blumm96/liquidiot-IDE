/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Antti Nieminen <antti.h.nieminen@tut.fi>
 */

'use strict';

var fsp = require('fs-extra-promise');
var npm = require('npm');
var path = require('path');
var tmp = require('tmp');
var rp = require('request-promise');
var _ = require('lodash');
var Project = require('./project.model');
var errorHandler = require('../common').errorHandler;

var env = require('../../config/environment');
var GITDIR = env.git.projects;

var fs = require('fs');


function tmpDirPromise() {
  return new Promise(function(resolve, reject) {
    tmp.dir(function(err, path) {
      if (err) {
        reject(err);
      }
      else {
        resolve(path);
      }
    });
  });
}

// https://github.com/npm/npm/issues/4074
function npmPackPromise(dir) {
  return new Promise(function(resolve, reject) {
    npm.load({}, function(err) {
      if (err) {
        return reject(err);
      }
      npm.commands.cache.add(dir, null, false, null, function(err, data) {
        if (err) {
          return reject(err);
        }
        var cached, from, to;
        cached = path.resolve(npm.cache, data.name, data.version, "package.tgz");
        resolve(cached);
        /*
        from = fs.createReadStream(cached);

        var pkg = path.join(dir, data.name + '-' + data.version + '.tgz');
        to = fs.createWriteStream(pkg);

        from.on("error", reject);
        to.on("error", reject);
        to.on("close", function() {
          resolve(pkg);
        });

        from.pipe(to);
        */
      });
    });
  });
}

// npm pack, used here, always creates the tgz at the working dir.
// Using the above function instead.
function npmPackPromise2(fromDir) {
  return new Promise(function(resolve, reject) {
    npm.load({}, function(err) {
      if (err) {
        return reject(err);
      }
      npm.commands.pack([fromDir], function() {
        resolve();
      });
    });
  });
}

// TEST 
// Create an extra file that simulates the state.
function addStateFile(dir){
  fs.appendFile(path.resolve(dir, './state.json'), '', (err) => {
    if(err)throw err;
  });
}

function createPackage(project) {
  var d = path.resolve(GITDIR, project.name);
  addStateFile(d);
  return npmPackPromise(d);
}

function sendPackage(pkgBuffer, url) {
  var formData = {
    'filekey': {
      value: pkgBuffer,
      options: {
        filename: 'package.tgz',
        knownLength: pkgBuffer.length,
      }
    }
  };
  return rp.post({url: url, formData: formData, timeout: 5000});
}


function putPackage(pkgBuffer, url) {
  var formData = {
    'filekey': {
      value: pkgBuffer,
      options: {
        filename: 'package.tgz',
        knownLength: pkgBuffer.length,
      }
    }
  };
  return rp.put({url: url, formData: formData});
}
// Create package, i.e. deploy to device.
/*exports.create = function(req, res) {
  var url = req.body.deviceUrl + '/app';
  Project.findOne({name: req.params.project}).then(function(project) {
    if (!project) throw 404;
    return createPackage(project);
  }).then(function(pkgFilename) {
    return fsp.readFileAsync(pkgFilename);
  }).then(function(pkgBuffer) {
    return sendPackage(pkgBuffer, url);
  }).then(function(pkgBuffer) {
    res.status(201).json();
  }).then(null, errorHandler(res));
};*/

// Create package
function create(name) {
  return Project.findOne({name: name}).then(function(project) {
    if (!project) throw 404;
    return createPackage(project);
  }).then(function(pkgFilename) {
    return fsp.readFileAsync(pkgFilename);
  });
};
////////////////////////////////////////////////////////////////////
  
  // Returns a promise for executing the deployment object.
  function deployPromise(deployment) {
    
    // number of successful deployments
    var numSuccessDeps = 0;
    // number of failed deployments
    var numFailDeps = 0;

    var name = deployment.projectName;
    return create(name)
      .then(function(pkgBuffer) {
        return Promise.all(deployment.selectedDevices.map(function(device) {
          return sendPackage(pkgBuffer, device.url + '/app')
            .then(function(res){
              numSuccessDeps++;
              return res;
            })
            .catch(function(err){
              console.log('eeee: ' + err.message);
              numFailDeps++;
              //return err.message ? JSON.stringify({mesaage: err.message }) : JSON.stringify({ error: err });
              return JSON.stringify({error: err.toString()});
            });
        }))
        .then(function(res){
          return {
            numberOfSuccess: numSuccessDeps,
            numberOfFailure: numFailDeps,
            result: res
          };
        });
      });
  }

// deploy to a device.
exports.deploys = function(req, res) {

  var deps = req.body.deployments;


  Promise.all(deps.map(deployPromise))
    .then(function(deployResults){
      // total number of successful deployments
      var numSuccessDeps = 0;
      // total number of failed deployments
      var numFailDeps = 0;
      // total deployment responses
      var results = [];

      deployResults.forEach(function(res){
        numSuccessDeps += res.numberOfSuccess;
        numFailDeps += res.numberOfFailure;
        results = results.concat(res.result);
      });

      var finalResult = {
        numberOfSuccess: numSuccessDeps,
        numberOfFailure: numFailDeps,
        result: results
      };

      console.log('res: ' + JSON.stringify(finalResult));
      
      res.status(200).json(finalResult);
    })
    .catch(errorHandler(res));
};
////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////
  
function deleteApp(device, app) {
  var url = device.url + '/app/' + app.id;
  return rp({
    url: url,
    method: 'DELETE'
  });
}

// deploy to a device.
exports.removeApp = function(req, res) {

  var hostDevs = req.body.devices;
  // number of successful deployments
  var numSuccessDels = 0;
  // number of failed deployments
  var numFailDels = 0;

  Promise.all(hostDevs.map(function(device){
    return Promise.all(device.matchedApps.map(function(app) {
      return deleteApp(device, app)
        .then(function(res){
          numSuccessDels++;
          return res;
        })
        .catch(function(err){
          numFailDels++;
          return err;
        });
    }));
  }))
  .then(function(deleteResults){
    var finalResult = {
      numberOfSuccess: numSuccessDels,
      numberOfFailure: numFailDels,
      result: deleteResults
    };

    res.status(200).json(finalResult);
  })
  .catch(errorHandler(res));
};
////////////////////////////////////////////////////////////////////
// deploy to a device.
exports.deploy = function(req, res) {
  var name = req.params.project;
  var url = req.body.deviceUrl + '/app';
  console.log('received: ' + url);
  create(name)
    .then(function(pkgBuffer) {
    return sendPackage(pkgBuffer, url);
  }).then(function(response) {
    //console.log(response);
    console.log('sent back: ' + url);
    res.status(200).json(response);
  }).catch(errorHandler(res));//.then(null, errorHandler(res));
};

// update an app in a device.
exports.update = function(req, res) {
  var name = req.params.project;
  var url = req.body.deviceUrl + '/app/' + req.body.appId;
  create(name)
    .then(function(pkgBuffer) {
    return sendPackage(pkgBuffer, url);
  }).then(function(pkgBuffer) {
    res.status(201).json();
  }).then(null, errorHandler(res));
};
