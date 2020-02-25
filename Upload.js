/**
 * Клас для роботи з завантаженням файлу
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

/** @typedef {object} jqXHR **/
/** @typedef {object} jqXHR.responseJSON **/

/** ToDo: Вдосконалити алгоритм визначення оптимального розміру фрагмента (за 1 секунду) */
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
        interval: 1, // максимальний рекомендований час тривалості запиту, секунди
        retry: {
            limit: 3, // максимальна кількість повторних запитів
            interval: 1 // тривалість паузи між повторними запитами, секунди
        }
    };
    #action; // тип запиту
    #file; // об'єкт файлу
    #hash; // тимчасовий хеш файлу
    #chunk = {
        number: 0, // порядковий номер фрагмента файлу
        offset: 0, // зміщення від початку файлу, байти
        size: {
            base: 0, // розмір бази фрагмента файлу, байти
            value: 0, // поточний розмір фрагмента файлу, байти
            multiplier: 1 // коефіцієнт для визначення поточного розміру фрагмента файлу (1|2)
        },
        speed: 0 // швидкість виконання запиту, байти/с
    };
    #timers = {
        start: 0, // час початку завантаження, секунди
        pause: 0, // час призупинки завантаження, секунди
        stop: 0, // час зупинки завантаження, секунди
        status: 0 // час попереднього запиту індикаторів процесу завантаження файлу, секунди
    };
    #callbacks = {
        iteration: () => {}, // дій після виконання кожного запита на сервер
        pause: () => {}, // дії при призупинені процесу завантаження файлу
        resolve: () => {}, // дій при завершені процесу завантаження файлу
        reject: () => {} // дії при відсутності відповіді від сервера
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
        this.#timers.pause = 0;
        switch (this.#action) {
            case 'open': this.#open(); break;
            case 'append': this.#append(); break;
            case 'close': this.#close(); break;
        }
    }

    async cancel() {
        if (this.#timers.pause > 0) {
            await this.#remove();
        } else {
            this.#timers.stop = this.#getTime();
        }
    }

    #open = async () => {
        this.#action = 'open';
        this.#chunk.size.base = this.#options.chunkSize.minimum;
        const response = await this.#request();
        this.#hash = response.hash;
        this.#append();
    };

    #append = async () => {
        this.#action = 'append';
        if (this.#timers.pause > 0) {
            this.#callbacks.pause();
            this.#chunk.speed = 0;
            return;
        }
        if (this.#timers.stop > 0) {this.#remove();return;}
        this.#chunk.number ++;
        this.#chunk.size.value =
            this.#chunk.size.base * this.#chunk.size.multiplier;
        let chunk =
            this.#file.slice(this.#chunk.offset, this.#chunk.offset + this.#chunk.size.value);
        let data = new FormData();
        data.append('hash', this.#hash);
        data.append('offset', this.#chunk.offset);
        data.append('chunk', chunk, this.#file.name);
        let timestamp = (new Date).getTime();
        const response = await this.#request(data);
        if (response === undefined) return;
        this.#chunk.offset = response.size;
        this.#sizing(timestamp);
        if (this.#chunk.offset < this.#file.size) {
            this.#append();
        } else {
            this.#close();
        }
    };

    #close = async () => {
        this.#action = 'close';
        let data = new FormData();
        data.append('time', this.#file.lastModified);
        data.append('hash', this.#hash);
        const response = await this.#request(data);
        if (response === undefined) return;
        if (response.size !== this.#file.size)
            throw new Error('Неправельний розмір завантаженого файлу');
        this.#chunk.speed = Math.round(this.#file.size / (this.#getTime() - this.#timers.start));
        this.#chunk.size.value = Math.round(this.#file.size / this.#chunk.number);
        await this.#callbacks.resolve();
    };

    #remove = async () => {
        this.#action = 'remove';
        let data = new FormData();
        data.append('hash', this.#hash);
        await this.#request(data);
    };

    #request = async (data, retry = 1) => {
        let response = {};
        const url = this.#options.url + '?action=' + this.#action + '&name=' + this.#file.name;
        try {
            response = await fetch(url, {method: 'POST', body: data});
        } catch (e) {
            if (retry > this.#options.retry.limit) {
                this.pause();
                this.#callbacks.reject(this.#action);
                return;
            }
            console.warn('Повторний запит #' + retry + ' / ' + human.time(this.#getTime()));
            setTimeout(
                () => {this.#request(data, retry ++)},
                this.#options.retry.interval * 1000
            );
        }
        this.#callbacks.iteration(this.#getStatus());
        const responseJSON = await response.json();
        if (response.ok) {
            return responseJSON;
        } else {
            const message = ((response.status === 500) && (responseJSON.exception !== undefined))
                ? response.statusText + ': ' + responseJSON.exception
                : 'Під час виконання запиту "' + this.#action + '" виникла помилка';
            throw new Error(message);
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

    #sizing = (timestamp) => {
        let interval = ((new Date).getTime() - timestamp) / 1000;
        let speed = Math.round(this.#chunk.size.value / interval);
console.log(this.#chunk.number, this.#chunk.size, human.size(speed)+'/с', interval);
        if (this.#chunk.size.multiplier === 2) {
            if ((interval < this.#options.interval) && (speed > this.#chunk.speed)) {
                if ((this.#chunk.size.base * 2) < this.#options.chunkSize.maximum)
                    this.#chunk.size.base *= 2;
            } else {
                if ((this.#chunk.size.base / 2) > this.#options.chunkSize.minimum)
                    this.#chunk.size.base /= 2;
            }
        }
        this.#chunk.speed = speed;
        this.#chunk.size.multiplier = 3 - this.#chunk.size.multiplier;
    };
}
