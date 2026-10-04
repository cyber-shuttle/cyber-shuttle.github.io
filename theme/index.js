// The Cybershuttle docs theme on top of the classic theme: audience and power-user switches, fixed and collapsible
// page and section panels, accent-driven colours and motion. Pages stay plain Markdown; see remark.js for the
// directives they may use.
const path = require('path');
const {headScript} = require('./settings');

module.exports = function cybershuttleTheme() {
  return {
    name: 'cybershuttle-theme',
    getThemePath: () => path.resolve(__dirname, 'components'),
    getClientModules: () => [path.resolve(__dirname, 'theme.css')],
    injectHtmlTags: () => ({
      headTags: [
        // Without it the dev server's shell gets its viewport only after hydration, and a phone zooms instead of reflowing.
        {tagName: 'meta', attributes: {name: 'viewport', content: 'width=device-width, initial-scale=1.0'}},
        {tagName: 'script', innerHTML: headScript},
        {
          tagName: 'link',
          attributes: {
            rel: 'stylesheet',
            href: 'https://fonts.googleapis.com/css2?family=Roboto+Serif:ital,opsz,wdth,wght@0,8..144,50..150,300..700;1,8..144,50..150,300..700&display=swap',
          },
        },
      ],
    }),
  };
};
