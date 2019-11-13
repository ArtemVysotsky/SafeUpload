<?php
/**
 * Файл з API для керування процесом завантаження
 *
 * @author      Артем Висоцький <a.vysotsky@gmail.com>
 * @package     Upload
 * @link        http://upload.local
 * @copyright   Всі права застережено (c) 2019 Upload
 */
header('HTTP/1.x 502 Bad Gateway');
//header('HTTP/1.x 503 Service Unavailable');
//header('HTTP/1.x 504 Gateway Timeout');
exit();
set_error_handler('exceptionErrorHandler');

$output = [];

try {

    require_once('File.php');

    if (!isset($_GET['action'])) throw new Exception('Відсутня дія');

    if (!isset($_POST['name'])) throw new Exception('Відсутня назва файлу');

    $file = new File($_POST['name'], $_POST['hash'] ?? null);

    switch($_GET['action']) {

        case 'open': $output['hash'] = $file->open(); break;

        case 'append': $output['size'] = $file->append(($_FILES['chunk']) ?? null); break;

        case 'close': $output['size'] = $file->close(($_POST['time']) ?? null); break;

        case 'remove': $file->remove(); break;

        case 'size': $output['size'] = $file->size(); break;

        default: throw new Exception('Невідома дія');
    }

} catch (Throwable $exception) {

    header('HTTP/1.x 500 Internal Server Error');

    if (isset($file) && is_object($file) && isset($_POST['hash'])) $file->remove();

    $output['exception'] = $exception->getMessage();
}

echo json_encode($output, JSON_UNESCAPED_UNICODE);


/**
 * Перетворює помилки у винятки
 *
 * @param integer $number Номер помилки
 * @param string $string Опис помилки
 * @param string $file Назва файлу, в якому виникла помилка
 * @param integer $line Номер рядка файлу, в якому виникла помилка
 * @throws ErrorException Error to Exception
 */
function exceptionErrorHandler(int $number, string $string, string $file, int $line) {

    throw new ErrorException($string, 0, $number, $file, $line);
}