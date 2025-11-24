/**
 * Test script to validate dependency hash calculation
 *
 * Usage: node test-dependency-hash.js
 */

const fs = require('fs');
const path = require('path');

// Create test files
const testDir = path.join(__dirname, 'test-samples');

if (!fs.existsSync(testDir)) {
  fs.mkdirSync(testDir, { recursive: true });
}

// Sample 1: JavaScript test with imports
const jsTest = `
import { calculateSum } from './utils';
import { logger } from './logger';

describe('Calculator', () => {
  it('should add numbers correctly', () => {
    expect(calculateSum(2, 3)).toBe(5);
  });
});
`;

const jsUtils = `
export function calculateSum(a, b) {
  return a + b;
}

export function calculateProduct(a, b) {
  return a * b;
}
`;

const jsLogger = `
export const logger = {
  log: (msg) => console.log(msg),
  error: (msg) => console.error(msg),
};
`;

// Sample 2: Python test with imports
const pyTest = `
from .calculator import add, subtract
from .helpers import format_result

def test_addition():
    result = add(5, 3)
    assert result == 8
    assert format_result(result) == "Result: 8"
`;

const pyCalculator = `
def add(a, b):
    return a + b

def subtract(a, b):
    return a - b
`;

const pyHelpers = `
def format_result(value):
    return f"Result: {value}"
`;

// Write test files
fs.writeFileSync(path.join(testDir, 'calculator.test.js'), jsTest);
fs.writeFileSync(path.join(testDir, 'utils.js'), jsUtils);
fs.writeFileSync(path.join(testDir, 'logger.js'), jsLogger);

fs.writeFileSync(path.join(testDir, 'test_calculator.py'), pyTest);
fs.writeFileSync(path.join(testDir, 'calculator.py'), pyCalculator);
fs.writeFileSync(path.join(testDir, 'helpers.py'), pyHelpers);

console.log('✅ Test files created in:', testDir);
console.log('\nTest scenarios:');
console.log('1. JS test with 2 imports (utils.js, logger.js)');
console.log('2. Python test with 2 imports (calculator.py, helpers.py)');
console.log('\nTo test:');
console.log('1. Build the action: npm run build');
console.log('2. The action will now calculate dependency hashes');
console.log('3. Modify utils.js → hash should change');
console.log('4. Modify unrelated file → hash should stay same');
