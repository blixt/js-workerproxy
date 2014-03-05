importScripts('../index.js');
createWorkerProxy(self, {autoCallback: true});

function greet(name) {
  return 'Hello, ' + name + '!';
}
