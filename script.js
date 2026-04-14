const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- 物理与渲染基础参数 ---
let isRunning = false;
let speedMultiplier = 1.0; 
let showAxes = true;
let pathMode = 'tail'; 

// 天文物理常数与单位转换
const G = 5000; 
const dt = 0.05; 
const softening = 5; 
const VISUAL_RADIUS_MULTI = 8; 
const AU_TO_RSUN = 215.0; // 1 天文单位(AU) 约等于 215 太阳半径(R⊙)

// --- 摄像机系统 ---
let camera = { x: 0, y: 0, zoom: 1.0 };

class Body {
    constructor(x, y, vx, vy, mass, color, radius, id) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.mass = mass;
        this.color = color;
        this.radius = radius;
        this.id = id;
        this.path = [];
    }

    draw() {
        const visualR = this.radius * VISUAL_RADIUS_MULTI;
        ctx.beginPath();
        ctx.arc(this.x, this.y, visualR, 0, Math.PI * 2);
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
        ctx.shadowBlur = 0;
    }
}

let bodies = [];

function initBodies() {
    camera = { x: 0, y: 0, zoom: 1.0 };
    // 初始距离 150 R⊙，大约 0.7 AU，在这个尺度下引力混沌效果最好
    bodies = [
        new Body(-150, 0, 0, 1.5, 1.0, '#ff4d4d', 1.0, 0),
        new Body(150, 0, 0, -1.5, 1.0, '#4da6ff', 1.0, 1),
        new Body(0, 100, -1.5, 0, 1.0, '#ffcc00', 1.0, 2)
    ];
    updateUIFromData();
}

function updatePhysics() {
    const currentDt = dt * speedMultiplier; 
    for (let i = 0; i < bodies.length; i++) {
        let fx = 0, fy = 0;
        for (let j = 0; j < bodies.length; j++) {
            if (i === j) continue;
            const dx = bodies[j].x - bodies[i].x;
            const dy = bodies[j].y - bodies[i].y;
            const distSq = dx * dx + dy * dy + softening;
            const dist = Math.sqrt(distSq);
            const force = (G * bodies[i].mass * bodies[j].mass) / distSq;
            fx += force * (dx / dist);
            fy += force * (dy / dist);
        }
        bodies[i].vx += (fx / bodies[i].mass) * currentDt;
        bodies[i].vy += (fy / bodies[i].mass) * currentDt;
    }

    for (let i = 0; i < bodies.length; i++) {
        bodies[i].x += bodies[i].vx * currentDt;
        bodies[i].y += bodies[i].vy * currentDt;
    }
}

function drawPaths() {
    if (pathMode === 'none') return;
    const baseWidth = 1.5 / camera.zoom;
    
    for (let i = 0; i < bodies.length; i++) {
        const path = bodies[i].path;
        if (path.length < 2) continue;

        if (pathMode === 'tail') {
            for (let p = 1; p < path.length; p++) {
                ctx.beginPath();
                ctx.moveTo(path[p-1].x, path[p-1].y);
                ctx.lineTo(path[p].x, path[p].y);
                ctx.strokeStyle = bodies[i].color;
                ctx.lineWidth = baseWidth;
                ctx.globalAlpha = p / path.length; 
                ctx.stroke();
            }
            ctx.globalAlpha = 1.0;
        } else if (pathMode === 'all') {
            ctx.beginPath();
            ctx.moveTo(path[0].x, path[0].y);
            for (let p = 1; p < path.length; p++) {
                ctx.lineTo(path[p].x, path[p].y);
            }
            ctx.strokeStyle = bodies[i].color;
            ctx.lineWidth = baseWidth;
            ctx.globalAlpha = 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
        }
    }
}

