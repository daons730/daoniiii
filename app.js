/**
 * 국립한국해양대학교 (KMOU) 스마트 문서 압축 & 사진 변환 웹 앱
 */

// Application State
let activeTab = 'compress'; // 'compress' | 'image'
let fileList = [];
let imageList = [];
let generatedBlob = null;
let currentOutputFileName = '';
let processedImageBlobs = [];
let selectedDirHandle = null;

// DOM Elements - Tabs
const tabBtnCompress = document.getElementById('tabBtnCompress');
const tabBtnImage = document.getElementById('tabBtnImage');
const tabContentCompress = document.getElementById('tabContentCompress');
const tabContentImage = document.getElementById('tabContentImage');

// DOM Elements - Document Compress Tab
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const folderInput = document.getElementById('folderInput');
const btnSelectFiles = document.getElementById('btnSelectFiles');
const btnSelectFolder = document.getElementById('btnSelectFolder');
const fileListSection = document.getElementById('fileListSection');
const fileItemsContainer = document.getElementById('fileItemsContainer');
const totalFileCount = document.getElementById('totalFileCount');
const totalFileSize = document.getElementById('totalFileSize');
const btnClearAll = document.getElementById('btnClearAll');
const outputFileNameInput = document.getElementById('outputFileName');
const compressionLevelSelect = document.getElementById('compressionLevel');
const btnPickDocFolder = document.getElementById('btnPickDocFolder');
const docSelectedPathText = document.getElementById('docSelectedPathText');
const btnStartCompress = document.getElementById('btnStartCompress');

// DOM Elements - Image Tab
const imgDropZone = document.getElementById('imgDropZone');
const imgFileInput = document.getElementById('imgFileInput');
const btnSelectImages = document.getElementById('btnSelectImages');
const imgListSection = document.getElementById('imgListSection');
const imgItemsContainer = document.getElementById('imgItemsContainer');
const totalImgCount = document.getElementById('totalImgCount');
const totalImgSize = document.getElementById('totalImgSize');
const btnClearImgAll = document.getElementById('btnClearImgAll');
const imgTargetFormatSelect = document.getElementById('imgTargetFormat');
const imgResizeRatioSelect = document.getElementById('imgResizeRatio');
const btnPickImgFolder = document.getElementById('btnPickImgFolder');
const imgSelectedPathText = document.getElementById('imgSelectedPathText');
const btnStartImgDirect = document.getElementById('btnStartImgDirect');
const btnStartImgZip = document.getElementById('btnStartImgZip');

// DOM Elements - Shared Progress & Result
const progressSection = document.getElementById('progressSection');
const progressTitle = document.getElementById('progressTitle');
const progressSubStatus = document.getElementById('progressSubStatus');
const progressPercent = document.getElementById('progressPercent');
const progressBarFill = document.getElementById('progressBarFill');
const progressFileDetail = document.getElementById('progressFileDetail');
const progressBytesDetail = document.getElementById('progressBytesDetail');

const resultSection = document.getElementById('resultSection');
const resultLocationNotice = document.getElementById('resultLocationNotice');
const statOriginalSize = document.getElementById('statOriginalSize');
const statCompressedSize = document.getElementById('statCompressedSize');
const statRatio = document.getElementById('statRatio');
const statFileName = document.getElementById('statFileName');
const btnRedownload = document.getElementById('btnRedownload');
const btnReset = document.getElementById('btnReset');
const themeToggleBtn = document.getElementById('themeToggleBtn');

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    initDragAndDrop();
    initFileInputs();
    initActions();
    initThemeToggle();
    initLocationPickers();
});

