// middlewares/upload.js
const multer = require('multer');
const storage = multer.memoryStorage();

const uploadMahasiswa = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 } 
});

// Admin biasanya upload excel atau surat, kita kasih limit 5MB juga
const uploadAdmin = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = { uploadMahasiswa, uploadAdmin };