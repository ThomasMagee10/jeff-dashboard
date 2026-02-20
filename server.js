#!/usr/bin/env node

const http = require('http');
const path = require('path');

// Simple in-memory data
let data = {
  settings: { managerMode: { enabled: true } },
  templates: { 
    light: { name: "Light", model: "MiniMax M2.1", maxTokens: 4000, timeoutSeconds: 60, color: "#238636" },
    medium: { name: "Medium", model: "MiniMax M2.1", maxTokens: 10000, timeoutSeconds: 180, color: "#d29922" },
    heavy: { name: "Heavy", model: "MiniMax M2.5", maxTokens: 20000, timeoutSeconds: 300, color: "#da3633" },
    claude: { name: "Claude", model: "Claude 3.5 Sonnet", maxTokens: 50000, timeoutSeconds: 600, color: "#a371f7" }
  },
  tasks: [],
  stats: { totalTasks: 0, completedTasks: 0 }
};

function generateId() {
  return 'task-' + Date.now().toString(36);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = req.url.split('?')[0];
  
  // Config endpoint
  if (url === '/api/config') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(data));
    return;
  }
  
  // Tasks - GET
  if (url === '/api/tasks' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(data.tasks));
    return;
  }
  
  // Tasks - POST (create)
  if (url === '/api/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const taskData = JSON.parse(body);
        const task = {
          id: generateId(),
          title: taskData.title || 'Untitled',
          description: taskData.description || '',
          acceptanceCriteria: taskData.acceptanceCriteria || '',
          status: 'todo',
          priority: taskData.priority || 'medium',
          template: taskData.template || 'medium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          bot: null,
          activity: [{ timestamp: new Date().toISOString(), action: 'Created', details: 'Task created' }]
        };
        data.tasks.unshift(task);
        data.stats.totalTasks++;
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(task));
      } catch (e) {
        res.writeHead(400, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }
  
  // Task by ID - PUT
  if (url.match(/^\/api\/tasks\/[\w-]+$/) && req.method === 'PUT') {
    const taskId = url.split('/').pop();
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const updates = JSON.parse(body);
      const idx = data.tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        data.tasks[idx] = { ...data.tasks[idx], ...updates, updatedAt: new Date().toISOString() };
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(data.tasks[idx]));
      } else {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });
    return;
  }
  
  // Task by ID - DELETE
  if (url.match(/^\/api\/tasks\/[\w-]+$/) && req.method === 'DELETE') {
    const taskId = url.split('/').pop();
    const idx = data.tasks.findIndex(t => t.id === taskId);
    if (idx !== -1) {
      data.tasks.splice(idx, 1);
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ success: true }));
    } else {
      res.writeHead(404, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({ error: 'Not found' }));
    }
    return;
  }
  
  // Spawn bot
  if (url.match(/^\/api\/tasks\/[\w-]+\/bot$/) && req.method === 'POST') {
    const taskId = url.split('/')[2];
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const botData = JSON.parse(body);
      const idx = data.tasks.findIndex(t => t.id === taskId);
      if (idx !== -1) {
        const tmpl = data.templates[botData.template] || data.templates.medium;
        data.tasks[idx].bot = {
          name: botData.name || 'bot-' + Math.random().toString(36).substr(2, 4),
          status: 'running',
          model: tmpl.model,
          startedAt: new Date().toISOString(),
          lastHeartbeatAt: new Date().toISOString(),
          currentStep: 'Starting...',
          budgetUsed: { tokens: 0, calls: 0 },
          budgetLimit: { tokens: tmpl.maxTokens, calls: 50 }
        };
        data.tasks[idx].status = 'progress';
        data.tasks[idx].activity.push({ timestamp: new Date().toISOString(), action: 'Bot spawned', details: 'Bot started' });
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(data.tasks[idx].bot));
      } else {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    });
    return;
  }
  
  // Serve static files
  let filePath = url === '/' ? '/index.html' : url;
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath);
  const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' };
  
  require('fs').readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': types[ext] || 'text/plain' });
    res.end(content);
  });
});

const PORT = process.env.PORT || 18790;
server.listen(PORT, () => {
  console.log('Jeff Manager running on port ' + PORT);
});
