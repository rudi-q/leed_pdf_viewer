#!/usr/bin/env node

/**
 * LeedPDF Test Runner Helper
 * 
 * This script provides convenient commands for running different test suites
 * and generates test reports.
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import path from 'path';

const commands = {
  'unit': 'vitest run',
  'unit:watch': 'vitest',
  'unit:ui': 'vitest --ui',
  'unit:coverage': 'vitest run --coverage',
  'e2e': 'playwright test',
  'e2e:headed': 'playwright test --headed',
  'e2e:debug': 'playwright test --debug',
  'e2e:ui': 'playwright test --ui',
  'all': ['vitest run --coverage', 'playwright test'],
  'ci': ['vitest run --coverage --reporter=json --outputFile=coverage/test-results.json', 'playwright test --reporter=json']
};

const testCategories = {
  'pdf': 'src/lib/utils/pdfUtils.test.ts',
  'drawing': 'src/lib/utils/drawingUtils.test.ts', 
  'store': 'src/lib/stores/drawingStore.test.ts',
  'components': 'src/lib/components/**/*.test.ts'
};

function executeCommand(command, options = {}) {
  try {
    console.log(`🚀 Executing: ${command}`);
    const result = execSync(command, {
      stdio: 'inherit',
      encoding: 'utf8',
      ...options
    });
    return { success: true, result };
  } catch (error) {
    console.error(`❌ Command failed: ${command}`);
    console.error(error.message);
    return { success: false, error };
  }
}

function generateTestReport() {
  const reportDir = 'test-reports';
  if (!existsSync(reportDir)) {
    mkdirSync(reportDir, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    testSuites: {},
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0
    }
  };

  // Generate individual test reports
  for (const [category, testFile] of Object.entries(testCategories)) {
    console.log(`📊 Running ${category} tests...`);
    const result = executeCommand(`vitest run ${testFile} --reporter=json --outputFile=${reportDir}/${category}-results.json`);
    report.testSuites[category] = {
      success: result.success,
      file: testFile,
      reportFile: `${reportDir}/${category}-results.json`
    };
  }

  writeFileSync(
    path.join(reportDir, 'test-summary.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(`📋 Test report generated in ${reportDir}/test-summary.json`);
}

function printHelp() {
  console.log(`
🧪 LeedPDF Test Runner

Usage: node scripts/test-runner.js <command> [options]

Commands:
  unit                Run unit tests once
  unit:watch          Run unit tests in watch mode
  unit:ui             Run unit tests with UI
  unit:coverage       Run unit tests with coverage report
  
  e2e                 Run end-to-end tests
  e2e:headed          Run E2E tests with browser UI
  e2e:debug           Run E2E tests in debug mode
  e2e:ui              Run E2E tests with Playwright UI
  
  all                 Run all tests (unit + e2e)
  ci                  Run tests for CI (with JSON reports)
  report              Generate detailed test report
  
  help                Show this help message

Test Categories (for targeted testing):
  pdf                 PDF utilities tests
  drawing             Drawing engine tests
  store               State management tests
  components          Component tests

Examples:
  node scripts/test-runner.js unit
  node scripts/test-runner.js e2e:headed
  node scripts/test-runner.js report
  
Environment Variables:
  TEST_TIMEOUT        Timeout for tests (default: 30000ms)
  TEST_RETRIES        Number of retries (default: 1)
  TEST_WORKERS        Number of parallel workers
`);
}

function validateEnvironment() {
  console.log('🔍 Validating test environment...');
  
  const requiredFiles = [
    'vitest.config.ts',
    'playwright.config.ts',
    'src/test/setup.ts'
  ];

  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      console.error(`❌ Required file missing: ${file}`);
      process.exit(1);
    }
  }

  // Check if required dependencies are installed
  try {
    execSync('pnpm list vitest', { stdio: 'ignore' });
    execSync('pnpm list @playwright/test', { stdio: 'ignore' });
  } catch {
    console.error('❌ Required test dependencies not installed. Run: pnpm install');
    process.exit(1);
  }

  console.log('✅ Environment validation passed');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return;
  }

  validateEnvironment();

  // Handle special commands
  switch (command) {
    case 'report':
      generateTestReport();
      return;
      
    case 'all':
      console.log('🎯 Running all tests...');
      const allCommands = commands[command];
      for (const cmd of allCommands) {
        const result = executeCommand(cmd);
        if (!result.success) {
          console.error('❌ Test suite failed');
          process.exit(1);
        }
      }
      console.log('✅ All tests completed successfully');
      return;
      
    case 'ci':
      console.log('🤖 Running tests for CI...');
      const ciCommands = commands[command];
      let allPassed = true;
      for (const cmd of ciCommands) {
        const result = executeCommand(cmd);
        if (!result.success) {
          allPassed = false;
        }
      }
      process.exit(allPassed ? 0 : 1);
      return;
  }

  // Handle test category commands
  if (testCategories[command]) {
    const testFile = testCategories[command];
    console.log(`🎯 Running ${command} tests...`);
    const result = executeCommand(`vitest run ${testFile}`);
    process.exit(result.success ? 0 : 1);
    return;
  }

  // Handle regular commands
  if (commands[command]) {
    const cmd = commands[command];
    const result = executeCommand(cmd);
    process.exit(result.success ? 0 : 1);
    return;
  }

  console.error(`❌ Unknown command: ${command}`);
  console.log('Run "node scripts/test-runner.js help" for usage information');
  process.exit(1);
}

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Test runner interrupted');
  process.exit(130);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test runner terminated');
  process.exit(143);
});

main();
