#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 18790;
const HOST = '0.0.0.0'; // Listen on all interfaces
const CONFIG_PATH = '/Users/jeff2/.openclaw/workspace/jeff-manager.json';

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function selectTemplate(task) {
  const lower = task.toLowerCase();
  if (lower.includes('look') || lower.includes('find') || lower.includes('check') || lower.length < 100) {
    return 'light';
  }
  if (lower.includes('research') || lower.includes('analyze') || lower.includes('compare') || lower.includes('build')) {
    return 'medium';
  }
  return 'light';
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.url === '/jeff-manager.json') {
    const cfg = loadConfig();
    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({
      active: cfg.jobs.filter(j => j.status === 'running').length,
      queued: cfg.jobs.filter(j => j.status === 'queued').length,
      completed: cfg.jobs.filter(j => j.status === 'completed' || j.status === 'failed').length,
      stats: cfg.stats,
      templates: cfg.templates,
      jobs: cfg.jobs.slice(0, 20)
    }));
    return;
  }
  
  if (req.url === '/api/spawn' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const {task, template} = JSON.parse(body);
      const cfg = loadConfig();
      
      if (!cfg.global.allowSpawning) {
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify({error: 'Spawning disabled'}));
        return;
      }
      
      const tmplName = template || selectTemplate(task);
      const tmpl = cfg.templates[tmplName];
      
      const jobId = `${tmplName}-${Date.now().toString(36)}`;
      cfg.jobs.unshift({
        id: jobId,
        template: tmplName,
        task: task,
        status: 'running',
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        model: tmpl.model,
        maxTokens: tmpl.maxTokens,
        tokensUsed: 0,
        output: null,
        error: null
      });
      cfg.stats.totalJobs++;
      saveConfig(cfg);
      
      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({
        jobId,
        template: tmplName,
        model: tmpl.model,
        status: 'spawned',
        message: `Spawned ${tmplName} bot (${jobId})`
      }));
    });
    return;
  }
  
  // Serve dashboard
  const dashboardPath = '/Users/jeff2/.openclaw/workspace/jeff-manager-dashboard.html';
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
