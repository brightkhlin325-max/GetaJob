const { test, expect } = require('@playwright/test');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const DbHelper = require('../../helpers/db-helper');


test.describe('F6: One-click start.bat Script', () => {
  test.skip(process.platform !== 'win32', 'Batch script tests only run on Windows');
  const tempDbDir = path.join(__dirname, '../../fixtures/temp_db_startup');
  const testPort = '3005';

  test.beforeEach(() => {
    // Clean up temporary database directory before each test
    if (fs.existsSync(tempDbDir)) {
      fs.rmSync(tempDbDir, { recursive: true, force: true });
    }
  });

  test.afterEach(() => {
    // Clean up temporary database directory after each test
    if (fs.existsSync(tempDbDir)) {
      fs.rmSync(tempDbDir, { recursive: true, force: true });
    }
  });

  test('Script Executable', async () => {
    const scriptPath = path.join(__dirname, '../../../start.bat');
    expect(fs.existsSync(scriptPath)).toBe(true);

    // Spawn the script in dry-run/quick check or start it and verify it spawns
    const child = spawn('cmd.exe', ['/c', scriptPath], {
      env: {
        ...process.env,
        GETAJOB_DB_DIR: tempDbDir,
        PORT: testPort
      }
    });

    expect(child.pid).toBeDefined();

    // Terminate the spawned process cleanly
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${child.pid}`);
    } else {
      child.kill('SIGINT');
    }
  });

  test('Auto-DB Initialization', async () => {
    const scriptPath = path.join(__dirname, '../../../start.bat');
    expect(fs.existsSync(tempDbDir)).toBe(false);

    // Spawn script and verify it creates the DB directory
    const child = spawn('cmd.exe', ['/c', scriptPath], {
      env: {
        ...process.env,
        GETAJOB_DB_DIR: tempDbDir,
        PORT: testPort
      }
    });

    // Wait a brief period for the folder to be created
    let dirCreated = false;
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(tempDbDir)) {
        dirCreated = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    expect(dirCreated).toBe(true);

    // Terminate process tree
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${child.pid}`);
    } else {
      child.kill('SIGINT');
    }
  });

  test('Next.js Server Start', async () => {
    const scriptPath = path.join(__dirname, '../../../start.bat');

    const child = spawn('cmd.exe', ['/c', scriptPath], {
      env: {
        ...process.env,
        GETAJOB_DB_DIR: tempDbDir,
        PORT: testPort
      }
    });

    // Wait for the Next.js server to start and respond on the test port
    let serverResponsive = false;
    const maxRetries = 30;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${testPort}`, (res) => {
            if (res.statusCode === 200 || res.statusCode === 404 || res.statusCode === 302) {
              resolve();
            } else {
              reject(new Error(`Status: ${res.statusCode}`));
            }
          });
          req.on('error', reject);
          req.end();
        });
        serverResponsive = true;
        break;
      } catch (err) {
        // Wait and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    expect(serverResponsive).toBe(true);

    // Terminate process tree
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${child.pid}`);
    } else {
      child.kill('SIGINT');
    }
  });

  test('Auto-Open Web UI', async () => {
    const scriptPath = path.join(__dirname, '../../../start.bat');
    let scriptOutput = '';

    const child = spawn('cmd.exe', ['/c', scriptPath], {
      env: {
        ...process.env,
        GETAJOB_DB_DIR: tempDbDir,
        PORT: testPort
      }
    });

    child.stdout.on('data', (data) => {
      scriptOutput += data.toString();
    });

    // Wait to ensure the batch script output contains the open message
    for (let i = 0; i < 20; i++) {
      if (scriptOutput.includes('Opening web interface')) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    expect(scriptOutput).toContain('Opening web interface');

    // Terminate process tree
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${child.pid}`);
    } else {
      child.kill('SIGINT');
    }
  });

  test('Clean Termination', async () => {
    const scriptPath = path.join(__dirname, '../../../start.bat');

    const child = spawn('cmd.exe', ['/c', scriptPath], {
      env: {
        ...process.env,
        GETAJOB_DB_DIR: tempDbDir,
        PORT: testPort
      }
    });

    // Wait for server to start responding
    let serverStarted = false;
    for (let i = 0; i < 30; i++) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${testPort}`, resolve);
          req.on('error', reject);
          req.end();
        });
        serverStarted = true;
        break;
      } catch (err) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    expect(serverStarted).toBe(true);

    // Kill the process tree to release the port
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${child.pid}`);
    } else {
      child.kill('SIGINT');
    }

    // Verify the port is released
    let portReleased = false;
    for (let i = 0; i < 10; i++) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${testPort}`, () => reject(new Error('Still up')));
          req.on('error', resolve); // Connection refused is expected
          req.end();
        });
        portReleased = true;
        break;
      } catch (err) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    expect(portReleased).toBe(true);
  });
});
