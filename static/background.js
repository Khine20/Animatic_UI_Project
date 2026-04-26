document.addEventListener("DOMContentLoaded", function() {
    const canvas = document.getElementById('arcade-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');

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
    const colors = ['#009338', '#F1EB82']; // The green and yellow from the original
    const types = ['pacman', 'ghost', 'invader', 'cherry'];
    const characters = [];
    const characterCount = 12; 

    for (let i = 0; i < characterCount; i++) {
        characters.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 2, // Velocity X
            vy: (Math.random() - 0.5) * 2, // Velocity Y
            type: types[Math.floor(Math.random() * types.length)],
            color: colors[Math.floor(Math.random() * colors.length)],
            frame: 0,
            size: 7
        });
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

    // ANIMATION 
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        frameCount++;

        characters.forEach(char => {
            char.x += char.vx;
            char.y += char.vy;

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

        requestAnimationFrame(animate);
    }
    animate();
});

//hi