/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */

$(document).ready(function() {
    const limit = 100 * 1048576;
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

    nodes.alert.css('visibility', 'hidden').click(function(){
        $(this).css('visibility', 'hidden');
    });
    nodes.card.css('visibility', 'visible');

    nodes.fileButton.change(function() {
        console.log($(this)[0].files[0]);
        file = $(this)[0].files[0];
        if (file === undefined) return false;
        if (file.size > limit) {
            nodes.alert
                .text('Розмір файлу більше допустимого')
                .css('visibility', 'visible');
            return;
        }
        //nodes.form[0].reset();
        nodes.uploadButton.prop('disabled', false);
        nodes.sizeIndicator.text('('+Human.size(file.size)+')');
        nodes.speedIndicator.text(null);
        nodes.timeIndicator.text(null);
        nodes.progressBar.css('width', 0).text(null);
        upload = new Upload(file, {timeout: 3000, retry: {interval: 3000, limit: 5}});
        upload.addListener('done', function() {
            nodes.fileButton.prop('disabled', false);
            nodes.pauseButton.prop('disabled', true);
            nodes.resumeButton.prop('disabled', true);
            nodes.cancelButton.prop('disabled', true);
            setTimeout(function(){clearInterval(timer.status, timer.size);}, 1000);
        });
        upload.addListener('fail', function () {
            nodes.fileButton.prop('disabled', false);
            //nodes.uploadButton.prop('disabled', true);
            nodes.pauseButton.prop('disabled', true);
            nodes.resumeButton.prop('disabled', true);
            nodes.cancelButton.prop('disabled', true);
            setTimeout(function(){clearInterval(timer.status, timer.size);}, 1000);
            nodes.alert.text('Помилка! ' + upload.getError()).visibility('visible');
        });
        console.log(upload);
    });

    nodes.uploadButton.click(function() {
        console.log($(this)); //this.startEvent()
        nodes.fileButton.prop('disabled', true);
        nodes.uploadButton.prop('disabled', true);
        nodes.pauseButton.prop('disabled', false);
        nodes.cancelButton.prop('disabled', false);
        timer.status = setInterval(function(){
            let status = upload.getStatus();
            nodes.speedIndicator.text(
                Human.size(status.speed) + '/c' + ' (' + Human.size(status.chunk) + ')'
            );
            nodes.timeIndicator.text(
                Human.time(status.timeElapsed) + ' / ' + Human.time(status.timeEstimate)
            );
        }, 1000);
        timer.size = setInterval(function(){
            let size = upload.getSize();
            let percent = Math.round(size * 100 / file.size);
            nodes.progressBar.css('width',  percent + '%')
                .text(Human.size(size) + ' (' + percent + '%)');
        }, 100);
        upload.start();
    });

    nodes.pauseButton.click(function() {
        console.log($(this)); //this.pauseEvent()
    });

    nodes.resumeButton.click(function() {
        console.log($(this)); //this.resumeEvent()
    });

    nodes.cancelButton.click(function() {
        console.log($(this)); //this.stopEvent()
    });
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
