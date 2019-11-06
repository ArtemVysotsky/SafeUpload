/**
 * Головний скрипт
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */

$(document).ready(function() {

    console.log(uploadForm);

    uploadForm.nodes = new function() {
        this.main = $('main');
        this.alert = this.main.find('div.alert');
        this.card = this.main.find('div.card');
        this.form = this.card.find('div.card-body form');
        this.fileForm = this.form.find('div.file');
        this.progressForm = this.form.find('div.progress');
        this.controlForm = this.form.find('div.control');
        this.statusForm = this.form.find('div.status');
        this.fileInput = this.fileForm.find('input');
        this.progressBar = this.progressForm.find('div.progress-bar');
        this.uploadButton = this.controlForm.find('input.upload');
        this.pauseButton = this.controlForm.find('input.pause');
        this.resumeButton = this.controlForm.find('input.resume');
        this.cancelButton = this.controlForm.find('input.cancel');
        this.sizeIndicator = this.fileForm.find('span');
        this.speedIndicator = this.statusForm.find('span.speed');
        this.timeIndicator = this.statusForm.find('span.time');
    };

    console.log(uploadForm.nodes);
    console.log(uploadForm.alert);
    console.log(uploadForm.alert.hide);

//uploadForm.alert.hide();
    uploadForm.nodes.card.show();

    uploadForm.triggers = new function() {
        console.log(this);
        this.nodes.fileInput.change(function() {this.chooseEvent($(this)[0].files[0]);});
        this.nodes.uploadButton.click(function() {this.startEvent()});
        this.nodes.pauseButton.click(function() {this.pauseEvent()});
        this.nodes.resumeButton.click(function() {this.resumeEvent()});
        this.nodes.cancelButton.click(function() {this.stopEvent()});
        this.nodes.alert.click(this.alert.hide);
    };
/*
    uploadForm.nodes.fileInput.change(function() {uploadForm.chooseEvent($(this)[0].files[0]);});
    uploadForm.nodes.uploadButton.click(function() {uploadForm.startEvent()});
    uploadForm.nodes.pauseButton.click(function() {uploadForm.pauseEvent()});
    uploadForm.nodes.resumeButton.click(function() {uploadForm.resumeEvent()});
    uploadForm.nodes.cancelButton.click(function() {uploadForm.stopEvent()});
    uploadForm.nodes.alert.click(uploadForm.alert.hide);
*/
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
