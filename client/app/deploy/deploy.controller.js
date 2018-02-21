'use strict';

angular.module('koodainApp')
.controller('DeployCtrl', function($scope, $http, $resource, $uibModal, Notification, DeviceManager, 
        deviceManagerUrl, $q, uiGridConstants, $mdDialog, $stateParams, $timeout, $rootScope ){

    // get the list of projects
    var Project = $resource('/api/projects/:project');

    // the url of RR (Resource Registry) (AKA device manager)
    // RR keeps info about all resources (devices and their host apps, AIs, ...)    
    // Returns an object with wich we can query resources registered to RR
    var deviceManager = DeviceManager(deviceManagerUrl);    

    // List of devices
    $scope.devList;

    // List of projects
    $scope.projects;

    // Map of capabilities and devices
    $scope.capsAndDevsMap = new Map();

    // List of devices user selects in UI
    $scope.devicesSelected = [];

    // Map of capabilities and projects
    $scope.capsAndAppsMap = new Map();

    // List of projects user selects in UI
    $scope.projectsSelected = [];
    
    // Array of staged deployments
    $scope.stagedDeployments = [];    

    // Settings for the grid listing devices
    $scope.gridOptions = {
        enableFiltering: true,
        enableRowSelection: true,
        multiSelect: true,
        enableSelectAll: true,
        enableFullRowSelection: true,
        enableSelectionBatchEvent: false,
        showGridFooter: true,
        columnDefs: [
            {field: 'name'},
	    {name: 'Url', field: 'url'},
            //{name: 'Location', field: 'location.tag'},     
            {name: 'Capabilities', field: 'classes.toString()'},
            {name: 'Installed apps', field: 'getAppNames()'}
        ]
    };

    // Settings for the grid listing projects
    $scope.projGridOptions = {
        enableFiltering: true,
        enableRowSelection: true,
        multiSelect: true,
        enableSelectAll: true,
        enableFullRowSelection: true,
        columnDefs: [
            {name: 'name', field: 'name'},
            {name: 'Version', field: 'version'}, 
            {name: 'Req.Capabilities', field: 'reqCapabilities.toString()'},
            {field: 'appInterfaces.toString()'}
        ]
    };

       // When user selects devices, list only the projects that can be installed
    // Manage a list of selected devices for staging deployment
    $scope.gridOptions.onRegisterApi = function(gridApi) {
      $scope.gridApi = gridApi;
      gridApi.selection.on.rowSelectionChanged($scope, function(row){      
      console.log("Row selection changed" + row.isSelected);
      if(row.isSelected) {
          $scope.devicesSelected.push(row.entity);
          row.entity.classes.forEach(function(cap) {
          if($scope.capsAndDevsMap.has(cap)){
              var devsWithCap = $scope.capsAndDevsMap.get(cap);
              devsWithCap.push(row.entity._id);
              $scope.capsAndDevsMap.set(cap, devsWithCap);
          }
          else {
              var devsWithCap = [];
              devsWithCap.push(row.entity._id);
              $scope.capsAndDevsMap.set(cap, devsWithCap);
          }
          });
      }
      else {
          $scope.devicesSelected.splice($scope.devicesSelected.indexOf(row.entity), 1);
          row.entity.classes.forEach(function(cap) {
          if($scope.capsAndDevsMap.has(cap)){
              var devsWithCap = $scope.capsAndDevsMap.get(cap);
              var devInd = devsWithCap.indexOf(row.entity._id);
              devsWithCap.splice(devInd, 1);
              if(devsWithCap.length == 0) {
              $scope.capsAndDevsMap.delete(cap);
              } else {
              $scope.capsAndDevsMap.set(cap, devsWithCap);
              }
          }
          });
      }   

      var suitableProjects = [];
      $scope.projects.forEach(function(proj) {
          if(proj.reqCapabilities.length == 0 || isSubset(Array.from($scope.capsAndDevsMap.keys()), proj.reqCapabilities)) {
              suitableProjects.push(proj);
          } 
      });
      $scope.projGridOptions.data = suitableProjects;
      });


      gridApi.selection.on.rowSelectionChangedBatch($scope, function(rows){
      console.log("Row selection changed" + rows.length);
      });
  } //end of OnRegisterApi device grid  


  // When user selects projects, list only devices with required capabilities
  // Manage list of selected projects for staging deployment
  $scope.projGridOptions.onRegisterApi = function(projGridApi) {
    console.log("Progj grid onregisterApi called");
      $scope.projGridApi = projGridApi;
      projGridApi.selection.on.rowSelectionChanged($scope, function(row){        
        console.log("Row selection changed" + row.isSelected);
        console.log(row.entity);
        if(row.isSelected) {
            $scope.projectsSelected.push(row.entity);
            row.entity.reqCapabilities.forEach(function(cap) {
            if($scope.capsAndAppsMap.has(cap)){
                var appsReqCap = $scope.capsAndAppsMap.get(cap);
                appsReqCap.push(row.entity.name);
                $scope.capsAndAppsMap.set(cap, appsReqCap);
            }
            else {
                var appsReqCap = [];
                appsReqCap.push(row.entity.name);
                $scope.capsAndAppsMap.set(cap, appsReqCap);
            }
            });
        }
        else {
            $scope.projectsSelected.splice($scope.projectsSelected.indexOf(row.entity), 1);
            
            row.entity.reqCapabilities.forEach(function(cap) {
            if($scope.capsAndAppsMap.has(cap)){
                var appsReqCap = $scope.capsAndAppsMap.get(cap);
                var appInd = appsReqCap.indexOf(row.entity.name);
                appsReqCap.splice(appInd, 1);
                if(appsReqCap.length == 0) {
                $scope.capsAndAppsMap.delete(cap);
                } else {
                $scope.capsAndAppsMap.set(cap, appsReqCap);
                }
            }
            });
        }        

        if(Array.from($scope.capsAndAppsMap.keys()).length > 0) {
            var suitableDevices = [];
            $scope.devList.forEach(function(dev) {
                if(isSubset(Array.from($scope.capsAndAppsMap.keys()), dev.classes)) {
                suitableDevices.push(dev);
                } 
            });
            $scope.gridOptions.data = suitableDevices;
        } else {
            $scope.gridOptions.data = $scope.devList;
        }
      });


      projGridApi.selection.on.rowSelectionChangedBatch($scope, function(rows){
        console.log("Row selection changed" + rows.length);
      });

      // projGridApi.core.on.rowsRendered($scope, function(){
      //   $timeout(handleProjectParam(), 200);
      // });
      
  } //end of OnRegisterApi project grid

    function geProjInfoLIoTJson(project) {
      return $http({
        method: 'GET',
        url: '/api/projects/' + project.name + '/files/liquidiot.json'
      }).then(function(res) {
        var json = JSON.parse(res.data.content);
        var dcs = json['deviceCapabilities'];
        // free-class means all devices, so we remove it from device capabilities.
        var index = dcs.indexOf("free-class");
        if(index != -1){
            dcs.splice(index, 1);
        }
        project.reqCapabilities = dcs;          
        project.appInterfaces = json['applicationInterfaces'];
        console.log("GOt capabs", project.name);
        return true;
      }).catch(function(err){
        return err;
      })
    }
  
    function geProjInfoPkgJson(project) {
      return $http({
        method: 'GET',
        url: '/api/projects/' + project.name + '/files/package.json'
      }).then(function(res) {
        var json = JSON.parse(res.data.content);          
        project.version = json.version;
        project.description = json.description;
        console.log("GOt versions", project.name);        
        return true;
      }).catch(function(err){
        return err;
      })
    }

    // Read required device capabilities and APIs from liquidiot.json
    // Read version and description from package.json
    function getProjectDetails() {
      Promise.all($scope.projects.map(geProjInfoLIoTJson)).then(handleProjectParam);
      Promise.all($scope.projects.map(geProjInfoPkgJson));
    };

    // Get information of devices 
    $scope.loadDevices = function () {
        return deviceManager.queryDevicess().then(function(devices) {
        console.log(devices);
        $scope.devList = devices;
        $scope.devList.forEach(function(dev){
            dev.getAppNames = function() {
                    var appNames = [];
                    if(this.apps) {
                        this.apps.forEach(function(app){
                        appNames.push(app.name.replace('liquidiot-', ''));
                        })
                    }
                    return appNames.toString();
                };
        })
        $scope.gridOptions.data = devices;
        }).then(function(devs){        
        return "done";
        });
    }

    $scope.loadDevices();
    // Query information of all projects
    Project.query(function(projects){
      $scope.projects = projects;
      // Promise.all($scope.projects.map(function(proj) {
      //   getProjectDetails(proj);
      // })).then(function() {
      //     handleProjectParam();
      // })
      // angular.forEach($scope.projects, function (value, key, obj) {
      //     getProjectDetails(value);
      // });
      $scope.projGridOptions.data = $scope.projects;
      getProjectDetails();      
    });


    var isSubset = function(arr1, arr2){
        return arr1.every(function(value){
          return arr2.indexOf(value) >= 0;
        });
    }
   
    var handleProjectParam = function() {
      console.log("running handleProjectParam");     
      if($stateParams.project){        
          var projRow;
          var index;
          for(index=0; index < $scope.projects.length; index++) {
            if($scope.projects[index].name == $stateParams.project) {
              projRow = $scope.projects[index];
              break;
            }
          }       
          if(projRow) {
            $scope.projGridApi.selection.selectRow(projRow);
          }        
      }     
    }
  
    // Stage deployment of selected projects for selected devices
    $scope.stageDeploy = function() {
        console.log($scope.projectsSelected);
        console.log($scope.devicesSelected);
    
        var strTargetsInfo = [];
        var targetDevices = [];
        $scope.devicesSelected.forEach(function(dev){
          strTargetsInfo.push(dev.name + " in " + dev.location.tag);
          targetDevices.push({url: dev.url});
        })
    
        $scope.projectsSelected.forEach(function(proj){
          var deployInfo = {
            projectName: proj.name,
            selectedDevices: targetDevices,
            strTargets: strTargetsInfo.toString()
          };
          $scope.stagedDeployments.push(deployInfo);
        })
    
        // $uibModal.open({
        //   templateUrl: 'deploysheet.html',
        //   controller: 'deploySheetCtrl',
        //   resolve: {
        //     stagedDeployments: function() { 
        //       return $scope.stagedDeployments; }
        //     }
        // }).result.then(function(deployResults){
        //   console.log(deployResults);
    
        // }) 
        
        $mdDialog.show({
          controller: 'deploySheetCtrl',
          templateUrl: 'deploysheet.html',
          parent: angular.element(document.body),
          clickOutsideToClose:false,
          fullscreen: $scope.customFullscreen, // Only for -xs, -sm breakpoints.
          resolve: {
                stagedDeployments: function() { 
                  return $scope.stagedDeployments; }
                }
        })
        .then(function() {
          $scope.stagedDeployments = []; 
          $scope.status = 'You deployed staged apps';
        }, function() {
          $scope.status = 'You cancelled the dialog.';
        });
    
        $scope.gridApi.selection.clearSelectedRows();
        $scope.projGridApi.selection.clearSelectedRows();
        $scope.capsAndDevsMap.clear();
        $scope.capsAndAppsMap.clear();
        $scope.projectsSelected = [];
        $scope.devicesSelected = [];
        $scope.gridOptions.data = $scope.devList;
        $scope.projGridOptions.data = $scope.projects;
    }

    $scope.clearSelection = function() {
        $scope.gridApi.selection.clearSelectedRows();
        $scope.projGridApi.selection.clearSelectedRows();
        $scope.gridOptions.data = $scope.devList;
        $scope.projGridOptions.data = $scope.projects;
    }

    $scope.openMapView = function() {
        $scope.selectedDeviceIds = [];
        $scope.devicesSelected.forEach(function(dev){
            $scope.selectedDeviceIds.push(dev._key);
        });

        var modalScope = $rootScope.$new();
        modalScope.selectedDevIds = $scope.selectedDeviceIds;
        modalScope.selectedAppIds = [];
        $uibModal.open({          
          templateUrl: 'mapSheet.html',
          controller: 'MapViewCtrl',
          size: 'lg',
          scope: modalScope
          // resolve: {
          //   selectedDevIds: function() { 
          //     return $scope.selectedDeviceIds; },
          //   selectedAppIds: function() { 
          //       return []; }
          //   },
        }).result.then(function(mapViewResults){
          console.log(mapViewResults);
    
        }) 
    }

});
