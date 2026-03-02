#!/usr/bin/env node

const { execSync } = require('child_process');
const https = require('https');
const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const SUBTASK_LABEL = 'subtask';
const SUBTASK_PENDING_LABEL = 'subtask-pending';
const SUBTASK_IN_PROGRESS_LABEL = 'subtask-in-progress';
const SUBTASK_DONE_LABEL = 'subtask-done';
const PROGRESS_FILE = path.join(__dirname, '.subtask-progress.json');

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

function githubRequest(apiPath, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: method,
      headers: {
        'User-Agent': 'spec-task-decomposer',
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

async function ensureLabel(owner, repo, name, color, description) {
  try {
    await githubRequest(`/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`);
  } catch (error) {
    try {
      await githubRequest(`/repos/${owner}/${repo}/labels`, 'POST', {
        name,
        color,
        description
      });
    } catch (createError) {
      console.error(`Warning: Could not create label '${name}': ${createError.message}`);
    }
  }
}

async function ensureRequiredLabels(owner, repo) {
  await ensureLabel(owner, repo, SUBTASK_LABEL, '0075ca', 'A subtask issue');
  await ensureLabel(owner, repo, SUBTASK_PENDING_LABEL, 'e4e669', 'Subtask pending');
  await ensureLabel(owner, repo, SUBTASK_IN_PROGRESS_LABEL, 'fbca04', 'Subtask in progress');
  await ensureLabel(owner, repo, SUBTASK_DONE_LABEL, '0e8a16', 'Subtask done');
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
    }
  } catch (error) {
    console.error('Warning: Could not load progress file:', error.message);
  }
  return { parents: {} };
}

function saveProgress(progress) {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.error('Warning: Could not save progress file:', error.message);
  }
}

async function decomposeIssue(parentNumber, subtasksJson) {
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');

  let subtasks;
  try {
    subtasks = JSON.parse(subtasksJson);
    if (!Array.isArray(subtasks)) {
      throw new Error('Expected an array of subtasks');
    }
  } catch (error) {
    console.error(`Error parsing subtasks JSON: ${error.message}`);
    process.exit(1);
  }

  console.log(`Fetching parent issue #${parentNumber}...`);
  let parentIssue;
  try {
    parentIssue = await githubRequest(`/repos/${owner}/${repo}/issues/${parentNumber}`);
  } catch (error) {
    console.error(`Error fetching issue #${parentNumber}: ${error.message}`);
    process.exit(1);
  }

  if (parentIssue.state !== 'open') {
    console.error(`Issue #${parentNumber} is not open (state: ${parentIssue.state})`);
    process.exit(1);
  }

  console.log(`Ensuring required labels exist...`);
  await ensureRequiredLabels(owner, repo);

  const progress = loadProgress();
  if (!progress.parents[parentNumber]) {
    progress.parents[parentNumber] = {
      title: parentIssue.title,
      url: parentIssue.html_url,
      subtasks: [],
      createdAt: new Date().toISOString()
    };
  }

  console.log(`\nCreating ${subtasks.length} subtask(s) for issue #${parentNumber}: ${parentIssue.title}\n`);

  const createdSubtasks = [];
  for (let i = 0; i < subtasks.length; i++) {
    const subtask = subtasks[i];
    const subtaskTitle = `[subtask] ${subtask.title}`;
    const subtaskBody = `${subtask.body || ''}\n\n---\nParent Issue: #${parentNumber}\nSubtask ${i + 1} of ${subtasks.length}`;

    console.log(`Creating subtask ${i + 1}/${subtasks.length}: ${subtask.title}`);

    let createdIssue;
    try {
      createdIssue = await githubRequest(`/repos/${owner}/${repo}/issues`, 'POST', {
        title: subtaskTitle,
        body: subtaskBody,
        labels: [SUBTASK_LABEL, SUBTASK_PENDING_LABEL]
      });

      console.log(`  ✅ Created #${createdIssue.number}: ${createdIssue.html_url}`);

      createdSubtasks.push({
        number: createdIssue.number,
        title: subtask.title,
        url: createdIssue.html_url,
        status: 'pending'
      });
    } catch (error) {
      console.error(`  ❌ Failed to create subtask: ${error.message}`);
    }
  }

  progress.parents[parentNumber].subtasks.push(...createdSubtasks);
  saveProgress(progress);

  const checklistItems = createdSubtasks.map(s => `- [ ] #${s.number} ${s.title}`).join('\n');
  const progressComment = `## 📋 Subtask Breakdown\n\nThis issue has been decomposed into the following subtasks:\n\n${checklistItems}\n\n---\n*Generated by spec-task-decomposer*`;

  try {
    await githubRequest(`/repos/${owner}/${repo}/issues/${parentNumber}/comments`, 'POST', {
      body: progressComment
    });
    console.log(`\nProgress checklist added to issue #${parentNumber}`);
  } catch (error) {
    console.error(`Warning: Could not add comment to parent issue: ${error.message}`);
  }

  console.log(`\n✅ Decomposition complete!`);
  console.log(`   Parent: #${parentNumber} ${parentIssue.title}`);
  console.log(`   Subtasks created: ${createdSubtasks.length}`);
  console.log(`\n💡 Run "node index.js status ${parentNumber}" to view subtask progress`);
  console.log(`💡 Run "node index.js next ${parentNumber}" to get the next pending subtask`);

  return createdSubtasks;
}

