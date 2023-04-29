#!/usr/bin/env node
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import AdmZip from 'adm-zip'

// Only packages not compatible with Bun directly
import * as AWS from '@aws-sdk/client-lambda'
import superagent from 'superagent'
import { Option, program } from 'commander'
import inquirer from 'inquirer'
import chalk from 'chalk'
import { parse, stringify } from 'yaml'
import logSymbols from './logSymbols.mjs'

program
    .option('--init', 'Begin the setup to deploy to Lambda.')
    .option('--deploy <src>', 'Deploy to AWS')
    .option('--build <src>', 'Build for AWS')
    .option('-o, --out <dest>', 'Where to output the build zip.')
    .option('-r, --region <region>', 'AWS region to deploy to.')
    .option('--role <role>', 'AWS role to attach to the lambda.')
    .option('--name <name>', 'Name of the lambda.')
    .option('--layers <layers...>', 'AWS layers to attach to the lambda.')
    .option('-c , --config <config>', 'Path to a yaml/json config file.')
    .option('--description <desc>', 'Description of the lambda.')
    .option('--memory <MiB>', 'Memory to allocate to the lambda, in MiB.', '128')
    .addOption(new Option('--arch <architecture>', 'AWS architecture to deploy to.',).choices(['arm64', 'x86_64']))
    
program.parse(process.argv)

const options = program.opts()

if (options.init) {
    console.log(chalk.blue('Welcome to the Elysia Lambda Deployer!'))
    console.log(chalk.blue('This will walk you through the setup to deploy to AWS Lambda.'))

    let layer = ''

     // Ask for the region
     const { region } = await inquirer.prompt({
        type: 'input',
        name: 'region',
        message: 'What region do you want to deploy to?',
        default: 'us-east-1'
    })

    // Ask for the architecture
    const { architecture } = await inquirer.prompt({
        type: 'list',
        name: 'architecture',
        message: 'What architecture do you want to deploy to?',
        choices: ['arm64', 'x64'],
        default: 'x64'
    })

    // Yes / No; have you created the bun layer yet?
    const { bunLayer } = await inquirer.prompt({
        type: 'confirm',
        name: 'bunLayer',
        message: 'Have you created the Bun layer yet?',
        default: false
    })

    if (!bunLayer) {
        console.log(chalk.blue('Ok! We will create that layer together.'))

         // Ask for which version of Bun to use, set a User-Agent header
        const { body } = await superagent.get('https://api.github.com/repos/oven-sh/bun/tags')
        .set('User-Agent', 'elysia-lambda-deployer')
        const versions = body.map(tag => tag.name).filter(i => i.startsWith('bun-v')).map(i => i.substring(5))

        // order the versions
        // this is copilot code
        versions.sort((a, b) => {
            const aParts = a.split('.')
            const bParts = b.split('.')
            for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                if (aParts[i] === undefined) return -1
                if (bParts[i] === undefined) return 1
                if (parseInt(aParts[i]) > parseInt(bParts[i])) return -1
                if (parseInt(aParts[i]) < parseInt(bParts[i])) return 1
            }
            return 0
        })
        
        const { bunVersion } = await inquirer.prompt({
            type: 'list',
            name: 'bunVersion',
            message: 'What version of Bun do you want to use?',
            choices: ['latest', 'canary', ...versions],
            default: 'latest'
        })
    
        execSync('git clone https://github.com/oven-sh/bun')
        
        const output = execSync(`cd bun/packages/bun-lambda && bun install && bun run publish-layer --arch ${architecture === 'x86_64' ? 'x64' : 'aarch64'} --region ${region} --release ${bunVersion}`)
        
        // use a regex to get the arn of the layer, starts with "arn:aws:lambda:" all the way to the next whitespace character
        layer = output.toString().replace(/\r?\n/g, ' ').match(/arn:aws:lambda:[^\s]+/)[0]

        console.log(chalk.blue(`Created the layer with ARN ${layer}`))
        
        // delete the bun folder
        fs.rm('bun', { recursive: true }, () => {})
    }
    else {
        // Ask for the ARN of the layer
        layer = (await inquirer.prompt({
            type: 'input',
            name: 'layerArn',
            message: 'What is the ARN of the Bun layer?',
        })).layerArn
    }

    // Ask for the ARN of the role
    const { roleArn } = await inquirer.prompt({
        type: 'input',
        name: 'roleArn',
        message: 'What is the ARN of the role you want to use?',
    })

   

    // Ask for the name
    const { name } = await inquirer.prompt({
        type: 'input',
        name: 'name',
        message: 'What do you want to name the lambda?',
        default: 'elysia-lambda'
    })

    // Ask for the memory
    const { memory } = await inquirer.prompt({
        type: 'input',
        name: 'memory',
        message: 'How much memory do you want to allocate to the lambda, in MiB?',
        default: '128'
    })

    // Ask for the description
    const { description } = await inquirer.prompt({
        type: 'input',
        name: 'description',
        message: 'What do you want the description to be?',
        default: 'Elysia Lambda'
    })

    // Ask for the entry point
    const { entry } = await inquirer.prompt({
        type: 'input',
        name: 'entry',
        message: 'What is the entry point?',
        default: 'index.js'
    })

    // Ask to name the yaml file
    const { yamlName } = await inquirer.prompt({
        type: 'input',
        name: 'yamlName',
        message: 'What do you want to name the yaml file?',
        default: 'elysia-lambda.yaml'
    })

    // Output the configuration
    fs.writeFileSync(
        yamlName,
        stringify({
            deploy: entry,
            name,
            region,
            memory,
            arch: architecture,
            description,
            role: roleArn,
            layers: [layer]
        })
    )


    try {
        const pkg = JSON.parse(fs.readFileSync('package.json'))

        // if there is a "deploy" script in the package,
        if (!pkg.scripts.deploy) {
            // ask if they want to add a deploy script
            const { addDeployScript } = await inquirer.prompt({
                type: 'confirm',
                name: 'addDeployScript',
                message: 'Do you want to add a deploy script to your package.json?',
                default: true
            })
            if (addDeployScript) {
                pkg.scripts.deploy = `elysia-lambda --config ${yamlName}`
                fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2))
            }
            else {
                console.log(logSymbols.success, chalk.green(`Run: elysia-lambda --config ${yamlName}`))
            }
        }
    }
    catch (err) {
        console.log(logSymbols.success, chalk.green(`Run: elysia-lambda --config ${yamlName}`))
    }

    process.exit(0)
}


