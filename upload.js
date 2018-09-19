/**
 * Клас для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     PHPUtils/Upload
 * @link        http://upload.loc
 * @copyright   Всі права застережено (c) 2018 Upload
 */

function Upload(file) {
    let parent = this;
    let properties = {
        file: file, hash: null, length: 1024, offset: 0, size: 0, iteration: 1,
        time: null, speed: 0, pause: false, stop: false, error: null, debug: null,
        retry: {count: 0, limit: 10, timeout: 5000}
    };
    let callbacks = {
        start: null, pause: null, resume: null, stop: null,
        iteration: null, finish: null, done: null, fail: null};
    let methods = {};
    this.setError = function(error) {
        properties.error = error;
        if (!!callbacks.fail) callbacks.fail();
        if (!!callbacks.finish) callbacks.finish();
    };
    this.getError = function() {return properties.error;};
    this.getIndicators = function() {
        let indicators = {};
        indicators.sizeUploaded = properties.size;
        indicators.percent = Math.round(properties.size * 100 / file.size);
        indicators.speed = properties.speed;
        indicators.time = new Date().getTime() / 1000;
        indicators.timeElapsed = Math.round(indicators.time - properties.time);
        if (properties.speed > 0) {
        indicators.timeEstimate = file.size / (properties.size / indicators.timeElapsed);
        indicators.timeEstimate = Math.round(indicators.timeEstimate - indicators.timeElapsed);
        } else {
            indicators.timeEstimate = 0;
        }
        return indicators;
    };
    this.getDebug = function() {return properties.debug;};
    this.addListener = function(handler, callback) {
        if (typeof callbacks[handler] === undefined) {
            this.setError('Невідомий метод зворотнього виклику ' + handler);
            return false;
        }
        callbacks[handler] = callback;
    };
    this.start = function() {
        methods.open();
        if (!!callbacks.start) callbacks.start();
    };
    this.pause = function() {
        properties.pause = true;
        if (!!callbacks.pause) callbacks.pause();
    };
    this.resume = function() {
        properties.pause = false;
        methods.append();
        if (!!callbacks.resume) callbacks.resume();
    };
    this.stop = function() {
        if (properties.pause !== false) {
            methods.remove();
        } else {
            properties.stop = true;
        }
        if (!!callbacks.stop) callbacks.stop();
    };
    methods.open = function() {
        methods.request('open', {}, {
            'done': function(responce){
                properties.hash = responce.hash;
                properties.time = new Date().getTime() / 1000;
                methods.append();
            },
            'fail': function(jqXHR) {
                if (properties.retry.count > properties.retry.limit) {
                    parent.setError('При створенні файлу на сервері виникла помилка');
                    return;
                }
                properties.retry.count ++;
                methods.open();
            }
        });
    };
    methods.append = function(){
        if (properties.pause !== false) {
            properties.speed = 0;
            return;
        }
        if (properties.stop !== false) {
            methods.remove();
            return;
        }
        let timestamp = new Date().getTime();
        let end = properties.offset + properties.length;
        let chunk = file.slice(properties.offset, end);
        methods.request('append', {chunk: chunk}, {
            'done': function(responce) {
                let speed = (new Date().getTime() - timestamp) / 1000;
                speed = Math.round((responce.size - properties.size) / speed);
                if (speed > properties.speed) {
                    if (properties.length < 104576) properties.length += 1024;
                } else {
                    if (properties.length > 1024) properties.length -= 1024;
                }
                properties.speed = speed;
                properties.size = responce.size;
                if (properties.size < file.size) {
                    properties.offset = end;
                    methods.append();
                } else {
                    methods.close();
                }
                properties.iteration ++;
                if (!!callbacks.iteration) callbacks.iteration();
            },
            'fail': function(jqXHR) {
                properties.speed = 0;
                methods.reappend();
            }
        });
    };
    methods.reappend = function() {
        properties.retry.count ++;
        if (properties.retry.count > properties.retry.limit) {
            parent.setError('При завантажені файлу на сервер виникла помилка');
            methods.remove();
            return;
        }
        console.log('upload.reappend: ' + properties.retry.count);
        setTimeout(function() {
            methods.request('size', null, {
                'done': function(responce) {
                    console.log('upload.reappend.done: ' + responce.size);
                    properties.offset = responce.size;
                    properties.retry.count = 0;
                    methods.append();
                },
                'fail': function(jqXHR) {
                    methods.reappend();
                }
            })
        }, properties.retry.timeout);
    };
    methods.close = function() {
        methods.request('close', {time: file.lastModified}, {
            'done': function(responce){
                if (responce.size !== file.size)
                    parent.setError('Неправельний розмір завантаженого файлу');
                properties.speed = (new Date().getTime() / 1000) - properties.time;
                properties.speed = Math.round(properties.size / properties.speed);
                if (!!callbacks.done) callbacks.done();
                if (!!callbacks.finish) callbacks.finish();
            },
            'fail': function(jqXHR) {
                if (properties.retry.count > properties.retry.limit) {
                    methods.remove();
                    parent.setError('При переміщенні файла на сервері виникла помилка');
                    return;
                }
                properties.retry.count ++;
                methods.close();
            }
        });
    };
    methods.remove = function() {
        methods.request('remove', null, {
            'done': function(responce) {
                return true;
            },
            'fail': function(jqXHR) {
                if (properties.retry.count > properties.retry.limit) {
                    parent.setError('При видаленні файлу з сервера виникла помилка');
                    return;
                }
                properties.retry.count ++;
                methods.remove();
            }
        });
    };
    methods.request = function(action, data, callbacks) {
        let params = {
            method: 'POST', url:'/api.php?action=' + action, data: {},
            text: 'text', dataType: 'json', cache: false, timeout: 10000};
        let debug = {iteration: properties.iteration, action: action};
        if (!!data && (data !== undefined)) params.data = data;
        params.data.name = properties.file.name;
        if (!!properties.hash) params.data.hash = properties.hash;
        if (params.data.chunk !== undefined) {
            debug.size = params.data.chunk.size;
            debug.offset = properties.offset;
            let formData = new FormData();
            formData.append('name', params.data.name);
            formData.append('hash', params.data.hash);
            formData.append('chunk', params.data.chunk, params.data.name);
            params.data = formData;
            params.processData = false;
            params.contentType = false;
        }
        console.log(debug);
        $.ajax(params)
        .done(function(responce) {
            if (responce.length === 0) {
                if (!!callbacks && !!callbacks.fail) callbacks.fail(responce);
                parent.setError('Відсутня відповідь');
                return false;
            }
            if (typeof responce !== 'object') {
                if (!!callbacks && !!callbacks.fail) callbacks.fail(responce);
                parent.setError('Відповідь неправильного типу (' + typeof responce + ')');
                return false;
            }
            if (responce.exception !== undefined) {
                if (!!callbacks && !!callbacks.fail) callbacks.fail(responce);
                parent.setError(responce.exception);
                return false;
            }
            if (!!callbacks && !!callbacks.done) callbacks.done(responce);
        })
        .fail(function(jqXHR, textStatus, errorThrown) {
            if (!!callbacks && !!callbacks.fail) callbacks.fail(jqXHR);
        });
    }
}
