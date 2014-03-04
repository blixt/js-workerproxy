;(function (commonjs) {
  function errorObject(error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  function receiveCallsFromOwner(functions, options) {
    if (typeof Proxy == 'undefined') {
      // Let the other side know about our functions if they can't use Proxy.
      var names = [];
      for (var name in functions) names.push(name);
      self.postMessage({functionNames: names});
    }

    function createCallback(id) {
      var fn = function () {
        var args = Array.prototype.slice.call(arguments);
        self.postMessage({callResponse: id, arguments: args});
      };

      fn.transfer = function () {
        var args = Array.prototype.slice.call(arguments),
            transferList = args.shift();
        self.postMessage({callResponse: id, arguments: args}, transferList);
      };

      return fn;
    }

    self.addEventListener('message', function (e) {
      var message = e.data;

      if (message.call) {
        var callId = message.callId;

        // Find the function to be called.
        var fn = functions[message.call];
        if (!fn) {
          self.postMessage({
            callResponse: callId,
            arguments: [errorObject(new Error('That function does not exist'))]
          });
          return;
        }

        var args = message.arguments || [];
        var callback = createCallback(callId)
        args.push(callback);

        if (options.catchErrors) {
          try {
            fn.apply(functions, args);
          } catch (e) {
            callback(errorObject(e));
          }
        } else {
          fn.apply(functions, args);
        }
      }
    });
  }

  function sendCallsToWorker(worker, options) {
    var cache = {},
        callbacks = {},
        timers,
        nextCallId = 1,
        fakeProxy,
        pendingCalls = 0;

    if (options.timeCalls) timers = {};

    if (typeof Proxy == 'undefined') {
      // If we have no Proxy support, we have to pre-define all the functions.
      fakeProxy = {pendingCalls: 0};
      options.functionNames.forEach(function (name) {
        fakeProxy[name] = getHandler(null, name);
      });
    }

    function getHandler(_, name) {
      if (name == 'pendingCalls') return pendingCalls;
      if (cache[name]) return cache[name];

      var fn = cache[name] = function () {
        var args = Array.prototype.slice.call(arguments);
        sendCall(name, args);
      };

      fn.transfer = function () {
        var args = Array.prototype.slice.call(arguments),
            transferList = args.shift();
        sendCall(name, args, transferList);
      };

      return fn;
    }

    function sendCall(name, args, opt_transferList) {
      var id = nextCallId++;

      if (typeof args[args.length - 1] == 'function') {
        callbacks[id] = args.pop();
      }

      if (options.timeCalls) {
        var timerId = name + '(' + args + ')';
        timers[id] = timerId;
        console.time(timerId);
      }

      pendingCalls++;
      if (fakeProxy) fakeProxy.pendingCalls = pendingCalls;
      worker.postMessage({callId: id, call: name, arguments: args}, opt_transferList);
    }

    worker.addEventListener('message', function (e) {
      var message = e.data;

      if (message.callResponse) {
        var callId = message.callResponse;
        pendingCalls--;
        if (fakeProxy) fakeProxy.pendingCalls = pendingCalls;

        if (callbacks[callId]) {
          callbacks[callId].apply(null, message.arguments);
          delete callbacks[callId];
        }

        if (options.timeCalls && timers[callId]) {
          console.timeEnd(timers[callId]);
          delete timers[callId];
        }
      } else if (message.functionNames) {
        message.functionNames.forEach(function (name) {
          fakeProxy[name] = getHandler(null, name);
        });
      }
    });

    if (typeof Proxy == 'undefined') {
      return fakeProxy;
    } else if (Proxy.create) {
      return Proxy.create({get: getHandler});
    } else {
      return new Proxy({}, {get: getHandler});
    }
  }

  /**
   * Call this function with either a Worker instance or a map of functions that
   * can be called inside the worker.
   */
  function createWorkerProxy(workerOrFunctions, opt_options) {
    var options = {
      // Catch errors and automatically respond with an error callback. Off by
      // default since it breaks standard behavior.
      catchErrors: false,
      // A list of functions that can be called. This list will be used to make
      // the proxy functions available when Proxy is not supported. Note that
      // this is generally not needed since the worker will also publish its
      // known functions.
      functionNames: [],
      // Call console.time and console.timeEnd for calls sent though the proxy.
      timeCalls: false
    };

    if (opt_options) {
      for (var key in opt_options) {
        if (!(key in options)) continue;
        options[key] = opt_options[key];
      }
    }
    Object.freeze(options);

    if (typeof Worker != 'undefined' && (workerOrFunctions instanceof Worker)) {
      return sendCallsToWorker(workerOrFunctions, options);
    } else {
      receiveCallsFromOwner(workerOrFunctions, options);
    }
  }

  if (commonjs) {
    module.exports = createWorkerProxy;
  } else {
    var scope;
    if (typeof global != 'undefined') {
      scope = global;
    } else if (typeof window != 'undefined') {
      scope = window;
    } else if (typeof self != 'undefined') {
      scope = self;
    }

    scope.createWorkerProxy = createWorkerProxy;
  }
})(typeof module != 'undefined' && module.exports);
