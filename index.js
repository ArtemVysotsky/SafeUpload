/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */
$(document).ready(function() {

    const interval = {status: 1000, size: 200};
    let file, upload, update, timer = {status: {}, size: null};
    let nodes = {};
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

    nodes.alert.toggle().click(function(){$(this).hide();});
    nodes.card.show();

    nodes.buttons.file.change(function() {
        nodes.indicators.size.text('');
        nodes.indicators.speed.text('');
        nodes.indicators.time.text('');
        nodes.indicators.progress.css('width', 0).text(null);
        file = $(this)[0].files[0];
        if (file === undefined) return false;
        if (file.size > (10 * 1024 * 1024)) {
            nodes.alert.text('Розмір файлу більше допустимого').show();
            nodes.form.self[0].reset();
            nodes.buttons.upload.disable();
            file = null;
            return false;
        }
        nodes.buttons.upload.enable();
        nodes.indicators.size.text('(' + Human.size(file.size) + ')');
    });

    nodes.buttons.upload.click(function() {
        const options = {limit: 10 * 1024 * 1024, timeout: 3, retry: {interval: 3, limit: 5}};
        upload = new Upload('/api.php', file, options, {
            done: function() {},
            fail: function () {
                nodes.buttons.upload.disable();
                nodes.alert.text('Помилка! ' + upload.getError()).show();},
            always: function() {
                nodes.buttons.file.enable();
                nodes.buttons.pause.disable();
                nodes.buttons.resume.disable();
                nodes.buttons.cancel.disable();
                setTimeout(function () {clearInterval(timer.status)}, interval.status);
                setTimeout(function () {clearInterval(timer.size)}, interval.size);
            }
        });
        timer.status = setInterval(update.status, interval.status);
        timer.size = setInterval(update.size, interval.size);
        upload.start({
            done: function() {
                nodes.buttons.file.disable();
                nodes.buttons.upload.disable();
                nodes.buttons.pause.enable();
                nodes.buttons.cancel.enable();
            },
            fail: function () {
                nodes.alert.text('Помилка! ' + upload.getError()).show();},
            always: function() {}
        });
    });

    nodes.buttons.pause.click(function() {
        upload.pause(function() {
            nodes.buttons.resume.enable();
            nodes.buttons.pause.disable();
            setTimeout(function () {clearInterval(timer.status)}, interval.status);
            setTimeout(function () {clearInterval(timer.size)}, interval.size);
        });
    });

    nodes.buttons.resume.click(function() {
        upload.resume({done: function() {
            nodes.buttons.pause.enable();
            nodes.buttons.resume.disable();
            timer.status = setInterval(update.status, interval.status);
            timer.size = setInterval(update.size, interval.size);
        }});
    });

    nodes.buttons.cancel.click(function() {
        upload.stop({done: function() {
            //nodes.form.self[0].reset();
            clearInterval(timer.status);
            clearInterval(timer.size);
            nodes.buttons.file.enable();
            nodes.buttons.upload.disable();
            nodes.buttons.pause.disable();
            nodes.buttons.resume.disable();
            nodes.buttons.cancel.disable();
        }});
    });

    update = new function() {
        this.status = function() {
            let status = upload.getStatus();
            nodes.indicators.speed.text(
                Human.size(status.speed) + '/c' + ' (' + Human.size(status.chunk) + ')'
            );
            nodes.indicators.time.text(
                Human.time(status.time.elapsed) + ' / ' + Human.time(status.time.estimate)
            );
        };
        this.size = function() {
            let size = upload.getSize();
            let percent = Math.round(size * 100 / file.size);
            nodes.indicators.progress.css('width',  percent + '%')
                .text(Human.size(size) + ' (' + percent + '%)');
        };
    };
});

Object.prototype.callIfExists = function(method, argument) {
    if (this[method] !== undefined) this[method](argument); return true;
};
Object.defineProperty(Object.prototype, 'callIfExists', {enumerable: false});

$.fn.enable = function() {return this.prop('disabled', false)};
$.fn.disable = function() {return this.prop('disabled', true)};
$.fn.findFirst = function(selector) {return this.find(selector).first();};

class Human {
    static size(bytes) {
        const thousand = 1000;
        if(Math.abs(bytes) < thousand) return bytes + ' B';
        let i = -1;
        const units = ['КБ','МБ','ГБ'];
        do {bytes /= thousand; ++i;
        } while(Math.abs(bytes) >= thousand && i < units.length - 1);
        return bytes.toFixed(1)+' '+units[i];
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
