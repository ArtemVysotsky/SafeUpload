<?php
/**
 * API для керування процесом завантаження
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @link        https://github.com/ArtemVysotsky/Upload
 * @copyright   GNU General Public License v3
 */

/** ToDo: Перевірити роботу при помилках */
/** ToDo: Перевірити видалення файла при помилці */

/*
error_reporting(0);
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
*/

set_error_handler('errorHandler');

register_shutdown_function('shutdownHandler');

try {

    $response = [];

    require_once('File.php');

    $file = new File();

    $file->setPath(__DIR__ . '/uploads');

    $file->setPathTemporary(__DIR__  . '/uploads/.tmp');

    $file->setSizeMaximum(3 * 1024 * 1024 * 1024);

    $file->setIsOverwrite(true);

    $file->setName($_GET['name']);

    switch($_GET['action']) {

        case 'open': $response['hash'] = $file->open(); break;

        case 'append': $response['size'] = $file->append($_POST['hash'], $_FILES['chunk'], $_POST['offset']); break;

        case 'close': $response['size'] = $file->close($_POST['hash'], $_POST['time'] ?? null); break;

        case 'remove': $file->remove($_POST['hash']); break;

        default: throw new Exception('Невідома дія');
    }

    echo json_encode($response, JSON_UNESCAPED_UNICODE);

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

    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE);

    $error = sprintf('%s  %s (%s:%d, %d)', date('Y-m-d H:i:s'), $message, $file, $line, $type);

    file_put_contents(__DIR__ . '/log', $error . "\r\n", FILE_APPEND);
}
