#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 18790;

// In-memory storage (works on Render)
let data = {
  templates: {
    light: { name: "Light", description: "Quick tasks", model: "MiniMax M2.1", maxTokens: 4000, timeoutSeconds: 60, color: "#238636" },
    medium: { name: "Medium", description: "Research & multi-step", model: "MiniMax M2.1", maxTokens: 10000, timeoutSeconds: 180, color: "#d29922" },
    heavy: { name: "Heavy", description: "Complex reasoning", model: "MiniMax M2.5", maxTokens: 20000, timeoutSeconds: 300, color: "#da3633" },
    claude: { name: "Claude", description: "Premium AI assistant", model: "Claude 3.5 Sonnet", maxTokens: 50000, timeoutSeconds: 600, color: "#a371f7" }
  },
  tasks: [],
  stats: { totalTasks: 0, completedTasks: 0 }
};

function generateId() {
  return 'task-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
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
  
  // API Routes
  if (req.url === '/api/config') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(data));
    return;
  }
  
  if (req.url === '/api/tasks' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(data.tasks));
    return;
  }
  
  if (req.url === '/api/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const taskData = JSON.parse(body);
      const task = {
        id: generateId(),
        title: taskData.title || 'Untitled Task',
        description: taskData.description || '',
        status: taskData.status || 'todo',
        template: taskData.template || 'medium',
        botName: taskData.botName || null,
        assignedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.tasks.unshift(task);
      data.stats.totalTasks = (data.stats.totalTasks || 0) + 1;
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(task));
    });
    return;
  }
  
  if (req.url.startsWith('/api/tasks/') && req.method === 'PUT') {
    const taskId = req.url.split('/').slice(-1)[0];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const updates = JSON.parse(body);
      const taskIndex = data.tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        data.tasks[taskIndex] = { ...data.tasks[taskIndex], ...updates, updatedAt: new Date().toISOString() };
        if (updates.status === 'completed' && data.tasks[taskIndex].status !== 'completed') {
          data.stats.completedTasks = (data.stats.completedTasks || 0) + 1;
        }
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(data.tasks[taskIndex]));
      } else {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Task not found'}));
      }
    });
    return;
  }
  
  if (req.url.startsWith('/api/tasks/') && req.method === 'DELETE') {
    const taskId = req.url.split('/').slice(-1)[0];
    const taskIndex = data.tasks.findIndex(t => t.id === taskId);
    if (taskIndex !== -1) {
      data.tasks.splice(taskIndex, 1);
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({success: true}));
    } else {
      res.writeHead(404, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Task not found'}));
    }
    return;
  }
  
  // Serve static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath);
  const contentTypes = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
  
  fs.readFile(fullPath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {'Content-Type': contentTypes[ext] || 'text/plain'});
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Jeff Manager running on port ${PORT}`);
});
