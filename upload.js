/**
 * Клас для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */
'use strict';
/**
 * @typedef {object} jqXHR
 * @property {object} responseJSON
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
    #pause; // зберігає функцію, яка виконується після призупинки процесу завантаження файла
    #stop; // зберігає функції, які використовуються при зупинці процесу завантаження файла
    #timeout = 30; // максимальний дозволений час тривалості запитсу, секунди
    #retry = { // дані повторного запиту (номер циклу, дозволена кількість,
        iteration: 0, // поточний номер ітерації повторного запиту
        limit: 5, // максимальна дозволена кількість повторних запитів
        interval: 5}; // тривалість паузи між повторними запитами, секунди
    #error; // текст помилки (при наявності)
    #callbacks = {}; // функції зворотнього виклику, які виконуються в залежності від результату



    constructor(file, options = null) {
        //this.#setError();
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
    }
    getSize() {return this.#size;}
    getStatus() {
        let status = {};
        status.chunk = this.#length;
        status.speed = this.#speed;
        status.time = {};
        status.time.elapsed = Math.round((new Date().getTime() / 1000) - this.#time);
        if (this.#speed > 0) {
            status.time.estimate = this.#file.size / (this.#size / this.#time.elapsed);
            status.time.estimate = Math.round(status.time.estimate - status.time.elapsed);
        } else {
            status.time.estimate = 0;
        }
        return status;
    }
    #setError = (error) => {
        this.#error = error;
        if (this.#callbacks.error !== undefined) this.#callbacks.error();
    };
    getError() {return this.#error;}
    start(callbacks = {}) {this.#open(callbacks);}
    pause(callback = {}) {this.#pause = callback;}
    resume(callbacks = {}) {
        this.#pause = null;
        this.#append(callbacks);
    }
    stop(callbacks = {}) {
        if (this.#pause !== null) {
            this.#remove(callbacks);
        } else {
            this.#stop = callbacks;
        }
    }

    #open = (callbacks = {}) => {
        this.#request('open', {}, {
            done: (response) => {
                this.#hash = response.hash;
                this.#time = new Date().getTime() / 1000;
                this.#append(callbacks);
                if (callbacks.done !== undefined) callbacks.done();
            },
            fail: () => {
                if (callbacks.fail !== undefined) callbacks.fail();
            },
            always: () => {
                if (callbacks.always !== undefined) callbacks.always();
            }
        });
    };

    #append = (callbacks = {}) => {
        if (this.#pause !== null) {
            this.#speed = 0;
            if (this.#pause !== undefined) this.#pause();
            return;
        }
        if (this.#stop !== null) {
            this.#remove(this.#stop);
            return;
        }
        let timestamp = new Date().getTime();
        let end = this.#offset + this.#length;
        let chunk = this.#file.slice(this.#offset, end);
        this.#request('append', {chunk: chunk}, {
            done: (response) => {
                let interval = (new Date().getTime() - timestamp) / 1000;
                let speed = Math.round((response.size - this.#size) / interval);
                if (speed > this.#speed) {
                    if (this.#length < 104576) this.#length += 1024;
                } else {
                    if (this.#length > 1024) this.#length -= 1024;
                }
                this.#speed = speed;
                this.#size = response.size;
                if (this.#size < this.#file.size) {
                    this.#offset = end;
                    this.#append();
                } else {
                    this.#close();
                }
                this.#iteration ++;
                if (callbacks.done !== undefined) callbacks.done();
            },
            fail: () => {
                if (callbacks.fail !== undefined) callbacks.fail();
            },
            always: () => {
                if (callbacks.always !== undefined) callbacks.always();
            }
        });
    };
/*
    #reAppend = () => {
        this.#retry.iteration ++;
        if (this.#retry.iteration > this.#retry.limit) {
            this.#setError('При завантажені файлу на сервер виникла помилка');
            this.#remove();
            return;
        }
        setTimeout(() => {
            this.#request('size', null, {
                'done': (responce) => {
                    this.#offset = responce.size;
                    this.#retry.iteration = 0;
                    this.#append();
                },
                'fail': () => {
                    this.#reAppend();
                }
            })
        }, this.#retry.interval * 1000);
    };
*/
    #close = (callbacks = {}) => {
        this.#request('close', {time: this.#file.lastModified}, {
            done: (response) => {
                if (response.size !== this.#file.size)
                    this.#setError('Неправельний розмір завантаженого файлу');
                this.#speed = (new Date().getTime() / 1000) - this.#time;
                this.#speed = Math.round(this.#size / this.#speed);
                if (callbacks.done !== undefined) callbacks.done();
                if (this.#callbacks.done !== undefined) this.#callbacks.done();
            },
            fail: () => {
                if (callbacks.fail !== undefined) callbacks.fail();
            },
            always: () => {
                if (callbacks.always !== undefined) callbacks.always();
                if (this.#callbacks.always !== undefined) this.#callbacks.always();
            }
        });
    };

    #remove = (callbacks = {}) => {
        this.#request('remove', null, callbacks);
    };

    #request = (action, data = {}, callbacks = {}) => {
        let params = {
            method: 'POST', url:this.#url + action, data: {},
            text: 'text', dataType: 'json', cache: false, timeout: this.#timeout * 1000};
        params.data = data;
        params.data.name = this.#file.name;
        if (this.#hash !== null) params.data.hash = this.#hash;
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
        .done((response) => {
            //console.log(response);
            this.#retry.iteration = 0;
            if (response.exception !== undefined) {
                this.#setError(jqXHR.exception);
            } else {
                if (callbacks.done !== undefined) callbacks.done(response);
            }
        })
        .fail((jqXHR) => {
            if (jqXHR.readyState === 4) {
                this.#setError('Неможливо виконати запит "' + action + '" (' + jqXHR.statusText + ')');
                //this.#setError(jqXHR.responseText);
                if (callbacks.fail !== undefined) callbacks.fail(jqXHR);
                return;
            }
            this.#retry.iteration ++;
            if (this.#retry.iteration > this.#retry.limit) {
                let error = 'При завантажені файлу на сервер виникла помилка';
                this.#remove({
                    done: () => {this.#setError(error + ' (файл видалено)')},
                    fail: () => {this.#setError(error + ' (не можу видалити файл)')},
                    always: () => {if (callbacks.fail !== undefined) callbacks.fail(jqXHR)}
                });
                return;
            }
            setTimeout(() => {
                this.#request('size', null, {
                    'done': (response) => {
                        if (callbacks.done !== undefined) callbacks.done(response);
                    },
                    'fail': (jqXHR) => {
                        if (callbacks.fail !== undefined) callbacks.fail(jqXHR);
                    },
                    'always': (response) => {
                        if (callbacks.always !== undefined) callbacks.always(response);
                    }
                })
            }, this.#retry.interval * 1000);
        });
    }

}
