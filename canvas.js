async function generateImage(text) {
    const DEBUG = false;
    const canvas = document.getElementById('outputCanvas');
    const canvasWrapper = document.getElementById('canvasWrapper');
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    const maxWidth = 1200;
    const maxHeight = 630;
    canvas.width = maxWidth;
    canvas.height = maxHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const chars = text.split('');
    const validChars = chars.filter(c => /^[A-Z0-9 ,.\-?!%\"'\s]$/.test(c));
    if (validChars.length === 0) {
        if (canvasWrapper) canvasWrapper.classList.add('d-none');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const imageSize = 100;
    const minScale = 0.1;
    let scale = 1;
    let scaledSize = imageSize * scale;
    let lineHeight = scaledSize * 1.2;

    const rawTokens = text.split(/(\r?\n|\s)/).filter(Boolean);
    const tokens = rawTokens.map(tok => {
        if (/^\r?\n$/.test(tok)) return { type: 'newline', char: '\n' };
        if (/^\s$/.test(tok)) return { type: 'space', char: ' ', length: tok.length };
        return { type: 'word', chars: tok.split('') };
    });

    const images = [];
    const displayChars = [];
    for (let i = 0; i < text.length; i++) displayChars.push(text[i]);
    const validDisplayChars = displayChars.filter(c => /^[A-Z0-9 ,.\-?!%\"'\s]$/.test(c));
    for (const char of validDisplayChars) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = `kweens/${getImageName(char)}.png`;
        await new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
        });
        images.push(img);
    }

    const nonSpaceImages = images.filter((img, idx) => {
        const ch = validDisplayChars[idx];
        return img && img.naturalWidth > 1 && ch !== ' ' && ch !== '\n' && ch !== '\r';
    });
    const baseWidth = nonSpaceImages.length ? (nonSpaceImages.reduce((s, img) => s + img.naturalWidth, 0) / nonSpaceImages.length) : images[0]?.naturalWidth || 1;
    const minWidthFactor = 0.6;

    const lines = [];
    let curLine = [];
    let curLineChars = 0;
    let imageIndex = 0;
    const tokenImages = [];
    let imgIdx = 0;
    const offscreen = document.createElement('canvas');
    const offctx = offscreen.getContext('2d');
    for (const tok of tokens) {
        if (tok.type === 'newline') {
            tokenImages.push({ type: 'newline' });
            continue;
        }
        if (tok.type === 'space') {
            const imgs = [];
            for (let s = 0; s < tok.length; s++) {
                while (imgIdx < images.length && getImageName(validDisplayChars[imgIdx]) !== getImageName(' ')) imgIdx++;
                const imgEl = images[imgIdx] || null;
                let visibleWidthPx = imgEl ? imgEl.naturalWidth : 0;
                if (imgEl) {
                    offscreen.width = imgEl.naturalWidth;
                    offscreen.height = imgEl.naturalHeight;
                    offctx.clearRect(0, 0, offscreen.width, offscreen.height);
                    offctx.drawImage(imgEl, 0, 0);
                    const data = offctx.getImageData(0, 0, offscreen.width, offscreen.height).data;
                    let minX = offscreen.width, maxX = -1;
                    for (let x = 0; x < offscreen.width; x++) {
                        for (let y = 0; y < offscreen.height; y++) {
                            const idxData = (y * offscreen.width + x) * 4 + 3;
                            if (data[idxData] > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); break; }
                        }
                    }
                    if (maxX >= minX) visibleWidthPx = (maxX - minX + 1);
                }
                const rawFactor = imgEl ? (visibleWidthPx / baseWidth) : 1;
                const widthFactor = imgEl ? Math.max(minWidthFactor, rawFactor) : 1;
                imgs.push({ char: ' ', img: imgEl, widthFactor });
                imgIdx++;
            }
            tokenImages.push({ type: 'space', images: imgs });
        } else {
            const imgs = [];
            for (let c of tok.chars) {
                while (imgIdx < images.length && getImageName(validDisplayChars[imgIdx]) !== getImageName(c)) imgIdx++;
                const imgEl = images[imgIdx] || null;
                let visibleWidthPx = imgEl ? imgEl.naturalWidth : 0;
                if (imgEl) {
                    offscreen.width = imgEl.naturalWidth;
                    offscreen.height = imgEl.naturalHeight;
                    offctx.clearRect(0, 0, offscreen.width, offscreen.height);
                    offctx.drawImage(imgEl, 0, 0);
                    const data = offctx.getImageData(0, 0, offscreen.width, offscreen.height).data;
                    let minX = offscreen.width, maxX = -1;
                    for (let x = 0; x < offscreen.width; x++) {
                        for (let y = 0; y < offscreen.height; y++) {
                            const idxData = (y * offscreen.width + x) * 4 + 3;
                            if (data[idxData] > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); break; }
                        }
                    }
                    if (maxX >= minX) visibleWidthPx = (maxX - minX + 1);
                }
                const rawFactor = imgEl ? (visibleWidthPx / baseWidth) : 1;
                const widthFactor = imgEl ? Math.max(minWidthFactor, rawFactor) : 1;
                imgs.push({ char: c, img: imgEl, widthFactor });
                imgIdx++;
            }
            tokenImages.push({ type: 'word', images: imgs, chars: tok.chars });
        }
    }

    let xPos = 0;
    for (let ti = 0; ti < tokenImages.length; ti++) {
        const token = tokenImages[ti];
        if (token.type === 'newline') {
            if (curLine.length > 0) { lines.push(curLine); curLine = []; xPos = 0; }
            else {
                lines.push([]);
            }
            continue;
        }
        const wWidth = token.images ? token.images.reduce((s, img) => s + (img.widthFactor || 1), 0) * scaledSize : 0;
        if (token.type === 'space' && xPos === 0) continue;
        if (xPos + wWidth <= maxWidth) {
            curLine.push(token);
            xPos += wWidth;
        } else {
            if (curLine.length > 0) {
                lines.push(curLine);
                curLine = [];
                xPos = 0;
            }
            if (wWidth > maxWidth && token.type === 'word') {
                const charsPerLine = Math.max(1, Math.floor(maxWidth / scaledSize));
                let iChar = 0;
                const imgArr = token.images;
                while (iChar < imgArr.length) {
                    const slice = imgArr.slice(iChar, iChar + charsPerLine);
                    lines.push([{ chars: slice.map(s => s.char), images: slice }]);
                    iChar += charsPerLine;
                }
                xPos = (imgArr.length % charsPerLine) * scaledSize;
            } else {
                curLine.push(token);
                xPos = wWidth;
            }
        }
    }
    if (curLine.length > 0) lines.push(curLine);

    function testScaleFromTokenImages(s) {
        const size = imageSize * s;
        const lh = size * 1.2;
        let rows = 1;
        let x = 0;
        for (let ti = 0; ti < tokenImages.length; ti++) {
            const token = tokenImages[ti];
            if (token.type === 'newline') { rows++; x = 0; continue; }
            const tokenWidth = token.images ? token.images.reduce((s2, im) => s2 + (im.widthFactor || 1), 0) * size : 0;
            if (token.type === 'space' && x === 0) continue;
            if (x + tokenWidth <= maxWidth) {
                x += tokenWidth;
            } else {
                rows++;
                x = tokenWidth;
                if (tokenWidth > maxWidth && token.type === 'word') {
                    const tokenCount = token.images.length || 1;
                    const avgCharWidth = token.images.reduce((s2, im) => s2 + (im.widthFactor || 1), 0) / tokenCount;
                    const charsPerLine = Math.floor(maxWidth / (size * avgCharWidth)) || 1;
                    const extraRows = Math.ceil(token.images.length / charsPerLine) - 1;
                    rows += extraRows;
                    x = (token.images.length % charsPerLine) * size * avgCharWidth;
                }
            }
            if (rows * lh > maxHeight) return false;
        }
        return true;
    }

    const maxScale = 4;
    // compute longest line at scale=1
    const longestLineWidthAt1 = lines.reduce((maxW, lineTokens) => {
        const lw = (lineTokens || []).reduce((sum, token) => {
            const tokenImgs = Array.isArray(token.images) ? token.images : [];
            if (tokenImgs.length > 0) return sum + tokenImgs.reduce((s, im) => s + (im.widthFactor || 1), 0) * imageSize;
            const charsLen = (token.chars && token.chars.length) || (token.type === 'space' && token.images ? token.images.length : (token.length || 1));
            return sum + (charsLen || 1) * imageSize;
        }, 0);
        return Math.max(maxW, lw);
    }, 0) || imageSize;
    let scaleCandidate = Math.min(maxScale, Math.max(minScale, maxWidth / Math.max(1, longestLineWidthAt1)));

    function findMaxScale(low, high) {
        let lo = low; let hi = high; let best = low;
        while (hi - lo > 0.001) {
            const mid = (lo + hi) / 2;
            if (testScaleFromTokenImages(mid)) { best = mid; lo = mid; }
            else hi = mid;
        }
        return Math.max(minScale, Math.min(maxScale, best));
    }

    if (testScaleFromTokenImages(scaleCandidate)) {
        scale = scaleCandidate;
    } else {
        scale = findMaxScale(minScale, scaleCandidate);
    }
    scaledSize = imageSize * scale;
    lineHeight = scaledSize * 1.2;
    

    const finalLines = [];
    let curL = [];
    let curX = 0;
    for (let ti = 0; ti < tokenImages.length; ti++) {
        const token = tokenImages[ti];
        if (token.type === 'newline') {
            if (curL.length > 0) finalLines.push(curL);
            else finalLines.push([]);
            curL = [];
            curX = 0;
            continue;
        }
        const tokenWidth = token.images ? token.images.reduce((s2, im) => s2 + (im.widthFactor || 1), 0) * scaledSize : 0;
        if (token.type === 'space' && curX === 0) continue;
        if (curX + tokenWidth <= maxWidth) {
            curL.push(token);
            curX += tokenWidth;
        } else {
            if (curL.length > 0) finalLines.push(curL);
            curL = [];
            curX = 0;
            if (tokenWidth > maxWidth && token.type === 'word') {
                const imgArr = token.images;
                let idx = 0;
                let avgCharWidth = imgArr.length ? imgArr.reduce((s2, im) => s2 + (im.widthFactor || 1), 0) / imgArr.length : 1;
                const charsPerLine = Math.max(1, Math.floor(maxWidth / (scaledSize * avgCharWidth)));
                while (idx < imgArr.length) {
                    const chunk = imgArr.slice(idx, idx + charsPerLine);
                    finalLines.push([{ chars: chunk.map(s => s.char), images: chunk }]);
                    idx += charsPerLine;
                }
                curX = (imgArr.length % charsPerLine) * scaledSize * avgCharWidth;
            } else {
                curL.push(token);
                curX = tokenWidth;
            }
        }
    }
    if (curL.length > 0) finalLines.push(curL);

    lines.length = 0;
    for (let i = 0; i < finalLines.length; i++) lines.push(finalLines[i]);

    if (lines.length > 0) {
        const totalHeight = lines.length * lineHeight;
        let offsetY = 0;
        if (totalHeight <= maxHeight) {
            offsetY = (maxHeight - totalHeight) / 2;
        } else {
            offsetY = maxHeight - totalHeight;
        }

        for (let li = 0; li < lines.length; li++) {
            const lineTokens = lines[li] || [];
            const lineWidth = lineTokens.reduce((sum, token) => {
                const tokenImgs = Array.isArray(token.images) ? token.images : [];
                if (tokenImgs.length > 0) return sum + tokenImgs.reduce((s, im) => s + (im.widthFactor || 1), 0) * scaledSize;
                const charsLen = (token.chars && token.chars.length) || (token.type === 'space' && token.images ? token.images.length : (token.length || 1));
                return sum + (charsLen || 1) * scaledSize;
            }, 0);

            const totalSpaceSlots = lineTokens.reduce((sum, token) => {
                if (token.type === 'space' && Array.isArray(token.images)) return sum + token.images.length;
                return sum;
            }, 0);
            const extraPerSpace = totalSpaceSlots > 0 ? Math.max(0, (maxWidth - lineWidth) / totalSpaceSlots) : 0;
            let xCursor = Math.round((maxWidth - (lineWidth + totalSpaceSlots * extraPerSpace)) / 2);
            const y = Math.round(offsetY + li * lineHeight);
            

            for (let wi = 0; wi < lineTokens.length; wi++) {
                const w = lineTokens[wi];
                if (!w) continue;
                const imagesArr = Array.isArray(w.images) ? w.images : [];
                const isSpace = w.type === 'space';
                if (imagesArr.length > 0) {
                    for (let ci = 0; ci < imagesArr.length; ci++) {
                        const imgObj = imagesArr[ci];
                        const wFactor = imgObj && imgObj.widthFactor ? imgObj.widthFactor : 1;
                        const drawW = scaledSize * wFactor;
                        if (imgObj && imgObj.img) ctx.drawImage(imgObj.img, xCursor, y, drawW, scaledSize);
                        xCursor += drawW;
                        if (isSpace) xCursor += extraPerSpace;
                    }
                } else {
                    const charsLen = (w.chars && w.chars.length) || (w.type === 'space' && w.images ? w.images.length : (w.length || 1));
                    xCursor += (charsLen || 1) * scaledSize;
                    if (isSpace) xCursor += extraPerSpace * (charsLen || 1);
                }
            
            }
        }
        if (canvasWrapper) canvasWrapper.classList.remove('d-none');
    }

    const mainCanvas = document.getElementById('outputCanvas');
    if (mainCanvas && !mainCanvas.dataset.fullscreenHandler) {
        mainCanvas.dataset.fullscreenHandler = '1';
        mainCanvas.addEventListener('click', () => openFullscreen(mainCanvas));
    }
}

