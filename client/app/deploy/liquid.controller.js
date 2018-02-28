'use strict';

angular.module('koodainApp')
.controller('LiquidCtrl', function($scope, $http, $resource, $uibModal, Notification, DeviceManager, 
        deviceManagerUrl, $q, $mdDialog, $filter ){

      // get the list of projects
    var Project = $resource('/api/projects/:project');

     // the url of RR (Resource Registry) (AKA device manager)
    // RR keeps info about all resources (devices and their host apps, AIs, ...)
    $scope.deviceManagerUrl = deviceManagerUrl;
    
    // Returns an object with wich we can query resources registered to RR
    var deviceManager = DeviceManager(deviceManagerUrl);

    $scope.devList;
    $scope.selectedDevs = [];
    $scope.displayed = [];
    $scope.displayedDevs = [];
    $scope.loadDevices = function () {
      return deviceManager.queryDevicess().then(function(devices) {
        console.log(devices);
        $scope.devList = devices;
        $scope.getInstalledApps();
      }).then(function(devs){
        //$scope.$apply();
        return "done";
      });
    }
  
    $scope.loadDevices();

    Project.query(function(projects){
        $scope.projects = projects;
        angular.forEach($scope.projects, function(value, key, obj) {
          getProjectDetails(value);
          });
      });
    
    function getProjectDetails(project) {
    
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
        project.reqCapabilities = dcs;
        project.appInterfaces = json['applicationInterfaces'];
      })

      $http({
        method: 'GET',
        url: '/api/projects/' + project.name + '/files/package.json'
      }).then(function(res) {
        var json = JSON.parse(res.data.content);
       
        project.version = json.version;
        project.description = json.description;
      })
    };
  
    // "Piping" HTTP request through server.
    // This is necessary for some network configurations...
    function devicePipeUrl(url) {
      return '/api/pipe/'  + url;
    }
    
    $scope.installedApps = [];
  $scope.installedProjectNames = [];
  $scope.installedProjects = [];
  $scope.selectedAppInstances = [];
  $scope.getInstalledApps = function() {
    $scope.installedApps = [];
    $scope.installedProjectNames = [];
    $scope.installedProjects = [];
    
    $scope.devList.forEach(function(dev){
      if(dev.apps) {
        dev.apps.forEach(function(app){
        var installedApp = {
          id: app.id,
          name: app.name,
          version: app.version,
          device: dev,
          status: app.status,
          canRollback: app.canRollback
        };
        if(!$scope.installedProjectNames.includes(app.name)) {
          $scope.installedProjectNames.push(app.name);
          var installedProject = $scope.projects.filter(function(project){
            return project.name == app.name.replace('liquidiot-', '');
          })[0];
          $scope.installedProjects.push(installedProject);
        }
        $scope.installedApps.push(installedApp);
        })
      }
    });
  }
  
  // for select all rows directive
    $scope.selectApp = function(app) {
        var appIndex = $scope.selectedAppInstances.indexOf(JSON.parse('{'+'"id":"'+app.id+'","origin_url":"'+app.device.url+'"}'));
        if(appIndex === -1) {
            $scope.selectedAppInstances.push(JSON.parse('{'+'"id":"'+app.id+'","origin_url":"'+app.device.url+'"}'));
        } else {
            $scope.selectedAppInstances.splice(appIndex, 1);
        }
    }
    
    $scope.selectDev = function(dev) {
        var devIndex = $scope.selectedDevs.indexOf(dev.url);
        if(devIndex === -1) {
            $scope.selectedDevs.push(dev.url);
        } else {
            $scope.selectedDevs.splice(devIndex, 1);
        }
    }
    
    // for select all rows directive
    $scope.selectAllApps = function() {
        if($scope.selectedAppInstances.length === 0) {
          $scope.installedApps.forEach(function(app){
            $scope.selectedAppInstances.push(JSON.parse('{'+'"id":"'+app.id+'","origin_url":"'+app.device.url+'"}'));
          })
        } else if($scope.selectedAppInstances.length > 0 && $scope.selectedAppInstances.length != $scope.installedApps.length) {
          $scope.installedApps.forEach(function(app){
            var isFound = $scope.selectedAppInstances.indexOf(JSON.parse('{'+'"id":"'+app.id+'","origin_url":"'+app.device.url+'"}'));
            if(isFound === -1) {
              $scope.selectedAppInstances.push(JSON.parse('{'+'"id":"'+app.id+'","origin_url":"'+app.device.url+'"}'));
            }
          })
        }
        else {
          $scope.selectedAppInstances = [];
        }
    }
    $scope.selectAllDevs = function() {
        if($scope.selectedDevs.length === 0) {
          $scope.devList.forEach(function(dev){
            $scope.selectedDevs.push(dev.url);
          })
        } else if($scope.selectedDevs.length > 0 && $scope.selectedDevs.length != $scope.devList.length) {
          $scope.devList.forEach(function(dev){
            var isFound = $scope.selectedDevs.indexOf(dev.url);
            if(isFound === -1) {
              $scope.selectedDevs.push(dev.url);
            }
          })
        }
        else {
          $scope.selectedDevs = [];
        }
    }
  
  // A liquid transfer needs to be initiated.
  $scope.sequential = function() {
	
	var url = $scope.selectedAppInstances[0].origin_url + '/transfer/';
        return $http({
          url: devicePipeUrl(url), // URL that needs to transfer the application.
          method: 'POST',
	  json: true,
	  data: {id: $scope.selectedAppInstances[0].id, url: $scope.selectedDevs}, // The id of the app that needs to be transferred and the destinations.
        })
        .then(function(res) {
          Notification.success("The app with id " + $scope.selectedAppInstances[0].id + " in " + $scope.selectedAppInstances[0].origin_url + " was succesfully sequentially transferred.");
          $scope.selectedAppInstances=[];
	  $scope.selectedDevs=[];
	  $scope.loadDevices();
        })
        .catch(function(error){
	  console.log(error);
          Notification.error("Connection to the application was not succeccfull.");
        });
 };
});