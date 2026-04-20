# Animatic_UI_Project
This is a group project for UI/UX Design class. Learn how to make your first animation - A walkthrough of making your first 5 frame animation. It can be as simple as a stickman or a basketball bouncing on the floor. 

## Animator Canvas (Drop-in)

Use `templates/components/animator_canvas.html` wherever you want canvas is needed. Styles: `static/animator/animator.css`, JS: `static/animator/animator.js`.

Example:

```html
<link rel="stylesheet" href="{{ url_for('static', filename='animator/animator.css') }}">
{% include 'components/animator_canvas.html' %}
<script src="{{ url_for('static', filename='animator/animator.js') }}"></script>
<script>
window.AnimaticCanvasModule.mount('#animator-root-main');
</script>
```

Routes:
- `/` homepage
- `/learn` demo
- `/learn/<lesson_id>`

## Canvas Data (for backend)

Each animation is just a list of PNG data URLs (one per frame).

```json
{
  "frames": [
    "data:image/png;base64,iVBORw0KGgo...",
    "data:image/png;base64,iVBORw0KGgo..."
  ]
}
```
POST/GET this whole object for saving/loading.

