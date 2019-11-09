/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */

$(document).ready(function() {
    const limit = 100 * 1048576, interval = {status: 1000, size: 100};
    let file, upload, timer = {status: {}, size: null};
    let nodes = new function() {
        this.main = $('main');
        this.alert = this.main.find('div.alert');
        this.card = this.main.find('div.card');
        this.form = this.card.find('div.card-body form');
        this.fileForm = this.form.find('div.file');
        this.progressForm = this.form.find('div.progress');
        this.controlForm = this.form.find('div.control');
        this.statusForm = this.form.find('div.status');
        this.progressBar = this.progressForm.find('div.progress-bar');
        this.fileButton = this.fileForm.find('input');
        this.uploadButton = this.controlForm.find('input.upload');
        this.pauseButton = this.controlForm.find('input.pause');
        this.resumeButton = this.controlForm.find('input.resume');
        this.cancelButton = this.controlForm.find('input.cancel');
        this.sizeIndicator = this.fileForm.find('span');
        this.speedIndicator = this.statusForm.find('span.speed');
        this.timeIndicator = this.statusForm.find('span.time');
    };

    nodes.alert.toggle().click(function(){$(this).hide();});
    nodes.card.show();

    nodes.fileButton.change(function() {
        console.log('nodes.fileButton.change');
        console.log($(this)[0].files[0]);
        file = $(this)[0].files[0];
        if (file === undefined) return false;
        if (file.size > limit) {
            nodes.alert.text('Розмір файлу більше допустимого').show();
            nodes.form[0].reset();
            file = null;
            return;
        }
        nodes.uploadButton.enable();
        nodes.sizeIndicator.text('('+Human.size(file.size)+')');
        nodes.speedIndicator.text(null);
        nodes.timeIndicator.text(null);
        nodes.progressBar.css('width', 0).text(null);
        upload = new Upload(file, {timeout: 3000, retry: {interval: 3000, limit: 5}});
        upload.addListener('done', function() {
            nodes.fileButton.enable();
            nodes.pauseButton.disable();
            nodes.resumeButton.disable();
            nodes.cancelButton.disable();
            clearIntervalAll();
        });
        upload.addListener('fail', function () {
            nodes.fileButton.enable();
            nodes.uploadButton.disable();
            nodes.pauseButton.disable();
            nodes.resumeButton.disable();
            nodes.cancelButton.disable();
            clearIntervalAll();
            nodes.alert.text('Помилка! ' + upload.getError()).visibility('visible');
        });
        console.log(upload);
    });

    nodes.uploadButton.click(function() {
        console.log('nodes.uploadButton.click');
        nodes.pauseButton.enable();
        nodes.cancelButton.enable();
        nodes.fileButton.disable();
        nodes.uploadButton.disable();
        timer.status = setInterval(function(){
            let status = upload.getStatus();
            nodes.speedIndicator.text(
                Human.size(status.speed) + '/c' + ' (' + Human.size(status.chunk) + ')'
            );
            nodes.timeIndicator.text(
                Human.time(status.timeElapsed) + ' / ' + Human.time(status.timeEstimate)
            );
        }, interval.status);
        timer.size = setInterval(function(){
            let size = upload.getSize();
            let percent = Math.round(size * 100 / file.size);
            nodes.progressBar.css('width',  percent + '%')
                .text(Human.size(size) + ' (' + percent + '%)');
        }, interval.size);
        upload.start();
    });

    nodes.pauseButton.click(function() {
        console.log('nodes.pauseButton.click');
        nodes.resumeButton.enable();
        nodes.pauseButton.disable();
        upload.pause();
    });

    nodes.resumeButton.click(function() {
        console.log('nodes.resumeButton.click');
        nodes.pauseButton.enable();
        nodes.resumeButton.disable();
        upload.resume();
    });

    nodes.cancelButton.click(function() {
        console.log('nodes.cancelButton.click');
        nodes.form[0].reset();
        clearIntervalAll();
        nodes.fileButton.enable();
        nodes.uploadButton.disable();
        nodes.pauseButton.disable();
        nodes.resumeButton.disable();
        nodes.cancelButton.disable();
        upload.cancel();
    });

    function clearIntervalAll() {
        setTimeout(function(){
            clearInterval(timer.status);
            clearInterval(timer.size);
        }, interval.status);
    }

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
