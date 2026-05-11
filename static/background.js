document.addEventListener("DOMContentLoaded", function() {
    const canvas = document.getElementById('arcade-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');

    const PARTICLE_COUNT = 12;
    const CONNECTOR_DISTANCE = 190;
    const HOVER_RADIUS = 220;
    const HOVER_PULL_MAX = 1.6;

    const mouse = {
        x: 0,
        y: 0,
        active: false
    };

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    });

    window.addEventListener('mouseleave', () => {
        mouse.active = false;
    });

    // Add CSS-variable based Parallax effect for the 3D grid
    const gridContainer = document.querySelector('.grid-container');
    if (gridContainer) {
        document.addEventListener('mousemove', (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 10; // Pan left/right
            const y = (e.clientY / window.innerHeight - 0.5) * 10; // Tilt up/down
            
            gridContainer.style.setProperty('--mouse-x', `${x}deg`);
            gridContainer.style.setProperty('--mouse-y', `${-y}deg`);
        });
    }

    // Make the canvas fit the exact screen size
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // THE SPRITE ARRAYS (1 = draw color, 0 = transparent)
    const pacmanFrames = [
        [
            [0,0,1,1,1,1,0,0], [0,1,1,1,1,1,1,0], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,0,0],
            [1,1,1,1,1,1,0,0], [1,1,1,1,1,1,1,1], [0,1,1,1,1,1,1,0], [0,0,1,1,1,1,0,0]
        ],
        [
            [0,0,1,1,1,1,0,0], [0,1,1,1,1,1,1,0], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1], [0,1,1,1,1,1,1,0], [0,0,1,1,1,1,0,0]
        ]
    ];

    const ghostFrames = [
        [
            [0,0,1,1,1,1,0,0], [0,1,1,1,1,1,1,0], [1,1,0,1,1,0,1,1], [1,1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1], [1,0,1,1,1,1,0,1]
        ]
    ];

    const invaderFrames = [
        [
            [0,0,1,0,0,0,1,0,0], [0,0,0,1,0,1,0,0,0], [0,0,1,1,1,1,1,0,0], [0,1,1,0,1,0,1,1,0],
            [1,1,1,1,1,1,1,1,1], [1,0,1,1,1,1,1,0,1], [1,0,1,0,0,0,1,0,1], [0,0,0,1,1,1,0,0,0]
        ]
    ];

    const cherryFrames = [
        [
            [0,0,0,1,1,0,0,0], [0,0,1,1,1,1,0,0], [1,1,0,0,0,1,1,1], [1,1,1,0,1,1,1,0],
            [0,1,1,1,1,1,0,0], [0,0,1,1,1,0,0,0]
        ]
    ];

    // THE CHARACTERS 
    const colors = ['#00ff62', '#F1EB82']; // The green and yellow from the original
    const types = ['pacman', 'ghost', 'invader', 'cherry'];
    const characters = [];
    const characterCount = PARTICLE_COUNT;

    for (let i = 0; i < characterCount; i++) {
        characters.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            type: types[Math.floor(Math.random() * types.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            frame: 0,
            size: 7,
            particleIndex: i,
            lastParticleX: null,
            lastParticleY: null
        });
    }

    function initParticlesMotion() {
        if (typeof window.particlesJS !== 'function') return null;

        window.particlesJS('motion-particles', {
            particles: {
                number: {
                    value: PARTICLE_COUNT,
                    density: { enable: false }
                },
                color: { value: '#ffffff' },
                shape: { type: 'circle' },
                opacity: {
                    value: 1,
                    random: false
                },
                size: {
                    value: 2,
                    random: false
                },
                line_linked: {
                    enable: true,
                    distance: 150,
                    color: '#ffffff',
                    opacity: 0.4,
                    width: 1
                },
                move: {
                    enable: true,
                    speed: 2,
                    direction: 'none',
                    random: true,
                    straight: false,
                    out_mode: 'out',
                    bounce: false
                }
            },
            interactivity: {
                detect_on: 'window',
                events: {
                    onhover: { enable: false },
                    onclick: { enable: false },
                    resize: true
                },
                modes: {}
            },
            retina_detect: true
        });

        if (!window.pJSDom || window.pJSDom.length === 0) return null;
        return window.pJSDom[window.pJSDom.length - 1].pJS;
    }

    const particlesEngine = initParticlesMotion();

    function updateCharacterFromParticle(char) {
        if (!particlesEngine || !particlesEngine.particles || !particlesEngine.particles.array) {
            return false;
        }

        const particle = particlesEngine.particles.array[char.particleIndex];
        if (!particle) return false;

        if (char.lastParticleX === null || char.lastParticleY === null) {
            char.lastParticleX = particle.x;
            char.lastParticleY = particle.y;
            char.x = particle.x;
            char.y = particle.y;
            return true;
        }

        const dx = particle.x - char.lastParticleX;
        const dy = particle.y - char.lastParticleY;

        char.vx = dx;
        char.vy = dy;
        char.x += dx;
        char.y += dy;

        char.lastParticleX = particle.x;
        char.lastParticleY = particle.y;
        return true;
    }

    let frameCount = 0;

    // DRAWING LOGIC
    function drawCharacter(char) {
        let sprite;
        if (char.type === 'pacman') sprite = pacmanFrames[char.frame];
        else if (char.type === 'ghost') sprite = ghostFrames[0];
        else if (char.type === 'invader') sprite = invaderFrames[0];
        else if (char.type === 'cherry') sprite = cherryFrames[0];

        ctx.fillStyle = char.color;

        for (let row = 0; row < sprite.length; row++) {
            for (let col = 0; col < sprite[row].length; col++) {
                if (sprite[row][col] === 1) {
                    ctx.fillRect(
                        char.x + (col * char.size), 
                        char.y + (row * char.size), 
                        char.size, 
                        char.size
                    );
                }
            }
        }
    }

    function getCharacterCenter(char) {
        return {
            x: char.x + (4 * char.size),
            y: char.y + (4 * char.size)
        };
    }

    function applyHoverGravity(char) {
        if (!mouse.active) return;

        const center = getCharacterCenter(char);
        const dx = mouse.x - center.x;
        const dy = mouse.y - center.y;
        const distance = Math.hypot(dx, dy);

        if (distance === 0 || distance > HOVER_RADIUS) return;

        const influence = 1 - (distance / HOVER_RADIUS);
        const pull = influence * HOVER_PULL_MAX;

        char.x += (dx / distance) * pull;
        char.y += (dy / distance) * pull;
    }

    function drawConnectors(list) {
        ctx.save();
        ctx.lineWidth = 1;

        for (let i = 0; i < list.length; i++) {
            const a = getCharacterCenter(list[i]);

            for (let j = i + 1; j < list.length; j++) {
                const b = getCharacterCenter(list[j]);
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const distance = Math.hypot(dx, dy);

                if (distance > CONNECTOR_DISTANCE) continue;

                let alpha = 0.22 * (1 - (distance / CONNECTOR_DISTANCE));

                if (mouse.active) {
                    const da = Math.hypot(mouse.x - a.x, mouse.y - a.y);
                    const db = Math.hypot(mouse.x - b.x, mouse.y - b.y);
                    if (da < HOVER_RADIUS || db < HOVER_RADIUS) {
                        alpha += 0.18;
                    }
                }

                ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(alpha, 0.45)})`;
                ctx.beginPath();
                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
                ctx.stroke();
            }
        }

        ctx.restore();
    }

    // ANIMATION 
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frameCount++;

        characters.forEach(char => {
            const movedByParticle = updateCharacterFromParticle(char);
            if (!movedByParticle) {
                char.x += char.vx;
                char.y += char.vy;
            }

            applyHoverGravity(char);

            const charWidth = 8 * char.size;
            const charHeight = 8 * char.size;

            if (char.x < -charWidth) char.x = canvas.width;
            else if (char.x > canvas.width) char.x = -charWidth;

            if (char.y < -charHeight) char.y = canvas.height;
            else if (char.y > canvas.height) char.y = -charHeight;

            // Pacman mouth animation 
            if (char.type === 'pacman' && frameCount % 20 === 0) {
                char.frame = (char.frame === 0) ? 1 : 0;
            }

            drawCharacter(char);
        });

        drawConnectors(characters);

        requestAnimationFrame(animate);
    }
    animate();
});