import { trace } from '@opentelemetry/api'
import { instrument, ResolveConfigFn } from '@microlabs/otel-cf-workers'

export interface Env {
	HONEYCOMB_API_KEY: string
	OTELTEST: Queue<any>
}

const handler = {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const fetchCount = 100
		const promises: Promise<any>[] = []
		for (let i = 0; i < fetchCount; i++) {
			const fn = async () => {
				// All 100 of these show up in the fetch trace
				await env.OTELTEST.send({ i })
			}
			promises.push(fn())
		}

		await Promise.all(promises)

		return new Response(`hello world!`)
	},

	async queue(
		batch: MessageBatch<any>,
		env: Env,
		ctx: ExecutionContext
	) {
		const uuids: string[] = []
		for (let i = 0; i < batch.messages.length; i++) {
			const promises: Promise<any>[] = []
			const fn = async () => {
				// Not all of these spans show up in honeycomb :(
				// Also tried enclosing this in another span, but that didn't help
				const res = await fetch('https://uuid.rocks/plain')
				const uuid = await res.text()
				uuids.push(uuid)
			}

			promises.push(fn())
			await Promise.all(promises)
		}
		// This prints out 100 uuids
		console.log(uuids)
		console.log('uuids.length', uuids.length)
	},
}

const config: ResolveConfigFn = (env: Env, _trigger) => {
	return {
		exporter: {
			url: 'https://api.honeycomb.io/v1/traces',
			headers: { 'x-honeycomb-team': env.HONEYCOMB_API_KEY },
		},
		service: { name: 'otel-test', namespace: 'test' },
		fetch: {
			includeTraceContext: false,
		},
	}
}

export default instrument(handler, config)
