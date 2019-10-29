<?php
/**
 * Клас File для роботи з файлом завантаження
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */

class File {

    /** @var string Назва файла */
    private $name;

    /** @var string Назва тимчасового файла */
    private $nameTemporary;

    /** @var string Повна назва файла з шляхом */
    private $source;

    /** @var string Повна назва тимчасового файла з шляхом */
    private $sourceTemporary;

    /** @var string Шлях до теки зберігання завантажених файлів */
    private $path = __DIR__ . '/uploads';

    /** @var string Шлях до теки тимчасового зберігання файлу під час завантження */
    private $pathTemporary = __DIR__  . '/uploads/.tmp';

    /** @var string Хеш файла */
    private $hash;

    /** @var integer Максимальний розмір файла */
    private $size = 100 * 1048576;

    /** @var boolean Ознака дозволу перезапису файлів з однаковою назвою */
    private $overwrite = true;

    /** @var array Перелік кодів та опису помилок завантаження файлів */
    protected $errors = array(

        UPLOAD_ERR_INI_SIZE     => 'Розмір зображення більший за допустимий в налаштуваннях сервера',
        UPLOAD_ERR_FORM_SIZE    => 'Розмір зображення більший за значення MAX_FILE_SIZE, вказаний в HTML-формі',
        UPLOAD_ERR_PARTIAL      => 'Зображення завантажено тільки частково',
        UPLOAD_ERR_NO_FILE      => 'Зображення не завантажено',
        UPLOAD_ERR_NO_TMP_DIR   => 'Відсутня тимчасова тека',
        UPLOAD_ERR_CANT_WRITE   => 'Не вдалось записати зображення на диск',
        UPLOAD_ERR_EXTENSION    => 'Сервер зупинив завантаження зображення',
    );


    /**
    * Конструктор класу
    *
    * @param string $name Назва файла
    * @param string|null $hash Хеш файла
    */
    public function __construct(string $name, string $hash = null) {

        $this->name = $name;

        $this->source = $this->path . DIRECTORY_SEPARATOR . $this->name;

        if (!$this->overwrite && file_exists($this->source))

            throw new Exception('Файл з такою назвою вже існує');

        if (isset($hash)) {

            $this->hash = $hash;

            $this->setTemporary();
        }
    }

    /**
    * Встановлює тимчасові назву та шлях файла
    *
    * @param boolean $exists Ознака виконання перевірки наявності тимчасового файлау
    */
    private function setTemporary($exists = true): void {

        if (strlen($this->hash) == 0) throw new Exception('Відсутній хеш файлу');

        if (!preg_match('/^[0-9abcdef]{32}$/', $this->hash))

            throw new Exception('Неправильний хеш файлу');

        $this->nameTemporary = $this->name . '.' . $this->hash;

        $this->sourceTemporary =

            $this->pathTemporary . DIRECTORY_SEPARATOR . $this->nameTemporary;

        if ($exists && !file_exists($this->sourceTemporary))

            throw new Exception('Невідомий файл');
    }

    /**
    * Створює тимчасовий файл
    *
    * @return string Хеш файла
    */
    public function open(): string {

        $this->hash = bin2hex(random_bytes(16));

        $this->setTemporary(false);

        if (file_put_contents($this->sourceTemporary, null) === false)

            throw new Exception('Неможливо створити тимчасовий файл');

        return $this->hash;
    }

    /**
     * Додає в тимчасовий файл надісланий шматок
     *
     * @param array $chunk Масив з даними завантаженого файлу шматка
     * @return integer Розмір тимчасового файла після запису шматка
     */
    public function append(array $chunk): int {

        if ($chunk['error'] !== 0) {

            $error = $chunk['error'];

            throw new Exception('Помилка завантаження: ' . $this->errors[$error]);
        }

        if (!is_uploaded_file($chunk['tmp_name']))

            throw new Exception('Неправильно завантажений файл');

        $chunk = file_get_contents($chunk['tmp_name']);

        if ($chunk === false)

            throw new Exception('Неможливо зчитати дані з надісланого файлу');

        $result = file_put_contents($this->sourceTemporary, $chunk, FILE_APPEND);

        if ($result === false)

            throw new Exception('Неможливо записати дані в тимчасовий файл');

        $size = $this->size();

        if ($size > $this->size)

            throw new Exception('Розмір файла перевищує допустимий');

        return $size;
    }

    /**
     * Видаляє тимчасовий файл
     */
    public function remove(): void {

        if (!unlink($this->sourceTemporary))

            throw new Exception('Неможливо видалити тимчасовий файл');
    }

    /**
     * Закриває тимчасовий файл (перетворює в постійний)
     *
     * @param integer $time Час останньої модифікації файла
     * @return integer Остаточний розмір файла
     */
    public function close(int $time = null): int {

        if (!rename($this->sourceTemporary, $this->source))

            throw new Exception('Неможливо зберегти тимчасовий файл');

        if (isset($time))

            if (!touch($this->source, $time))

                throw new Exception('Неможливо встановити час останньої модифікації файлу');

        return filesize($this->source);
    }

    /**
     * Визначає розмір файла
     *
     * @return integer Поточний розмір файла
     */
    public function size(): int {

        if (!($size = filesize($this->sourceTemporary)))

            throw new Exception('Неможливо визначити розмір файла');

        return $size;
    }
}