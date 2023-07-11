import {
  getInput,
  getMultilineInput,
  info,
  setFailed,
  warning,
  endGroup,
  startGroup,
} from "@actions/core";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import * as path from "node:path";

const config = {
  WRANGLER_VERSION: getInput("wranglerVersion") !== "" ? getInput("wranglerVersion") : "latest",
  bulkSecrets: getInput("bulkSecrets"), // should be JSON
  secrets: getMultilineInput("secrets"),
  workingDirectory: checkWorkingDirectory(getInput("workingDirectory")),
  CLOUDFLARE_API_TOKEN: getInput("apiToken"),
  CLOUDFLARE_ACCOUNT_ID: getInput("accountId"),
  ENVIRONMENT: getInput("environment"),
  VARS: getMultilineInput("vars"),
  COMMANDS: getMultilineInput("commands")
};

export async function main() {
  installWrangler();
  authenticationSetup();
  await execCommands(getMultilineInput("preCommands"));
  await uploadSecrets();
  await genericCommand();
  await execCommands(getMultilineInput("postCommands"));
}

function checkWorkingDirectory(workingDirectory = "") {
  try {
    const normalizedPath = path.normalize(workingDirectory);
    if (existsSync(normalizedPath)) {
      return normalizedPath;
    } else {
      setFailed(`🚨 Directory ${workingDirectory} does not exist.`);
    }
  } catch (error) {
    setFailed(`🚨 While checking/creating directory ${workingDirectory} received ${error}`);
  }
}

function installWrangler() {
  startGroup("📥 Installing Wrangler");
  const command = `pnpm install wrangler@${config["WRANGLER_VERSION"]}`;
  info(`Running Command: ${command}`);
  execSync(command, { cwd: config["workingDirectory"], env: process.env });
  endGroup();
}

function authenticationSetup() {
  startGroup("🔐 Authenticating with Cloudflare");
  try {
    const CLOUDFLARE_ACCOUNT_ID = config["CLOUDFLARE_ACCOUNT_ID"];
    const CLOUDFLARE_API_TOKEN = config["CLOUDFLARE_API_TOKEN"];
    process.env.CLOUDFLARE_API_TOKEN = CLOUDFLARE_API_TOKEN;
    process.env.CLOUDFLARE_ACCOUNT_ID = CLOUDFLARE_ACCOUNT_ID;
    info(`Authentication process initiated with - API Token`);
  } catch (error) {
    setFailed(
      `Authentication details were not found. Please input an 'apiToken' to the action.`
    );
  }
  endGroup();
}

async function execCommands(commands: string[]) {
  startGroup("🚀 Executing Pre/Post Commands");
  if (!commands.length) {
    warning(`📌 Pre/Post Commands were not provided, skipping execution.`);
    return;
  }
  for (const command of commands) {
    const pnpmExecCmd = command.startsWith("wrangler")
      ? `pnpm exec ${command}`
      : command;

    info(`🚀 Executing command: ${pnpmExecCmd}`);

    execSync(pnpmExecCmd, {
      cwd: config["workingDirectory"],
      env: process.env,
    });
  }
  endGroup();
}

async function uploadSecrets() {
  startGroup("🔑 Uploading Secrets");
  const secrets: string[] | string = config["secrets"] // TODO going to use Wrangler secret bulk upload & use secrets to take in JSON too for bulk upload
  if (!secrets.length) {
    warning(`📌 No secrets were provided, skipping upload.`);
    return;
  }
  const environment = config["ENVIRONMENT"];
  const workingDirectory = config["workingDirectory"];

  const promises = secrets.map(async (secret) => {
    if (!process.env[secret] || process.env[secret]?.length === 0) {
      new Error(`🚨 ${secret} not found in variables.`);
    }

    const pnpmExecCmd = process.env.RUNNER_OS === "Windows" ? "pnpm.cmd exec" : "pnpm exec";

    const environmentSuffix =
      environment.length === 0 ? "" : ` --env ${environment}`;
    const secretCmd = `${pnpmExecCmd} wrangler secret put ${secret}${environmentSuffix}`;

    try {
      const buffer = execSync(secretCmd, {
        cwd: workingDirectory,
        env: process.env,
        stdio: "pipe",
      });

      const output = buffer.toString();
      console.log(output);
    } catch (error) {
      if (error instanceof Error) {
        setFailed(`${error.message}`);
      }
    }

    info(`✅ Uploaded secret: ${secret}`);
  });

  try {
    await Promise.all(promises);
  } catch (err) {
    setFailed(err as Error);
  }
  endGroup();
}

async function genericCommand() {
  startGroup("🚀 Executing Generic Command");
  const commands = config["COMMANDS"];
  if (!commands.length) {
    warning(`📌 No generic commands were provided, skipping execution.`);
    return;
  }
  const wranglerVersion = config["WRANGLER_VERSION"];
  const environment = config["ENVIRONMENT"];
  const vars = config["VARS"];
  const workingDirectory = config["workingDirectory"];

  if (commands.length === 0) {
    const deployCommand =
      wranglerVersion === "latest" || wranglerVersion.startsWith("3")
        ? "deploy"
        : "publish";

    warning(`🚨 No commands were provided, falling back to '${deployCommand}'`);

    const envVarArray = vars.map((envVar: string) => {
      if (process.env[envVar] && process.env[envVar]?.length !== 0) {
        return `${envVar}:${process.env[envVar]!}`;
      } else {
        setFailed(`🚨 ${envVar} not found in variables.`);
      }
    });

    const envVarArg: string =
      envVarArray.length > 0 ? `--var ${envVarArray.join(" ").trim()}` : "";

    if (environment.length === 0) {
      execSync(`pnpm exec wrangler ${deployCommand} ${envVarArg}`.trim(), {
        cwd: workingDirectory,
        env: process.env,
      });
    } else {
      execSync(
        `pnpm exec wrangler ${deployCommand} --env ${environment} ${envVarArg}`.trim(),
        { cwd: workingDirectory, env: process.env }
      );
    }
  } else {
    if (environment.length === 0) {
      warning(
        `🚨 An environment as been specified adding '--env ${environment}' is required in the command.`
      );
    }

    return execCommands([`pnpm exec wrangler ${commands}`]);
  }
  endGroup();
}

main().catch((error) => {
  setFailed(error);
});
