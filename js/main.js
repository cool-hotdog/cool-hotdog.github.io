// ========== 主题切换功能 ==========
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = themeToggle.querySelector('i');
const kimiToggle = document.getElementById('kimi-toggle');
const kimiIcon = kimiToggle.querySelector('i');

// 获取当前主题
function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
}

// 设置主题
function setTheme(theme) {
    if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeIcon.className = 'fas fa-sun';
        kimiIcon.className = 'fas fa-star';
        // 恢复默认光标
        document.body.style.cursor = 'auto';
        showCursorElements(false);
    } else if (theme === 'kimi') {
        document.documentElement.setAttribute('data-theme', 'kimi');
        themeIcon.className = 'fas fa-moon';
        kimiIcon.className = 'fas fa-star';
        // 隐藏默认光标，显示自定义光标
        document.body.style.cursor = 'none';
        showCursorElements(true);
    } else {
        document.documentElement.removeAttribute('data-theme');
        themeIcon.className = 'fas fa-moon';
        kimiIcon.className = 'fas fa-star';
        // 恢复默认光标
        document.body.style.cursor = 'auto';
        showCursorElements(false);
    }
    localStorage.setItem('theme', theme);
}

// 显示/隐藏自定义光标元素
function showCursorElements(show) {
    const halo = document.getElementById('cursor-halo');
    const dot = document.getElementById('cursor-dot');
    if (halo) halo.style.display = show ? 'block' : 'none';
    if (dot) dot.style.display = show ? 'block' : 'none';
}

// 切换亮/暗主题
function toggleTheme() {
    const currentTheme = getCurrentTheme();
    if (currentTheme === 'kimi') {
        setTheme('light');
    } else {
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }
}

// 切换 Kimi 主题
function toggleKimiTheme() {
    const currentTheme = getCurrentTheme();
    if (currentTheme === 'kimi') {
        setTheme('light');
    } else {
        setTheme('kimi');
    }
}

// 初始化主题
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        // 默认使用浅色主题
        setTheme('light');
    }
}

// 绑定切换事件
themeToggle.addEventListener('click', toggleTheme);
kimiToggle.addEventListener('click', toggleKimiTheme);

// 页面加载时初始化主题
initTheme();

// ========== 光晕鼠标效果（Kimi 主题） ==========
const cursorHalo = document.getElementById('cursor-halo');
const cursorDot = document.getElementById('cursor-dot');

let mouseX = 0, mouseY = 0;

// 鼠标移动处理函数
function handleMouseMove(e) {
    if (getCurrentTheme() !== 'kimi') return;
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (cursorHalo) {
        cursorHalo.style.left = mouseX + 'px';
        cursorHalo.style.top = mouseY + 'px';
    }
    if (cursorDot) {
        cursorDot.style.left = mouseX + 'px';
        cursorDot.style.top = mouseY + 'px';
    }
}

// 鼠标悬停处理
function handleMouseOver(e) {
    if (getCurrentTheme() !== 'kimi') return;
    const target = e.target;
    if (target.tagName === 'A' || target.tagName === 'BUTTON' || 
        target.closest('a') || target.closest('button')) {
        if (cursorHalo) cursorHalo.classList.add('active');
        if (cursorDot) cursorDot.classList.add('active');
    }
}

function handleMouseOut(e) {
    if (getCurrentTheme() !== 'kimi') return;
    const target = e.target;
    if (target.tagName === 'A' || target.tagName === 'BUTTON' ||
        target.closest('a') || target.closest('button')) {
        if (cursorHalo) cursorHalo.classList.remove('active');
        if (cursorDot) cursorDot.classList.remove('active');
    }
}

// 绑定鼠标事件
document.addEventListener('mousemove', handleMouseMove);
document.addEventListener('mouseover', handleMouseOver);
document.addEventListener('mouseout', handleMouseOut);

// 光晕呼吸动画循环（纯白色）- 使用 CSS 动画替代，移除 JS 循环避免性能问题
// 呼吸效果已通过 CSS animation 实现

// ========== 星空粒子动画（Kimi 主题） ==========
const canvas = document.getElementById('starfield');
const ctx = canvas.getContext('2d');
let stars = [];
let animationId = null;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function initStars() {
    stars = [];
    const starCount = Math.floor((canvas.width * canvas.height) / 8000);
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            opacity: Math.random() * 0.8 + 0.2,
            speed: Math.random() * 0.3 + 0.05,
            twinkleSpeed: Math.random() * 0.02 + 0.005,
            twinklePhase: Math.random() * Math.PI * 2,
        });
    }
}

function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const currentTheme = getCurrentTheme();
    if (currentTheme !== 'kimi') {
        // 非 Kimi 主题时清空画布
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        return;
    }
    
    const time = Date.now() * 0.001;
    
    stars.forEach(star => {
        const twinkle = Math.sin(time * star.twinkleSpeed + star.twinklePhase) * 0.3 + 0.7;
        const alpha = star.opacity * twinkle;
        
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
        
        // 缓慢移动（视差效果）
        star.y -= star.speed * 0.1;
        if (star.y < -5) {
            star.y = canvas.height + 5;
            star.x = Math.random() * canvas.width;
        }
    });
    
    animationId = requestAnimationFrame(drawStars);
}

// 监听主题变化以控制星空
const observer = new MutationObserver(() => {
    const theme = getCurrentTheme();
    if (theme === 'kimi') {
        canvas.style.display = 'block';
        if (!animationId) {
            resizeCanvas();
            initStars();
            drawStars();
        }
    } else {
        canvas.style.display = 'none';
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
    }
});

observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

// 窗口大小变化时重新初始化
window.addEventListener('resize', () => {
    if (getCurrentTheme() === 'kimi') {
        resizeCanvas();
        initStars();
    }
});

// 初始检查
if (getCurrentTheme() === 'kimi') {
    resizeCanvas();
    initStars();
    drawStars();
} else {
    canvas.style.display = 'none';
}

// ========== 平滑滚动 ==========
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ========== 导航栏滚动效果 ==========
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 2px 20px var(--shadow-color)';
    } else {
        navbar.style.boxShadow = 'none';
    }
});

// ========== 通过GitHub API自动获取项目数据 ==========
async function fetchGitHubProjects(username) {
    try {
        const response = await fetch(`https://api.github.com/users/${username}/repos?sort=updated&per_page=6`);
        const repos = await response.json();
        
        const container = document.getElementById('projects-container');
        container.innerHTML = repos.map(repo => `
            <div class="project-card">
                <div class="project-header">
                    <i class="fab fa-github project-icon"></i>
                    <div class="project-links">
                        <a href="${repo.html_url}" target="_blank" title="查看源码">
                            <i class="fas fa-code"></i>
                        </a>
                        ${repo.homepage ? `
                        <a href="${repo.homepage}" target="_blank" title="在线演示">
                            <i class="fas fa-external-link-alt"></i>
                        </a>` : ''}
                    </div>
                </div>
                <h3>${repo.name}</h3>
                <p class="project-desc">${repo.description || '暂无描述'}</p>
                <div class="project-tech">
                    ${repo.language ? `<span class="tech-tag">${repo.language}</span>` : ''}
                </div>
                <div class="project-stats">
                    <span><i class="fas fa-star"></i> ${repo.stargazers_count}</span>
                    <span><i class="fas fa-code-branch"></i> ${repo.forks_count}</span>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('获取GitHub项目失败:', error);
    }
}

// 取消下面这行的注释，替换为你的GitHub用户名即可自动获取项目
// fetchGitHubProjects('cool-hotdog');
