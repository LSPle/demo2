const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  // API代理
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
      secure: false,
      ws: true,
      logLevel: 'silent'
    })
  );
  
  // Socket.IO代理
  app.use(
    '/socket.io',
    createProxyMiddleware({
      target: 'http://localhost:5001',
      changeOrigin: true,
      secure: false,
      ws: true,
      logLevel: 'silent'
    })
  );
};