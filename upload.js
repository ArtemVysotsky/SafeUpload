/**
 * Клас для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */

class Upload {
    #file; // об'єкт файла форми (Files[0])
    #url = '/api.php?action='; // адреса API для завантаження файла
    #hash; // тичасовий хеш файлу на час завантаження
    #length = 1024; // початкова довжина фрагмента файла, байти (chunk size)
    #offset = 0; // зміщення курсора читання файла
    #size = 0; // розмір завантаженої фрагмента файла
    #iteration = 1; // порядковий номер циклу завантаження фрагмента файла
    #time; // час початку завантаження
    #speed = 0; // швидкість завантаження останнього фрагмента файла
    #isPause = false; // ознака призупинки процесу завантаження файла
    #isStop = false; // ознака зупинки процесу завантаження файла
    #timeout = 30; // максимальний дозволений час тривалості запитсу, секунди
    #retry = { // дані повторного запиту (номер циклу, дозволена кількість,
        iteration: 0, // поточний номер ітерації повторного запиту
        limit: 5, // максимальна дозволена кількість повторних запитів
        interval: 5}; // тривалість паузи між повторними запитами
    #callbacks = { // функції зворотнього виклику
        done: function(){return true;}, // функція що виконується в разі успішного завантаження
        fail: function(){return true;}}; // функція що виконується в разі невдалого завантаження
    #error; // текст помилки (при наявності)


    constructor(file, options = null, callbacks = null) {
        this.#setError();
        this.#file = file;
        if (options !== null) {
            if (options.timeout !== undefined)
                this.#timeout = options.timeout;
            if (options.retry !== undefined) {
                if (options.retry.limit !== undefined)
                    this.#retry.limit = options.retry.limit;
                if (options.retry.interval !== undefined)
                    this.#retry.interval = options.retry.interval;
            }
        }
        if (callbacks !== null) this.#callbacks = callbacks;
    }
    #setError = (error) => {
        this.#error = error;
        this.#callbacks.fail();
    };
    getError() {return this.#error;}
/*
    #getSize() {return properties.size;}
    getStatus() {
        let status = {};
        status.chunk = properties.length;
        status.speed = properties.speed;
        status.time = new Date().getTime() / 1000;
        status.timeElapsed = Math.round(status.time - properties.time);
        if (properties.speed > 0) {
            status.timeEstimate = file.size / (properties.size / status.timeElapsed);
            status.timeEstimate = Math.round(status.timeEstimate - status.timeElapsed);
        } else {
            status.timeEstimate = 0;
        }
        return status;
    }
    start() {methods.open();}
    pause() {properties.pause = true;}
    resume() {
        properties.pause = false;
        methods.append();
    }
    stop() {
        if (properties.pause !== false) {
            methods.remove();
        } else {
            properties.stop = true;
        }
    }
    #open() {
        methods.request('open', {}, {
            'done': function(responce){
                properties.hash = responce.hash;
                properties.time = new Date().getTime() / 1000;
                methods.append();
            },
            'fail': function() {
                if (properties.retry.count > properties.retry.limit) {
                    parent.setError('При створенні файлу на сервері виникла помилка');
                    return;
                }
                properties.retry.count ++;
                methods.open();
            }
        });
    }
    #append() {
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
                if (jqXHR.status === 500) {
                    if (jqXHR.responseJSON.exception !== undefined) {
                        parent.setError(jqXHR.responseJSON.exception);
                    } else {
                        parent.setError('При завантажені файлу на сервер виникла невідома помилка');
                    }
                    return;
                }
                methods.reappend();
            }
        });
    }
    #reappend() {
        properties.retry.count ++;
        if (properties.retry.count > properties.retry.limit) {
            parent.setError('При завантажені файлу на сервер виникла помилка');
            methods.remove();
            return;
        }
        if (properties.debug)
            console.log('upload.reappend: ' + properties.retry.count);
            setTimeout(function() {
                methods.request('size', null, {
                    'done': function(responce) {
                        properties.offset = responce.size;
                        properties.retry.count = 0;
                        methods.append();
                    },
                    'fail': function() {
                        methods.reappend();
                    }
                })
            }, properties.retry.interval);
    }
    #close() {
        methods.request('close', {time: file.lastModified}, {
            'done': function(responce){
                if (responce.size !== file.size)
                    parent.setError('Неправельний розмір завантаженого файлу');
                properties.speed = (new Date().getTime() / 1000) - properties.time;
                properties.speed = Math.round(properties.size / properties.speed);
                if (!!callbacks.done) callbacks.done();
            },
            'fail': function() {
                if (properties.retry.count > properties.retry.limit) {
                    methods.remove();
                    parent.setError('При переміщенні файла на сервері виникла помилка');
                    return;
                }
                properties.retry.count ++;
                methods.close();
            }
        });
    }
    #remove() {
        methods.request('remove', null, {
            'fail': function() {
                if (properties.retry.count > properties.retry.limit) {
                    parent.setError('При видаленні файлу з сервера виникла помилка');
                    return;
                }
                properties.retry.count ++;
                methods.remove();
            }
        });
    }
    #request(action, data, callbacks) {
        let params = {
            method: 'POST', url:properties.url + action, data: {},
            text: 'text', dataType: 'json', cache: false, timeout: properties.timeout};
        if (!!data) params.data = data;
        params.data.name = file.name;
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
        console.log(params);
        let xhr = $.ajax(params)
        .done(function(responce) {
            console.log(responce);
            properties.retry.count = 0;
            if (!!callbacks && !!callbacks.done) callbacks.done(responce);
        })
        .fail(function(jqXHR) {
            console.log('request.fail');
            console.log(jqXHR);
            properties.retry.count ++;
            console.log(properties.retry);
            if ((jqXHR.readyState === 0) || ['502', '503', '504'].includes(status)) {
                if (properties.retry.count <= properties.retry.limit) {
                    methods.request(action, data, callbacks);
                    return false;
                }
                parent.setError('Неможливо виконати запит "' + action + '" (' + jqXHR.statusText + ')');
            } else {
                if ((status === 500) && !!jqXHR.exception) {
                    parent.setError(jqXHR.exception);
                } else {
                    parent.setError(jqXHR.responseText);
                }
            }
            //if (!!callbacks && !!callbacks.fail) callbacks.fail(jqXHR);
        });
    }
*/
}