// Directory Picker (Requirement #1: Renamed button '저장 폴더 선택')
function initLocationPickers() {
    const handlePickFolder = async () => {
        if ('showDirectoryPicker' in window) {
            try {
                selectedDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
                const folderName = selectedDirHandle.name;
                docSelectedPathText.textContent = `선택 폴더: ${folderName}`;
                imgSelectedPathText.textContent = `선택 폴더: ${folderName}`;
                alert(`[${folderName}] 폴더가 선택되었습니다.\n완료 시 해당 폴더로 자동 저장됩니다.`);
            } catch (err) {
                if (err.name !== 'AbortError') {
                    console.warn('Directory Picker fallback:', err);
                }
            }
        } else {
            alert('기본 다운로드(Downloads) 폴더로 자동 저장됩니다.');
        }
    };

    btnPickDocFolder.addEventListener('click', handlePickFolder);
    btnPickImgFolder.addEventListener('click', handlePickFolder);
}

// Tab Switcher
function switchMainTab(tabName) {
    activeTab = tabName;
    if (tabName === 'compress') {
        tabBtnCompress.classList.add('active');
        tabBtnImage.classList.remove('active');
        tabContentCompress.style.display = 'block';
        tabContentImage.style.display = 'none';
    } else {
        tabBtnImage.classList.add('active');
        tabBtnCompress.classList.remove('active');
        tabContentImage.style.display = 'block';
        tabContentCompress.style.display = 'none';
    }
}

// Theme Toggle Handler
function initThemeToggle() {
    const savedTheme = localStorage.getItem('kmou_theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('kmou_theme', isDark ? 'dark' : 'light');
        themeToggleBtn.innerHTML = isDark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    });
}

// Drag & Drop Handling
function initDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, preventDefaults, false);
        imgDropZone.addEventListener(evt, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(evt => {
        dropZone.addEventListener(evt, () => dropZone.classList.add('dragover'), false);
        imgDropZone.addEventListener(evt, () => imgDropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(evt => {
        dropZone.addEventListener(evt, () => dropZone.classList.remove('dragover'), false);
        imgDropZone.addEventListener(evt, () => imgDropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', e => handleDrop(e, 'compress'), false);
    imgDropZone.addEventListener('drop', e => handleDrop(e, 'image'), false);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

async function handleDrop(e, target) {
    const dt = e.dataTransfer;
    let files = [];

    if (dt.items && dt.items.length > 0) {
        const entryPromises = [];
        for (let i = 0; i < dt.items.length; i++) {
            const item = dt.items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                    entryPromises.push(scanFilesFromEntry(entry));
                } else {
                    const f = item.getAsFile();
                    if (f) files.push(f);
                }
            }
        }
        if (entryPromises.length > 0) {
            const nestedArrays = await Promise.all(entryPromises);
            nestedArrays.forEach(arr => files.push(...arr));
        }
    } else if (dt.files && dt.files.length > 0) {
        files = Array.from(dt.files);
    }

    if (files.length > 0) {
        if (target === 'compress') addFilesToList(files);
        else addImagesToList(files);
    }
}

function scanFilesFromEntry(entry, path = '') {
    return new Promise((resolve) => {
        if (entry.isFile) {
            entry.file(file => {
                Object.defineProperty(file, 'customPath', {
                    value: path + file.name,
                    writable: false
                });
                resolve([file]);
            }, () => resolve([]));
        } else if (entry.isDirectory) {
            const dirReader = entry.createReader();
            dirReader.readEntries(async entries => {
                const entryPromises = entries.map(e => scanFilesFromEntry(e, path + entry.name + '/'));
                const results = await Promise.all(entryPromises);
                resolve(results.flat());
            }, () => resolve([]));
        } else {
            resolve([]);
        }
    });
}

// File Pickers
function initFileInputs() {
    btnSelectFiles.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
    btnSelectFolder.addEventListener('click', (e) => { e.stopPropagation(); folderInput.click(); });
    dropZone.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            addFilesToList(Array.from(e.target.files));
            fileInput.value = '';
        }
    });

    folderInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            addFilesToList(Array.from(e.target.files));
            folderInput.value = '';
        }
    });

    btnSelectImages.addEventListener('click', (e) => { e.stopPropagation(); imgFileInput.click(); });
    imgDropZone.addEventListener('click', () => imgFileInput.click());

    imgFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            addImagesToList(Array.from(e.target.files));
            imgFileInput.value = '';
        }
    });
}

