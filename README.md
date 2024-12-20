# Wrangler GitHub Action

Easy-to-use GitHub Action to use [Wrangler](https://developers.cloudflare.com/workers/cli-wrangler/). Makes deploying Workers a breeze.

## Big Changes in v3

- Wrangler v1 is no longer supported.
- Global API key & Email Auth no longer supported
- Action version syntax is newly supported. This means e.g. `uses: cloudflare/wrangler-action@v3`, `uses: cloudflare/wrangler-action@v3.x`, and `uses: cloudflare/wrangler-action@v3.x.x` are all now valid syntax. Previously supported syntax e.g. `uses: cloudflare/wrangler-action@3.x.x` is no longer supported -- the prefix `v` is now necessary.

[Refer to Changelog for more information](CHANGELOG.md).

## Usage

Add `wrangler-action` to the workflow for your Workers/Pages application. The below example will deploy a Worker on a `git push` to the `main` branch:

```yaml
name: Deploy

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Authentication

You'll need to configure Wrangler using [GitHub's Secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions). feature - go to "Settings -> Secrets" and add your Cloudflare API token (for help finding this, see the [Workers documentation](https://developers.cloudflare.com/workers/wrangler/ci-cd/#api-token)). Note that this must be a [user token](https://dash.cloudflare.com/profile/api-tokens) not an account token. Your API token is encrypted by GitHub, and the action won't print it into logs, so it should be safe!

With your API token set as a secret for your repository, pass it to the action in the `with` block of your workflow. Below, I've set the secret name to `CLOUDFLARE_API_TOKEN`:

```yaml
jobs:
  deploy:
    name: Deploy
    steps:
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

## Configuration

If you need to install a specific version of Wrangler to use for deployment, you can also pass the input `wranglerVersion` to install a specific version of Wrangler from NPM. This should be a [SemVer](https://semver.org/)-style version number, such as `2.20.0`:

```yaml
jobs:
  deploy:
    steps:
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        wranglerVersion: "2.20.0"
```

Optionally, you can also pass a `workingDirectory` key to the action. This will allow you to specify a subdirectory of the repo to run the Wrangler command from.

```yaml
jobs:
  deploy:
    steps:
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        workingDirectory: "subfoldername"
```

[Worker secrets](https://developers.cloudflare.com/workers/tooling/wrangler/secrets/) can optionally be passed in via `secrets` as a string of names separated by newlines. Each secret name must match the name of an environment variable specified in the `env` field. This creates or replaces the value for the Worker secret using the `wrangler secret put` command. It's also possible to specify worker environment using environment parameter.

```yaml
jobs:
  deploy:
    steps:
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        environment: production
        secrets: |
          SECRET1
          SECRET2
      env:
        SECRET1: ${{ secrets.SECRET1 }}
        SECRET2: ${{ secrets.SECRET2 }}
```

If you need to run additional shell commands before or after your command, you can specify them as input to `preCommands` (before `deploy`) or `postCommands` (after `deploy`). These can include additional `wrangler` commands (that is, `whoami`, `kv:key put`) or any other commands available inside the `wrangler-action` context.

```yaml
jobs:
  deploy:
    steps:
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        preCommands: echo "*** pre command ***"
        postCommands: |
          echo "*** post commands ***"
          wrangler kv:key put --binding=MY_KV key2 value2
          echo "******"
```

You can use the `command` option to do specific actions such as running `wrangler whoami` against your project:

```yaml
jobs:
  deploy:
    steps:
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        command: whoami
```

You can also add a command that spans multiple lines:

```yaml
jobs:
  deploy:
    steps:
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        command: |
          pages project list
          pages deploy .vercel/output/static --project-name=demo-actions --branch=test
```

## Use cases

### Deploy when commits are merged to main

The above workflow examples have already shown how to run `wrangler-action` when new commits are merged to the main branch. For most developers, this workflow will easily replace manual deploys and be a great first integration step with `wrangler-action`:

```yaml
on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

Note that there are a number of possible events, like `push`, that can be used to trigger a workflow. For more details on the events available, refer to the [GitHub Actions documentation](https://help.github.com/en/articles/workflow-syntax-for-github-actions#on).

### Deploy your Pages site (production & preview)

If you want to deploy your Pages project with GitHub Actions rather than the built-in continous integration (CI), then this is a great way to do it. Wrangler 2 will populate the commit message and branch for you. You only need to pass the project name. If a push to a non-production branch is done, it will deploy as a preview deployment:

```yaml
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy YOUR_DIST_FOLDER --project-name=example
          # Optional: Enable this if you want to have GitHub Deployments triggered
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}
```

### Deploying on a schedule

If you would like to deploy your Workers application on a recurring basis – for example, every hour, or daily – the `schedule` trigger allows you to use cron syntax to define a workflow schedule. The below example will deploy at the beginning of every hour:

```yaml
on:
  schedule:
    - cron: "0 * * * *"

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4
      - name: Deploy app
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

If you need help defining the correct cron syntax, check out [crontab.guru](https://crontab.guru/), which provides a friendly user interface for validating your cron schedule.

### Manually triggering a deployment

If you need to trigger a workflow at-will, you can use GitHub's `workflow_dispatch` [event](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#workflow_dispatch) in your workflow file. By setting your workflow to trigger on that event, you will be able to deploy your application via the GitHub UI. The UI also accepts inputs that can be used to configure the action:

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: "Choose an environment to deploy to: <dev|staging|prod>"
        required: true
        default: "dev"
jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4
      - name: Deploy app
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          command: deploy --env ${{ github.event.inputs.environment }}
```

For more advanced usage or to programmatically trigger the workflow from scripts, refer to [the GitHub documentation](https://docs.github.com/en/rest/reference/actions#create-a-workflow-dispatch-event) for making API calls.

### Upload a Worker Version

To create a new version of your Worker that is not deployed immediately, use the `wrangler versions upload` command. Worker versions created in this way can then be deployed all at once at a later time or gradually deployed using the `wrangler versions deploy` command or via the Cloudflare dashboard under the Deployments tab. Wrangler v3.40.0 or above is required to use this feature.

```yaml
jobs:
  upload:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4
      - name: Upload Worker Version
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: versions upload
```

## Advanced Usage

### Setting A Worker Secret for A Specific Environment

There is an environment parameter that can be set within the workflow to enable this. Example:

```yaml
- uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    command: deploy --env production
    secrets: |
      SUPER_SECRET
    environment: production
  env:
    SUPER_SECRET: ${{ secrets.SUPER_SECRET }}
```

### Using Wrangler Command Output in Subsequent Steps

More advanced workflows may need to parse the resulting output of Wrangler commands. To do this, you can use the `command-output` output variable in subsequent steps. For example, if you want to print the output of the Wrangler command, you can do the following:

```yaml
- name: Deploy
  id: deploy
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: pages deploy --project-name=example

- name: print wrangler command output
  env:
    CMD_OUTPUT: ${{ steps.deploy.outputs.command-output }}
  run: echo $CMD_OUTPUT
```

Now when you run your workflow, you will see the full output of the Wrangler command in your workflow logs. You can also use this output in subsequent workflow steps to parse the output for specific values.

> Note: the `command-stderr` output variable is also available if you need to parse the standard error output of the Wrangler command.

### Using the `deployment-url` and `pages-deployment-alias-url` Output Variables

If you are executing a Wrangler command that results in either a Workers or Pages deployment, you can utilize the `deployment-url` output variable to get the URL of the deployment. For example, if you want to print the deployment URL after deploying your application, you can do the following:

```yaml
- name: Deploy
  id: deploy
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: pages deploy --project-name=example

- name: print deployment-url
  env:
    DEPLOYMENT_URL: ${{ steps.deploy.outputs.deployment-url }}
  run: echo $DEPLOYMENT_URL
```

The resulting output will look something like this:

```text
https://<your_pages_site>.pages.dev
```

Pages deployments will also provide their alias URL (since Wrangler v3.78.0). You can use the `pages-deployment-alias-url` output variable to get the URL of the deployment alias. This is useful for, for example, branch aliases for preview deployments.

If the sample action above was used to deploy a branch other than main, you could use the following to get the branch URL:

```yaml
- name: print pages-deployment-alias-url
  env:
    DEPLOYMENT_ALIAS_URL: ${{ steps.deploy.outputs.pages-deployment-alias-url }}
  run: echo $DEPLOYMENT_ALIAS_URL
```

Resulting in:

```text
https://new-feature.<your_pages_site>.pages.dev
```

### Using a different package manager

By default, this action will detect which package manager to use, based on the presence of a `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`, or `bun.lockb`/`bun.lock` file.

If you need to use a specific package manager for your application, you can set the `packageManager` input to `npm`, `yarn`, `pnpm`, or `bun`. You don't need to set this option unless you want to override the default behavior.

```yaml
jobs:
  deploy:
    steps:
      uses: cloudflare/wrangler-action@v3
      with:
        apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        packageManager: pnpm
```

## Troubleshooting

### "I just started using Workers/Wrangler and I don't know what this is!"

Refer to the [Quick Start guide](https://developers.cloudflare.com/workers/quickstart) to get started. Once you have a Workers application, you may want to set it up to automatically deploy from GitHub whenever you change your project.

### "[ERROR] No account id found, quitting.."

You will need to add `account_id = ""` in your `wrangler.toml` file or set `accountId` in this GitHub Action.

```yaml
on: [push]

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v4
      - name: Deploy app
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```
