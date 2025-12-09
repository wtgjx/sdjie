document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('fileInput');
    const uploadZone = document.getElementById('uploadZone');
    const avatarDisplay = document.getElementById('avatarDisplay');
    const editorCanvas = document.getElementById('editorCanvas');
    const imageWrapper = document.getElementById('imageWrapper');
    const btnGenerate = document.getElementById('btnGenerate');
    const btnChange = document.getElementById('btnChange');
    const btnSave = document.getElementById('btnSave');
    const btnReset = document.getElementById('btnReset');
    const initialControls = document.getElementById('initialControls');
    const resultControls = document.getElementById('resultControls');
    const statusArea = document.getElementById('statusArea');
    const progressBarFill = document.getElementById('progressBarFill');
    const adjustControls = document.getElementById('adjustControls');
    const themeSelector = document.getElementById('themeSelector');
    const soundToggle = document.getElementById('soundToggle');
    const musicToggle = document.getElementById('musicToggle');
    const bgmAudio = document.getElementById('bgmAudio');
    const decorContainer = document.getElementById('decorationsContainer');
    const santaContainer = document.getElementById('santaContainer');
    const mainContent = document.querySelector('.main-content');

    // --- Theme System ---
    let soundEnabled = true;
    let musicEnabled = false; // Start off by default (or let user toggle)
    let snowInterval = null;
    let santaInterval = null;

    // Initialize Theme
    function setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        
        if (theme === 'christmas') {
            startSnow();
            startSanta();
            enableTilt();
        } else {
            stopSnow();
            stopSanta();
            disableTilt();
        }
    }

    themeSelector.addEventListener('change', (e) => {
        setTheme(e.target.value);
    });
    
    // Set default theme
    setTheme('christmas');

    // --- 3D Tilt Effect ---
    function enableTilt() {
        document.addEventListener('mousemove', handleTilt);
    }
    
    function disableTilt() {
        document.removeEventListener('mousemove', handleTilt);
        mainContent.style.transform = 'none';
    }
    
    function handleTilt(e) {
        if (!mainContent) return;
        const rect = mainContent.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        // Limit rotation to small angles
        const rotateX = -y / 20; 
        const rotateY = x / 20;
        
        mainContent.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }

    // --- Flying Santa with Avatar Snake ---
    function startSanta() {
        if (santaInterval) return;
        
        flySanta(); 
        
        santaInterval = setInterval(() => {
            flySanta();
        }, 8000 + Math.random() * 5000);
    }
    
    function stopSanta() {
        if (santaInterval) {
            clearInterval(santaInterval);
            santaInterval = null;
        }
        santaContainer.classList.remove('santa-fly');
        santaContainer.innerHTML = '🎅🦌🛷💨'; // Reset content
    }
    
    function flySanta() {
        // Fetch recent avatars to append to Santa
        fetch('/api/avatars')
            .then(res => res.json())
            .then(avatars => {
                // Build the snake
                // Structure: Santa -> Avatar1 -> Avatar2 ...
                let snakeHtml = '<span class="santa-head">🎅🦌🛷💨</span>';
                
                if (avatars && avatars.length > 0) {
                    snakeHtml += '<div class="avatar-trail">';
                    avatars.forEach((avatar, index) => {
                        // Limit to 5-8 avatars for performance/visuals
                        if (index < 8) {
                             snakeHtml += `<img src="${avatar.url}" class="trail-avatar" style="animation-delay: ${index * 0.1}s">`;
                        }
                    });
                    snakeHtml += '</div>';
                }
                
                santaContainer.innerHTML = snakeHtml;
                
                // Randomize Start Position
                const randomTop = Math.floor(Math.random() * 60) + 10; // 10% to 70%
                santaContainer.style.top = `${randomTop}%`;

                // Randomize Flight Path (using CSS variables)
                const y1 = (Math.random() * 200 - 100) + 'px';
                const y2 = (Math.random() * 200 - 100) + 'px';
                const y3 = (Math.random() * 200 - 100) + 'px';
                const y4 = (Math.random() * 200 - 100) + 'px';
                
                santaContainer.style.setProperty('--fly-y-1', y1);
                santaContainer.style.setProperty('--fly-y-2', y2);
                santaContainer.style.setProperty('--fly-y-3', y3);
                santaContainer.style.setProperty('--fly-y-4', y4);

                // Trigger Animation
                santaContainer.classList.remove('santa-fly');
                void santaContainer.offsetWidth; // Trigger reflow
                santaContainer.classList.add('santa-fly');
                
                // Start Dropping Gifts/Particles
                startDroppingGifts();
            })
            .catch(err => {
                console.error("Failed to load avatars for snake:", err);
                // Fallback to just Santa
                santaContainer.innerHTML = '🎅🦌🛷💨';
                santaContainer.classList.remove('santa-fly');
                void santaContainer.offsetWidth;
                santaContainer.classList.add('santa-fly');
                startDroppingGifts(); // Still drop gifts even if no avatars
            });
    }
    
    // --- Particle System for Santa ---
    let dropInterval = null;

    function startDroppingGifts() {
        if (dropInterval) clearInterval(dropInterval);

        const duration = 7000; // Match CSS animation
        const startTime = Date.now();
        
        dropInterval = setInterval(() => {
            if (Date.now() - startTime > duration) {
                clearInterval(dropInterval);
                return;
            }
            
            spawnParticles();
        }, 100); // Emit freq
    }

    function spawnParticles() {
        // Get Santa position
        const santaRect = santaContainer.getBoundingClientRect();
        
        // Only spawn if vaguely on screen (or just entering/leaving)
        if (santaRect.right < -100 || santaRect.left > window.innerWidth + 100) return;

        // Spawn from Santa (approximate center of sleigh)
        createParticle(santaRect.left + 50, santaRect.top + 40);

        // Spawn from Avatars
        const avatars = document.querySelectorAll('.trail-avatar');
        avatars.forEach(avatar => {
            const rect = avatar.getBoundingClientRect();
            // Random chance to drop from each avatar to avoid clutter
            if (Math.random() > 0.7) {
                createParticle(rect.left + 30, rect.top + 30);
            }
        });
    }

    function createParticle(x, y) {
        const p = document.createElement('div');
        // Mix of snowflakes, sparkles, gifts, bells, tree
        const symbols = ['❄️', '✨', '🎁', '🔔', '🎄', '🍬']; 
        p.innerText = symbols[Math.floor(Math.random() * symbols.length)];
        p.style.position = 'fixed';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.fontSize = (Math.random() * 15 + 10) + 'px'; // 10-25px
        p.className = 'falling-particle';
        
        // Random horizontal drift
        const drift = (Math.random() * 60 - 30) + 'px';
        p.style.setProperty('--drift', drift); 
        
        document.body.appendChild(p);
        
        // Cleanup
        setTimeout(() => { 
            if(p.parentNode) p.parentNode.removeChild(p); 
        }, 1500);
    }

    // Sound Toggle
    soundToggle.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundToggle.innerText = soundEnabled ? '🔊' : '🔇';
    });

    // Music Toggle
    musicToggle.innerText = '🔇'; // Default to off state visually
    musicToggle.style.opacity = '0.7';

    function playMusic() {
        bgmAudio.play().then(() => {
            musicEnabled = true;
            musicToggle.innerText = '🎵';
            musicToggle.style.opacity = '1';
            // Remove global listener if it worked
            document.removeEventListener('click', playMusic);
        }).catch(err => {
            console.log("Autoplay prevented. Waiting for user interaction.");
            // If autoplay fails, we need a user interaction
        });
    }

    // Attempt autoplay immediately
    playMusic();

    // Also add a global click listener to start music on first interaction if autoplay failed
    document.addEventListener('click', playMusic);

    musicToggle.addEventListener('click', (e) => {
        // Stop propagation so it doesn't trigger the global listener immediately again (though we remove it)
        e.stopPropagation(); 
        
        if (bgmAudio.paused) {
            playMusic();
        } else {
            bgmAudio.pause();
            musicEnabled = false;
            musicToggle.innerText = '🔇';
            musicToggle.style.opacity = '0.7';
        }
    });

    function playSound() {
        if (!soundEnabled) return;
        
        // Simple bell sound synthesis
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, t);
        osc.frequency.exponentialRampToValueAtTime(110, t + 1.5);
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 1.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 1.5);
    }

    // Snow Effect
    function startSnow() {
        if (snowInterval) return;
        
        // Create initial batch
        for(let i=0; i<10; i++) createSnowflake();
        
        snowInterval = setInterval(createSnowflake, 500);
    }

    function stopSnow() {
        if (snowInterval) {
            clearInterval(snowInterval);
            snowInterval = null;
        }
        decorContainer.innerHTML = '';
    }

    function createSnowflake() {
        const flake = document.createElement('div');
        flake.classList.add('snowflake');
        flake.innerText = ['❄', '❅', '❆'][Math.floor(Math.random() * 3)];
        flake.style.left = Math.random() * 100 + 'vw';
        flake.style.animationDuration = (Math.random() * 5 + 5) + 's';
        flake.style.opacity = Math.random() * 0.7 + 0.3;
        flake.style.fontSize = (Math.random() * 15 + 10) + 'px';
        
        decorContainer.appendChild(flake);
        
        // Cleanup
        setTimeout(() => {
            if (flake.parentNode) flake.parentNode.removeChild(flake);
        }, 10000);
    }

    let currentImage = null; // Image object
    let hatImage = null; // Image object
    let isProcessing = false;
    let isEditing = false;
    let originalImageDataURL = null;

    // Hat State
    let hatState = {
        x: 0,
        y: 0,
        width: 100,
        height: 100,
        rotation: 0,
        isDragging: false,
        dragStartX: 0,
        dragStartY: 0
    };

    // Load Hat Image
    const hatImg = new Image();
    hatImg.src = 'hat.svg';
    hatImg.onload = () => {
        hatImage = hatImg;
    };

    // Click upload zone
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Click wrapper (if empty)
    imageWrapper.addEventListener('click', (e) => {
        if (!imageWrapper.classList.contains('has-result') && !currentImage) {
            fileInput.click();
        }
    });

    // File Selection
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                originalImageDataURL = e.target.result;
                const img = new Image();
                img.onload = () => {
                    currentImage = img;
                    startEditing();
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Change Button
    btnChange.addEventListener('click', () => {
        fileInput.click();
    });

    // Start Editing Mode
    function startEditing() {
        uploadZone.style.display = 'none';
        avatarDisplay.style.display = 'none';
        editorCanvas.style.display = 'block';
        btnGenerate.disabled = false;
        btnChange.style.display = 'block';
        adjustControls.style.display = 'block';
        isEditing = true;

        // Init Canvas
        const maxWidth = 500;
        const scale = Math.min(1, maxWidth / currentImage.width);
        editorCanvas.width = currentImage.width * scale;
        editorCanvas.height = currentImage.height * scale;

        // Init Hat Position (Top Center)
        hatState.width = editorCanvas.width * 0.4;
        hatState.height = hatState.width; // Square SVG
        hatState.x = (editorCanvas.width - hatState.width) / 2;
        hatState.y = -hatState.height * 0.2; // Slightly above

        drawCanvas();
    }

    // Draw Canvas
    function drawCanvas() {
        if (!currentImage) return;
        const ctx = editorCanvas.getContext('2d');
        ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);

        // Draw User Image
        ctx.drawImage(currentImage, 0, 0, editorCanvas.width, editorCanvas.height);

        // Draw Hat
        if (hatImage) {
            ctx.save();
            ctx.translate(hatState.x + hatState.width / 2, hatState.y + hatState.height / 2);
            ctx.rotate(hatState.rotation * Math.PI / 180);
            ctx.drawImage(hatImage, -hatState.width / 2, -hatState.height / 2, hatState.width, hatState.height);
            ctx.restore();
        }
    }

    // Canvas Interactions
    editorCanvas.addEventListener('mousedown', (e) => {
        if (!isEditing) return;
        const rect = editorCanvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (editorCanvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (editorCanvas.height / rect.height);

        // Simple hit test
        if (mouseX >= hatState.x && mouseX <= hatState.x + hatState.width &&
            mouseY >= hatState.y && mouseY <= hatState.y + hatState.height) {
            hatState.isDragging = true;
            hatState.dragStartX = mouseX - hatState.x;
            hatState.dragStartY = mouseY - hatState.y;
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (!hatState.isDragging) return;
        const rect = editorCanvas.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) * (editorCanvas.width / rect.width);
        const mouseY = (e.clientY - rect.top) * (editorCanvas.height / rect.height);

        hatState.x = mouseX - hatState.dragStartX;
        hatState.y = mouseY - hatState.dragStartY;
        drawCanvas();
    });

    window.addEventListener('mouseup', () => {
        hatState.isDragging = false;
    });

    // Scroll to resize
    editorCanvas.addEventListener('wheel', (e) => {
        if (!isEditing) return;
        e.preventDefault();
        const scaleAmount = 0.1;
        if (e.deltaY < 0) {
            hatState.width *= (1 + scaleAmount);
            hatState.height *= (1 + scaleAmount);
        } else {
            hatState.width *= (1 - scaleAmount);
            hatState.height *= (1 - scaleAmount);
        }
        drawCanvas();
    }, { passive: false });


    // Generate (AI API)
    btnGenerate.addEventListener('click', () => {
        if (!currentImage || isProcessing) return;

        playSound();
        
        isProcessing = true;
        isEditing = false;
        btnGenerate.disabled = true;
        adjustControls.style.display = 'none';
        statusArea.style.display = 'block';
        
        // Start fake progress for UX
        let progress = 0;
        const interval = setInterval(() => {
            if (progress >= 90) return;
            progress += 1;
            progressBarFill.style.width = `${progress}%`;
        }, 100);

        // Get Image Data (Base64)
        // Note: The API might expect the URL directly or Base64. 
        // If we use the canvas content (user might have cropped/adjusted? No, let's use the original uploaded image if possible, 
        // or the canvas content if we want to support the user's "current view" which currently just has the user image).
        // To be safe and simple, let's send the original file data.
        
        // However, we are in 'editing' mode where we drew on canvas. 
        // Let's just grab the canvas dataURL (without the hat drawn on it yet? 
        // Actually, the user wants the AI to add the hat. So we should send the raw user image.)
        
        // We need to get the base64 of the currentImage. 
        // Since we already loaded it into 'currentImage' (Image object), we can draw it to a temp canvas to get base64 
        // OR just use the FileReader result if we stored it. 
        // Let's use the editorCanvas but clear the hat first.
        
        let imageData = originalImageDataURL;
        if (!imageData) {
            const ctx = editorCanvas.getContext('2d');
            ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);
            ctx.drawImage(currentImage, 0, 0, editorCanvas.width, editorCanvas.height);
            imageData = editorCanvas.toDataURL('image/png');
        }
        
        // Get Selected Hat Style
        const selectedHat = document.querySelector('input[name="hatStyle"]:checked').value;

        fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image: imageData, // Send Base64
                hatStyle: selectedHat
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => { throw new Error(err.error?.message || 'API Error'); });
            }
            return response.json();
        })
        .then(data => {
            clearInterval(interval);
            progressBarFill.style.width = '100%';
            
            if (data.data && data.data.length > 0 && data.data[0].url) {
                const resultUrl = data.data[0].url;
                finishProcessing(resultUrl);
            } else {
                throw new Error('No image url in response');
            }
        })
        .catch(err => {
            clearInterval(interval);
            console.error(err);
            isProcessing = false;
            statusArea.style.display = 'none';
            btnGenerate.disabled = false;
            adjustControls.style.display = 'block'; // Show controls again
            alert('生成失败: ' + err.message);
            // Restore canvas state
            drawCanvas();
        });
    });

    function finishProcessing(resultUrl) {
        isProcessing = false;
        
        // Determine if we need to proxy the image or use it directly
        // Local files (starting with /) can be loaded directly
        // Remote URLs (http...) need the proxy
        let finalUrl = resultUrl;
        
        if (resultUrl.startsWith('http')) {
             finalUrl = `/api/proxy_image?url=${encodeURIComponent(resultUrl)}`;
        }
        
        avatarDisplay.src = finalUrl;
        
        // Switch views
        editorCanvas.style.display = 'none'; 
        avatarDisplay.style.display = 'block'; 
        
        statusArea.style.display = 'none';
        initialControls.style.display = 'none';
        resultControls.style.display = 'block';
        imageWrapper.classList.add('has-result');
        
        progressBarFill.style.width = '0%';
    }

    // Save
    btnSave.addEventListener('click', () => {
        if (avatarDisplay.src) {
            const link = document.createElement('a');
            link.download = 'christmas-avatar.png';
            link.href = avatarDisplay.src;
            link.click();
        }
    });

    // Reset
    btnReset.addEventListener('click', () => {
        currentImage = null;
        fileInput.value = '';
        avatarDisplay.src = '';
        avatarDisplay.style.display = 'none';
        editorCanvas.style.display = 'none';
        uploadZone.style.display = 'flex';
        imageWrapper.classList.remove('has-result');
        
        initialControls.style.display = 'block';
        resultControls.style.display = 'none';
        btnGenerate.disabled = true;
        btnChange.style.display = 'none';
        adjustControls.style.display = 'none';
        
        isEditing = false;
        isProcessing = false;
    });
});
