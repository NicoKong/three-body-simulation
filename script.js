const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// 状态变量
let isRunning = false;
let speedMultiplier = 1.0; // 模拟速度乘数
let zoom = 1.0;            // 画面缩放比例

const G = 0.5; 
const softening = 5; 

class Body {
    constructor(x, y, vx, vy, mass, color, radius, id) {
        this.x = x; this.y = y;
        this.vx = vx; this.vy = vy;
        this.mass = mass; this.color = color;
        this.radius = radius; this.id = id;
        this.path = [];
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.shadowBlur = 15; // 就算放大，光晕效果依然保留
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
        ctx.shadowBlur = 0;
    }
}

let bodies = [];

function initBodies() {
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    bodies = [
        new Body(cx - 150, cy, 0, 1.5, 100, '#ff4d4d', 8, 0),
        new Body(cx + 150, cy, 0, -1.5, 100, '#4da6ff', 8, 1),
        new Body(cx, cy + 100, -1.5, 0, 100, '#ffcc00', 8, 2)
    ];
    updateUIFromData();
}

function updatePhysics() {
    // 动态时间步长：基础速度 * 用户调节的速度
    const currentDt = 0.1 * speedMultiplier; 

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

        if (Math.random() < 0.2) {
            bodies[i].path.push({x: bodies[i].x, y: bodies[i].y});
            if (bodies[i].path.length > 300) bodies[i].path.shift();
        }
    }
}

function drawPaths() {
    for (let i = 0; i < bodies.length; i++) {
        if(bodies[i].path.length === 0) continue;
        ctx.beginPath();
        ctx.moveTo(bodies[i].path[0].x, bodies[i].path[0].y);
        for (let p = 1; p < bodies[i].path.length; p++) {
            ctx.lineTo(bodies[i].path[p].x, bodies[i].path[p].y);
        }
        ctx.strokeStyle = bodies[i].color;
        // 保证放大缩小时，轨迹线条粗细在视觉上保持一致
        ctx.lineWidth = 1.5 / zoom; 
        ctx.globalAlpha = 0.6;
        ctx.stroke();
        ctx.globalAlpha = 1.0;
    }
}

function animate() {
    if (isRunning) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for(let step = 0; step < 5; step++) updatePhysics();
    } else {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // --- 核心：摄像机缩放矩阵 ---
    ctx.save();
    // 1. 将原点移到屏幕中心
    ctx.translate(canvas.width / 2, canvas.height / 2);
    // 2. 进行缩放
    ctx.scale(zoom, zoom);
    // 3. 将原点移回
    ctx.translate(-canvas.width / 2, -canvas.height / 2);

    drawPaths();
    for (let i = 0; i < bodies.length; i++) bodies[i].draw();

    ctx.restore(); // 恢复正常的画布状态
    // -------------------------

    requestAnimationFrame(animate);
}

/* ================== 交互逻辑 ================== */

const btnToggle = document.getElementById('btn-toggle');
const btnReset = document.getElementById('btn-reset');

btnToggle.addEventListener('click', () => {
    isRunning = !isRunning;
    if (isRunning) {
        btnToggle.textContent = "暂停模拟";
        btnToggle.className = "btn-pause";
    } else {
        btnToggle.textContent = "开始/继续";
        btnToggle.className = "btn-play";
    }
});

btnReset.addEventListener('click', () => {
    isRunning = false;
    btnToggle.textContent = "开始模拟";
    btnToggle.className = "btn-play";
    initBodies();
});

// 全局设置绑定
const speedSlider = document.getElementById('sim-speed');
const zoomSlider = document.getElementById('sim-zoom');
const speedVal = document.getElementById('speed-val');
const zoomVal = document.getElementById('zoom-val');

speedSlider.addEventListener('input', (e) => {
    speedMultiplier = Number(e.target.value);
    speedVal.textContent = speedMultiplier.toFixed(1);
});

// 监听缩放滑块
zoomSlider.addEventListener('input', (e) => {
    zoom = Number(e.target.value);
    zoomVal.textContent = zoom.toFixed(1);
});

// 监听鼠标滚轮进行缩放
canvas.addEventListener('wheel', (e) => {
    e.preventDefault(); // 防止网页跟着滚动
    if (e.deltaY < 0) {
        zoom *= 1.1; // 向上滚放大
    } else {
        zoom /= 1.1; // 向下滚缩小
    }
    // 限制缩放范围在 0.1x 到 5.0x 之间
    zoom = Math.max(0.1, Math.min(zoom, 5.0));
    
    // 同步更新UI滑块
    zoomSlider.value = zoom;
    zoomVal.textContent = zoom.toFixed(1);
}, { passive: false });

function setupUIBindings() {
    for (let i = 0; i < 3; i++) {
        const mSlider = document.getElementById(`m-${i}`);
        const rSlider = document.getElementById(`r-${i}`);
        mSlider.addEventListener('input', (e) => {
            bodies[i].mass = Number(e.target.value);
            document.getElementById(`m-val-${i}`).textContent = e.target.value;
        });
        rSlider.addEventListener('input', (e) => {
            bodies[i].radius = Number(e.target.value);
            document.getElementById(`r-val-${i}`).textContent = e.target.value;
        });
    }
}

function updateUIFromData() {
    for (let i = 0; i < 3; i++) {
        document.getElementById(`m-${i}`).value = bodies[i].mass;
        document.getElementById(`m-val-${i}`).textContent = bodies[i].mass;
        document.getElementById(`r-${i}`).value = bodies[i].radius;
        document.getElementById(`r-val-${i}`).textContent = bodies[i].radius;
    }
}

/* --- 鼠标拖拽核心逻辑 (加入缩放映射) --- */
let draggedBody = null;

// 将鼠标屏幕坐标系 转换为 缩放后的物理坐标系
function screenToWorld(x, y) {
    return {
        x: (x - canvas.width / 2) / zoom + canvas.width / 2,
        y: (y - canvas.height / 2) / zoom + canvas.height / 2
    };
}

canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    // 换算坐标
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    for (let i = bodies.length - 1; i >= 0; i--) {
        const b = bodies[i];
        const dx = worldPos.x - b.x;
        const dy = worldPos.y - b.y;
        // 判定范围也会随着缩放动态调整，保证点击手感
        const hitTolerance = 15 / zoom; 
        if (dx * dx + dy * dy <= (b.radius + hitTolerance) * (b.radius + hitTolerance)) {
            draggedBody = b;
            if(isRunning) btnToggle.click(); 
            b.path = [];
            b.vx = 0; b.vy = 0; 
            break;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);

    if (draggedBody) {
        draggedBody.x = worldPos.x;
        draggedBody.y = worldPos.y;
    } else {
        let hovering = false;
        for (let b of bodies) {
            const dx = worldPos.x - b.x;
            const dy = worldPos.y - b.y;
            const hitTolerance = 15 / zoom;
            if (dx * dx + dy * dy <= (b.radius + hitTolerance) * (b.radius + hitTolerance)) {
                hovering = true; break;
            }
        }
        canvas.style.cursor = hovering ? 'grab' : 'default';
    }
});

window.addEventListener('mouseup', () => {
    if(draggedBody) draggedBody = null;
});

// 启动
initBodies();
setupUIBindings();
animate();
