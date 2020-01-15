/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

$(document).ready(function() {
    let file, // об'єкт файл форми завантаження
        upload, // об'єкт для здійснення завантаження
        nodes = {}, // збережені посилання на елементи сторінки
        timer = {status: {}, size: null}, // мітки часу
        interval = {
            status: 1000, // інтервал оновляення статусу завантаження файлу, мілісекунди
            size: 200 // інтервал оновляення розміру завантаження файлу, мілісекунди
        };
    nodes.main = $('main');
    nodes.card = nodes.main.findFirst('div.card');
    nodes.form = {};
    nodes.form.self = nodes.card.findFirst('div.card-body form');
    nodes.form.file = nodes.form.self.findFirst('div.file');
    nodes.form.progress = nodes.form.self.findFirst('div.progress');
    nodes.form.control = nodes.form.self.findFirst('div.control');
    nodes.form.status = nodes.form.self.findFirst('div.status');
    nodes.buttons = {};
    nodes.buttons.file = nodes.form.file.findFirst('input');
    nodes.buttons.upload = nodes.form.control.findFirst('input.upload');
    nodes.buttons.pause = nodes.form.control.findFirst('input.pause');
    nodes.buttons.resume = nodes.form.control.findFirst('input.resume');
    nodes.buttons.cancel = nodes.form.control.findFirst('input.cancel');
    nodes.indicators = {};
    nodes.indicators.size = nodes.form.file.findFirst('span');
    nodes.indicators.speed = nodes.form.status.findFirst('span.speed');
    nodes.indicators.time = nodes.form.status.findFirst('span.time');
    nodes.indicators.progress = nodes.form.progress.findFirst('div.progress-bar');


    let callbacks = {};
    // Дії при запуску процесу завантаження файлу
    callbacks.start = () => {
        nodes.buttons.file.disable();
        nodes.buttons.upload.disable();
        nodes.buttons.pause.enable();
        nodes.buttons.cancel.enable();
    };
    // Дії при призупиненні процесу завантаження файлу
    callbacks.pause = () => {
        nodes.buttons.resume.enable();
        nodes.buttons.pause.disable();
        setTimeout(function () {clearInterval(timer.status)}, interval.status);
        setTimeout(function () {clearInterval(timer.size)}, interval.size);
    };
    // Дії при продовжені процесу завантаження файлу
    callbacks.resume = () => {
        nodes.buttons.pause.enable();
        nodes.buttons.resume.disable();
        timer.status = setInterval(Update.status, interval.status);
        timer.size = setInterval(Update.size, interval.size);
    };
    // Дії при зупинці процесу завантаження файлу
    callbacks.stop = () => {
        clearInterval(timer.status);
        clearInterval(timer.size);
        nodes.buttons.file.enable();
        nodes.buttons.upload.disable();
        nodes.buttons.pause.disable();
        nodes.buttons.resume.disable();
        nodes.buttons.cancel.disable();
    };
    // Дії при успішному завершенні процесу завантаженні файлу
    callbacks.done = () => {
        console.log('Файл "' + file.name + '" завантажено вдало');
    };
    // Дії при невдалому виконанні процесу завантаженні файлу
    callbacks.fail = () => {
        nodes.buttons.upload.disable();
        alert(upload.getError())
    };
    // Дії при успішному завершенні або невдалому виконанні процесу завантаження файлу
    callbacks.always = () => {
        nodes.buttons.file.enable();
        nodes.buttons.pause.disable();
        nodes.buttons.resume.disable();
        nodes.buttons.cancel.disable();
        setTimeout(function () {clearInterval(timer.status)}, interval.status);
        setTimeout(function () {clearInterval(timer.size)}, interval.size);
    };

    // Дії при виборі файлу користувачем
    nodes.buttons.file.change(function() {
        file = $(this)[0].files[0];
        if (file === undefined) return false;
        nodes.buttons.upload.enable();
        nodes.indicators.size.text('(' + Human.size(file.size) + ')');
        nodes.indicators.speed.text('');
        nodes.indicators.time.text('');
        nodes.indicators.progress.css('width', 0).text(null);
    });
    // Дії при запуску процесу завантаження файлу
    nodes.buttons.upload.click(() => {
        // Створення об'єкту для завантаження файлу зі зворотніми функціями
        upload = new Upload(file, callbacks);
        // Запускаємо періодичне оновлення статусу та розміру завантаження файлу
        timer.status = setInterval(Update.status, interval.status);
        timer.size = setInterval(Update.size, interval.size);
        upload.start();
    });
    // Дії при призупиненні процесу завантаження файлу
    nodes.buttons.pause.click(() => {upload.pause()});
    // Дії при продовжені процесу завантаження файлу
    nodes.buttons.resume.click(() => {upload.resume()});
    // Дії при відміні процесу завантаження файлу
    nodes.buttons.cancel.click(() => {upload.stop()});

    // Клас оновлення стутусу та розміру завантаження файлу
    class Update {
        static status() {
            let status = upload.getStatus();
            nodes.indicators.speed.text(
                Human.size(status.speed) + '/c' + ' (' + Human.size(status.chunk) + ')'
            );
            nodes.indicators.time.text(
                Human.time(status.time.elapsed) + ' / ' + Human.time(status.time.estimate)
            );
        };
        static size() {
            let size = upload.getSize();
            let percent = Math.round(size * 100 / file.size);
            nodes.indicators.progress.css('width',  percent + '%')
                .text(Human.size(size) + ' (' + percent + '%)');
        };
    }
});

// Створення додаткових допоміжних функцій для завантаження файлу
$.fn.enable = function() {return this.prop('disabled', false)};
$.fn.disable = function() {return this.prop('disabled', true)};
$.fn.findFirst = function(selector) {return this.find(selector).first()};

// Клас для виводу розміру файлу та інтервалу часу в зручному для людині вигляді
class Human {
    static size(bytes) {
        const thousand = 1000;
        if(Math.abs(bytes) < thousand) return bytes + ' B';
        let i = -1;
        const units = ['КБ','МБ','ГБ'];
        do {bytes /= thousand; ++i;} while(Math.abs(bytes) >= thousand && i < units.length - 1);
        return bytes.toFixed(1) + ' ' + units[i];
    }
    static time(interval) {
        let hours = Math.floor(((interval % 31536000) % 86400) / 3600);
        let minutes = Math.floor((((interval % 31536000) % 86400) % 3600) / 60);
        let seconds = (((interval % 31536000) % 86400) % 3600) % 60;
        if (hours.toString().length === 1) hours = '0' + hours;
        if (minutes.toString().length === 1) minutes = '0' + minutes;
        if (seconds.toString().length === 1) seconds = '0' + seconds;
        return hours + ':' + minutes + ':' + seconds;
    }
}