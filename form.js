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
    };
    this.startEvent = function() {
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
    this.button = function() {
        this.enable = function(title) {
            return title;
        };
        this.disable = function(title) {
            return title;
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

