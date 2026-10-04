// Reader settings kept on <html data-*> and in localStorage; the first value of each is its default. The head script
// applies them before first paint, so CSS keyed on the attributes renders the right variant without a flash.
const settings = {audience: ['researcher', 'provider'], advanced: ['off', 'on'], toc: ['open', 'closed']};

const headScript = `(function(s){var d=document.documentElement.dataset,q=new URLSearchParams(location.search);for(var k in s){var v;try{v=q.get(k);if(s[k].indexOf(v)<0)v=localStorage.getItem('cs-'+k);else localStorage.setItem('cs-'+k,v)}catch(e){}d[k]=s[k].indexOf(v)<0?s[k][0]:v}})(${JSON.stringify(settings)});`;

module.exports = {settings, headScript};
