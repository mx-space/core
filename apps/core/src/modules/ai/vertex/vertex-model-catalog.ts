import type { ModelInfo } from '../runtime'

const VERTEX_TTS_VOICES = [
  'Achernar',
  'Achird',
  'Algenib',
  'Algieba',
  'Alnilam',
  'Aoede',
  'Autonoe',
  'Callirrhoe',
  'Charon',
  'Despina',
  'Enceladus',
  'Erinome',
  'Fenrir',
  'Gacrux',
  'Iapetus',
  'Kore',
  'Laomedeia',
  'Leda',
  'Orus',
  'Puck',
  'Pulcherrima',
  'Rasalgethi',
  'Sadachbia',
  'Sadaltager',
  'Schedar',
  'Sulafat',
  'Umbriel',
  'Vindemiatrix',
  'Zephyr',
  'Zubenelgenubi',
]

const VERTEX_IMAGE_MODELS: ModelInfo[] = [
  { id: 'gemini-2.5-flash-image', name: 'Gemini 2.5 Flash Image' },
]

const VERTEX_SPEECH_MODELS: ModelInfo[] = [
  'gemini-3.1-flash-tts-preview',
  'gemini-2.5-flash-tts',
  'gemini-2.5-flash-lite-preview-tts',
  'gemini-2.5-pro-tts',
].map((id) => ({ id, name: id, supportedVoices: VERTEX_TTS_VOICES }))

export function getVertexMediaModels(
  capability: 'image' | 'speech',
): ModelInfo[] {
  return capability === 'image' ? VERTEX_IMAGE_MODELS : VERTEX_SPEECH_MODELS
}
