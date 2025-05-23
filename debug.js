// filepath: c:\Users\janny\development\2ndAIGameAttempt\debug.js
// Empty debug file - prevents debug UI from showing
// Original file is preserved as debug.js.original if needed

console.log('Debug module disabled');

// Empty functions to prevent errors
function logToDisplay() {}

// Don't capture errors or override console
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

// No DOM manipulation
document.addEventListener('DOMContentLoaded', function () {
  // Do nothing
});
