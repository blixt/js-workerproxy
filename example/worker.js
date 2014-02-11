importScripts('../index.js');
createWorkerProxy(self);

function greet(name, callback) {
  callback(null, 'Hello, ' + name + '!');
}
