/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */
$(document).ready(function() {
    const url = '/api.php', // адреса скрипта з API для отримання файлу
        options = {
            limit: (10 * 1024 * 1024), // максимальний розмір файлу, байти
            timeout: 3, // час очікування відповіді від скрипта API, секунди
            retry: {
                interval: 3, // час очікування між повторними запитами, секунди
                limit: 5}}, // максимальна кількість повторних запитів
        interval = {
            status: 1000, // інтервал оновляення статусу завантаження файлу, мілісекунди
            size: 200}; // інтервал оновляення розміру завантаження файлу, мілісекунди
    let file, upload, timer = {status: {}, size: null}; // робочі змінні
    let nodes = {}; // збережені посилання на елементи сторінки
    nodes.main = $('main');
    nodes.alert = nodes.main.findFirst('div.alert');
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


    nodes.alert.toggle().click(function(){$(this).hide()}); // ховаємо надпис про необхідність JS
    nodes.card.show(); // показуємо форму завантаження файлу

    // Дії при виборі файлу користувачем
    nodes.buttons.file.change(function() {
        file = $(this)[0].files[0];
        if (file === undefined) return false;
        if (file.size > options.limit) {
            nodes.alert.text('Розмір файлу більше допустимого').show();
            nodes.form.self[0].reset();
            nodes.buttons.upload.disable();
            file = null;
            return false;
        }
        nodes.buttons.upload.enable();
        nodes.indicators.size.text('(' + Human.size(file.size) + ')');
        nodes.indicators.speed.text('');
        nodes.indicators.time.text('');
        nodes.indicators.progress.css('width', 0).text(null);
    });

    // Дії при запуску процесу завантаження файлу
    nodes.buttons.upload.click(() => {
        // Створення об'єкту для завантаження файлу зі зворотніми функціями
        upload = new Upload(url, file, options, {
            done: () => { // дії при успішному завантаженні файлу
                console.log('Файл "' + file.name + '" завантажено вдало');
            },
            fail: () => { // дії при невдалому завантаженні файлу
                nodes.buttons.upload.disable();
                nodes.alert.text(upload.getError()).show()},
            always: () => { // дії для любих випадків
                nodes.buttons.file.enable();
                nodes.buttons.pause.disable();
                nodes.buttons.resume.disable();
                nodes.buttons.cancel.disable();
                setTimeout(function () {clearInterval(timer.status)}, interval.status);
                setTimeout(function () {clearInterval(timer.size)}, interval.size);
            }
        });

        // Запускаємо періодичне оновлення статусу та розміру завантаження файлу
        timer.status = setInterval(Update.status, interval.status);
        timer.size = setInterval(Update.size, interval.size);

        // Запускаємо сам процес завантаження файлу
        upload.start(() => {
            nodes.buttons.file.disable();
            nodes.buttons.upload.disable();
            nodes.buttons.pause.enable();
            nodes.buttons.cancel.enable();
        });
    });

    // Дії при призупиненні процесу завантаження файлу
    nodes.buttons.pause.click(() => {
        upload.pause(() => {
            nodes.buttons.resume.enable();
            nodes.buttons.pause.disable();
            setTimeout(function () {clearInterval(timer.status)}, interval.status);
            setTimeout(function () {clearInterval(timer.size)}, interval.size);
        });
    });

    // Дії при продовжені процесу завантаження файлу
    nodes.buttons.resume.click(() => {
        upload.resume(() => {
            nodes.buttons.pause.enable();
            nodes.buttons.resume.disable();
            timer.status = setInterval(Update.status, interval.status);
            timer.size = setInterval(Update.size, interval.size);
        });
    });

    // Дії при відміні процесу завантаження файлу
    nodes.buttons.cancel.click(() => {
        upload.stop(() => {
            clearInterval(timer.status);
            clearInterval(timer.size);
            nodes.buttons.file.enable();
            nodes.buttons.upload.disable();
            nodes.buttons.pause.disable();
            nodes.buttons.resume.disable();
            nodes.buttons.cancel.disable();
        });
    });

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