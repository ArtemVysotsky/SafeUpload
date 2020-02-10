/**
 * Клас для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

/** ToDo: Виправити автоматичне визначення оптимального розміру фрагменту файлу */

/** @typedef {object} jqXHR **/
/** @typedef {object} jqXHR.responseJSON **/

class Upload {
    #url = 'api.php?action='; // адреса API для завантаження файлу
    #options = {
        fileSizeLimit: 1024 * 1024 * 1024, // максимальний розмір файлу, байти
        chunkSize: {
            minimum: 1024, // мінімальний розмір частини файлу, байти
            step: 1024, // крок розміру частини файлу, байти
            maximum: 1048576 // максимальний розмір частини файлу, байти
        },
        timeout: 3, // максимальний дозволений час тривалості запиту, секунди
        retry: { //
            limit: 3, // максимальна кількість повторних запитів
            interval: 3 // тривалість паузи між повторними запитами, секунди
        }
    };
    #file = {
        name: null, // назва файлу
        size: null, // розмір файлу, байти
        hash: null, // хеш файлу
        lastModified: null, // дата файлу
    };
    #chunk = { // поточна частина файлу
        number: 0, // порядковий номер фрагмента файлу
        offset: 0, // зміщення від початку файлу, байти
        size: 1024 // розмір частини файлу, байти
    };
    #timers = { // часові мітки
        start: 0, // час початку завантаження, секунди
        pause: 0, // час призупинки завантаження, секунди
        stop: 0, // час зупинки завантаження, секунди
        status: 0 // час попереднього запиту індикаторів процеса завантаження файлу, секунди
    };
    #speed = 0; // швидкість завантаження останнього фрагмента файлу, біти
    #retry = 0; // порядковий номер поточного повторного запиту
    #action = null; // поточна дія для запиту до сервера
    #message = null; // текст повідомлення (при наявності)
    #callbacks = {done: () => {}, fail: () => {}, timeout: () => {}};

    constructor(file, callbacks = {}) {
        this.#file = file;
        this.#callbacks = callbacks;
        if (this.#file.size > this.#options.fileSizeLimit)
            this.#error('Розмір файлу більше допустимого');
    }

    get time() {
        return Math.round(((new Date()).getTime() / 1000) - ((new Date()).getTimezoneOffset() * 60));
    }

    get size() {return this.#chunk.offset;}

    get status() {
        let status = {chunk: this.#chunk.size, speed: this.#speed, time: {}};
        status.time.elapsed = Math.round(this.time - this.#timers.start);
        if (this.#speed > 0) {
            status.time.estimate = this.#file.size / (this.#chunk.offset / status.time.elapsed);
            status.time.estimate = Math.round(status.time.estimate - status.time.elapsed);
        } else {
            status.time.estimate = 0;
        }
        return status;
    }

    get message() {return this.#message;}

    #error = (message) => {
        console.error(message);
        this.#message = message;
        this.#callbacks.fail();
    };

    start() {
        this.#timers.start = this.time;
        this.#open();
    }

    pause() {this.#timers.pause = this.time}

    resume() {
        this.#timers.start = this.time - (this.#timers.pause - this.#timers.start);
        this.#timers.pause = 0;
        switch (this.#action) {
            case 'open': this.#open(); break;
            case 'append': this.#append(); break;
            case 'close': this.#close(); break;
        }
    }

    stop() {
        if (this.#timers.pause > 0) {
            this.#remove();
        } else {
            this.#timers.stop = this.time;
        }
    }

    #open = () => {
        this.#action = 'open';
        this.#request('open', {}, (response) => {
            this.#file.hash = response.hash;
            this.#append();
        });
    };

    #append = (callback = () => {}) => {
        this.#action = 'append';
        if (this.#timers.pause > 0) {
            this.#speed = 0;
            return;
        }
        if (this.#timers.stop > 0) {
            this.#remove();
            return;
        }
        let chunk = this.#file.slice(this.#chunk.offset, this.#chunk.offset + this.#chunk.size);
        let formData = new FormData();
        formData.append('name', this.#file.name);
        formData.append('hash', this.#file.hash);
        formData.append('offset', this.#chunk.offset);
        formData.append('chunk', chunk, this.#file.name);
        let timestamp = (new Date()).getTime();
        this.#request('append', formData, (response) => {
            let interval = ((new Date()).getTime() - timestamp) / 1000;
            let speed = Math.round((response.size - this.#chunk.offset) / interval);

            if (speed > this.#speed) {
                if (this.#chunk.size < this.#options.chunkSize.maximum)
                    this.#chunk.size += this.#options.chunkSize.step;
            } else {
                if (this.#chunk.size > this.#options.chunkSize.minimum)
                    this.#chunk.size -= this.#options.chunkSize.step;
            }

            this.#speed = speed;
            this.#chunk.offset = response.size;
            if (this.#chunk.offset < this.#file.size) {
                this.#append();
            } else {
                this.#close();
            }
            this.#chunk.number ++;
            callback();
        });
    };

    #close = () => {
        this.#action = 'close';
        this.#request('close', {time: this.#file.lastModified}, (response) => {
            if (response.size !== this.#file.size)
                this.#error('Неправельний розмір завантаженого файлу');
            this.#speed = this.time - this.#timers.start;
            this.#speed = Math.round(this.#chunk.offset / this.#speed);
            this.#callbacks.done();
        });
    };

    #remove = () => {this.#request('remove')};

    #request = (action, data = {}, callback = () => {}) => {
        let params = {
            method: 'POST', url: this.#url + action, data: data,
            text: 'text', dataType: 'json', cache: false, timeout: this.#options.timeout * 1000};
        if (params.data instanceof FormData) {
            params.processData = false;
            params.contentType = false;
        } else {
            params.data.name = this.#file.name;
            if (this.#file.hash !== undefined)
                params.data.hash = this.#file.hash;
        }
        $.ajax(params).done((response) => {
            this.#retry = 0;
            if (response.exception !== undefined) {
                this.#error(jqXHR.exception);
            } else {
                callback(response);
            }
        }).fail((jqXHR) => {
            if (jqXHR.readyState === 4) {
                this.#error('Під час виконання запиту "' + action + '" виникла помилка');
                if ((jqXHR.status === 500)
                    && (jqXHR.responseJSON !== undefined)
                    && (jqXHR.responseJSON.exception !== undefined))
                    console.error(jqXHR.statusText + ': ' + jqXHR.responseJSON.exception);
                return;
            }
            this.#retry ++;
            if (this.#retry > this.#options.retry.limit) {
                this.#callbacks.timeout(action);
                this.#retry = 0;
                this.pause();
                return;
            }
            console.warn('Повторний запит #' + this.#retry + ' / ' + human.time(this.time));
            setTimeout(
                () => {this.#request(action, data, callback)},
                this.#options.retry.interval * 1000);
        });
    }
}
