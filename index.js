;(function (commonjs) {
  function receiveCallsFromOwner(functions) {
    self.addEventListener('message', function (e) {
      var message = e.data;

      if (message.call) {
        var requestId = message.requestId;

        // Find the function to be called.
        var fn = functions[message.call];
        if (!fn) {
          self.postMessage({
            callResponse: requestId,
            arguments: ['That function does not exist']
          });
          return;
        }

        var args = message.arguments || [];
        args.push(function () {
          var args = Array.prototype.slice.call(arguments);
          self.postMessage({callResponse: requestId, arguments: args});
        });
        fn.apply(functions, args);
      }
    });
  }

  function sendCallsToWorker(worker) {
    var callbacks = {};

    worker.addEventListener('message', function (e) {
      var message = e.data;

      if (message.callResponse) {
        var requestId = message.callResponse;
        callbacks[requestId].apply(null, message.arguments);
        delete callbacks[requestId];
      }
    });

    var nextRequestId = 1;

    var getHandler = function (_, name) {
      return function () {
        var id = nextRequestId++,
            args = Array.prototype.slice.call(arguments);
        callbacks[id] = args.pop();
        worker.postMessage({requestId: id, call: name, arguments: args});
      };
    };

    if (Proxy.create) {
      return Proxy.create({get: getHandler});
    } else if (Proxy) {
      return new Proxy({}, {get: getHandler});
    } else {
      throw new Error('Proxy support required');
    }
  }

  /**
   * Call this function with either a Worker instance or a map of functions that
   * can be called inside the worker.
   */
  function createWorkerProxy(workerOrFunctions) {
    if (this.Worker && (workerOrFunctions instanceof Worker)) {
      return sendCallsToWorker(workerOrFunctions);
    } else {
      receiveCallsFromOwner(workerOrFunctions);
    }
  }

  if (commonjs) {
    module.exports = createWorkerProxy;
  } else {
    (this.window || this.self).createWorkerProxy = createWorkerProxy;
  }
})(this.module && typeof module.exports == 'object');
