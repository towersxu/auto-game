#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function showHelp() {
  console.log(`
OpenCode Automator - Automatically create OpenCode agents

Usage:
  node index.js <command> [options]

Commands:
  run <task>         Activate OpenCode and create a new agent with the given task
  
  test               Test if OpenCode is installed and accessible
  
  help               Show this help message

Options:
  --delay <ms>       Delay between steps (default: 2000ms)

Examples:
  node index.js run "Fix the bug in authentication module"
  node index.js test
`);
}

function runAppleScript(script) {
  try {
    const result = execSync(`osascript -e '${script.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 60000
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function runAppleScriptFile(scriptPath) {
  try {
    const result = execSync(`osascript "${scriptPath}"`, {
      encoding: 'utf-8',
      timeout: 60000
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function createTempScript(content) {
  const tempDir = '/tmp';
  const tempFile = path.join(tempDir, `opencode-automate-${Date.now()}.scpt`);
  fs.writeFileSync(tempFile, content, 'utf8');
  return tempFile;
}

function escapeAppleScriptString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, ' ')
    .replace(/\r/g, '');
}

async function runTask(taskContent, options = {}) {
  const delay = options.delay || 2000;
  
  console.log('\n🚀 Starting OpenCode Automation...\n');
  console.log(`Task: ${taskContent}`);
  console.log(`Delay: ${delay}ms\n`);
  
  const escapedContent = escapeAppleScriptString(taskContent);
  
  const fullScript = `on run
    tell application "OpenCode"
        activate
    end tell
    
    delay ${(delay / 1000).toFixed(1)}
    
    tell application "System Events"
        tell process "OpenCode"
            set frontmost to true
            delay 0.5
            keystroke "s" using {shift down, command down}
            delay 1.5
            keystroke "${escapedContent}"
            delay 0.8
            keystroke return
        end tell
    end tell
end run
`;

  const tempFile = createTempScript(fullScript);
  
  console.log('Step 1: Activating OpenCode...');
  console.log('Step 2: Sending shortcut ⇧⌘S...');
  console.log('Step 3: Typing task content...');
  console.log('Step 4: Pressing Enter to submit...');
  
  const result = runAppleScriptFile(tempFile);
  
  fs.unlinkSync(tempFile);
  
  if (result.success) {
    console.log('\n✅ Task submitted successfully!');
    console.log('\n📋 The agent should now be processing your task.');
    console.log('   Check the OpenCode window for progress.\n');
  } else {
    console.error('\n❌ Failed to submit task:', result.error);
    
    if (result.error.includes('-10004') || result.error.includes('权限')) {
      console.log('\n⚠️  Running in sandbox - no Accessibility permission!');
      console.log('\n💡 Run this command manually in your terminal:');
      console.log(`   osascript -e 'tell application "OpenCode" to activate'`);
      console.log(`   osascript -e 'tell application "System Events" to tell process "OpenCode" to keystroke "s" using {shift down, command down}'`);
      console.log(`   osascript -e 'tell application "System Events" to tell process "OpenCode" to keystroke "${escapedContent}"'`);
      console.log(`   osascript -e 'tell application "System Events" to tell process "OpenCode" to keystroke return'\n`);
    } else {
      console.log('\nTroubleshooting tips:');
      console.log('1. Make sure OpenCode is installed and running');
      console.log('2. Try running with increased delay: --delay 3000\n');
    }
    process.exit(1);
  }
}

async function runTest() {
  console.log('\n🔍 Testing OpenCode Automator...\n');
  
  console.log('Step 1: Activating OpenCode...');
  const activateScript = `
tell application "OpenCode"
    activate
end tell
`;
  const result = runAppleScript(activateScript);
  
  if (result.success) {
    console.log('✅ OpenCode activated');
  } else {
    console.log('❌ Failed to activate OpenCode:', result.error);
    return;
  }
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\nStep 2: Testing keyboard shortcut ⇧⌘S...');
  console.log('(This will open a new session dialog in OpenCode)');
  
  const testScript = `on run
    tell application "System Events"
        tell process "OpenCode"
            set frontmost to true
            delay 0.3
            keystroke "s" using {shift down, command down}
        end tell
    end tell
end run
`;
  
  const tempFile = createTempScript(testScript);
  const shortcutResult = runAppleScriptFile(tempFile);
  fs.unlinkSync(tempFile);
  
  if (shortcutResult.success) {
    console.log('✅ Keyboard shortcut sent');
    console.log('\nCheck if a new session dialog opened in OpenCode.');
  } else {
    console.log('❌ Failed to send shortcut:', shortcutResult.error);
    
    if (shortcutResult.error.includes('-10004') || shortcutResult.error.includes('权限')) {
      console.log('\n⚠️  Running in sandbox - no Accessibility permission!');
      console.log('\n💡 Run this command manually in your terminal:');
      console.log(`   osascript -e 'tell application "System Events" to tell process "OpenCode" to keystroke "s" using {shift down, command down}'\n`);
    }
  }
  
  console.log('\n✅ Test complete!\n');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help') {
    showHelp();
    return;
  }
  
  const options = {};
  let taskContent = null;
  
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--delay') {
      options.delay = parseInt(args[i + 1], 10);
      i++;
    } else if (!args[i].startsWith('--')) {
      if (!taskContent) {
        taskContent = args[i];
      } else {
        taskContent += ' ' + args[i];
      }
    }
  }
  
  switch (command) {
    case 'run':
      if (!taskContent) {
        console.error('Error: Task content is required for run command');
        console.log('Usage: node index.js run "your task description"');
        process.exit(1);
      }
      runTask(taskContent, options);
      break;
    case 'test':
      runTest();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

parseArgs();