function addFilesToList(newFiles) {
    newFiles.forEach(file => {
        const isDuplicate = fileList.some(f => f.name === file.name && f.size === file.size);
        if (!isDuplicate) fileList.push(file);
    });
    updateUI();
}

function addImagesToList(newFiles) {
    newFiles.forEach(file => {
        if (/\.(jpe?g|png|webp|gif|bmp|svg)$/i.test(file.name) || file.type.startsWith('image/')) {
            const isDuplicate = imageList.some(f => f.name === file.name && f.size === file.size);
            if (!isDuplicate) imageList.push(file);
        }
    });
    updateImageUI();
}

function removeFile(index) {
    fileList.splice(index, 1);
    updateUI();
}

function removeImage(index) {
    imageList.splice(index, 1);
    updateImageUI();
}

function initActions() {
    btnClearAll.addEventListener('click', () => { fileList = []; updateUI(); });
    btnClearImgAll.addEventListener('click', () => { imageList = []; updateImageUI(); });

    btnStartCompress.addEventListener('click', () => startDocumentCompress());
    btnStartImgDirect.addEventListener('click', () => startImageProcess(false));
    btnStartImgZip.addEventListener('click', () => startImageProcess(true));

    btnRedownload.addEventListener('click', triggerAutoDownload);
    btnReset.addEventListener('click', resetApp);
}

