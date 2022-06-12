#!/usr/bin/env node
import * as fs from 'node:fs'
import { access, readFile, symlink, unlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import commandLineCommands from 'command-line-commands'
import commandLineArgs from 'command-line-args'
import commandLineUsage from 'command-line-usage'
import c from 'picocolors'
import { build } from 'vite'

const pkgJson = new URL('../package.json', import.meta.url).pathname
const pkg = JSON.parse(await readFile(pkgJson, 'utf8'))

/** @type {commandLineUsage.Section[]} */
const sections = [
  {
    header: 'TinySvelte',
    content: 'Generates a tiny Svelte app.',
  },
  {
    header: 'Options',
    optionList: [
      {
        name: 'version',
        alias: 'v',
        description: 'Get the installed version.',
      },
      {
        name: 'help',
        alias: 'h',
        description: 'Print this usage guide.',
      },
    ],
  },
]

const commands = new Map([
  [
    null,
    {
      handler: function (argv) {
        const usage = commandLineUsage(sections)
        const optionDefinitions = [
          { name: 'help', alias: 'h', type: Boolean },
          { name: 'version', alias: 'v', type: Boolean },
          {
            name: 'app',
            type: String,
            multiple: false,
            defaultOption: true,
            defaultValue: 'App.svelte',
          },
        ]
        const options = commandLineArgs(optionDefinitions, { argv })

        if (options.version) {
          console.log(pkg.version)
          process.exit(0)
        }

        if (options.help) {
          console.log(usage)
          process.exit(0)
        }

        console.log(usage)
      },
    },
  ],
  [
    'help',
    {
      handler: function (args) {
        const usage = commandLineUsage(sections)
        console.log(usage)
      },
    },
  ],
  [
    'version',
    {
      handler: function (args) {
        console.log(pkg.version)
      },
    },
  ],
])

/** @type {commandLineArgs.OptionDefinition[]} */
const optionDefinitions = [
  { name: 'help', alias: 'h', type: Boolean },
  { name: 'version', alias: 'v', type: Boolean },
  {
    name: 'app',
    type: String,
    multiple: false,
    defaultOption: true,
    defaultValue: 'App.svelte',
  },
  { name: 'out', alias: 'o', type: String, defaultValue: 'build' },
]
const options = commandLineArgs(optionDefinitions)
if (options.app && `${options.app}`.endsWith('.svelte')) {
  const project = resolve('.')
  const app = join(project, options.app)
  const out = join(project, options.out)

  try {
    await access(app, fs.constants.F_OK)
  } catch (error) {
    console.error(c.red(`${app} does not exist.`))
    process.exit(1)
  }

  console.log(`Building ${app} to ${out}`)
  const target = new URL('../src/App.svelte', import.meta.url).pathname

  await symlink(app, target)
  try {
    await build({
      configFile: new URL('../vite.config.ts', import.meta.url).pathname,
      build: {
        outDir: out,
      },
    })
  } catch (error) {
    console.error(c.red(error))
    throw new Error(`${error.message}`)
  } finally {
    await unlink(target)
  }

  process.exit(0)
}

// if app option is not specified, proceed with commands
const { command, argv } = commandLineCommands(Array.from(commands.keys()))
// execute command
commands.get(command).handler(argv)
