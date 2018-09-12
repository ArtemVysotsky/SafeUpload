/**
 * Клас для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     PHPUtils/Upload
 * @link        http://upload.loc
 * @copyright   Всі права застережено (c) 2018 Upload
 */

function Upload(file) {
    const parent = this;
    let properties = {
        file: file, hash: null, length: 1024, offset: 0, size: 0, iteration: 1,
        time: null, speed: 0, pause: false, stop: false, retry: 10, error: null, debug: null};
    let callbacks = {
        start: null, pause: null, resume: null, stop: null,
        iteration: null, finish: null, success: null, error: null};
    let methods = {};
    this.setError = function(error) {
        properties.error = error;
        if (!!callbacks.error) callbacks.error();
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
            'success': function(responce){
                properties.hash = responce.hash;
                properties.time = new Date().getTime() / 1000;
                methods.append();
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
            'success': function(responce){
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
            'error': function(){
                methods.remove();
                return false;
            }
        });
    };
    methods.close = function() {
        methods.request('close', {time: file.lastModified}, {
            'success': function(responce){
                if (responce.size !== file.size)
                    parent.setError('Неправельний розмір завантаженого файлу');
                properties.speed = (new Date().getTime() / 1000) - properties.time;
                properties.speed = Math.round(properties.size / properties.speed);
                if (!!callbacks.success) callbacks.success();
                if (!!callbacks.finish) callbacks.finish();
            }
        });
    };
    methods.remove = function() {
        methods.request('remove');
    };
    methods.request = function(action, data, callbacks) {
        let retry = {count: 0, limit: properties.retry};
        let params = {
            method: 'POST', url:'/api.php?action=' + action,
            text: 'text', dataType: 'json', cache: false, timeout: 10000};
        params.data = (data !== undefined) ? data : {};
        params.data.name = properties.file.name;
        if (!!properties.hash) params.data.hash = properties.hash;
        if (params.data.chunk !== undefined) {
            let formData = new FormData();
            formData.append('name', params.data.name);
            formData.append('hash', params.data.hash);
            formData.append('chunk', params.data.chunk, params.data.name);
            params.data = formData;
            params.processData = false;
            params.contentType = false;
        }
        $.ajax(params)
        .done(function(responce) {
            if (responce.length === 0) {
                if (!!callbacks && !!callbacks.error) callbacks.error(responce);
                parent.setError('Відсутня відповідь');
                return false;
            }
            if (typeof responce !== 'object') {
                if (!!callbacks && !!callbacks.error) callbacks.error(responce);
                parent.setError('Відповідь неправильного типу (' + typeof responce + ')');
                return false;
            }
            if (responce.exception !== undefined) {
                if (!!callbacks && !!callbacks.error) callbacks.error(responce);
                parent.setError(responce.exception);
                return false;
            }
            if (!!callbacks && !!callbacks.success) callbacks.success(responce);
        })
        .fail(function(jqXHR, statusText) {
            properties.debug = jqXHR.responseText;
            if(statusText === 'timeout') {
                retry.count ++;
                if (retry.count <= retry.limit) {
                    $.ajax(this);
                    return true;
                } else {
                    parent.setError('При завантажені файлу на сервер виникла помилка');
                    if (!!parentcallbacks.error) parentcallbacks.error(jqXHR);
                    return false;
                }
            } else {
                parent.setError('При завантажені файлу на сервер виникла помилка');
                if (!!parent.callbacks.error) parent.callbacks.error(jqXHR);
                return false;
            }
        });
    }
}
