import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { applyMigrations } from '@platformatic/db/lib/migrate.mjs'
import { buildServer } from '@platformatic/db'
import { setTimeout } from 'timers/promises'
import { readFileSync } from 'fs'

const opt = JSON.parse(readFileSync('./platformatic.db.json').toString())

opt.rewriteUrl = function (req) {
  return req.url.replace('/api', '')
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    platformatic({
      configuration: './platformatic.db.json',
      delay: 2000,
    })
  ],
})

function platformatic ({
  configuration, delay
}) {
  return {
    name: "vite-plugin-platformatic",
    async configureServer(devServer) {
      const superRestart = devServer.restart

      const server = await buildServer(configuration)

      devServer.restart = function () {
        const a = arguments
        server.app.log.info('restart')
        server.stop()
          .then(() => {
            superRestart.apply(this, a)
          }, e => {
            console.log('Cannot restart the server', e)
          })
        
      }

      await applyMigrations([])

      await server.listen()

      devServer.middlewares.use(
        '/api',
        async function(req, res) {
          await setTimeout(delay)

          console.log(req.method, req.url, req)
          const response = await server.inject({
            method: req.method,
            url: req.url,
            payload: req,
            headers : {
              'Content-type': req.headers['content-type']
            }
          })

          res.statusCode = response.statusCode
          res.setHeader('Content-type', response.headers['content-type'])
          res.end(response.body)
        }
      )
    }
  }
}
