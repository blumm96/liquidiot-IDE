/**
 * Copyright (c) TUT Tampere University of Technology 2015-2016
 * All rights reserved.
 *
 * Main author(s):
 * Antti Nieminen <antti.h.nieminen@tut.fi>
 */

/* global devicelib */
'use strict';

angular.module('koodainApp')

  /**
   * Controller for the deploy view.
   */
  .controller('DeployCtrl', function ($scope, $http, $resource, $uibModal, Notification, VisDataSet, DeviceManager, deviceManagerUrl, $stateParams) {

    console.log($stateParams);
  var Project = $resource('/api/projects');
  $scope.projects = Project.query();


  $scope.deviceManagerUrl = deviceManagerUrl;
    
  var deviceManager = DeviceManager(deviceManagerUrl);

  // Groups for Vis.js network
  // http://visjs.org/docs/network/groups.html
  var visGroups = {
    device: {
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: '\uf233',
        size: 50,
        color: 'gray',
      }
    },
    'device:selected': {
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: '\uf233',
        size: 85,
        color: 'purple',
      }
    }
  };

  /// Returns a Vis.js group based on app name
  /// If the group doesn't exist, it's created in the visGroups object.
  function createGroup(name) {
    var codes = {
      playSound: '\uf028',
      measureTemperature: '\uf0e4',
    };

    //console.log(name);

    if (!(name in codes)) {
      //console.log(name);
      name = 'default';
      //console.log(name);
    }

    if (name in visGroups) {
      //console.log(visGroups);
      //console.log('yes');
      return name;
    }

    //console.log(visGroups);

    var code = codes[name];
    if (!code) {
      code = '\uf059';
    }

    visGroups[name] = {
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: code,
        size: 50,
        color: 'black',
      }
    };
    visGroups[name+':selected'] = {
      shape: 'icon',
      icon: {
        face: 'FontAwesome',
        code: code,
        size: 50,
        color: 'purple',
      }
    };
    return name;
  }

  function groupForApp(app) {
    return createGroup(app.name);
  }

  function groupForDevice() {
    return 'device';
  }

  /// Returns a Vis.js node for the device
  function nodeFromDevice(device) {
    var id = device.id;
    var n = {
      id: id,
      label: device.name || id,
      title: generateTooltip(device),//JSON.stringify(device, null, 2),
      group: groupForDevice(),
      fixed:false
    };
    return n;
  }

  var generateTooltip = function(device){

    var tooltip = "<div class='panel panel-success' style='margin-bottom:0px'>"+
        "<div class='panel-heading'>"+
          "<h3 class='panel-title'>device</h3>"+
        "</div>"+
        "<div class='panel-body' style='padding-top: 0px; padding-bottom: 0px'>"+
          "<table class='table' style='border: none; margin-bottom:1px'>"+
            "<tr>"+
              "<td>id</td>"+
              "<td>" + device.id + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>name</td>"+
              "<td>" + device.name + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>capabilities</td>"+
              "<td>" + device.classes.join(", ") + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>location</td>"+
              "<td>" + device.location + "</td>"+
            "</tr>"+
            "<tr>"+
              "<td>url</td>"+
              "<td>" + device.url + "</td>"+
            "</tr>"+
          "</table>"+
        "</div>"+
      "</div>";

    return tooltip;
  }

  /// Returns a Vis.js node for the app
  function nodeFromApp(app) {
    var n = {
      id: 'app:' + app.id,
      label: app.name,
      group: groupForApp(app),
      selectable: false,
      fixed: false
    };
    return n;
  }

  // Convert the list to an object with device.id as key
  function deviceListAsObject(devs) {
    var obj = {};
    for (var i=0; i<devs.length; i++) {
      var d = devs[i];
      obj[d.id] = d;
    }
    return obj;
  }

  // These will be assigned when devices are loaded.
  var allDevices = [], nodes, edges;

  // Load the devices from the device manager
  function loadDevices() {
    deviceManager.queryDevices().then(function(devices) {
      //console.log(devices);
      allDevices = deviceListAsObject(devices);
      //console.log(allDevices);

      // Adding some mock devices for now... :)
      deviceManager.addMockDevicesTo(allDevices);
      //console.log(allDevices);

      nodes = new VisDataSet();
      edges = new VisDataSet();
      updateNodesAndEdges();

      $scope.graphData = {
        nodes: nodes,
        edges: edges,
      };

      // Seems like we have to update the view manually here by calling $scope.$apply?
      $scope.$apply();
    });
  }

  // Initial loading of the devices
  loadDevices();

  var focusedNodeIndex = -1;
  $scope.camera = {
    // Zooms out so all node fit on the canvas
    fit : function(){
      network.fit();
    },
    // Zooms out so all selected node fit on the canvas
    fitOnSelectedNodes : function(){
      if(selectedNodeIds.length == 1){
        network.focus(selectedNodeIds[0], {scale:1});
      } else {
        network.fit({nodes: selectedNodeIds});
      }
    },
    checkCrawling: function(){
      if(selectedNodeIds.length > 1){
        focusedNodeIndex = 0;
        $scope.isCrawlingPossible = true;
      } else {
        focusedNodeIndex = -1;
        $scope.isCrawlingPossible = false;
      }
    },
    crawl : function(){
      if(focusedNodeIndex >= 0 && focusedNodeIndex <= selectedNodeIds.length) {
        if(focusedNodeIndex == selectedNodeIds.length){
          Notification.info({message:"Crawling started again!", delay:1000});
        }
        focusedNodeIndex %= selectedNodeIds.length;
        //console.log("focusedNodeId: " + focusedNodeIndex);
        network.focus(selectedNodeIds[focusedNodeIndex], {scale:1});
        focusedNodeIndex++; 
      }
    }

  };

  // List of ids of the nodes that are currently selected
  var selectedNodeIds = [];

  function select(ns) {
    nodes.update(selectedNodeIds.map(function(id) {
      return {
        id: id,
        group: groupForDevice(allDevices[id])
      };
    }));
    nodes.update(ns.map(function(id) {
      return {
        id: id,
        group: groupForDevice(allDevices[id]) + ':selected'
      };
    }));
    //console.log("ns: " + ns);
    //console.log("selectedNodeIds:" + selectedNodeIds);
    selectedNodeIds = ns;
    $scope.selectedDevices = selectedNodeIds.map(function(id) {
      return allDevices[id];
    });
    //$scope.camera.fitOnSelectedNodes();
    $scope.camera.fit();
    $scope.camera.checkCrawling();
  }

  // The Vis.js network object, assigned on Vis.js onload event
  var network;

  // Select devices based on what's in device query + app query fields
  // This is called every time either of them changes
  function updateSelection() {
    var sel = deviceManager.filter(allDevices, $scope.devicequery, $scope.appquery);
    //console.log(sel);
    network.selectNodes(sel);
    select(sel);
  }

  // Vis.js events
  $scope.graphEvents = {
    onload: function(_network) {
      network = _network;
      $scope.$watch('devicequery', updateSelection);
      //$scope.$watch('appquery', updateSelection);
    },
    selectNode: selectClick,
    deselectNode: selectClick
  };

  // TODO: refactor loadDevices + reloadDevices -- DRY
  function reloadDevices() {
    deviceManager.queryDevices().then(function(devices) {

      allDevices = deviceListAsObject(devices);
      //if you want to remove mock device, comment this line
      deviceManager.addMockDevicesTo(allDevices);

      updateNodesAndEdges();

      updateSelection();
      $scope.$apply();
    });
  }
  
  // Update Vis.js nodes and edges based on 
  /*function updateNodesAndEdges() {
    nodes.clear();
    edges.clear();

    Object.keys(allDevices).forEach(function(id) {
      nodes.add(nodeFromDevice(allDevices[id]));
    });

    for (var i in allDevices) {
      var d = allDevices[i];
      var apps = d.apps;
      if (apps) {
        nodes.add(apps.map(nodeFromApp));
        /* jshint -W083 */
        // Edge from each app to the device it's in
        /*edges.add(apps.map(function(app) {
          return {
            from: 'app:' + app.id,
            to: d.id,
          };
        }));
      }
    }
  }*/

  // Update Vis.js nodes and edges based on 
  function updateNodesAndEdges() {
      var edgesArray = [];
      var nodesArray = Object.keys(allDevices).map(function(id) {
        return nodeFromDevice(allDevices[id]);
      });

      for (var i in allDevices) {
        var d = allDevices[i];
        var apps = d.apps;
        if (apps) {
          nodesArray.push.apply(nodesArray, apps.map(nodeFromApp));
          //nodes.add(apps.map(nodeFromApp));
          /* jshint -W083 */
          // Edge from each app to the device it's in
          edgesArray.push.apply(edgesArray, apps.map(function(app) {
            return {
              from: 'app:' + app.id,
              to: d.id,
            };
          }));
        }
      }
      nodes = new VisDataSet(nodesArray);
      edges = new VisDataSet(edgesArray);
      $scope.graphData = {
        nodes: nodes,
        edges: edges
      };
    }


  $scope.reloadDevices = reloadDevices;

  // Vis.js options
  // http://visjs.org/docs/network/#options
  $scope.graphOptions = {
    groups: visGroups,
    interaction: {
      multiselect: true,
    },
    physics: {
      enabled: true
    }
  };

  function isAppNodeId(nodeId) {
    // App node ids start with app:
    return nodeId.slice(0,4) === 'app:';
  }

  function isDeviceNodeId(nodeId) {
    // There are only devices and apps (for now)
    return !isAppNodeId(nodeId);
  }

  // When the user clicks on the Vis.js network,
  // construct a comma-separated list of selected device id to be used as query.
  function selectClick(params) {
    // TODO: currently only devices can be selected, not apps...
    var selDevices = params.nodes.filter(isDeviceNodeId);
    $scope.devicequery = selDevices.map(function(id) { return '#'+id; }).join(',');
    $scope.$apply();  // Needed?
  }

  /*function reload(){

    deviceManager.queryDevices().then(function(devices) {

      allDevices = deviceListAsObject(devices);
      //if you want to remove mock device, comment this line
      deviceManager.addMockDevicesTo(allDevices);

      var edgesArray = [];
      var nodesArray = Object.keys(allDevices).map(function(id) {
        return nodeFromDevice(allDevices[id]);
      });

      for (var i in allDevices) {
        var d = allDevices[i];
        var apps = d.apps;
        if (apps) {
          nodesArray.push.apply(nodesArray, apps.map(nodeFromApp));
          //nodes.add(apps.map(nodeFromApp));
          /* jshint -W083 */
          // Edge from each app to the device it's in
         /* edgesArray.push.apply(edgesArray, apps.map(function(app) {
            return {
              from: 'app:' + app.id,
              to: d.id,
            };
          }));
        }
      }
      nodes = new VisDataSet(nodesArray);
      edges = new VisDataSet(edgesArray);
        $scope.graphData = {
          nodes: nodes,
          edges: edges
        };
      console.log(nodesArray);    
      console.log(edgesArray);    
      updateSelection();
      $scope.$apply();
    });

        //$scope.graphData = {
          //nodes: nodes,
          //edges: edges,
        //};

        // Seems like we have to update the view manually here by calling $scope.$apply?
        //$scope.$apply();
  }

  function addAppsNodes(){
    var dm = devicelib(deviceManagerUrl);
    function addAppNodes(deployment){
      dm.devices(deployment.devicequery, deployment.appquery).then(function(devices) {
        //deployment.devices = devices;
        devices.forEach(function(device){
          device.apps.filter(function(app){
            //app.id == 
          });
        });
        console.log(devices);
        console.log(deployment.project);
      });
    }
    $scope.deployments.forEach(addAppNodes);
  }*/

  // A list of "deployment objects".
  // Currently the staged deployment is only stored here in this controller;
  // they are lost on page reload...
  $scope.deployments = [];

  $scope.openManageAppsModal = function() {
    $uibModal.open({
      controller: 'ManageAppsCtrl',
      templateUrl: 'manageapps.html',
      resolve: {
        data: function() { return {
          devices: $scope.selectedDevices,
          devicequery: $scope.devicequery,
          appquery: $scope.appquery}; },
      }
    }).result.then(function(deployment) {
      $scope.deployments.push(deployment);
    });
  };

  $scope.verifyDeployment = function() {
    $uibModal.open({
      controller: 'VerifyDeploymentCtrl',
      templateUrl: 'verifydeployment.html',
      resolve: {
        deployments: function() { return $scope.deployments; },
      }
    }).result.then(function() {
      $scope.deployments = [];
      reloadDevices();
    });
  };

  $scope.discardDeployment = function() {
    $scope.deployments = [];
  };

  $scope.openLogModal = function(device, app) {
    $uibModal.open({
      controller: 'AppLogCtrl',
      templateUrl: 'applog.html',
      resolve: {
        device: device,
        app: app,
      }
    }).result.then(null, function() {
      clearInterval(app._logInterval);
    });
  };

  // "Piping" HTTP request through server.
  // This is necessary for some network configurations...
  function devicePipeUrl(url) {
    return '/api/pipe/'  + url;
  }

  $scope.setAppStatus = function(device, app, status) {
    var url = device.url + '/app/' + app.id;
    return $http({
      url: devicePipeUrl(url),
      method: 'PUT',
      data: {status: status},
    }).then(function(response) {
      // This is a bit of quickndirty way to update app,
      // would be better to load it from the server for realz...
      app.status = response.data.status;
    }, function(error){
      Notification.error("Connection to the application was not succeccfull.");
    });
  };

  $scope.removeApp = function(device, app) {
    var url = device.url + '/app/' + app.id;
    return $http({
      url: devicePipeUrl(url),
      method: 'DELETE',
    }).then(function() {
      var apps = device.apps;
      for (var i=0; i<apps.length; i++) {
        if(apps[i].id === app.id) {
          apps.splice(i, 1);
          return;
        }
      }
    }, function(error){
      Notification.error("Connection to the application was not succeccfull.");
    });
  };

  $scope.selectDevicesForProject = function(project) {
    // Read the liquidiot.json and construct a query based on its
    // 'deviceCapabilities' field.
    $http({
      method: 'GET',
      url: '/api/projects/' + project.name + '/files/liquidiot.json'
    }).then(function(res) {
      var json = JSON.parse(res.data.content);
      var dcs = json['deviceCapabilities'];
      // free-class means all devices, so we remove it from device capabilities.
      // if array becomes empty we query all devices
      // otherwise we query the remaining devices
      var index = dcs.indexOf("free-class");
      if(index != -1){
        dcs.splice(index, 1);
      }
      if (!dcs || !dcs.length) {
        // No deviceCapabilities, query everything *
        $scope.devicequery = '*';
      }
      else {
        $scope.devicequery = '.' + dcs.join('.');
      }
    });
  };

  if($stateParams.project){
    $resource('/api/projects/' + $stateParams.project).get(function(project){
      $scope.selectDevicesForProject(project);
    });
    console.log("1");
    console.log($scope.devicequery);
  }

})

