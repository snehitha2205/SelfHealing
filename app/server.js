const express = require('express');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);

const app = express();

app.use(express.static(publicDir));

app.get('/health', (_req, res) => {
  res.json({ ok: true, status: 'running' });
});

app.listen(port, () => {
  console.log(`[TEST] Todo app listening on http://localhost:${port}`);
});
