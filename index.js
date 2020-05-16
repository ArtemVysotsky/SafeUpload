/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/SafeUpload
 * @copyright   GNU General Public License v3
 */

/* Налаштування завантаження */
const settings = {
    url: 'api.php', // Адреса API для збереження файлу на диск
    chunkSizeMaximum: 16 * 1024 ** 2, // Максимальний розмір фрагмента файлу, байти
    fileSizeLimit: 3 * 1024 ** 3, // Максимальний розмір файлу, байти
    interval: 1, // Рекомендована тривалість запиту, секунди
    timeout: 3, // Максимальна тривалість запиту, секунди
    retryLimit: 3, // Максимальна кількість повторних запитів
    retryDelay: 3 // Тривалість паузи між повторними запитами, секунди
};

/* Збережені посилання на елементи сторінки */
let nodes = {};
nodes.main = document.querySelector('main');
nodes.modal = {};
nodes.modal.self = nodes.main.querySelector('.modal');
nodes.modal.header = nodes.modal.self.querySelector('.modal-header');
nodes.modal.progresses = nodes.modal.self.querySelector('.progresses');
nodes.modal.status = nodes.modal.self.querySelector('.status');
nodes.modal.buttons = nodes.modal.self.querySelector('.buttons');
nodes.status = {};
nodes.status.name = nodes.modal.self.querySelector('div.name');
nodes.status.progress = {};
nodes.status.progress.current = nodes.modal.progresses.querySelector('.progress.current .progress-bar');
nodes.status.progress.total = nodes.modal.progresses.querySelector('.progress.total .progress-bar');
nodes.status.size = nodes.modal.status.querySelector('.size');
nodes.status.speed = nodes.modal.status.querySelector('.speed');
nodes.status.time = nodes.modal.status.querySelector('.time');
nodes.buttons = {};
nodes.buttons.file = nodes.main.querySelector('.card #file');
nodes.buttons.pause = nodes.modal.buttons.querySelector('.pause');
nodes.buttons.resume = nodes.modal.buttons.querySelector('.resume');
nodes.buttons.cancel = nodes.modal.buttons.querySelector('.cancel');
nodes.buttons.close = nodes.modal.header.querySelector('.close span');

/* Реакції на різні дії процесу завантаження файла */
let callbacks = {};
callbacks.pause = () => {
    nodes.buttons.pause.disabled = false;
    nodes.buttons.pause.style.display = 'none';
    nodes.buttons.resume.style.display = 'block';
};
callbacks.iteration = (status) => {
    status.current.progress = Math.round(status.current.size.uploaded * 100 / status.current.size.total);
    status.total.progress = Math.round(status.total.size.uploaded * 100 / status.total.size.total);
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
callbacks.resolve = async () => {console.log('Файли завантажено на сервер')};
callbacks.reject = async (message) => {alert(message)};
callbacks.finally = async () => {
    nodes.modal.self.classList.remove('show');
    await sleep(parseFloat(nodes.modal.self.style.transitionDuration) * 1000);
    nodes.modal.self.style.display = 'none';
    nodes.buttons.file.disabled = false;
    nodes.buttons.file.value = null;
};

/* Реакції на різні дії користувача */
let upload;
nodes.buttons.file.addEventListener('change', async function() {
    if (!this.files.length) return;
    upload = new Upload(this.files, settings, callbacks);
    nodes.buttons.file.disabled = true;
    nodes.buttons.resume.style.display = 'none';
    nodes.status.progress.current.parentElement.style.display = (this.files.length === 1) ? 'none' : 'flex';
    nodes.modal.self.style.transition = 'opacity .5s';
    nodes.modal.self.style.display = 'block';
    await sleep(0);
    nodes.modal.self.classList.add('show');
    upload.start();
});
nodes.buttons.pause.addEventListener('click', () => {
    nodes.buttons.pause.disabled = true;
    upload.pause();
});
nodes.buttons.resume.addEventListener('click', () => {
    upload.resume();
    nodes.buttons.pause.style.display = 'block';
    nodes.buttons.resume.style.display = 'none';
});
nodes.buttons.cancel.addEventListener('click', () => {
    nodes.buttons.cancel.disabled = true;
    upload.cancel();
    nodes.buttons.cancel.disabled = false;
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
        if (Math.abs(bytes) < thousand) return bytes + ' Б';
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
