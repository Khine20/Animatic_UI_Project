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
                maxFrames: parseInt(root.dataset.maxFrames || "30", 10),
                draggable: false
            },
            options || {}
        );

        const mainCanvas = root.querySelector('[data-role="canvas-main"]');
        const onionCanvas = root.querySelector('[data-role="canvas-onion"]');
        const timeline = root.querySelector('[data-role="timeline"]');
        const frameSlider = root.querySelector('[data-role="frame-slider"]');
        const statusCoords = root.querySelector('[data-role="status-coords"]');
        const playIcon = root.querySelector('[data-role="play-icon"]');
        const playText = root.querySelector('[data-role="play-text"]');
        const toolButtons = root.querySelectorAll('[data-action="set-tool"]');

        if (!mainCanvas || !onionCanvas || !timeline || !frameSlider || !statusCoords || !playIcon || !playText) {
            throw new Error("Animator module markup is incomplete.");
        }

        const ctx = mainCanvas.getContext("2d", { willReadFrequently: true });
        const onionCtx = onionCanvas.getContext("2d");

        const state = {
            frames: [],
            currentFrame: 0,
            isDrawing: false,
            tool: "pen",
            onionSkin: false,
            playing: false,
            playInterval: null,
            dragPointerId: null,
            dragOffsetX: 0,
            dragOffsetY: 0
        };

        function initCanvases() {
            [mainCanvas, onionCanvas].forEach((canvas) => {
                canvas.width = settings.width;
                canvas.height = settings.height;
            });
            ctx.clearRect(0, 0, settings.width, settings.height);
        }

        function getCoords(event) {
            const rect = mainCanvas.getBoundingClientRect();
            const clientX = event.touches ? event.touches[0].clientX : event.clientX;
            const clientY = event.touches ? event.touches[0].clientY : event.clientY;
            const scaleX = mainCanvas.width / rect.width;
            const scaleY = mainCanvas.height / rect.height;
            return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
        }

        function setTool(nextTool) {
            state.tool = nextTool;
            toolButtons.forEach((button) => {
                button.classList.toggle("is-active", button.dataset.tool === nextTool);
            });
        }

        function saveFrame() {
            state.frames[state.currentFrame] = mainCanvas.toDataURL();
            updateTimeline();
        }

        function startDrawing(event) {
            if (state.playing) {
                return;
            }

            state.isDrawing = true;
            const pos = getCoords(event);
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            if (state.tool === "eraser") {
                ctx.globalCompositeOperation = "destination-out";
                ctx.lineWidth = 40;
            } else {
                ctx.globalCompositeOperation = "source-over";
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 5;
            }

            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);

            if (event.cancelable) {
                event.preventDefault();
            }
        }

        function moveDrawing(event) {
            const pos = getCoords(event);
            statusCoords.textContent = Math.round(pos.x) + ", " + Math.round(pos.y);

            if (!state.isDrawing) {
                return;
            }

            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();

            if (event.cancelable) {
                event.preventDefault();
            }
        }

        function stopDrawing() {
            if (!state.isDrawing) {
                return;
            }

            state.isDrawing = false;
            saveFrame();
        }

        function clearCanvas() {
            ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
            saveFrame();
        }

        function addFrame() {
            if (state.frames.length >= settings.maxFrames) {
                return;
            }

            saveFrame();
            state.currentFrame = state.frames.length;
            ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
            state.frames.push(mainCanvas.toDataURL());
            loadFrame(state.currentFrame);
            scrollToActive();
        }

        function loadFrame(index) {
            state.currentFrame = index;
            ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
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
                ctx.drawImage(image, 0, 0);
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
                        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
                        ctx.drawImage(image, 0, 0);
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

        function setupDragging() {
            if (!settings.draggable) {
                return;
            }

            const handle = root.querySelector("[data-drag-handle]");
            if (!handle) {
                return;
            }

            root.classList.add("is-draggable");
            root.style.left = root.style.left || "24px";
            root.style.top = root.style.top || "24px";

            function onPointerMove(event) {
                if (state.dragPointerId !== event.pointerId) {
                    return;
                }

                root.style.left = event.clientX - state.dragOffsetX + "px";
                root.style.top = event.clientY - state.dragOffsetY + "px";
            }

            function onPointerUp(event) {
                if (state.dragPointerId !== event.pointerId) {
                    return;
                }

                state.dragPointerId = null;
                root.classList.remove("is-dragging");
                handle.releasePointerCapture(event.pointerId);
                window.removeEventListener("pointermove", onPointerMove);
                window.removeEventListener("pointerup", onPointerUp);
            }

            handle.addEventListener("pointerdown", function (event) {
                const rect = root.getBoundingClientRect();
                state.dragPointerId = event.pointerId;
                state.dragOffsetX = event.clientX - rect.left;
                state.dragOffsetY = event.clientY - rect.top;
                root.classList.add("is-dragging");
                handle.setPointerCapture(event.pointerId);
                window.addEventListener("pointermove", onPointerMove);
                window.addEventListener("pointerup", onPointerUp);
            });
        }

        function bindEvents() {
            mainCanvas.addEventListener("mousedown", startDrawing);
            mainCanvas.addEventListener("mousemove", moveDrawing);
            mainCanvas.addEventListener("touchstart", startDrawing, { passive: false });
            mainCanvas.addEventListener("touchmove", moveDrawing, { passive: false });
            window.addEventListener("mouseup", stopDrawing);
            window.addEventListener("touchend", stopDrawing);
            frameSlider.addEventListener("input", function (event) {
                if (state.playing) return; // Ignore input during playback
                scrubFrame(event.target.value);
            });
            root.addEventListener("click", handleActionClick);
        }

        function destroy() {
            clearInterval(state.playInterval);
            root.__animaticMounted = false;
            root.__animaticApi = null;
        }

        initCanvases();
        state.frames.push(mainCanvas.toDataURL());
        updateTimeline();
        bindEvents();
        setupDragging();

        const api = {
            getFrames: function () {
                return state.frames.slice();
            },
            loadFrames: function (incomingFrames) {
                if (!Array.isArray(incomingFrames) || incomingFrames.length === 0) {
                    return;
                }
                state.frames = incomingFrames.slice(0, settings.maxFrames);
                state.currentFrame = 0;
                loadFrame(0);
            },
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