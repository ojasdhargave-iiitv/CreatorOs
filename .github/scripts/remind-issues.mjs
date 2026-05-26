#!/usr/bin/env node

/**
 * Simple Issue Reminder Script
 * Pings assignees on inactive assigned issues
 * - Only runs once per issue
 * - Checks for inactivity > 32 hours
 * - Avoids spam
 */

import { Octokit } from "@octokit/rest";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const owner = process.env.GITHUB_REPOSITORY_OWNER;
const repo = process.env.GITHUB_REPOSITORY.split("/")[1];

async function remindIssues() {
  try {
    console.log(`Checking issues in ${owner}/${repo}...`);

    const issues = await octokit.issues.listForRepo({
      owner,
      repo,
      state: "open",
      per_page: 100,
    });

    const now = new Date();
    let reminderCount = 0;

    for (const issue of issues.data) {
      // Skip if no assignees
      if (!issue.assignees || issue.assignees.length === 0) {
        continue;
      }

      // Skip if already has reminder comment (avoid spam)
      const comments = await octokit.issues.listComments({
        owner,
        repo,
        issue_number: issue.number,
      });

      const hasReminder = comments.data.some(
        (comment) =>
          comment.user.login === "github-actions[bot]" &&
          comment.body.includes("Any progress update")
      );

      if (hasReminder) {
        console.log(`⊘ #${issue.number}: Already reminded`);
        continue;
      }

      // Check inactivity
      const updatedAt = new Date(issue.updated_at);
      const diffHours = (now - updatedAt) / (1000 * 60 * 60);

      if (diffHours >= 32) {
        const assignees = issue.assignees.map((a) => `@${a.login}`).join(", ");

        await octokit.issues.createComment({
          owner,
          repo,
          issue_number: issue.number,
          body: `Hey ${assignees},

Any progress update on this issue? It's been inactive for ${Math.round(diffHours)} hours.

Please share:
- What's blocking you?
- Do you need help?
- What's the ETA?

Thanks!`,
        });

        console.log(`✓ #${issue.number}: Reminder sent to ${assignees}`);
        reminderCount++;
      }
    }

    console.log(`\nCompleted: ${reminderCount} reminder(s) sent`);
  } catch (error) {
    console.error("❌ Reminder check failed:", error.message);
    process.exit(1);
  }
}

remindIssues();
