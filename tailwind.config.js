module.exports = {
  content: ['./public/index.html', './public/js/**/*.js'],
  corePlugins: { preflight: false },   // the app has its own base styles
  theme: { extend: {} },
};
