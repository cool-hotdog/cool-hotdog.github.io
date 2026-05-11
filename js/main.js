// 平滑滚动
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// 导航栏滚动效果
window.addEventListener('scroll', () => {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 50) {
        navbar.style.boxShadow = '0 2px 20px rgba(0,0,0,0.3)';
    } else {
        navbar.style.boxShadow = 'none';
    }
});

// 可选：通过GitHub API自动获取项目数据
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
// fetchGitHubProjects('你的GitHub用户名');