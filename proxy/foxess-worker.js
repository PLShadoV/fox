export default {
  async fetch(req, env) {
    const url = new URL(req.url)
    if (url.pathname === '/energy/hourly') {
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const sn = url.searchParams.get('sn')
      // TODO: implement FoxESS Cloud fetch using env secrets and map to JSON format expected by the app
      const start = new Date(from)
      const rows = []
      for (let i=0;i<24;i++){ const t=new Date(start); t.setHours(start.getHours()+i); rows.push({ timestamp: t.toISOString(), exported_kwh: Math.round(Math.random()*2000)/1000 }) }
      return new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } })
    }
    return new Response('Not found', { status: 404 })
  }
}
