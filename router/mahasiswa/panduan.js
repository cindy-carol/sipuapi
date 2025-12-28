const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    // const isDataValid = true;
    res.render('mahasiswa/panduan', {
        role: 'Mahasiswa',

        nama: 'Cindy Carolline',
        npm: '2115061054',
    });
});


module.exports = router;
