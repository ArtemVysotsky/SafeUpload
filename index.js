/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

/** ToDo: Перевірити код на доцільність використання JS-селекторів замість jQuery */
/** ToDo: Перевірити перехоплення виключень */

$(document).ready(function() {
    let upload;

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

    // Дії на різні випадки процесу завантаження файлу
    const callbacks = {
        resolve: () => {
            nodes.buttons.file.enable();
            nodes.buttons.pause.disable();
            nodes.buttons.resume.disable();
            nodes.buttons.cancel.disable();
            console.log('Завантаження файла завершено');
        },
        pause: () => {
            nodes.buttons.resume.enable();
            nodes.buttons.pause.disable();
        },
        timeout: () => {
            nodes.buttons.resume.enable();
            nodes.buttons.pause.disable();
            alert('Сервер не відповідає, спробуйте пізніше');
        },
        reject: () => {
            nodes.buttons.file.enable();
            nodes.buttons.upload.disable();
            nodes.buttons.pause.disable();
            nodes.buttons.resume.disable();
            nodes.buttons.cancel.disable();
            alert(upload.message);
        },
        iteration: (status) => {
            nodes.indicators.speed.text(
                human.size(status.speed) + '/c' + ' (' + human.size(status.chunk) + ')'
            );
            nodes.indicators.time.text(
                human.time(status.time.elapsed) + ' / ' + human.time(status.time.estimate)
            );
            nodes.indicators.progress.text(human.size(upload.size.bytes) + ' (' + upload.size.percent + '%)');
            nodes.indicators.progress.css('width',  upload.size.percent + '%');
        }
    };

    try {
        // Дії при виборі файлу користувачем
        nodes.buttons.file.change(function() {
            let file = $(this)[0].files[0];
            if (file === undefined) return false;
            if (file.size > (2 * 1024 * 1024 * 1024))
                throw 'Розмір файлу більше допустимого';
            upload = new Upload(file, callbacks);
            nodes.buttons.upload.enable();
            nodes.indicators.speed.text('');
            nodes.indicators.time.text('');
            nodes.indicators.progress.css('width', 0).text(null);
        });

        // Прописуемо реакції на різні дії користувача
        nodes.buttons.upload.click(async () => {
            await upload.start();
            nodes.buttons.file.disable();
            nodes.buttons.upload.disable();
            nodes.buttons.pause.enable();
            nodes.buttons.cancel.enable();
        });
        nodes.buttons.pause.click(() => upload.pause());
        nodes.buttons.resume.click(async () => {
            await upload.resume();
            nodes.buttons.pause.enable();
            nodes.buttons.resume.disable();
        });
        nodes.buttons.cancel.click(async () => {
            nodes.buttons.file.enable();
            nodes.buttons.pause.disable();
            nodes.buttons.resume.disable();
            nodes.buttons.cancel.disable();
            await upload.cancel();
        });
    } catch (e) {
        alert(e.message);
    }
});


// Спрощення увімнення/вимкнення елементів форми
$.fn.enable = function() {return this.prop('disabled', false)};
$.fn.disable = function() {return this.prop('disabled', true)};


// Вивід розміру файлу та інтервалу часу в зручному для людині вигляді
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