async function showStatus(parentNumber) {
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');

  const progress = loadProgress();
  const parentData = progress.parents[parentNumber];

  if (!parentData || parentData.subtasks.length === 0) {
    console.log(`No subtasks found for issue #${parentNumber}.`);
    console.log(`Run "node index.js decompose ${parentNumber} --tasks '[...]'" to create subtasks.`);
    return;
  }

  console.log(`\n📊 Subtask Progress for Issue #${parentNumber}: ${parentData.title}`);
  console.log('='.repeat(60));

  let pending = 0, inProgress = 0, done = 0;

  for (const subtask of parentData.subtasks) {
    let liveStatus = subtask.status;
    try {
      const issue = await githubRequest(`/repos/${owner}/${repo}/issues/${subtask.number}`);
      if (issue.state === 'closed') {
        liveStatus = 'done';
      } else if (issue.labels && issue.labels.some(l => l.name === SUBTASK_IN_PROGRESS_LABEL)) {
        liveStatus = 'in-progress';
      } else {
        liveStatus = 'pending';
      }
      if (liveStatus !== subtask.status) {
        subtask.status = liveStatus;
      }
    } catch (error) {
      console.error(`Warning: Could not fetch issue #${subtask.number}: ${error.message}`);
    }

    const icon = liveStatus === 'done' ? '✅' : liveStatus === 'in-progress' ? '🔄' : '⏳';
    console.log(`${icon} #${subtask.number} [${liveStatus}] ${subtask.title}`);
    console.log(`   ${subtask.url}`);

    if (liveStatus === 'done') done++;
    else if (liveStatus === 'in-progress') inProgress++;
    else pending++;
  }

  saveProgress(progress);

  console.log('\n' + '='.repeat(60));
  console.log(`Total: ${parentData.subtasks.length} | ✅ Done: ${done} | 🔄 In Progress: ${inProgress} | ⏳ Pending: ${pending}`);

  if (pending === 0 && inProgress === 0) {
    console.log('\n🎉 All subtasks are complete!');
  } else {
    console.log(`\n💡 Run "node index.js next ${parentNumber}" to get the next pending subtask`);
  }
}

