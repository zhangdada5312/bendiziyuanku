// DOM 元素
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const movieNameInput = document.getElementById('movieName');
const movieTitleInput = document.getElementById('movieTitle');
const clearMovieNameBtn = document.getElementById('clearMovieName');
const uploadXlsxBtn = document.getElementById('uploadXlsx');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const submitBtn = document.getElementById('submitBtn');
const resourceGrid = document.getElementById('resourceGrid');
const titleList = document.getElementById('titleList');
const viewToggleButtons = document.querySelectorAll('.view-toggle button');
const toast = document.getElementById('toast');

// 全局变量
let currentView = 'images';
let currentPage = 1;
const itemsPerPage = 12;
let uploadedImages = [];

// 初始化
function initialize() {
    initializeEventListeners();
    loadResources();
}

// 初始化事件监听
function initializeEventListeners() {
    // 搜索功能
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleSearch();
    });

    // 清除影视名称
    clearMovieNameBtn.addEventListener('click', () => {
        movieNameInput.value = '';
        movieNameInput.focus();
    });

    // XLSX上传
    uploadXlsxBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.xlsx,.xls';
        input.onchange = handleXlsxUpload;
        input.click();
    });

    // 图片上传相关
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);
    document.addEventListener('paste', handlePaste);

    // 视图切换
    viewToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentView = button.dataset.view;
            viewToggleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            toggleView();
        });
    });

    // 表单提交
    submitBtn.addEventListener('click', handleSubmit);

    // 当输入标题时自动提取影视剧名称
    movieTitleInput.addEventListener('input', () => {
        if (!movieNameInput.value.trim()) {
            const titles = movieTitleInput.value.trim().split('\n');
            if (titles.length > 0) {
                const extractedName = extractMovieName(titles[0]);
                if (extractedName) {
                    movieNameInput.value = extractedName;
                }
            }
        }
    });
}

// 处理搜索
async function handleSearch() {
    const keyword = searchInput.value.trim();
    if (keyword) {
        currentPage = 1;
        await loadResources(keyword);
    }
}

// 处理XLSX上传
async function handleXlsxUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const formData = new FormData();
        formData.append('xlsx', file);
        
        const response = await fetch('/api/upload-xlsx', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) throw new Error('上传失败');

        const result = await response.json();
        showToast(`成功导入 ${result.titlesCount} 条数据`);
        
        // 重置到第一页并重新加载资源列表
        currentPage = 1;
        loadResources(searchInput.value.trim());
    } catch (error) {
        showToast('XLSX上传失败');
        console.error('XLSX上传错误:', error);
    }
}

// 处理拖拽上传
function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    handleFiles(files);
}

// 处理文件选择
function handleFileSelect(e) {
    handleFiles(e.target.files);
}

// 处理粘贴上传
function handlePaste(e) {
    const items = e.clipboardData.items;
    for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
            const file = item.getAsFile();
            handleFiles([file]);
        }
    }
}

// 处理文件上传
async function handleFiles(files) {
    const movieName = movieNameInput.value.trim();
    if (!movieName) {
        showToast('请先输入影视剧名称');
        movieNameInput.focus();
        return;
    }

    for (let file of files) {
        if (!file.type.startsWith('image/')) {
            showToast('只能上传图片文件');
            continue;
        }

        if (file.size > 10 * 1024 * 1024) {
            showToast('图片大小不能超过10MB');
            continue;
        }

        try {
            const compressedFile = await compressImage(file);
            uploadedImages.push({
                file: compressedFile,
                movieName: movieName
            });
            displayPreview(compressedFile, movieName);
        } catch (error) {
            showToast('图片处理失败');
            console.error('图片处理错误:', error);
        }
    }
}

// 图片压缩
async function compressImage(file) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;
                const maxSize = 1200;

                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        resolve(new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        }));
                    },
                    'image/jpeg',
                    0.8
                );
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// 显示图片预览
function displayPreview(file, movieName) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.createElement('div');
        preview.className = 'preview-item';
        preview.innerHTML = `
            <img src="${e.target.result}" alt="${movieName}">
            <div class="preview-info">
                <span>${movieName}</span>
            </div>
            <button class="remove-btn" onclick="removePreview(this)">×</button>
        `;
        dropZone.appendChild(preview);
    };
    reader.readAsDataURL(file);
}

// 移除预览图片
function removePreview(button) {
    const previewItem = button.parentElement;
    const index = Array.from(dropZone.children).indexOf(previewItem) - 2; // 减2是因为有两个提示文本
    uploadedImages.splice(index, 1);
    previewItem.remove();
}

// 从标题中提取影视剧名称
function extractMovieName(title) {
    const match = title.match(/《(.+?)》/);
    return match ? match[1] : '';
}

// 处理表单提交
async function handleSubmit() {
    const movieName = movieNameInput.value.trim();
    const titles = movieTitleInput.value.trim().split('\n').filter(Boolean);

    // 验证：如果有图片，必须有影视剧名称
    if (uploadedImages.length > 0 && !movieName) {
        showToast('上传图片时必须填写影视剧名称');
        movieNameInput.focus();
        return;
    }

    if (!movieName && !titles.length && !uploadedImages.length) {
        showToast('请至少输入影视名称、标题或上传图片');
        return;
    }

    try {
        const formData = new FormData();
        formData.append('movieName', movieName);
        formData.append('titles', JSON.stringify(titles));
        
        // 添加图片文件
        uploadedImages.forEach((item, index) => {
            formData.append('images', item.file);
        });

        const response = await fetch('/api/resources', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '上传失败');
        }

        const result = await response.json();
        showToast(`上传成功: ${result.imagesCount} 张图片, ${result.titlesCount} 个标题`);
        resetForm();
        // 重置到第一页并重新加载资源列表
        currentPage = 1;
        loadResources(searchInput.value.trim());
    } catch (error) {
        showToast(error.message || '上传失败，请重试');
        console.error('上传错误:', error);
    }
}

