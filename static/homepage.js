document.addEventListener('DOMContentLoaded', function () {
    var startButton = document.getElementById('start-button');
    if (!startButton) {
        return;
    }

    startButton.addEventListener('click', function () {
        fetch('/start', { method: 'POST' })
            .catch(function () { /* ignore — still advance */ })
            .finally(function () {
                window.location.href = '/learn';
            });
    });
});
