import 'zone.js/dist/zone-node';
import './generated-config';

import { ngExpressEngine } from '@nguniversal/express-engine';
import * as express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as domino from 'domino';
import { createProxyMiddleware } from 'http-proxy-middleware';

import { join } from 'path';
import { AppServerModule } from './src/main.server';
import { APP_BASE_HREF } from '@angular/common';
import { existsSync } from 'fs';

const template = fs.readFileSync(path.join(__dirname, '../../mempool/browser/', 'index.html')).toString();

const win = domino.createWindow(template);

// @ts-ignore
win.__env = global.__env;

// @ts-ignore
win.matchMedia = () => {
  return {
    matches: true
  };
};

// @ts-ignore
win.setTimeout = (fn) => { fn(); };
win.document.body.scrollTo = (() => {});
// @ts-ignore
global['window'] = win;
global['document'] = win.document;
// @ts-ignore
global['history'] = { state: { } };

global['localStorage'] = {
  getItem: () => '',
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  length: 0,
  key: () => '',
};

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), 'dist/mempool/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html')) ? 'index.original.html' : 'index';

  // Our Universal express-engine (found @ https://github.com/angular/universal/tree/master/modules/express-engine)
  server.engine('html', ngExpressEngine({
    bootstrap: AppServerModule,
  }));

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Example Express Rest API endpoints
  // server.get('/api/**', (req, res) => { });
  // Serve static files from /browser
  server.get('*.*', express.static(distFolder, {
    maxAge: '1y'
  }));

  server.get('/api/v1/**', createProxyMiddleware({
    // @ts-ignore
    target: win.__env.BACKEND_ABSOLUTE_URL,
    changeOrigin: true,
   },
 ));

  server.get('/api/**', createProxyMiddleware({
     // @ts-ignore
     target: win.__env.ELECTRS_ABSOLUTE_URL_SERVER,
     changeOrigin: true,
     pathRewrite: {'^/api' : '/'}
    },
  ));

  // All regular routes use the Universal engine
  server.get('*', (req, res) => {
    res.render(indexHtml, { req, providers: [{ provide: APP_BASE_HREF, useValue: req.baseUrl }] });
  });

  return server;
}

function run(): void {
  const port = process.env.PORT || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on port ${port}`);
  });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export * from './src/main.server';