// 重置表单
function resetForm() {
    movieNameInput.value = '';
    movieTitleInput.value = '';
    uploadedImages = [];
    // 移除所有预览图片
    const previews = dropZone.querySelectorAll('.preview-item');
    previews.forEach(preview => preview.remove());
}

// 加载资源列表
async function loadResources(keyword = '') {
    try {
        const response = await fetch(`/api/resources?page=${currentPage}&limit=12&search=${keyword}&view=${currentView}`);
        if (!response.ok) throw new Error('加载失败');

        const { data, total } = await response.json();
        displayResources(data);
        updatePagination(total);
    } catch (error) {
        showToast('加载资源失败');
        console.error('加载错误:', error);
    }
}

// 显示资源
function displayResources(resources) {
    const container = currentView === 'images' ? resourceGrid : titleList;
    container.innerHTML = '';

    if (currentView === 'images') {
        resources.filter(resource => resource.imageUrl).forEach(resource => {
            const card = document.createElement('div');
            card.className = 'resource-card';
            
            // 构建完整的图片URL
            const imageUrl = resource.imageUrl.startsWith('http') 
                ? resource.imageUrl 
                : window.location.origin + resource.imageUrl;

            card.innerHTML = `
                <img src="${imageUrl}" alt="${resource.movieName || '未命名'}" loading="lazy" onerror="this.src='images/placeholder.png'">
                <div class="info">
                    <h3>${resource.movieName || '未命名'}</h3>
                </div>
            `;
            
            // 添加点击事件以复制图片
            card.addEventListener('click', () => copyImageToClipboard(imageUrl));
            container.appendChild(card);
        });
    } else {
        resources.forEach(resource => {
            if (resource.title) {
                const item = document.createElement('div');
                item.className = 'title-item';

                // 第一行：影视剧名称和观看次数
                const firstLine = document.createElement('div');
                firstLine.className = 'first-line';

                // 从标题中提取影视剧名称
                const match = resource.title.match(/《(.+?)》/);
                const movieName = match ? match[1] : 'undefined';

                const movieNameElem = document.createElement('div');
                movieNameElem.className = 'movie-name';
                movieNameElem.textContent = `《${movieName}》`;
                firstLine.appendChild(movieNameElem);

                const views = document.createElement('div');
                views.className = 'views';
                views.textContent = `${resource.views || 0}次观看`;
                firstLine.appendChild(views);

                // 第二行：标题和操作按钮
                const secondLine = document.createElement('div');
                secondLine.className = 'second-line';

                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = resource.title;
                secondLine.appendChild(title);

                const actions = document.createElement('div');
                actions.className = 'actions';

                // 复制标题按钮
                const copyTitleBtn = document.createElement('button');
                copyTitleBtn.className = 'copy-btn';
                copyTitleBtn.textContent = '复制标题';
                copyTitleBtn.onclick = (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(resource.title)
                        .then(() => showToast('标题已复制到剪贴板'))
                        .catch(() => showToast('复制失败'));
                };
                actions.appendChild(copyTitleBtn);

                // 复制片名按钮
                const copyNameBtn = document.createElement('button');
                copyNameBtn.className = 'copy-btn';
                copyNameBtn.textContent = '复制片名';
                copyNameBtn.onclick = (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(movieName)
                        .then(() => showToast('片名已复制到剪贴板'))
                        .catch(() => showToast('复制失败'));
                };
                actions.appendChild(copyNameBtn);

                secondLine.appendChild(actions);

                // 删除按钮
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '删除';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm('确定要删除这条记录吗？')) {
                        try {
                            const response = await fetch(`/api/resources/${resource.id}`, {
                                method: 'DELETE'
                            });
                            if (response.ok) {
                                item.remove();
                                showToast('删除成功');
                                // 删除后重新加载当前页
                                loadResources(searchInput.value.trim());
                            } else {
                                throw new Error('删除失败');
                            }
                        } catch (error) {
                            console.error('删除失败:', error);
                            showToast('删除失败');
                        }
                    }
                };

                // 组装所有元素
                item.appendChild(firstLine);
                item.appendChild(secondLine);
                item.appendChild(deleteBtn);
                container.appendChild(item);
            }
        });
    }
}

// 复制图片
async function copyImageToClipboard(imageUrl) {
    try {
        // 创建一个 canvas 来处理图片
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        // 使用 Promise 等待图片加载
        await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imageUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        
        // 将 canvas 转换为 blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve));
        
        // 写入剪贴板
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': blob
            })
        ]);
        
        showToast('图片已复制，可以直接粘贴使用');
    } catch (error) {
        console.error('复制失败:', error);
        showToast('复制失败，请尝试右键图片复制');
    }
}

// 切换视图
function toggleView() {
    if (currentView === 'images') {
        resourceGrid.style.display = 'grid';
        titleList.style.display = 'none';
    } else {
        resourceGrid.style.display = 'none';
        titleList.style.display = 'block';
    }
    // 切换视图时重置到第一页
    currentPage = 1;
    loadResources(searchInput.value.trim());
}

// 更新分页
function updatePagination(total) {
    const totalPages = Math.ceil(total / itemsPerPage);
    document.querySelector('.current-page').textContent = currentPage;
    
    const prevButton = document.querySelector('.prev-page');
    const nextButton = document.querySelector('.next-page');
    
    prevButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
    
    // 添加点击事件处理
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            loadResources(searchInput.value.trim());
        }
    };
    
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadResources(searchInput.value.trim());
        }
    };
}

// 显示提示信息
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 启动应用
initialize(); 