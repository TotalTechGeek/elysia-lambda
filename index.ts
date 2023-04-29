import { Elysia } from 'elysia'

let current: Elysia | null = null
export const lambda = (/* Potential Configuration Here */) => (app: Elysia) => {
  return app
}

/**
 * @private
 * @hidden
 */
export const hijack = () => (app: Elysia) => {
    app.listen = () => {
        // @ts-ignore
        app.server = {
            ...app.server,
            hostname: 'lambda',
            port: -1,
        }
        return app 
    }
    current = app
    return app
}

export function instance(): Elysia { 
  if (!current) throw new Error('Elysia instance not found')
  return current
}