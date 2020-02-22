/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

/** ToDo: Перевірити перехоплення виключень */

/* Збережені посилання на елементи сторінки */
const nodes = {};
nodes.form = {};
nodes.form.self = document.querySelector('main form');
nodes.form.file = nodes.form.self.querySelector('div.file');
nodes.form.progress = nodes.form.self.querySelector('div.progress');
nodes.form.control = nodes.form.self.querySelector('div.control');
nodes.form.status = nodes.form.self.querySelector('div.status');
nodes.buttons = {};
nodes.buttons.file = nodes.form.file.querySelector('input');
nodes.buttons.upload = nodes.form.control.querySelector('input.upload');
nodes.buttons.pause = nodes.form.control.querySelector('input.pause');
nodes.buttons.resume = nodes.form.control.querySelector('input.resume');
nodes.buttons.cancel = nodes.form.control.querySelector('input.cancel');
nodes.indicators = {};
nodes.indicators.speed = nodes.form.status.querySelector('span.speed');
nodes.indicators.time = nodes.form.status.querySelector('span.time');
nodes.indicators.progress = nodes.form.progress.querySelector('div.progress-bar');

/* Створюємо об'єкт для керування процесом завантаження файла */
const upload = new Upload();

upload.callbacks = {
    iteration: (status) => {
        nodes.indicators.speed.innerHTML = human.size(status.speed) + '/c' + ' (' + human.size(status.chunk) + ')';
        nodes.indicators.time.innerHTML = human.time(status.time.elapsed) + ' / ' + human.time(status.time.estimate);
        nodes.indicators.progress.innerHTML = human.size(upload.size.bytes) + ' (' + upload.size.percent + '%)';
        nodes.indicators.progress.style.width = upload.size.percent + '%';
    },
    pause: () => {
        nodes.buttons.resume.disabled = false;
        nodes.buttons.pause.disabled = true;
    },
    timeout: () => {
        nodes.buttons.resume.disabled = false;
        nodes.buttons.pause.disabled = true;
        alert('Сервер не відповідає, спробуйте пізніше');
    },
    finish: () => {
        nodes.buttons.file.disabled = false;
        nodes.buttons.pause.disabled = true;
        nodes.buttons.resume.disabled = true;
        nodes.buttons.cancel.disabled = true;
        console.log('Завантаження файла завершено');
    }
 };

/* Дії при виборі файлу користувачем */
nodes.buttons.file.addEventListener('change', function() {
    try {
        if (this.files[0] === undefined) return false;
        upload.file = this.files[0];
        nodes.buttons.upload.disabled = false;
        nodes.indicators.speed.innerHTML = null;
        nodes.indicators.time.innerHTML = null;
        nodes.indicators.progress.style.width = '0';
        nodes.indicators.progress.innerHTML = null;
    } catch (e) {error(e)}
});

/* Додаємо реакції на різні дії користувача */
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

/* Функція для виводу помилки при асинхронних викликах */
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