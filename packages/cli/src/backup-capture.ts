/** Keep the app's committed records and immutable uploads together during capture. */
export const CAPTURE_MS = 30_000;

const WORKER = String.raw`
const {workerData}=require('node:worker_threads');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const D=require('better-sqlite3');
function hashFile(file){
  const fd=fs.openSync(file,'r');
  try{const hash=crypto.createHash('sha256'),buffer=Buffer.allocUnsafe(64*1024);let n;
    while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0)hash.update(buffer.subarray(0,n));
    return hash.digest('hex');
  }finally{fs.closeSync(fd);}
}
const {from,to,uploads,toUploads}=workerData;
fs.mkdirSync(path.dirname(to),{recursive:true});
const lock=new D(from,{timeout:5000});
let held=false;
try {
  lock.exec('BEGIN IMMEDIATE');held=true;
  const reader=new D(from,{readonly:true});
  try {reader.exec("VACUUM INTO '"+to.replace(/'/g,"''")+"'");}
  finally {reader.close();}
  let source;
  try {source=fs.lstatSync(uploads);}catch(error){if(error.code!=='ENOENT')throw error;}
  if(source){
    if(!source.isDirectory()||source.isSymbolicLink())throw new Error('Uploads must be a real directory.');
    fs.cpSync(uploads,toUploads,{recursive:true});
    for(const relative of fs.readdirSync(toUploads,{recursive:true,encoding:'utf8'})){
      const file=path.join(toUploads,relative),stat=fs.lstatSync(file);
      if(stat.isSymbolicLink()||(!stat.isFile()&&!stat.isDirectory()))throw new Error('Uploads contain an unsupported link or special file.');
      if(!stat.isFile())continue;
      const contentName=/^([a-f0-9]{24})\.[a-z0-9]+$/.exec(path.basename(relative));
      if(contentName&&hashFile(file).slice(0,24)!==contentName[1])
        throw new Error('Upload content changed during capture: '+relative);
    }
  }
} finally {
  try {if(held)lock.exec('ROLLBACK');}
  finally {lock.close();}
}
`;

/** Node runs this in the app's dependency directory, including in a distroless container.
 * The parent stays responsive while native SQLite/file work runs in a worker. Its deadline
 * terminates the whole process, releasing the writer hold even if the worker is blocked. */
export function captureProgram(options: {
  from: string;
  to: string;
  uploads: string;
  toUploads: string;
  timeoutMs?: number;
  control?: string;
  token?: string;
}): string {
  const { timeoutMs = CAPTURE_MS, ...paths } = options;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > CAPTURE_MS)
    throw new Error("Invalid backup capture deadline.");
  if (options.control && !options.token) throw new Error("Capture control requires its token.");
  return `const {Worker}=require("node:worker_threads");
const config=${JSON.stringify(paths)};
if(config.control){
  const fs=require("node:fs"),path=require("node:path");
  fs.mkdirSync(path.dirname(config.control),{recursive:true});
  if(fs.existsSync(config.control+".cancel"))process.exit(125);
  const stat=fs.readFileSync("/proc/self/stat","utf8");
  const start=stat.slice(stat.lastIndexOf(")")+2).trim().split(/\\s+/)[19];
  const pending=config.control+".tmp";
  fs.writeFileSync(pending,JSON.stringify({pid:process.pid,start,token:config.token,group:fs.readFileSync("/proc/self/cgroup","utf8")} ),{flag:"wx",mode:0o600});
  try{fs.linkSync(pending,config.control);}finally{fs.unlinkSync(pending);}
  if(fs.existsSync(config.control+".cancel"))process.exit(125);
}
const worker=new Worker(${JSON.stringify(WORKER)},{eval:true,workerData:${JSON.stringify(paths)}});
const deadline=setTimeout(()=>{console.error("Capture exceeded its write-pause deadline.");process.kill(process.pid,"SIGKILL")},${timeoutMs});
worker.on("error",error=>{clearTimeout(deadline);console.error(error.message);process.exit(1)});
worker.on("exit",code=>{clearTimeout(deadline);if(code!==0)process.exit(code)});`;
}

/** Fence a delayed exec, stop only the matching helper process, and confirm it exited.
 * An unstarted helper leaves a tiny cancellation fence so a late exec cannot create staging. */
export function stopCaptureProgram(control: string, token: string): string {
  return `// capture-control-stop-v1
const fs=require("node:fs"),path=require("node:path");
const control=${JSON.stringify(control)},token=${JSON.stringify(token)};
fs.mkdirSync(path.dirname(control),{recursive:true});
try{fs.writeFileSync(control+".cancel",token,{flag:"wx",mode:0o600})}catch(e){if(e.code!=="EEXIST")throw e;}
function identity(pid){
  try{const raw=fs.readFileSync("/proc/"+pid+"/stat","utf8"),parts=raw.slice(raw.lastIndexOf(")")+2).trim().split(/\\s+/);
    return {start:parts[19],state:parts[0],command:fs.readFileSync("/proc/"+pid+"/cmdline","utf8"),group:fs.readFileSync("/proc/"+pid+"/cgroup","utf8")};
  }catch(e){if(e.code==="ENOENT"||e.code==="ESRCH")return undefined;throw e;}
}
if(!fs.existsSync(control)){console.log("pending");process.exit(0);}
if(!fs.lstatSync(control).isFile()||fs.statSync(control).size>4096)throw new Error("Invalid capture control file");
const record=JSON.parse(fs.readFileSync(control,"utf8"));
if(!Number.isSafeInteger(record.pid)||record.pid<2||record.token!==token||typeof record.start!=="string"||typeof record.group!=="string"||!/^\\d+$/.test(record.start))throw new Error("Invalid capture identity");
let current=identity(record.pid);
if(current&&current.start===record.start&&current.state!=="Z"){
  if(!current.command.includes(token)||current.group!==record.group||record.group!==fs.readFileSync("/proc/self/cgroup","utf8"))throw new Error("Capture identity changed");
  try{process.kill(record.pid,"SIGKILL")}catch(e){if(e.code!=="ESRCH")throw e;}
  const deadline=Date.now()+5000;
  while((current=identity(record.pid))&&current.start===record.start&&current.state!=="Z"){
    if(Date.now()>deadline)throw new Error("Capture exit could not be confirmed");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
  }
}
console.log("finished");`;
}
