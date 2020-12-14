import * as core from '@actions/core';
import { exec, ExecOptions } from '@actions/exec';
import { context, getOctokit } from '@actions/github';
import { } from '@actions/github/lib/utils';

const isDev = process.env.NODE_ENV?.toLowerCase() === "development";

const only = core.getInput("only") || "";
const level = core.getInput("level") || "";
const fix = isDev ? true : core.getInput("fix") === "true";
const packageLockOnly = core.getInput("package-lock-only") === "true";
const force = core.getInput("force") === "true";
const projectPath = isDev ? "/tmp/dependabot-test2" : core.getInput("project-path") || "."
const json = core.getInput("json") === "true";

const gitUser = core.getInput("git-user") || "action-npm-audit";
const gitEmail = core.getInput("git-email") || "action-npm-audit";
const gitMessage = core.getInput("git-message") || "npm fix run from npm-audit action";
const gitPullRequestTitle = core.getInput("git-pr-title") || "[SECURITY] NPM audit fix";
const gitBranch = core.getInput("git-branch") || "npm-audit-action";
const gitRemote = core.getInput("git-remote") || "origin";
const githubToken = core.getInput("github-token") || ""


const run = async () => {

  printConfigs();

  if (only && (only !== "dev" && only != "prod")) {
    core.setFailed("'only' option does not have a valid value. Choose 'prod' or 'dev'");
    return;
  }

  if (level && (level !== "low" && level !== "moderate" && level !== "high" && level !== "critical")) {
    core.setFailed("'Acepted values for level are: low, moderate, high or critical");
    return;
  }

  if ((force || packageLockOnly) && !fix) {
    core.setFailed("Cannot use 'package-lock-only' or 'force' without the fix option");
    return;
  }

  if (fix && (level || json)) {
    core.setFailed("Cannot use 'fix' with 'level', 'json' or 'summary' options");
    return;
  }

  let command = `npm audit `;
  if (fix) command += "fix ";
  if (only) command += `--only ${only} `;
  if (level) command += `--level ${level} `;
  if (packageLockOnly) command += `--package-lock-only `;
  if (force) command += `--force  `;
  if (json) command += `--json  `;

  let data: any, octokit;

  core.info("Executing npm audit");
  if (fix) {
    await runFix(command);
  }
  else
    await execNoFailure(command, projectPath);
}


const runFix = async (command: string) => {
  const octokit = getOctokit(githubToken);

  if (isDev) {
    process.env.GITHUB_REPOSITORY = "luisfontes19/test2";
    context.ref = "f7a4ffa7886eac1d2a0ccdbbe8ddf8735be02c95";
  }
  else {
    core.info("   Configuring Git client");
    await exec(`git config --global user.name ${gitUser}`);
    await exec(`git config --global user.email ${gitEmail}`);
  }


  core.info("Checking if branch already exists on remote origin");
  const branches = (await octokit.request("GET /repos/:owner/:repo/branches", { owner: context.repo.owner, repo: context.repo.repo })).data;
  const branchAlreadyExists = branches.find((b: any) => b.name === gitBranch);

  if (branchAlreadyExists) {
    core.info("Found remote branch. Checking out");
    await exec(`git fetch`, undefined, { cwd: projectPath });
    await exec(`git checkout -b ${gitBranch} remotes/${gitRemote}/${gitBranch}`, undefined, { cwd: projectPath });
  }
  else {
    core.info("Branch doesn't exist on remote, checking out locally");
    const branch = await execNoFailure(`git branch --list ${gitBranch}`, projectPath);
    let p = "";
    if (branch.trim().length === 0) p = "-b ";
    await exec(`git checkout ${p} ${gitBranch}`, undefined, { cwd: projectPath });
  }

  const output = await execNoFailure(command, projectPath);

  if (output.endsWith("found 0 vulnerabilities\n")) {
    core.info("Nothing to fix");
    return;
  }

  core.info("Creating Pull Request");
  await createPR(output, octokit);
}

const createPR = async (message: string, octokit: any) => {

  core.info("Getting repo data");
  const { data } = (await octokit.request("GET /repos/:owner/:repo", { owner: context.repo.owner, repo: context.repo.repo }));

  core.info("   Creating commit");
  await exec(`git add .`, undefined, { cwd: projectPath });
  const output = await execNoFailure(`git commit -m "${gitMessage}"`, projectPath);

  if (output.includes("nothing to commit, working tree clean")) return;

  core.info("Pushing changes");
  await exec(`git push ${gitRemote} ${gitBranch}`, undefined, { cwd: projectPath });

  core.info("   Creating Pull Request on Github");


  const pr = await octokit.pulls.create({
    owner: context.repo.owner,
    repo: context.repo.repo,
    title: gitPullRequestTitle,
    body: message,
    base: data.default_branch,
    head: gitBranch,
  });

  // core.info(pr);
}

// const printSummary = (output: string) => {
//   const report = JSON.parse(output);
//   const packages = Object.keys(report.vulnerabilities);
//   packages.forEach(p => {
//     const vulnerablePackage = report.vulnerabilities[p];
//     core.info("----------------------------------------------------------------------------");
//     core.info(`[${vulnerablePackage.severity.toUpperCase()}] ${vulnerablePackage.name}`);

//     vulnerablePackage.via.forEach((via: any) => {
//       if (typeof via === 'string')
//         core.info("Uses a package version with a known vulnerability: " + via);
//       else {
//         core.info("Has a known vulenrability: ")
//         core.info(`   [${via.severity}] ${via.name}: ${via.title}`);
//         core.info("   Reference: " + via.url);

//       }

//       core.info(`   Used in: ${vulnerablePackage.nodes.join(", ")}`);
//       core.info("Affected versions: " + vulnerablePackage.range);
//       core.info("");
//     });
//   })
// }


const execNoFailure = async (command: string, cwd: string): Promise<string> => {
  let output = "";
  const options: ExecOptions = {};
  options.listeners = {
    stdout: (data: Buffer) => output += data.toString()
  };
  options.cwd = cwd;

  return new Promise((resolve, reject) => {
    exec(command, undefined, options).then(() => resolve(output)).catch(() => resolve(output));
  })
}

const printConfigs = () => {
  const configs = { only, level, fix, packageLockOnly, force, projectPath, json, gitUser, gitEmail, gitMessage, gitPullRequestTitle, gitBranch, gitRemote }
  core.info("Starting action with configs: ");
  core.info(JSON.stringify(configs, null, 2));
  core.info("Github token is not printed for security :) ");

}


run();