/**
 * Скрипт для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */

$(document).ready(function(){
    let file, timer, upload;
    const limit = 100 * 1048576;
    const nodes = new function() {
        this.main = $('main');
        this.alert = this.main.find('div.alert');
        this.form = this.main.find('form');
        this.fileForm = this.form.find('div.file');
        this.progressForm = this.form.find('div.progress');
        this.controlForm = this.form.find('div.control');
        this.statusForm = this.form.find('div.status');
        this.fileButton = this.fileForm.find('input');
        this.progressBar = this.progressForm.find('div.progress-bar');
        this.uploadButton = this.controlForm.find('input.upload');
        this.pauseButton = this.controlForm.find('input.pause');
        this.resumeButton = this.controlForm.find('input.resume');
        this.cancelButton = this.controlForm.find('input.cancel');
        this.sizeIndicator = this.fileForm.find('span');
        this.speedIndicator = this.statusForm.find('span.speed');
        this.timeIndicator = this.statusForm.find('span.time');
    };
    nodes.alert.hide();
    nodes.main.find('div.form').show();
    nodes.fileButton.change(function() {
        file = $(this)[0].files[0];
        if (file === undefined) return false;
        if (file.size > limit) {
            alert('Розмір файлу більше допустимого');
            return;
        }
        nodes.form[0].reset();
        nodes.uploadButton.removeAttr('disabled');
        nodes.sizeIndicator.text('('+Human.size(file.size)+')');
        upload = new Upload(file, {timeout: 3000, retry: {interval: 3000, limit: 5}});
        upload.addListener('start', function() {
            nodes.uploadButton.attr('disabled', 'disabled');
            nodes.pauseButton.removeAttr('disabled');
            nodes.cancelButton.removeAttr('disabled');
            timer = setInterval(updateIndicators, 1000);
        });
        upload.addListener('pause', function() {
            nodes.pauseButton.attr('disabled', 'disabled');
            nodes.resumeButton.removeAttr('disabled');
        });
        upload.addListener('resume',function() {
            nodes.resumeButton.attr('disabled', 'disabled');
            nodes.pauseButton.removeAttr('disabled');
        });
        upload.addListener('stop', function() {
            clearInterval(timer);
            updateIndicators();
            nodes.form[0].reset();
            nodes.fileButton.removeAttr('disabled');
            nodes.cancelButton.attr('disabled', 'disabled');
            nodes.uploadButton.attr('disabled', 'disabled');
            nodes.pauseButton.attr('disabled', 'disabled');
            nodes.resumeButton.attr('disabled', 'disabled');
            nodes.progressBar.css('width', 0).text(null);
            nodes.sizeIndicator.text(null);
            nodes.speedIndicator.text(null);
            nodes.timeIndicator.text(null);
        });
        upload.addListener('fail', function() {
            nodes.fileButton.removeAttr('disabled');
            nodes.uploadButton.attr('disabled', 'disabled');
            nodes.pauseButton.attr('disabled', 'disabled');
            nodes.resumeButton.attr('disabled', 'disabled');
            nodes.cancelButton.attr('disabled', 'disabled');
            clearInterval(timer);
            updateIndicators();
            alert('Помилка! ' + upload.getError());
        });
        upload.addListener('finish', function() {
            nodes.fileButton.removeAttr('disabled');
            nodes.pauseButton.attr('disabled', 'disabled');
            nodes.resumeButton.attr('disabled', 'disabled');
            nodes.cancelButton.attr('disabled', 'disabled');
            clearInterval(timer);
            updateIndicators();
        });
    });

    nodes.uploadButton.click(function() {upload.start();});
    nodes.pauseButton.click(function() {upload.pause();});
    nodes.resumeButton.click(function() {upload.resume();});
    nodes.cancelButton.click(function() {upload.stop();});

    function updateIndicators() {
        let indicators = upload.getIndicators();
        nodes.progressBar
            .css('width', indicators.percent + '%')
            .text(Human.size(indicators.size) + ' (' + indicators.percent + '%)');
        nodes.speedIndicator.text(
            Human.size(indicators.speed) + '/c' + ' (' + Human.size(indicators.chunk) + ')'
        );
        nodes.timeIndicator.text(
            Human.time(indicators.timeElapsed) + ' / ' + Human.time(indicators.timeEstimate)
        );
    }
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