async function getNextSubtask(parentNumber) {
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');

  const progress = loadProgress();
  const parentData = progress.parents[parentNumber];

  if (!parentData || parentData.subtasks.length === 0) {
    console.log(`No subtasks found for issue #${parentNumber}.`);
    return null;
  }

  for (const subtask of parentData.subtasks) {
    let issue;
    try {
      issue = await githubRequest(`/repos/${owner}/${repo}/issues/${subtask.number}`);
    } catch (error) {
      console.error(`Warning: Could not fetch issue #${subtask.number}: ${error.message}`);
      continue;
    }

    const isDone = issue.state === 'closed';
    const isInProgress = issue.labels && issue.labels.some(l => l.name === SUBTASK_IN_PROGRESS_LABEL);

    if (!isDone && !isInProgress) {
      console.log(`\n📋 Next pending subtask:`);
      console.log(`   Issue: #${subtask.number}`);
      console.log(`   Title: ${subtask.title}`);
      console.log(`   URL: ${subtask.url}`);
      console.log(`   Body: ${issue.body || 'No description'}`);
      console.log(`\n💡 Run "node index.js start ${subtask.number}" to begin working on it`);

      console.log('\nNEXT_SUBTASK_START');
      console.log(JSON.stringify({ number: subtask.number, title: subtask.title, url: subtask.url, body: issue.body }));
      console.log('NEXT_SUBTASK_END');

      return subtask;
    }
  }

  console.log(`\n✅ No pending subtasks for issue #${parentNumber}.`);
  console.log(`Run "node index.js status ${parentNumber}" to see full progress.`);
  return null;
}

async function startSubtask(subtaskNumber) {
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');

  console.log(`Starting subtask #${subtaskNumber}...`);

  let issue;
  try {
    issue = await githubRequest(`/repos/${owner}/${repo}/issues/${subtaskNumber}`);
  } catch (error) {
    console.error(`Error fetching issue #${subtaskNumber}: ${error.message}`);
    process.exit(1);
  }

  if (issue.state === 'closed') {
    console.error(`Subtask #${subtaskNumber} is already closed.`);
    process.exit(1);
  }

  try {
    await githubRequest(`/repos/${owner}/${repo}/issues/${subtaskNumber}/labels/${encodeURIComponent(SUBTASK_PENDING_LABEL)}`, 'DELETE');
  } catch (error) {
    // Label may not exist, ignore
  }

  try {
    await githubRequest(`/repos/${owner}/${repo}/issues/${subtaskNumber}/labels`, 'POST', {
      labels: [SUBTASK_IN_PROGRESS_LABEL]
    });
  } catch (error) {
    console.error(`Warning: Could not add in-progress label: ${error.message}`);
  }

  const progress = loadProgress();
  for (const parentNum of Object.keys(progress.parents)) {
    const parent = progress.parents[parentNum];
    const sub = parent.subtasks.find(s => parseInt(s.number) === parseInt(subtaskNumber));
    if (sub) {
      sub.status = 'in-progress';
      sub.startedAt = new Date().toISOString();
    }
  }
  saveProgress(progress);

  console.log(`\n✅ Subtask #${subtaskNumber} marked as in-progress`);
  console.log(`   Title: ${issue.title}`);
  console.log(`   URL: ${issue.html_url}`);
  console.log(`\n💡 Run "node index.js complete ${subtaskNumber}" when done`);
}

