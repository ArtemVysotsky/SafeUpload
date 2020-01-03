/**
 * Клас для роботи з завантаженням файла
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */

/** @typedef {object} jqXHR **/
/** @typedef {object} jqXHR.responseJSON **/

class Upload {
    #file; // об'єкт файла форми (Files[0])
    #url; // адреса API для завантаження файла
    #hash; // тичасовий хеш файлу на час завантаження
    #length = 1024; // початкова довжина фрагмента файла, байти (chunk size)
    #offset = 0; // зміщення від початку файла
    #size = 0; // розмір завантаженої фрагмента файла
    #limit = 1024 * 1024 * 1024; // максимальний розмір файла (1ГБ)
    #iteration = 1; // порядковий номер циклу завантаження фрагмента файла
    #time = {start: null, pause: null}; // час початку та призупинення завантаження файла
    #speed = 0; // швидкість завантаження останнього фрагмента файла
    #pause = null; // зберігає функцію, яка виконується після призупинки процесу завантаження файла
    #stop = null; // зберігає функції, які використовуються при зупинці процесу завантаження файла
    #timeout = 30; // максимальний дозволений час тривалості запитсу, секунди
    #retry = { // дані повторного запиту (номер циклу, дозволена кількість,
        iteration: 0, // поточний номер ітерації повторного запиту
        limit: 5, // максимальна дозволена кількість повторних запитів
        interval: 5}; // тривалість паузи між повторними запитами, секунди
    #error; // текст помилки (при наявності)
    #callbacks = {
        done: () => {},  // дії при вдалому завантаження файлу
        fail: () => {},  // дії при невдалому завантажені файлу
        always: () => {}}; // дії при любій події

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
        let status = {chunk: this.#length, speed: this.#speed, time: {}};
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

    start(callback = () => {}) {
        this.#request('open', {}, (response) => {
            this.#hash = response.hash;
            this.#time.start = this.getTime();
            this.#append(callback);
            callback();
        });
    }

    pause(callback = () => {}) {
        this.#time.pause = this.getTime();
        this.#pause = callback;
    }

    resume(callback = () => {}) {
        this.#time.start = this.getTime() - (this.#time.pause - this.#time.start);
        this.#pause = null;
        this.#append(callback);
    }

    stop(callback = () => {}) {
        if (this.#pause !== null) {
            this.#remove(callback);
        } else {
            this.#stop = callback;
        }
    }

    #append = (callback = () => {}) => {
        if (this.#pause !== null) {
            this.#speed = 0;
            this.#pause();
            return;
        }
        if (this.#stop !== null) {
            this.#remove(this.#stop);
            return;
        }
        let timestamp = new Date().getTime();
        let end = this.#offset + this.#length;
        let chunk = this.#file.slice(this.#offset, end);
        this.#request('append', {chunk: chunk}, (response) => {
            let interval = this.getTime() - (timestamp / 1000);
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
            callback();
        });
    };

    #close = (callback = () => {}) => {
        this.#request('close', {time: this.#file.lastModified}, (response) => {
            if (response.size !== this.#file.size)
                this.#setError('Неправельний розмір завантаженого файлу');
            this.#speed = this.getTime() - this.#time.start;
            this.#speed = Math.round(this.#size / this.#speed);
            callback();
            this.#callbacks.done();
            this.#callbacks.always();
        });
    };

    #remove = (callback = () => {}) => {
        this.#request('remove', {}, callback);
    };

    #request = (action, data = {}, callback = () => {}) => {
        let params = {
            method: 'POST', url:this.#url + action, data: {...data},
            text: 'text', dataType: 'json', cache: false, timeout: this.#timeout * 1000};
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
