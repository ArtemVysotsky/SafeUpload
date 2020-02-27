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

error_reporting(0);
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
set_error_handler('errorHandler');
register_shutdown_function('shutdownHandler');

$response = [];

try {

    require_once('File.php');

    if (!isset($_GET['action'])) throw new Exception('Відсутня дія');
    if (!isset($_GET['name'])) throw new Exception('Відсутня назва файлу');

    $file = new File($_GET['name']);

    try {

        if (isset($_POST['hash'])) $file->setHash($_POST['hash']);

        switch($_GET['action']) {

            case 'open': $response['hash'] = $file->open(); break;

            case 'append': {

                if ((count($_FILES) == 0) || (!isset($_FILES['chunk'])))
                    throw new Exception('Відсутній фрагмент файла');

                $response['size'] = $file->append($_FILES['chunk'], $_POST['offset']);

            } break;

            case 'close': $response['size'] = $file->close($_POST['time'] ?? null); break;

            case 'remove': $file->remove(); break;

            default: throw new Exception('Невідома дія');
        }

        output($response);

    } catch (Exception $exception) {

        $file->remove();
        throw $exception;
    }

} catch (Exception $exception) {

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

    output(['error' => $message]);

    $error = sprintf('%s  %s (%s:%d, %d)', date('Y-m-d H:i:s'), $message, $file, $line, $type);

    file_put_contents(__DIR__ . '/log', $error . "\r\n", FILE_APPEND);
}

/**
 * Вивід в JSON-формат
 *
 * @param array $response Дані для виводу
 */
function output($response) {

    echo json_encode($response, JSON_UNESCAPED_UNICODE);
}