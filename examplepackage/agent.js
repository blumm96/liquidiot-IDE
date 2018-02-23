module.exports = function Agent(iotApp, emitter){
    
    // public functions that will be overriden by applications
    iotApp.$task = function(){
        throw new Error("task function should be defined.");
    };
    
    iotApp.$initialize = function (initCompleted){
        initCompleted();
    };
    
    iotApp.$terminate = function(terminateCompleted){
        terminateCompleted();
    };
    
    // private properties
    var timer = true;
    var repeat = true;
    var interval = 1000;
    
    // public functions that will be called by applications
    iotApp.$configureInterval = function(_repeat, _interval) {
        repeat = _repeat;
        interval = _interval;
    }
    
    // private functions
    var createInterval = function(f, param, interval) {
        setTimeout( function() {f(param);}, interval );
    }
    
    var s = function() {
        createInterval(iotApp.$task, function(restartMainMessage){
            if(restartMainMessage){
                console.log(restartMainMessage);
            }
            if(timer) {
                s();
            } else {
                iotApp.$terminate(function(stopExecutionMessage){
                    if(stopExecutionMessage){
                        console.log(stopExecutionMessage);
                    }
                    emitter.emit('paused');
                });
            }
        }, interval);
    };
    
    // public functions that will be called by runtime environemnt
    iotApp.start = function() {
        iotApp.$initialize(function(startMainMessage){
            if(startMainMessage){
                console.log(startMainMessage);
            }
            timer = true;
	    setStateVariables();
            iotApp.$task(function(restartMainMessage){
                if(restartMainMessage){
                    console.log(restartMainMessage);
                }
                console.log("app-started-without-error");
                if(emitter){
                  emitter.emit('started');
                }
                if(repeat) {
                    s();
                }
            });
        });
    };
    
    iotApp.stop = function() {
        timer = false;
        if(!repeat) {
            iotApp.$terminate(function(stopExecutionMessage){
                if(stopExecutionMessage){
                    console.log(stopExecutionMessage);
                }
                emitter.emit('paused');
            });
        }
    };
    
    // Set variables to statefile variable values
    function setStateVariables(){
      
      var fs = require('fs');
      var path = require('path');
      // If the state.json does not exist, this is a normal application deployment.
      if(!fs.existsSync(path.resolve(__dirname, 'state.json')){
	console.log("No liquid transfer.");
	return;
      }
      
      // If it does exist, change the variables to those that were passed.
      var obj = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'state.json'),'utf8'));
      for(var key in obj){
	if(obj.hasOwnProperty(key)){
	  iotApp[key] = obj[key];
	}
      }
      
    }
    
}
