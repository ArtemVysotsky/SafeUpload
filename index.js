/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/SafeUpload
 * @copyright   GNU General Public License v3
 */

/** ToDo: Переробити перехоплення помилок на функцію з reject-ом */

let timestamps = {start: 0, pause: 0, stop: 0, iteration: 0};

/* Збережені посилання на елементи сторінки */
let nodes = {};
nodes.form = new function() {
    this.self = document.querySelector('main form');
    this.file = this.self.querySelector('div.file');
    this.progresses = this.self.querySelector('div.progresses');
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
    this.name = nodes.form.self.querySelector('div.name');
    this.progress = new function() {
        this.current = nodes.form.progresses.querySelector('div.progress.current div.progress-bar');
        this.total = nodes.form.progresses.querySelector('div.progress.total div.progress-bar');
    };
    this.size = nodes.form.status.querySelector('div.size');
    this.speed = nodes.form.status.querySelector('div.speed');
    this.time = nodes.form.status.querySelector('div.time');
};
console.log(nodes.indicators);
/* Реакції на різні дії процесу завантаження файла */
let callbacks = {};
callbacks.select = () => {
    nodes.buttons.upload.disabled = false;
    nodes.indicators.name.innerHTML = '&nbsp;';
    nodes.indicators.progress.current.style.width = '0';
    nodes.indicators.progress.current.innerHTML = null;
    nodes.indicators.progress.total.style.width = '0';
    nodes.indicators.progress.total.innerHTML = null;
    nodes.indicators.size.innerHTML = '&nbsp;';
    nodes.indicators.speed.innerHTML = '&nbsp;';
    nodes.indicators.time.innerHTML = '&nbsp;';
};
callbacks.start = () => {
    nodes.buttons.file.disabled = true;
    nodes.buttons.upload.disabled = true;
    nodes.buttons.pause.disabled = false;
    nodes.buttons.cancel.disabled = false;
    timestamps.start = timestamps.iteration = (new Date()).getTime();
};
callbacks.pause = () => {
    nodes.buttons.resume.disabled = false;
    nodes.buttons.pause.disabled = true;
    timestamps.pause = (new Date()).getTime();
};
callbacks.resume = () => {
    nodes.buttons.pause.disabled = false;
    nodes.buttons.resume.disabled = true;
    timestamps.start = (new Date()).getTime() - (timestamps.pause - timestamps.start);
};
callbacks.stop = () => {
    nodes.buttons.file.disabled = false;
    nodes.buttons.pause.disabled = true;
    nodes.buttons.resume.disabled = true;
    nodes.buttons.cancel.disabled = true;
    timestamps.stop = (new Date()).getTime();
};
callbacks.iteration = (status) => {
    timestamps.iteration = (new Date()).getTime();
    status.current.progress = Math.round(status.current.size.uploaded * 100 / status.current.size.total);
    status.total.progress = Math.round(status.total.size.uploaded * 100 / status.total.size.total);
    status.total = {...status.total, time:{elapsed: 0, estimate: 0}};
    status.total.time.elapsed = Math.round(timestamps.iteration - timestamps.start);
    if (status.chunk.speed > 0) {
        status.total.time.estimate =
            status.total.size.total / (status.total.size.uploaded / status.total.time.elapsed);
        status.total.time.estimate =
            Math.round(status.total.time.estimate - status.total.time.elapsed);
    } else {
        status.total.time.estimate = 0;
    }
//console.log({...status});
    nodes.indicators.name.innerHTML = status.current.name + ` (${Human.getSize(status.current.size.total, 1)})`;
    nodes.indicators.progress.current.innerHTML =   status.current.progress +'%';
    nodes.indicators.progress.current.style.width =  status.current.progress + '%';
    nodes.indicators.progress.total.innerHTML =   status.total.progress +'%';
    nodes.indicators.progress.total.style.width =  status.total.progress + '%';
    nodes.indicators.size.innerHTML =
        Human.getSize(status.total.size.uploaded, 1) + ' / ' + Human.getSize(status.total.size.total, 1);
    nodes.indicators.speed.innerHTML = Human.getSize(status.chunk.speed, 1) + '/c';
    nodes.indicators.time.innerHTML =
        Human.getInterval(status.total.time.elapsed) + ' / ' + Human.getInterval(status.total.time.estimate);

    console.debug(
        '#' + status.chunk.number.toString(),
        Human.getNumber((status.chunk.size / 1024).toFixed()).padStart(8) + ' КБ',
        Human.getNumber((status.chunk.speed / 1024).toFixed()).padStart(8) + ' КБ/с',
        Human.getNumber(status.chunk.time.toFixed(3)).padStart(8) + ' c'
    );
};
callbacks.timeout = () => {
    alert('Сервер не відповідає, спробуйте пізніше');
};
callbacks.resolve = () => {
    nodes.buttons.file.disabled = false;
    nodes.buttons.pause.disabled = true;
    nodes.buttons.resume.disabled = true;
    nodes.buttons.cancel.disabled = true;
    console.log('Всі файли завантажено');
};
callbacks.reject = (e) => {error(e)};


