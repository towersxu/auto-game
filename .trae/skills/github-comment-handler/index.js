#!/usr/bin/env node

const { execSync } = require('child_process');
const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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
        'User-Agent': 'github-comment-handler',
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
    console.error(`Warning: Could not check permission for user ${username}: ${error.message}`);
    return false;
  }
}

function isTaskComment(body) {
  if (!body) return false;
  return body.trim().toLowerCase().startsWith('[task]');
}

async function getIssueComments(owner, repo, adminUsers) {
  const taskComments = [];
  
  try {
    // Get all open issues
    const issues = await githubRequest(`/repos/${owner}/${repo}/issues?state=open&per_page=50`);
    
    for (const issue of issues) {
      // Skip pull requests (they are also issues in GitHub API)
      if (issue.pull_request) continue;
      
      // Get comments for this issue
      const comments = await githubRequest(`/repos/${owner}/${repo}/issues/${issue.number}/comments`);
      
      for (const comment of comments) {
        if (!isTaskComment(comment.body)) continue;
        
        const author = comment.user.login;
        const isAdmin = adminUsers.has(author) || await checkUserPermission(owner, repo, author);
        
        if (isAdmin) {
          taskComments.push({
            id: comment.id,
            type: 'issue',
            issueNumber: issue.number,
            issueTitle: issue.title,
            prNumber: null,
            author: author,
            body: comment.body,
            createdAt: comment.created_at,
            updatedAt: comment.updated_at,
            url: comment.html_url,
            context: {
              issueState: issue.state,
              issueLabels: issue.labels?.map(l => l.name) || [],
              issueBody: issue.body || ''
            }
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error fetching issue comments: ${error.message}`);
  }
  
  return taskComments;
}

async function getPullRequestComments(owner, repo, adminUsers) {
  const taskComments = [];
  
  try {
    // Get all open PRs
    const prs = await githubRequest(`/repos/${owner}/${repo}/pulls?state=open&per_page=50`);
    
    for (const pr of prs) {
      // Get PR review comments (on code)
      try {
        const reviewComments = await githubRequest(`/repos/${owner}/${repo}/pulls/${pr.number}/comments`);
        
        for (const comment of reviewComments) {
          if (!isTaskComment(comment.body)) continue;
          
          const author = comment.user.login;
          const isAdmin = adminUsers.has(author) || await checkUserPermission(owner, repo, author);
          
          if (isAdmin) {
            taskComments.push({
              id: comment.id,
              type: 'pr_review',
              issueNumber: null,
              issueTitle: null,
              prNumber: pr.number,
              prTitle: pr.title,
              author: author,
              body: comment.body,
              createdAt: comment.created_at,
              updatedAt: comment.updated_at,
              url: comment.html_url,
              context: {
                prState: pr.state,
                prBranch: pr.head?.ref,
                prBaseBranch: pr.base?.ref,
                filePath: comment.path,
                lineNumber: comment.line,
                diffHunk: comment.diff_hunk,
                commitId: comment.commit_id
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching review comments for PR #${pr.number}: ${error.message}`);
      }
      
      // Get PR issue comments (general discussion)
      try {
        const issueComments = await githubRequest(`/repos/${owner}/${repo}/issues/${pr.number}/comments`);
        
        for (const comment of issueComments) {
          if (!isTaskComment(comment.body)) continue;
          
          const author = comment.user.login;
          const isAdmin = adminUsers.has(author) || await checkUserPermission(owner, repo, author);
          
          if (isAdmin) {
            taskComments.push({
              id: comment.id,
              type: 'pr_comment',
              issueNumber: null,
              issueTitle: null,
              prNumber: pr.number,
              prTitle: pr.title,
              author: author,
              body: comment.body,
              createdAt: comment.created_at,
              updatedAt: comment.updated_at,
              url: comment.html_url,
              context: {
                prState: pr.state,
                prBranch: pr.head?.ref,
                prBaseBranch: pr.base?.ref
              }
            });
          }
        }
      } catch (error) {
        console.error(`Error fetching issue comments for PR #${pr.number}: ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`Error fetching pull requests: ${error.message}`);
  }
  
  return taskComments;
}

async function fetchTaskComments(options = {}) {
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');

  if (!options.json) {
    console.log(`Fetching comments from ${owner}/${repo}...`);
  }

  let adminUsers;
  try {
    adminUsers = await getRepoCollaborators(owner, repo);
    if (!options.json) {
      console.log(`Found ${adminUsers.size} admin/maintainer users`);
    }
  } catch (error) {
    console.error(`Error fetching collaborators: ${error.message}`);
    adminUsers = new Set();
  }

  // Fetch comments from both issues and PRs
  const [issueComments, prComments] = await Promise.all([
    getIssueComments(owner, repo, adminUsers),
    getPullRequestComments(owner, repo, adminUsers)
  ]);

  const allComments = [...issueComments, ...prComments];
  
  // Sort by creation date (newest first)
  allComments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (options.json) {
    console.log(JSON.stringify(allComments, null, 2));
    return allComments;
  }

  if (allComments.length === 0) {
    console.log('\nNo task comments found from admin users.');
    return [];
  }

  console.log(`\nFound ${allComments.length} task comment(s):\n`);

  for (const comment of allComments) {
    console.log('='.repeat(60));
    
    if (comment.type === 'issue') {
      console.log(`Issue Comment #${comment.id}`);
      console.log(`Issue #${comment.issueNumber}: ${comment.issueTitle}`);
    } else if (comment.type === 'pr_review') {
      console.log(`PR Review Comment #${comment.id}`);
      console.log(`PR #${comment.prNumber}: ${comment.prTitle}`);
      if (comment.context.filePath) {
        console.log(`File: ${comment.context.filePath}:${comment.context.lineNumber}`);
      }
    } else if (comment.type === 'pr_comment') {
      console.log(`PR Comment #${comment.id}`);
      console.log(`PR #${comment.prNumber}: ${comment.prTitle}`);
    }
    
    console.log(`Author: ${comment.author}`);
    console.log(`URL: ${comment.url}`);
    console.log(`Created: ${comment.createdAt}`);
    console.log('-'.repeat(60));
    console.log('Task Description:');
    console.log(comment.body);
    
    if (comment.context) {
      console.log('-'.repeat(60));
      console.log('Context:');
      if (comment.type === 'issue') {
        console.log(`  Issue State: ${comment.context.issueState}`);
        console.log(`  Labels: ${comment.context.issueLabels.join(', ') || 'none'}`);
      } else {
        console.log(`  PR State: ${comment.context.prState}`);
        console.log(`  Branch: ${comment.context.prBranch} -> ${comment.context.prBaseBranch}`);
        if (comment.context.filePath) {
          console.log(`  Code Context:`);
          console.log(`    File: ${comment.context.filePath}`);
          console.log(`    Line: ${comment.context.lineNumber}`);
        }
      }
    }
    
    console.log('='.repeat(60));
    console.log('\n');
  }

  console.log('COMMENTS_OUTPUT_START');
  console.log(JSON.stringify(allComments, null, 2));
  console.log('COMMENTS_OUTPUT_END');

  return allComments;
}

async function getCommentContext(owner, repo, commentId, type, number) {
  try {
    let context = {};
    
    if (type === 'issue') {
      const issue = await githubRequest(`/repos/${owner}/${repo}/issues/${number}`);
      context = {
        type: 'issue',
        number: number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        labels: issue.labels?.map(l => l.name) || []
      };
    } else if (type.startsWith('pr')) {
      const pr = await githubRequest(`/repos/${owner}/${repo}/pulls/${number}`);
      context = {
        type: 'pull_request',
        number: number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        branch: pr.head?.ref,
        baseBranch: pr.base?.ref,
        files: []
      };
      
      // Get changed files
      try {
        const files = await githubRequest(`/repos/${owner}/${repo}/pulls/${number}/files`);
        context.files = files.map(f => ({
          filename: f.filename,
          status: f.status,
          additions: f.additions,
          deletions: f.deletions,
          patch: f.patch
        }));
      } catch (error) {
        console.error(`Error fetching PR files: ${error.message}`);
      }
    }
    
    return context;
  } catch (error) {
    console.error(`Error fetching context: ${error.message}`);
    return null;
  }
}

async function processComment(commentId, options) {
  const repoPath = process.env.GITHUB_REPOSITORY || getRepoInfo();
  const [owner, repo] = repoPath.split('/');

  console.log(`Processing comment ${commentId}...`);

  let comment;
  let context;

  try {
    if (options.issue) {
      // Fetch issue comment
      comment = await githubRequest(`/repos/${owner}/${repo}/issues/comments/${commentId}`);
      context = await getCommentContext(owner, repo, commentId, 'issue', options.issue);
    } else if (options.pr) {
      // Try PR review comment first
      try {
        comment = await githubRequest(`/repos/${owner}/${repo}/pulls/comments/${commentId}`);
        context = await getCommentContext(owner, repo, commentId, 'pr_review', options.pr);
      } catch (error) {
        // Try PR issue comment
        comment = await githubRequest(`/repos/${owner}/${repo}/issues/comments/${commentId}`);
        context = await getCommentContext(owner, repo, commentId, 'pr_comment', options.pr);
      }
    } else {
      console.error('Error: Must specify --issue or --pr');
      process.exit(1);
    }

    if (!isTaskComment(comment.body)) {
      console.error('Error: Comment does not start with [task]');
      process.exit(1);
    }

    const result = {
      comment: {
        id: comment.id,
        author: comment.user.login,
        body: comment.body,
        createdAt: comment.created_at,
        url: comment.html_url
      },
      context: context
    };

    console.log('\n✅ Comment processed successfully');
    console.log(JSON.stringify(result, null, 2));

    return result;
  } catch (error) {
    console.error(`Error processing comment: ${error.message}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
GitHub Comment Handler - Process GitHub comments with [task] prefix

Usage:
  node index.js <command> [options]

Commands:
  fetch              Fetch and list task comments from GitHub
                     Options: --json (output as JSON only)
                     
  process            Process a specific comment as a task
                     Args: <comment-id>
                     Options: --issue <issue-number> (for issue comments)
                              --pr <pr-number> (for PR comments)
                     
  help               Show this help message

Environment Variables:
  GITHUB_TOKEN       GitHub Personal Access Token (required)
  GITHUB_REPOSITORY  Repository in format owner/repo (optional, auto-detected)

Examples:
  node index.js fetch
  node index.js fetch --json
  node index.js process 123456789 --issue 42
  node index.js process 123456789 --pr 15

Comment Format:
  Comments must start with [task] (case-insensitive) to be recognized.
  Example: "[task] Fix the bug in authentication module"
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
  let commentId = null;

  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
      options[key] = value;
      if (typeof value === 'string') i++;
    } else if (!isNaN(parseInt(args[i]))) {
      if (!commentId) {
        commentId = parseInt(args[i]);
      }
    }
  }

  switch (command) {
    case 'fetch':
      fetchTaskComments(options);
      break;
    case 'process':
      if (!commentId) {
        console.error('Error: Comment ID is required for process command');
        process.exit(1);
      }
      if (!options.issue && !options.pr) {
        console.error('Error: Must specify --issue or --pr');
        process.exit(1);
      }
      processComment(commentId, options);
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
