/**
 * Клас для роботи з завантаженням файлу
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/SafeUpload
 * @copyright   GNU General Public License v3
 */

/** ToDo: Перевірити роботу відновлення завантаження */
/** ToDo: Перевірити роботу помилок */
/** ToDo: Відрефакторити код */

class SafeUpload {
    /**
     * @property {object}   #settings                    - Налаштування класу
     * @property {string}   #settings.url                - Адреса API для завантаження файлу
     * @property {object}   #settings.chunkSize          - Налаштування розміру фрагмента файлу
     * @property {number}   #settings.chunkSizeMinimum   - Мінімальний розмір фрагмента файлу, байти
     * @property {number}   #settings.chunkSizeMaximum   - Максимальний розмір фрагмента файлу, байти
     * @property {number}   #settings.fileSizeLimit      - Максимальний розмір файлу, байти
     * @property {number}   #settings.interval           - Рекомендована тривалість запиту, секунди
     * @property {number}   #settings.timeout            - Максимальна тривалість запиту, секунди
     * @property {object}   #settings.retry              - Налаштування повторних запитів
     * @property {number}   #settings.retryLimit         - Максимальна кількість повторних запитів
     * @property {number}   #settings.retryDelay         - Тривалість паузи між повторними запитами, секунди
     */
    #settings = {
        url: 'api', chunkSizeMinimum: 1024, chunkSizeMaximum: 1024 * 1024, fileSizeLimit: 1024 * 1024,
        interval: 1, timeout: 5, retryLimit: 5, retryDelay: 1
    };

    /** @property {File} #file - Об'єкт файлу */
    #file;

    /** @property {string} #hash - Тимчасовий хеш файлу */
    #hash;

    /**
     * @property {object}   #chunk                  - Дані фрагмента файлу
     * @property {number}   #chunk.number           - Порядковий номер фрагмента файлу
     * @property {number}   #chunk.offset           - Зміщення від початку файлу, байти
     * @property {object}   #chunk.size             - Дані розміру фрагмента файлу, байти
     * @property {number}   #chunk.size.base        - Розмір бази фрагмента файлу, байти
     * @property {number}   #chunk.size.value       - Поточний розмір фрагмента файлу, байти
     * @property {number}   #chunk.size.coefficient - Коефіцієнт розміру фрагмента файлу (1|2)
     * @property {File}     #chunk.value            - Вміст фрагмента файлу (File)
     * @property {number}   #chunk.speed            - Швидкість виконання запиту, байти/с
     */
    #chunk = {number: 0, offset: 0, size: {base: 0, value: 0, coefficient: 1}, value: null, speed: 0};

    /**
     * @property {object}   #request        - Запит до сервера
     * @property {string}   #request.action - Тип запиту
     * @property {object}   #request.data   - Дані запиту
     * @property {boolean}  #request.retry  - Ознака виконання повторних запитів
     */
    #request = {action: null, data: null, retry: true};

    /**
     * @property {object} #timers           - Мітки часу
     * @property {number} #timers.start     - Час початку завантаження, секунди
     * @property {number} #timers.pause     - Час призупинки завантаження, секунди
     * @property {number} #timers.stop      - Час зупинки завантаження, секунди
     * @property {number} #timers.request   - Час перед початком виконання запиту, мілісекунди
     * @property {number} #timers.status    - Час попереднього запиту індикаторів процесу завантаження файлу, секунди
     */
    #timers = {start: null, pause: null, stop: null, request: null, status: null};

    /**
     * @property {object} #callbacks                - Зворотні функції
     * @property {function} #callbacks.iteration    - Дії при виконанні кожного запита на сервер
     * @property {function} #callbacks.pause        - Дії при призупинені процесу завантаження файлу
     * @property {function} #callbacks.timeout      - Дії при відсутності відповіді від сервера
     * @property {function} #callbacks.resolve      - Дії при завершені процесу завантаження файлу
     * @property {function} #callbacks.reject       - Дії при винекненні помилки під час процесу
     */
    #callbacks = {
        iteration: () => {}, pause: () => {}, timeout: () => {}, resolve: () => {}, reject: () => {}
    };

    /**
     * Конструктор
     * @param {File} file - Обє'ект з даними файлу
     * @param {object} callbacks - Зворотні функції
     * @param {object} settings - Налаштування
     */
    constructor(file, callbacks = {}, settings = {}) {
        this.#settings = {... this.#settings, ... settings};
        console.debug({settings: this.#settings});
        if (file.size > this.#settings.fileSizeLimit)
            throw new Error('Розмір файлу більше дозволеного');
        this.#file = file;
        this.#callbacks = {...callbacks};
    }

    /**
     * Починає процес завантаження файлу на сервер
     */
    async start() {
        this.#timers.start = this.#getTime();
        await this.#open();
    }

    /**
     * Призупиняє процес завантаження файлу на сервер
     */
    pause() {this.#timers.pause = this.#getTime()}

    /**
     * Продовжує процес завантаження файлу на сервер
     */
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

    /**
     * Скасовує процес завантаження файлу на сервер
     */
    async cancel() {
        if (this.#timers.pause) {
            await this.#remove();
        } else {
            this.#timers.stop = this.#getTime();
        }
    }

    /**
     * Відкриває файл для запису на сервері
     * @see this.#request
     */
    #open = async () => {
        this.#request.action = 'open';
        this.#chunk.size.base = this.#settings.chunkSizeMinimum;
        const response = await this.#send();
        if (response === undefined) return;
        this.#hash = response.hash;
        this.#append();
    };

    /**
     * Додає фрагмент файлу на сервер
     * @see this.#request
     */
    #append = async () => {
        if (this.#timers.pause) {
            this.#callbacks.pause();
            this.#chunk.speed = 0;
            return;
        }
        if (this.#timers.stop) {
            await this.#remove();
            return;
        }
        this.#request.action = 'append';
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
            await this.#append();
        } else {
            await this.#close();
        }
    };

    /**
     * Закриває файл на сервері
     * @throws {Error} - Неправельний розмір завантаженого файлу
     * @see this.#request
     */
    #close = async () => {
        this.#request.action = 'close';
        this.#request.data = new FormData();
        this.#request.data.append('time', this.#file.lastModified);
        this.#request.data.append('hash', this.#hash);
        this.#chunk.speed = Math.round(this.#file.size / (this.#getTime() - this.#timers.start));
        this.#chunk.size.value = Math.round(this.#file.size / this.#chunk.number);
        const response = await this.#send();
        if (response === undefined) return;
        if (response.size !== this.#file.size)
            throw new Error('Неправильний розмір завантаженого файлу');
        await this.#callbacks.resolve();
    };

    /**
     * Видаляє файл на сервері
     * @see this.#request
     */
    #remove = async () => {
        this.#request.action = 'remove';
        this.#request.data = new FormData();
        this.#request.data.append('hash', this.#hash);
        this.#request.retry = false;
        await this.#send();
    };

    /**
     * Готує запит до сервера та витягує дані з відповіді
     * @returns {object|void} - Відформатована відповідь сервера
     * @throws {Error} - Неправильний формат відповіді сервера
     * @see this.#request
     */
    #send = async () => {
        let url = this.#settings.url + '?action=' + this.#request.action + '&name=' + this.#file.name;
        let body = {method: 'POST', body: this.#request.data};
        let retry = (this.#request.retry) ? 1 : 0;
        let response = await this.#fetchExtended(url, body, retry);
        if (!response) return;
//        this.#request.data = null;
        this.#callbacks.iteration(this.#getStatus());
        let responseJSON;
        try {
            responseJSON = await response.json();
        } catch (e) {
            console.error(response);
            throw new Error('Неправильний формат відповіді сервера');
        }
        if (responseJSON.error) {
            console.error(responseJSON.error);
            this.#callbacks.reject(Error('Внутрішня помилка сервера'));
        }
        return responseJSON;
    };

    /**
     * Відправляє запит на сервер з таймаутом та повторними запитами при потребі
     * @param {string} url - Адреса запиту
     * @param {object} body - Дані запиту
     * @param {number} retry [retry=1] - Номер повторного запиту, 0 - без повторів
     * @returns {Response|void} - Відповідь сервера при наявності
     * @throws {Error} - Неправильний формат відповіді сервера
     */
    #fetchExtended = async (url, body, retry = 1) => {
        let response;
        try {
            const fetchPromise = fetch(url, body);
            const timeoutPromise = new Promise(resolve =>
                (setTimeout(resolve, this.#settings.timeout * 1000))
            );
            response = await Promise.race([fetchPromise, timeoutPromise]);
            if (response) {
                return response;
            } else {
                console.error(`Перевищено час виконання запиту (${this.#settings.timeout})`);
            }
        } catch (e) {
            console.error(`Під час виконання запиту виникла помилка (${e.message})`);
        }
        if (!retry) return;
        if (this.#timers.stop) return;
        if (retry <= this.#settings.retryLimit) {
            console.warn('Повторний запит #' + retry);
            await this.#wait(this.#settings.retryDelay);
            return this.#fetchExtended(url, body, ++retry);
        } else {
            this.pause();
            this.#callbacks.pause();
            this.#callbacks.timeout();
        }
    };

    /**
     * Вираховує та повертає дані про статус процесу завантаження файлу
     * @returns     {object}
     * @property    {object} size           - Дані про розмір файлу
     * @property    {number} size.bytes     - Розмір завантаженої частини файлу, байти
     * @property    {number} size.percent   - Розмір завантаженої частини файлу, відсотки
     * @property    {number} size.total     - Загальний розмір файлу, байти
     * @property    {number} speed          - Швидкість завантаження, байти/секунду
     * @property    {object} time           - Дані про час
     * @property    {number} time.elapsed   - Минуло часу з початку процесу завантаження, секунди
     * @property    {number} time.estimate  - Розрахунковий час закінчення процесу завантаження, секунди
     */
    #getStatus = () => {
        let status = {speed: this.#chunk.speed, time: {}, size: {}};
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
            percent: Math.round(this.#chunk.offset * 100 / this.#file.size),
            total: this.#file.size
        };
        return status;
    };

    /**
     * Визначає базовий розмір та коєфіцієнт для наступгого фрагмента файлу
     * @see this.#chunk
     */
    #sizing = () => {
        let interval = ((new Date).getTime() - this.#timers.request) / 1000;
        let speed = Math.round(this.#chunk.value.size / interval);
        console.debug(
            '#' + this.#chunk.number.toString(),
            this.#formatNumber((this.#chunk.size.base / 1024).toFixed()).padStart(8) + ' KБ',
            this.#formatNumber((this.#chunk.size.value / 1024).toFixed()).padStart(8) + ' KБ',
            this.#formatNumber((speed / 1024).toFixed()).padStart(8) + ' KБ/с',
            this.#formatNumber(interval.toFixed(3)).padStart(8) + ' c'
        );
        if (this.#chunk.size.coefficient === 2) {
            if ((interval < this.#settings.interval) && (speed > this.#chunk.speed)) {
                if ((this.#chunk.size.base * 2) < this.#settings.chunkSizeMaximum)
                    this.#chunk.size.base *= 2;
            } else {
                if ((this.#chunk.size.base / 2) > this.#settings.chunkSizeMinimum)
                    this.#chunk.size.base /= 2;
            }
        }
        this.#chunk.speed = speed;
        this.#chunk.size.coefficient = 3 - this.#chunk.size.coefficient;
    };

    /**
     * Додає до числа пробіли між тисячами
     * @param {number|string} value - Невідформатоване число
     * returns {string} - Відформатоване число
     */
    #formatNumber = (value) => {
        return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    };

    /**
     * Повертає мітку часу з врахуванням часової зони
     * returns {number} - Мітка часу, секунди
     */
    #getTime = () => {
        return Math.round(
            ((new Date()).getTime() / 1000) - ((new Date()).getTimezoneOffset() * 60)
        );
    };

    /**
     * Призупиняє виконання скрипта на вказаний час
     * @param {number} delay - Час затримки, секунди
     * returns {Promise}
     */
    #wait = async (delay) => {
        return new Promise(resolve => {setTimeout(resolve, delay * 1000)});
    };
}