/* Реакції на різні дії користувача */
let upload;
nodes.buttons.file.addEventListener('change', function() {
    try {
        if (!this.files.length) return;
        upload = new SafeUpload(this.files, {
            url: 'api.php', chunkSizeMaximum: 32 * 1024 * 1024, fileSizeLimit: 3 * 1024 * 1024 * 1024,
            interval: 1, timeout: 3, retryLimit: 3, retryDelay: 1
        }, callbacks);
    } catch (e) {error(e)}
});
nodes.buttons.upload.addEventListener('click', async () => {
    try {await upload.start()} catch (e) {error(e)}
});
nodes.buttons.pause.addEventListener('click', async () => {
    try {await upload.pause()} catch (e) {error(e)}
});
nodes.buttons.resume.addEventListener('click', async () => {
    try {await upload.resume()} catch (e) {error(e)}
});
nodes.buttons.cancel.addEventListener('click', async () => {
    try {await upload.cancel()} catch (e) {error(e)}
});

/* Вивід помилки при асинхронних викликах */
const error = (e) => {
    nodes.buttons.file.disabled = false;
    nodes.buttons.upload.disabled = true;
    nodes.buttons.pause.disabled = true;
    nodes.buttons.resume.disabled = true;
    nodes.buttons.cancel.disabled = true;
    alert(e.message);
    throw e;
};

/** Змінює вигляд деяких велечини в зручний для людини формат */
class Human {

    /**
     * Змінює вигляд розміру (при потребі)
     * @param {number} bytes - Розмір в байтах
     * @param {number} [digits = 0] - Кількіість знаків після коми
     * @returns {string} - Розмір в Б/КБ/МБ/ГБ
     */
    static getSize = (bytes, digits = 0) => {
        const thousand = 1024;
        if(Math.abs(bytes) < thousand) return bytes + ' Б';
        let i = -1;
        const units = ['КБ','МБ','ГБ'];
        do {bytes /= thousand; ++i;} while(Math.abs(bytes) >= thousand && i < units.length - 1);
        return bytes.toFixed(digits) + ' ' + units[i];
    };

    /**
     * Змінює вигляд інтервалу часу
     * @param {number} interval - Інтервалу в мілісекундах
     * @returns {string} - Інтервал в форматі ГГ:ХХ:СС
     */
    static getInterval = (interval) => {
        interval = Math.round(interval / 1000);
        let hours = Math.floor(((interval % 31536000) % 86400) / 3600);
        let minutes = Math.floor((((interval % 31536000) % 86400) % 3600) / 60);
        let seconds = (((interval % 31536000) % 86400) % 3600) % 60;
        if (hours.toString().length === 1) hours = '0' + hours;
        if (minutes.toString().length === 1) minutes = '0' + minutes;
        if (seconds.toString().length === 1) seconds = '0' + seconds;
        return hours + ':' + minutes + ':' + seconds;
    };

    /**
     * Відокремлює тисячі в числі
     * @param {number|string} value - Число не форматоване
     * @param {string} [separator = ' '] - Розділовий знак
     * @returns {string} - Число з відокремленими тисячами
     */
    static getNumber = (value, separator = ' ') => {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    };
}

