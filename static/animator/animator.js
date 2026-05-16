(function (global) {
    "use strict";

    const tooltipPool = [];
    let hoverTarget = null;
    let isTooltipInit = false;

    function getTooltipState(targetEl) {
        let state = tooltipPool.find(t => t.target === targetEl);
        if (!state) {
            // Find a free tooltip, or one attached to a tool that was removed from the DOM
            state = tooltipPool.find(t => !t.inUse || (t.target && !document.body.contains(t.target)));
            if (!state) {
                const el = document.createElement("div");
                el.className = "animator-tooltip";
                el.setAttribute("role", "tooltip");
                el.setAttribute("aria-hidden", "true");
                document.body.appendChild(el);
                state = { el: el, timer: null, target: null, isAuto: false, inUse: false };
                tooltipPool.push(state);
            }
            if (state.inUse && state.target && !document.body.contains(state.target)) {
                clearTimeout(state.timer);
                state.el.classList.remove("is-visible");
                state.el.setAttribute("aria-hidden", "true");
            }
            state.inUse = true;
            state.target = targetEl;
        }
        return state;
    }

    function releaseTooltip(targetEl) {
        if (!targetEl) return;
        const state = tooltipPool.find(t => t.target === targetEl);
        if (state) {
            clearTimeout(state.timer);
            state.el.classList.remove("is-visible");
            state.el.setAttribute("aria-hidden", "true");
            state.isAuto = false;
            state.target = null;
            state.inUse = false;
        }
    }

    function initTooltip() {
        if (isTooltipInit) return;
        isTooltipInit = true;

        document.addEventListener("mouseover", function (e) {
            if (!e.target || typeof e.target.closest !== "function") return;
            const el = e.target.closest("[data-tooltip]");
            
            // Switch to normal hover behavior if hovering over an auto-tooltip
            if (el) {
                const state = tooltipPool.find(t => t.target === el);
                if (state && state.isAuto) {
                    state.isAuto = false;
                }
            }

            if (!el) {
                if (hoverTarget) {
                    const oldState = tooltipPool.find(t => t.target === hoverTarget);
                    if (oldState && !oldState.isAuto) {
                        releaseTooltip(hoverTarget);
                    }
                }
                hoverTarget = null;
                return;
            }

            if (hoverTarget !== el) {
                if (hoverTarget) {
                    const oldState = tooltipPool.find(t => t.target === hoverTarget);
                    if (oldState && !oldState.isAuto) {
                        releaseTooltip(hoverTarget);
                    }
                }
                hoverTarget = el;
                showTooltip(el, e.clientX, e.clientY);
            }
        });

        document.addEventListener("mousemove", function (e) {
            if (hoverTarget) {
                const state = tooltipPool.find(t => t.target === hoverTarget);
                if (state && state.el.classList.contains("is-visible")) {
                    // Only follow the cursor if it's a standard hover or they're inside the target
                    if (!state.isAuto || hoverTarget.contains(e.target)) {
                        placeTooltip(state.el, e.clientX, e.clientY);
                    }
                }
            }
        });

        document.addEventListener("mouseout", function (e) {
            if (!hoverTarget) return;
            if (!e.target || typeof e.target.closest !== "function") return;
            const fromEl = e.target.closest("[data-tooltip]");
            if (fromEl !== hoverTarget) return;

            const toEl = e.relatedTarget;
            if (toEl && hoverTarget.contains(toEl)) return;

            const state = tooltipPool.find(t => t.target === hoverTarget);
            if (state && !state.isAuto) {
                releaseTooltip(hoverTarget);
            }
            hoverTarget = null;
        });
    }

    function placeTooltip(tooltipEl, x, y) {
        if (!tooltipEl) return;
        const offset = 14;
        const rect = tooltipEl.getBoundingClientRect();
        const maxLeft = window.innerWidth - rect.width - 8;
        const maxTop = window.innerHeight - rect.height - 8;

        tooltipEl.style.left = Math.max(8, Math.min(x + offset, maxLeft)) + "px";
        tooltipEl.style.top = Math.max(8, Math.min(y + offset, maxTop)) + "px";
    }

    function showTooltip(el, x, y, isAuto = false) {
        const text = el.dataset.tooltip;
        if (!text) return;

        // Suppress native tooltip
        if (el.hasAttribute("title")) {
            el.dataset.nativeTitle = el.getAttribute("title");
            el.removeAttribute("title");
        }

        const state = getTooltipState(el);
        if (isAuto) {
            state.isAuto = true;
        }

        clearTimeout(state.timer);
        state.timer = setTimeout(function () {
            state.el.textContent = text;
            state.el.classList.add("is-visible");
            state.el.setAttribute("aria-hidden", "false");
            placeTooltip(state.el, x, y);
        }, 120);
    }

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

        if (!mainCanvas || !onionCanvas || !timeline || !playIcon) {
            throw new Error("Animator module markup is incomplete.");
        }

        // Ensure the animator root is responsive and can scroll horizontally on small viewports
        root.style.maxWidth = "100%";
        root.style.maxHeight = "100vh";
        root.style.overflow = "auto";
        root.style.touchAction = "auto";

        if (!settings.draggable) {
            // Break out of any absolute/fixed centering traps that clip the UI off-screen
            root.style.position = "relative";
            root.style.left = "auto";
            root.style.top = "auto";
            root.style.transform = "none";
            root.style.margin = "0 auto";
        }

        // Clear any global overflow locks that might prevent page scrolling
        document.body.style.overflow = "auto";
        document.documentElement.style.overflow = "auto";

        const ctx = mainCanvas.getContext("2d", { willReadFrequently: true });
        const onionCtx = onionCanvas.getContext("2d");

        let floorLine = root.querySelector('.animator-floor-line');
        if (!floorLine) {
            floorLine = document.createElement('div');
            floorLine.className = 'animator-floor-line';
            floorLine.style.position = 'absolute';
            floorLine.style.top = '75%';
            floorLine.style.left = '0';
            floorLine.style.width = '100%';
            floorLine.style.borderTop = '2px dashed #888888';
            floorLine.style.pointerEvents = 'none';
            floorLine.style.display = 'none';
            floorLine.style.zIndex = '10';
            mainCanvas.parentNode.style.position = 'relative';
            mainCanvas.parentNode.appendChild(floorLine);
        }

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
            dragOffsetY: 0,
            dragSourceIndex: null,
            showFloor: false,
            highlightedTools: new Set(),
            tutorialInterval: null
        };

        function notifyChange() {
            if (typeof settings.onChange === "function") {
                settings.onChange(state.frames.slice(), {
                    currentFrame: state.currentFrame
                });
            }
        }

        function initCanvases() {
            [mainCanvas, onionCanvas].forEach((canvas) => {
                canvas.width = settings.width;
                canvas.height = settings.height;
                // Prevent scrolling when drawing on the canvas, but allow it elsewhere
                canvas.style.touchAction = "none";
                // Clear any inline height overrides so the canvas relies entirely on its CSS boundary
                canvas.style.maxWidth = "";
                canvas.style.height = "";
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

        function drawFloor() {
            if (floorLine) {
                floorLine.style.display = (state.showFloor && !state.playing) ? "block" : "none";
            }
        }

        function saveFrame() {
            state.frames[state.currentFrame] = mainCanvas.toDataURL();
            updateTimeline();
            notifyChange();
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
            if(statusCoords) {
                statusCoords.textContent = Math.round(pos.x) + ", " + Math.round(pos.y);
            }
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
            notifyChange();
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
                drawFloor();
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
            timeline.querySelectorAll('[data-tooltip]').forEach(el => {
                releaseTooltip(el);
                if (hoverTarget === el) hoverTarget = null;
            });

            timeline.innerHTML = "";

                // DEL button state
                const delBtn = root.querySelector('.animator-btn-del');
                if (delBtn) {
                    if (state.frames.length <= 1) {
                        delBtn.disabled = true;
                    } else {
                        delBtn.disabled = false;
                    }
                }

            state.frames.forEach((data, index) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "animator-btn animator-thumb" + (index === state.currentFrame ? " is-active" : "");
                button.dataset.tooltip = "Frame " + (index + 1) + ": click to jump to this frame.";

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

                button.draggable = true;

                button.addEventListener("dragstart", function (e) {
                    if (state.playing) {
                        e.preventDefault();
                        return;
                    }
                    state.dragSourceIndex = index;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", index);
                    setTimeout(() => button.classList.add("is-dragging-thumb"), 0);
                });

                button.addEventListener("dragend", function (e) {
                    button.classList.remove("is-dragging-thumb");
                    timeline.querySelectorAll('.is-drag-over').forEach(el => el.classList.remove('is-drag-over'));
                    state.dragSourceIndex = null;
                });

                button.addEventListener("dragover", function (e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                });

                button.addEventListener("dragenter", function (e) {
                    e.preventDefault();
                    if (state.dragSourceIndex !== null && state.dragSourceIndex !== index) {
                        button.classList.add("is-drag-over");
                    }
                });

                button.addEventListener("dragleave", function (e) {
                    button.classList.remove("is-drag-over");
                });

                button.addEventListener("drop", function (e) {
                    e.preventDefault();
                    button.classList.remove("is-drag-over");
                    if (state.dragSourceIndex === null || state.dragSourceIndex === index) return;

                    const draggedFrame = state.frames.splice(state.dragSourceIndex, 1)[0];
                    state.frames.splice(index, 0, draggedFrame);

                    if (state.currentFrame === state.dragSourceIndex) {
                        state.currentFrame = index;
                    } else if (state.currentFrame > state.dragSourceIndex && state.currentFrame <= index) {
                        state.currentFrame--;
                    } else if (state.currentFrame < state.dragSourceIndex && state.currentFrame >= index) {
                        state.currentFrame++;
                    }

                    loadFrame(state.currentFrame);
                    notifyChange();
                });

                timeline.appendChild(button);
            });

            // Add-frame button at end
            if (state.frames.length < settings.maxFrames) {
                const addBtn = document.createElement("button");
                addBtn.type = "button";
                addBtn.className = "animator-thumb-add";
                addBtn.dataset.action = "add-frame";
                if (state.highlightedTools.has("add") || state.highlightedTools.has("add-frame")) {
                    addBtn.classList.add("is-highlighted");
                }
                addBtn.title = "Add Frame";
                addBtn.setAttribute('aria-label', 'Add Frame');
                addBtn.dataset.tooltip = "Add Frame: create the next frame in your animation.";
                addBtn.textContent = "+";
                addBtn.addEventListener("click", function (event) {
                    event.stopPropagation();
                    if (state.playing) return;
                    addFrame();
                });
                timeline.appendChild(addBtn);
            }
        }

        function scrollToActive() {
            const active = timeline.querySelector(".is-active");
            if (active) {
                const targetLeft = active.offsetLeft - (timeline.clientWidth - active.offsetWidth) / 2;
                const maxLeft = Math.max(0, timeline.scrollWidth - timeline.clientWidth);
                const nextLeft = Math.max(0, Math.min(targetLeft, maxLeft));
                timeline.scrollTo({ left: nextLeft, behavior: "smooth" });
            }
        }

        function togglePlay() {
            state.playing = !state.playing;
            drawFloor();

            const playBtn = root.querySelector('.animator-btn-play');
            const playIcon = root.querySelector('[data-role="play-icon"]');
            if (state.playing) {
                onionCtx.clearRect(0, 0, onionCanvas.width, onionCanvas.height);
                if(playText) {
                    playText.textContent = "Stop";
                }
                if(playIcon) {
                    playIcon.src = playIcon.src.replace('play.png', 'stop.png');
                }

                let frameIndex = 0;
                state.playInterval = setInterval(function () {
                    const image = new Image();
                    image.onload = function () {
                        ctx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
                        ctx.drawImage(image, 0, 0);
                        drawFloor();
                    };
                    image.src = state.frames[frameIndex] || state.frames[0] || "";

                    // Highlight current frame in timeline
                    const thumbs = timeline.querySelectorAll('.animator-thumb');
                    thumbs.forEach((thumb, i) => {
                        thumb.classList.toggle('is-active', i === frameIndex);
                    });
                    
                    frameIndex = (frameIndex + 1) % state.frames.length;
                }, 1000 / settings.fps);
            } else {
                clearInterval(state.playInterval);
                state.playInterval = null;
                if(playText) {
                    playText.textContent = "Play (" + settings.fps + "fps)";
                }
                if(playIcon) {
                    playIcon.src = playIcon.src.replace('stop.png', 'play.png');
                }
                loadFrame(state.currentFrame);
            }
        }

        function handleActionClick(event) {
            const target = event.target;
            const button = target && typeof target.closest === "function"
                ? target.closest("[data-action]")
                : null;
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
                if (state.playing) {
                    return;
                }
                addFrame();
                return;
            }

            if (action === "toggle-play") {
                togglePlay();
                    return;
                }

                if (action === "delete-frame") {
                    if (state.frames.length <= 1) return;
                    showDeleteConfirm(() => {
                        state.frames.splice(state.currentFrame, 1);
                        if (state.currentFrame >= state.frames.length) {
                            state.currentFrame = state.frames.length - 1;
                        }
                        loadFrame(state.currentFrame);
                        notifyChange();
                    });
            }
        }
        // Win98-style confirmation dialog
        function showDeleteConfirm(onConfirm) {
            // Remove any existing dialog
            let old = document.getElementById('animator-del-confirm');
            if (old) old.remove();

            const overlay = document.createElement('div');
            overlay.id = 'animator-del-confirm';
            overlay.style.position = 'fixed';
            overlay.style.zIndex = '99999';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.width = '100vw';
            overlay.style.height = '100vh';
            overlay.style.background = 'rgba(0,0,0,0.15)';
            overlay.style.display = 'flex';
            overlay.style.alignItems = 'center';
            overlay.style.justifyContent = 'center';

            const win = document.createElement('div');
            win.style.background = '#c0c0c0';
            win.style.border = '2px solid #000';
            win.style.boxShadow = 'inset 1px 1px 0 #fff, inset -1px -1px 0 #808080';
            win.style.minWidth = '260px';
            win.style.maxWidth = '90vw';
            win.style.fontFamily = 'Tahoma, "MS Sans Serif", sans-serif';
            win.style.color = '#000';
            win.style.padding = '0';
            win.style.display = 'flex';
            win.style.flexDirection = 'column';
            win.style.alignItems = 'stretch';

            const title = document.createElement('div');
            title.textContent = 'Confirm Delete';
            title.style.background = '#000080';
            title.style.color = '#fff';
            title.style.fontWeight = 'bold';
            title.style.fontSize = '13px';
            title.style.padding = '3px 8px';
            title.style.borderBottom = '1px solid #808080';
            win.appendChild(title);

            const msg = document.createElement('div');
            msg.textContent = 'Are you sure you want to delete this frame?';
            msg.style.padding = '18px 16px 8px 16px';
            msg.style.fontSize = '13px';
            win.appendChild(msg);

            const btnRow = document.createElement('div');
            btnRow.style.display = 'flex';
            btnRow.style.justifyContent = 'flex-end';
            btnRow.style.gap = '10px';
            btnRow.style.padding = '8px 16px 14px 16px';

            const okBtn = document.createElement('button');
            okBtn.textContent = 'OK';
            okBtn.style.background = '#c0c0c0';
            okBtn.style.border = '2px outset #fff';
            okBtn.style.padding = '2px 18px';
            okBtn.style.fontFamily = 'inherit';
            okBtn.style.fontSize = '13px';
            okBtn.style.marginRight = '4px';
            okBtn.style.cursor = 'pointer';
            okBtn.onmouseenter = () => okBtn.style.background = '#e0e0e0';
            okBtn.onmouseleave = () => okBtn.style.background = '#c0c0c0';
            okBtn.onclick = function() {
                overlay.remove();
                onConfirm();
            };

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.style.background = '#c0c0c0';
            cancelBtn.style.border = '2px outset #fff';
            cancelBtn.style.padding = '2px 18px';
            cancelBtn.style.fontFamily = 'inherit';
            cancelBtn.style.fontSize = '13px';
            cancelBtn.style.cursor = 'pointer';
            cancelBtn.onmouseenter = () => cancelBtn.style.background = '#e0e0e0';
            cancelBtn.onmouseleave = () => cancelBtn.style.background = '#c0c0c0';
            cancelBtn.onclick = function() {
                overlay.remove();
            };

            btnRow.appendChild(okBtn);
            btnRow.appendChild(cancelBtn);
            win.appendChild(btnRow);
            overlay.appendChild(win);
            document.body.appendChild(overlay);

            // Focus OK for keyboard
            okBtn.focus();
        }

        function setupDragging() {
            const handle = root.querySelector(".animator-titlebar");
            if (!handle) {
                return;
            }

            if (!settings.draggable) {
                root.classList.remove("is-draggable");
                root.classList.remove("is-dragging");
                handle.removeAttribute("data-drag-handle");
                return;
            }

            root.classList.add("is-draggable");
            handle.setAttribute("data-drag-handle", "true");
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
            if(frameSlider) {
                frameSlider.addEventListener("input", function (event) {
                    if (state.playing) return; // Ignore input during playback
                    scrubFrame(event.target.value);
                });
            }
            // Fallback: ensure Add Frame works even if delegated action matching misses a click target.
            timeline.addEventListener("click", function (event) {
                const target = event.target;
                const addBtn = target && typeof target.closest === "function"
                    ? target.closest(".animator-thumb-add")
                    : null;
                if (!addBtn || !timeline.contains(addBtn) || state.playing) {
                    return;
                }
                addFrame();
            });
            root.addEventListener("click", handleActionClick);

            root.addEventListener("mouseover", function (event) {
                const btn = event.target.closest(".is-highlighted");
                if (btn) {
                    btn.classList.remove("is-highlighted");
                    
                    const action = btn.dataset.action || btn.dataset.tool;
                    if (action) {
                        state.highlightedTools.delete(action);
                    }
                    if (btn.classList.contains("animator-btn-play")) {
                        state.highlightedTools.delete("play");
                        state.highlightedTools.delete("toggle-play");
                    }
                    if (btn.classList.contains("animator-thumb-add")) {
                        state.highlightedTools.delete("add");
                        state.highlightedTools.delete("add-frame");
                    }
                }
            });
        }

        function exportGif(options) {
            const exportOptions = Object.assign(
                {
                    fileName: "animatic.gif",
                    durationMs: Math.max(20, Math.round(1000 / settings.fps)),
                    download: true
                },
                options || {}
            );

            if (!state.isDrawing) {
                saveFrame();
            }

            return fetch("/export_gif", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    frames: state.frames.slice(),
                    duration_ms: exportOptions.durationMs,
                    file_name: exportOptions.fileName
                })
            }).then(function (response) {
                if (!response.ok) {
                    return response.json().catch(function () {
                        return { error: "Failed to export GIF." };
                    }).then(function (payload) {
                        throw new Error(payload.error || "Failed to export GIF.");
                    });
                }

                return response.blob();
            }).then(function (blob) {
                if (exportOptions.download === false) {
                    return blob;
                }

                const objectUrl = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = objectUrl;
                link.download = exportOptions.fileName;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(function () {
                    URL.revokeObjectURL(objectUrl);
                }, 0);

                return blob;
            });
        }

        function destroy() {
            clearInterval(state.playInterval);
            clearInterval(state.tutorialInterval);
            root.__animaticMounted = false;
            root.__animaticApi = null;
        }

        initTooltip();
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
            setFloor: function (enabled) {
                state.showFloor = enabled;
                loadFrame(state.currentFrame);
            },
            highlightTool: function (actionOrTool, enable = true) {
                if (enable) {
                    state.highlightedTools.add(actionOrTool);
                } else {
                    state.highlightedTools.delete(actionOrTool);
                }

                let selector = `[data-tool="${actionOrTool}"], [data-action="${actionOrTool}"]`;
                if (actionOrTool === "play" || actionOrTool === "toggle-play") selector += `, .animator-btn-play`;
                if (actionOrTool === "add" || actionOrTool === "add-frame") selector += `, .animator-thumb-add`;
                
                const els = root.querySelectorAll(selector);
                
                if (enable) {
                    els.forEach(el => {
                        el.classList.add("is-highlighted");
                        if (el.dataset.tooltip) {
                            const rect = el.getBoundingClientRect();
                            showTooltip(el, rect.left + rect.width / 2, rect.top + rect.height / 2, true);
                        }
                    });
                } else {
                    els.forEach(el => {
                        el.classList.remove("is-highlighted");
                        releaseTooltip(el);
                    });
                }
            },
            highlightAllTools: function () {
                ["pen", "eraser", /* "clear", */ "toggle-onion", "toggle-play", "add-frame"].forEach(tool => {
                    this.highlightTool(tool, true);
                });
            },
            lastHighlightedStep: null,
            highlightTutorialStep: function (text) {
                if (!text) return;

                const normalizedText = text.toLowerCase()
                    .replace(/['"“”’]/g, '')
                    .replace(/\s+/g, ' ');

                let currentStep = null;
                // Check in reverse order so if all steps are on screen, the latest one wins
                if (normalizedText.includes("hit the play button to see your an")) {
                    currentStep = "step4";
                } else if (normalizedText.includes("create a new frame")) {
                    currentStep = "step3";
                } else if (normalizedText.includes("great! now click the onion")) {
                    currentStep = "step2";
                } else if (normalizedText.includes("ive already placed the ground for you")) {
                    currentStep = "step1";
                } else if (normalizedText.includes("lets learn about the tools first")) {
                    currentStep = "step0";
                }

                // If no matching step or we already highlighted this step, do nothing
                if (currentStep === this.lastHighlightedStep) {
                    return;
                }
                this.lastHighlightedStep = currentStep;

                // Clear previous highlights
                ["pen", "eraser", /* "clear", */ "toggle-onion", "toggle-play", "add-frame"].forEach(tool => {
                    this.highlightTool(tool, false);
                });

                if (!currentStep) return;

                if (currentStep === "step0") {
                    ["pen", "eraser", /* "clear", */ "toggle-onion", "toggle-play", "add-frame"].forEach(tool => {
                        this.highlightTool(tool, true);
                    });
                } else if (currentStep === "step1") {
                    this.highlightTool("pen", true);
                    this.highlightTool("eraser", true);
                } else if (currentStep === "step2") {
                    this.highlightTool("toggle-onion", true);
                } else if (currentStep === "step3") {
                    this.highlightTool("add-frame", true);
                } else if (currentStep === "step4") {
                    this.highlightTool("toggle-play", true);
                }
            },
            exportGif: exportGif,
            destroy: destroy
        };

        root.__animaticMounted = true;
        root.__animaticApi = api;

        // Auto-detect tutorial text on the page without needing manual integration in learn.html
        state.tutorialInterval = setInterval(() => {
            if (document.body) {
                api.highlightTutorialStep(document.body.innerText);
            }
        }, 500);

        return api;
    }

    global.AnimaticCanvasModule = {
        mount: mount
    };
})(window);