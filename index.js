/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */
'use strict';
let u = new Upload('file', 'options');
$(document).ready(function() {
    const limit = 100 * 1048576, interval = {status: 1000, size: 200};
    let file, upload, timer = {status: {}, size: null};
    let nodes = new function() {return null};
    nodes.main = $('main');
    nodes.alert = nodes.main.find('div.alert');
    nodes.card = nodes.main.find('div.card');
    nodes.form = nodes.card.find('div.card-body form');
    nodes.form = new function() {return nodes.card.find('div.card-body form');};
    nodes.form.file = nodes.form.find('div.file');
    nodes.form.progress = nodes.form.find('div.progress');
    nodes.form.control = nodes.form.find('div.control');
    nodes.form.status = nodes.form.find('div.status');
    nodes.buttons = new function() {return null};
    nodes.buttons.file = nodes.form.file.find('input');
    nodes.buttons.upload = nodes.form.control.find('input.upload');
    nodes.buttons.pause = nodes.form.control.find('input.pause');
    nodes.buttons.resume = nodes.form.control.find('input.resume');
    nodes.buttons.cancel = nodes.form.control.find('input.cancel');
    nodes.indicators = new function() {return null};
    nodes.indicators.size = nodes.form.file.find('span');
    nodes.indicators.speed = nodes.form.status.find('span.speed');
    nodes.indicators.time = nodes.form.status.find('span.time');
    nodes.indicators.progress = nodes.form.progress.find('div.progress-bar');


    nodes.alert.toggle().click(function(){$(this).hide();});
    nodes.card.show();

    nodes.buttons.file.change(function() {
        nodes.indicators.size.text(null);
        nodes.indicators.speed.text(null);
        nodes.indicators.time.text(null);
        nodes.indicators.progress.css('width', 0).text(null);
        file = $(this)[0].files[0];
        if (file === undefined) return false;
        if (file.size > limit) {
            nodes.alert.text('Розмір файлу більше допустимого').show();
            nodes.form[0].reset();
            nodes.buttons.upload.disable();
            file = null;
            return false;
        }
        nodes.buttons.upload.enable();
        nodes.indicators.size.text('(' + Human.size(file.size) + ')');
    });

    nodes.buttons.upload.click(function() {
        nodes.buttons.pause.enable();
        nodes.buttons.cancel.enable();
        nodes.buttons.file.disable();
        nodes.buttons.upload.disable();
        upload = new Upload(file,{timeout: 3000, retry: {interval: 3000, limit: 5}}, {
            done: function() {},
            fail: function () {
                nodes.buttons.upload.disable();
                nodes.alert.text('Помилка! ' + upload.getError()).show();},
            always: function() {
                nodes.buttons.file.enable();
                nodes.buttons.pause.disable();
                nodes.buttons.resume.disable();
                nodes.buttons.cancel.disable();
                clearInterval(timer.status);
                clearInterval(timer.size);
            }
        });
        timer.status = setInterval(function() {
            let status = upload.getStatus();
            nodes.indicators.speed.text(
                Human.size(status.speed) + '/c' + ' (' + Human.size(status.chunk) + ')'
            );
            nodes.indicators.time.text(
                Human.time(status.time.elapsed) + ' / ' + Human.time(status.time.estimate)
            );
        }, interval.status);
        timer.size = setInterval(function() {
            let size = upload.getSize();
            let percent = Math.round(size * 100 / file.size);
            nodes.indicators.progress.css('width',  percent + '%')
                .text(Human.size(size) + ' (' + percent + '%)');
        }, interval.size);
        upload.start({
            done: function() {},
            fail: function () {
                nodes.buttons.upload.disable();
                nodes.alert.text('Помилка! ' + upload.getError()).show();},
            always: function() {
                nodes.buttons.file.enable();
                nodes.buttons.pause.disable();
                nodes.buttons.resume.disable();
                nodes.buttons.cancel.disable();
                clearInterval(timer.status);
                clearInterval(timer.size);
            }
        });
    });

    nodes.buttons.pause.click(function() {
        upload.pause(function() {
            nodes.buttons.resume.enable();
            nodes.buttons.pause.disable();
        });
    });

    nodes.buttons.resume.click(function() {
        upload.resume({done: function() {
            nodes.buttons.pause.enable();
            nodes.buttons.resume.disable();
        }});
    });

    nodes.buttons.cancel.click(function() {
        upload.stop({done: function() {
            nodes.form[0].reset();
            clearInterval(timer.status);
            clearInterval(timer.size);
            nodes.buttons.file.enable();
            nodes.buttons.upload.disable();
            nodes.buttons.pause.disable();
            nodes.buttons.resume.disable();
            nodes.buttons.cancel.disable();
        }});
    });

    jQuery.fn.enable = function() {return this.prop('disabled', false);};
    jQuery.fn.disable = function() {return this.prop('disabled', true);};
});


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