// Update Document UI
function updateUI() {
    if (fileList.length === 0) {
        fileListSection.style.display = 'none';
        return;
    }

    fileListSection.style.display = 'block';
    fileItemsContainer.innerHTML = '';
    let grandTotalBytes = 0;

    fileList.forEach((file, idx) => {
        grandTotalBytes += file.size;
        const fileMeta = getFileTypeMeta(file.name);
        const displayPath = file.customPath || file.webkitRelativePath || file.name;

        const fileItemEl = document.createElement('div');
        fileItemEl.className = 'file-item';
        fileItemEl.innerHTML = `
            <div class="file-item-left">
                <div class="file-type-icon" style="background: ${fileMeta.bgColor}; color: ${fileMeta.textColor};">
                    <i class="${fileMeta.icon}"></i>
                </div>
                <div class="file-info">
                    <span class="file-name" title="${escapeHtml(displayPath)}">${escapeHtml(displayPath)}</span>
                    <span class="file-size">${formatBytes(file.size)}</span>
                </div>
            </div>
            <button class="file-remove-btn" onclick="removeFile(${idx})" title="삭제">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        fileItemsContainer.appendChild(fileItemEl);
    });

    totalFileCount.textContent = fileList.length;
    totalFileSize.textContent = formatBytes(grandTotalBytes);

    let rawBaseName = 'compressed_files';
    if (fileList.length === 1) {
        const originalName = fileList[0].name;
        rawBaseName = originalName.substring(0, originalName.lastIndexOf('.')) || originalName;
    } else {
        const firstOriginalName = fileList[0].name;
        const firstBaseName = firstOriginalName.substring(0, firstOriginalName.lastIndexOf('.')) || firstOriginalName;
        rawBaseName = `${firstBaseName}_외_${fileList.length - 1}개`;
    }

    outputFileNameInput.value = rawBaseName;
}

// Update Image Tab UI
function updateImageUI() {
    if (imageList.length === 0) {
        imgListSection.style.display = 'none';
        return;
    }

    imgListSection.style.display = 'block';
    imgItemsContainer.innerHTML = '';
    let grandTotalBytes = 0;

    imageList.forEach((file, idx) => {
        grandTotalBytes += file.size;
        const displayPath = file.customPath || file.name;

        const fileItemEl = document.createElement('div');
        fileItemEl.className = 'file-item';
        fileItemEl.innerHTML = `
            <div class="file-item-left">
                <div class="file-type-icon" style="background: rgba(147, 51, 234, 0.12); color: #9333EA;">
                    <i class="fa-solid fa-file-image"></i>
                </div>
                <div class="file-info">
                    <span class="file-name" title="${escapeHtml(displayPath)}">${escapeHtml(displayPath)}</span>
                    <span class="file-size">${formatBytes(file.size)}</span>
                </div>
            </div>
            <button class="file-remove-btn" onclick="removeImage(${idx})" title="삭제">
                <i class="fa-solid fa-xmark"></i>
            </button>
        `;
        imgItemsContainer.appendChild(fileItemEl);
    });

    totalImgCount.textContent = imageList.length;
    totalImgSize.textContent = formatBytes(grandTotalBytes);
}

// Helper File Icons
function getFileTypeMeta(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
        case 'hwp': case 'hwpx':
            return { icon: 'fa-solid fa-file-word', bgColor: 'rgba(37, 99, 235, 0.12)', textColor: '#2563EB' };
        case 'pdf':
            return { icon: 'fa-solid fa-file-pdf', bgColor: 'rgba(220, 38, 38, 0.12)', textColor: '#DC2626' };
        case 'ppt': case 'pptx':
            return { icon: 'fa-solid fa-file-powerpoint', bgColor: 'rgba(234, 88, 12, 0.12)', textColor: '#EA580C' };
        case 'doc': case 'docx':
            return { icon: 'fa-solid fa-file-lines', bgColor: 'rgba(2, 132, 199, 0.12)', textColor: '#0284C7' };
        case 'txt': case 'csv': case 'md':
            return { icon: 'fa-solid fa-file-code', bgColor: 'rgba(5, 150, 105, 0.12)', textColor: '#059669' };
        default:
            return { icon: 'fa-solid fa-file', bgColor: 'rgba(100, 116, 139, 0.12)', textColor: '#475569' };
    }
}

// Canvas Image Processing Engine
function processImageFile(file, targetFormat, resizeRatio, isMaxCompression = false) {
    return new Promise((resolve) => {
        if (!/\.(jpe?g|png|webp|bmp|gif|svg)$/i.test(file.name) && !file.type.startsWith('image/')) {
            resolve({ blob: file, filename: file.name });
            return;
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            let origWidth = img.naturalWidth || img.width;
            let origHeight = img.naturalHeight || img.height;

            let targetWidth = origWidth;
            let targetHeight = origHeight;

            if (resizeRatio === 'max_1280') {
                if (origWidth > 1280) {
                    targetWidth = 1280;
                    targetHeight = Math.round((origHeight * 1280) / origWidth);
                }
            } else if (resizeRatio === 'max_800') {
                if (origWidth > 800) {
                    targetWidth = 800;
                    targetHeight = Math.round((origHeight * 800) / origWidth);
                }
            } else {
                const ratioNum = parseFloat(resizeRatio) || 1.0;
                if (ratioNum < 1.0) {
                    targetWidth = Math.max(1, Math.round(origWidth * ratioNum));
                    targetHeight = Math.max(1, Math.round(origHeight * ratioNum));
                }
            }

            if (isMaxCompression && resizeRatio === '1.0') {
                targetWidth = Math.max(1, Math.round(origWidth * 0.85));
                targetHeight = Math.max(1, Math.round(origHeight * 0.85));
            }

            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            let mimeType = 'image/jpeg';
            let ext = 'jpg';

            if (targetFormat === 'original') {
                const origExt = file.name.split('.').pop().toLowerCase();
                if (origExt === 'png') {
                    mimeType = 'image/png';
                    ext = 'png';
                } else if (origExt === 'webp') {
                    mimeType = 'image/webp';
                    ext = 'webp';
                } else {
                    mimeType = 'image/jpeg';
                    ext = 'jpg';
                }
            } else if (targetFormat === 'png') {
                mimeType = 'image/png';
                ext = 'png';
            } else if (targetFormat === 'webp') {
                mimeType = 'image/webp';
                ext = 'webp';
            } else {
                mimeType = 'image/jpeg';
                ext = 'jpg';
            }

            if (mimeType === 'image/jpeg') {
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, targetWidth, targetHeight);
            }

            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            const quality = isMaxCompression ? 0.65 : 0.82;
            
            canvas.toBlob(
                (convertedBlob) => {
                    if (convertedBlob) {
                        const originalBase = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                        const newFilename = `${originalBase}.${ext}`;
                        resolve({ blob: convertedBlob, filename: newFilename });
                    } else {
                        resolve({ blob: file, filename: file.name });
                    }
                },
                mimeType,
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve({ blob: file, filename: file.name });
        };

        img.src = objectUrl;
    });
}

// Document ZIP Compression
async function startDocumentCompress() {
    if (fileList.length === 0) return;

    fileListSection.style.display = 'none';
    progressSection.style.display = 'block';
    resultSection.style.display = 'none';

    const isMaxCompress = compressionLevelSelect.value === 'DEFLATE_9';

    progressBarFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressTitle.textContent = isMaxCompress ? '파일 고밀도 최대 압축 진행 중...' : '문서 표준 압축 진행 중...';

    const zip = new JSZip();
    let totalOriginalBytes = 0;

    for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        totalOriginalBytes += file.size;

        const relativePathDir = file.customPath || file.webkitRelativePath || file.name;

        if (isMaxCompress && /\.(jpe?g|png|webp|bmp)$/i.test(file.name)) {
            const processed = await processImageFile(file, 'original', '1.0', true);
            zip.file(relativePathDir, processed.blob);
        } else {
            zip.file(relativePathDir, file);
        }
    }

    let userBaseName = outputFileNameInput.value.trim() || 'compressed_files';
    userBaseName = userBaseName.replace(/\.(zip|cbz|tar|gz)$/i, '');
    currentOutputFileName = `${userBaseName}.zip`;

    const zipLevel = isMaxCompress ? 9 : 6;

    try {
        generatedBlob = await zip.generateAsync(
            { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: zipLevel } },
            function updateProgress(metadata) {
                const percent = Math.round(metadata.percent);
                progressBarFill.style.width = `${percent}%`;
                progressPercent.textContent = `${percent}%`;
                if (metadata.currentFile) {
                    progressSubStatus.textContent = `압축 중: ${metadata.currentFile}`;
                }
            }
        );

        const compressedSizeBytes = generatedBlob.size;
        const savedPercent = totalOriginalBytes > 0 
            ? Math.max(0, ((totalOriginalBytes - compressedSizeBytes) / totalOriginalBytes * 100)).toFixed(1)
            : 0;

        statOriginalSize.textContent = formatBytes(totalOriginalBytes);
        statCompressedSize.textContent = formatBytes(compressedSizeBytes);
        statRatio.textContent = `${savedPercent}% 절감`;
        statFileName.textContent = currentOutputFileName;

        progressSection.style.display = 'none';
        resultSection.style.display = 'block';

        if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        triggerAutoDownload();

    } catch (err) {
        alert('압축 오류: ' + err.message);
        resetApp();
    }
}

// Image Processing Handler
async function startImageProcess(zipOutput) {
    if (imageList.length === 0) return;

    imgListSection.style.display = 'none';
    progressSection.style.display = 'block';
    resultSection.style.display = 'none';

    progressBarFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressTitle.textContent = zipOutput ? '사진 변환 및 ZIP 압축 진행 중...' : '사진 크기/포맷 변환 진행 중...';

    const targetFormat = imgTargetFormatSelect.value;
    const resizeRatio = imgResizeRatioSelect.value;

    let totalOriginalBytes = 0;
    let totalProcessedBytes = 0;
    processedImageBlobs = [];

    const zip = zipOutput ? new JSZip() : null;

    for (let i = 0; i < imageList.length; i++) {
        const file = imageList[i];
        totalOriginalBytes += file.size;

        const currentPct = Math.round(((i + 1) / imageList.length) * (zipOutput ? 60 : 90));
        progressBarFill.style.width = `${currentPct}%`;
        progressPercent.textContent = `${currentPct}%`;
        progressSubStatus.textContent = `사진 변환 중 (${i + 1}/${imageList.length}): ${file.name}`;

        try {
            const processed = await processImageFile(file, targetFormat, resizeRatio, false);
            totalProcessedBytes += processed.blob.size;
            processedImageBlobs.push(processed);

            if (zipOutput && zip) {
                zip.file(processed.filename, processed.blob);
            }
        } catch (err) {
            totalProcessedBytes += file.size;
            processedImageBlobs.push({ blob: file, filename: file.name });
            if (zipOutput && zip) zip.file(file.name, file);
        }
    }

    if (zipOutput && zip) {
        const firstOriginalName = imageList[0].name;
        const firstBaseName = firstOriginalName.substring(0, firstOriginalName.lastIndexOf('.')) || firstOriginalName;
        currentOutputFileName = imageList.length === 1 ? `${firstBaseName}_converted.zip` : `KMOU_사진_변환_${imageList.length}장.zip`;

        try {
            generatedBlob = await zip.generateAsync(
                { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
                function updateProgress(metadata) {
                    const zipPct = 60 + Math.round((metadata.percent * 40) / 100);
                    progressBarFill.style.width = `${zipPct}%`;
                    progressPercent.textContent = `${zipPct}%`;
                }
            );

            showCompletionResult(totalOriginalBytes, generatedBlob.size, currentOutputFileName);
            triggerAutoDownload();
        } catch (err) {
            alert('ZIP 처리 오류: ' + err.message);
            resetApp();
        }
    } else {
        progressBarFill.style.width = '100%';
        progressPercent.textContent = '100%';

        currentOutputFileName = processedImageBlobs.length === 1 ? processedImageBlobs[0].filename : `변환 사진 ${processedImageBlobs.length}장 (개별 다운로드)`;

        showCompletionResult(totalOriginalBytes, totalProcessedBytes, currentOutputFileName);

        if (selectedDirHandle) {
            saveBlobsToDirectoryHandle(processedImageBlobs, selectedDirHandle);
        } else {
            processedImageBlobs.forEach((item, index) => {
                setTimeout(() => {
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(item.blob);
                    link.download = item.filename;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }, index * 300);
            });
        }
    }
}

async function saveBlobsToDirectoryHandle(items, dirHandle) {
    for (const item of items) {
        try {
            const fileHandle = await dirHandle.getFileHandle(item.filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(item.blob);
            await writable.close();
        } catch (err) {
            console.error('File system write error:', err);
        }
    }
}

function showCompletionResult(origBytes, finalBytes, fileName) {
    const savedPercent = origBytes > 0 
        ? Math.max(0, ((origBytes - finalBytes) / origBytes * 100)).toFixed(1)
        : 0;

    statOriginalSize.textContent = formatBytes(origBytes);
    statCompressedSize.textContent = formatBytes(finalBytes);
    statRatio.textContent = `${savedPercent}% 절감`;
    statFileName.textContent = fileName;

    if (selectedDirHandle) {
        resultLocationNotice.textContent = `지정하신 [${selectedDirHandle.name}] 폴더에 성공적으로 저장되었습니다!`;
    } else {
        resultLocationNotice.textContent = `다운로드(Downloads) 폴더에 성공적으로 저장되었습니다.`;
    }

    progressSection.style.display = 'none';
    resultSection.style.display = 'block';

    if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
}

async function triggerAutoDownload() {
    if (!generatedBlob || !currentOutputFileName) return;

    if (selectedDirHandle) {
        try {
            const fileHandle = await selectedDirHandle.getFileHandle(currentOutputFileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(generatedBlob);
            await writable.close();
            return;
        } catch (err) {
            console.warn('Direct dir write failed, fallback to standard download:', err);
        }
    }

    const downloadUrl = URL.createObjectURL(downloadUrl);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = currentOutputFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
}

function resetApp() {
    fileList = [];
    imageList = [];
    generatedBlob = null;
    processedImageBlobs = [];
    currentOutputFileName = '';

    fileListSection.style.display = 'none';
    imgListSection.style.display = 'none';
    progressSection.style.display = 'none';
    resultSection.style.display = 'none';

    dropZone.style.display = 'block';
    imgDropZone.style.display = 'block';
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        }[m];
    });
}
