#!/usr/bin/env node

const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '60000', 10);
const STATE_FILE = path.join(__dirname, '.task-state.json');
const TASK_QUEUE_FILE = path.join(__dirname, '.task-queue.json');
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || process.cwd();

function getRepoInfo() {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();
    const match = remoteUrl.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/);
    if (match) {
      return match[1];
    }
    throw new Error('Could not parse GitHub repository from remote URL');
  } catch (error) {
    throw new Error('Not a git repository or no GitHub remote found');
  }
}

function githubRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: {
        'User-Agent': 'auto-task-runner',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${GITHUB_TOKEN}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function getRepoCollaborators(owner, repo) {
  try {
    const collaborators = await githubRequest(`/repos/${owner}/${repo}/collaborators?affiliation=direct`);
    const adminUsers = new Set();
    for (const collab of collaborators) {
      if (collab.permissions && (collab.permissions.admin || collab.permissions.maintain)) {
        adminUsers.add(collab.login);
      }
    }
    return adminUsers;
  } catch (error) {
    console.error(`Warning: Could not fetch collaborators: ${error.message}`);
    return new Set();
  }
}

async function checkUserPermission(owner, repo, username) {
  try {
    const result = await githubRequest(`/repos/${owner}/${repo}/collaborators/${username}/permission`);
    const permission = result.permission;
    return permission === 'admin' || permission === 'maintain' || permission === 'write';
  } catch (error) {
    return false;
  }
}

function isTaskIssue(title) {
  return title.toLowerCase().startsWith('[task]');
}

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Warning: Could not load state:', error.message);
  }
  return { processed: [], lastCheck: null, currentTask: null };
}

function saveState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Warning: Could not save state:', error.message);
  }
}

function loadTaskQueue() {
  try {
    if (fs.existsSync(TASK_QUEUE_FILE)) {
      const data = fs.readFileSync(TASK_QUEUE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Warning: Could not load task queue:', error.message);
  }
  return { tasks: [] };
}

function saveTaskQueue(queue) {
  try {
    fs.writeFileSync(TASK_QUEUE_FILE, JSON.stringify(queue, null, 2));
  } catch (error) {
    console.error('Warning: Could not save task queue:', error.message);
  }
}

async function fetchNewTaskIssues(owner, repo, processedSet) {
  console.log(`[${new Date().toISOString()}] Fetching issues from ${owner}/${repo}...`);

  const adminUsers = await getRepoCollaborators(owner, repo);
  console.log(`Found ${adminUsers.size} admin/maintainer users`);

  const issues = await githubRequest(`/repos/${owner}/${repo}/issues?state=open&per_page=100`);

  const newTaskIssues = [];

  for (const issue of issues) {
    if (!isTaskIssue(issue.title)) {
      continue;
    }

    const author = issue.user.login;
    const isAdmin = adminUsers.has(author) || await checkUserPermission(owner, repo, author);

    if (isAdmin && !processedSet.has(issue.number)) {
      newTaskIssues.push({
        number: issue.number,
        title: issue.title,
        author: author,
        body: issue.body || '',
        url: issue.html_url
      });
    }
  }

  return newTaskIssues;
}

function execGit(command, options = {}) {
  try {
    const result = execSync(command, { 
      encoding: 'utf-8',
      cwd: options.cwd || WORKSPACE_ROOT,
      stdio: 'pipe'
    });
    return result ? result.trim() : '';
  } catch (error) {
    if (!options.silent) {
      console.error(`Git command failed: ${command}`);
      console.error(error.stderr ? error.stderr.toString() : error.message);
    }
    throw error;
  }
}

function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8', cwd: WORKSPACE_ROOT }).trim();
  } catch (error) {
    return '';
  }
}

