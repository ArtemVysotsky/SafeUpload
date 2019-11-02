/**
 * Скрипт для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */


/*let limit = 100 * 1048576;
*/

let file;
let uploadForm = function() {
    let upload, timerID;
    let nodes = function() {
        this.form = this.fileButton = this.progressBar = this.uploadButton = this.pauseButton =
        this.resumeButton = this.cancelButton = this.sizeIndicator = this.speedIndicator = this.timeIndicator = null;
    };
    done = function() {
        button.enable('file').disable(['pause', 'resume', 'cancel']);
        timer.stop();
        indicators.update();
    };
    fail = function() {
        button.enable('file').disable(['upload', 'pause', 'resume', 'cancel']);
        timer.stop();
        indicators.update();
        alert.show('Помилка! ' + upload.getError());
    };
    start = function() {
        button.enable(['pause', 'cancel']).disable('upload');
        timer.start();
        upload.start();
    };
    pause = function() {
        button.enable('resume').disable('pause');
        upload.pause();
    };
    resume = function() {
        button.enable(['file', 'pause']).disable('resume');
        upload.resume();
    };
    stop = function() {
        reset();
        timer.stop();
        indicators.update();
        button.enable('file').disable(['upload', 'pause', 'resume', 'cancel']);
        indicators.clear();
        upload.stop();
    };
    button = function() {
        this.enable = function(title) {
            return title;
        };
        this.disable = function(title) {
            return title;
        };
    };
    indicators = function() {
        this.size = function(value) {nodes.sizeIndicator.text('('+Human.size(value)+')');};
        this.update = function() {
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
        };
        this.clear = function() {
            nodes.sizeIndicator.text(null);
            nodes.speedIndicator.text(null);
            nodes.timeIndicator.text(null);
            nodes.progressBar.css('width', 0).text(null);
        };
    };
    timer = function() {
        this.start = function() {timerID = setInterval(indicators.update, 1000);};
        this.stop = function() {clearInterval(timerID);};
    };
    alert = function() {
        this.show = function(message) {nodes.alert.text(message).show();};
        this.hide = function() {nodes.alert.hide();};
    };
    reset = function() {nodes.form[0].reset();};
};
console.log(uploadForm.Prototype);
uploadForm.prototype.nodes = function() {
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
uploadForm.prototype.nodes.form.show();

uploadForm.prototype.nodes.fileButton.change(function() {
    file = $(this)[0].files[0];
    if (file === undefined) return false;
    if (file.size > parent.limit) {
        alert.show('Розмір файлу більше допустимого');
        return;
    }
    reset();
    button.enable('upload');
    indicators.size(file.size);
    upload = new Upload(file, {timeout: 3000, retry: {interval: 3000, limit: 5}});
    upload.addListener('done', function() {
        uploadForm.done();
    });
    upload.addListener('fail', function() {
        uploadForm.fail();
    });
});

uploadForm.prototype.nodes.uploadButton.click(function() {start()});
uploadForm.prototype.nodes.pauseButton.click(function() {pause()});
uploadForm.prototype.nodes.resumeButton.click(function() {resume()});
uploadForm.prototype.nodes.cancelButton.click(function() {stop()});