function drawAxes() {
    if (!showAxes) return;

    const left = camera.x - canvas.width / 2 / camera.zoom;
    const right = camera.x + canvas.width / 2 / camera.zoom;
    const top = camera.y - canvas.height / 2 / camera.zoom;
    const bottom = camera.y + canvas.height / 2 / camera.zoom;

    // 换算 AU (天文单位) 下的完美间隔刻度
    const targetIntervalAU = (120 / camera.zoom) / AU_TO_RSUN; 
    const log10 = Math.floor(Math.log10(targetIntervalAU));
    const pow10 = Math.pow(10, log10);
    const fraction = targetIntervalAU / pow10;
    
    let niceMultiplier = 1;
    if (fraction < 1.5) niceMultiplier = 1;
    else if (fraction < 3.5) niceMultiplier = 2;
    else if (fraction < 7.5) niceMultiplier = 5;
    else niceMultiplier = 10;
    
    const intervalAU = niceMultiplier * pow10;
    const intervalPhysical = intervalAU * AU_TO_RSUN;

    ctx.save();
    ctx.lineWidth = 1 / camera.zoom;
    ctx.font = `${13 / camera.zoom}px sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';

    // X轴 刻度线
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const startX = Math.ceil(left / intervalPhysical) * intervalPhysical;
    const labelY = bottom - 10 / camera.zoom; 
    
    for (let x = startX; x <= right; x += intervalPhysical) {
        ctx.beginPath();
        ctx.strokeStyle = Math.abs(x) < 0.001 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)';
        ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke();
        
        let text = Math.abs(x) < 0.001 ? "0 AU" : parseFloat((x / AU_TO_RSUN).toPrecision(4)).toString() + " AU";
        ctx.fillText(text, x, labelY);
    }

    // Y轴 刻度线
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const startY = Math.ceil(top / intervalPhysical) * intervalPhysical;
    const labelX = left + 10 / camera.zoom; 
    
    for (let y = startY; y <= bottom; y += intervalPhysical) {
        ctx.beginPath();
        ctx.strokeStyle = Math.abs(y) < 0.001 ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 0.1)';
        ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
        
        if (Math.abs(y) > 0.001) { 
            let text = parseFloat((y / AU_TO_RSUN).toPrecision(4)).toString() + " AU";
            ctx.fillText(text, labelX, y);
        }
    }
    ctx.restore();
}

function animate() {
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (isRunning) {
        for(let step = 0; step < 5; step++) updatePhysics();

        if (pathMode !== 'none') {
            for (let i = 0; i < bodies.length; i++) {
                bodies[i].path.push({x: bodies[i].x, y: bodies[i].y});
                if (pathMode === 'tail' && bodies[i].path.length > 200) {
                    bodies[i].path.shift();
                }
            }
        }
    }

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2); 
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y); 

    drawAxes();
    drawPaths();
    for (let i = 0; i < bodies.length; i++) bodies[i].draw();

    ctx.restore(); 
    requestAnimationFrame(animate);
}

/* ================== 坐标转换与交互逻辑 ================== */

function screenToWorld(sx, sy) {
    return {
        x: (sx - canvas.width / 2) / camera.zoom + camera.x,
        y: (sy - canvas.height / 2) / camera.zoom + camera.y
    };
}

let draggedBody = null;
let isDraggingCamera = false;
let lastMousePos = { x: 0, y: 0 };

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const worldPos = screenToWorld(sx, sy);
    lastMousePos = { x: sx, y: sy };

    for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i];
        const visualR = b.radius * VISUAL_RADIUS_MULTI;
        const hitTolerance = (visualR + 10) / camera.zoom; 
        
        if (Math.hypot(worldPos.x - b.x, worldPos.y - b.y) <= hitTolerance) {
            draggedBody = b;
            if(isRunning) btnToggle.click(); 
            b.path = []; b.vx = 0; b.vy = 0; 
            return;
        }
    }
    isDraggingCamera = true;
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (draggedBody) {
        const worldPos = screenToWorld(sx, sy);
        draggedBody.x = worldPos.x;
        draggedBody.y = worldPos.y;
    } else if (isDraggingCamera) {
        camera.x -= (sx - lastMousePos.x) / camera.zoom;
        camera.y -= (sy - lastMousePos.y) / camera.zoom;
        lastMousePos = { x: sx, y: sy };
    } else {
        const worldPos = screenToWorld(sx, sy);
        let hovering = bodies.some(b => 
            Math.hypot(worldPos.x - b.x, worldPos.y - b.y) <= (b.radius * VISUAL_RADIUS_MULTI + 10) / camera.zoom
        );
        canvas.style.cursor = hovering ? 'pointer' : (isDraggingCamera ? 'grabbing' : 'grab');
    }
});

window.addEventListener('mouseup', () => { draggedBody = null; isDraggingCamera = false; canvas.style.cursor = 'grab'; });

// 彻底放开视角缩放限制：允许缩小到 0.0001倍 (上帝视角)，放大到 20倍
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.zoom = Math.max(0.0001, Math.min(camera.zoom * (e.deltaY < 0 ? 1.1 : 1/1.1), 20.0));
}, { passive: false });

/* ================== UI 控制逻辑 ================== */

const btnToggle = document.getElementById('btn-toggle');
const btnReset = document.getElementById('btn-reset');
const panel = document.getElementById('ui-panel');
const btnCollapse = document.getElementById('btn-collapse');

btnCollapse.addEventListener('click', () => {
    panel.classList.toggle('collapsed');
    btnCollapse.textContent = panel.classList.contains('collapsed') ? '➕' : '➖';
});

btnToggle.addEventListener('click', () => {
    isRunning = !isRunning;
    btnToggle.textContent = isRunning ? "暂停模拟" : "开始/继续";
    btnToggle.className = isRunning ? "btn-pause" : "btn-play";
});

btnReset.addEventListener('click', () => {
    isRunning = false;
    btnToggle.textContent = "开始模拟";
    btnToggle.className = "btn-play";
    initBodies();
});

document.getElementById('show-axes').addEventListener('change', (e) => showAxes = e.target.checked);

document.getElementById('sim-speed').addEventListener('input', (e) => {
    speedMultiplier = Number(e.target.value);
    document.getElementById('speed-val').textContent = speedMultiplier.toFixed(1);
});

document.getElementById('path-mode').addEventListener('change', (e) => {
    pathMode = e.target.value;
    if (pathMode === 'none') bodies.forEach(b => b.path = []); 
    if (pathMode === 'tail') bodies.forEach(b => b.path = b.path.slice(-200)); 
});

function setupUIBindings() {
    for (let i = 0; i < 3; i++) {
        const mSlide = document.getElementById(`m-slide-${i}`);
        const mNum = document.getElementById(`m-num-${i}`);
        const rSlide = document.getElementById(`r-slide-${i}`);
        const rNum = document.getElementById(`r-num-${i}`);

        // 拖动滑块时更新输入框
        mSlide.addEventListener('input', (e) => { mNum.value = e.target.value; bodies[i].mass = Number(e.target.value); });
        rSlide.addEventListener('input', (e) => { rNum.value = e.target.value; bodies[i].radius = Number(e.target.value); });

        // 神奇特性：手动在输入框输入极大数值时，滑块的“上限”会自动扩容！
        mNum.addEventListener('input', (e) => {
            let val = Number(e.target.value);
            if(val > 0) { 
                if (val > Number(mSlide.max)) mSlide.max = val; // 动态扩展最大值
                mSlide.value = val; 
                bodies[i].mass = val; 
            }
        });
        rNum.addEventListener('input', (e) => {
            let val = Number(e.target.value);
            if(val > 0) { 
                if (val > Number(rSlide.max)) rSlide.max = val; // 动态扩展最大值
                rSlide.value = val; 
                bodies[i].radius = val; 
            }
        });
    }
}

function updateUIFromData() {
    for (let i = 0; i < 3; i++) {
        document.getElementById(`m-slide-${i}`).value = bodies[i].mass;
        document.getElementById(`m-num-${i}`).value = bodies[i].mass;
        document.getElementById(`r-slide-${i}`).value = bodies[i].radius;
        document.getElementById(`r-num-${i}`).value = bodies[i].radius;
    }
}

initBodies();
setupUIBindings();
animate();
