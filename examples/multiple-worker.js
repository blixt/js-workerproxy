importScripts('../index.js');
createWorkerProxy(self);

function answerTheUltimateQuestionOfLifeTheUniverseAndEverything(callback) {
  setTimeout(function () {
    callback(null, 42);
  }, 1000 + Math.random() * 4000);
}
