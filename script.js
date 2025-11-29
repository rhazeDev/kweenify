document.getElementById('textForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const button = document.querySelector('#textForm button');
    const loading = document.getElementById('loading');
    const loadingText = document.getElementById('loadingText');
    const canvasWrapper = document.getElementById('canvasWrapper');
    const canvasContainer = document.querySelector('.canvas-container');
    button.disabled = true;
    const text = document.getElementById('textInput').value.toUpperCase();
    if (loadingText) {
        loadingText.textContent = text || 'Preview';
        loadingText.classList.remove('d-none');
    }
    if (canvasWrapper) canvasWrapper.classList.add('d-none');
    if (canvasContainer) canvasContainer.classList.add('rendering');
    loading.classList.remove('d-none');
    await generateImage(text);
    loading.classList.add('d-none');
    if (loadingText) loadingText.classList.add('d-none');
    if (canvasContainer) canvasContainer.classList.remove('rendering');
    button.disabled = false;
});

 

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