if (options.config) Object.assign(options, parse(fs.readFileSync(path.resolve(process.cwd(), options.config), 'utf8')))

if (!options.deploy && !options.build) {
    console.error(chalk.red('No command specified. Use --deploy or --build.'))
    process.exit(1)
}

if (options.deploy && options.build) {
    console.error(chalk.red('Cannot use --deploy and --build together.'))
    process.exit(1)
}

if (options.build && !options.out) {
    console.error(chalk.red('Must specify --out when using --build.'))
    process.exit(1)
}

if (options.deploy) {
    let err = ''
    if (!options.role) err += '- Must specify --role for the lambda when using --deploy.\n'
    if (!options.name) err += '- Must specify --name for the lambda when using --deploy.\n'
    if (!options.region) err += '- Must specify --region for the lambda when using --deploy.\n'
    if (options.layer) options.layers = options.layer
    if (!options.layers) err += '- Must specify at least one layer for the lambda with --layers when using --deploy.\n'
    if (typeof options.layers === 'string') options.layers = [options.layers]
    if (!options.arch) err += '- Must specify --arch for the lambda when using --deploy.\n'
    if (options.arch === 'x64') options.arch = 'x86_64' // minor correction from previous configs.
    if (err) {
        console.error(chalk.red(`Some deployment issues were encountered:\n${err}`))
        process.exit(1)
    }
}



const file = path.resolve(process.cwd(), options.build || options.deploy)
const now = new Date().getTime()
const mutatedFile = path.resolve(process.cwd(), options.build || options.deploy, '../', now + '.ts')

fs.writeFileSync(mutatedFile, fs.readFileSync(file, 'utf8').replace(/([, (])lambda([,() ])/g, i => i[0] + 'hijack' + i[i.length - 1]))

const script = `
import { instance } from 'elysia-lambda'
import '${mutatedFile}' // the entry point import
export default {
  js: instance().innerHandle
}`


const out = path.resolve(process.cwd(), now + '.js')
fs.writeFileSync(out, script)


const bundleFile = path.resolve(process.cwd(), 'bundle.' + now + '.js')
execSync(`bun build ${out} --platform=bun --minify --outfile=${bundleFile} --external @elysiajs/fn`)

fs.unlinkSync(out)
fs.unlinkSync(mutatedFile)

const zip = new AdmZip()
zip.addLocalFile(bundleFile, '', 'index.js')
fs.unlinkSync(bundleFile)

/**
 * Performs the deployment to AWS.
 */
async function deploy () {
    zip.writeZip(`bundle.${now}.zip`)

    const lambda = new AWS.Lambda({ region: 'us-east-1' })

    // check if lambda exists
    const exists = await lambda.getFunction({
        FunctionName: options.name
    }).catch(() => false)

    if (!exists) {
        console.log(chalk.magenta(`Deploying "${options.name}"!`))
        await lambda.createFunction({
            FunctionName: options.name,
            Runtime: 'provided.al2',
            Handler: 'index.js',
            Layers: options.layers,
            Description: options.description || 'Elysia Lambda',
            Code: {
                ZipFile: fs.readFileSync(`bundle.${now}.zip`)
            },
            Role: options.role,
            Architectures: [options.arch],
            ...(options.environment && {
                Environment: {
                    Variables: options.environment
                }
            }),
            MemorySize: +options.memory || 128,
        })
        console.log(logSymbols.success, chalk.green('Deployed!'))
    }
    else {
        console.log(chalk.magenta(`Lambda "${options.name}" found. Updating.`))
        await lambda.updateFunctionCode({
            FunctionName: options.name,
            ZipFile: fs.readFileSync(`bundle.${now}.zip`),
        })
        await lambda.updateFunctionConfiguration({
            FunctionName: options.name,
            Layers: options.layers,
            Description: options.description || 'Elysia Lambda',
            Role: options.role,
            Architectures: [options.arch],
            Handler: 'index.js',
            ...(options.environment && {
                Environment: {
                    Variables: options.environment
                }
            }),
            MemorySize: +options.memory || 128,
        })
        console.log(logSymbols.success, chalk.green('Updated!'))
    }

    fs.unlinkSync(`bundle.${now}.zip`)
}

if (options.deploy) await deploy()
if (options.build) {
    zip.writeZip(options.out)
    console.log(logSymbols.success, chalk.green('Zip for Lambda built!'))
}


