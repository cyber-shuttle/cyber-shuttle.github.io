// Markdown directives for audience-specific and power-user content, and status badges:
//   ::::researcher / ::::provider   shown to one audience
//   :::advanced                     shown with the Power user switch on (always to providers); `:advanced` in a table
//                                   row marks the row
//   :status[available|development|planned]
// Headings inside a block get an id prefixed r-, p- or a- so the page outline can follow the same switches.
// A table cell holding a short phrase is marked `nowrap`, so its column is never squeezed below the phrase;
// only long inline code in a cell may break mid-token. Screenshots are captured at 2x and shown at half their pixel size;
// `-light` and `-dark` variants follow the colour mode.
const {slug} = require('github-slugger');
const {readFileSync} = require('node:fs');
const path = require('node:path');

const prefixes = {researcher: 'r-', provider: 'p-', advanced: 'a-'};
const statuses = {available: 'Available', development: 'Ongoing', planned: 'Planned'};

const text = (node) => node.value ?? (node.children ?? []).map(text).join('');

function mark(node, prefix) {
  for (const child of node.children ?? []) {
    let inner = prefix;
    if (child.type.endsWith('Directive') && child.name in prefixes) {
      if (child.type === 'containerDirective') inner += prefixes[child.name];
      child.data = {hName: child.type === 'textDirective' ? 'span' : 'div', hProperties: {className: [child.name === 'advanced' ? 'advanced' : `audience audience--${child.name}`]}};
    } else if (child.type === 'textDirective' && child.name === 'status') {
      const key = text(child);
      child.data = {hName: 'span', hProperties: {className: ['status', `status--${key}`]}};
      child.children = [{type: 'text', value: statuses[key] ?? key}];
    } else if (child.type === 'tableCell') {
      if (text(child).length <= 32) child.data = {...child.data, hProperties: {...child.data?.hProperties, className: ['nowrap']}};
      for (const code of child.children) if (code.type === 'inlineCode' && code.value.length > 30) code.data = {hProperties: {className: ['long']}};
    } else if (child.type === 'image' && child.url.startsWith('/img/screenshots/')) {
      const png = readFileSync(path.join(__dirname, '..', 'static', child.url));
      const theme = child.url.match(/-(light|dark)\.png$/)?.[1];
      const attrs = {src: child.url, alt: child.alt, width: String(png.readUInt32BE(16) / 2), height: String(png.readUInt32BE(20) / 2), loading: 'lazy', className: `screenshot${theme ? ` screenshot--${theme}` : ''}`};
      Object.assign(child, {type: 'mdxJsxTextElement', name: 'img', children: [], attributes: Object.entries(attrs).map(([name, value]) => ({type: 'mdxJsxAttribute', name, value}))});
    } else if (child.type === 'heading' && prefix) {
      child.data = {...child.data, hProperties: {...child.data?.hProperties, id: prefix + slug(text(child))}};
    }
    mark(child, inner);
  }
}

module.exports = () => (tree) => mark(tree, '');
