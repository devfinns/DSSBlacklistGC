const originalLog = console.log.bind(console);
const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

const timestamp = () => new Date().toISOString();

console.log = (...args) => originalLog(`[${timestamp()}]`, ...args);
console.warn = (...args) => originalWarn(`[${timestamp()}]`, ...args);
console.error = (...args) => originalError(`[${timestamp()}]`, ...args);
