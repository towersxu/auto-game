#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(process.cwd(), '.trae', 'logs');
const LOG_FILE = path.join(LOGS_DIR, 'dev-tasks.json');

function ensureLogFile() {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
  if (!fs.existsSync(LOG_FILE)) {
    fs.writeFileSync(LOG_FILE, JSON.stringify({ tasks: [] }, null, 2));
  }
}

function loadTasks() {
  ensureLogFile();
  const data = fs.readFileSync(LOG_FILE, 'utf-8');
  return JSON.parse(data);
}

function saveTasks(data) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
  return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function logTask(options) {
  const tasks = loadTasks();
  const task = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    title: options.title || 'Untitled Task',
    description: options.description || '',
    files: options.files || [],
    status: options.status || 'completed',
    source: options.source || 'manual',
    githubIssue: options.githubIssue || null
  };
  tasks.tasks.push(task);
  saveTasks(tasks);
  console.log(`Task logged successfully!`);
  console.log(`ID: ${task.id}`);
  console.log(`Title: ${task.title}`);
  return task;
}

function listTasks(limit = 20) {
  const tasks = loadTasks();
  const recentTasks = tasks.tasks.slice(-limit).reverse();
  
  if (recentTasks.length === 0) {
    console.log('No tasks logged yet.');
    return;
  }

  console.log(`\nRecent ${recentTasks.length} task(s):\n`);
  console.log('='.repeat(60));
  
  for (const task of recentTasks) {
    console.log(`ID: ${task.id}`);
    console.log(`Time: ${task.timestamp}`);
    console.log(`Title: ${task.title}`);
    console.log(`Status: ${task.status}`);
    console.log(`Source: ${task.source}`);
    if (task.files.length > 0) {
      console.log(`Files: ${task.files.join(', ')}`);
    }
    if (task.githubIssue) {
      console.log(`GitHub Issue: #${task.githubIssue.number}`);
    }
    console.log('-'.repeat(60));
  }
}

function searchTasks(keyword) {
  const tasks = loadTasks();
  const results = tasks.tasks.filter(task => 
    task.title.toLowerCase().includes(keyword.toLowerCase()) ||
    task.description.toLowerCase().includes(keyword.toLowerCase())
  );

  if (results.length === 0) {
    console.log(`No tasks found matching "${keyword}"`);
    return;
  }

  console.log(`\nFound ${results.length} task(s) matching "${keyword}":\n`);
  for (const task of results) {
    console.log(`[${task.timestamp}] ${task.title} (${task.status})`);
  }
}

function showHelp() {
  console.log(`
Dev Task Logger - Record and manage development tasks

Usage:
  node index.js <command> [options]

Commands:
  log       Log a new task
            Options: --title, --description, --files, --source, --issue

  list      List recent tasks
            Options: --limit (default: 20)

  search    Search tasks by keyword
            Args: <keyword>

  help      Show this help message

Examples:
  node index.js log --title "Add feature X" --files "src/x.js,src/y.js"
  node index.js list --limit 10
  node index.js search "feature"
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  const options = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
      if (key === 'files') {
        options[key] = value ? value.split(',').map(f => f.trim()) : [];
      } else if (key === 'issue') {
        options.githubIssue = value ? JSON.parse(value) : null;
      } else {
        options[key] = value;
      }
      i++;
    }
  }

  switch (command) {
    case 'log':
      if (!options.title) {
        console.error('Error: --title is required for log command');
        process.exit(1);
      }
      logTask(options);
      break;
    case 'list':
      listTasks(parseInt(options.limit) || 20);
      break;
    case 'search':
      const keyword = args[1];
      if (!keyword) {
        console.error('Error: keyword is required for search command');
        process.exit(1);
      }
      searchTasks(keyword);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

parseArgs();
