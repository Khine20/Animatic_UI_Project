document.addEventListener('DOMContentLoaded', function () {
    var startButton = document.getElementById('start-button');
    if (!startButton) {
        return;
    }

    startButton.addEventListener('click', function () {
        window.location.href = '/learn/1';
    });
});