async function completeSubtask(subtaskNumber) {
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');

  console.log(`Completing subtask #${subtaskNumber}...`);

  let issue;
  try {
    issue = await githubRequest(`/repos/${owner}/${repo}/issues/${subtaskNumber}`);
  } catch (error) {
    console.error(`Error fetching issue #${subtaskNumber}: ${error.message}`);
    process.exit(1);
  }

  if (issue.state === 'closed') {
    console.log(`Subtask #${subtaskNumber} is already closed.`);
    return;
  }

  try {
    await githubRequest(`/repos/${owner}/${repo}/issues/${subtaskNumber}/labels/${encodeURIComponent(SUBTASK_IN_PROGRESS_LABEL)}`, 'DELETE');
  } catch (error) {
    // Label may not exist, ignore
  }

  try {
    await githubRequest(`/repos/${owner}/${repo}/issues/${subtaskNumber}/labels/${encodeURIComponent(SUBTASK_PENDING_LABEL)}`, 'DELETE');
  } catch (error) {
    // Label may not exist, ignore
  }

  try {
    await githubRequest(`/repos/${owner}/${repo}/issues/${subtaskNumber}/labels`, 'POST', {
      labels: [SUBTASK_DONE_LABEL]
    });
  } catch (error) {
    console.error(`Warning: Could not add done label: ${error.message}`);
  }

  try {
    await githubRequest(`/repos/${owner}/${repo}/issues/${subtaskNumber}`, 'PATCH', {
      state: 'closed'
    });
    console.log(`Closed issue #${subtaskNumber}`);
  } catch (error) {
    console.error(`Error closing issue #${subtaskNumber}: ${error.message}`);
    process.exit(1);
  }

  const progress = loadProgress();
  let parentNumber = null;
  for (const parentNum of Object.keys(progress.parents)) {
    const parent = progress.parents[parentNum];
    const sub = parent.subtasks.find(s => parseInt(s.number) === parseInt(subtaskNumber));
    if (sub) {
      sub.status = 'done';
      sub.completedAt = new Date().toISOString();
      parentNumber = parentNum;
    }
  }
  saveProgress(progress);

  console.log(`\n✅ Subtask #${subtaskNumber} completed!`);

  if (parentNumber) {
    console.log(`\n💡 Run "node index.js status ${parentNumber}" to check overall progress`);
    console.log(`💡 Run "node index.js next ${parentNumber}" to get the next subtask`);
  }
}

function showHelp() {
  console.log(`
Spec Task Decomposer - Decompose requirements into subtasks and track progress

Usage:
  node index.js <command> [options]

Commands:
  decompose <parent-issue>    Create subtasks for a parent issue
                               Options: --tasks '<JSON array>'
                               JSON format: [{"title":"...","body":"..."},...]

  status <parent-issue>       Show progress of all subtasks for a parent issue

  next <parent-issue>         Get the next pending subtask

  start <subtask-issue>       Mark a subtask as in-progress

  complete <subtask-issue>    Mark a subtask as done and close it

  help                        Show this help message

Environment Variables:
  GITHUB_TOKEN       GitHub Personal Access Token (required)
  GITHUB_REPOSITORY  Repository in format owner/repo (optional, auto-detected)

Examples:
  node index.js decompose 22 --tasks '[{"title":"Setup CI","body":"Configure GitHub Actions"},{"title":"Write tests","body":"Add unit tests"}]'
  node index.js status 22
  node index.js next 22
  node index.js start 23
  node index.js complete 23
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
    case 'decompose':
      if (!issueNumber) {
        console.error('Error: Parent issue number is required for decompose command');
        process.exit(1);
      }
      if (!options.tasks) {
        console.error('Error: --tasks JSON array is required for decompose command');
        console.error('Example: --tasks \'[{"title":"Task 1","body":"Description 1"}]\'');
        process.exit(1);
      }
      decomposeIssue(issueNumber, options.tasks);
      break;
    case 'status':
      if (!issueNumber) {
        console.error('Error: Parent issue number is required for status command');
        process.exit(1);
      }
      showStatus(issueNumber);
      break;
    case 'next':
      if (!issueNumber) {
        console.error('Error: Parent issue number is required for next command');
        process.exit(1);
      }
      getNextSubtask(issueNumber);
      break;
    case 'start':
      if (!issueNumber) {
        console.error('Error: Subtask issue number is required for start command');
        process.exit(1);
      }
      startSubtask(issueNumber);
      break;
    case 'complete':
      if (!issueNumber) {
        console.error('Error: Subtask issue number is required for complete command');
        process.exit(1);
      }
      completeSubtask(issueNumber);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      showHelp();
      process.exit(1);
  }
}

async function main() {
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
