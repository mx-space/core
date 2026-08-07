import { COMMENT_CREATED_EVENT, signPushRequest } from '@mx-space/push-protocol'

const relayURL = process.env.PUSH_RELAY_VERIFY_URL ?? 'http://127.0.0.1:8787'

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
      apns_token: 'ab'.repeat(32),
    }),
  }),
)

const installationAuthorization = `Installation ${installation.installation_id}.${installation.installation_secret}`
const activation = await json<{ ticket: string }>(
  await fetch(`${relayURL}/v1/source-activations`, {
    method: 'POST',
    headers: { authorization: installationAuthorization },
  }),
)
const claim = await json<{
  source_id: string
  source_secret: string
  binding_id: string
  event_endpoint: string
}>(
  await fetch(`${relayURL}/v1/source-activations/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ticket: activation.ticket,
      source_origin: 'http://127.0.0.1:52333',
      source_label: 'local verification',
    }),
  }),
)

const event = {
  specversion: '1.0',
  id: 'comment.created:local-verification',
  source: `urn:mx-core:instance:${claim.source_id}`,
  type: COMMENT_CREATED_EVENT,
  subject: 'comment/local-verification',
  time: new Date().toISOString(),
  datacontenttype: 'application/json',
  data: {
    resource_id: 'local-verification',
    resource_type: 'comment',
  },
} as const
const body = JSON.stringify(event)

const deliver = async (deliveryID: string) => {
  const timestamp = String(Date.now())
  return json<{ accepted: true; event_id: string; deliveries: number }>(
    await fetch(claim.event_endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/cloudevents+json',
        'x-push-source': claim.source_id,
        'x-push-delivery': deliveryID,
        'x-push-timestamp': timestamp,
        'x-push-signature': signPushRequest({
          secret: claim.source_secret,
          timestamp,
          deliveryId: deliveryID,
          rawBody: body,
        }),
      },
      body,
    }),
  )
}

const first = await deliver('dlv_local_1')
const duplicate = await deliver('dlv_local_2')

console.log(
  JSON.stringify({
    relay: relayURL,
    sourceCreated: claim.source_id.startsWith('src_'),
    bindingCreated: claim.binding_id.startsWith('bnd_'),
    eventID: first.event_id,
    firstDeliveries: first.deliveries,
    duplicateDeliveries: duplicate.deliveries,
  }),
)
