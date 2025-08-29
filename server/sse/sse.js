const sseClients = new Set();

function addClient(res) { sseClients.add(res); }
function removeClient(res) { sseClients.delete(res); }

function broadcast(payload) {
  const s = typeof payload === 'string' ? payload : JSON.stringify(payload);
  for (const res of sseClients) {
    try { res.write(`data: ${s}\n\n`); } catch (e) { /* ignore */ }
  }
}

module.exports = { sseClients, addClient, removeClient, broadcast };
