const https = require('https');

const req = https.request('https://integrate.api.nvidia.com/v1/models', {
  method: 'GET'
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log(body));
});
req.on('error', console.error);
req.end();
