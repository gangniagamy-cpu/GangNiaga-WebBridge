const { spawn } = require('child_process');

const child = spawn('cmd.exe', ['/c', 'D:\\GangNiaga-WebBridge\\native-wrapper.bat']);

child.stdout.on('readable', () => {
  let chunk;
  while ((chunk = child.stdout.read()) !== null) {
    if (chunk.length >= 4) {
      const len = chunk.readUInt32LE(0);
      if (chunk.length >= 4 + len) {
        const msg = chunk.slice(4, 4 + len).toString('utf8');
        console.log('[From Daemon]', msg);
      }
    }
  }
});

child.stderr.on('data', (data) => console.error('[Daemon Log]', data.toString()));
child.on('close', (code) => console.log('Daemon exited with code', code));

// Send a test message
const payload = Buffer.from(JSON.stringify({ text: 'test' }), 'utf8');
const header = Buffer.alloc(4);
header.writeUInt32LE(payload.length, 0);
child.stdin.write(header);
child.stdin.write(payload);

// Let it run for 3 seconds then kill
setTimeout(() => {
  child.kill();
  console.log('Test completed successfully.');
}, 3000);
