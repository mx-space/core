export {}

const relayURL = process.env.PUSH_RELAY_VERIFY_URL ?? 'http://127.0.0.1:8787'
const coreURL = process.env.MX_CORE_VERIFY_URL ?? 'http://127.0.0.1:2333/api/v3'
const ownerToken = process.env.MX_CORE_VERIFY_OWNER_TOKEN
if (!ownerToken) throw new Error('MX_CORE_VERIFY_OWNER_TOKEN is required')

const json = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`${response.status} ${await response.text()}`)
  }
  return response.json() as Promise<T>
}

const installation = await json<{
  installation_id: string
  installation_secret: string
}>(
  await fetch(`${relayURL}/v1/installations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      app_id: 'space',
      apns_environment: 'development',
      apns_token: 'cd'.repeat(32),
    }),
  }),
)
const ticket = await json<{ ticket: string }>(
  await fetch(`${relayURL}/v1/source-activations`, {
    method: 'POST',
    headers: {
      authorization: `Installation ${installation.installation_id}.${installation.installation_secret}`,
    },
  }),
)

const coreHeaders = {
  authorization: `Bearer ${ownerToken}`,
  'content-type': 'application/json',
}
const activation = await json<{
  data: { enabled: true; relay_url: string; binding_id: string }
}>(
  await fetch(`${coreURL}/notifications/push/activate`, {
    method: 'POST',
    headers: coreHeaders,
    body: JSON.stringify({
      relayUrl: relayURL,
      activationTicket: ticket.ticket,
    }),
  }),
)
const status = await json<{
  data: { enabled: boolean; binding_id: string | null }
}>(
  await fetch(`${coreURL}/notifications/push/status`, {
    headers: { authorization: coreHeaders.authorization },
  }),
)
const deactivation = await fetch(
  `${coreURL}/notifications/push/${activation.data.binding_id}`,
  { method: 'DELETE', headers: { authorization: coreHeaders.authorization } },
)
if (deactivation.status !== 204) {
  throw new Error(`${deactivation.status} ${await deactivation.text()}`)
}

console.log(
  JSON.stringify({
    activationEnabled: activation.data.enabled,
    relayOrigin: new URL(activation.data.relay_url).origin,
    statusEnabled: status.data.enabled,
    bindingMatched: status.data.binding_id === activation.data.binding_id,
    deactivationStatus: deactivation.status,
  }),
)
