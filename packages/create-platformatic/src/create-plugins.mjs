import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { isFileAccessible } from './utils.mjs'

const JS_PLUGIN_WITH_TYPES_SUPPORT = `\
/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.decorate('example', 'foobar')
}
`

const TS_PLUGIN_WITH_TYPES_SUPPORT = `\
/// <reference types="@platformatic/service" />
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.decorate('example', 'foobar')
}
`

const JS_ROUTES_WITH_TYPES_SUPPORT = `\
/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })
}
`

const TS_ROUTES_WITH_TYPES_SUPPORT = `\
/// <reference types="@platformatic/service" />
import { FastifyInstance, FastifyPluginOptions } from 'fastify'

declare module 'fastify' {
  interface FastifyInstance {
    example: string
  }
}

export default async function (fastify: FastifyInstance, opts: FastifyPluginOptions) {
  fastify.get('/example', async (request, reply) => {
    return { hello: fastify.example }
  })
}
`

function testHelperJS (mod) {
  return `\
'use strict'

const { join } = require('node:path')
const { readFile } = require('node:fs/promises')
const { buildServer } = require('@platformatic/${mod}')

async function getServer () {
  const config = JSON.parse(await readFile(join(__dirname, '..', 'platformatic.${mod}.json'), 'utf8'))
  config.server.logger.level = 'warn'
  config.watch = false
  return buildServer(config)
}

module.exports.getServer = getServer
`
}

const TEST_ROUTES_JS = `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getServer } = require('../helper')

test('example', async (t) => {
  const server = await getServer()
  t.after(() => server.close())
  const res = await server.inject({
    method: 'GET',
    url: '/example'
  })

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(res.json(), {
    hello: 'foobar'
  })
})
`

const TEST_PLUGIN_JS = `\
'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { getServer } = require('../helper')

test('example decorator', async (t) => {
  const server = await getServer()
  t.after(() => server.close())

  assert.strictEqual(server.example, 'foobar')
})
`

function testHelperTS(mod) {
    return `\
import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import { buildServer } from '@platformatic/${mod}'

export async function getServer () {
  // We go up two folder because this files executes in the dist folder
  const config = JSON.parse(await readFile(join(__dirname, '..', '..', 'platformatic.${mod}.json'), 'utf8'))
  config.server.logger.level = 'warn'
  config.watch = false
  return buildServer(config)
}
  `
}


const TEST_ROUTES_TS = `\
import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('root', async (t) => {
  const server = await getServer()
  t.after(() => server.close())
  const res = await server.inject({
    method: 'GET',
    url: '/example'
  })

  assert.strictEqual(res.statusCode, 200)
  assert.deepStrictEqual(res.json(), {
    hello: 'foobar'
  })
})
`

const TEST_PLUGIN_TS = `\
import test from 'node:test'
import assert from 'node:assert'
import { getServer } from '../helper'

test('example decorator', async (t) => {
  const server = await getServer()
  t.after(() => server.close())

  assert.strictEqual(server.example, 'foobar')
})
`

export async function generatePluginWithTypesSupport (logger, currentDir, isTypescript) {
  const accessible = await isFileAccessible('plugins', currentDir)
  if (accessible) {
    logger.info('Plugins folder "plugins" found, skipping creation of plugins folder.')
    return
  }
  await mkdir(join(currentDir, 'plugins'))
  const pluginTemplate = isTypescript
    ? TS_PLUGIN_WITH_TYPES_SUPPORT
    : JS_PLUGIN_WITH_TYPES_SUPPORT
  const pluginName = isTypescript
    ? 'example.ts'
    : 'example.js'
  await writeFile(join(currentDir, 'plugins', pluginName), pluginTemplate)
  logger.info('Plugins folder "plugins" successfully created.')
}

export async function generateRouteWithTypesSupport (logger, currentDir, isTypescript) {
  const accessible = await isFileAccessible('routes', currentDir)
  if (accessible) {
    logger.info('Routes folder "routes" found, skipping creation of routes folder.')
    return
  }
  await mkdir(join(currentDir, 'routes'))
  const routesTemplate = isTypescript
    ? TS_ROUTES_WITH_TYPES_SUPPORT
    : JS_ROUTES_WITH_TYPES_SUPPORT
  const routesName = isTypescript
    ? 'root.ts'
    : 'root.js'
  await writeFile(join(currentDir, 'routes', routesName), routesTemplate)
  logger.info('Routes folder "routes" successfully created.')
}

export async function generateTests (logger, currentDir, isTypescript, mod) {
  const accessible = await isFileAccessible('tests', currentDir)
  if (accessible) {
    logger.info('Test folder found, skipping creation of tests.')
    return
  }

  await mkdir(join(currentDir, 'test'))
  await mkdir(join(currentDir, 'test', 'plugins'))
  await mkdir(join(currentDir, 'test', 'routes'))

  if (isTypescript) {
    await writeFile(join(currentDir, 'test', 'helper.ts'), testHelperTS(mod))
    await writeFile(join(currentDir, 'test', 'plugins', 'example.test.ts'), TEST_PLUGIN_TS)
    await writeFile(join(currentDir, 'test', 'routes', 'root.test.ts'), TEST_ROUTES_TS)
  } else {
    await writeFile(join(currentDir, 'test', 'helper.js'), testHelperJS(mod))
    await writeFile(join(currentDir, 'test', 'plugins', 'example.test.js'), TEST_PLUGIN_JS)
    await writeFile(join(currentDir, 'test', 'routes', 'root.test.js'), TEST_ROUTES_JS)
  }

  logger.info('Test folder "tests" successfully created.')
}

export async function generatePlugins (logger, currentDir, isTypescript, mod) {
  await generatePluginWithTypesSupport(logger, currentDir, isTypescript)
  await generateRouteWithTypesSupport(logger, currentDir, isTypescript)
  await generateTests(logger, currentDir, isTypescript, mod)
}
