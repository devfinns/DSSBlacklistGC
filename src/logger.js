const originalLog = console.log.bind(console);
const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

const timestamp = () => {
    const gmt8 = new Date(Date.now() + 8 * 60 * 60 * 1000);
    return gmt8.toISOString().replace('Z', '+08:00');
};

console.log = (...args) => originalLog(`[${timestamp()}]`, ...args);
console.warn = (...args) => originalWarn(`[${timestamp()}]`, ...args);
console.error = (...args) => originalError(`[${timestamp()}]`, ...args);
