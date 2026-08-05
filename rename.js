const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function replaceInFile(filePath) {
  if (filePath.includes('node_modules') || filePath.includes('.next') || filePath.match(/\.(png|ico|jpg|jpeg|gif|webp|mp4|webm)$/i)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content.replace(/FlowBridge/g, 'FlowDoverz').replace(/flowbridge/g, 'flowdoverz');
  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log('Updated ' + filePath);
  }
}

walkDir(path.join(__dirname, 'src'), replaceInFile);
walkDir(path.join(__dirname, 'extension'), replaceInFile);
walkDir(path.join(__dirname, 'public'), replaceInFile);
console.log('Done renaming.');
