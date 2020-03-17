<?php
/**
 * Клас для роботи з файлом завантаження
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/SafeUpload
 * @copyright   GNU General Public License v3
 */

class File {

    /** @var string Назва файлу */
    private $name;

    /** @var string Назва тимчасового файлу */
    private $nameTemporary;

    /** @var string Повна назва файлу з шляхом */
    private $source;

    /** @var string Повна назва тимчасового файлу з шляхом */
    private $sourceTemporary;

    /** @var string Шлях до теки зберігання завантажених файлів */
    protected $path = '';

    /** @var string Шлях до теки тимчасового зберігання файлу під час завантження */
    protected $pathTemporary = '';

    /** @var string Хеш файлу */
    protected $hash;

    /** @var integer Максимальний розмір файлу */
    protected $sizeMaximum = 0;

    /** @var boolean Ознака дозволу перезапису файлів з однаковою назвою */
    protected $isOverwrite = false;

    /** @var array Перелік кодів та опису помилок завантаження файлів */
    protected $errors = array(

        UPLOAD_ERR_INI_SIZE     => 'Розмір фрагмента файлу більший за допустимий в налаштуваннях сервера',
        UPLOAD_ERR_FORM_SIZE    => 'Розмір фрагмента файлу більший за значення MAX_FILE_SIZE, вказаний в HTML-формі',
        UPLOAD_ERR_PARTIAL      => 'Фрагмент файлу завантажено тільки частково',
        UPLOAD_ERR_NO_FILE      => 'Фрагмент файлу не завантажено',
        UPLOAD_ERR_NO_TMP_DIR   => 'Відсутня тимчасова тека',
        UPLOAD_ERR_CANT_WRITE   => 'Не вдалось записати фрагмент файлу на диск',
        UPLOAD_ERR_EXTENSION    => 'Сервер зупинив завантаження фрагмента файлу',
    );


    /**
    * Конструктор класу
    */
    public function __construct() {

    }

    /**
     * Зберігає шлях до теки зберігання завантажених файлів
     *
     * @param string $path Шлях до теки
     */
    public function setPath(string $path): void {

        $this->path = $path;
    }

    /**
     * Зберігає шлях до теки тимчасового зберігання файлу під час завантження
     *
     * @param string $path Шлях до теки
     */
    public function setPathTemporary(string $path): void {

        $this->pathTemporary = $path;
    }

    /**
     * Зберігає максимальний розмір файлу
     *
     * @param integer $size Розмір файлу
     */
    public function setSizeMaximum(int $size): void {

        $this->sizeMaximum = $size;
    }

    /**
     * Зберігає ознаку дозволу перезапису файлів з однаковою назвою
     *
     * @param boolean $value Ознака дозволу перезапису
     */
    public function setIsOverwrite(bool $value): void {

        $this->isOverwrite = $value;
    }

    /**
     * Зберігає назву файлу
     *
     * @param string $name Назва файлу
     */
    public function setName(string $name): void {

        $this->name = $name;

        $this->setSource();
    }

    /**
     * Створює та зберігає назву файлу
     */
    protected function setSource(): void {

        $this->source = $this->path . DIRECTORY_SEPARATOR . $this->name;
    }

    /**
     * Зберігає хеш файлу
     *
     * @param string $hash Хеш файлу
     * @param boolean $check Ознака перевіки файл на наявність
     */
    protected function setHash(string $hash, bool $check = true): void {

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
    * @return string Хеш файлу
    */
    public function open(): string {

        if (!$this->isOverwrite && file_exists($this->source))
            throw new Exception('Файл з такою назвою вже існує');

        $this->setHash(bin2hex(random_bytes(16)), false);

        file_put_contents($this->sourceTemporary, null);

        return $this->hash;
    }

    /**
     * Додає в тимчасовий файл надісланий шматок
     *
     * @param string $hash Хеш файлу
     * @param array $file Масив з даними завантаженого файлу шматка
     * @param integer $offset Зміщення фрагмента файлу відносно початку файлу
     * @return integer Розмір тимчасового файлу після запису шматка
     */
    public function append(string $hash, array $file, int $offset): int {

        $this->setHash($hash);

        if ($file['error'] !== 0)
            throw new Exception('Помилка завантаження: ' . $this->errors[$file['error']]);

        if (!is_uploaded_file($file['tmp_name']))
            throw new Exception('Неправильно завантажений файл');

        $size = filesize($this->sourceTemporary);

        if (($size + $file['size']) > $this->sizeMaximum)
            throw new Exception('Розмір файлу перевищує допустимий');

        if ($size != $offset) return $size;

        $chunk = file_get_contents($file['tmp_name']);

        $result = file_put_contents($this->sourceTemporary, $chunk, FILE_APPEND);

        return $size + $result;
    }

    /**
     * Закриває тимчасовий файл (перетворює в постійний)
     *
     * @param string $hash Хеш файлу
     * @param integer|null $time Час останньої модифікації файлу
     * @return integer Остаточний розмір файлу
     */
    public function close(string $hash, int $time = null): int {

        $this->setHash($hash);

        if (!$this->isOverwrite && file_exists($this->source))
            throw new Exception('Файл з такою назвою вже існує');

        rename($this->sourceTemporary, $this->source);

        if (isset($time))
            touch($this->source, round($time / 1000), time());

        return filesize($this->source);
    }

    /**
     * Видаляє тимчасовий файл
     *
     * @param string $hash Хеш файлу
     */
    public function remove(string $hash): void {

        $this->setHash($hash);

        if (file_exists($this->sourceTemporary))
            unlink($this->sourceTemporary);
    }
}