function createTaskBranch(issueNumber, issueTitle) {
  const sanitizedTitle = issueTitle
    .toLowerCase()
    .replace(/^\[task\]\s*/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  const branchName = `task/issue-${issueNumber}-${sanitizedTitle}`;
  
  console.log(`Creating branch: ${branchName}`);
  
  const currentBranch = getCurrentBranch();
  if (currentBranch !== 'main' && currentBranch !== 'master') {
    console.log('Switching to main branch first...');
    execGit('git checkout main 2>/dev/null || git checkout master');
  }
  
  execGit('git pull origin main 2>/dev/null || git pull origin master');
  
  const existingBranches = execSync('git branch --list ' + branchName, { 
    encoding: 'utf-8', 
    cwd: WORKSPACE_ROOT 
  }).trim();
  
  if (existingBranches.includes(branchName)) {
    console.log(`Branch ${branchName} already exists, checking it out...`);
    execGit(`git checkout ${branchName}`);
  } else {
    execGit(`git checkout -b ${branchName}`);
  }
  
  return branchName;
}

async function createPullRequest(owner, repo, branchName, issueNumber, issueTitle, issueBody) {
  const prTitle = `Resolve #${issueNumber}: ${issueTitle}`;
  const prBody = `## Summary\n\nThis PR resolves issue #${issueNumber}\n\n## Original Issue\n\n${issueBody || 'No description provided.'}\n\n## Changes\n\n- Implemented the requested feature/fix\n\nCloses #${issueNumber}`;

  console.log(`Creating pull request for issue #${issueNumber}...`);
  
  const result = await githubRequest(`/repos/${owner}/${repo}/pulls`, 'POST', {
    title: prTitle,
    head: branchName,
    base: 'main',
    body: prBody
  });

  console.log(`Pull request created: ${result.html_url}`);
  return result;
}

async function createIssueComment(owner, repo, issueNumber, prUrl, prTitle) {
  const commentBody = `## 🔗 Pull Request Created\n\nA pull request has been created for this task:\n\n**PR:** [${prTitle}](${prUrl})\n\n---\n*This comment was automatically generated by auto-task-runner*`;

  console.log(`Adding comment to issue #${issueNumber}...`);
  
  await githubRequest(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, 'POST', {
    body: commentBody
  });

  console.log(`Comment added to issue #${issueNumber}`);
}

function showHelp() {
  console.log(`
Auto Task Runner - Automatically poll GitHub and process task issues

Usage:
  node index.js <command> [options]

Commands:
  poll              Continuously poll for new issues
                     Options: --interval <ms> (default: 60000)

  fetch             Fetch and list pending tasks

  start <issue>     Start working on an issue (creates branch)

  submit <issue>    Submit completed work (commits, pushes, creates PR)

  status            Show current status

  reset             Reset the state

  help              Show this help message

Environment Variables:
  GITHUB_TOKEN       GitHub Personal Access Token (required)
  GITHUB_REPOSITORY  Repository in format owner/repo (optional, auto-detected)
  POLL_INTERVAL      Polling interval in milliseconds (default: 60000)
  WORKSPACE_ROOT     Root directory for git operations (default: current directory)

Examples:
  # Start polling for new issues
  node index.js poll --interval 300000

  # Check for pending tasks
  node index.js fetch

  # Start working on issue #3
  node index.js start 3

  # Submit completed work for issue #3
  node index.js submit 3
`);
}

async function runPoll(options = {}) {
  const interval = options.interval || POLL_INTERVAL;
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');

  console.log(`Starting auto-task-runner for ${owner}/${repo}`);
  console.log(`Poll interval: ${interval}ms`);
  console.log('Press Ctrl+C to stop\n');

  while (true) {
    try {
      const state = loadState();
      const processedSet = new Set(state.processed);

      const newTasks = await fetchNewTaskIssues(owner, repo, processedSet);

      if (newTasks.length > 0) {
        console.log(`\n🎉 Found ${newTasks.length} new task(s)!`);

        const queue = loadTaskQueue();
        
        for (const task of newTasks) {
          const existingTask = queue.tasks.find(t => t.number === task.number);
          if (!existingTask) {
            queue.tasks.push({
              ...task,
              status: 'pending',
              addedAt: new Date().toISOString()
            });
          }
          
          state.processed.push(task.number);
          
          console.log(`\n📋 Issue #${task.number}: ${task.title}`);
          console.log(`   URL: ${task.url}`);
          console.log(`   Description: ${task.body.substring(0, 100)}...`);
        }
        
        saveTaskQueue(queue);
        state.lastCheck = new Date().toISOString();
        saveState(state);
        
        console.log('\n💡 Run "node index.js fetch" to see all pending tasks');
        console.log('💡 Run "node index.js start <issue>" to start working on a task');
      } else {
        console.log('No new tasks found.');
      }

    } catch (error) {
      console.error('Error during polling:', error.message);
    }

    console.log(`\nNext check in ${interval / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

async function runFetch() {
  const queue = loadTaskQueue();
  
  if (queue.tasks.length === 0) {
    console.log('No pending tasks found.');
    console.log('Run "node index.js poll" to check for new issues.');
    return;
  }

  console.log(`\n📋 Pending Tasks (${queue.tasks.length}):\n`);
  
  for (const task of queue.tasks) {
    console.log('='.repeat(60));
    console.log(`Issue #${task.number}: ${task.title}`);
    console.log(`Status: ${task.status}`);
    console.log(`URL: ${task.url}`);
    console.log(`Added: ${task.addedAt}`);
    console.log('-'.repeat(60));
    console.log(task.body || 'No description');
    console.log('');
  }
  
  console.log('💡 Run "node index.js start <issue>" to start working on a task');
}

async function runStart(issueNumber) {
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');
  
  const queue = loadTaskQueue();
  const task = queue.tasks.find(t => t.number === parseInt(issueNumber));
  
  if (!task) {
    console.error(`Task #${issueNumber} not found in queue.`);
    console.log('Run "node index.js fetch" to see available tasks.');
    return;
  }

  console.log(`\n🚀 Starting work on Issue #${task.number}: ${task.title}`);
  
  const branchName = createTaskBranch(task.number, task.title);
  
  task.status = 'in_progress';
  task.branchName = branchName;
  task.startedAt = new Date().toISOString();
  saveTaskQueue(queue);
  
  console.log(`\n✅ Ready to implement!`);
  console.log(`   Branch: ${branchName}`);
  console.log(`\n📋 Task Description:`);
  console.log(task.body || 'No description');
  console.log(`\n💡 Implement the task, then run "node index.js submit ${task.number}"`);
}

async function runSubmit(issueNumber) {
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');
  
  const queue = loadTaskQueue();
  const task = queue.tasks.find(t => t.number === parseInt(issueNumber));
  
  if (!task) {
    console.error(`Task #${issueNumber} not found in queue.`);
    return;
  }

  console.log(`\n📤 Submitting work for Issue #${task.number}...`);

  const currentBranch = getCurrentBranch();
  console.log(`Current branch: ${currentBranch}`);
  
  const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: WORKSPACE_ROOT }).trim();
  if (status.length > 0) {
    const message = `Complete task for issue #${task.number}: ${task.title}`;
    console.log('Staging all changes...');
    execGit('git add -A');
    console.log(`Committing with message: ${message}`);
    execGit(`git commit -m "${message}"`);
  } else {
    console.log('No uncommitted changes found.');
  }

  console.log(`Pushing branch ${currentBranch} to origin...`);
  execGit(`git push -u origin ${currentBranch}`);

  const pr = await createPullRequest(owner, repo, currentBranch, task.number, task.title, task.body);
  await createIssueComment(owner, repo, task.number, pr.html_url, pr.title);

  task.status = 'completed';
  task.completedAt = new Date().toISOString();
  task.pullRequest = pr.html_url;
  saveTaskQueue(queue);

  queue.tasks = queue.tasks.filter(t => t.number !== parseInt(issueNumber));
  saveTaskQueue(queue);

  console.log('\n✅ Task submitted successfully!');
  console.log(`   Branch: ${currentBranch}`);
  console.log(`   Pull Request: ${pr.html_url}`);
  console.log(`   Issue: ${task.url}`);
}

