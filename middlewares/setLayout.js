function setLayout(req, res, next) {
  // default sidebar tampil
  res.locals.hideSidebar = false;

  // halaman-halaman tanpa sidebar
  const noSidebarPages = [
    '', 
    // tambah route lain sesuai kebutuhan
  ];

  if (noSidebarPages.includes(req.path)) {
    res.locals.hideSidebar = true;
  }

  // role tetap terbaca
  res.locals.role = req.session.user?.role || null;

  next();
}

module.exports = setLayout;
