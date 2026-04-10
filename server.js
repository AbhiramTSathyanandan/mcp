const http = require('http');
  http.createServer((req, res) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      const rpc = JSON.parse(body);
      let result;
      if (rpc.method === 'initialize') {
        result = { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'test-mcp', version: '1.0' } };
      } else if (rpc.method === 'tools/list') {
        result = { tools: [{ name: 'echo', description: 'Echoes back your input', inputSchema: { type: 'object', properties: { message: { type: 'string' } } } }] };
      } else if (rpc.method === 'tools/call') {
        result = { content: [{ type: 'text', text: `Echo: ${JSON.stringify(rpc.params.arguments)}` }] };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }));
    });
  }).listen(process.env.PORT || 3001);
