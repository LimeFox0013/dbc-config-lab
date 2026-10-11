import { BadRequestException } from '@nestjs/common'
import type { ArgumentsHost } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'
import { GENERIC_ERROR_MESSAGE } from './constants'
import { SanitizingExceptionFilter } from './sanitizing-exception.filter'

const hostFor = () => {
  const json = vi.fn()
  const status = vi.fn(() => ({ json }))
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as never as ArgumentsHost
  return { host, status, json }
}

describe('SanitizingExceptionFilter', () => {
  it('passes a deliberate HttpException message through', () => {
    const { host, status, json } = hostFor()
    new SanitizingExceptionFilter().catch(
      new BadRequestException('Bad input'),
      host,
    )
    expect(status).toHaveBeenCalledWith(400)
    expect(json).toHaveBeenCalledWith({ statusCode: 400, message: 'Bad input' })
  })

  it('replaces any other error with a generic message', () => {
    const { host, status, json } = hostFor()
    new SanitizingExceptionFilter().catch(
      new Error('insert into "daily_usage" values ($1) — params: addr:secret'),
      host,
    )
    expect(status).toHaveBeenCalledWith(500)
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: GENERIC_ERROR_MESSAGE,
    })
  })
})
