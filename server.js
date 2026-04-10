const http = require('http');
const crypto = require('crypto');

// --- Tool Definitions ---

const TOOLS = [
  {
    name: 'echo',
    description: 'Echoes back the input message (deterministic)',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'The message to echo back' }
      },
      required: ['message']
    }
  },
  {
    name: 'calculate',
    description: 'Evaluates a math expression (deterministic, no side effects)',
    inputSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression like "2+2" or "10*5+3"' }
      },
      required: ['expression']
    }
  },
  {
    name: 'word_count',
    description: 'Counts words, characters, and sentences in text (deterministic)',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to analyze' }
      },
      required: ['text']
    }
  },
  {
    name: 'translate_leet',
    description: 'Converts text to leet speak (deterministic)',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to convert to leet speak' }
      },
      required: ['text']
    }
  },
  {
    name: 'reverse',
    description: 'Reverses a string (deterministic)',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The string to reverse' }
      },
      required: ['text']
    }
  },
  {
    name: 'json_format',
    description: 'Pretty-prints a JSON string (deterministic)',
    inputSchema: {
      type: 'object',
      properties: {
        json_string: { type: 'string', description: 'A JSON string to pretty-print' }
      },
      required: ['json_string']
    }
  },
  {
    name: 'base64_encode',
    description: 'Base64 encodes text (deterministic)',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to base64 encode' }
      },
      required: ['text']
    }
  },
  {
    name: 'hash_text',
    description: 'Returns the SHA-256 hash of text as hex (deterministic)',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The text to hash' }
      },
      required: ['text']
    }
  }
];

// --- Tool Handlers ---

const LEET_MAP = {
  a: '4', A: '4',
  e: '3', E: '3',
  i: '1', I: '1',
  o: '0', O: '0',
  s: '5', S: '5',
  t: '7', T: '7',
  l: '1', L: '1',
  g: '9', G: '9',
};

function handleToolCall(name, args) {
  switch (name) {
    case 'echo': {
      return `Echo: ${args.message}`;
    }

    case 'calculate': {
      const expr = String(args.expression || '0');
      // Allow only safe math characters
      const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '');
      if (sanitized.trim() === '') {
        return 'Error: expression contains no valid math characters';
      }
      try {
        const answer = Function('"use strict"; return (' + sanitized + ')')();
        return `${expr} = ${answer}`;
      } catch {
        return `Error: could not evaluate expression "${expr}"`;
      }
    }

    case 'word_count': {
      const text = args.text || '';
      const words = text.trim() === '' ? [] : text.trim().split(/\s+/);
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
      return JSON.stringify({
        word_count: words.length,
        char_count: text.length,
        sentence_count: sentences.length
      });
    }

    case 'translate_leet': {
      const text = args.text || '';
      return text.split('').map(c => LEET_MAP[c] || c).join('');
    }

    case 'reverse': {
      const text = args.text || '';
      return text.split('').reverse().join('');
    }

    case 'json_format': {
      try {
        const parsed = JSON.parse(args.json_string);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return 'Error: invalid JSON string';
      }
    }

    case 'base64_encode': {
      return Buffer.from(args.text || '').toString('base64');
    }

    case 'hash_text': {
      return crypto.createHash('sha256').update(args.text || '').digest('hex');
    }

    default:
      return `Unknown tool: ${name}`;
  }
}

// --- Auth ---

const API_TOKEN = process.env.MCP_API_TOKEN || 'elna-mcp-test-token-2026';

function checkAuth(req, res) {
  const auth = req.headers['authorization'] || '';
  const apiKey = req.headers['x-api-key'] || '';

  if (auth === `Bearer ${API_TOKEN}` || apiKey === API_TOKEN) {
    return true;
  }

  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    jsonrpc: '2.0',
    id: null,
    error: { code: -32001, message: 'Unauthorized: valid Bearer token or X-API-Key required' }
  }));
  return false;
}

// --- HTTP Server ---

http.createServer((req, res) => {
  // Health check (no auth required)
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      server: 'elna-mcp-test',
      version: '2.1.0',
      auth: 'required (Bearer or X-API-Key)',
      tools: TOOLS.map(t => t.name)
    }));
    return;
  }

  // All POST requests require auth
  if (!checkAuth(req, res)) return;

  let body = '';
  req.on('data', d => body += d);
  req.on('end', () => {
    try {
      const rpc = JSON.parse(body);
      let result;

      if (rpc.method === 'initialize') {
        result = {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'elna-mcp-test', version: '2.0.0' }
        };
      } else if (rpc.method === 'notifications/initialized') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: {} }));
        return;
      } else if (rpc.method === 'tools/list') {
        result = { tools: TOOLS };
      } else if (rpc.method === 'tools/call') {
        const toolName = rpc.params?.name;
        const args = rpc.params?.arguments || {};
        const text = handleToolCall(toolName, args);
        const isError = text.startsWith('Error:') || text.startsWith('Unknown tool:');
        result = {
          content: [{ type: 'text', text }],
          isError
        };
      } else {
        result = {};
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32700, message: 'Parse error', data: e.message }
      }));
    }
  });
}).listen(process.env.PORT || 3001, () => {
  console.log(`MCP test server v2.1.0 running on port ${process.env.PORT || 3001}`);
  console.log(`Auth token: ${API_TOKEN}`);
  console.log(`Tools: ${TOOLS.map(t => t.name).join(', ')}`);
});
