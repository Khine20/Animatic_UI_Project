(function (global) {
    "use strict";

    function mount(target, options) {
        const root = typeof target === "string" ? document.querySelector(target) : target;

        if (!root) {
            throw new Error("AnimaticCanvasModule mount target not found.");
        }

        if (root.__animaticMounted) {
            return root.__animaticApi;
        }

        const settings = Object.assign(
            {
                width: 800,
                height: 600,
                fps: parseInt(root.dataset.fps || "12", 10),
                maxFrames: parseInt(root.dataset.maxFrames || "30", 10)
            },
            options || {}
        );

        const mainCanvasContainer = root.querySelector('[data-role="canvas-main"]');
        const onionCanvas = root.querySelector('[data-role="canvas-onion"]');
        const timeline = root.querySelector('[data-role="timeline"]');
        const frameSlider = root.querySelector('[data-role="frame-slider"]');
        const statusCoords = root.querySelector('[data-role="status-coords"]');
        const playIcon = root.querySelector('[data-role="play-icon"]');
        const playText = root.querySelector('[data-role="play-text"]');
        const toolButtons = root.querySelectorAll('[data-action="set-tool"]');

        if (!mainCanvasContainer || !onionCanvas || !timeline || !frameSlider || !statusCoords || !playIcon || !playText) {
            throw new Error("Animator module markup is incomplete.");
        }

        const onionCtx = onionCanvas.getContext("2d");
        let p5Inst = null;
        let mainCtx = null; // set after p5 creates its canvas

        const state = {
            frames: [],
            currentFrame: 0,
            isDrawing: false,
            tool: "pen",
            onionSkin: false,
            playing: false,
            playInterval: null
        };

        function initCanvases() {
            onionCanvas.width = settings.width;
            onionCanvas.height = settings.height;

            const sketch = function (p) {
                let prevX = null;
                let prevY = null;

                p.setup = function () {
                    p.pixelDensity(1);
                    const renderer = p.createCanvas(settings.width, settings.height);
                    renderer.canvas.style.cssText =
                        "position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair;display:block;";
                    p.noLoop();
                    p.clear();
                    mainCtx = renderer.canvas.getContext("2d");
                    // Setup must complete before we can access p5Inst.canvas
                    state.frames.push(p5Inst.canvas.toDataURL());
                    updateTimeline();
                    bindEvents();
                };

                function applyTool() {
                    p.noFill();
                    p.strokeCap(p.ROUND);
                    p.strokeJoin(p.ROUND);
                    if (state.tool === "eraser") {
                        p.drawingContext.globalCompositeOperation = "destination-out";
                        p.stroke(255);
                        p.strokeWeight(40);
                    } else {
                        p.drawingContext.globalCompositeOperation = "source-over";
                        p.stroke(0);
                        p.strokeWeight(5);
                    }
                }

                function resetComposite() {
                    p.drawingContext.globalCompositeOperation = "source-over";
                }

                function inBounds() {
                    return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
                }

                p.mousePressed = function () {
                    if (state.playing || !inBounds()) { return; }
                    state.isDrawing = true;
                    prevX = p.mouseX;
                    prevY = p.mouseY;
                    applyTool();
                    p.point(p.mouseX, p.mouseY);
                    resetComposite();
                };

                p.mouseDragged = function () {
                    if (!state.isDrawing) { return; }
                    statusCoords.textContent = Math.round(p.mouseX) + ", " + Math.round(p.mouseY);
                    applyTool();
                    p.line(prevX, prevY, p.mouseX, p.mouseY);
                    resetComposite();
                    prevX = p.mouseX;
                    prevY = p.mouseY;
                    return false;
                };

                p.mouseReleased = function () {
                    if (!state.isDrawing) { return; }
                    state.isDrawing = false;
                    prevX = null;
                    prevY = null;
                    saveFrame();
                };

                p.touchStarted = function () {
                    if (state.playing) { return false; }
                    state.isDrawing = true;
                    prevX = p.mouseX;
                    prevY = p.mouseY;
                    applyTool();
                    p.point(p.mouseX, p.mouseY);
                    resetComposite();
                    return false;
                };

                p.touchMoved = function () {
                    if (!state.isDrawing) { return false; }
                    applyTool();
                    p.line(prevX, prevY, p.mouseX, p.mouseY);
                    resetComposite();
                    prevX = p.mouseX;
                    prevY = p.mouseY;
                    return false;
                };

                p.touchEnded = function () {
                    if (!state.isDrawing) { return false; }
                    state.isDrawing = false;
                    prevX = null;
                    prevY = null;
                    saveFrame();
                    return false;
                };
            };

            p5Inst = new p5(sketch, mainCanvasContainer);
        }

        function setTool(nextTool) {
            state.tool = nextTool;
            toolButtons.forEach((button) => {
                button.classList.toggle("is-active", button.dataset.tool === nextTool);
            });
        }

        function saveFrame() {
            state.frames[state.currentFrame] = p5Inst.canvas.toDataURL();
            updateTimeline();
        }

        function clearCanvas() {
            mainCtx.clearRect(0, 0, settings.width, settings.height);
            saveFrame();
        }

        function addFrame() {
            if (state.frames.length >= settings.maxFrames) {
                return;
            }

            saveFrame();
            state.currentFrame = state.frames.length;
            mainCtx.clearRect(0, 0, settings.width, settings.height);
            state.frames.push(p5Inst.canvas.toDataURL());
            loadFrame(state.currentFrame);
            scrollToActive();
        }

        function loadFrame(index) {
            state.currentFrame = index;
            mainCtx.clearRect(0, 0, settings.width, settings.height);
            onionCtx.clearRect(0, 0, onionCanvas.width, onionCanvas.height);

            if (state.onionSkin && !state.playing) {
                const range = 3;
                for (let i = state.currentFrame - range; i <= state.currentFrame + range; i += 1) {
                    if (i >= 0 && i < state.frames.length && i !== state.currentFrame) {
                        const distance = Math.abs(i - state.currentFrame);
                        const onionImg = new Image();
                        onionImg.onload = function () {
                            onionCtx.save();
                            onionCtx.globalAlpha = 0.4 / (distance * 1.5);
                            onionCtx.drawImage(onionImg, 0, 0);
                            onionCtx.restore();
                        };
                        onionImg.src = state.frames[i];
                    }
                }
            }

            const image = new Image();
            image.onload = function () {
                mainCtx.drawImage(image, 0, 0);
            };
            image.src = state.frames[state.currentFrame] || "";

            updateTimeline();
        }

        function toggleOnion() {
            state.onionSkin = !state.onionSkin;
            const button = root.querySelector('[data-action="toggle-onion"]');
            if (button) {
                button.classList.toggle("is-active", state.onionSkin);
            }
            loadFrame(state.currentFrame);
        }

        function scrubFrame(nextValue) {
            if (state.playing) {
                return;
            }
            loadFrame(parseInt(nextValue, 10) - 1);
        }

        function updateTimeline() {
            timeline.innerHTML = "";
            frameSlider.max = String(Math.max(1, state.frames.length));
            frameSlider.value = String(state.currentFrame + 1);

            state.frames.forEach((data, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "animator-btn animator-thumb" + (index === state.currentFrame ? " is-active" : "");

                if (data && data.length > 100) {
                    const thumb = document.createElement("img");
                    thumb.src = data;
                    thumb.alt = "Frame " + (index + 1);
                    button.appendChild(thumb);
                } else {
                    button.textContent = String(index + 1);
                }

                button.addEventListener("click", function () {
                    if (!state.playing) {
                        loadFrame(index);
                    }
                });

                timeline.appendChild(button);
            });
        }

        function scrollToActive() {
            const active = timeline.querySelector(".is-active");
            if (active) {
                active.scrollIntoView({ behavior: "smooth", inline: "center" });
            }
        }

        function togglePlay() {
            state.playing = !state.playing;

            if (state.playing) {
                onionCtx.clearRect(0, 0, onionCanvas.width, onionCanvas.height);
                playText.textContent = "Stop";
                playIcon.textContent = "[]";

                let frameIndex = 0;
                state.playInterval = setInterval(function () {
                    const image = new Image();
                    image.onload = function () {
                        mainCtx.clearRect(0, 0, settings.width, settings.height);
                        mainCtx.drawImage(image, 0, 0);
                    };
                    image.src = state.frames[frameIndex] || state.frames[0] || "";
                    frameSlider.value = String(frameIndex + 1);
                    frameIndex = (frameIndex + 1) % state.frames.length;
                }, 1000 / settings.fps);
            } else {
                clearInterval(state.playInterval);
                state.playInterval = null;
                playText.textContent = "Play (" + settings.fps + "fps)";
                playIcon.textContent = ">";
                loadFrame(state.currentFrame);
            }
        }

        function handleActionClick(event) {
            const button = event.target.closest("[data-action]");
            if (!button || !root.contains(button)) {
                return;
            }

            const action = button.dataset.action;

            if (action === "set-tool") {
                setTool(button.dataset.tool || "pen");
                return;
            }

            if (action === "clear") {
                clearCanvas();
                return;
            }

            if (action === "toggle-onion") {
                toggleOnion();
                return;
            }

            if (action === "add-frame") {
                addFrame();
                return;
            }

            if (action === "toggle-play") {
                togglePlay();
            }
        }

        function bindEvents() {
            // Drawing events are handled by the p5.js sketch inside initCanvases()
            frameSlider.addEventListener("input", function (event) {
                if (state.playing) return; // Ignore input during playback
                scrubFrame(event.target.value);
            });
            root.addEventListener("click", handleActionClick);
        }

        function destroy() {
            clearInterval(state.playInterval);
            if (p5Inst) { p5Inst.remove(); }
            root.__animaticMounted = false;
            root.__animaticApi = null;
        }

        initCanvases();

        const api = {
            setTool: setTool,
            clear: clearCanvas,
            destroy: destroy
        };

        root.__animaticMounted = true;
        root.__animaticApi = api;

        return api;
    }

    global.AnimaticCanvasModule = {
        mount: mount
    };
})(window);