/**
 * Клас для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   Всі права застережено (c) 2020 Upload
 */

/** ToDo: Впорядкувати властивості класу для зручності */
/** ToDo: Виправити автоматичне визначення оптимального розміру фрагменту файла */

/** @typedef {object} jqXHR **/
/** @typedef {object} jqXHR.responseJSON **/

class Upload {
    #url; // адреса API для завантаження файла
    #file2 = { //
        data: null, // об'єкт файла форми (Files[0])
        hash: null, // тичасовий хеш файлу на час завантаження
        limit: 1024 * 1024 * 1024 // максимальний розмір файла (1ГБ)
    };
    #file; // об'єкт файла форми (Files[0])
    #hash; // тичасовий хеш файлу на час завантаження
    #limit = 1024 * 1024 * 1024; // максимальний розмір файла (1ГБ)
    #chunk = { //
        number: 0, //
        offset: 0, //
        length: {} //
    };
    #iteration = 1; // порядковий номер циклу завантаження фрагмента файла
    #length = { // довжина фрагмента файла, байти
        minimum: 1024, //
        current: 1024, //
        maximum: 1048576, //
        step: 1024 //
    };
    #offset = 0; // зміщення від початку файла
    #status = { //
        time: {}, //
        size: 0, //
        speed: { //
            preview: 0, //
            current:0, //
            next: 0, //
            iteration: 0, //
            iterations: 10 //
        }
    };
    #time = {start: null, pause: null, stop: null, status: null}; // зберігає час виклику дій над процесом завантаження файла
    #size = 0; // розмір завантаженої фрагмента файла
    #speed = 0; // швидкість завантаження останнього фрагмента файла
    #timeout = 30; // максимальний дозволений час тривалості запиту, секунди
    #retry = { // дані повторного запиту (номер циклу, дозволена кількість,
        iteration: 0, // поточний номер ітерації повторного запиту
        limit: 5, // максимальна дозволена кількість повторних запитів
        interval: 5 // тривалість паузи між повторними запитами, секунди
    };
    #error; // текст помилки (при наявності)
    #callbacks = {
        start: () => {},  pause: () => {}, resume: () => {}, stop: () => {},
        done: () => {}, fail: () => {}, always: () => {}
    };

    constructor(url, file, options = null, callbacks = {}) {
        this.#url = url + '?action=';
        this.#file = file;
        if (options !== null) {
            if (options.limit !== undefined) this.#limit = options.limit;
            if (options.timeout !== undefined) this.#timeout = options.timeout;
            if (options.retry !== undefined) {
                if (options.retry.limit !== undefined) this.#retry.limit = options.retry.limit;
                if (options.retry.interval !== undefined) this.#retry.interval = options.retry.interval;
            }
        }
        this.#callbacks = callbacks;
        if (this.#file.size > this.#limit) this.#setError('Розмір файлу більше допустимого');
    }

    getTime() {return Math.round(new Date().getTime() / 1000);}

    getSize() {return this.#size;}

    getStatus() {
        let status = {chunk: this.#length.current, speed: this.#speed, time: {}};
        status.time.elapsed = Math.round(this.getTime() - this.#time.start);
        if (this.#speed > 0) {
            status.time.estimate = this.#file.size / (this.#size / status.time.elapsed);
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
            this.#hash = response.hash;
            this.#time.start = this.getTime();
            this.#append(this.#callbacks.start);
        });
    }

    pause() {this.#time.pause = this.getTime()}

    resume() {
        this.#time.start = this.getTime() - (this.#time.pause - this.#time.start);
        this.#time.pause = null;
        this.#append(this.#callbacks.resume);
    }

    stop() {
        if (this.#time.pause !== null) {
            this.#remove();
        } else {
            this.#time.stop = this.getTime();
        }
    }

    #append = (callback = () => {}) => {
        if (this.#time.pause !== null) {
            this.#speed = 0;
            this.#callbacks.pause();
            return;
        }
        if (this.#time.stop !== null) {
            this.#remove();
            return;
        }
        let length = this.#length.current + this.#length.step;
        let end = this.#offset + length;
        let chunk = this.#file.slice(this.#offset, end);
        let timestamp = (new Date()).getTime();
        this.#request('append', {chunk: chunk}, (response) => {
            let interval = ((new Date()).getTime() - timestamp) / 1000;
            let speed = Math.round((response.size - this.#size) / interval);


            if (speed > this.#speed) {
                if (this.#length.current < this.#length.maximum) this.#length.current += 1024;
            } else {
                if (this.#length.current > this.#length.minimum) this.#length.current -= 1024;
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
            callback();
        });
    };

    #close = () => {
        this.#request('close', {time: this.#file.lastModified}, (response) => {
            if (response.size !== this.#file.size)
                this.#setError('Неправельний розмір завантаженого файлу');
            this.#speed = this.getTime() - this.#time.start;
            this.#speed = Math.round(this.#size / this.#speed);
            //callback();
            this.#callbacks.done();
            this.#callbacks.always();
        });
    };

    #remove = () => {
        this.#request('remove', {}, this.#callbacks.stop);
    };

    #request = (action, data = {}, callback = () => {}) => {
        let params = {
            method: 'POST', url:this.#url + action, data: {...data},
            text: 'text', dataType: 'json', cache: false, timeout: this.#timeout * 1000};
        params.data.name = this.#file.name;
        params.data.hash = this.#hash;
        if (this.#hash !== undefined) params.data.hash = this.#hash;
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
            this.#retry.iteration = 0;
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
            this.#retry.iteration ++;
            if (this.#retry.iteration > this.#retry.limit) {
                if (action !== 'open') this.#callbacks.timeout();
                alert('Сервер не відповідає, спробуйте пізніше');
                return;
            }
            console.warn('Повторний запит #' + this.#retry.iteration + ' / ' + Human.time(this.getTime()));
            setTimeout(
                () => {this.#request(action, data, (jqXHR) => {callback(jqXHR)})},
                this.#retry.interval * 1000);
        });
    }
}
