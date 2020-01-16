/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

/** ToDo: Переробити таймери та інтервали в об'єкт разом зі ідентифікаторами */

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
    nodes.card = nodes.main.find('div.card');
    nodes.form = {};
    nodes.form.self = nodes.card.find('div.card-body form');
    nodes.form.file = nodes.form.self.find('div.file');
    nodes.form.progress = nodes.form.self.find('div.progress');
    nodes.form.control = nodes.form.self.find('div.control');
    nodes.form.status = nodes.form.self.find('div.status');
    nodes.buttons = {};
    nodes.buttons.file = nodes.form.file.find('input');
    nodes.buttons.upload = nodes.form.control.find('input.upload');
    nodes.buttons.pause = nodes.form.control.find('input.pause');
    nodes.buttons.resume = nodes.form.control.find('input.resume');
    nodes.buttons.cancel = nodes.form.control.find('input.cancel');
    nodes.indicators = {};
    nodes.indicators.size = nodes.form.file.find('span');
    nodes.indicators.speed = nodes.form.status.find('span.speed');
    nodes.indicators.time = nodes.form.status.find('span.time');
    nodes.indicators.progress = nodes.form.progress.find('div.progress-bar');


    let callbacks = {};
    callbacks.start = () => { // Дії при запуску процесу завантаження файлу
        nodes.buttons.file.disable();
        nodes.buttons.upload.disable();
        nodes.buttons.pause.enable();
        nodes.buttons.cancel.enable();
        // Запускаємо періодичне оновлення статусу та розміру завантаження файлу
        timer.status = setInterval(Update.status, interval.status);
        timer.size = setInterval(Update.size, interval.size);
    };
    callbacks.pause = () => { // Дії при призупиненні процесу завантаження файлу
        nodes.buttons.resume.enable();
        nodes.buttons.pause.disable();
        setTimeout(() => {clearInterval(timer.status)}, interval.status);
        setTimeout(() => {clearInterval(timer.size)}, interval.size);
    };
    callbacks.resume = () => { // Дії при продовжені процесу завантаження файлу
        nodes.buttons.pause.enable();
        nodes.buttons.resume.disable();
        timer.status = setInterval(Update.status, interval.status);
        timer.size = setInterval(Update.size, interval.size);
    };
    callbacks.stop = () => { // Дії при зупинці процесу завантаження файлу
        nodes.buttons.file.enable();
        nodes.buttons.pause.disable();
        nodes.buttons.resume.disable();
        nodes.buttons.cancel.disable();
        setTimeout(() => {clearInterval(timer.status)}, interval.status);
        setTimeout(() => {clearInterval(timer.size)}, interval.size);
    };
    callbacks.timeout = () => { // Дії при невдалому продовжені процесу завантаження файлу
console.log('callbacks.timeout.fail');
        callbacks.pause();
        alert('Сервер не відповідає, спробуйте пізніше');
    };
    callbacks.upload = {
        done: () => { // Дії при успішному завершенні процесу завантаженні файлу
            console.log('Файл "' + file.name + '" завантажено вдало');
        },
        fail: () => { // Дії при невдалому виконанні процесу завантаженні файлу
            nodes.buttons.upload.disable();
            alert(upload.getMessage())
        },
        always: () => { // Дії при успішному завершенні та невдалому виконанні процесу завантаження файлу
            callbacks.stop();
        }
    };

    // Дії при виборі файлу користувачем
    nodes.buttons.file.change(function() {
        file = $(this)[0].files[0];
        if (file === undefined) return false;
        nodes.buttons.upload.enable();
        nodes.indicators.size.text('(' + human.size(file.size) + ')');
        nodes.indicators.speed.text('');
        nodes.indicators.time.text('');
        nodes.indicators.progress.css('width', 0).text(null);
    });
    // Дії при запуску процесу завантаження файлу
    nodes.buttons.upload.click(() => {
        // Створення об'єкту для завантаження файлу зі зворотніми функціями
        upload = new Upload(file, callbacks);
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
                human.size(status.speed) + '/c' + ' (' + human.size(status.chunk) + ')'
            );
            nodes.indicators.time.text(
                human.time(status.time.elapsed) + ' / ' + human.time(status.time.estimate)
            );
        };
        static size() {
            let size = upload.getSize();
            let percent = Math.round(size * 100 / file.size);
            nodes.indicators.progress.css('width',  percent + '%')
                .text(human.size(size) + ' (' + percent + '%)');
        };
    }
});


// Створення додаткових допоміжних функцій для завантаження файлу
$.fn.enable = function() {return this.prop('disabled', false)};
$.fn.disable = function() {return this.prop('disabled', true)};


// Клас для виводу розміру файлу та інтервалу часу в зручному для людині вигляді
let human = new function() {

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
