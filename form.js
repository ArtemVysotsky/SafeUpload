/**
 * Скрипт для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */

let uploadForm = new function() {
    let self = this;
    this.upload = {};
    this.limit = (100 * 1048576);

    this.chooseEvent = function(file) {
        if (file === undefined) return false;
        if (file.size > this.limit) {
            this.alert.show('Розмір файлу більше допустимого');
            return;
        }
        this.reset();
        this.button.enable('upload');
        this.indicators.size(file.size);
        this.upload = new Upload(file, {timeout: 3000, retry: {interval: 3000, limit: 5}});
        this.upload.addListener('done', function() {self.doneEvent();});
        this.upload.addListener('fail', this.failEvent);
        console.log(this.upload);
    };
    this.startEvent = function() {
        this.button.enable(['pause', 'cancel']).disable('upload');
        this.timer.start();
        this.upload.start();
    };
    this.pauseEvent = function() {
        this.button.enable('resume').disable('pause');
        this.upload.pause();
    };
    this.resumeEvent = function() {
        this.button.enable(['file', 'pause']).disable('resume');
        this.upload.resume();
    };
    this.stopEvent = function() {
        this.reset();
        this.timer.stop();
        this.indicators.update();
        this.button.enable('file').disable(['upload', 'pause', 'resume', 'cancel']);
        this.indicators.clear();
        this.upload.stop();
    };
    this.doneEvent = function() {
        this.button.enable('file').disable(['pause', 'resume', 'cancel']);
        this.timer.stop();
        this.indicators.update();
    };
    this.failEvent = function() {
        this.button.enable('file').disable(['upload', 'pause', 'resume', 'cancel']);
        this.timer.stop();
        this.indicators.update();
        this.alert.show('Помилка! ' + this.upload.getError());
    };
    this.button = function() {
        this.enable = function(title) {
            return title;
        };
        this.disable = function(title) {
            return title;
        }
    };
    this.indicators = function() {
        this.size = function(value) {self.nodes.sizeIndicator.text('('+Human.size(value)+')');};
        this.update = function() {
            let indicators = self.upload.getIndicators();
            self.nodes.progressBar
                .css('width', indicators.percent + '%')
                .text(Human.size(indicators.size) + ' (' + indicators.percent + '%)');
            self.nodes.speedIndicator.text(
                Human.size(indicators.speed) + '/c' + ' (' + Human.size(indicators.chunk) + ')'
            );
            self.nodes.timeIndicator.text(
                Human.time(indicators.timeElapsed) + ' / ' + Human.time(indicators.timeEstimate)
            );
        };
        this.clear = function() {
            self.nodes.sizeIndicator.text(null);
            self.nodes.speedIndicator.text(null);
            self.nodes.timeIndicator.text(null);
            self.nodes.progressBar.css('width', 0).text(null);
        }
    };
    this.timer = function() {
        this.start = function() {self.timerID = setInterval(self.indicators.update, 1000);};
        this.stop = function() {clearInterval(self.timerID);};
    };
    this.alert = new function() {
        this.show = function(message) {self.nodes.alert.text(message).show();};
        this.hide = function() {self.nodes.alert.hide();};
    };
    this.reset = function() {this.nodes.form[0].reset();}
};

