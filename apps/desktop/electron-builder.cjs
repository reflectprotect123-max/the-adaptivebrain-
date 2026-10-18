const { build } = require('./package.json');
const assets = require('./coach-assets.json');
module.exports = {
  ...build,
  extraResources: [{ from: '../coach', to: 'coach', filter: assets }],
};
