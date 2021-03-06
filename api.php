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

$response = '';

$settings = [
    'path'          => __DIR__ . '/uploads',
    'pathTemporary' => __DIR__ . '/uploads/.tmp',
    'size'          => 3 * 1024 ** 3,
    'isOverwrite'   => true
];

try {

    require_once('File.php');

    $file = new File($_POST['name'], $settings);

    switch($_POST['action']) {

        case 'open': $response = $file->open(); break;

        case 'append': $response = $file->append($_POST['uuid'], $_FILES['chunk'], $_POST['offset']); break;

        case 'close': $response = $file->close($_POST['uuid'], $_POST['time'] ?? null); break;

        case 'remove': $file->remove($_POST['uuid']); break;

        default: throw new Exception('Невідома дія');
    }

    echo $response;

} catch (Exception $e) {

    error($e->getMessage(), $e->getFile(), $e->getLine(), $e->getCode(), $e->getTraceAsString());

} catch (Error $error) {

    error($error->getMessage(), $error->getFile(), $error->getLine(), $error->getCode());
}

/**
 * Перехоплення помилок
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
 * Перехоплення критичних помилок
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
 * @param string|null $trace Трасування
 */
function error(string $message, string $file, int $line, int $type, string $trace = null) {

    header('HTTP/1.x 500 Internal Server Error');

    $error = sprintf('%s  %s (%s:%d, %d)', date('Y-m-d H:i:s'), $message, $file, $line, $type);

    if (isset($trace)) $error .= "\r\n" . $trace;

    file_put_contents(__DIR__ . '/log', $error . "\r\n", FILE_APPEND);

    exit($trace ? $message : 'Внутрішня помилка сервера');
}
