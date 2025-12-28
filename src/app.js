const express = require('express');
const app = express();
const port = 3000;

// Middleware untuk melayani file statis
app.use(express.static('public'));

// Route utama
app.get('/', (req, res) => {
  res.send('Hello World');
});

// Jalankan server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

