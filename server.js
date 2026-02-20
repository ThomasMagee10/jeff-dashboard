#!/usr/bin/env node

const http = require('http');
const path = require('path');

const PORT = process.env.PORT || 18790;

// Load data
const fs = require('fs');
const path = require('path');

let data = {
  version: "1.0",
  settings: { managerMode: { enabled: true, interventionRules: { autoEscalateOnFailure: true, requireApprovalForDestructive: true, requireApprovalForPR: true, requireApprovalForMessaging: false, budgetThreshold: 100 } }, spawning: { maxConcurrentBots: 3, defaultModel: "medium", retryPolicy: { maxRetries: 2, backoffMs: 5000 }, defaultBudgets: { light: { tokens: 4000, timeoutSeconds: 60 }, medium: { tokens: 10000, timeoutSeconds: 180 }, heavy: { tokens: 20000, timeoutSeconds: 300 }, claude: { tokens: 50000, timeoutSeconds: 600 } } }, approvalGates: { enabled: false, requireForDestructive: true, requireForPR: true, requireForMessaging: false, budgetThreshold: 100 }, integrations: { github: { enabled: false, token: "" }, jira: { enabled: false, token: "" }, telegram: { enabled: true } }, notifications: { channels: ["telegram"], events: ["task_created", "task_completed", "task_blocked", "bot_failed"] }, boardPreferences: { wipLimits: { todo: 10, progress: 5, blocked: 3 }, sorting: "createdAt", filters: { showCompleted: true } } },
  templates: { light: { name: "Light", model: "MiniMax M2.1", maxTokens: 4000, timeoutSeconds: 60, color: "#238636" }, medium: { name: "Medium", model: "MiniMax M2.1", maxTokens: 10000, timeoutSeconds: 180, color: "#d29922" }, heavy: { name: "Heavy", model: "MiniMax M2.5", maxTokens: 20000, timeoutSeconds: 300, color: "#da3633" }, claude: { name: "Claude", model: "Claude 3.5 Sonnet", maxTokens: 50000, timeoutSeconds: 600, color: "#a371f7" } },
  tasks: [
    { id: "task-1", title: "Build user authentication", description: "Implement OAuth2 login flow with GitHub and Google providers.", status: "progress", priority: "high", template: "medium", createdAt: "2026-02-20T10:00:00Z", updatedAt: "2026-02-20T11:30:00Z", bot: { name: "bot-alpha", status: "running", model: "MiniMax M2.1", startedAt: "2026-02-20T11:30:00Z", lastHeartbeatAt: "2026-02-20T12:35:00Z", currentStep: "Implementing OAuth2 flow", budgetUsed: { tokens: 4500, calls: 12 }, budgetLimit: { tokens: 10000, calls: 50 } }, activity: [{ timestamp: "2026-02-20T11:30:00Z", action: "Bot spawned", details: "bot-alpha started" }, { timestamp: "2026-02-20T12:00:00Z", action: "Progress", details: "Completed user model" }, { timestamp: "2026-02-20T12:35:00Z", action: "Heartbeat", details: "Implementing OAuth2 flow" }] },
    { id: "task-2", title: "Fix dashboard CSS", description: "Responsive issues on mobile devices.", status: "todo", priority: "low", template: "light", createdAt: "2026-02-20T12:00:00Z", updatedAt: "2026-02-20T12:00:00Z", bot: null, activity: [] },
    { id: "task-3", title: "API rate limiting", description: "Implement rate limiting middleware.", status: "blocked", priority: "medium", template: "heavy", createdAt: "2026-02-19T14:00:00Z", updatedAt: "2026-02-20T09:00:00Z", blockReason: "Waiting on Redis", bot: { name: "bot-gamma", status: "paused", model: "MiniMax M2.5", startedAt: "2026-02-19T14:00:00Z", lastHeartbeatAt: "2026-02-20T09:00:00Z", currentStep: "Waiting for Redis", budgetUsed: { tokens: 15000, calls: 35 }, budgetLimit: { tokens: 20000, calls: 100 } }, activity: [] },
    { id: "task-4", title: "Database migrations", description: "Create migration scripts for new schema.", status: "completed", priority: "medium", template: "light", createdAt: "2026-02-18T10:00:00Z", updatedAt: "2026-02-19T16:00:00Z", bot: { name: "bot-beta", status: "completed", model: "MiniMax M2.1", startedAt: "2026-02-19T10:00:00Z", lastHeartbeatAt: "2026-02-19T16:00:00Z", currentStep: "Migration complete", budgetUsed: { tokens: 2000, calls: 5 }, budgetLimit: { tokens: 4000, calls: 20 } }, activity: [] }
  ],
  stats: { totalTasks: 4, completedTasks: 1 }
};

function saveData() {
  // In-memory only for now
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