function openFullscreen(sourceCanvas) {
    if (document.getElementById('fullscreenModal')) return;
    const modal = document.createElement('div');
    modal.id = 'fullscreenModal';
    modal.className = 'fullscreen-modal';
    const content = document.createElement('div');
    content.className = 'fullscreen-content';
    const modalCanvas = document.createElement('canvas');
    modalCanvas.id = 'modalCanvas';
    content.appendChild(modalCanvas);
    const closeBtn = document.createElement('button');
    closeBtn.className = 'fullscreen-close';
    closeBtn.innerHTML = '<i class="bi bi-x" aria-hidden="true"></i>';
    content.appendChild(closeBtn);
    const dlBtn = document.createElement('button');
    dlBtn.className = 'fullscreen-download';
    dlBtn.innerHTML = '<i class="bi bi-download" aria-hidden="true" style="font-size:18px;color:#062022"></i>';
    content.appendChild(dlBtn);
    modal.appendChild(content);
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const mainDownload = document.getElementById('downloadBtn');
    if (mainDownload) mainDownload.style.display = 'none';
    let _didNativeFullscreen = false;
    function onFullScreenChange() {
        if (!document.fullscreenElement) {
            if (document.getElementById('fullscreenModal')) closeModal();
        }
    }
    document.addEventListener('fullscreenchange', onFullScreenChange);

    function closeModal() {
        if (document.fullscreenElement) {
            try { document.exitFullscreen(); } catch (e) {}
        }
        document.body.removeChild(modal);
        if (mainDownload) mainDownload.style.display = '';
        document.body.style.overflow = '';
        document.removeEventListener('keydown', onKey);
        document.removeEventListener('fullscreenchange', onFullScreenChange);
    }
    function onKey(e) { if (e.key === 'Escape') closeModal(); }
    document.addEventListener('keydown', onKey);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (ev) => { if (ev.target === modal) closeModal(); });

    const sw = sourceCanvas.width; const sh = sourceCanvas.height;
    const maxW = window.innerWidth - 80; const maxH = window.innerHeight - 80;
    const ratio = Math.min(maxW / sw, maxH / sh, 1);
    modalCanvas.width = Math.round(sw * ratio);
    modalCanvas.height = Math.round(sh * ratio);
    const mctx = modalCanvas.getContext('2d');
    mctx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
    mctx.drawImage(sourceCanvas, 0, 0, modalCanvas.width, modalCanvas.height);

    dlBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        const a = document.getElementById('textInput').value.trim();
        const filename = (a ? a.toLowerCase().replace(/[^a-z0-9\- ]+/g, '').replace(/\s+/g, '-') : 'kweenify') + '.png';
        link.download = filename;
        link.href = modalCanvas.toDataURL('image/png');
        link.click();
    });

    try {
        if (window.matchMedia && window.matchMedia('(max-width: 767px)').matches) {
            if (modalCanvas.requestFullscreen) {
                modalCanvas.requestFullscreen().then(() => { _didNativeFullscreen = true; }).catch(() => {});
            }
        }
    } catch (e) {}
}

function getImageName(char) {
    const map = {
        ' ': 'space',
        ',': 'comma',
        '-': 'dash',
        '.': 'dot',
        '%': 'percent',
        '?': 'questionmark',
        '!': 'exclamationmark'
    };
    return map[char] || char;
}