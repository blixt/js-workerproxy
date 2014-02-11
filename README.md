Worker Proxy
============

A very simple library for proxying calls between an owner document and
a worker.


Installing
----------

```bash
npm install --save workerproxy
```


Example
-------

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