function showStatus() {
  const state = loadState();
  const queue = loadTaskQueue();
  
  console.log('\nAuto Task Runner Status');
  console.log('='.repeat(40));
  console.log(`Last check: ${state.lastCheck || 'Never'}`);
  console.log(`Processed issues: ${state.processed.length}`);
  console.log(`Pending tasks: ${queue.tasks.length}`);
  
  if (queue.tasks.length > 0) {
    console.log('\nPending tasks:');
    for (const task of queue.tasks) {
      console.log(`  #${task.number}: ${task.title} (${task.status})`);
    }
  }
}

function resetState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
    }
    if (fs.existsSync(TASK_QUEUE_FILE)) {
      fs.unlinkSync(TASK_QUEUE_FILE);
    }
    console.log('✅ State has been reset.');
  } catch (error) {
    console.error('Error resetting state:', error.message);
  }
}

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  const options = {};
  let issueNumber = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (typeof value === 'string') i++;
    } else if (!isNaN(parseInt(args[i]))) {
      issueNumber = parseInt(args[i]);
    }
  }

  switch (command) {
    case 'poll':
      runPoll(options);
      break;
    case 'fetch':
      runFetch();
      break;
    case 'start':
      if (!issueNumber) {
        console.error('Error: Issue number is required for start command');
        process.exit(1);
      }
      runStart(issueNumber);
      break;
    case 'submit':
      if (!issueNumber) {
        console.error('Error: Issue number is required for submit command');
        process.exit(1);
      }
      runSubmit(issueNumber);
      break;
    case 'status':
      showStatus();
      break;
    case 'reset':
      resetState();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    showHelp();
    return;
  }

  if (command === 'reset') {
    resetState();
    return;
  }

  if (!GITHUB_TOKEN) {
    console.error('Error: GITHUB_TOKEN environment variable is required');
    console.error('Please set it with: export GITHUB_TOKEN=your_token_here');
    process.exit(1);
  }

  parseArgs();
}

main().catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
