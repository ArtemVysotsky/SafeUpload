/**
 * Клас для роботи з завантаженням файлу
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/SafeUpload
 * @copyright   GNU General Public License v3
 */

class Upload {
    /**
     * @property {object}   #settings                    - Налаштування за замовчуванням
     * @property {string}   #settings.api                - Адреса API для завантаження файлу
     * @property {number}   #settings.chunkSizeMinimum   - Мінімальний розмір частини файлу, байти
     * @property {number}   #settings.chunkSizeMaximum   - Максимальний розмір частини файлу, байти
     * @property {number}   #settings.fileSizeLimit      - Максимальний розмір файлу, байти
     * @property {number}   #settings.interval           - Рекомендована тривалість запиту, секунди
     * @property {number}   #settings.timeout            - Максимальна тривалість запиту, секунди
     * @property {number}   #settings.retryLimit         - Максимальна кількість повторних запитів
     * @property {number}   #settings.retryDelay         - Тривалість паузи між повторними запитами, секунди
     */
    #settings = {
        api: 'api',
        chunkSizeMinimum: 1024,
        chunkSizeMaximum: 1024 ** 2,
        fileSizeLimit: 1024 ** 2,
        interval: 1,
        timeout: 5,
        retryLimit: 5,
        retryDelay: 1
    }

    /**
     * @property {object} #fileList                - Перелік FileList з файлами File та додатковими параметрами
     * @property {object} #fileList.files          - Перелік FileList
     * @property {object} #fileList.size           - Дані про розмір всіх файлів
     * @property {number} #fileList.size.uploaded  - Розмір завантажених частин файлів, байти
     * @property {number} #fileList.size.total     - Загальний розмір всіх файлів, байти
     * @property {number} #fileList.current        - Номер поточного файлу
     */
    #fileList = {files: {}, size: {uploaded: 0, total: 0}, current: 0}

    /**
     * @property {object} #file                 - Файл File зі вмістимим та додатковими параметрами
     * @property {string} #file.name            - Назва файлу
     * @property {string} #file.type            - Тип файлу
     * @property {number} #file.size            - Розмір файлу, байти
     * @property {string} #file.uuid            - UUID файлу
     * @property {number} #file.lastModified    - Дата останньої зміни файлу, мілісекунди
     */
    #file = {name: '', type: '', size: 0, uuid: '', lastModified: 0}

    /**
     * @property {object}   #chunk                  - Параметри частини файлу
     * @property {number}   #chunk.number           - Порядковий номер частини файлу
     * @property {number}   #chunk.offset           - Зміщення від початку файлу, байти
     * @property {object}   #chunk.size             - Дані розміру частини файлу, байти
     * @property {number}   #chunk.size.base        - Розмір бази частини файлу, байти
     * @property {number}   #chunk.size.value       - Запланований розмір частини файлу, байти
     * @property {number}   #chunk.size.coefficient - Коефіцієнт розміру частини файлу (1|2)
     * @property {object}   #chunk.value            - Вміст частини файлу
     * @property {number}   #chunk.value.size       - Реальний розмір частини файлу, байти
     * @property {string}   #chunk.value.type       - Тип частини файлу
     */
    #chunk = {number: 0, offset: 0, size: {base: 0, value: 0, coefficient: 1}, value: {size: 0, type: ''}}

    /**
     * @property {object}   #request        - Запит до сервера
     * @property {string}   #request.action - Тип запиту
     * @property {object}   #request.data   - Дані запиту
     * @property {number}   #request.time   - Час виконання запиту, мс
     * @property {number}   #request.speed  - Швидкість виконання запиту, Б/с
     * @property {boolean}  #request.retry  - Ознака виконання повторних запитів
     */
    #request = {action: '', data: {}, time: 0, speed: 0, retry: true}

    /**
     * @property {object}   #events         - Ознаки деяких дій
     * @property {boolean}  #events.pause   - Ознака призупинки завантаження
     * @property {boolean}  #events.stop    - Ознака зупинки завантаження
     */
    #events = {pause: false, stop: false}

    /**
     * @property {object} #timers           - Збережені часові мітки
     * @property {number} #timers.start     - Часова мітка початку завантаження, секунди
     * @property {number} #timers.pause     - Часова мітка призупинення завантаження, секунди
     */
    #timers = {start: 0, pause: 0}

    /**
     * @property {object}   #callbacks              - Функції зворотного виклику
     * @property {function} #callbacks.pause        - Дії при призупинені процесу завантаження файлу
     * @property {function} #callbacks.iteration    - Дії при виконанні кожного запита на сервер
     * @property {function} #callbacks.timeout      - Дії при відсутності відповіді від сервера
     * @property {function} #callbacks.resolve      - Дії при вдалому завершені процесу завантаження файлу
     * @property {function} #callbacks.reject       - Дії при не вдалому завершені процесу завантаження файлу
     * @property {function} #callbacks.finally      - Дії при завершені процесу завантаження файлу
     */
    #callbacks = {
        pause: () => {}, iteration: () => {}, timeout: () => {}, resolve: () => {}, reject: () => {}, finally: () => {}
    }

    /**
     * Конструктор
     * @param {object} files - Перелік FileList з файлами File
     * @param {object} [settings] - Налаштування
     * @param {object} [callbacks] - Функції зворотного виклику
     */
    constructor(files, settings = {}, callbacks = {}) {
        this.#fileList.files = files;
        for(let i = 0; i < this.#fileList.files.length; i ++)
            this.#fileList.size.total += this.#fileList.files[i].size;
        this.#settings = {...this.#settings, ...settings};
        this.#callbacks = {...this.#callbacks, ...callbacks};
        this.#file = this.#fileList.files[0];
        this.#callbacks.iteration(this.#getStatus());
    }

    /**
     * Починає процес завантаження файлу на сервер
     */
    start() {
        this.#timers.start = this.#getTime();
        this.#open().then();
    }

    /**
     * Призупиняє процес завантаження файлу на сервер
     */
    pause() {
        this.#request.speed = 0;
        this.#events.pause = true;
        this.#timers.pause = this.#getTime();
    }

    /**
     * Продовжує процес завантаження файлу на сервер
     */
    resume() {
        this.#events.pause = null;
        this.#chunk.size.coefficient = 1;
        this.#chunk.size.base = this.#settings.chunkSizeMinimum;
        this.#timers.start = this.#getTime() - (this.#timers.pause - this.#timers.start);
        switch (this.#request.data.get('action')) {
            case 'open': this.#open().then(); break;
            case 'append': this.#append().then(); break;
            case 'close': this.#close().then(); break;
        }
    }

    /**
     * Скасовує процес завантаження файлу на сервер
     */
    cancel() {
        if (this.#events.pause) {
            this.#remove();
        } else {
            this.#events.stop = true;
        }
        this.#callbacks.finally();
    }

    /**
     * Відкриває файл для запису на сервері
     * @see this.#request
     */
    #open = async () => {
        if (this.#file.size > this.#settings.fileSizeLimit)
            return this.#error('Розмір файлу більше дозволеного');
        this.#chunk.size.base = this.#settings.chunkSizeMinimum;
        this.#request.data = new FormData();
        this.#request.data.set('action', 'open');
        this.#request.data.set('name', this.#file.name);
        this.#file.uuid = await this.#send();
        if (this.#file.uuid === undefined) return;
        this.#request.data.set('uuid', this.#file.uuid);
        await this.#append();
    }

    /**
     * Додає частину файлу на сервер
     * @see this.#request
     * @see this.#chunk
     */
    #append = async () => {
        if (this.#events.pause) {this.#callbacks.pause();return;}
        if (this.#events.stop) {this.#remove();return;}
        this.#chunk.number ++;
        this.#chunk.size.value =
            this.#chunk.size.base * this.#chunk.size.coefficient;
        this.#chunk.value =
            this.#file.slice(this.#chunk.offset, this.#chunk.offset + this.#chunk.size.value);
        this.#request.data.set('action', 'append');
        this.#request.data.set('offset', this.#chunk.offset);
        this.#request.data.set('chunk', this.#chunk.value, this.#file.name);
        let response = await this.#send();
        if (response === undefined) return;
        this.#chunk.offset = response;
        this.#callbacks.iteration(this.#getStatus());
        let speed = Math.round(this.#chunk.value.size / this.#request.time);
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
        this.#request.data.delete('chunk');
        this.#chunk.size.coefficient = 3 - this.#chunk.size.coefficient;
        if (this.#chunk.offset < this.#file.size) {
            await this.#append();
        } else {
            await this.#close();
        }
    }

    /**
     * Закриває файл на сервері
     * @see this.#request
     */
    #close = async () => {
        this.#request.data.set('action', 'close');
        this.#request.data.set('time', this.#file.lastModified);
        let size = await this.#send();
        if (size === undefined) return;
        if (size !== this.#file.size)
            return this.#error('Неправильний розмір завантаженого файлу');
        console.debug(`Файл ${this.#file.name} завантажено`);
        this.#fileList.current ++;
        if (this.#fileList.current < this.#fileList.files.length) {
            this.#file = this.#fileList.files[this.#fileList.current];
            await this.#open();
        } else {
            this.#callbacks.resolve();
            this.#callbacks.finally();
        }
    }

    /**
     * Видаляє файл на сервері
     * @see this.#request
     */
    #remove = () => {
        this.#request.data.set('action', 'remove');
        this.#request.retry = false;
        this.#send();

    }

    /**
     * Формує запит до сервера та витягує дані з відповіді
     * @returns {object|void} - Відформатована відповідь сервера
     * @see this.#request
     */
    #send = async () => {
        let url = this.#settings.api;
        let body = {method: 'POST', body: this.#request.data};
        let retry = (this.#request.retry) ? 1 : 0;
        this.#request.time = (new Date()).getTime();
        let response = await this.#fetchExtended(url, body, retry);
        this.#request.time = ((new Date()).getTime() - this.#request.time) / 1000;
        if (response === undefined) return;
        let responseText = await response.text();
        if (response.status === 200)
            return /^\d+$/.test(responseText) ? +responseText : responseText;
        return this.#error(responseText);
    }

    /**
     * Відправляє запит на сервер з таймаутом та повторними запитами при потребі
     * @param {string} url - Адреса запиту
     * @param {object} body - Дані запиту
     * @param {number} [retry=1] - Номер повторного запиту, 0 - без повторів
     * @returns {Response|void} - Відповідь сервера при наявності
     */
    #fetchExtended = async (url, body, retry = 1) => {
        try {
            let fetchPromise = fetch(url, body);
            let timeoutPromise = new Promise(resolve =>
                (setTimeout(resolve, this.#settings.timeout * 1000))
            );
            let response = await Promise.race([fetchPromise, timeoutPromise]);
            if (response) return response;
            console.warn(`Перевищено час виконання запиту (${this.#settings.timeout}c)`);
        } catch (e) {
            console.warn('Під час виконання запиту виникла помилка: ' + e.message);
        }
        if ((retry === 0) || this.#events.stop) return;
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
    }

    /**
     * Вираховує та повертає дані про статус процесу завантаження файлу
     * @returns     {object}
     * @property    {number} chunk.number           - Номер частини файлу
     * @property    {number} chunk.size             - Розмір частини файлу, байти
     * @property    {number} chunk.time             - Час завантаження частини файлу, секунди
     * @property    {number} chunk.speed            - Швидкість завантаження частини файлу, байти/секунду
     * @property    {number} current.number         - Номер поточного файлу
     * @property    {string} current.name           - Назва поточного файлу
     * @property    {number} current.size.uploaded  - Розмір завантаженої частини поточного файлу, байти
     * @property    {number} current.size.total     - Загальний розмір поточного файлу, байти
     * @property    {number} total.numbers          - Загальна кількість файлів
     * @property    {number} total.size.uploaded    - Розмір завантаженої частини всіх файлів, байти
     * @property    {number} total.size.total       - Загальний розмір всіх файлів, байти
     * @property    {number} total.time.elapsed     - Час з початку завантаження файлів, секунди
     * @property    {number} total.time.estimate    - Прогнозований час до завершення завантаження файлів, секунди
     */
    #getStatus = () => {
        let status = {};
        status.chunk = {
            number: this.#chunk.number,
            size: this.#chunk.value.size,
            time: this.#request.time,
            speed: this.#request.speed
        }
        status.current = {
            number:  this.#fileList.current + 1,
            name: this.#file.name,
            size: {
                uploaded: this.#chunk.offset,
                total: this.#file.size
            }
        }
        status.total = {
            number: this.#fileList.files.length,
            size: {
                uploaded: this.#fileList.size.uploaded,
                total: this.#fileList.size.total,
            },
            time: {elapsed: 0, estimate: 0}
        }
        if (this.#timers.start > 0)
            status.total.time.elapsed = this.#getTime() - this.#timers.start;
        if (status.total.size.uploaded > 0) {
            status.total.time.estimate =
                Math.round(status.total.size.total / (status.total.size.uploaded / status.total.time.elapsed))
            status.total.time.estimate -= status.total.time.elapsed;
        }
        return status;
    }

    /**
     * Повертає поточну мітку часу
     * @returns {number} - Мітка часу, секунди
     */
    #getTime = () => {
        return Math.round((new Date()).getTime() / 1000);
    }

    /**
     * Виконує дії при помилці
     * @param {string} message - Текст помилки
     */
    #error = (message) => {
        this.#callbacks.reject(message);
        this.#callbacks.finally();
        console.error(message);
    }
}