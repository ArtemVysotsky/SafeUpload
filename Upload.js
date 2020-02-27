/**
 * Клас для роботи з завантаженням файлу
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

/** @typedef {object} jqXHR **/
/** @typedef {object} jqXHR.responseJSON **/

/** ToDo: Перевірити роботу відновлення завантаження */
/** ToDo: Відрефакторити код */

class Upload {
    #options = {
        url: 'api.php', // адреса API для завантаження файлу
        chunkSize: {
            minimum: 1024,  // мінімальний розмір фрагмента файлу, байти
            maximum: 20 * 1024 * 1024 // максимальний розмір фрагмента файлу, байти
        },
        fileSizeLimit: 1024 * 1024 * 1024, // максимальний розмір файлу, байти
        interval: 3, // максимальний рекомендований час тривалості запиту, секунди
        retry: {
            limit: 3, // максимальна кількість повторних запитів
            interval: 1 // тривалість паузи між повторними запитами, секунди
        }
    };
    #file; // об'єкт файлу
    #hash; // тимчасовий хеш файлу
    #chunk = {
        number: 0, // порядковий номер фрагмента файлу
        offset: 0, // зміщення від початку файлу, байти
        size: {
            base: 0, // розмір бази фрагмента файлу, байти
            value: 0, // поточний розмір фрагмента файлу, байти
            coefficient: 1 // коефіцієнт для визначення поточного розміру фрагмента файлу (1|2)
        },
        value: null, // вміст фрагмента файлу
        speed: 0 // швидкість виконання запиту, байти/с
    };
    #request = {
        action: null,  // тип запиту
        data: null  // дані запиту
    };
    #timers = {
        start: null, // час початку завантаження, секунди
        pause: null, // час призупинки завантаження, секунди
        stop: null, // час зупинки завантаження, секунди
        request: null, // час перед початком виконання запиту, мілісекунди
        status: null // час попереднього запиту індикаторів процесу завантаження файлу, секунди
    };
    #callbacks = {
        iteration: () => {}, // дій після виконання кожного запита на сервер
        pause: () => {}, // дії при призупинені процесу завантаження файлу
        timeout: () => {}, // дії при відсутності відповіді від сервера
        resolve: () => {}, // дій при завершені процесу завантаження файлу
        reject: () => {} // // дії при винекненні помилки під час процесу
    };

    constructor(file, callbacks = {}) {
        if (file.size > this.#options.fileSizeLimit)
            throw new Error('Розмір файлу більше дозволеного');
        this.#file = file;
        this.#callbacks = {...callbacks};
    }

    async start() {
        this.#timers.start = this.#getTime();
        await this.#open();
    }

    pause() {this.#timers.pause = this.#getTime()}

    async resume() {
        this.#timers.start =
            this.#getTime() - (this.#timers.pause - this.#timers.start);
        this.#timers.pause = null;
        switch (this.#request.action) {
            case 'open': this.#open(); break;
            case 'append': this.#append(); break;
            case 'close': this.#close(); break;
        }
    }

    async cancel() {
        if (!this.#timers.pause) {
            await this.#remove();
        } else {
            this.#timers.stop = this.#getTime();
        }
    }

    #open = async () => {
        this.#request.action = 'open';
        this.#chunk.size.base = this.#options.chunkSize.minimum;
        const response = await this.#send();
        this.#hash = response.hash;
        this.#append();
    };

    #append = async () => {
        this.#request.action = 'append';
        if (this.#timers.pause) {
            this.#callbacks.pause();
            this.#chunk.speed = 0;
            return;
        }
        if (this.#timers.stop) {this.#remove();return;}
        this.#chunk.number ++;
        this.#chunk.size.value =
            this.#chunk.size.base * this.#chunk.size.coefficient;
        this.#chunk.value =
            this.#file.slice(this.#chunk.offset, this.#chunk.offset + this.#chunk.size.value);
        this.#request.data = new FormData();
        this.#request.data.append('hash', this.#hash);
        this.#request.data.append('offset', this.#chunk.offset);
        this.#request.data.append('chunk', this.#chunk.value, this.#file.name);
        this.#timers.request = (new Date).getTime();
        const response = await this.#send();
        if (response === undefined) return;
        this.#chunk.offset = response.size;
        this.#sizing();
        if (this.#chunk.offset < this.#file.size) {
            this.#append();
        } else {
            this.#close();
        }
    };

    #close = async () => {
        this.#request.action = 'close';
        this.#request.data = new FormData();
        this.#request.data.append('time', this.#file.lastModified);
        this.#request.data.append('hash', this.#hash);
        const response = await this.#send();
        if (response === undefined) return;
        if (response.size !== this.#file.size)
            throw new Error('Неправельний розмір завантаженого файлу');
        this.#chunk.speed = Math.round(this.#file.size / (this.#getTime() - this.#timers.start));
        this.#chunk.size.value = Math.round(this.#file.size / this.#chunk.number);
        await this.#callbacks.resolve();
    };

    #remove = async () => {
        this.#request.action = 'remove';
        this.#request.data = (new FormData()).append('hash', this.#hash);
        await this.#send();
    };

    #send = async (retry = 1) => {
        let response = {};
        const url = this.#options.url + '?action=' + this.#request.action + '&name=' + this.#file.name;
        try {
            response = await fetch(url, {method: 'POST', body: this.#request.data});
        } catch (e) {
            if (retry > this.#options.retry.limit) {
                this.pause();
                this.#callbacks.timeout();
                return;
            }
            console.warn('Повторний запит #' + retry + ' / ' + human.time(this.#getTime()));
            setTimeout(
                () => {this.#send(retry ++)},
                this.#options.retry.interval * 1000
            );
            return;
        }
        this.#request.data = null;
        this.#callbacks.iteration(this.#getStatus());
        let responseJSON;
        try {
            responseJSON = await response.json();
            if (response.ok) {
                return responseJSON;
            } else {
                let message = (response.status === 500)
                    ? ((responseJSON.error !== undefined) ? responseJSON.error : response.statusText)
                    : 'Під час виконання запиту "' + this.#request.action + '" виникла помилка';
                this.#callbacks.reject(Error(message));
            }
        } catch (e) {
            throw new Error('Неправильний формат відповіді сервера');
        }
    };

    #getTime = () => {
        return Math.round(
            ((new Date()).getTime() / 1000) - ((new Date()).getTimezoneOffset() * 60)
        );
    };

    #getStatus = () => {
        let status = {chunk: this.#chunk.size.value, speed: this.#chunk.speed, time: {}};
        status.time.elapsed = Math.round(this.#getTime() - this.#timers.start);
        if (this.#chunk.speed > 0) {
            status.time.estimate =
                this.#file.size / (this.#chunk.offset / status.time.elapsed);
            status.time.estimate =
                Math.round(status.time.estimate - status.time.elapsed);
        } else {
            status.time.estimate = 0;
        }
        status.size = {
            bytes: this.#chunk.offset,
            percent: Math.round(this.#chunk.offset * 100 / this.#file.size)
        };
        return status;
    };

    #sizing = () => {
        let interval = ((new Date).getTime() - this.#timers.request) / 1000;
        let speed = Math.round(this.#chunk.size.value / interval);
        if (this.#chunk.size.coefficient === 2) {
            if ((interval < this.#options.interval) && (speed > this.#chunk.speed)) {
                if ((this.#chunk.size.base * 2) < this.#options.chunkSize.maximum)
                    this.#chunk.size.base *= 2;
            } else {
                if ((this.#chunk.size.base / 2) > this.#options.chunkSize.minimum)
                    this.#chunk.size.base /= 2;
            }
        }
        this.#chunk.speed = speed;
        this.#chunk.size.coefficient = 3 - this.#chunk.size.coefficient;
    };
}
