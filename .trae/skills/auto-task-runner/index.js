#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '60000', 10);
const STATE_FILE = path.join(__dirname, '.processed-issues.json');
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

function loadProcessedIssues() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Warning: Could not load processed issues state:', error.message);
  }
  return { processed: [], lastCheck: null };
}

function saveProcessedIssues(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error('Warning: Could not save processed issues state:', error.message);
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
  execGit(`git checkout -b ${branchName}`);
  
  return branchName;
}

function commitChanges(message) {
  console.log('Staging all changes...');
  execGit('git add -A');
  
  console.log(`Committing with message: ${message}`);
  execGit(`git commit -m "${message}"`);
}

async function pushBranch(branchName, owner, repo) {
  console.log(`Pushing branch ${branchName} to origin...`);
  execGit(`git push -u origin ${branchName}`);
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

async function processTask(owner, repo, task) {
  console.log('\n' + '='.repeat(60));
  console.log(`Processing Issue #${task.number}: ${task.title}`);
  console.log('='.repeat(60));

  const branchName = createTaskBranch(task.number, task.title);
  
  console.log(`\n📋 Task Description:\n${task.body || 'No description'}`);
  
  console.log('\n⏳ Waiting for task implementation...');
  console.log('The task needs to be implemented manually or by an AI agent.');
  console.log('Once implemented, the changes will be committed and submitted.\n');

  return {
    issueNumber: task.number,
    branchName,
    status: 'ready_for_implementation'
  };
}

async function submitTask(owner, repo, task, branchName) {
  console.log(`\n📤 Submitting work for issue #${task.number}...`);

  const currentBranch = getCurrentBranch();
  
  const status = execSync('git status --porcelain', { encoding: 'utf-8', cwd: WORKSPACE_ROOT }).trim();
  if (status.length > 0) {
    const message = `Complete task for issue #${task.number}: ${task.title}`;
    commitChanges(message);
  } else {
    console.log('No uncommitted changes found.');
  }

  await pushBranch(currentBranch, owner, repo);

  const pr = await createPullRequest(owner, repo, currentBranch, task.number, task.title, task.body);

  await createIssueComment(owner, repo, task.number, pr.html_url, pr.title);

  console.log('\n✅ Task submitted successfully!');
  console.log(`   Branch: ${currentBranch}`);
  console.log(`   Pull Request: ${pr.html_url}`);
  console.log(`   Issue: ${task.url}`);

  return {
    branchName: currentBranch,
    pullRequest: pr,
    issue: task
  };
}

function showHelp() {
  console.log(`
Auto Task Runner - Automatically poll GitHub and process task issues

Usage:
  node index.js <command> [options]

Commands:
  poll              Continuously poll for new issues and process them
                     Options: --interval <ms> (default: 60000)

  once              Check for new issues once and process them

  status            Show current status and processed issues

  reset             Reset the processed issues state

  help              Show this help message

Environment Variables:
  GITHUB_TOKEN       GitHub Personal Access Token (required)
  GITHUB_REPOSITORY  Repository in format owner/repo (optional, auto-detected)
  POLL_INTERVAL      Polling interval in milliseconds (default: 60000)
  WORKSPACE_ROOT     Root directory for git operations (default: current directory)

Examples:
  node index.js poll
  node index.js poll --interval 30000
  node index.js once
  node index.js status
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
      const state = loadProcessedIssues();
      const processedSet = new Set(state.processed);

      const newTasks = await fetchNewTaskIssues(owner, repo, processedSet);

      if (newTasks.length > 0) {
        console.log(`\n🎉 Found ${newTasks.length} new task(s)!`);

        for (const task of newTasks) {
          try {
            await processTask(owner, repo, task);
            
            state.processed.push(task.number);
            state.lastCheck = new Date().toISOString();
            saveProcessedIssues(state);
            
            console.log(`\n✅ Issue #${task.number} prepared for implementation`);
          } catch (error) {
            console.error(`\n❌ Error processing issue #${task.number}:`, error.message);
          }
        }
      } else {
        console.log('No new tasks found.');
      }

      state.lastCheck = new Date().toISOString();
      saveProcessedIssues(state);

    } catch (error) {
      console.error('Error during polling:', error.message);
    }

    console.log(`\nNext check in ${interval / 1000} seconds...`);
    await new Promise(resolve => setTimeout(resolve, interval));
  }
}

async function runOnce() {
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');

  console.log(`Checking for new tasks in ${owner}/${repo}...\n`);

  const state = loadProcessedIssues();
  const processedSet = new Set(state.processed);

  const newTasks = await fetchNewTaskIssues(owner, repo, processedSet);

  if (newTasks.length === 0) {
    console.log('No new tasks found.');
    return;
  }

  console.log(`\n🎉 Found ${newTasks.length} new task(s)!`);

  for (const task of newTasks) {
    try {
      await processTask(owner, repo, task);
      
      state.processed.push(task.number);
      state.lastCheck = new Date().toISOString();
      saveProcessedIssues(state);
      
      console.log(`\n✅ Issue #${task.number} prepared for implementation`);
    } catch (error) {
      console.error(`\n❌ Error processing issue #${task.number}:`, error.message);
    }
  }
}

function showStatus() {
  const state = loadProcessedIssues();
  
  console.log('\nAuto Task Runner Status');
  console.log('='.repeat(40));
  console.log(`Last check: ${state.lastCheck || 'Never'}`);
  console.log(`Processed issues: ${state.processed.length}`);
  
  if (state.processed.length > 0) {
    console.log('\nProcessed issue numbers:', state.processed.join(', '));
  }
}

function resetState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
      console.log('✅ Processed issues state has been reset.');
    } else {
      console.log('No state file found. Nothing to reset.');
    }
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

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (typeof value === 'string') i++;
    }
  }

  switch (command) {
    case 'poll':
      runPoll(options);
      break;
    case 'once':
      runOnce();
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
