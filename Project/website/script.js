const $ = id => document.getElementById(id);
const processData = [
  {name:'systemd',pid:1,user:'root',cpu:1.2,mem:0.4,status:'Running',icon:'⚙'},
  {name:'gnome-shell',pid:1824,user:'goutham',cpu:8.6,mem:5.8,status:'Running',icon:'▣'},
  {name:'firefox',pid:2410,user:'goutham',cpu:12.4,mem:14.2,status:'Running',icon:'◉'},
  {name:'code',pid:3188,user:'goutham',cpu:6.1,mem:8.3,status:'Running',icon:'⌘'},
  {name:'NetworkManager',pid:792,user:'root',cpu:0.8,mem:1.1,status:'Running',icon:'⌁'},
  {name:'pipewire',pid:1112,user:'goutham',cpu:1.4,mem:1.8,status:'Sleeping',icon:'♫'},
  {name:'dbus-daemon',pid:824,user:'messagebus',cpu:0.3,mem:0.6,status:'Sleeping',icon:'◇'},
  {name:'bash',pid:4201,user:'goutham',cpu:0.5,mem:0.3,status:'Running',icon:'›'}
];
let cpu=24, mem=58, disk=42;
const cpuHistory=Array.from({length:24},(_,i)=>22+Math.round(Math.sin(i*.7)*9+Math.random()*5));
const memHistory=Array.from({length:24},()=>54+Math.round(Math.random()*8));
function statusFor(v){return v>80?'High':v>60?'Moderate':'Normal'}
function updateUI(){
  $('cpuValue').textContent=cpu;$('memValue').textContent=mem;$('diskValue').textContent=disk;
  $('cpuBar').style.width=cpu+'%';$('memBar').style.width=mem+'%';$('diskBar').style.width=disk+'%';
  $('memUsed').textContent=(16*mem/100).toFixed(1);
  $('cpuState').textContent=statusFor(cpu);$('healthCpu').textContent=statusFor(cpu);
  $('healthMem').textContent=statusFor(mem);$('cpuPageValue').textContent=cpu;
  $('cpuPageBar').style.width=cpu+'%';$('cpuPageState').textContent=statusFor(cpu);
  $('memoryUsedPage').textContent=(16*mem/100).toFixed(1);
  $('memoryFreePage').textContent=(16-16*mem/100).toFixed(1);
  $('memoryPercent').textContent=mem+'%';$('memoryTrack').style.width=mem+'%';
  $('lastUpdated').textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'});
}
function row(p){return `<tr><td><div class="proc-name"><span class="proc-icon">${p.icon}</span>${p.name}</div></td><td>${p.pid}</td><td>${p.user}</td><td>${p.cpu.toFixed(1)}%</td><td>${p.mem.toFixed(1)}%</td><td><span class="status-tag ${p.status==='Sleeping'?'sleep':''}">${p.status}</span></td></tr>`}
function renderProcesses(){
  const query=($('processSearch')?.value||'').toLowerCase();
  const filtered=processData.filter(p=>p.name.toLowerCase().includes(query)||p.user.toLowerCase().includes(query)||String(p.pid).includes(query));
  $('allProcesses').innerHTML=filtered.map(row).join('');
  $('topProcesses').innerHTML=[...processData].sort((a,b)=>b.cpu-a.cpu).slice(0,4).map(row).join('');
  $('processCount').textContent=filtered.length+' processes';
}
function drawChart(canvasId, datasets, labels){
  const canvas=$(canvasId);if(!canvas)return;
  const rect=canvas.getBoundingClientRect(),dpr=window.devicePixelRatio||1;
  canvas.width=Math.max(300,rect.width*dpr);canvas.height=Math.max(140,rect.height*dpr);
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const w=rect.width,h=rect.height,pad={l:30,r:8,t:10,b:24},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  ctx.clearRect(0,0,w,h);ctx.font='9px DM Sans';ctx.fillStyle='#a0a1b0';ctx.strokeStyle='#eeeef4';ctx.lineWidth=1;
  [0,25,50,75,100].forEach(v=>{let y=pad.t+ch*(1-v/100);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(v+'%',2,y+3)});
  for(let i=0;i<6;i++){let x=pad.l+cw*i/5;ctx.fillText(labels[i]||'',x-9,h-5)}
  datasets.forEach(ds=>{ctx.beginPath();ds.values.forEach((v,i)=>{let x=pad.l+cw*i/(ds.values.length-1),y=pad.t+ch*(1-v/100);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.strokeStyle=ds.color;ctx.lineWidth=2.3;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke();let last=ds.values.length-1;ctx.beginPath();ctx.arc(pad.l+cw,pad.t+ch*(1-ds.values[last]/100),3.5,0,Math.PI*2);ctx.fillStyle=ds.color;ctx.fill()});
}
function renderCharts(){
 const labels=['-60s','-50s','-40s','-30s','-20s','Now'];
 drawChart('resourceChart',[{values:cpuHistory,color:'#8067e8'},{values:memHistory,color:'#4d8de8'}],labels);
 drawChart('cpuChart',[{values:cpuHistory,color:'#8067e8'}],labels);
}
function refresh(){
 cpu=Math.max(5,Math.min(96,cpu+Math.round((Math.random()-.48)*13)));
 mem=Math.max(35,Math.min(85,mem+Math.round((Math.random()-.5)*5)));
 cpuHistory.push(cpu);cpuHistory.shift();memHistory.push(mem);memHistory.shift();
 updateUI();renderCharts();
}
function navigate(){
 const id=location.hash.replace('#','')||'dashboard';
 document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active-page',p.id===id));
 document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active',a.dataset.page===id));
 const active=document.querySelector(`.nav-link[data-page="${id}"]`);
 $('pageName').textContent=active?active.textContent.trim():'Overview';
 $('sidebar').classList.remove('open');
 setTimeout(renderCharts,60);
}
document.querySelectorAll('.nav-link').forEach(a=>a.addEventListener('click',()=>{if(location.hash===a.getAttribute('href'))navigate()}));
window.addEventListener('hashchange',navigate);
$('refreshBtn').addEventListener('click',refresh);
$('processSearch').addEventListener('input',renderProcesses);
$('menuBtn').addEventListener('click',()=>$('sidebar').classList.toggle('open'));
window.addEventListener('resize',renderCharts);
updateUI();renderProcesses();navigate();renderCharts();
setInterval(refresh,5000);
