#!/usr/bin/env node
import * as fs from 'node:fs'
import { access, readFile, writeFile, symlink, unlink } from 'node:fs/promises'
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
  { name: 'watch', alias: 'w', type: Boolean },
]
const options = commandLineArgs(optionDefinitions)
if (options.app && `${options.app}`.endsWith('.svelte')) {
  // commands must be run from the project root for this CLI to work properly
  const project = resolve('.')
  const app = join(project, options.app)
  const out = join(project, options.out)

  // read both package.json files (sviny + app)
  const pkgPath = new URL('../package.json', import.meta.url).pathname
  const pkg = JSON.parse(await readFile(pkgPath, 'utf-8'))
  const appPkg = JSON.parse(
    await readFile(join(project, 'package.json')),
    'utf-8'
  )

  try {
    await access(app, fs.constants.F_OK)
  } catch (error) {
    console.error(c.red(`${app} does not exist.`))
    process.exit(1)
  }

  // merge dependencies for tiny app
  await writeFile(
    pkgPath,
    JSON.stringify({
      ...pkg,
      dependencies: {
        ...pkg.dependencies,
        ...appPkg.dependencies,
      },
      devDependencies: {
        ...pkg.devDependencies,
        ...appPkg.devDependencies,
      },
    }),
    'utf-8'
  )

  // target for symlink
  const target = new URL('../src/App.svelte', import.meta.url).pathname

  // symlink user's App.svelte to our Vite app src/App.svelte
  await symlink(app, target)
  try {
    await build({
      configFile: new URL('../vite.config.ts', import.meta.url).pathname,
      build: {
        outDir: out,
        watch: options.watch && {
          include: [app],
        },
      },
    })
  } catch (error) {
    console.error(c.red(error))
    // TODO: properly handle errors.
    throw new Error(`${error.message}`)
  } finally {
    // remove App.svelte symlink
    await unlink(target)
    // restore package.json to its former glory
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
  }

  process.exit(0)
}

// if app option is not specified, proceed with commands
const { command, argv } = commandLineCommands(Array.from(commands.keys()))
// execute command
commands.get(command).handler(argv)
