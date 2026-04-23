import express from 'express';
import db from '../db/database.js';
import { getLogBuffer } from '../logger.js';
import logger from '../logger.js';
import config from '../config.js';

const app = express();
let botState = {
  ready: false,
  uptime: null,
  wsPing: null,
  lastScanTime: null,
  guilds: 0,
  startedAt: new Date(),
};

export function setBotState(state) {
  botState = { ...botState, ...state };
}

export function getBotState() {
  return botState;
}

// API endpoint for dashboard data
app.get('/api/status', async (req, res) => {
  try {
    const [tokens, positions, trades] = await Promise.all([
      db.query(`SELECT symbol, base_asset, created_at FROM monitored_tokens WHERE active = TRUE ORDER BY created_at`),
      db.query(`SELECT p.*, mt.symbol FROM positions p JOIN monitored_tokens mt ON mt.id = p.token_id WHERE p.status IN ('OPEN', 'TP1_HIT') ORDER BY p.opened_at DESC`),
      db.query(`SELECT count(*) as total, count(*) FILTER (WHERE pnl >= 0) as wins, COALESCE(sum(pnl), 0) as total_pnl FROM trades`),
    ]);

    const nextScan = botState.lastScanTime
      ? new Date(botState.lastScanTime.getTime() + 15 * 60 * 1000)
      : null;

    res.json({
      bot: {
        ready: botState.ready,
        uptime: botState.ready ? process.uptime() : 0,
        wsPing: botState.wsPing,
        guilds: botState.guilds,
        startedAt: botState.startedAt,
      },
      lastScanTime: botState.lastScanTime,
      nextScanTime: nextScan,
      tokens: tokens.rows,
      openPositions: positions.rows.map(p => ({
        symbol: p.symbol,
        direction: p.direction,
        entry: parseFloat(p.entry_price),
        stop: parseFloat(p.stop_price),
        tp1: parseFloat(p.tp1_price),
        status: p.status,
        openedAt: p.opened_at,
      })),
      stats: {
        totalTrades: parseInt(trades.rows[0].total),
        wins: parseInt(trades.rows[0].wins),
        totalPnl: parseFloat(trades.rows[0].total_pnl),
      },
      logs: getLogBuffer().slice(-50),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard HTML
app.get('/', (req, res) => {
  res.send(DASHBOARD_HTML);
});

const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RSI Divergence Bot — Dashboard</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',system-ui,-apple-system,sans-serif; background:#0d1117; color:#c9d1d9; min-height:100vh; }
  .header { background:#161b22; border-bottom:1px solid #30363d; padding:16px 24px; display:flex; align-items:center; justify-content:space-between; }
  .header h1 { font-size:18px; font-weight:600; color:#e6edf3; }
  .header .tag { font-size:12px; padding:3px 10px; border-radius:12px; font-weight:500; }
  .tag-online { background:#1a4731; color:#3fb950; }
  .tag-offline { background:#4a1c1c; color:#f85149; }
  .container { max-width:1200px; margin:0 auto; padding:20px; display:grid; gap:16px; grid-template-columns:1fr 1fr; }
  .card { background:#161b22; border:1px solid #30363d; border-radius:8px; padding:16px; }
  .card h2 { font-size:13px; color:#8b949e; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; }
  .card-full { grid-column:1/-1; }
  .stat-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; }
  .stat { text-align:center; }
  .stat .value { font-size:24px; font-weight:700; color:#e6edf3; }
  .stat .label { font-size:11px; color:#8b949e; margin-top:2px; }
  .stat .value.green { color:#3fb950; }
  .stat .value.red { color:#f85149; }
  .stat .value.blue { color:#58a6ff; }
  .stat .value.yellow { color:#d29922; }
  .token-list { display:flex; flex-wrap:wrap; gap:8px; }
  .token-chip { background:#21262d; border:1px solid #30363d; border-radius:6px; padding:6px 12px; font-size:13px; font-weight:500; }
  .token-chip span { color:#8b949e; font-weight:400; font-size:11px; margin-left:6px; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th { text-align:left; color:#8b949e; font-weight:500; padding:8px; border-bottom:1px solid #30363d; }
  td { padding:8px; border-bottom:1px solid #21262d; }
  .log-box { background:#0d1117; border:1px solid #30363d; border-radius:6px; padding:12px; max-height:350px; overflow-y:auto; font-family:'SF Mono',Consolas,monospace; font-size:12px; line-height:1.7; }
  .log-box::-webkit-scrollbar { width:6px; }
  .log-box::-webkit-scrollbar-track { background:#0d1117; }
  .log-box::-webkit-scrollbar-thumb { background:#30363d; border-radius:3px; }
  .log-error { color:#f85149; }
  .log-warn { color:#d29922; }
  .log-info { color:#8b949e; }
  .log-debug { color:#484f58; }
  .pos-long { color:#3fb950; }
  .pos-short { color:#f85149; }
  .empty { color:#484f58; font-style:italic; text-align:center; padding:20px; }
  @media(max-width:768px) { .container { grid-template-columns:1fr; } }
</style>
</head>
<body>
<div class="header">
  <h1>RSI Divergence Bot</h1>
  <span id="statusTag" class="tag tag-offline">Offline</span>
</div>
<div class="container">
  <div class="card">
    <h2>Estado del Bot</h2>
    <div class="stat-grid" id="botStats"></div>
  </div>
  <div class="card">
    <h2>Estadisticas</h2>
    <div class="stat-grid" id="tradeStats"></div>
  </div>
  <div class="card card-full">
    <h2>Tokens Monitorizados</h2>
    <div id="tokenList" class="token-list"><span class="empty">Cargando...</span></div>
  </div>
  <div class="card">
    <h2>Posiciones Abiertas</h2>
    <div id="positions"><span class="empty">Cargando...</span></div>
  </div>
  <div class="card">
    <h2>Scanning</h2>
    <div class="stat-grid" id="scanStats"></div>
  </div>
  <div class="card card-full">
    <h2>Logs Recientes</h2>
    <div id="logs" class="log-box">Cargando...</div>
  </div>
</div>
<script>
const fmt=(ms)=>{if(!ms)return '0s';const h=Math.floor(ms/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);return h?h+'h '+m+'m':m?m+'m '+s+'s':s+'s';};
const fmtDate=(d)=>d?new Date(d).toLocaleString('es-ES'):'--';
const fmtCountdown=(d)=>{if(!d)return'--';const diff=new Date(d)-new Date();if(diff<=0)return'Ahora';return fmt(diff);};
function $(id){return document.getElementById(id);}
async function refresh(){
  try{
    const r=await fetch('/api/status');
    const d=await r.json();
    const tag=$('statusTag');
    tag.textContent=d.bot.ready?'Online':'Offline';
    tag.className='tag '+(d.bot.ready?'tag-online':'tag-offline');
    $('botStats').innerHTML=\`
      <div class="stat"><div class="value blue">\${d.bot.guilds}</div><div class="label">Servidores</div></div>
      <div class="stat"><div class="value">\${d.bot.wsPing!=null?d.bot.wsPing+'ms':'--'}</div><div class="label">Latencia WS</div></div>
      <div class="stat"><div class="value">\${fmt(d.bot.uptime*1000)}</div><div class="label">Uptime</div></div>
    \`;
    const wr=d.stats.totalTrades>0?((d.stats.wins/d.stats.totalTrades)*100).toFixed(1)+'%':'--';
    const pnlClass=d.stats.totalPnl>=0?'green':'red';
    $('tradeStats').innerHTML=\`
      <div class="stat"><div class="value">\${d.stats.totalTrades}</div><div class="label">Trades</div></div>
      <div class="stat"><div class="value">\${wr}</div><div class="label">Win Rate</div></div>
      <div class="stat"><div class="value \${pnlClass}">$\${d.stats.totalPnl.toFixed(2)}</div><div class="label">P&L Total</div></div>
      <div class="stat"><div class="value blue">\${d.tokens.length}</div><div class="label">Tokens</div></div>
    \`;
    $('tokenList').innerHTML=d.tokens.length
      ?d.tokens.map(t=>'<div class="token-chip">'+t.symbol.replace('/USDT','')+'<span>'+new Date(t.created_at).toLocaleDateString('es-ES')+'</span></div>').join('')
      :'<span class="empty">Sin tokens</span>';
    $('scanStats').innerHTML=\`
      <div class="stat"><div class="value yellow">\${fmtDate(d.lastScanTime)}</div><div class="label">Ultimo Scan</div></div>
      <div class="stat"><div class="value blue">\${fmtCountdown(d.nextScanTime)}</div><div class="label">Proximo Scan</div></div>
    \`;
    if(d.openPositions.length){
      $('positions').innerHTML='<table><tr><th>Token</th><th>Dir</th><th>Entry</th><th>Stop</th><th>Estado</th></tr>'
        +d.openPositions.map(p=>'<tr><td>'+p.symbol.replace('/USDT','')+'</td><td class="pos-'+p.direction.toLowerCase()+'">'+p.direction+'</td><td>$'+p.entry.toFixed(2)+'</td><td>$'+p.stop.toFixed(2)+'</td><td>'+p.status+'</td></tr>').join('')
        +'</table>';
    }else{
      $('positions').innerHTML='<span class="empty">Sin posiciones abiertas</span>';
    }
    const logBox=$('logs');
    const wasAtBottom=logBox.scrollTop+logBox.clientHeight>=logBox.scrollHeight-20;
    logBox.innerHTML=d.logs.map(l=>{
      const cls='log-'+l.level;
      return '<div class="'+cls+'">'+l.timestamp+' ['+l.level+'] '+l.message.replace(/</g,'&lt;')+'</div>';
    }).join('');
    if(wasAtBottom) logBox.scrollTop=logBox.scrollHeight;
  }catch(e){console.error(e);}
}
refresh();
setInterval(refresh,10000);
</script>
</body>
</html>`;

export function startWebServer() {
  const port = config.webPort;
  app.listen(port, () => {
    logger.info(`Web dashboard listening on port ${port}`);
  });
}

export default { startWebServer, setBotState, getBotState };
