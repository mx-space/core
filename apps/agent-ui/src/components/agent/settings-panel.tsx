import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { toast } from '@/hooks/use-toast'
import { useAgentStore } from '@/lib/agent-store'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AIAgentRuntimeConfig, AIProviderConfig } from '@/types/agent'
import { AIProviderType } from '@/types/agent'
import { Eye, EyeOff, Loader2, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ProviderIcon } from './provider-icons'

interface ProviderFormState {
  id: string
  name: string
  type: AIProviderType
  apiKey: string
  endpoint: string
  defaultModel: string
  enabled: boolean
}

function toFormState(p: AIProviderConfig): ProviderFormState {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    apiKey: p.api_key,
    endpoint: p.endpoint || '',
    defaultModel: p.default_model,
    enabled: p.enabled,
  }
}

function ProviderDetail({
  provider,
  onChange,
  onRemove,
}: {
  provider: ProviderFormState
  onChange: (p: ProviderFormState) => void
  onRemove: () => void
}) {
  const [showKey, setShowKey] = useState(false)

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-secondary">
            <ProviderIcon
              provider={provider.type}
              className="size-4 text-foreground"
            />
          </div>
          <span className="text-sm font-medium text-foreground">
            {provider.name || 'New Provider'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Name
            </label>
            <Input
              value={provider.name}
              onChange={(e) => onChange({ ...provider, name: e.target.value })}
              className="h-8 bg-secondary border-border text-sm"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Type
            </label>
            <div className="flex gap-2 flex-wrap">
              {Object.values(AIProviderType).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange({ ...provider, type: t })}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors',
                    provider.type === t
                      ? 'border-foreground/30 bg-secondary text-foreground'
                      : 'border-border text-muted-foreground hover:bg-secondary/50',
                  )}
                >
                  <ProviderIcon provider={t} className="size-3" />
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              API Key
            </label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={provider.apiKey}
                onChange={(e) =>
                  onChange({ ...provider, apiKey: e.target.value })
                }
                placeholder="sk-..."
                className="h-8 bg-secondary border-border pr-9 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Endpoint
            </label>
            <Input
              value={provider.endpoint}
              onChange={(e) =>
                onChange({ ...provider, endpoint: e.target.value })
              }
              placeholder="https://api.example.com/v1"
              className="h-8 bg-secondary border-border font-mono text-xs"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Default Model
            </label>
            <Input
              value={provider.defaultModel}
              onChange={(e) =>
                onChange({ ...provider, defaultModel: e.target.value })
              }
              placeholder="gpt-4o"
              className="h-8 bg-secondary border-border font-mono text-xs"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              Enabled
            </label>
            <Switch
              checked={provider.enabled}
              onCheckedChange={(v) => onChange({ ...provider, enabled: v })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

export function SettingsPanel() {
  const store = useAgentStore()
  const [providers, setProviders] = useState<ProviderFormState[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [agentProviderId, setAgentProviderId] = useState('')
  const [agentModel, setAgentModel] = useState('')
  const [enabledTools, setEnabledTools] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!store.settingsOpen) {
      setLoaded(false)
      return
    }

    api
      .getConfig()
      .then((config: AIAgentRuntimeConfig) => {
        setProviders(config.providers.map(toFormState))
        setAgentProviderId(config.agent_model?.provider_id || '')
        setAgentModel(config.agent_model?.model || '')
        setEnabledTools(config.enabled_tools || [])
        setSelectedIdx(0)
        setLoaded(true)
      })
      .catch(() => {
        setLoaded(true)
      })
  }, [store.settingsOpen])

  const addProvider = () => {
    const id = `provider-${Date.now().toString(36)}`
    const newP: ProviderFormState = {
      id,
      name: '',
      type: AIProviderType.OpenAI,
      apiKey: '',
      endpoint: '',
      defaultModel: '',
      enabled: true,
    }
    setProviders([...providers, newP])
    setSelectedIdx(providers.length)
  }

  const removeProvider = (idx: number) => {
    const next = providers.filter((_, i) => i !== idx)
    setProviders(next)
    setSelectedIdx(Math.min(selectedIdx, Math.max(0, next.length - 1)))
  }

  const updateProvider = (idx: number, p: ProviderFormState) => {
    setProviders(providers.map((pr, i) => (i === idx ? p : pr)))
  }

  const toggleTool = (tool: string) => {
    setEnabledTools(
      enabledTools.includes(tool)
        ? enabledTools.filter((t) => t !== tool)
        : [...enabledTools, tool],
    )
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await store.saveConfig({
        providers: providers.map((p) => ({
          id: p.id,
          name: p.name,
          type: p.type,
          apiKey: p.apiKey,
          endpoint: p.endpoint || undefined,
          defaultModel: p.defaultModel,
          enabled: p.enabled,
        })),
        agentModel: agentProviderId
          ? { providerId: agentProviderId, model: agentModel || undefined }
          : undefined,
        enabledTools,
      })
      toast({ title: 'Settings saved' })
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={store.settingsOpen} onOpenChange={store.setSettingsOpen}>
      <DialogContent className="max-w-3xl h-[80vh] p-0 gap-0 bg-background border-border overflow-hidden">
        <div className="sr-only">
          <DialogHeader>
            <DialogTitle>Agent Settings</DialogTitle>
            <DialogDescription>
              Configure AI providers and agent tools.
            </DialogDescription>
          </DialogHeader>
        </div>

        {!loaded ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex h-full flex-col">
            <div className="flex flex-1 min-h-0">
              {/* Left: Provider list */}
              <div className="flex w-56 shrink-0 flex-col border-r border-border">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                    Providers
                  </span>
                  <button
                    type="button"
                    onClick={addProvider}
                    className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto p-2">
                  <div className="flex flex-col gap-0.5">
                    {providers.map((provider, idx) => (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => setSelectedIdx(idx)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                          selectedIdx === idx
                            ? 'bg-secondary text-foreground'
                            : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
                        )}
                      >
                        <div className="flex size-6 shrink-0 items-center justify-center rounded bg-secondary/80">
                          <ProviderIcon
                            provider={provider.type}
                            className="size-3.5"
                          />
                        </div>
                        <p className="text-sm truncate leading-tight">
                          {provider.name || 'Untitled'}
                        </p>
                      </button>
                    ))}
                  </div>
                </nav>

                {/* Agent model + tools */}
                <div className="border-t border-border p-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground uppercase">
                      Agent Model
                    </label>
                    <Input
                      value={agentProviderId}
                      onChange={(e) => setAgentProviderId(e.target.value)}
                      placeholder="Provider ID"
                      className="h-7 bg-secondary border-border text-xs mb-1"
                    />
                    <Input
                      value={agentModel}
                      onChange={(e) => setAgentModel(e.target.value)}
                      placeholder="Model name"
                      className="h-7 bg-secondary border-border text-xs"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-medium text-muted-foreground uppercase">
                      Tools
                    </label>
                    <div className="flex flex-col gap-1">
                      {['mongodb', 'shell'].map((tool) => (
                        <label
                          key={tool}
                          className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={enabledTools.includes(tool)}
                            onChange={() => toggleTool(tool)}
                            className="rounded border-border"
                          />
                          {tool}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Provider detail */}
              {providers[selectedIdx] ? (
                <ProviderDetail
                  provider={providers[selectedIdx]}
                  onChange={(p) => updateProvider(selectedIdx, p)}
                  onRemove={() => removeProvider(selectedIdx)}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
                  Add a provider to get started
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => store.setSettingsOpen(false)}
                className="text-sm"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="text-sm"
              >
                {saving ? (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                ) : (
                  <Save className="mr-1.5 size-3" />
                )}
                Save
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
