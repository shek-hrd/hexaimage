/**
 * HexaImage Converter - CCD to Hexagonal Grid Conversion
 * 
 * Implements conversion from orthogonal CCD sensor data to hexagonal grid format
 * using 3×3 overlapping sampling windows with weighted interpolation.
 */

class HexaImageConverter {
    constructor() {
        this.originalImage = null;
        this.hexagonalImage = null;
        this.originalCanvas = null;
        this.hexCanvas = null;
        this.originalCtx = null;
        this.hexCtx = null;
        
        // Zoom and pan state for original image
        this.originalZoom = 1;
        this.originalPanX = 0;
        this.originalPanY = 0;
        this.originalIsPanning = false;
        this.originalLastPanPoint = null;
        
        // Zoom and pan state for hex image
        this.hexZoom = 1;
        this.hexPanX = 0;
        this.hexPanY = 0;
        this.hexIsPanning = false;
        this.hexLastPanPoint = null;
        
        this.processingStartTime = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupCanvases();
    }
    
    setupEventListeners() {
        // File input and drag-and-drop
        const fileInput = document.getElementById('fileInput');
        const dropZone = document.getElementById('dropZone');
        
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        dropZone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        dropZone.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Control buttons
        document.getElementById('downloadBtn')?.addEventListener('click', () => this.downloadHexImage());
        document.getElementById('resetBtn')?.addEventListener('click', () => this.reset());
        
        // Zoom controls for original image
        document.getElementById('zoomInOriginal')?.addEventListener('click', () => this.zoomOriginal(1.2));
        document.getElementById('zoomOutOriginal')?.addEventListener('click', () => this.zoomOriginal(0.8));
        document.getElementById('resetViewOriginal')?.addEventListener('click', () => this.resetOriginalView());
        
        // Zoom controls for hex image
        document.getElementById('zoomInHex')?.addEventListener('click', () => this.zoomHex(1.2));
        document.getElementById('zoomOutHex')?.addEventListener('click', () => this.zoomHex(0.8));
        document.getElementById('resetViewHex')?.addEventListener('click', () => this.resetHexView());
    }
    
    setupCanvases() {
        this.originalCanvas = document.getElementById('originalCanvas');
        this.hexCanvas = document.getElementById('hexCanvas');
        
        if (this.originalCanvas) {
            this.originalCtx = this.originalCanvas.getContext('2d');
            this.setupCanvasInteraction(this.originalCanvas, 'original');
        }
        
        if (this.hexCanvas) {
            this.hexCtx = this.hexCanvas.getContext('2d');
            this.setupCanvasInteraction(this.hexCanvas, 'hex');
        }
    }
    
