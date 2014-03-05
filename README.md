Worker Proxy
============

This is a package to make it easy to proxy calls between a web app and
one or more HTML5 Web Workers.

To use it, you just wrap the Worker instance with this package:

```js
var proxy = workerproxy(new Worker('my-worker.js'));
// Note: This might fail in browsers that don't support Harmony proxies.
// See the easy fix and explanation further down.
proxy.greet('Blixt', function (err, message) {
  if (err) alert('Oopsies! ' + err.message);
  else alert(message);
});
```

For the Worker to understand calls, you also need to wrap the object
that has the functions you want to call in the Worker code:

```js
// In my-worker.js:
workerproxy({
  greet: function (name, callback) {
    callback(null, 'Hello, ' + name + '!');
  }
});
```

As you can see, the functions in the Worker are always expected to call
callbacks. Even though this may seem unnecessary at first, the thinking
is that since the calls between the app and the Worker will always be
done asynchronously, it's best to model your code around that fact. The
callbacks are in the Node.js style, which means they take an error as
the first argument, then any number of success values.


Helper options
--------------

If you are writing a very simple Worker and don't want to have to think
about callbacks, you can enable auto callbacks (and automatic catching
of errors):

```js
// In my-worker.js:
var options = {autoCallback: true, catchErrors: true};
workerproxy({
  greet: function (name) {
    if (!name) throw new Error('No name specified!');
    return 'Hello, ' + name + '!';
  }
}, options);
```


Browsers that don't support Harmony Proxies
-------------------------------------------

If you want to support browsers that don't yet support Harmony Proxies,
you may need to do some extra work. While workerproxy will let the app
know what functions it has available, that will take a few milliseconds
to propagate. So if you try to call the proxy immediately, it may fail.
The solution to this is to specify the names of the functions you want
to be able to call immediately:

```js
// In your web app:
var proxy = workerproxy(new Worker('my-worker.js'), {
  functionNames: ['greet']
});

// This will now work even if the browser doesn't support Proxy.
proxy.greet('Blixt', function (err, message) {
  if (err) alert('Oopsies! ' + err.message);
  else alert(message);
});
```


Transferable objects
--------------------

This package also supports transferable objects both ways. To mark an
object for transfer, call the `transfer` method on the function that
you would normally call (the method on the proxy for owner→worker and
the callback for worker→owner). Then pass in the list of objects that
you want to mark as the first argument, followed by the arguments you
would normally pass in.

Here's a short example:

```js
var api = require('workerproxy')(new Worker('worker.js'));

var buffer = new ArrayBuffer(100);
api.fillBuffer.transfer([buffer], buffer, function (err, buffer) {
  var array = new Uint8Array(buffer);
  console.log('Got buffer back:', array);
});
```

The `worker.js` file would look like this:

```js
require('workerproxy')({
  fillBuffer: function (buffer, callback) {
    var array = new Uint8Array(buffer);
    for (var i = 0; i < array.length; i++) {
      array[i] = Math.random() * 255;
    }
    callback.transfer([buffer], null, buffer);
  }
});
```


Distribution of calls to multiple Workers
-----------------------------------------

The last major feature of this package is that it supports taking a list
of Workers. It will then distribute your calls between the Workers so
that the first available Worker will get it (a Worker is considered
available once it has called the `callback` function):

```js
// In your web app:
var proxy = workerproxy([
  new Worker('my-worker.js'),
  new Worker('my-worker.js'),
  new Worker('my-worker.js')
]);
```

All calls will now be distributed between the three Workers. Obviously
you want to ensure that all Workers can handle the calls and return the
same type of data.

In some cases you may want to send the same call to all workers, and for
that you can use the `broadcast` method on the function that you would
normally call:

```js
proxy.greet.broadcast('Blixt', function (err, message) {
  // This will be called once for every worker!
  console.log(message);
});
```


Installing with NPM
===================

```bash
npm install --save workerproxy
```


Examples
========


Vanilla JavaScript
------------------

See the `examples` directory for some simple examples.


CommonJS
--------

To call functions in a worker, wrap it with the `workerproxy` package,
then call methods on the returned object as you normally would. Note
that the last argument should always be a callback that takes an error
argument followed by any number of values.

```js
var api = require('workerproxy')(worker);
api.greet('World', function (err, response) {
  console.log('Worker said:', response);
});
```

Here's how you define the API in the worker file. Note that the last
argument will always be a function to call when you want to return a
value, even if your function is synchronous. This is so that the API
maps 1:1 between how it is defined and how it is called.

```js
require('workerproxy')({
  greet: function (name, callback) {
    callback(null, 'Hello, ' + name + '!');
  }
});
```


Options
=======

Since there are two sides to the worker proxy, the set of options
depends on which "side" you're setting up.


Options in web app
------------------


### `functionNames` (default `[]`)

A list of function names that are specified in the Worker. The reason
this option exists is so that we can support browsers that don't have
the Harmony Proxy object, which allows creating getters for properties
that don't exist on an object. The names in `functionNames` will be
added to a fake proxy object which is then returned, so that you can
call those functions.

Note that the full list of function names will be added to the fake
proxy object automatically, but in an asynchronous manner. So if you
want to guarantee that the functions are available synchronously, use
this option.


### `timeCalls` (default `false`)

Whether to log the time it takes for calls to finish. This requires that
the browser supports `console.time` and `console.timeEnd`.



Options in Worker
-----------------


### `autoCallback` (default `false`)

Automatically call the callback with the return value of the function.
Note that the callback will *always* be called (unless an exception is
thrown) even if you already called it earlier in your function, or
didn't return a value (then it will be called with `undefined`).

If you want to prevent this behavior for a single function, you can call
`callback.disableAuto()` in that function:

```js
workerproxy({
  greet: function (name) {
    return 'Hello, ' + name + '!';
  },

  getName: function (id, callback) {
    // We can't return a value immediately, so disable auto callback.
    callback.disableAuto();

    lookupUser(id, function (err, info) {
      callback(err, info.name);
    });
  }
}, {autoCallback: true});
```


### `catchErrors` (default `false`)

Catch errors in proxied functions and automatically respond with an
error callback instead of throwing the error in the worker.

**Example using `catchErrors`:**

```js
// worker.js

var store = {};

var functions = {
  get: function (key, callback) {
    if (!store.hasOwnProperty(key)) throw new Error('Key not found');
    callback(null, store[key]);
  },
  set: function (key, value, callback) {
    if (key in store && !store.hasOwnProperty(key)) {
      throw new Error('Invalid key');
    }

    store[key] = value;
    callback(null);
  }
};

// CommonJS:
require('workerproxy')(functions, {catchErrors: true});

// Vanilla JavaScript:
createWorkerProxy(functions, {catchErrors: true});
```
