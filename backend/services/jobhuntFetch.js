const dns = require('node:dns').promises;
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
function isPublicAddress(address) {
  const a = address.toLowerCase();
  if (net.isIP(a) === 4) {
    const [x,y] = a.split('.').map(Number);
    return !(x === 0 || x === 10 || x === 127 || x >= 224 || (x === 169 && y === 254) ||
      (x === 172 && y >= 16 && y <= 31) || (x === 192 && (y === 168 || y === 0)) ||
      (x === 100 && y >= 64 && y <= 127) || (x === 198 && (y === 18 || y === 19)));
  }
  // Only global-unicast IPv6; mapped IPv4, local, multicast and documentation ranges excluded.
  return net.isIP(a) === 6 && /^[23]/.test(a) && !a.startsWith('2001:db8:');
}
async function resolvePublicUrl(input) {
  const url = new URL(input);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Use a public HTTP(S) posting URL without credentials.');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host) ? [{address:host,family:net.isIP(host)}] : await dns.lookup(host,{all:true});
  if (!addresses.length || addresses.some(x=>!isPublicAddress(x.address))) throw new Error('Private or internal posting URLs are not allowed.');
  return {url, addresses};
}
async function fetchPublic(input, options = {}, depth = 0) {
  if (depth > 4) throw new Error('Too many posting redirects.');
  const {url,addresses} = await resolvePublicUrl(input);
  if (options.signal?.aborted) throw new Error('Posting fetch cancelled.');
  const result = await new Promise((resolve,reject)=>{
    const request = (url.protocol === 'https:' ? https : http).request(url, {
      method: options.method || 'GET', headers: options.headers || {}, signal: options.signal,
      timeout: 15000, rejectUnauthorized: true,
      lookup(_host, opts, cb) { if(opts.all) cb(null,addresses); else cb(null,addresses[0].address,addresses[0].family); }
    }, response=>{
      const chunks=[];let size=0;
      response.on('data',chunk=>{size+=chunk.length;if(size>10*1024*1024){request.destroy(new Error('Posting exceeds 10 MB limit.'));}else chunks.push(chunk);});
      response.on('error',reject);
      response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks)}));
    });
    request.on('timeout',()=>request.destroy(new Error('Posting request timed out.')));
    request.on('error',reject);
    if(options.body) request.write(options.body);
    request.end();
  });
  if ([301,302,303,307,308].includes(result.status) && result.headers.location) {
    const next = new URL(result.headers.location,url);
    const headers = {...options.headers};
    if(next.origin!==url.origin){delete headers.Authorization;delete headers.authorization;delete headers.Cookie;delete headers.cookie;}
    return fetchPublic(next.href,{...options,headers,...(result.status===303?{method:'GET',body:undefined}:{})},depth+1);
  }
  return {status:result.status,ok:result.status>=200&&result.status<300,url:url.href,
    headers:{get:key=>result.headers[key.toLowerCase()] || null},
    text:async()=>result.body.toString('utf8'),json:async()=>JSON.parse(result.body.toString('utf8')),
    arrayBuffer:async()=>result.body.buffer.slice(result.body.byteOffset,result.body.byteOffset+result.body.byteLength)};
}
module.exports={fetchPublic,isPublicAddress,resolvePublicUrl};
