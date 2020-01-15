/**
 * Клас для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

/** ToDo: Дозавантаження частково завантажених файлів через паузу */
/** ToDo: Виправити автоматичне визначення оптимального розміру фрагменту файла */

/** @typedef {object} jqXHR **/
/** @typedef {object} jqXHR.responseJSON **/

class Upload {
    #url = '/api.php?action='; // адреса API для завантаження файла
    #options = {
        file: {size: {limit: 1024 * 1024 * 1024}}, // максимальний розмір файла, байти
        chunk: {
            size: {
                minimum: 1024, // мінімальний розмір частини файла, байти
                step: 1024, // крок розміру частини файла, байти
                maximum: 1048576 // максимальний розмір частини файла, байти
            }
        },
        timeout: 3, // максимальний дозволений час тривалості запиту, секунди
        retry: { //
            limit: 3, // максимальна кількість повторних запитів
            interval: 3 // тривалість паузи між повторними запитами, секунди
        }
    };
    #file = {
        name: null, // назва файла
        size: null, // розмір файла, байти
        hash: null, // хеш файлу
        lastModified: null, // дата файла
    };
    #chunk = { // поточна частина файла
        number: 0, // порядковий номер фрагмента файла
        offset: 0, // зміщення від початку файла, байти
        size: 1024 // розмір частини файла, байти
    };
    #time = { // часові мітки
        start: 0, // час початку завантаження, секунди
        pause: 0, // час призупинки завантаження, секунди
        stop: 0, // час зупинки завантаження, секунди
        status: 0 // час попереднього запиту індикаторів процеса завантаження файла, секунди
    };
    #speed = 0; // швидкість завантаження останнього фрагмента файла, біти
    #retry = 0; // порядковий номер поточного повторного запиту
    #error; // текст помилки (при наявності)
    #callbacks = {
        start: () => {},  pause: () => {}, resume: () => {}, stop: () => {},
        done: () => {}, fail: () => {}, always: () => {}
    };

    constructor(file, callbacks = {}) {
        this.#file = file;
        this.#callbacks = callbacks;
        if (this.#file.size > this.#options.file.size.maximum)
            this.#setError('Розмір файлу більше допустимого');
    }

    getTime() {return Math.round(new Date().getTime() / 1000);}

    getSize() {return this.#chunk.offset;}

    getStatus() {
        let status = {chunk: this.#chunk.size, speed: this.#speed, time: {}};
        status.time.elapsed = Math.round(this.getTime() - this.#time.start);
        if (this.#speed > 0) {
            status.time.estimate = this.#file.size / (this.#chunk.offset / status.time.elapsed);
            status.time.estimate = Math.round(status.time.estimate - status.time.elapsed);
        } else {
            status.time.estimate = 0;
        }
        return status;
    }

    #setError = (error) => {
        this.#error = error;
        this.#callbacks.fail();
        this.#callbacks.always();
    };

    getError() {return this.#error;}

    start() {
        this.#request('open', {}, (response) => {
            this.#file.hash = response.hash;
            this.#time.start = this.getTime();
            this.#append(this.#callbacks.start);
        });
    }

    pause() {this.#time.pause = this.getTime()}

    resume() {
        this.#time.start = this.getTime() - (this.#time.pause - this.#time.start);
        this.#time.pause = 0;
        this.#append(this.#callbacks.resume);
    }

    stop() {
        if (this.#time.pause > 0) {
            this.#remove();
        } else {
            this.#time.stop = this.getTime();
        }
    }

    #append = (callback = () => {}) => {
        if (this.#time.pause > 0) {
            this.#speed = 0;
            this.#callbacks.pause();
            return;
        }
        if (this.#time.stop > 0) {
            this.#remove();
            return;
        }
        let chunk = this.#file.slice(this.#chunk.offset, this.#chunk.offset + this.#chunk.size);
        let timestamp = (new Date()).getTime();
        this.#request('append', {chunk: chunk}, (response) => {
            let interval = ((new Date()).getTime() - timestamp) / 1000;
            let speed = Math.round((response.size - this.#chunk.offset) / interval);

            if (speed > this.#speed) {
                if (this.#chunk.size < this.#options.chunk.size.maximum)
                    this.#chunk.size += this.#options.chunk.size.step;
            } else {
                if (this.#chunk.size > this.#options.chunk.size.minimum)
                    this.#chunk.size -= this.#options.chunk.size.step;
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
        this.#request('close', {time: this.#file.lastModified}, (response) => {
            if (response.size !== this.#file.size)
                this.#setError('Неправельний розмір завантаженого файлу');
            this.#speed = this.getTime() - this.#time.start;
            this.#speed = Math.round(this.#chunk.offset / this.#speed);
            this.#callbacks.done();
            this.#callbacks.always();
        });
    };

    #remove = () => {
        this.#request('remove', {}, this.#callbacks.stop);
    };

    #request = (action, data = {}, callback = () => {}) => {
        let params = {
            method: 'POST', url: this.#url + action, data: {...data},
            text: 'text', dataType: 'json', cache: false, timeout: this.#options.timeout * 1000};
        params.data.name = this.#file.name;
        params.data.hash = this.#file.hash;
        if (this.#file.hash !== undefined) params.data.hash = this.#file.hash;
        if (params.data.chunk !== undefined) {
            let formData = new FormData();
            formData.append('name', params.data.name);
            formData.append('hash', params.data.hash);
            formData.append('chunk', params.data.chunk, params.data.name);
            params.data = formData;
            params.processData = false;
            params.contentType = false;
        }
        $.ajax(params).done((response) => {
            this.#retry = 0;
            if (response.exception !== undefined) {
                this.#setError(jqXHR.exception);
            } else {
                callback(response);
            }
        }).fail((jqXHR) => {
            if (jqXHR.readyState === 4) {
                this.#setError('Під час виконання запиту "' + action + '" виникла помилка');
                if ((jqXHR.status === 500)
                    && (jqXHR.responseJSON !== undefined)
                    && (jqXHR.responseJSON.exception !== undefined))
                    console.error(jqXHR.statusText + ': ' + jqXHR.responseJSON.exception);
                return;
            }
            this.#retry ++;
            if (this.#retry > this.#options.retry.limit) {
                if (action !== 'open') this.#callbacks.timeout();
                alert('Сервер не відповідає, спробуйте пізніше');
                return;
            }
            console.warn('Повторний запит #' + this.#retry + ' / ' + Human.time(this.getTime()));
            setTimeout(
                () => {this.#request(action, data, (jqXHR) => {callback(jqXHR)})},
                this.#options.retry.interval * 1000);
        });
    }
}
