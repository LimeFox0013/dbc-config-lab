import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { siteOrigin } from './accounts'
import { AppModule } from './app.module'
import { DEFAULT_PORT, PORT_ENV, TRUSTED_PROXY_HOPS } from './constants'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  // Behind the platform's ingress: the caller's address is the one the proxy saw.
  app.set('trust proxy', TRUSTED_PROXY_HOPS)
  app.enableShutdownHooks()
  // `wallet-sign-in`: only the lab's own site calls with a session cookie.
  app.enableCors({ origin: siteOrigin(), credentials: true })
  const port = Number(process.env[PORT_ENV] ?? DEFAULT_PORT)
  await app.listen(port)
  Logger.log(`DBC Config Lab API on http://localhost:${port}`)
}

void bootstrap()
