/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

$(document).ready(function() {
    let file, upload;

    // Збережені посилання на елементи сторінки
    const nodes = new function () {
        const root = this;
        root.main = $('main');
        root.card = this.main.find('div.card');
        root.form = new function() {
            this.self = root.card.find('div.card-body form');
            this.file = this.self.find('div.file');
            this.progress = this.self.find('div.progress');
            this.control = this.self.find('div.control');
            this.status = this.self.find('div.status');
        };
        root.buttons = new function() {
            this.file = root.form.file.find('input');
            this.upload = root.form.control.find('input.upload');
            this.pause = root.form.control.find('input.pause');
            this.resume = root.form.control.find('input.resume');
            this.cancel = root.form.control.find('input.cancel');
        };
        root.indicators = new function() {
            this.speed = root.form.status.find('span.speed');
            this.time = root.form.status.find('span.time');
            this.progress = root.form.progress.find('div.progress-bar');
        };
    };

    // Таймери для оновлення інформації про процес завантаження файлу
    const timer = new function() {
        let timers = { // налаштування таймерів
            status: { // таймер для оновлення статусу завантаження файлу
                id: null, // номер таймера
                interval: 1000, // інтервал, мілісекунди
                callback: () => {
                    let status = upload.status;
                    nodes.indicators.speed.text(
                        human.size(status.speed) + '/c' + ' (' + human.size(status.chunk) + ')'
                    );
                    nodes.indicators.time.text(
                        human.time(status.time.elapsed) + ' / ' + human.time(status.time.estimate)
                    );
                }
            },
            size: { // таймер оновлення розміру завантаження файлу
                id: null, // номер таймера
                interval: 200, // інтервал, мілісекунди
                callback: () => {
                let size = upload.size;
                let percent = Math.round(size * 100 / file.size);
                nodes.indicators.progress.css('width',  percent + '%')
                    .text(human.size(size) + ' (' + percent + '%)');
            }}
        };
        this.start = () => {
            $.each(timers, function() {
                this.id = setInterval(this.callback, this.interval);
            });
        };
        this.stop = (timeout = true) => {
            $.each(timers, function() {
                if (timeout) {
                    setTimeout(() => {clearInterval(this.id)}, this.interval);
                } else {
                    clearInterval(this.id);
                }
            });
        }
    };

    // Дії на різні випадки процесу завантаження файлу
    const callbacks = {
        start: () => {
            timer.start();
            nodes.buttons.file.disable();
            nodes.buttons.upload.disable();
            nodes.buttons.pause.enable();
            nodes.buttons.cancel.enable();
        },
        pause: () => {
            nodes.buttons.resume.enable();
            nodes.buttons.pause.disable();
            timer.stop();
        },
        resume: () => {
            timer.start();
            nodes.buttons.pause.enable();
            nodes.buttons.resume.disable();
        },
        stop: () => {
            nodes.buttons.file.enable();
            nodes.buttons.pause.disable();
            nodes.buttons.resume.disable();
            nodes.buttons.cancel.disable();
            timer.stop();
        },
        done: () => {
            nodes.buttons.file.enable();
            nodes.buttons.pause.disable();
            nodes.buttons.resume.disable();
            nodes.buttons.cancel.disable();
            console.log('Файл "' + file.name + '" завантажено');
            timer.stop();
        },
        fail: () => {
            nodes.buttons.file.enable();
            nodes.buttons.upload.disable();
            nodes.buttons.pause.disable();
            nodes.buttons.resume.disable();
            nodes.buttons.cancel.disable();
            alert(upload.message);
            timer.stop();
        },
        timeout: () => {
            nodes.buttons.resume.enable();
            nodes.buttons.pause.disable();
            timer.stop(false);
            alert('Сервер не відповідає, спробуйте пізніше');
        }
    };

    // Дії при виборі файлу користувачем
    nodes.buttons.file.change(function() {
        file = $(this)[0].files[0];
        if (file === undefined) return false;
        nodes.buttons.upload.enable();
        nodes.indicators.speed.text('');
        nodes.indicators.time.text('');
        nodes.indicators.progress.css('width', 0).text(null);
    });

    // Прописуемо реакції на різні дії користувача
    nodes.buttons.upload.click(() => {
        upload = new Upload(file, callbacks);
        upload.start();
    });
    nodes.buttons.pause.click(() => upload.pause());
    nodes.buttons.resume.click(() => upload.resume());
    nodes.buttons.cancel.click(() => upload.stop());
});

// Спрощення увімнення/вимкнення елементів форми
$.fn.enable = function() {return this.prop('disabled', false)};
$.fn.disable = function() {return this.prop('disabled', true)};

// Вивід розміру файлу та інтервалу часу в зручному для людині вигляді
const human = new function() {
    this.size = function(bytes) {
        const thousand = 1000;
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