    setupCanvasInteraction(canvas, type) {
        // Mouse events for panning
        canvas.addEventListener('mousedown', (e) => this.startPan(e, type));
        canvas.addEventListener('mousemove', (e) => this.pan(e, type));
        canvas.addEventListener('mouseup', () => this.endPan(type));
        canvas.addEventListener('mouseleave', () => this.endPan(type));
        
        // Wheel event for zooming
        canvas.addEventListener('wheel', (e) => this.handleWheel(e, type));
        
        // Touch events for mobile
        canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e, type));
        canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e, type));
        canvas.addEventListener('touchend', () => this.endPan(type));
    }
    
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.processFile(file);
        }
    }
    
    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('dropZone').classList.add('dragover');
    }
    
    handleDragLeave(event) {
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('dropZone').classList.remove('dragover');
    }
    
    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        document.getElementById('dropZone').classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            this.processFile(files[0]);
        }
    }
    
    processFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.startProcessing();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    async startProcessing() {
        this.processingStartTime = performance.now();
        this.showProcessingStatus();
        
        // Small delay to allow UI to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
            await this.convertToHexagonal();
            this.showResults();
        } catch (error) {
            console.error('Error processing image:', error);
            alert('Error processing image. Please try again with a different image.');
            this.hideProcessingStatus();
        }
    }
    
    showProcessingStatus() {
        document.getElementById('statusSection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'none';
        
        // Animate progress bar
        let progress = 0;
        const progressBar = document.getElementById('progressFill');
        const statusText = document.getElementById('statusText');
        
        const updateProgress = () => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            progressBar.style.width = progress + '%';
            
            if (progress < 30) {
                statusText.textContent = 'Analyzing image structure...';
            } else if (progress < 60) {
                statusText.textContent = 'Sampling 3×3 windows...';
            } else {
                statusText.textContent = 'Generating hexagonal grid...';
            }
            
            if (progress < 90) {
                setTimeout(updateProgress, 50 + Math.random() * 100);
            }
        };
        
        updateProgress();
    }
    
    hideProcessingStatus() {
        document.getElementById('statusSection').style.display = 'none';
    }
    
    async convertToHexagonal() {
        const originalWidth = this.originalImage.width;
        const originalHeight = this.originalImage.height;
        
        // Create temporary canvas to extract pixel data
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = originalWidth;
        tempCanvas.height = originalHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.originalImage, 0, 0);
        
        const imageData = tempCtx.getImageData(0, 0, originalWidth, originalHeight);
        const pixels = imageData.data;
        
        // Calculate hexagonal grid dimensions
        // Hexagonal grid has fewer pixels due to efficient packing
        const hexWidth = Math.floor(originalWidth * 0.85);
        const hexHeight = Math.floor(originalHeight * 0.9);
        
        // Create result canvas for hexagonal image
        const hexImageData = tempCtx.createImageData(hexWidth, hexHeight);
        const hexPixels = hexImageData.data;
        
        // Process each hexagonal pixel
        for (let hexY = 0; hexY < hexHeight; hexY++) {
            for (let hexX = 0; hexX < hexWidth; hexX++) {
                const hexColor = this.calculateHexagonalPixel(pixels, originalWidth, originalHeight, hexX, hexY, hexWidth, hexHeight);
                
                const hexIndex = (hexY * hexWidth + hexX) * 4;
                hexPixels[hexIndex] = hexColor.r;
                hexPixels[hexIndex + 1] = hexColor.g;
                hexPixels[hexIndex + 2] = hexColor.b;
                hexPixels[hexIndex + 3] = 255; // Alpha
            }
            
            // Update progress occasionally
            if (hexY % Math.floor(hexHeight / 10) === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }
        
        // Create final hexagonal image
        tempCanvas.width = hexWidth;
        tempCanvas.height = hexHeight;
        tempCtx.putImageData(hexImageData, 0, 0);
        
        // Convert to Image object
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                this.hexagonalImage = img;
                resolve();
            };
            img.src = tempCanvas.toDataURL();
        });
    }
    
    calculateHexagonalPixel(pixels, originalWidth, originalHeight, hexX, hexY, hexWidth, hexHeight) {
        // Map hexagonal coordinates to orthogonal coordinates
        const scaleX = originalWidth / hexWidth;
        const scaleY = originalHeight / hexHeight;
        
        // Add hexagonal offset for staggered rows
        const hexOffset = (hexY % 2) * 0.5;
        const centerX = Math.round((hexX + hexOffset) * scaleX);
        const centerY = Math.round(hexY * scaleY);
        
        // Sample 3×3 window around center point
        let centerWeight = 0.5;
        let outerWeight = 0.5 / 8; // Distribute remaining 50% among 8 outer pixels
        
        let totalR = 0, totalG = 0, totalB = 0;
        let totalWeight = 0;
        
        // Sample 3×3 window
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                const sampleX = Math.max(0, Math.min(originalWidth - 1, centerX + dx));
                const sampleY = Math.max(0, Math.min(originalHeight - 1, centerY + dy));
                
                const pixelIndex = (sampleY * originalWidth + sampleX) * 4;
                const r = pixels[pixelIndex];
                const g = pixels[pixelIndex + 1];
                const b = pixels[pixelIndex + 2];
                
                const weight = (dx === 0 && dy === 0) ? centerWeight : outerWeight;
                
                totalR += r * weight;
                totalG += g * weight;
                totalB += b * weight;
                totalWeight += weight;
            }
        }
        
        // Normalize to prevent overflow
        if (totalWeight > 0) {
            totalR = Math.round(totalR / totalWeight);
            totalG = Math.round(totalG / totalWeight);
            totalB = Math.round(totalB / totalWeight);
        }
        
        return {
            r: Math.max(0, Math.min(255, totalR)),
            g: Math.max(0, Math.min(255, totalG)),
            b: Math.max(0, Math.min(255, totalB))
        };
    }
    
    showResults() {
        const processingTime = performance.now() - this.processingStartTime;
        
        // Complete progress bar
        document.getElementById('progressFill').style.width = '100%';
        document.getElementById('statusText').textContent = 'Conversion complete!';
        
        setTimeout(() => {
            this.hideProcessingStatus();
            document.getElementById('resultsSection').style.display = 'block';
            
            // Display images in canvases
            this.displayImages();
            
            // Update information
            this.updateProcessingDetails(processingTime);
        }, 500);
    }
    
    displayImages() {
        // Display original image
        if (this.originalCanvas && this.originalImage) {
            const canvas = this.originalCanvas;
            const ctx = this.originalCtx;
            
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            canvas.style.width = canvas.offsetWidth + 'px';
            canvas.style.height = canvas.offsetHeight + 'px';
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            
            this.drawOriginalImage();
        }
        
        // Display hexagonal image
        if (this.hexCanvas && this.hexagonalImage) {
            const canvas = this.hexCanvas;
            const ctx = this.hexCtx;
            
            canvas.width = canvas.offsetWidth * window.devicePixelRatio;
            canvas.height = canvas.offsetHeight * window.devicePixelRatio;
            canvas.style.width = canvas.offsetWidth + 'px';
            canvas.style.height = canvas.offsetHeight + 'px';
            ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
            
            this.drawHexImage();
        }
    }
    
    drawOriginalImage() {
        if (!this.originalCanvas || !this.originalImage || !this.originalCtx) return;
        
        const canvas = this.originalCanvas;
        const ctx = this.originalCtx;
        const img = this.originalImage;
        
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        ctx.save();
        
        // Apply zoom and pan
        ctx.translate(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
        ctx.scale(this.originalZoom, this.originalZoom);
        ctx.translate(-canvas.offsetWidth / 2 + this.originalPanX, -canvas.offsetHeight / 2 + this.originalPanY);
        
        // Calculate scale to fit image in canvas
        const scale = Math.min(canvas.offsetWidth / img.width, canvas.offsetHeight / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        
        const x = (canvas.offsetWidth - scaledWidth) / 2;
        const y = (canvas.offsetHeight - scaledHeight) / 2;
        
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        ctx.restore();
    }
    
    drawHexImage() {
        if (!this.hexCanvas || !this.hexagonalImage || !this.hexCtx) return;
        
        const canvas = this.hexCanvas;
        const ctx = this.hexCtx;
        const img = this.hexagonalImage;
        
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
        ctx.save();
        
        // Apply zoom and pan
        ctx.translate(canvas.offsetWidth / 2, canvas.offsetHeight / 2);
        ctx.scale(this.hexZoom, this.hexZoom);
        ctx.translate(-canvas.offsetWidth / 2 + this.hexPanX, -canvas.offsetHeight / 2 + this.hexPanY);
        
        // Calculate scale to fit image in canvas
        const scale = Math.min(canvas.offsetWidth / img.width, canvas.offsetHeight / img.height);
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        
        const x = (canvas.offsetWidth - scaledWidth) / 2;
        const y = (canvas.offsetHeight - scaledHeight) / 2;
        
        ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        ctx.restore();
    }
    
    updateProcessingDetails(processingTime) {
        if (this.originalImage) {
            document.getElementById('originalInfo').textContent = 
                `Resolution: ${this.originalImage.width} × ${this.originalImage.height}`;
            document.getElementById('originalSize').textContent = 
                `${this.originalImage.width} × ${this.originalImage.height}`;
        }
        
        if (this.hexagonalImage) {
            document.getElementById('hexInfo').textContent = 
                `Hexagonal pixels: ${this.hexagonalImage.width} × ${this.hexagonalImage.height}`;
            document.getElementById('hexSize').textContent = 
                `${this.hexagonalImage.width} × ${this.hexagonalImage.height}`;
        }
        
        document.getElementById('processingTime').textContent = 
            `${(processingTime / 1000).toFixed(2)}s`;
        
        if (this.originalImage && this.hexagonalImage) {
            const originalPixels = this.originalImage.width * this.originalImage.height;
            const hexPixels = this.hexagonalImage.width * this.hexagonalImage.height;
            const ratio = ((1 - hexPixels / originalPixels) * 100).toFixed(1);
            document.getElementById('compressionRatio').textContent = `${ratio}% fewer pixels`;
        }
    }
    
    // Zoom and pan methods for original image
    zoomOriginal(factor) {
        this.originalZoom = Math.max(0.1, Math.min(5, this.originalZoom * factor));
        this.updateOriginalZoomDisplay();
        this.drawOriginalImage();
    }
    
    updateOriginalZoomDisplay() {
        const zoomPercent = Math.round(this.originalZoom * 100);
        document.getElementById('zoomLevelOriginal').textContent = `${zoomPercent}%`;
    }
    
    resetOriginalView() {
        this.originalZoom = 1;
        this.originalPanX = 0;
        this.originalPanY = 0;
        this.updateOriginalZoomDisplay();
        this.drawOriginalImage();
    }
    
    // Zoom and pan methods for hex image
    zoomHex(factor) {
        this.hexZoom = Math.max(0.1, Math.min(5, this.hexZoom * factor));
        this.updateHexZoomDisplay();
        this.drawHexImage();
    }
    
    updateHexZoomDisplay() {
        const zoomPercent = Math.round(this.hexZoom * 100);
        document.getElementById('zoomLevelHex').textContent = `${zoomPercent}%`;
    }
    
    resetHexView() {
        this.hexZoom = 1;
        this.hexPanX = 0;
        this.hexPanY = 0;
        this.updateHexZoomDisplay();
        this.drawHexImage();
    }
    
    // Pan interaction methods
    startPan(event, type) {
        const prop = type === 'original' ? 'originalIsPanning' : 'hexIsPanning';
        const lastProp = type === 'original' ? 'originalLastPanPoint' : 'hexLastPanPoint';
        
        this[prop] = true;
        this[lastProp] = { x: event.clientX, y: event.clientY };
    }
    
    pan(event, type) {
        const isPanningProp = type === 'original' ? 'originalIsPanning' : 'hexIsPanning';
        const lastProp = type === 'original' ? 'originalLastPanPoint' : 'hexLastPanPoint';
        const panXProp = type === 'original' ? 'originalPanX' : 'hexPanX';
        const panYProp = type === 'original' ? 'originalPanY' : 'hexPanY';
        const drawMethod = type === 'original' ? 'drawOriginalImage' : 'drawHexImage';
        
        if (!this[isPanningProp] || !this[lastProp]) return;
        
        const deltaX = event.clientX - this[lastProp].x;
        const deltaY = event.clientY - this[lastProp].y;
        
        this[panXProp] += deltaX;
        this[panYProp] += deltaY;
        
        this[lastProp] = { x: event.clientX, y: event.clientY };
        this[drawMethod]();
    }
    
    endPan(type) {
        const isPanningProp = type === 'original' ? 'originalIsPanning' : 'hexIsPanning';
        const lastProp = type === 'original' ? 'originalLastPanPoint' : 'hexLastPanPoint';
        
        this[isPanningProp] = false;
        this[lastProp] = null;
    }
    
    handleWheel(event, type) {
        event.preventDefault();
        const factor = event.deltaY > 0 ? 0.9 : 1.1;
        
        if (type === 'original') {
            this.zoomOriginal(factor);
        } else {
            this.zoomHex(factor);
        }
    }
    
    handleTouchStart(event, type) {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            this.startPan({ clientX: touch.clientX, clientY: touch.clientY }, type);
        }
    }
    
    handleTouchMove(event, type) {
        event.preventDefault();
        if (event.touches.length === 1 && this[type === 'original' ? 'originalIsPanning' : 'hexIsPanning']) {
            const touch = event.touches[0];
            this.pan({ clientX: touch.clientX, clientY: touch.clientY }, type);
        }
    }
    
    downloadHexImage() {
        if (!this.hexagonalImage) return;
        
        const link = document.createElement('a');
        link.download = 'hexagonal-image.png';
        link.href = this.hexagonalImage.src;
        link.click();
    }
    
    reset() {
        // Hide results and reset state
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('statusSection').style.display = 'none';
        
        // Clear images
        this.originalImage = null;
        this.hexagonalImage = null;
        
        // Reset zoom and pan
        this.originalZoom = 1;
        this.originalPanX = 0;
        this.originalPanY = 0;
        this.hexZoom = 1;
        this.hexPanX = 0;
        this.hexPanY = 0;
        
        // Clear canvases
        if (this.originalCtx) {
            this.originalCtx.clearRect(0, 0, this.originalCanvas.width, this.originalCanvas.height);
        }
        if (this.hexCtx) {
            this.hexCtx.clearRect(0, 0, this.hexCanvas.width, this.hexCanvas.height);
        }
        
        // Reset file input
        document.getElementById('fileInput').value = '';
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HexaImageConverter();
});