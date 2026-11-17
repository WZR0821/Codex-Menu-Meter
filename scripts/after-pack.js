const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;

  await execFileAsync('xattr', ['-cr', context.appOutDir]);
};
