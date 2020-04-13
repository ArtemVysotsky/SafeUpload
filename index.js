/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/SafeUpload
 * @copyright   GNU General Public License v3
 */

let timers = {start: 0, pause: 0, iteration: 0};

const settings = {
    url: 'api.php', // Адреса API для завантаження файлу
    chunkSizeMaximum: 16 * (1024 ** 2), // Максимальний розмір фрагмента файлу, байти
    fileSizeLimit: 3 * (1024 ** 3), // Максимальний розмір файлу, байти
    interval: 1, // Рекомендована тривалість запиту, секунди
    timeout: 2, // Максимальна тривалість запиту, секунди
    retryLimit: 3, // Максимальна кількість повторних запитів
    retryDelay: 1 // Тривалість паузи між повторними запитами, секунди
};

/* Збережені посилання на елементи сторінки */
let nodes = {};
nodes.main = document.querySelector('main');
nodes.modal = new function() {
    this.self = nodes.main.querySelector('.modal');
    this.header = this.self.querySelector('.modal-header');
    this.progresses = this.self.querySelector('.progresses');
    this.status = this.self.querySelector('.status');
    this.buttons = this.self.querySelector('.buttons');
};
nodes.status = new function() {
    this.name = nodes.modal.self.querySelector('div.name');
    this.progress = new function() {
        this.current = nodes.modal.progresses.querySelector('.progress.current .progress-bar');
        this.total = nodes.modal.progresses.querySelector('.progress.total .progress-bar');
    };
    this.size = nodes.modal.status.querySelector('.size');
    this.speed = nodes.modal.status.querySelector('.speed');
    this.time = nodes.modal.status.querySelector('.time');
};
nodes.buttons = new function() {
    this.file = document.querySelector('main .card #file');
    this.pause = nodes.modal.buttons.querySelector('.pause');
    this.resume = nodes.modal.buttons.querySelector('.resume');
    this.cancel = nodes.modal.buttons.querySelector('.cancel');
    this.close = nodes.modal.header.querySelector('.close span');
};
nodes.alert = nodes.main.querySelector('.alert');

/* Керування мадольним вікном */
const modal = new function() {
    this.open = async () => {
        nodes.buttons.file.disabled = true;
        nodes.modal.self.style.transition = 'opacity .5s';
        await sleep(0);
        nodes.modal.self.classList.add('show');
    };
    this.close = async () => {
        nodes.modal.self.classList.remove('show');
        await sleep(parseFloat(nodes.modal.self.style.transitionDuration) * 1000);
        nodes.modal.self.style.display = 'none';
        nodes.buttons.file.disabled = false;
        nodes.buttons.file.value = null;
    };
};

/* Реакції на різні дії процесу завантаження файла */
let callbacks = {};
callbacks.pause = () => {
    nodes.buttons.pause.disabled = false;
    nodes.buttons.pause.style.display = 'none';
    nodes.buttons.resume.style.display = 'block';
    timers.pause = (new Date()).getTime();
};
callbacks.iteration = (status) => {
    timers.iteration = (new Date()).getTime();
    status.current.progress = Math.round(status.current.size.uploaded * 100 / status.current.size.total);
    status.total.progress = Math.round(status.total.size.uploaded * 100 / status.total.size.total);
    status.total = {...status.total, time:{elapsed: 0, estimate: 0}};
    if (status.chunk.speed > 0) {
        status.total.time.elapsed = Math.round(timers.iteration - timers.start);
        status.total.time.estimate =
            status.total.size.total / (status.total.size.uploaded / status.total.time.elapsed);
        status.total.time.estimate =
            Math.round(status.total.time.estimate - status.total.time.elapsed);
    } else {
        status.total.time.estimate = 0;
    }
    nodes.status.name.innerHTML = status.current.name;
    if (status.total.number > 1) {
        nodes.status.name.innerHTML =
            `[${status.current.number}/${status.total.number}] ` + nodes.status.name.innerHTML;
        nodes.status.name.innerHTML += ` (${Human.getSize(status.current.size.total, 1)})`;
    }
    nodes.status.progress.current.innerHTML =   status.current.progress +'%';
    nodes.status.progress.current.style.width =  status.current.progress + '%';
    nodes.status.progress.total.innerHTML =   status.total.progress +'%';
    nodes.status.progress.total.style.width =  status.total.progress + '%';
    nodes.status.size.innerHTML =
        Human.getSize(status.total.size.uploaded, 1) + ' / ' + Human.getSize(status.total.size.total, 1);
    nodes.status.speed.innerHTML = Human.getSize(status.chunk.speed, 1) + '/c';
    nodes.status.time.innerHTML =
        Human.getInterval(status.total.time.elapsed) + ' / ' + Human.getInterval(status.total.time.estimate);
    console.debug(
        '#' + status.chunk.number.toString(),
        Human.getNumber((status.chunk.size / 1024).toFixed()).padStart(8) + ' КБ',
        Human.getNumber((status.chunk.speed / 1024).toFixed()).padStart(8) + ' КБ/с',
        Human.getNumber(status.chunk.time.toFixed(3)).padStart(8) + ' c'
    );
};
callbacks.timeout = () => {alert('Сервер не відповідає, спробуйте пізніше')};
callbacks.resolve = async () => {
    nodes.alert.classList.remove('d-none');
    await modal.close();
};
callbacks.reject = async (message) => {
    alert(message);
    await modal.close();
};

/* Реакції на різні дії користувача */
let upload;
nodes.buttons.file.addEventListener('change', async function() {
    if (!this.files.length) return;
    upload = await new SafeUpload(this.files, settings, callbacks);
    nodes.buttons.pause.style.display = 'none';
    nodes.buttons.resume.style.display = 'none';
    nodes.modal.self.style.display = 'block';
    nodes.status.progress.current.parentElement.style.display = (this.files.length === 1) ? 'none' : 'flex';
    nodes.alert.classList.add('d-none');
    await modal.open();
    if (await upload.start()) {
        nodes.buttons.pause.style.display = 'block';
        timers.start = timers.iteration = (new Date()).getTime();
    }
});
nodes.buttons.pause.addEventListener('click', () => {
    nodes.buttons.pause.disabled = true;
    upload.pause();
});
nodes.buttons.resume.addEventListener('click', async () => {
    nodes.buttons.resume.disabled = true;
    if (await upload.resume()) {
        nodes.buttons.pause.style.display = 'block';
        nodes.buttons.resume.style.display = 'none';
        timers.start = (new Date()).getTime() - (timers.pause - timers.start);
    }
    nodes.buttons.resume.disabled = false;
});
nodes.buttons.cancel.addEventListener('click', async () => {
    nodes.buttons.cancel.disabled = true;
    await upload.cancel();
    nodes.buttons.cancel.disabled = false;
    await modal.close();
});

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}