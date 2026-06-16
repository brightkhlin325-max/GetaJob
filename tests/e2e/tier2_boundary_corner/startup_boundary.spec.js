/**
 * Startup Script Boundary & Corner Case Tests (F6)
 * File: tests/e2e/tier2_boundary_corner/startup_boundary.spec.js
 */
const { test, expect } = require('@playwright/test');
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');
const DbHelper = require('../../helpers/db-helper');

test.describe('F6: One-click startup Script Boundary Cases', () => {
  test.skip(process.platform !== 'win32', 'Batch script tests only run on Windows');
  const scriptPath = path.join(__dirname, '../../../start.bat');
  let dbHelper;

  test.beforeAll(async () => {
    dbHelper = new DbHelper();
  });

  test.afterAll(async () => {
    dbHelper.close();
  });

  const startDummyServer = (port) => {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.once('error', reject);
      server.once('listening', () => resolve(server));
      server.listen(port);
    });
  };

  test('F6-T2-01: Port 3000 busy check', async () => {
    if (!fs.existsSync(scriptPath)) {
      test.skip(true, 'start.bat not yet implemented');
    }

    // Bind port 3000 to trigger conflict
    const dummyServer = await startDummyServer(3000);

    const child = spawn(scriptPath, [], { shell: true });
    let output = '';
    child.stdout.on('data', data => { output += data.toString(); });
    child.stderr.on('data', data => { output += data.toString(); });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
      setTimeout(() => {
        child.kill();
        resolve(-1);
      }, 5000);
    });

    await new Promise(resolve => dummyServer.close(resolve));

    expect(output.toLowerCase()).toContain('port 3000');
    expect(output.toLowerCase()).toContain('already in use');
    expect(exitCode).not.toBe(-1); // Exited by itself
  });

  test('F6-T2-02: Node.js environment missing warning', async () => {
    if (!fs.existsSync(scriptPath)) {
      test.skip(true, 'start.bat not yet implemented');
    }

    // Run script with empty PATH to mock missing node
    const child = spawn(scriptPath, [], {
      shell: true,
      env: { ...process.env, PATH: '' }
    });

    let output = '';
    child.stdout.on('data', data => { output += data.toString(); });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
      setTimeout(() => {
        child.kill();
        resolve(-1);
      }, 5000);
    });

    expect(output.toLowerCase()).toContain('node.js');
    expect(output.toLowerCase()).toContain('install');
    expect(exitCode).not.toBe(-1);
  });

  test('F6-T2-03: Missing node_modules triggers auto-npm install', async () => {
    if (!fs.existsSync(scriptPath)) {
      test.skip(true, 'start.bat not yet implemented');
    }

    // Setup temporary directory with start.bat but no node_modules
    const tempDir = path.join(__dirname, 'temp_startup_test');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
    const tempScriptPath = path.join(tempDir, 'start.bat');
    fs.copyFileSync(scriptPath, tempScriptPath);

    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
      name: 'mock-app',
      scripts: { dev: 'echo "starting server"' }
    }));

    const child = spawn(tempScriptPath, [], {
      cwd: tempDir,
      shell: true
    });

    let output = '';
    child.stdout.on('data', data => { output += data.toString(); });

    await new Promise((resolve) => {
      child.on('close', resolve);
      setTimeout(() => {
        child.kill();
        resolve();
      }, 5000);
    });

    // Clean up temp
    try {
      fs.unlinkSync(tempScriptPath);
      fs.unlinkSync(path.join(tempDir, 'package.json'));
      if (fs.existsSync(path.join(tempDir, 'node_modules'))) {
        fs.rmSync(path.join(tempDir, 'node_modules'), { recursive: true });
      }
      fs.rmdirSync(tempDir);
    } catch (e) {}

    expect(output.toLowerCase()).toContain('npm install');
  });

  test('F6-T2-04: Existing DB data protection', async () => {
    // Seed some settings
    dbHelper.seedSettings({ protection_test: 'safe_data' });

    // Verify it is stored
    const rowBefore = dbHelper.db.prepare("SELECT value FROM settings WHERE key = 'protection_test'").get();
    expect(rowBefore.value).toBe('safe_data');

    // Simulate startup check/migrations (should not overwrite data)
    dbHelper.initSchema();

    // Verify record remains untouched
    const rowAfter = dbHelper.db.prepare("SELECT value FROM settings WHERE key = 'protection_test'").get();
    expect(rowAfter).toBeDefined();
    expect(rowAfter.value).toBe('safe_data');
  });

  test('F6-T2-05: Double script launch prevention', async () => {
    if (!fs.existsSync(scriptPath)) {
      test.skip(true, 'start.bat not yet implemented');
    }

    // Start first instance
    const firstInstance = spawn(scriptPath, [], { shell: true });

    await new Promise(r => setTimeout(r, 2000));

    // Start second instance
    const secondInstance = spawn(scriptPath, [], { shell: true });

    let secondOutput = '';
    secondInstance.stdout.on('data', data => { secondOutput += data.toString(); });

    const secondExitCode = await new Promise((resolve) => {
      secondInstance.on('close', resolve);
      setTimeout(() => {
        secondInstance.kill();
        resolve(-1);
      }, 5000);
    });

    firstInstance.kill();

    expect(secondOutput.toLowerCase()).toContain('already in use');
    expect(secondExitCode).not.toBe(-1); // Second instance should exit itself
  });
});