/**
 * Controller for managing (deploying) apps modal dialog.
 */
.controller('ManageAppsCtrl', function($scope, $resource, $uibModalInstance, data) {

  $scope.devices = data.devices;
  $scope.devicequery = data.devicequery;
  $scope.appquery = data.appquery;
  var Project = $resource('/api/projects');
  $scope.projects = Project.query();

  $scope.cancel = function() {
    $uibModalInstance.dismiss('cancel');
  };
  $scope.done = function() {
    // Construct a "deployment object"
    // TODO: we could have various tasks to be done on deployment,
    // currently the only kind of task is to deploy app.
    var deployment = {
      devicequery: data.devicequery,
      appquery: data.appquery,
      project: $scope.selectedProject,
      numApproxDevices: data.devices.length,
      n: $scope.allDevices || !$scope.numDevices ? 'all' : $scope.numDevices,
      removeOld: $scope.removeOld,
    };
    $uibModalInstance.close(deployment);
    //console.log(deployment);
  };
})

/**
 * Controller for the verify deployment modal dialog.
 */
  .controller('VerifyDeploymentCtrl', function($scope, $http, $resource, $uibModalInstance, Notification, deployments, deviceManagerUrl) {

  $scope.deployments = deployments;

  $scope.cancel = function() {
    $uibModalInstance.dismiss('cancel');
  };
  $scope.done = function() {
    $uibModalInstance.close();
  };

  // Returns a promise for deploying the project to the device.
  function deployDevicePromise(device, projectName) {
    var url = device.url;
    Notification.info('Deploying ' + projectName + ' to ' + url);
    return $http({
      method: 'POST',
      url: '/api/projects/' +projectName + '/package',
      data: {deviceUrl: url},
    });
  }

  // Returns a promise for executing the deployment object.
  function deployPromise(deployment) {
    var dm = devicelib(deviceManagerUrl);
    return dm.devices(deployment.devicequery, deployment.appquery).then(function(devices) {
      deployment.devices = devices;
      // Promise.all succeeds iff all the promises succeed.
      // TODO: what to do on (partially) unsuccessful deployment??!?!?!
      return Promise.all(devices.map(function(d) {
        return deployDevicePromise(d, deployment.project);
      }));
    });
  }

  $scope.deploy = function() {
    var deps = $scope.deployments;
    if (!deps.length) {
      return;
    }

    $scope.deploying = true;

    Promise.all(deps.map(deployPromise)).then(function() {
      delete $scope.deploying;
      Notification.success('Deployment successful!');
      $uibModalInstance.close();
    },
    function(err) {
      // At least one of the deployment tasks failed.
      // TODO: what to do on (partially) unsuccessful deployment??!?!?!
      delete $scope.deploying;
      Notification.error('Deployment failed!');
      $uibModalInstance.dismiss('cancel');
    });
  };
})
/**
 * Controller for showing application log.
 */
.controller('AppLogCtrl', function($scope, $http, $uibModalInstance, Notification, device, app) {

    // TODO: refactor, this is needed in 2(?) controllers...
    function devicePipeUrl(url) {
      return '/api/pipe/'  + url;
    }

    $scope.device = device;
    $scope.app = app;
    $scope.cancel = function() {
      $uibModalInstance.dismiss('cancel');
    };
    app._logInterval = setInterval(function() {
      var url = device.url + '/app/' + app.id + '/log';
      $http({
        method: 'GET',
        url: devicePipeUrl(url),
      }).then(function(response) {
        $scope.log = response.data;
      },function(error){
        $scope.cancel();
        Notification.error("Connection to the application was not successful.");
      });
    }, 2000);
  });

