const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

const art = `
██████╗  █████╗ ██╗███╗   ██╗
██╔══██╗██╔══██╗██║████╗  ██║
██████╔╝███████║██║██╔██╗ ██║
██╔═══╝ ██╔══██║██║██║╚██╗██║
██║     ██║  ██║██║██║ ╚████║
╚═╝     ╚═╝  ╚═╝╚═╝╚═╝  ╚═══╝
    WELCOME TO THE PRODIGY
`;

console.log('\x1b[31m%s\x1b[0m', art); // Print in red

function runProcess(name, command, args, cwd) {
  const isWindows = os.platform() === 'win32';
  
  // Use shell on Windows so npm/code commands resolve properly through the command prompt
  const proc = spawn(command, args, { 
    cwd, 
    stdio: 'pipe',
    shell: isWindows 
  });

  proc.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) console.log(`[\x1b[36m${name}\x1b[0m] ${line}`);
    });
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) console.error(`[\x1b[31m${name}\x1b[0m] ${line}`);
    });
  });

  proc.on('close', (code) => {
    console.log(`[\x1b[33mSystem\x1b[0m] ${name} exited with code ${code}`);
  });

  return proc;
}

const rootDir = __dirname;

// 1. Start Vercel Brain
console.log('Booting Vercel Brain...');
runProcess('Brain', 'npm', ['run', 'dev'], path.join(rootDir, 'vercel-brain'));

// 2. Start Desktop Overlay
console.log('Booting Desktop Overlay...');
runProcess('Overlay', 'npm', ['run', 'dev'], path.join(rootDir, 'desktop-overlay'));

// 3. Launch VS Code Sensor automatically after a slight delay
setTimeout(() => {
  console.log('Injecting VS Code Sensor...');
  const sensorPath = path.join(rootDir, 'vscode-sensor');
  runProcess('Sensor', 'code', ['--extensionDevelopmentPath=' + sensorPath], sensorPath);
}, 3000);
