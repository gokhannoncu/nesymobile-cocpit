/**
 * LAN-only HTTP CONNECT proxy for Nesy / corporate hosts.
 * Other internet traffic must stay DIRECT — do not set https_proxy globally.
 *
 * Windows:  node scripts/lan-vpn-proxy.mjs   (also started by pnpm dev/prod)
 * Mac PAC:  http://<windows-lan-ip>:8888/proxy.pac
 */
import http from 'node:http'
import net from 'node:net'
import {
  buildPac,
  getPacUrl,
  getProxyAddr,
  getProxyPort,
  isAllowedConnectPort,
  isAllowedHost,
} from './nesy-lan-proxy-config.mjs'

const PORT = getProxyPort()
const HOST = process.env.LAN_PROXY_HOST ?? '0.0.0.0'
const PAC = buildPac()
const PAC_URL = getPacUrl()
const PROXY = getProxyAddr()

const server = http.createServer((req, res) => {
  const path = req.url ?? '/'
  if (path === '/proxy.pac' || path === '/wpad.dat') {
    res.writeHead(200, {
      'Content-Type': 'application/x-ns-proxy-autoconfig',
      'Cache-Control': 'no-cache',
    })
    res.end(PAC)
    return
  }

  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(
    [
      'Nesy LAN proxy — only Nesy / 10.x hosts.',
      '',
      `PAC:  ${PAC_URL}`,
      'Mac: Automatic Proxy Configuration only — do not set https_proxy',
      '',
    ].join('\n'),
  )
})

server.on('connect', (req, clientSocket, head) => {
  const [hostname, portText] = (req.url ?? '').split(':')
  const port = Number(portText || 443)

  if (!hostname || !isAllowedConnectPort(port) || !isAllowedHost(hostname)) {
    console.error(`[proxy] blocked ${req.url}`)
    clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
    return
  }

  const upstream = net.connect(port, hostname, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head.length) upstream.write(head)
    upstream.pipe(clientSocket)
    clientSocket.pipe(upstream)
  })

  const fail = (err) => {
    console.error(`[proxy] ${hostname}:${port} ${err.message}`)
    if (!clientSocket.destroyed) clientSocket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    upstream.destroy()
  }

  upstream.on('error', fail)
  clientSocket.on('error', () => upstream.destroy())
})

server.listen(PORT, HOST, () => {
  console.log(`PAC:    ${PAC_URL}`)
  console.log(`Proxy:  ${PROXY}  (Nesy hosts + 10.x only)`)
})
