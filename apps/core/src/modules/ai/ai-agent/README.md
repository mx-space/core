# AI Agent API Documentation

## Overview
The AI Agent module provides a chat bot API that can answer questions about your blog content using AI. It supports both streaming and synchronous responses.

## Configuration
To enable the AI Agent, you need to configure the following in the admin panel:

1. Go to Settings > AI Settings
2. Set `openAiKey` - Your OpenAI API key
3. Set `openAiEndpoint` (optional) - Custom OpenAI endpoint if needed
4. Set `openAiPreferredModel` - Default: `gpt-4o-mini`
5. Enable `enableAIAgent` - Toggle to enable the AI Agent feature

## API Endpoints

### POST `/api/ai/agent/chat` (Streaming)
Chat with the AI agent about your blog content with streaming responses.

**Authentication**: Required (must be logged in)

**Request Body**:
```json
{
  "message": "What are your latest blog posts?",
  "context": [  // Optional conversation history
    {
      "role": "user",
      "content": "Previous question"
    },
    {
      "role": "assistant", 
      "content": "Previous answer"
    }
  ]
}
```

**Response**: Server-Sent Events (SSE) stream
```
data: {"type":"text","text":"Here are the latest blog posts"}
data: {"type":"text","text":"..."}
data: {"type":"finish","finishReason":"stop"}
```

### POST `/api/ai/agent/chat/sync` (Non-Streaming)
Chat with the AI agent synchronously (waits for complete response).

**Authentication**: Required

**Request Body**: Same as streaming endpoint

**Response**:
```json
{
  "message": "Here are the latest blog posts...",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### GET `/api/ai/agent/status`
Check if the AI Agent is enabled and configured.

**Authentication**: Required

**Response**:
```json
{
  "enabled": true,
  "service": "AI Agent Chat"
}
```

## Available Tools
The AI Agent has access to the following tools to query your blog data:

- **Posts**: Get posts by ID, list posts, get latest post, get posts by category/tag
- **Notes**: Get notes by ID, list notes, get latest notes
- **Categories**: Get category info, list all categories
- **Tags**: Get tag summary, get posts by tag
- **Pages**: Get page by ID, list all pages
- **Says**: Get all says, get random say
- **Recently**: Get recent activities
- **Comments**: Get comments, get comments by content

## Example Usage

### Streaming Chat (JavaScript/TypeScript)
```javascript
const response = await fetch('http://localhost:2333/api/ai/agent/chat', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'What blog posts do you have about TypeScript?'
  })
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  const text = decoder.decode(value)
  const lines = text.split('\n')
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6))
      if (data.type === 'text') {
        console.log(data.text)
      }
    }
  }
}
```

### Synchronous Chat
```bash
curl -X POST http://localhost:2333/api/ai/agent/chat/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What blog posts do you have about TypeScript?"
  }'
```

### Check AI Agent Status
```bash
curl -X GET http://localhost:2333/api/ai/agent/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Streaming Response Format
The streaming endpoint uses Server-Sent Events (SSE) format. Each message is prefixed with `data: ` and contains a JSON object:

- `{"type":"text","text":"..."}` - Partial text response
- `{"type":"tool-call","toolCall":{...}}` - Tool invocation information
- `{"type":"tool-result","toolResult":{...}}` - Tool execution result
- `{"type":"finish","finishReason":"stop"}` - Stream completion

## Error Codes
- `ErrorCodeEnum.AINotEnabled` - AI Agent is not enabled in the configuration
- Authentication errors - User must be logged in to use the AI Agent