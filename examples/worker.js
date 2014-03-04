importScripts('../index.js');
createWorkerProxy(self);

function addToFirstIndexInBuffer(buffer, howMuch, callback) {
  var array = new Uint8Array(buffer);
  array[0] += howMuch;
  callback.transfer([buffer], null, buffer);
}

function answerTheUltimateQuestionOfLifeTheUniverseAndEverything(callback) {
  setTimeout(function () {
    callback(null, 42);
  }, 1000 + Math.random() * 4000);
}

function greet(name, callback) {
  callback(null, 'Hello, ' + name + '!');
}
