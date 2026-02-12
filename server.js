import config from './src/config/index.js';
import app from './src/app.js';

const { port } = config;

app.listen(port, () => {
  console.log(`Food Finder API v2 running at http://localhost:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});
