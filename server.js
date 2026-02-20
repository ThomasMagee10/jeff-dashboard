#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 18790;
const HOST = '0.0.0.0';
const CONFIG_PATH = '/Users/jeff2/.openclaw/workspace/jeff-manager.json';

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    return { templates: {}, tasks: [], stats: {} };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

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
    const cfg = loadConfig();
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(cfg));
    return;
  }
  
  if (req.url === '/api/tasks' && req.method === 'GET') {
    const cfg = loadConfig();
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(cfg.tasks));
    return;
  }
  
  if (req.url === '/api/tasks' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const data = JSON.parse(body);
      const cfg = loadConfig();
      
      const task = {
        id: generateId(),
        title: data.title || 'Untitled Task',
        description: data.description || '',
        status: data.status || 'todo',
        template: data.template || 'medium',
        botName: data.botName || null,
        assignedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      cfg.tasks.unshift(task);
      cfg.stats.totalTasks = (cfg.stats.totalTasks || 0) + 1;
      saveConfig(cfg);
      
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
      const cfg = loadConfig();
      const taskIndex = cfg.tasks.findIndex(t => t.id === taskId);
      
      if (taskIndex !== -1) {
        cfg.tasks[taskIndex] = {
          ...cfg.tasks[taskIndex],
          ...updates,
          updatedAt: new Date().toISOString()
        };
        
        // Track completion
        if (updates.status === 'completed' && cfg.tasks[taskIndex].status !== 'completed') {
          cfg.stats.completedTasks = (cfg.stats.completedTasks || 0) + 1;
        }
        
        saveConfig(cfg);
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(cfg.tasks[taskIndex]));
      } else {
        res.writeHead(404, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Task not found'}));
      }
    });
    return;
  }
  
  if (req.url.startsWith('/api/tasks/') && req.method === 'DELETE') {
    const taskId = req.url.split('/').slice(-1)[0];
    const cfg = loadConfig();
    const taskIndex = cfg.tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex !== -1) {
      cfg.tasks.splice(taskIndex, 1);
      saveConfig(cfg);
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({success: true}));
    } else {
      res.writeHead(404, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({error: 'Task not found'}));
    }
    return;
  }
  
  // Serve static dashboard
  const dashboardPath = '/Users/jeff2/.openclaw/workspace/jeff-dashboard/index.html';
  fs.readFile(dashboardPath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Dashboard not found');
      return;
    }
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Jeff Manager Dashboard: http://127.0.0.1:${PORT}/`);
});
