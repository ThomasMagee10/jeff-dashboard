#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 18790;

// Load data
let data = require('./jeff-manager.json');

function saveData() {
  fs.writeFileSync('./jeff-manager.json', JSON.stringify(data, null, 2));
}

function generateId() {
  return 'task-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function generateBotId() {
  return 'bot-' + Math.random().toString(36).substr(2, 6);
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
  
  // API Routes
  if (url === '/api/config' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(data));
    return;
  }
  
  if (url === '/api/settings' && req.method === 'GET') {
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(data.settings));
    return;
  }
  
  if (url === '/api/settings' && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      data.settings = JSON.parse(body);
      saveData();
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(data.settings));
    });
    return;
  }
  
  if (url === '/api/tasks' && req.method === 'GET') {
    const status = new URL(req.url, 'http://localhost').searchParams.get('status');
    let tasks = data.tasks;
    if (status) {
      tasks = tasks.filter(t => t.status === status);
    }
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(tasks));
    return;
  }
  
  if (url === '/api/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const taskData = JSON.parse(body);
      const task = {
        id: generateId(),
        title: taskData.title || 'Untitled',
        description: taskData.description || '',
        acceptanceCriteria: taskData.acceptanceCriteria || '',
        status: taskData.status || 'todo',
        priority: taskData.priority || 'medium',
        template: taskData.template || 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        bot: null,
        activity: [{"timestamp": new Date().toISOString(), "action": "Created", "details": "Task created"}]
      };
      data.tasks.unshift(task);
      data.stats.totalTasks = (data.stats.totalTasks || 0) + 1;
      saveData();
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(task));
    });
    return;
  }
  
  if (url.match(/^\/api\/tasks\/[\w-]+$/) && req.method === 'GET') {
    const taskId = url.split('/').pop();
    const task = data.tasks.find(t => t.id === taskId);
    if (task) {
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify(task));
    } else {
      res.writeHead(404, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Not found'}));
    }
    return;
  }
  
  if (url.match(/^\/api\/tasks\/[\w-]+$/) && req.method === 'PUT') {
    const taskId = url.split('/').pop();
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const updates = JSON.parse(body);
      const taskIndex = data.tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex !== -1) {
        const oldStatus = data.tasks[taskIndex].status;
        data.tasks[taskIndex] = {
          ...data.tasks[taskIndex],
          ...updates,
          updatedAt: new Date().toISOString()
        };
        
        // Log activity
        if (updates.status && updates.status !== oldStatus) {
          data.tasks[taskIndex].activity.push({
            "timestamp": new Date().toISOString(),
            "action": "Status changed",
            "details": `${oldStatus} → ${updates.status}`
          });
        }
        
        if (updates.blockReason) {
          data.tasks[taskIndex].activity.push({
            "timestamp": new Date().toISOString(),
            "action": "Blocked",
            "details": updates.blockReason
          });
        }
        
        if (updates.status === 'completed') {
          data.stats.completedTasks = (data.stats.completedTasks || 0) + 1;
          if (data.tasks[taskIndex].bot) {
            data.tasks[taskIndex].bot.status = 'completed';
          }
        }
        
        saveData();
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(data.tasks[taskIndex]));
      } else {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Not found'}));
      }
    });
    return;
  }
  
  if (url.match(/^\/api\/tasks\/[\w-]+\/bot$/) && req.method === 'POST') {
    const taskId = url.split('/')[2];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const botData = JSON.parse(body);
      const taskIndex = data.tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex !== -1) {
        const template = data.templates[botData.template] || data.templates.medium;
        const bot = {
          name: botData.name || generateBotId(),
          status: 'running',
          model: template.model,
          startedAt: new Date().toISOString(),
          lastHeartbeatAt: new Date().toISOString(),
          currentStep: 'Initializing...',
          budgetUsed: {tokens: 0, calls: 0},
          budgetLimit: {tokens: template.maxTokens, calls: 50}
        };
        
        data.tasks[taskIndex].bot = bot;
        data.tasks[taskIndex].status = 'progress';
        data.tasks[taskIndex].activity.push({
          "timestamp": new Date().toISOString(),
          "action": "Bot spawned",
          "details": `${bot.name} started on ${template.model}`
        });
        
        saveData();
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(bot));
      } else {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Task not found'}));
      }
    });
    return;
  }
  
  if (url.match(/^\/api\/tasks\/[\w-]+\/activity$/) && req.method === 'POST') {
    const taskId = url.split('/')[2];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const activity = JSON.parse(body);
      const taskIndex = data.tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex !== -1) {
        data.tasks[taskIndex].activity.push({
          "timestamp": new Date().toISOString(),
          "action": activity.action,
          "details": activity.details
        });
        
        if (activity.heartbeat) {
          data.tasks[taskIndex].bot.lastHeartbeatAt = new Date().toISOString();
          data.tasks[taskIndex].bot.currentStep = activity.details;
          data.tasks[taskIndex].bot.budgetUsed = activity.budgetUsed || data.tasks[taskIndex].bot.budgetUsed;
        }
        
        saveData();
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({success: true}));
      } else {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Task not found'}));
      }
    });
    return;
  }
  
  if (url.match(/^\/api\/tasks\/[\w-]+$/) && req.method === 'DELETE') {
    const taskId = url.split('/').pop();
    const taskIndex = data.tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex !== -1) {
      data.tasks.splice(taskIndex, 1);
      saveData();
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({success: true}));
    } else {
      res.writeHead(404, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Not found'}));
    }
    return;
  }
  
  // Serve static files
  let filePath = url === '/' ? '/index.html' : url;
  const fullPath = path.join(__dirname, filePath);
  const ext = path.extname(fullPath);
  const contentTypes = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.md': 'text/markdown'};
  
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
