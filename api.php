<?php
/**
 * API для керування процесом завантаження
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/SafeUpload
 * @copyright   GNU General Public License v3
 */

error_reporting(0);
set_error_handler('errorHandler');
register_shutdown_function('shutdownHandler');

try {

    $response = [];

    $settings = [
        'path'          => __DIR__ . '/uploads',
        'pathTemporary' => __DIR__ . '/uploads/.tmp',
        'size'          => 3 * 1024 ** 3,
        'isOverwrite'   => true
    ];

    require_once('File.php');

    $file = new File($_POST['name'], $settings);

    switch($_POST['action']) {

        case 'open': $response = $file->open(); break;

        case 'append': $response = $file->append($_POST['hash'], $_FILES['chunk'], $_POST['offset']); break;

        case 'close': $response = $file->close($_POST['hash'], $_POST['time'] ?? null); break;

        case 'remove': $file->remove($_POST['hash']); break;

        default: throw new Exception('Невідома дія');
    }

    echo $response;

} catch (Exception $exception) {

    if (isset($file) && is_object($file) && isset($_POST['hash']))

        $file->remove($_POST['hash']);

    error($exception->getMessage(), $exception->getFile(), $exception->getLine(), $exception->getCode());
}

/**
 * Перетворює помилки у винятки
 *
 * @param integer $number Номер помилки
 * @param string $string Опис помилки
 * @param string $file Назва файлу, в якому виникла помилка
 * @param integer $line Номер рядка файлу, в якому виникла помилка
 */
function errorHandler(int $number, string $string, string $file, int $line) {

    error($string, $file, $line, $number);
}

/**
 * Вивід критичних помилок
 */
function shutdownHandler() {

    $error = error_get_last();

    if (!isset($error)) return;

    error($error['message'], $error['file'], $error['line'], $error['type']);
}

/**
 * Вивід та логування помилки
 *
 * @param string $message Опис помилки
 * @param string $file Назва файлу, в якому виникла помилка
 * @param integer $line Номер рядка файлу, в якому виникла помилка
 * @param integer $type Тип помилки
 */
function error($message, $file, $line, $type) {

    header('HTTP/1.x 500 Internal Server Error');

    $error = sprintf('%s (%s:%d, %d)', $message, $file, $line, $type);

    $log = sprintf("%s  %s\r\n", date('Y-m-d H:i:s'), $error);

    file_put_contents(__DIR__ . '/log', $log, FILE_APPEND);

    exit($message);
}
