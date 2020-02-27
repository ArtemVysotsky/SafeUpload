/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

/* Збережені посилання на елементи сторінки */
let nodes = {};
nodes.form = new function() {
    this.self = document.querySelector('main form');
    this.file = this.self.querySelector('div.file');
    this.progress = this.self.querySelector('div.progress');
    this.control = this.self.querySelector('div.control');
    this.status = this.self.querySelector('div.status');
};
nodes.buttons = new function() {
    this.file = nodes.form.file.querySelector('input');
    this.upload = nodes.form.control.querySelector('input.upload');
    this.pause = nodes.form.control.querySelector('input.pause');
    this.resume = nodes.form.control.querySelector('input.resume');
    this.cancel = nodes.form.control.querySelector('input.cancel');
};
nodes.indicators = new function() {
    this.speed = nodes.form.status.querySelector('span.speed');
    this.time = nodes.form.status.querySelector('span.time');
    this.progress = nodes.form.progress.querySelector('div.progress-bar');
};

/* Реакції на різні дії процесу завантаження файла */
let callbacks;
callbacks = {
    iteration: (status) => { // дії при кожній ітерації процесу завантаження файла
        nodes.indicators.speed.innerHTML =
            human.size(status.speed) + '/c' + ' (' + human.size(status.chunk) + ')';
        nodes.indicators.time.innerHTML =
            human.time(status.time.elapsed) + ' / ' + human.time(status.time.estimate);
        nodes.indicators.progress.innerHTML =
            human.size(status.size.bytes) + ' (' + status.size.percent + '%)';
        nodes.indicators.progress.style.width = status.size.percent + '%';
    },
    pause: () => { // дії при призупиненні процесу завантаження файла
        nodes.buttons.resume.disabled = false;
        nodes.buttons.pause.disabled = true;
    },
    timeout: () => { // дії при відсутності відповіді від сервера
        nodes.buttons.resume.disabled = false;
        nodes.buttons.pause.disabled = true;
        alert('Сервер не відповідає, спробуйте пізніше');
    },
    resolve: () => { // дії при закінчені процесу завантаження файла
        nodes.buttons.file.disabled = false;
        nodes.buttons.pause.disabled = true;
        nodes.buttons.resume.disabled = true;
        nodes.buttons.cancel.disabled = true;
        console.log('Завантаження файла завершено');
    },
    reject: (e) => {error(e)} // дії при помилці
};

/* Реакції на різні дії користувача */
let upload;
nodes.buttons.file.addEventListener('change', function() {
    try {
        if (this.files[0] === undefined) return false;
        upload = new Upload(this.files[0], callbacks);
        nodes.buttons.upload.disabled = false;
        nodes.indicators.speed.innerHTML = null;
        nodes.indicators.time.innerHTML = null;
        nodes.indicators.progress.style.width = '0';
        nodes.indicators.progress.innerHTML = null;
    } catch (e) {error(e)}
});
nodes.buttons.upload.addEventListener('click', async () => {
    try {
        await upload.start();
        nodes.buttons.file.disabled = true;
        nodes.buttons.upload.disabled = true;
        nodes.buttons.pause.disabled = false;
        nodes.buttons.cancel.disabled = false;
    } catch (e) {error(e)}
});
nodes.buttons.pause.addEventListener('click', () => upload.pause());
nodes.buttons.resume.addEventListener('click', async () => {
    try {
        await upload.resume();
        nodes.buttons.pause.disabled = false;
        nodes.buttons.resume.disabled = true;
    } catch (e) {error(e)}
});
nodes.buttons.cancel.addEventListener('click', async () => {
    try {
        nodes.buttons.file.disabled = false;
        nodes.buttons.pause.disabled = true;
        nodes.buttons.resume.disabled = true;
        nodes.buttons.cancel.disabled = true;
        await upload.cancel();
    } catch (e) {error(e)}
});

/* Вивід помилки при асинхронних викликах */
const error = (e) => {
    nodes.buttons.file.disabled = false;
    nodes.buttons.upload.disabled = true;
    nodes.buttons.pause.disabled = true;
    nodes.buttons.resume.disabled = true;
    nodes.buttons.cancel.disabled = true;
    console.error(e);
    alert('Помилка: ' + e.message);
};

/* Вивід розміру файлу та інтервалу часу в зручному для людині вигляді */
const human = new function() {
    this.size = function(bytes) {
        const thousand = 1024;
        if(Math.abs(bytes) < thousand) return bytes + ' B';
        let i = -1;
        const units = ['КБ','МБ','ГБ'];
        do {bytes /= thousand; ++i;} while(Math.abs(bytes) >= thousand && i < units.length - 1);
        return bytes.toFixed(1) + ' ' + units[i];
    };
    this.time = function(interval) {
        let hours = Math.floor(((interval % 31536000) % 86400) / 3600);
        let minutes = Math.floor((((interval % 31536000) % 86400) % 3600) / 60);
        let seconds = (((interval % 31536000) % 86400) % 3600) % 60;
        if (hours.toString().length === 1) hours = '0' + hours;
        if (minutes.toString().length === 1) minutes = '0' + minutes;
        if (seconds.toString().length === 1) seconds = '0' + seconds;
        return hours + ':' + minutes + ':' + seconds;
    };
};