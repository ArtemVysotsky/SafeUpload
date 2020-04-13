/**
 * Клас для роботи з завантаженням файлу
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/SafeUpload
 * @copyright   GNU General Public License v3
 */

/** ToDo: перевірити роботу відновлення завантаження */
/** ToDo: перевірити видалення файлу при помилці */
/** ToDo: перевірити роботу помилок */
/** ToDo: відрефакторити код */

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
        url: 'api',
        chunkSizeMinimum: 1024,
        chunkSizeMaximum: 1024 ** 2,
        fileSizeLimit: 1024 ** 2,
        interval: 1,
        timeout: 5,
        retryLimit: 5,
        retryDelay: 1
    };

    /**
     * @property {object} #fileList                - Перелік FileList з файлами File та додатковими параметрами
     * @property {object} #fileList.files          - Перелік FileList
     * @property {number} #fileList.size           - Дані про розмір всіх файлів, байти
     * @property {number} #fileList.size.uploaded  - Загальний розмір всіх файлів, байти
     * @property {number} #fileList.size.total     - Загальний розмір всіх файлів, байти
     * @property {number} #fileList.current        - Номер поточного файлу
     */
    #fileList = {files: {}, size: {uploaded: 0, total: 0}, current: 0};

    /**
     * @property {object} #file                 - Файл File зі вмістимим та додатковими параметрами
     * @property {string} #file.name            - Назва файлу
     * @property {string} #file.type            - Тип файлу
     * @property {number} #file.size            - Розмір файлу, байти
     * @property {string} #file.hash            - Хеш файлу
     * @property {number} #file.lastModified    - Дата останньої зміни файлу, мілісекунди
     */
    #file = {name: '', type: '', size: 0, hash: '', lastModified: 0};

    /**
     * @property {number}   #chunk.number           - Порядковий номер фрагмента файлу
     * @property {number}   #chunk.offset           - Зміщення від початку файлу, байти
     * @property {number}   #chunk.size.base        - Розмір бази фрагмента файлу, байти
     * @property {number}   #chunk.size.value       - Плановий розмір фрагмента файлу, байти
     * @property {number}   #chunk.size.coefficient - Коефіцієнт розміру фрагмента файлу (1|2)
     * @property {File}     #chunk.value            - Вміст фрагмента файлу (File)
     * @property {number}   #chunk.size             - Фактичний розмір фрагмента файлу, байти
     * @property {string}   #chunk.type             - Тип фрагмента файлуґ
     */
    #chunk = {number: 0, offset: 0, size: {base: 0, value: 0, coefficient: 1}, value: {size: 0, type: ''}};

    /**
     * @property {object}   #request        - Запит до сервера
     * @property {string}   #request.action - Тип запиту
     * @property {object}   #request.data   - Дані запиту
     * @property {number}   #request.time   - Час виконання запиту, мс
     * @property {number}   #request.speed  - Швидкість виконання запиту, Б/с
     * @property {boolean}  #request.retry  - Ознака виконання повторних запитів
     */
    #request = {action: '', data: {}, time: 0, speed: 0, retry: true};

    /**
     * @property {object} #events           - Ознаки деяких дій
     * @property {boolean} #events.pause    - Ознака призупинки завантаження
     * @property {boolean} #events.stop     - Ознака зупинки завантаження
     */
    #events = {pause: false, stop: false};

    /**
     * @property {object} #callbacks                - Зворотні функції
     * @property {function} #callbacks.pause        - Дії при призупинені процесу завантаження файлу
     * @property {function} #callbacks.iteration    - Дії при виконанні кожного запита на сервер
     * @property {function} #callbacks.timeout      - Дії при відсутності відповіді від сервера
     * @property {function} #callbacks.resolve      - Дії при завершені процесу завантаження файлу
     * @property {function} #callbacks.reject       - Дії при винекненні помилки під час процесу
     */
    #callbacks = {
        pause: () => {}, iteration: () => {}, timeout: () => {}, resolve: () => {}, reject: () => {}
    };

    /**
     * Конструктор
     * @param {object} files - Перелік FileList з файлами File
     * @param {object} [callbacks] - Зворотні функції
     * @param {object} [settings] - Налаштування
     */
    constructor(files, settings = {}, callbacks = {}) {
        this.#fileList.files = files;
        for(let i = 0; i < this.#fileList.files.length; i ++)
            this.#fileList.size.total += this.#fileList.files[i].size;
        console.debug({files: this.#fileList});
        this.#settings = {...this.#settings, ...settings};
        console.debug({settings: this.#settings});
        this.#callbacks = {...this.#callbacks, ...callbacks};
        this.#file = this.#fileList.files[0];
        this.#callbacks.iteration(this.#getStatus());
    }

    /**
     * Починає процес завантаження файлу на сервер
     */
    async start() {
        return await this.#open();
    }

    /**
     * Призупиняє процес завантаження файлу на сервер
     */
    pause() {
        this.#events.pause = true;
    }

    /**
     * Продовжує процес завантаження файлу на сервер
     */
    async resume() {
        let response = true;
        this.#events.pause = null;
        switch (this.#request.action) {
            case 'open': response = await this.#open(); break;
            case 'append': response = await this.#append(); break;
            case 'close': await this.#close(); break;
        }
        return response;
    }

    /**
     * Скасовує процес завантаження файлу на сервер
     */
    async cancel() {
        if (this.#events.pause) {
            this.#remove();
        } else {
            this.#events.stop = true;
        }
    }

    /**
     * Відкриває файл для запису на сервері
     * @see this.#request
     */
    #open = async () => {
        if (this.#file.size > this.#settings.fileSizeLimit)
            this.#error('Розмір файлу більше дозволеного');
        this.#request.action = 'open';
        this.#chunk.size.base = this.#settings.chunkSizeMinimum;
        const response = await this.#send();
        if (response === undefined) return false;
        this.#file.hash = response.hash;
        this.#append();
        return true;
    };

    /**
     * Додає фрагмент файлу на сервер
     * @see this.#request
     */
    #append = async () => {
        if (this.#events.pause) {
            this.#callbacks.pause();
            this.#request.speed = 0;
            return true;
        }
        if (this.#events.stop) {
            await this.#remove();
            return true;
        }
        this.#request.action = 'append';
        this.#chunk.number ++;
        this.#chunk.size.value =
            this.#chunk.size.base * this.#chunk.size.coefficient;
        this.#chunk.value =
            this.#file.slice(this.#chunk.offset, this.#chunk.offset + this.#chunk.size.value);
        this.#request.data = new FormData();
        this.#request.data.append('hash', this.#file.hash);
        this.#request.data.append('offset', this.#chunk.offset);
        this.#request.data.append('chunk', this.#chunk.value, this.#file.name);
        const response = await this.#send();
        if (response === undefined) return false;
        let speed = Math.round(this.#chunk.value.size / this.#request.time);
        this.#chunk.offset = response.size;
        this.#fileList.size.uploaded += this.#chunk.value.size;
        if (this.#chunk.size.coefficient === 2) {
            if ((this.#request.time < this.#settings.interval) && (speed > this.#request.speed)) {
                if ((this.#chunk.size.base * 2) < this.#settings.chunkSizeMaximum)
                    this.#chunk.size.base *= 2;
            } else {
                if ((this.#chunk.size.base / 2) > this.#settings.chunkSizeMinimum)
                    this.#chunk.size.base /= 2;
            }
        }
        this.#request.speed = speed;
        this.#chunk.size.coefficient = 3 - this.#chunk.size.coefficient;
        if (this.#chunk.offset < this.#file.size) {
            this.#append();
        } else {
            this.#close();
        }
        return true;
    };

    /**
     * Закриває файл на сервері
     * @see this.#request
     */
    #close = async () => {
        this.#request.action = 'close';
        this.#request.data = new FormData();
        this.#request.data.append('time', this.#file.lastModified);
        this.#request.data.append('hash', this.#file.hash);
        const response = await this.#send();
        if (response === undefined) return;
        if (response.size !== this.#file.size)
            this.#error('Неправильний розмір завантаженого файлу');
        console.debug(`Файл ${this.#file.name} завантажено`);
        this.#fileList.current ++;
        if (this.#fileList.current < this.#fileList.files.length) {
            this.#file = this.#fileList.files[this.#fileList.current];
            this.#open();
        } else {
            this.#callbacks.resolve();
        }
    };

    /**
     * Видаляє файл на сервері
     * @see this.#request
     */
    #remove = async () => {
        this.#request.action = 'remove';
        this.#request.data = new FormData();
        this.#request.data.append('hash', this.#file.hash);
        this.#request.retry = false;
        await this.#send();
    };

    /**
     * Готує запит до сервера та витягує дані з відповіді
     * @returns {object|void} - Відформатована відповідь сервера
     * @see this.#request
     */
    #send = async () => {
        let url = this.#settings.url + '?action=' + this.#request.action + '&name=' + this.#file.name;
        let body = {method: 'POST', body: this.#request.data};
        let retry = (this.#request.retry) ? 1 : 0;
        this.#request.time = (new Date()).getTime();
        let response = await this.#fetchExtended(url, body, retry);
        this.#request.time = ((new Date()).getTime() - this.#request.time) / 1000;
        this.#request.data = null;
        if (!response) return;
        this.#callbacks.iteration(this.#getStatus());
        let responseJSON;
        try {
            responseJSON = await response.json();
        } catch (e) {
            console.error(response);
            this.#error('Неправильний формат відповіді сервера');
        }
        if (responseJSON.error) {
            console.error(responseJSON.error);
            this.#error('Внутрішня помилка сервера');
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
        if (this.#events.stop) return;
        if (retry <= this.#settings.retryLimit) {
            console.warn('Повторний запит #' + retry);
            await new Promise(resolve => {
                setTimeout(resolve, this.#settings.retryDelay * 1000)
            });
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
     * @property    {number} chunk.number           - Номер фрагмента файлу
     * @property    {number} chunk.size             - Розмір фрагмента файлу
     * @property    {number} chunk.speed            - Швидкість завантаження фрагмента файлу, байти/секунду
     * @property    {number} current.number         - Номер поточного файлу
     * @property    {number} current.name           - Назва поточного файлу
     * @property    {number} current.size.uploaded  - Розмір завантаженої частини поточного файлу, байти
     * @property    {number} current.size.total     - Загальний розмір поточного файлу, байти
     * @property    {number} total.numbers          - Загальна кількість файлів
     * @property    {number} total.size.uploaded    - Розмір завантаженої частини всіх файлів, байти
     * @property    {number} total.size.total       - Загальний розмір всіх файлів, байти
     */
    #getStatus = () => {
        return {
            chunk: {
                number: this.#chunk.number,
                size: this.#chunk.value.size,
                time: this.#request.time,
                speed: this.#request.speed
            },
            current: {
                number:  this.#fileList.current + 1,
                name: this.#file.name,
                size: {
                    uploaded: this.#chunk.offset,
                    total: this.#file.size
                }
            },
            total: {
                number: this.#fileList.files.length,
                size: this.#fileList.size
            }
        }
    };

    /**
     * Викидає помилку
     * @param {string} message - Текст помилки
     */
    #error = (message) => {
        this.#callbacks.reject(message);
        this.#callbacks.finally();
        throw new Error(message);
    };
}
