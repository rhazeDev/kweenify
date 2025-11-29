document.getElementById('textForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const button = document.querySelector('#textForm button');
    button.disabled = true;
    document.getElementById('loading').classList.remove('d-none');
    const text = document.getElementById('textInput').value.toUpperCase();
    await generateImage(text);
    document.getElementById('loading').classList.add('d-none');
    button.disabled = false;
});

async function generateImage(text) {
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
    const validChars = chars.filter(c => /^[A-Z0-9 ,.\-?!%"'\s]$/.test(c));
    if (validChars.length === 0) {
        if (canvasWrapper) canvasWrapper.classList.add('d-none');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const imageSize = 100;
    const totalChars = validChars.length;
    let scale = Math.max(0.1, Math.min(1, 100 / totalChars));
    const scaledSize = imageSize * scale;

    const images = [];
    for (const char of validChars) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = `kweens/${getImageName(char)}.png`;
        await new Promise(resolve => {
            img.onload = resolve;
            img.onerror = resolve;
        });
        images.push(img);
    }

    const positions = [];
    let x = 0;
    let y = 0;
    const lineHeight = scaledSize * 1.2;
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (x + scaledSize > maxWidth) {
            x = 0;
            y += lineHeight;
        }
        if (y + lineHeight > maxHeight) break;
        positions.push({ x, y, img });
        x += scaledSize;
    }

    if (positions.length > 0) {
        const minX = Math.min(...positions.map(p => p.x));
        const maxX = Math.max(...positions.map(p => p.x + scaledSize));
        const minY = Math.min(...positions.map(p => p.y));
        const maxY = Math.max(...positions.map(p => p.y + scaledSize));
        const offsetX = (maxWidth - (maxX - minX)) / 2 - minX;
        const offsetY = (maxHeight - (maxY - minY)) / 2 - minY;
        for (const p of positions) {
            ctx.drawImage(p.img, p.x + offsetX, p.y + offsetY, scaledSize, scaledSize);
        }
        if (canvasWrapper) canvasWrapper.classList.remove('d-none');
    }
}

document.getElementById('downloadBtn').addEventListener('click', function () {
    const canvas = document.getElementById('outputCanvas');
    const text = document.getElementById('textInput').value.trim();
    let name = 'kweenify';
    if (text) {
        name = text.toLowerCase().replace(/[^a-z0-9\- ]+/g, '').replace(/\s+/g, '-').slice(0, 30);
        if (!name) name = 'kweenify';
    }
    const link = document.createElement('a');
    link.download = `${name}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
});

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