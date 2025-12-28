const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const port = 3000;

app.use(express.static('public'));
// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static('public')); // untuk akses CSS, JS, dll

// Setup multer (penyimpanan file)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // folder tujuan
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // nama file
  }
});
const upload = multer({ storage: storage });

// Halaman utama
app.get('/', (req, res) => {
  res.render('index', {
    nama: 'Cindy Carolline',
    npm: '2115061054'
  });
});

// Upload route
app.post('/upload', upload.fields([
  { name: 'berkas1' },
  { name: 'berkas2' },
  { name: 'berkas3' }
]), (req, res) => {
  console.log('Files uploaded:', req.files);
  res.send('Upload berhasil!');
});

// Mulai server
app.listen(port, () => {
  console.log(`Server jalan di http://localhost:${port}`);
});
