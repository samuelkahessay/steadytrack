const { join } = require('path');

/**
 * Puppeteer Configuration
 *
 * This config isolates the project's Puppeteer installation from the global MCP server.
 * It ensures that test automation and MCP web browsing don't interfere with each other.
 */
module.exports = {
  // Use project-local cache for Puppeteer, separate from MCP and global installations
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
