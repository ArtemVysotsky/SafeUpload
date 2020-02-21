<?php
/**
 * Клас File для роботи з файлом завантаження
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
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
    protected $path = __DIR__ . '/uploads';

    /** @var string Шлях до теки тимчасового зберігання файлу під час завантження */
    protected $pathTemporary = __DIR__  . '/uploads/.tmp';

    /** @var string Хеш файла */
    protected $hash;

    /** @var integer Максимальний розмір файла */
    protected $sizeMaximum = 10 * 1024 * 1024 * 1024;

    /** @var boolean Ознака дозволу перезапису файлів з однаковою назвою */
    protected $overwrite = true;

    /** @var array Перелік кодів та опису помилок завантаження файлів */
    protected $errors = array(

        UPLOAD_ERR_INI_SIZE     => 'Розмір фрагмента файла більший за допустимий в налаштуваннях сервера',
        UPLOAD_ERR_FORM_SIZE    => 'Розмір фрагмента файла більший за значення MAX_FILE_SIZE, вказаний в HTML-формі',
        UPLOAD_ERR_PARTIAL      => 'Фрагмент файла завантажено тільки частково',
        UPLOAD_ERR_NO_FILE      => 'Фрагмент файла не завантажено',
        UPLOAD_ERR_NO_TMP_DIR   => 'Відсутня тимчасова тека',
        UPLOAD_ERR_CANT_WRITE   => 'Не вдалось записати фрагмент файла на диск',
        UPLOAD_ERR_EXTENSION    => 'Сервер зупинив завантаження фрагмента файла',
    );


    /**
    * Конструктор класу
    *
    * @param string $name Назва файла
    */
    public function __construct(string $name) {

        $this->setName($name);
     }

    /**
     * Перевіряє та зберігає назву файла
     *
     * @param string $name Назва файла
     */
    protected function setName($name): void {

        $this->name = $name;

        $this->source = $this->path . DIRECTORY_SEPARATOR . $this->name;

        if (!$this->overwrite && file_exists($this->source))
            throw new Exception('Файл з такою назвою вже існує');
    }

    /**
     * Перевіряє та зберігає хеш файла
     *
     * @param string $hash Хеш файла
     * @param boolean $check Ознака перевіки файл на наявність
     */
    public function setHash(string $hash, bool $check = true): void {

        if (!preg_match('/^[0-9abcdef]{32}$/', $hash))
            throw new Exception('Неправильний хеш файлу');

        $this->hash = $hash;

        $this->nameTemporary = $this->name . '.' . $this->hash;

        $this->sourceTemporary =
            $this->pathTemporary . DIRECTORY_SEPARATOR . $this->nameTemporary;

        if ($check && !file_exists($this->sourceTemporary))
            throw new Exception(sprintf('Файл "%s" не знайдено', $this->sourceTemporary));
    }

    /**
    * Створює тимчасовий файл
    *
    * @return string Хеш файла
    */
    public function open(): string {

        $this->setHash(bin2hex(random_bytes(16)), false);

        file_put_contents($this->sourceTemporary, null);

        return $this->hash;
    }

    /**
     * Додає в тимчасовий файл надісланий шматок
     *
     * @param array $file Масив з даними завантаженого файлу шматка
     * @param integer $offset Зміщення фрагмента файла відносно початку файла
     * @return integer Розмір тимчасового файла після запису шматка
     */
    public function append(array $file, int $offset): int {

        if (!isset($this->hash))
            throw new Exception('Відсутній хеш файла');

        if ($file['error'] !== 0)
            throw new Exception('Помилка завантаження: ' . $this->errors[$file['error']]);

        if (!is_uploaded_file($file['tmp_name']))
            throw new Exception('Неправильно завантажений файл');

        $size = filesize($this->sourceTemporary);

        if (($size + $file['size']) > $this->sizeMaximum)
            throw new Exception('Розмір файла перевищує допустимий');

        if ($size != $offset) return $size;

        $chunk = file_get_contents($file['tmp_name']);

        $result = file_put_contents($this->sourceTemporary, $chunk, FILE_APPEND);

        return $size + $result;
    }

    /**
     * Закриває тимчасовий файл (перетворює в постійний)
     *
     * @param integer|null $time Час останньої модифікації файла
     * @return integer Остаточний розмір файла
     */
    public function close(int $time = null): int {

        if (!isset($this->hash))
            throw new Exception('Відсутній хеш файла');

        rename($this->sourceTemporary, $this->source);

        if (isset($time))
            touch($this->source, round($time / 1000), time());

        return filesize($this->source);
    }

    /**
     * Видаляє тимчасовий файл
     */
    public function remove(): void {

        if (!isset($this->hash))
            throw new Exception('Відсутній хеш файла');

        if (file_exists($this->sourceTemporary))
            unlink($this->sourceTemporary);
    }
}