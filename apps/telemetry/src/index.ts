interface Env {
  DB: D1Database
}

interface TelemetryPayload {
  instanceId: string
  version: string
  nodeVersion?: string
  event: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  })
}

async function handleCollect(request: Request, env: Env): Promise<Response> {
  try {
    const payload = (await request.json()) as TelemetryPayload

    if (!payload.instanceId || !payload.version || !payload.event) {
      return jsonResponse({ error: 'Missing required fields' }, 400)
    }

    await env.DB.prepare(
      'INSERT INTO telemetry (instance_id, version, node_version, event) VALUES (?, ?, ?, ?)',
    )
      .bind(
        payload.instanceId,
        payload.version,
        payload.nodeVersion || null,
        payload.event,
      )
      .run()

    return jsonResponse({ success: true })
  } catch (error) {
    console.error('Collect error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}

interface StatsData {
  totalInstances: number
  activeInstances: {
    today: number
    last7Days: number
    last30Days: number
  }
  todayStartups: number
  onlineNow: number
  versionDistribution: Array<{ version: string; count: number }>
  nodeVersionDistribution: Array<{ node_version: string; count: number }>
  dailyStartups: Array<{ date: string; count: number }>
  dailyActiveInstances: Array<{ date: string; count: number }>
}

async function getStatsData(env: Env): Promise<StatsData> {
  const totalInstances = await env.DB.prepare(
    'SELECT COUNT(DISTINCT instance_id) as count FROM telemetry',
  ).first<{ count: number }>()

  const activeInstancesToday = await env.DB.prepare(
    `SELECT COUNT(DISTINCT instance_id) as count FROM telemetry
     WHERE DATE(created_at) = DATE('now')`,
  ).first<{ count: number }>()

  const activeInstances7d = await env.DB.prepare(
    `SELECT COUNT(DISTINCT instance_id) as count FROM telemetry
     WHERE created_at >= datetime('now', '-7 days')`,
  ).first<{ count: number }>()

  const activeInstances30d = await env.DB.prepare(
    `SELECT COUNT(DISTINCT instance_id) as count FROM telemetry
     WHERE created_at >= datetime('now', '-30 days')`,
  ).first<{ count: number }>()

  const todayStartups = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM telemetry
     WHERE event = 'startup' AND DATE(created_at) = DATE('now')`,
  ).first<{ count: number }>()

  const onlineNow = await env.DB.prepare(
    `SELECT COUNT(DISTINCT instance_id) as count FROM telemetry
     WHERE created_at >= datetime('now', '-1 hour')`,
  ).first<{ count: number }>()

  const versionDistribution = await env.DB.prepare(
    `SELECT version, COUNT(DISTINCT instance_id) as count
     FROM telemetry
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY version
     ORDER BY count DESC
     LIMIT 20`,
  ).all<{ version: string; count: number }>()

  const nodeVersionDistribution = await env.DB.prepare(
    `SELECT node_version, COUNT(DISTINCT instance_id) as count
     FROM telemetry
     WHERE node_version IS NOT NULL
       AND created_at >= datetime('now', '-30 days')
     GROUP BY node_version
     ORDER BY count DESC
     LIMIT 20`,
  ).all<{ node_version: string; count: number }>()

  const dailyStartups = await env.DB.prepare(
    `SELECT DATE(created_at) as date, COUNT(*) as count
     FROM telemetry
     WHERE event = 'startup'
       AND created_at >= datetime('now', '-30 days')
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
  ).all<{ date: string; count: number }>()

  const dailyActiveInstances = await env.DB.prepare(
    `SELECT DATE(created_at) as date, COUNT(DISTINCT instance_id) as count
     FROM telemetry
     WHERE created_at >= datetime('now', '-30 days')
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
  ).all<{ date: string; count: number }>()

  return {
    totalInstances: totalInstances?.count || 0,
    activeInstances: {
      today: activeInstancesToday?.count || 0,
      last7Days: activeInstances7d?.count || 0,
      last30Days: activeInstances30d?.count || 0,
    },
    todayStartups: todayStartups?.count || 0,
    onlineNow: onlineNow?.count || 0,
    versionDistribution: versionDistribution.results,
    nodeVersionDistribution: nodeVersionDistribution.results,
    dailyStartups: dailyStartups.results,
    dailyActiveInstances: dailyActiveInstances.results,
  }
}

async function handleStats(env: Env): Promise<Response> {
  try {
    const stats = await getStatsData(env)
    return jsonResponse(stats)
  } catch (error) {
    console.error('Stats error:', error)
    return jsonResponse({ error: 'Internal server error' }, 500)
  }
}

function generateDashboardHtml(stats: StatsData): string {
  const versionLabels = JSON.stringify(
    stats.versionDistribution.map((v) => v.version),
  )
  const versionData = JSON.stringify(
    stats.versionDistribution.map((v) => v.count),
  )
  const nodeLabels = JSON.stringify(
    stats.nodeVersionDistribution.map((v) => v.node_version),
  )
  const nodeData = JSON.stringify(
    stats.nodeVersionDistribution.map((v) => v.count),
  )
  const dailyLabels = JSON.stringify(stats.dailyStartups.map((d) => d.date))
  const dailyStartupData = JSON.stringify(
    stats.dailyStartups.map((d) => d.count),
  )
  const dailyActiveData = JSON.stringify(
    stats.dailyActiveInstances.map((d) => d.count),
  )

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MX Space Telemetry</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      min-height: 100vh;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-bottom: 2rem;
      color: #fff;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 8px;
      padding: 1.25rem;
    }
    .stat-label {
      font-size: 0.75rem;
      color: #a3a3a3;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.5rem;
    }
    .stat-value {
      font-size: 2rem;
      font-weight: 600;
      color: #fff;
    }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 1.5rem;
    }
    .chart-card {
      background: #171717;
      border: 1px solid #262626;
      border-radius: 8px;
      padding: 1.25rem;
    }
    .chart-card.full-width {
      grid-column: 1 / -1;
    }
    .chart-title {
      font-size: 0.875rem;
      font-weight: 500;
      color: #d4d4d4;
      margin-bottom: 1rem;
    }
    .chart-container {
      position: relative;
      height: 280px;
    }
    .chart-container.line-chart {
      height: 200px;
    }
    footer {
      margin-top: 3rem;
      text-align: center;
      color: #525252;
      font-size: 0.75rem;
    }
    footer a { color: #737373; }
  </style>
</head>
<body>
  <div class="container">
    <h1>MX Space Telemetry</h1>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Instances</div>
        <div class="stat-value">${stats.totalInstances.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Online Now</div>
        <div class="stat-value">${stats.onlineNow.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Today Startups</div>
        <div class="stat-value">${stats.todayStartups.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active Today</div>
        <div class="stat-value">${stats.activeInstances.today.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active (7 days)</div>
        <div class="stat-value">${stats.activeInstances.last7Days.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Active (30 days)</div>
        <div class="stat-value">${stats.activeInstances.last30Days.toLocaleString()}</div>
      </div>
    </div>

    <div class="charts-grid">
      <div class="chart-card full-width">
        <div class="chart-title">Daily Startups (Last 30 Days)</div>
        <div class="chart-container line-chart">
          <canvas id="dailyChart"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-title">Version Distribution</div>
        <div class="chart-container">
          <canvas id="versionChart"></canvas>
        </div>
      </div>

      <div class="chart-card">
        <div class="chart-title">Node.js Version Distribution</div>
        <div class="chart-container">
          <canvas id="nodeChart"></canvas>
        </div>
      </div>
    </div>

    <footer>
      <p>Anonymous telemetry data from <a href="https://github.com/mx-space/core" target="_blank">MX Space</a></p>
    </footer>
  </div>

  <script>
    const chartColors = [
      '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e',
      '#06b6d4', '#eab308', '#ef4444', '#14b8a6', '#a855f7'
    ];

    new Chart(document.getElementById('dailyChart'), {
      type: 'line',
      data: {
        labels: ${dailyLabels},
        datasets: [{
          label: 'Startups',
          data: ${dailyStartupData},
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        }, {
          label: 'Active Instances',
          data: ${dailyActiveData},
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.3,
          pointRadius: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: '#a3a3a3' }
          }
        },
        scales: {
          x: {
            grid: { color: '#262626' },
            ticks: { color: '#737373', maxTicksLimit: 10 }
          },
          y: {
            grid: { color: '#262626' },
            ticks: { color: '#737373' },
            beginAtZero: true
          }
        }
      }
    });

    new Chart(document.getElementById('versionChart'), {
      type: 'doughnut',
      data: {
        labels: ${versionLabels},
        datasets: [{
          data: ${versionData},
          backgroundColor: chartColors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#a3a3a3', boxWidth: 12, padding: 8 }
          }
        }
      }
    });

    new Chart(document.getElementById('nodeChart'), {
      type: 'doughnut',
      data: {
        labels: ${nodeLabels},
        datasets: [{
          data: ${nodeData},
          backgroundColor: chartColors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'right',
            labels: { color: '#a3a3a3', boxWidth: 12, padding: 8 }
          }
        }
      }
    });
  </script>
</body>
</html>`
}

async function handleDashboard(env: Env): Promise<Response> {
  try {
    const stats = await getStatsData(env)
    const html = generateDashboardHtml(stats)
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    console.error('Dashboard error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    if (url.pathname === '/collect' && request.method === 'POST') {
      return handleCollect(request, env)
    }

    // Protected by Cloudflare Zero Trust
    if (url.pathname === '/stats' && request.method === 'GET') {
      return handleStats(env)
    }

    // Protected by Cloudflare Zero Trust
    if (
      (url.pathname === '/' || url.pathname === '/dashboard') &&
      request.method === 'GET'
    ) {
      return handleDashboard(env)
    }

    return jsonResponse({ error: 'Not found' }, 404)
  },
}
