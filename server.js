const http = require('http');

http.createServer((req, res) => {
  // Health check for Render
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', server: 'elna-mcp-test' }));
    return;
  }

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
          serverInfo: { name: 'elna-mcp-test', version: '1.0.0' }
        };
      } else if (rpc.method === 'notifications/initialized') {
        // No response needed for notifications
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: {} }));
        return;
      } else if (rpc.method === 'tools/list') {
        result = {
          tools: [
            {
              name: 'echo',
              description: 'Echoes back your input message',
              inputSchema: {
                type: 'object',
                properties: {
                  message: { type: 'string', description: 'The message to echo back' }
                },
                required: ['message']
              }
            },
            {
              name: 'get_time',
              description: 'Returns the current server time',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'calculate',
              description: 'Evaluates a simple math expression',
              inputSchema: {
                type: 'object',
                properties: {
                  expression: { type: 'string', description: 'Math expression like 2+2 or 10*5' }
                },
                required: ['expression']
              }
            }
          ]
        };
      } else if (rpc.method === 'tools/call') {
        const toolName = rpc.params?.name;
        const args = rpc.params?.arguments || {};

        let text;
        if (toolName === 'echo') {
          text = `Echo: ${args.message || args.query || JSON.stringify(args)}`;
        } else if (toolName === 'get_time') {
          text = `Current server time: ${new Date().toISOString()}`;
        } else if (toolName === 'calculate') {
          try {
            const expr = String(args.expression || args.query || '0');
            // Simple safe eval for math
            const sanitized = expr.replace(/[^0-9+\-*/().%\s]/g, '');
            const answer = Function('"use strict"; return (' + sanitized + ')')();
            text = `${expr} = ${answer}`;
          } catch (e) {
            text = `Error: Could not evaluate expression`;
          }
        } else {
          text = `Unknown tool: ${toolName}`;
        }

        result = {
          content: [{ type: 'text', text }],
          isError: false
        };
      } else {
        result = {};
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}).listen(process.env.PORT || 3001, () => {
  console.log(`MCP test server running on port ${process.env.PORT || 3001}`);
});
