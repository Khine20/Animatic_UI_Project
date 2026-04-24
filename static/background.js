/*
* Particles floating style using pixels.
* Implemented and inspired by "https://speckyboy.com/creative-snippets-pixelated-backgrounds/"
* Debugged using chat AI.
*/
document.addEventListener("DOMContentLoaded", function() {
    const pixelContainer = document.querySelector('.pixelCon');
    const totalPixels = 500; 
    let pixels = []; 

    // THE DEEP SEA DATA COLOR PALETTE 
    const deepSeaColors = ['#00ffff', '#87cefa', '#e0ffff'];

    // 1. Create the pixels
    for (let i = 0; i < totalPixels; i++) {
        let p = document.createElement('div');
        p.className = 'pixel';
        
        // Randomize the size
        let size = Math.random() * 4 + 2;
        p.style.width = size + 'px';
        p.style.height = size + 'px';
        
        // Randomize the transparency
        p.style.opacity = Math.random() * 0.6 + 0.1; 
 
        let randomColor = deepSeaColors[Math.floor(Math.random() * deepSeaColors.length)];
        p.style.backgroundColor = randomColor; 
        
        pixelContainer.appendChild(p);

        pixels.push({
            element: p,
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            speed: Math.random() * 1.5 + 0.5,
            waveOffset: Math.random() * Math.PI * 2 
        });
    }

    function animateWave() {
        pixels.forEach(p => {
            p.x -= p.speed;
            p.waveOffset += 0.02;

            let currentY = p.y + Math.sin(p.waveOffset) * 20;

            if(p.x < -20) {
                p.x = window.innerWidth + 20;
                p.y = Math.random() * window.innerHeight;
            }

            p.element.style.transform = `translate(${p.x}px, ${currentY}px)`;
        });
        requestAnimationFrame(animateWave);
    }
    animateWave();
});
