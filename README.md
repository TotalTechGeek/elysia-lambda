# elysia-lambda

This plugin for Elysia attempts to make it easier to deploy your Elysia project to AWS Lambda.

## Installation

```bash
bun install elysia-lambda
```

In your application, you will add the following to your code:

```typescript
import { Elysia } from 'elysia'
import { lambda } from 'elysia-lambda'

const app = new Elysia()
    .use(lambda())
```

This is all you need to do to install the plugin into your codebase.

## Usage

We strongly recommend running the init command,

```bash
bunx elysia-lambda --init
```

This will guide you through the process of setting up your project for deployment to AWS Lambda, and setting up the official Bun layer.

This application expects that you are configured with sufficient AWS CLI Permissions.

After the init command has been performed, you will have a yaml file for your lambda deployment and a `deploy` script added to your `package.json`.


The configuration file will look like the following:

```yaml
deploy: src/index.ts
name: ElysiaLambda
region: us-east-1
arch: arm64
description: An Elysia Lambda app.
role: arn:aws:iam::672112969134:role/TestLambda
layers:
  - arn:aws:lambda:us-east-1:672112969134:layer:bun:8
environment: 
  SomeEnvVariable: SomeValue
memory: 256
```

Alternatively, it is possible to run the tool exclusively from the CLI:

```txt
Usage: elysia-lambda [options]

Options:
  --init                  Begin the setup to deploy to Lambda.
  --deploy <src>          Deploy to AWS
  --build <src>           Build for AWS
  -o, --out <dest>        Where to output the build zip.
  -r, --region <region>   AWS region to deploy to.
  --role <role>           AWS role to attach to the lambda.
  --name <name>           Name of the lambda.
  --layers <layers...>    AWS layers to attach to the lambda.
  -c , --config <config>  Path to a yaml/json config file.
  --description <desc>    Description of the lambda.
  --memory <MiB>          Memory to allocate to the lambda, in MiB. (default: "128")
  --arch <architecture>   AWS architecture to deploy to. (choices: "arm64", "x64")
  -h, --help              display help for command
  ```

After adding a deploy script to your `package.json`, you can run the following command to deploy your application:

```bash
bun run deploy
```

This will build your application and deploy it to AWS Lambda.

### Notes 

This plugin only works with the `0.6.0` Canary Bundler. 

I may add support for ESBuild & the Elysia Node.js Polyfills in the future.