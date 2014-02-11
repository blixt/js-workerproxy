;(function (commonjs) {
  function receiveCallsFromOwner(functions) {
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
            arguments: ['That function does not exist']
          });
          return;
        }

        var args = message.arguments || [];
        args.push(createCallback(callId));
        fn.apply(functions, args);
      }
    });
  }

  function sendCallsToWorker(worker) {
    var callbacks = {}, nextCallId = 1;

    function getHandler(_, name) {
      if (this[name]) return this[name];

      var fn = this[name] = function () {
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

      worker.postMessage({callId: id, call: name, arguments: args}, opt_transferList);
    }

    worker.addEventListener('message', function (e) {
      var message = e.data;

      if (message.callResponse) {
        var callId = message.callResponse;
        if (callbacks[callId]) {
          callbacks[callId].apply(null, message.arguments);
          delete callbacks[callId];
        }
      }
    });

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
})(typeof module == 'object' && typeof module.exports == 'object');
